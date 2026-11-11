import * as THREE from 'three';

/** Anything that can glow: a torch, brazier, crystal, chest beacon... */
export interface LightSource {
  x: number; y: number; z: number;
  color: THREE.Color;
  intensity: number;
  range: number;
  flicker: boolean;
  phase?: number; // flicker offset
  decay?: number; // distance falloff; lower = light spreads further (default 1.7)
}

interface LightSlot { light: THREE.PointLight; src: LightSource | null; w: number }

/**
 * A fixed set of point lights shared by every light source in the level.
 * The number of lights never changes, so shaders never recompile mid-game.
 * Each frame the sources closest to the camera get a light; a light that is
 * handed to another source fades out first and the new one fades in, so
 * nothing pops while the player walks around.
 */
export class LightPool {
  sources: LightSource[] = [];
  slots: LightSlot[] = [];

  constructor(scene: THREE.Scene, count = 8) {
    for (let i = 0; i < count; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 6, 1.7);
      scene.add(light);
      this.slots.push({ light, src: null, w: 0 });
    }
  }

  add(src: LightSource) { if (!this.sources.includes(src)) this.sources.push(src); return src; }
  remove(src: LightSource) { const i = this.sources.indexOf(src); if (i >= 0) this.sources.splice(i, 1); }

  // reused every frame (no per-frame allocations): the best sources and their scores, best first
  private want: LightSource[] = [];
  private wantScore: number[] = [];

  /** Fill `want` with the strongest sources near focus (closest first, brighter ones win ties). */
  private pick(focus: THREE.Vector3) {
    const want = this.want, score = this.wantScore, max = this.slots.length;
    want.length = 0; score.length = 0;
    for (const s of this.sources) {
      if (s.intensity <= 0.01) continue;
      const d2 = (s.x - focus.x) ** 2 + (s.z - focus.z) ** 2;
      if (d2 > 15 * 15) continue;
      const sc = d2 - s.intensity * 0.6;
      if (want.length === max && sc >= score[max - 1]) continue;
      // insertion into a short sorted list
      let i = Math.min(want.length, max - 1);
      if (want.length < max) { want.push(s); score.push(sc); }
      while (i > 0 && score[i - 1] > sc) { want[i] = want[i - 1]; score[i] = score[i - 1]; i--; }
      want[i] = s; score[i] = sc;
    }
  }

  update(dt: number, time: number, focus: THREE.Vector3) {
    this.pick(focus);
    const want = this.want;

    const fade = Math.min(1, dt * 5);
    for (const slot of this.slots) {
      if (!slot.src) continue;
      const i = want.indexOf(slot.src);
      if (i < 0) {
        slot.w -= fade;
        if (slot.w <= 0) { slot.src = null; slot.w = 0; }
      } else {
        slot.w = Math.min(1, slot.w + fade);
        want.splice(i, 1); this.wantScore.splice(i, 1); // already has a light
      }
    }
    // hand free lights to sources that still need one
    for (const slot of this.slots) {
      if (slot.src || !want.length) continue;
      slot.src = want.shift()!; slot.w = 0;
    }
    for (const slot of this.slots) {
      const l = slot.light, s = slot.src;
      if (!s) { l.intensity = 0; continue; }
      let k = 1;
      if (s.flicker) {
        const ph = s.phase ?? 0;
        k = 0.86 + Math.sin(time * 13 + ph) * 0.08 + Math.sin(time * 23 + ph * 2) * 0.06;
      }
      l.position.set(s.x, s.y, s.z);
      l.color.copy(s.color);
      l.distance = s.range;
      l.decay = s.decay ?? 1.7; // a uniform, so changing it never recompiles shaders
      l.intensity = s.intensity * k * slot.w;
    }
  }
}
