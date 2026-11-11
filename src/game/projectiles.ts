// Снаряды героя (ледяная стрела, молния) и врагов (стрела, шар некроманта, полумесяц, пули босса).
import * as THREE from 'three';
import { clone } from '../assets';
import { audio } from '../audio/audio';
import { TEX } from '../fx/textures';
import type { TimedItem } from '../fx/fx';
import type { WeaponDef } from '../config';
import type { Game } from './game';

interface ProjectileBase { obj: THREE.Object3D; pos: THREE.Vector3; dmg: number; life: number; radius: number; age: number }
/** Шар некроманта: летит по дуге в отмеченную точку и взрывается там. */
interface OrbShot extends ProjectileBase { owner: 'enemy'; kind: 'orb'; from: THREE.Vector3; target: THREE.Vector3; blastRadius: number; flightTime: number; telegraph: TimedItem }
/** Обычный снаряд врага, летит по прямой. */
interface EnemyShot extends ProjectileBase { owner: 'enemy'; kind: 'arrow' | 'crescent' | 'bullet'; vel: THREE.Vector3 }
interface PlayerShot extends ProjectileBase { owner: 'player'; kind: 'ice' | 'lightning'; vel: THREE.Vector3; weapon: WeaponDef; trailTimer: number; wobble: number }
type Projectile = OrbShot | EnemyShot | PlayerShot;

export type EnemyShotKind = OrbShot['kind'] | EnemyShot['kind'];
export interface EnemyShotOpts { speed: number; dmg: number; target?: THREE.Vector3; radius?: number }

const _side = new THREE.Vector3();

export class Projectiles {
  private list: Projectile[] = [];

  constructor(private game: Game) {}

  /** Выстрел героя из лука или посоха. */
  shootPlayer(kind: PlayerShot['kind'], from: THREE.Vector3, dir: THREE.Vector3, dmg: number, weapon: WeaponDef) {
    const { scene, shared } = this.game;
    let obj: THREE.Object3D;
    if (kind === 'ice') { obj = clone('P_IceArrow'); obj.scale.setScalar(1.3); }
    else {
      obj = new THREE.Sprite(shared.boltGlowMat); obj.scale.setScalar(0.9);
      const core = new THREE.Sprite(shared.boltCoreMat);
      core.scale.setScalar(0.45); obj.add(core);
    }
    obj.position.copy(from);
    scene.add(obj);
    this.list.push({
      owner: 'player', kind, obj, pos: obj.position, vel: dir.clone().multiplyScalar(weapon.speed!), dmg, weapon,
      life: 1.6, radius: 0.28, trailTimer: 0, wobble: Math.random() * 6, age: 0,
    });
  }

  /** Выстрел врага. У шара (orb) вместо направления — точка цели и радиус взрыва. */
  shootEnemy(kind: EnemyShotKind, from: THREE.Vector3, dir: THREE.Vector3 | null, o: EnemyShotOpts) {
    const { scene, shared, fx } = this.game;
    let obj: THREE.Object3D, radius = 0.2, life = 3;
    if (kind === 'arrow') { obj = clone('P_Arrow'); obj.scale.setScalar(1.4); radius = 0.2; audio.play('arrowFly'); }
    else if (kind === 'orb') {
      obj = clone('W_NecroOrb'); obj.scale.setScalar(1.6);
      const glow = new THREE.Sprite(shared.orbGlowMat);
      glow.scale.setScalar(1.4); obj.add(glow);
      radius = 0.3; life = 9;
    } else if (kind === 'crescent') {
      obj = new THREE.Mesh(shared.crescentGeo, shared.crescentMat);
      radius = 0.5;
    } else { // пуля босса
      obj = new THREE.Sprite(shared.bulletMat); obj.scale.setScalar(0.55);
      const core = new THREE.Sprite(shared.bulletCoreMat);
      core.scale.setScalar(0.5); obj.add(core);
      radius = 0.2;
    }
    obj.position.copy(from);
    scene.add(obj);
    const base = { owner: 'enemy' as const, obj, pos: obj.position, dmg: o.dmg, life, radius, age: 0 };
    if (kind === 'orb') {
      const target = o.target!.clone(), blastRadius = o.radius!;
      const flightTime = Math.max(0.7, from.distanceTo(target) / o.speed);
      const telegraph = fx.telegraph({ shape: 'circle', pos: target, radius: blastRadius, time: flightTime, color: 0xb040ff });
      this.list.push({ ...base, kind, from: from.clone(), target, blastRadius, flightTime, telegraph });
    } else {
      const d = dir!;
      if (kind === 'arrow') obj.rotation.y = Math.atan2(d.x, d.z);
      // у текстуры полумесяца выгнутый край смотрит в -Z; разворачиваем, чтобы летел лезвием вперёд
      else if (kind === 'crescent') obj.rotation.y = Math.atan2(d.x, d.z) + Math.PI;
      this.list.push({ ...base, kind, vel: d.clone().multiplyScalar(o.speed) });
    }
  }

  /** Убрать все снаряды (после смерти босса). */
  clear() {
    for (const p of this.list) { this.game.scene.remove(p.obj); if (p.kind === 'orb') this.game.fx.kill(p.telegraph); }
    this.list.length = 0;
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt; p.age += dt;
      let dead = p.life <= 0;
      if (p.kind === 'orb') dead = this.updateOrb(p, dt) || dead;
      else dead = this.updateStraight(p, dt) || dead;
      if (dead) {
        this.game.scene.remove(p.obj);
        if (p.kind === 'orb') this.game.fx.kill(p.telegraph);
        this.list.splice(i, 1);
      } else if (p.kind === 'arrow') {
        p.obj.rotation.set(Math.PI / 2, 0, 0); p.obj.rotation.order = 'YXZ'; p.obj.rotation.y = Math.atan2(p.vel.x, p.vel.z);
      }
    }
  }

  /** Шар некроманта летит по дуге; долетев — взрыв по площади. true — снаряд закончился. */
  private updateOrb(p: OrbShot, dt: number) {
    const { fx } = this.game, hero = this.game.player;
    const k = Math.min(1, p.age / p.flightTime);
    p.pos.lerpVectors(p.from, p.target, k);
    p.pos.y = p.from.y * (1 - k) + Math.sin(k * Math.PI) * 2.2 + 0.3 * k;
    p.obj.rotation.y += dt * 6;
    if (Math.random() < dt * 40) fx.burst(p.pos, { count: 1, color: 0xa040ff, speed: 0.3, life: 0.5, size: 0.3, gravity: 0, up: 0 });
    if (k < 1) return false;
    audio.play('boom');
    fx.shake(0.35);
    fx.ring(p.target, { radius: p.blastRadius + 0.2, color: 0xb040ff, life: 0.35 });
    fx.flash({ x: p.target.x, y: 0.5, z: p.target.z }, { color: 0x6a20b0, size: 2.4, life: 0.2 });
    fx.burst({ x: p.target.x, y: 0.2, z: p.target.z }, { count: 16, color: 0x9a50e0, speed: 4, life: 0.5, size: 0.24, gravity: 2, up: 3 });
    fx.decal(p.target, { tex: TEX.scorch, size: p.blastRadius * 2.2, life: 2.2, additive: false, opacity: 0.6, rot: Math.random() * 6 });
    if (hero.pos.distanceTo(p.target) < p.blastRadius + hero.radius * 0.5) hero.hurt(p.dmg, p.target);
    return true;
  }

  /** Снаряд, летящий по прямой. true — во что-то попал. */
  private updateStraight(p: EnemyShot | PlayerShot, dt: number) {
    const { fx, world } = this.game, hero = this.game.player;
    let dead = false;
    if (p.kind === 'lightning') {
      // молния слегка виляет
      p.wobble += dt * 20;
      p.pos.add(_side.set(-p.vel.z, 0, p.vel.x).normalize().multiplyScalar(Math.cos(p.wobble) * 0.9 * dt * 6));
    }
    p.pos.addScaledVector(p.vel, dt);

    // стена
    if (world.blocksShots(p.pos.x, p.pos.z)) {
      dead = true;
      const prop = world.propAt(p.pos.x, p.pos.z);
      if (prop && prop.breakable && p.owner === 'player') this.game.combat.damageProp(prop, 1);
      fx.spark(p.pos, p.owner === 'player' ? (p.weapon.color || '#fff') : 0xff6a4a, 6, 3);
    }

    if (p.owner === 'enemy') {
      if (p.kind === 'crescent') p.obj.scale.setScalar(1 + p.age * 0.5); // волна растёт на лету
      if (p.kind === 'bullet' && Math.random() < dt * 15) fx.burst(p.pos, { count: 1, color: 0xff3a2a, speed: 0.1, life: 0.25, size: 0.25, gravity: 0, up: 0 });
      if (p.kind === 'arrow' && Math.random() < dt * 25) fx.burst(p.pos, { count: 1, color: 0xffa080, speed: 0.1, life: 0.2, size: 0.12, gravity: 0, up: 0 });
      const dx = p.pos.x - hero.pos.x, dz = p.pos.z - hero.pos.z;
      if (!dead && dx * dx + dz * dz < (p.radius + hero.radius) ** 2) {
        // во время неуязвимости снаряд пролетает сквозь героя
        if (hero.hurt(p.dmg, p.pos.clone().sub(p.vel))) dead = true;
      }
      return dead;
    }

    // снаряд героя: след из частиц
    p.trailTimer -= dt;
    if (p.trailTimer <= 0) {
      p.trailTimer = 0.016;
      if (p.kind === 'ice') fx.burst(p.pos, { count: 2, color: 0x8fe6ff, speed: 0.3, life: 0.35, size: 0.18, gravity: 0.5, up: 0 });
      else fx.burst(p.pos, { count: 2, color: 0xa57bff, speed: 0.6, life: 0.3, size: 0.25, gravity: 0, up: 0 });
    }
    if (p.kind === 'ice') { p.obj.rotation.set(Math.PI / 2, 0, 0, 'YXZ'); p.obj.rotation.y = Math.atan2(p.vel.x, p.vel.z); }
    for (const e of this.game.enemies) {
      if (dead || e.dead || !e.targetable) continue;
      const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
      if (dx * dx + dz * dz >= (p.radius + e.radius) ** 2) continue;
      dead = true;
      const dir = p.vel.clone().normalize();
      if (p.kind === 'ice') {
        audio.play('iceHit');
        this.game.combat.damageEnemy(e, p.dmg, { knock: p.weapon.knock, weapon: 'ice', slow: p.weapon.slow, dir });
        fx.burst({ x: e.pos.x, y: 0.7, z: e.pos.z }, { count: 12, color: 0xbef4ff, speed: 3, life: 0.5, size: 0.16, gravity: 6, up: 2 });
        fx.decal(e.pos, { tex: TEX.glow, size: 1.6, color: 0x6fd4ff, life: 0.6 });
      } else {
        this.game.combat.chainLightning(e, p.dmg, p.weapon, dir, p.pos.clone());
      }
    }
    return dead;
  }
}
