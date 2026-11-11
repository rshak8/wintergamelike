// Мелкие функции, общие для мозгов врагов.
import type * as THREE from 'three';
import { dirFromAngle, angleTo, wrapAngle, type XZ } from '../utils';
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

// ---------- хитбоксы атак ----------
// Те же формы, что и зоны опасности на полу: если герой задевает зону, удар попадает.

/** Герой в секторе перед врагом (радиус radius, половина ширины halfAngle)? */
export function heroInSector(self: Enemy, radius: number, halfAngle: number) {
  const hero = self.player;
  const d = self.distToPlayer();
  if (d > radius + hero.radius) return false;
  // герой не точка: чем ближе, тем шире он «виден» по углу
  const allowance = Math.atan2(hero.radius, Math.max(0.3, d));
  return Math.abs(wrapAngle(angleTo(self.pos, hero.pos) - self.facing)) < halfAngle + allowance;
}

/** Герой в полосе длиной length и шириной width, идущей из origin в направлении dir? */
export function heroInStrip(self: Enemy, origin: XZ, dir: XZ, length: number, width: number) {
  const hero = self.player;
  const rx = hero.pos.x - origin.x, rz = hero.pos.z - origin.z;
  const along = rx * dir.x + rz * dir.z;          // насколько впереди
  const side = Math.abs(rx * dir.z - rz * dir.x); // насколько сбоку
  return along > -hero.radius && along < length + hero.radius && side < width / 2 + hero.radius;
}

/** Герой в круге? */
export function heroInCircle(self: Enemy, center: XZ, radius: number) {
  const hero = self.player;
  return Math.hypot(hero.pos.x - center.x, hero.pos.z - center.z) < radius + hero.radius;
}

/** Точка, откуда снаряд вылетает: чуть впереди врага на высоте y. */
export function muzzle(self: Enemy, dir: THREE.Vector3, ahead: number, y: number) {
  const p = self.pos.clone().addScaledVector(dir, ahead); p.y = y;
  return p;
}
