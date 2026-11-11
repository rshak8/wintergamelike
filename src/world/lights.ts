// Пул точечных ламп. Источников света на уровне десятки (факелы, жаровни, кристаллы, сундуки),
// а настоящих ламп всего 8: их число никогда не меняется, поэтому шейдеры не перекомпилируются.
// Каждый кадр лампы достаются источникам рядом с камерой; лампа, которую передают другому
// источнику, сначала плавно гаснет, а новая плавно разгорается — ничего не «выпрыгивает».
import * as THREE from 'three';

/** Всё, что светится: факел, жаровня, кристалл, сундук... */
export interface LightSource {
  x: number; y: number; z: number;
  color: THREE.Color;
  intensity: number;
  range: number;
  flicker: boolean;
  phase?: number; // сдвиг мерцания
  decay?: number; // затухание с расстоянием; меньше = светит дальше (по умолчанию 1.7)
}

interface LightSlot { light: THREE.PointLight; src: LightSource | null; weight: number }

export class LightPool {
  private sources: LightSource[] = [];
  private slots: LightSlot[] = [];
  // переиспользуются каждый кадр (без мусора): лучшие источники и их оценки, лучший первый
  private want: LightSource[] = [];
  private wantScore: number[] = [];

  constructor(scene: THREE.Scene, count = 8) {
    for (let i = 0; i < count; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 6, 1.7);
      scene.add(light);
      this.slots.push({ light, src: null, weight: 0 });
    }
  }

  add(src: LightSource) { if (!this.sources.includes(src)) this.sources.push(src); return src; }
  remove(src: LightSource) { const i = this.sources.indexOf(src); if (i >= 0) this.sources.splice(i, 1); }

  /** Заполняет want самыми важными источниками рядом с focus (ближе — важнее, ярче — чуть важнее). */
  private pick(focus: THREE.Vector3) {
    const want = this.want, score = this.wantScore, max = this.slots.length;
    want.length = 0; score.length = 0;
    for (const s of this.sources) {
      if (s.intensity <= 0.01) continue;
      const d2 = (s.x - focus.x) ** 2 + (s.z - focus.z) ** 2;
      if (d2 > 15 * 15) continue;
      const sc = d2 - s.intensity * 0.6;
      if (want.length === max && sc >= score[max - 1]) continue;
      // вставка в короткий отсортированный список
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
    // лампы у источников, которые ещё нужны, разгораются; остальные гаснут и освобождаются
    for (const slot of this.slots) {
      if (!slot.src) continue;
      const i = want.indexOf(slot.src);
      if (i < 0) {
        slot.weight -= fade;
        if (slot.weight <= 0) { slot.src = null; slot.weight = 0; }
      } else {
        slot.weight = Math.min(1, slot.weight + fade);
        want.splice(i, 1); this.wantScore.splice(i, 1); // у него лампа уже есть
      }
    }
    // свободные лампы отдаём тем, кому ещё не досталось
    for (const slot of this.slots) {
      if (slot.src || !want.length) continue;
      slot.src = want.shift()!; slot.weight = 0;
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
      l.decay = s.decay ?? 1.7; // это uniform — смена не перекомпилирует шейдеры
      l.intensity = s.intensity * k * slot.weight;
    }
  }
}
