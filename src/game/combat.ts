// Бой: попадания по врагам и ящикам, урон, криты, статусы, смерть врага, цепная молния.
import * as THREE from 'three';
import { audio } from '../audio/audio';
import { TEX } from '../fx/textures';
import { WEAPONS, CHAR_SCALE, type DotEffect, type SlowEffect, type WeaponDef, type WeaponId } from '../config';
import { rand, wrapAngle, type XZ } from '../utils';
import { debrisMaterial } from './shared';
import type { Game } from './game';
import type { Enemy } from '../enemies/enemy';
import type { Prop } from '../world/world';

/** Всё, что несёт удар: отбрасывание, статусы, откуда пришёл. */
export interface HitInfo {
  knock?: number;
  weapon?: WeaponId;
  dir?: THREE.Vector3;
  dot?: boolean;     // тик урона со временем: без крита, без отбрасывания, маленькое число
  color?: string;    // цвет числа для тиков
  light?: boolean;   // быстрое оружие: стоп-кадр и тряска слабее
  burn?: DotEffect;
  poison?: DotEffect;
  slow?: SlowEffect;
  stun?: number;
}

const CRIT_CHANCE = 0.15;
const CRIT_MULT = 1.7;

const _v = new THREE.Vector3();

export class Combat {
  constructor(private game: Game) {}

  /** Удар в ближнем бою: все враги в секторе шириной arc перед origin. Возвращает число попаданий. */
  meleeHit(origin: THREE.Vector3, dir: XZ, range: number, arc: number, dmg: number, hit: HitInfo) {
    const { fx } = this.game;
    let hits = 0;
    const facing = Math.atan2(dir.x, dir.z);
    for (const e of this.game.enemies) {
      if (e.dead || !e.targetable) continue;
      _v.subVectors(e.pos, origin); _v.y = 0;
      const d = _v.length() - e.radius;
      if (d > range) continue;
      const off = Math.abs(wrapAngle(Math.atan2(_v.x, _v.z) - facing));
      // большие враги задеваются чуть шире; вплотную — попадание в любом случае
      if (off > arc / 2 + Math.atan2(e.radius, Math.max(0.3, d)) && d > 0.35) continue;
      this.damageEnemy(e, dmg, { ...hit, dir: _v.clone().normalize() });
      hits++;
    }
    this.hitPropsInArc(origin, dir, range, arc);
    if (hits) {
      fx.hitstop(hit.light ? 22 : 55);
      fx.shake(hit.light ? 0.18 : 0.32);
    }
    return hits;
  }

  /** Удар по площади (молот). */
  areaHit(center: THREE.Vector3, radius: number, dmg: number, hit: HitInfo) {
    let hits = 0;
    for (const e of this.game.enemies) {
      if (e.dead || !e.targetable) continue;
      if (e.pos.distanceTo(center) > radius + e.radius) continue;
      this.damageEnemy(e, dmg, { ...hit, dir: _v.subVectors(e.pos, center).setY(0).normalize().clone() });
      hits++;
    }
    for (const p of [...this.game.world.props.values()]) {
      if (p.breakable && Math.hypot(p.x - center.x, p.z - center.z) < radius + 0.4) this.damageProp(p, 3);
    }
    if (hits) this.game.fx.hitstop(40);
  }

  private hitPropsInArc(origin: XZ, dir: XZ, range: number, arc: number) {
    const facing = Math.atan2(dir.x, dir.z);
    for (const p of [...this.game.world.props.values()]) {
      if (!p.breakable) continue;
      const dx = p.x - origin.x, dz = p.z - origin.z;
      if (Math.hypot(dx, dz) - 0.45 > range) continue;
      if (Math.abs(wrapAngle(Math.atan2(dx, dz) - facing)) < arc / 2 + 0.4) this.damageProp(p, 1);
    }
  }

  /** Урон ящику/бочке. Сломанный разлетается щепками и иногда роняет монеты. */
  damageProp(p: Prop, n: number) {
    const { fx, scene, shared } = this.game;
    p.hp -= n;
    const color = p.name === 'T_Crate' ? 0x8a5a34 : 0x7a4a2a;
    audio.play('hit', { pitch: 0.6 });
    fx.burst({ x: p.x, y: 0.5, z: p.z }, { count: 6, color, speed: 2.5, life: 0.5, size: 0.18, gravity: 9, up: 2, additive: false });
    p.obj.scale.set(1.12, 0.88, 1.12);
    setTimeout(() => p.obj.scale.set(1, 1, 1), 70);
    if (p.hp > 0) return;
    this.game.world.breakProp(p);
    audio.play('shatter');
    fx.burst({ x: p.x, y: 0.4, z: p.z }, { count: 22, color, speed: 4.5, life: 0.8, size: 0.26, gravity: 12, up: 4, additive: false });
    fx.burst({ x: p.x, y: 0.3, z: p.z }, { count: 10, color: 0x5a6070, speed: 1.5, life: 0.7, size: 0.4, gravity: -0.5, up: 0.5, additive: false });
    fx.shake(0.2);
    for (let i = 0; i < 5; i++) {
      const chunk = new THREE.Mesh(shared.debrisGeo, debrisMaterial(shared, color));
      chunk.scale.set(rand(0.12, 0.3), rand(0.05, 0.1), rand(0.12, 0.25));
      chunk.position.set(p.x, 0.4, p.z);
      scene.add(chunk);
      this.game.debris.add(chunk, new THREE.Vector3(rand(-3, 3), rand(3, 6), rand(-3, 3)), 1.4, true);
    }
    if (Math.random() < 0.7) this.game.loot.dropCoins(new THREE.Vector3(p.x, 0, p.z), 2);
  }

  /** Урон врагу: крит, число над головой, искры, отбрасывание, статусы. */
  damageEnemy(e: Enemy, dmg: number, hit: HitInfo = {}) {
    if (e.dead) return;
    const { fx, ui } = this.game;
    let amount = dmg, crit = false;
    if (!hit.dot && Math.random() < CRIT_CHANCE) { amount *= CRIT_MULT; crit = true; }
    amount = Math.round(amount * 10) / 10;
    e.hp -= amount;
    e.onHurt(hit);

    // число урона: маленькое; крит выделяется цветом и чуть большим размером
    const textPos = { x: e.pos.x, y: 1.3 * e.scale / CHAR_SCALE, z: e.pos.z };
    const txt = amount >= 1 ? Math.round(amount).toString() : amount.toFixed(1);
    if (hit.dot) fx.text(textPos, txt, { color: hit.color, size: 12, life: 0.55, rise: 0.8 });
    else fx.text(textPos, txt, { color: crit ? '#ffd23a' : '#ffffff', size: crit ? 21 : 15, crit });

    if (!hit.dot) {
      audio.play('hit', { pitch: crit ? 1.3 : 1 + Math.random() * 0.2 });
      const dir = hit.dir || _v.set(0, 0, 1);
      const resist = e.type === 'king' ? 0.15 : e.type === 'mimic' ? 0.4 : 1; // тяжёлых почти не отбрасывает
      e.knockback.addScaledVector(dir, (hit.knock || 2) * resist * (crit ? 1.5 : 1));
      const col = hit.weapon ? WEAPONS[hit.weapon].color : '#ffffff';
      fx.spark({ x: e.pos.x, y: 0.65, z: e.pos.z }, col, crit ? 14 : 8, 6);
      fx.burst({ x: e.pos.x, y: 0.65, z: e.pos.z }, { count: 4, color: e.type === 'mimic' ? 0x8a6a3a : 0xe9dcc0, speed: 3, life: 0.5, size: 0.13, gravity: 12, up: 3, additive: false, dir, spread: 1.6 });
      fx.flash({ x: e.pos.x, y: 0.7, z: e.pos.z }, { color: col, size: crit ? 2 : 1.3, life: 0.09 });
      if (crit) fx.shake(0.3);
      this.applyStatuses(e, hit, textPos.y);
    }
    if (e.type === 'king') ui.updateBoss(e.hp / e.maxHp);
    if (e.hp <= 0) this.killEnemy(e, hit);
  }

  private applyStatuses(e: Enemy, hit: HitInfo, textY: number) {
    const s = e.status;
    if (hit.burn) {
      if (s.burn <= 0) audio.play('burn');
      s.burn = hit.burn.time; s.burnDps = hit.burn.dps;
    }
    if (hit.poison) { s.poison = hit.poison.time; s.poisonDps = hit.poison.dps; audio.play('poison'); }
    if (hit.slow) {
      if (s.slow <= 0) this.game.fx.text({ x: e.pos.x, y: textY + 0.35, z: e.pos.z }, 'SLOW', { color: '#8fe6ff', size: 12 });
      s.slow = hit.slow.time; s.slowMult = hit.slow.mult;
    }
    // короля оглушение лишь на мгновение сбивает
    if (hit.stun) s.stun = e.type === 'king' ? 0.15 : hit.stun;
  }

  /** Смерть врага: взрыв частиц, модель разлетается на части, монеты. */
  killEnemy(e: Enemy, hit?: HitInfo) {
    const { fx, scene } = this.game;
    e.dead = true; e.hp = 0;
    e.clearTelegraph();
    audio.play('kill'); audio.play('crunch');
    fx.hitstop(e.type === 'king' ? 200 : 70);
    fx.shake(e.type === 'king' ? 1 : 0.45);
    const p = { x: e.pos.x, y: 0.6, z: e.pos.z };
    fx.burst(p, { count: 18, color: 0xe9dcc0, speed: 4, life: 0.7, size: 0.16, gravity: 12, up: 4, additive: false });
    fx.burst(p, { count: 16, color: e.rimColor, speed: 3, life: 0.6, size: 0.3, gravity: -1, up: 2 });
    fx.flash(p, { color: e.rimColor, size: 3, life: 0.2 });
    fx.ring(e.pos, { radius: 1.2, color: e.rimColor, life: 0.3 });
    // «душа» улетает вверх
    fx.burst({ x: p.x, y: 1, z: p.z }, { count: 6, color: e.rimColor, speed: 0.4, life: 1.2, size: 0.45, gravity: -2.5, up: 0.5 });

    // части тела разлетаются по направлению удара
    const dir = hit?.dir || new THREE.Vector3(0, 0, -1);
    if (e.rig) {
      const rig = e.rig;
      const parts = [rig.head, rig.armL, rig.armR, rig.legL, rig.legR, rig.body, rig.cape].filter((o) => o !== undefined);
      for (const part of parts) {
        scene.attach(part);
        const v = new THREE.Vector3(dir.x * rand(2, 5) + rand(-2.5, 2.5), rand(3, 7), dir.z * rand(2, 5) + rand(-2.5, 2.5));
        if (part === rig.head) v.y += 2;
        this.game.debris.add(part, v, 1.6);
      }
    } else {
      // мимик: крышка отлетает
      const lid = e.lid; if (lid) { scene.attach(lid); this.game.debris.add(lid, new THREE.Vector3(rand(-2, 2), 7, rand(-2, 2)), 1.6); }
      const base = e.root.getObjectByName('T_Mimic_Base'); if (base) { scene.attach(base); this.game.debris.add(base, new THREE.Vector3(0, 3, 0), 1.6); }
    }
    scene.remove(e.root); scene.remove(e.shadow); e.hpBar?.remove();
    this.game.loot.dropCoins(e.pos, e.def.coins);
    if (e.type === 'king') this.game.rooms.onBossDeath(e);
    if (e.type === 'mimic') this.game.rewards.onMimicDeath(e);
  }

  /** Посох: попадание и цепная молния ещё на несколько ближайших врагов. */
  chainLightning(first: Enemy, dmg: number, w: WeaponDef, dir: THREE.Vector3, at: THREE.Vector3) {
    const { fx } = this.game;
    audio.play('zapChain');
    const chain = w.chain!;
    const hitList = [first];
    this.damageEnemy(first, dmg, { knock: w.knock, weapon: 'lightning', dir });
    let cur = first;
    const pts = [at, first.pos.clone().setY(0.7)];
    for (let k = 0; k < chain.count; k++) {
      // ближайший ещё не задетый враг в радиусе
      let best: Enemy | null = null, bestDist = chain.radius;
      for (const e of this.game.enemies) {
        if (e.dead || !e.targetable || hitList.includes(e)) continue;
        const d = e.pos.distanceTo(cur.pos);
        if (d < bestDist) { bestDist = d; best = e; }
      }
      if (!best) break;
      hitList.push(best);
      const from = cur.pos.clone().setY(0.7), to = best.pos.clone().setY(0.7);
      fx.bolt([from, to], { color: 0xa57bff, life: 0.28, width: 0.16 });
      this.damageEnemy(best, chain.dmg * this.game.player.damageMult, { knock: 1, weapon: 'lightning', dir: to.clone().sub(from).normalize() });
      fx.flash(to, { color: 0xc0a0ff, size: 1.6, life: 0.15 });
      cur = best;
    }
    fx.bolt(pts, { color: 0xa57bff, life: 0.18, width: 0.14 });
    fx.burst({ x: first.pos.x, y: 0.7, z: first.pos.z }, { count: 14, color: 0xc0a0ff, speed: 5, life: 0.3, size: 0.14, gravity: 0, up: 1 });
    fx.decal(first.pos, { tex: TEX.glow, size: 1.4, color: 0x8a5cff, life: 0.5 }); // след на полу
  }
}
