import * as THREE from 'three';

/** Точка в мире; высота y необязательна (каждый эффект подставляет свою по умолчанию). */
export interface XYZ { x: number; y?: number; z: number }
/** Точка или направление на плоскости пола. */
export interface XZ { x: number; z: number }

/** Случайное число от a до b. */
export const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Перемешивает массив на месте и возвращает его же. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Угол поворота (вокруг Y), чтобы из точки from смотреть на точку to. 0 = вдоль +Z. */
export const angleTo = (from: XZ, to: XZ) => Math.atan2(to.x - from.x, to.z - from.z);

/** Единичный вектор на полу по углу поворота. */
export const dirFromAngle = (angle: number) => new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

/** Приводит угол к диапазону -PI..PI (кратчайший поворот). */
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Пружина с критическим затуханием: плавно тянет cur к target без перелёта.
 * vel хранит скорость между кадрами, поэтому движение разгоняется и тормозит мягко.
 * smoothTime — примерное время, за которое догоняем цель.
 */
export function smoothDamp(cur: THREE.Vector3, target: THREE.Vector3, vel: THREE.Vector3, smoothTime: number, dt: number) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const a of ['x', 'y', 'z'] as const) {
    const change = cur[a] - target[a];
    const temp = (vel[a] + omega * change) * dt;
    vel[a] = (vel[a] - omega * temp) * k;
    cur[a] = target[a] + (change + temp) * k;
  }
}

