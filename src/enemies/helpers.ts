// Мелкие функции, общие для мозгов врагов.
import type * as THREE from 'three';
import { dirFromAngle, type XZ } from '../utils';
import type { Game } from '../game/game';
import type { Enemy } from './enemy';

/** Мозг врага: вызывается каждый кадр. dt уже замедлен льдом, realDt — нет. */
export type Brain = (self: Enemy, dt: number, realDt: number) => void;

/** Как далеко пролетит выстрел из from в направлении dir, пока не упрётся в стену (максимум max). */
export function rayLength(game: Game, from: XZ, dir: XZ, max: number) {
  for (let t = 0.4; t < max; t += 0.2) if (game.world.blocksShots(from.x + dir.x * t, from.z + dir.z * t)) return t;
  return max;
}

/** Прямоугольная зона опасности перед врагом. */
export function telegraphAhead(self: Enemy, length: number, width: number, time: number, color = 0xff2a2a) {
  return self.game.fx.telegraph({ shape: 'rect', pos: self.pos, dir: dirFromAngle(self.facing), length, width, time, color });
}

/** Точка, откуда снаряд вылетает: чуть впереди врага на высоте y. */
export function muzzle(self: Enemy, dir: THREE.Vector3, ahead: number, y: number) {
  const p = self.pos.clone().addScaledVector(dir, ahead); p.y = y;
  return p;
}
