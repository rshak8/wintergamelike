// Атаки героя: у каждого оружия своя анимация, звук, эффект и момент удара.
// Удар наносится не сразу, а через schedule() — в момент, когда клинок по анимации доходит до цели.
import * as THREE from 'three';
import { audio } from '../audio/audio';
import { TEX } from '../fx/textures';
import { dirFromAngle } from '../utils';
import type { WeaponDef, WeaponId } from '../config';
import type { Enemy } from '../enemies/enemy';
import type { Player } from './player';

export interface Attack {
  weapon: WeaponDef;
  id: WeaponId;
  damage: number;          // уже с учётом баффов
  target: Enemy;
  aimDir: THREE.Vector3;   // на цель, по полу
}

// Параметры, помеченные в WeaponDef необязательными (arc, aoe, ...), всегда заданы у того
// оружия, чья атака их читает, поэтому здесь `!`.
export const ATTACKS: Record<WeaponId, (hero: Player, a: Attack) => void> = {
  /** Меч: выпад вперёд с рывком. */
  sword(hero, a) {
    const { fx } = hero.game, w = a.weapon;
    hero.rig.play('stab'); audio.play('stab');
    hero.schedule(0.1, () => {
      const d = dirFromAngle(hero.facing);
      hero.lungeVel.addScaledVector(d, 5);
      fx.stab(hero.pos.clone().addScaledVector(d, 0.3), d, { length: w.range + 0.2, width: 0.55, color: 0xdfe8ff, life: 0.14 });
      hero.game.combat.meleeHit(hero.pos, d, w.range, w.arc!, a.damage, { knock: w.knock, weapon: a.id });
    });
  },

  /** Кинжал: очень частые уколы попеременно левой и правой рукой, отравляют. */
  poison(hero, a) {
    const { fx } = hero.game, w = a.weapon;
    hero.jabLeft = !hero.jabLeft;
    hero.rig.play('jab', hero.jabLeft); audio.play('stab');
    hero.schedule(0.04, () => {
      const side = hero.jabLeft ? 0.15 : -0.15;
      const d = dirFromAngle(hero.facing + side);
      hero.lungeVel.addScaledVector(d, 2.5);
      fx.stab(hero.pos.clone().addScaledVector(d, 0.25).add(new THREE.Vector3(side, 0, 0)), d, { length: w.range, width: 0.32, color: 0x6aff4a, life: 0.12 });
      hero.game.combat.meleeHit(hero.pos, d, w.range, w.arc!, a.damage, { knock: w.knock, weapon: a.id, poison: w.poison, light: true });
    });
  },

  /** Огненный меч: широкий взмах (поочерёдно в разные стороны), поджигает. */
  fire(hero, a) {
    const { fx } = hero.game, w = a.weapon;
    hero.rig.play('slash'); audio.play('slashFire');
    hero.slashFlip = !hero.slashFlip;
    hero.schedule(0.1, () => {
      const d = dirFromAngle(hero.facing);
      hero.lungeVel.addScaledVector(d, 3.5);
      fx.slash(hero.pos, d, { radius: w.range + 0.2, inner: 0.3, angle: w.arc! + 0.3, color: 0xff6a1a, life: 0.26, flip: hero.slashFlip });
      fx.slash(hero.pos, d, { radius: w.range - 0.3, inner: 0.2, angle: w.arc!, color: 0xffd04a, life: 0.2, y: 0.5, flip: hero.slashFlip });
      // угольки вдоль дуги
      for (let i = 0; i < 10; i++) {
        const ang = hero.facing + (Math.random() - 0.5) * w.arc!;
        const r = 0.6 + Math.random() * (w.range - 0.4);
        fx.burst({ x: hero.pos.x + Math.sin(ang) * r, y: 0.5, z: hero.pos.z + Math.cos(ang) * r }, { count: 1, color: Math.random() < 0.5 ? 0xff7a1a : 0xffc040, speed: 1, life: 0.5, size: 0.22, gravity: -2, up: 1 });
      }
      hero.game.combat.meleeHit(hero.pos, d, w.range, w.arc!, a.damage, { knock: w.knock, weapon: a.id, burn: w.burn });
    });
  },

  /** Святой молот: долгий замах и удар об пол по площади, оглушает. */
  hammer(hero, a) {
    const { fx } = hero.game, w = a.weapon;
    hero.rig.play('slam'); audio.play('swing');
    hero.schedule(0.27, () => {
      const d = dirFromAngle(hero.facing);
      const c = hero.pos.clone().addScaledVector(d, 1.15); // центр удара перед героем
      const aoe = w.aoe!;
      hero.lungeVel.addScaledVector(d, 2);
      audio.play('slam');
      fx.shake(0.75); fx.hitstop(70);
      fx.ring(c, { radius: aoe + 0.3, color: 0xffd24a, life: 0.4 });
      fx.ring(c, { radius: aoe * 0.6, color: 0xffffff, life: 0.25 });
      fx.decal(c, { tex: TEX.holy, size: aoe * 2.1, color: 0xffcc44, life: 2.8, rot: hero.facing, fadeIn: 0.05, opacity: 0.6 });
      fx.decal(c, { tex: TEX.scorch, size: aoe * 1.6, color: 0xffffff, life: 3, additive: false, opacity: 0.7, rot: Math.random() * 6 });
      fx.flash({ x: c.x, y: 0.4, z: c.z }, { color: 0xffe080, size: 4, life: 0.2 });
      fx.burst({ x: c.x, y: 0.15, z: c.z }, { count: 26, color: 0xffd24a, speed: 6, life: 0.6, size: 0.22, gravity: 9, up: 4 });
      fx.burst({ x: c.x, y: 0.1, z: c.z }, { count: 14, color: 0x5a6278, speed: 3, life: 0.6, size: 0.35, gravity: 4, up: 2.5, additive: false });
      for (let i = 0; i < 6; i++) { // столбы света
        fx.burst({ x: c.x, y: 0.2, z: c.z }, { count: 1, color: 0xfff0a0, speed: 0.5, life: 0.7, size: 0.6, gravity: -5, up: 2 });
      }
      hero.game.combat.areaHit(c, aoe, a.damage, { knock: w.knock, weapon: a.id, stun: w.stun });
    });
  },

  /** Ледяной лук: мгновенный выстрел, замедляет. */
  ice(hero, a) {
    const { fx } = hero.game;
    hero.rig.play('shoot'); audio.play('iceShot');
    hero.schedule(0.03, () => {
      const from = hero.handPosition(); from.y = 0.6;
      fx.flash(from, { color: 0x6fd4ff, size: 0.9, life: 0.1 });
      hero.game.projectiles.shootPlayer('ice', from, a.aimDir, a.damage, a.weapon);
    });
  },

  /** Посох молний: снаряд, который при попадании перескакивает на соседних врагов. */
  lightning(hero, a) {
    const { fx } = hero.game;
    hero.rig.play('cast'); audio.play('zap');
    hero.schedule(0.09, () => {
      const from = hero.handPosition(); from.y = Math.max(0.7, from.y);
      fx.flash(from, { color: 0xa57bff, size: 1.2, life: 0.12 });
      // направление пересчитываем — цель могла сдвинуться за время замаха
      const dir = new THREE.Vector3().subVectors(a.target.pos, hero.pos).setY(0).normalize();
      hero.game.projectiles.shootPlayer('lightning', from, dir, a.damage, a.weapon);
    });
  },
};
