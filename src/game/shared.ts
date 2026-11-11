// Общие геометрии и материалы для объектов, которых в игре много (пули, полумесяцы, монеты,
// обломки, тени). Раньше каждый выстрел создавал свои и никогда их не освобождал.
import * as THREE from 'three';
import { TEX } from '../fx/textures';

export function makeShared() {
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;
  return {
    /** Квадрат 1×1 на полу (тени и т. п.). */
    floorQuad: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    shadowMat: new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, depthWrite: false }),
    // снаряды врагов
    crescentGeo: new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2),
    crescentMat: new THREE.MeshBasicMaterial({ map: TEX.crescent, color: 0xff2a2a, side: THREE.DoubleSide, ...additive }),
    bulletMat: new THREE.SpriteMaterial({ map: TEX.dot, color: 0xff3a2a, transparent: true, depthWrite: false }),
    bulletCoreMat: new THREE.SpriteMaterial({ map: TEX.dot, color: 0xffffff, transparent: true, depthWrite: false }),
    orbGlowMat: new THREE.SpriteMaterial({ map: TEX.glow, color: 0xa040ff, ...additive }),
    // снаряд посоха героя
    boltGlowMat: new THREE.SpriteMaterial({ map: TEX.glow, color: 0xb08aff, ...additive }),
    boltCoreMat: new THREE.SpriteMaterial({ map: TEX.dot, color: 0xffffff, ...additive }),
    // монеты
    coinGeo: new THREE.CylinderGeometry(0.12, 0.12, 0.035, 10).rotateZ(Math.PI / 2),
    coinMat: new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0xffa020, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.35 }),
    // обломки ящиков: единичный куб, размер задаётся масштабом
    debrisGeo: new THREE.BoxGeometry(1, 1, 1),
    debrisMats: new Map<number, THREE.MeshStandardMaterial>(),
  };
}
export type Shared = ReturnType<typeof makeShared>;

/** Один общий материал на каждый цвет обломков. */
export function debrisMaterial(shared: Shared, color: number) {
  let m = shared.debrisMats.get(color);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 }); shared.debrisMats.set(color, m); }
  return m;
}
