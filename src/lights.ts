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

  update(dt: number, time: number, focus: THREE.Vector3) {
    // pick the strongest nearby sources
    const scored: { s: LightSource; score: number }[] = [];
    for (const s of this.sources) {
      if (s.intensity <= 0.01) continue;
      const d2 = (s.x - focus.x) ** 2 + (s.z - focus.z) ** 2;
      if (d2 > 15 * 15) continue;
      scored.push({ s, score: d2 - s.intensity * 0.6 });
    }
    scored.sort((a, b) => a.score - b.score);
    const want = new Set(scored.slice(0, this.slots.length).map((o) => o.s));

    const fade = Math.min(1, dt * 5);
    for (const slot of this.slots) {
      if (slot.src && !want.has(slot.src)) {
        slot.w -= fade;
        if (slot.w <= 0) { slot.src = null; slot.w = 0; }
      } else if (slot.src) {
        slot.w = Math.min(1, slot.w + fade);
        want.delete(slot.src);
      }
    }
    // hand free lights to sources that still need one
    for (const slot of this.slots) {
      if (slot.src || !want.size) continue;
      const s = want.values().next().value!;
      want.delete(s);
      slot.src = s; slot.w = 0;
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
