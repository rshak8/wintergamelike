import * as THREE from 'three';

/**
 * A fixed set of point lights shared by every light source in the level.
 * The number of lights never changes, so shaders never recompile mid-game.
 * Each frame the sources closest to the camera get a light; a light that is
 * handed to another source fades out first and the new one fades in, so
 * nothing pops while the player walks around.
 */
export class LightPool {
  constructor(scene, count = 8) {
    this.sources = [];
    this.slots = [];
    for (let i = 0; i < count; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 6, 1.7);
      scene.add(light);
      this.slots.push({ light, src: null, w: 0 });
    }
  }

  add(src) { if (!this.sources.includes(src)) this.sources.push(src); return src; }
  remove(src) { const i = this.sources.indexOf(src); if (i >= 0) this.sources.splice(i, 1); }

  update(dt, time, focus) {
    // pick the strongest nearby sources
    const scored = [];
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
      const s = want.values().next().value;
      want.delete(s);
      slot.src = s; slot.w = 0;
    }
    for (const slot of this.slots) {
      const l = slot.light, s = slot.src;
      if (!s) { l.intensity = 0; continue; }
      let k = 1;
      if (s.flicker) k = 0.86 + Math.sin(time * 13 + s.phase) * 0.08 + Math.sin(time * 23 + s.phase * 2) * 0.06;
      l.position.set(s.x, s.y, s.z);
      l.color.copy(s.color);
      l.distance = s.range;
      l.intensity = s.intensity * k * slot.w;
    }
  }
}
