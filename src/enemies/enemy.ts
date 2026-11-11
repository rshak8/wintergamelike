// Враг: общее для всех типов — появление, статусы (горение, яд, лёд, оглушение), движение,
// расталкивание, полоска здоровья. Что именно враг делает, решает его «мозг» (см. brains.ts).
import * as THREE from 'three';
import { cloneCharacter, clone, type CharShading } from '../assets';
import { Rig, type GripBasis } from '../anim/rig';
import { ENEMIES, ENEMY_RIM, CHAR_SCALE, type EnemyDef, type EnemyType } from '../config';
import { TEX } from '../fx/textures';
import { audio } from '../audio/audio';
import { rand, angleTo, wrapAngle } from '../utils';
import { BRAINS } from './brains';
import type { TimedItem } from '../fx/fx';
import type { Game } from '../game/game';
import type { HitInfo } from '../game/combat';
import type { Room } from '../world/world';

const _v = new THREE.Vector3();
const _a = new THREE.Vector3();

/** Статусы: сколько секунд осталось у каждого и их сила. */
export interface EnemyStatus {
  burn: number; burnDps: number;
  poison: number; poisonDps: number;   // яд ещё и блокирует лечение
  slow: number; slowMult: number;
  stun: number;
  dotTimer: number;                    // до следующего тика урона со временем
}

export class Enemy {
  readonly game: Game;
  readonly type: EnemyType;
  readonly def: EnemyDef;
  readonly room: Room;
  readonly root: THREE.Object3D;
  readonly shading: CharShading;
  readonly scale: number;
  rig?: Rig;                      // у всех, кроме мимика
  lid?: THREE.Object3D;           // только у мимика
  weaponModel?: THREE.Object3D;
  readonly pos: THREE.Vector3;
  readonly knockback = new THREE.Vector3();
  /** Мозг задаёт направление и скорость шага каждый кадр. */
  readonly moveDir = new THREE.Vector3();
  moveSpeed = 0;
  facing: number;
  hp: number; maxHp: number;
  readonly radius: number;
  readonly rimColor: number;

  /** Текущее состояние мозга ('idle', 'aim', 'charge'...) и сколько секунд оно длится. */
  state = 'spawn'; stateTime = 0;
  /** Пауза до следующей атаки. */
  cooldown = rand(0.6, 1.4);
  spawning = true;                // поднимается из-под земли
  targetable = false;             // можно бить
  dead = false;
  status: EnemyStatus = { burn: 0, burnDps: 0, poison: 0, poisonDps: 0, slow: 0, slowMult: 1, stun: 0, dotTimer: 0 };
  private flashTime = 0;
  readonly shadow: THREE.Mesh;
  hpBar: HTMLDivElement | null = null;
  /** Зона опасности текущей атаки. */
  telegraph: TimedItem | null = null;

  // ---- память мозгов (у каждого типа свои поля) ----
  goal: THREE.Vector3 | null = null;        // куда идёт (лучник, некромант, лекарь)
  repathTimer = 0;                          // когда выбрать новую точку
  lockDir = new THREE.Vector3();            // воин/король: зафиксированное направление удара
  thrustLanded = false;                     // воин: выпад уже попал
  aimLength = 1;                            // лучник: длина прицельной линии в начале
  healTargets: Enemy[] = [];                // лекарь
  hops = 0;                                 // мимик: сколько прыжков сделал
  hopFrom = new THREE.Vector3(); hopTo = new THREE.Vector3();
  enraged = false;                          // король: меньше половины здоровья
  lastSummonTime = 0; lastAttack = '';
  telegraphs: TimedItem[] | null = null;    // король: веер зон для волны
  chargeLength = 0; chargeFrom = new THREE.Vector3();

  constructor(game: Game, type: EnemyType, x: number, z: number, room: Room) {
    this.game = game; this.type = type; this.def = ENEMIES[type]; this.room = room;
    const rim = this.rimColor = ENEMY_RIM[type];
    const { root, shading } = cloneCharacter(this.def.model, rim, 0.35);
    this.root = root; this.shading = shading;
    game.scene.add(root);
    this.scale = CHAR_SCALE * this.def.scale;
    if (type !== 'mimic') {
      this.rig = new Rig(root, this.def.model);
      this.rig.baseScale = this.scale;
      if (this.def.weapon) {
        const w = clone(this.def.weapon);
        const basis: GripBasis = type === 'archer' ? 'bow' : type === 'necro' ? 'orb' : 'blade';
        this.rig.attach(w, basis);
        this.weaponModel = w;
        if (type === 'healer') this.rig.idlePitch = -2.75;
        if (type === 'archer') this.rig.armRestR = -0.9;
        if (type === 'king') w.scale.setScalar(1.1);
      }
    } else {
      root.scale.setScalar(this.scale);
      this.lid = root.getObjectByName('T_Mimic_Lid');
    }
    this.pos = new THREE.Vector3(x, 0, z);
    this.facing = angleTo(this.pos, game.player.pos);
    this.hp = this.maxHp = this.def.hp;
    this.radius = this.def.radius;
    this.shadow = new THREE.Mesh(game.shared.floorQuad, game.shared.shadowMat);
    this.shadow.scale.setScalar(this.radius * 3);
    this.shadow.renderOrder = 2;
    game.scene.add(this.shadow);
    // полоска здоровья (у короля вместо неё большая полоса вверху экрана)
    if (type !== 'king') {
      this.hpBar = document.createElement('div'); this.hpBar.className = 'ehp'; this.hpBar.innerHTML = '<i></i>';
      document.getElementById('fxLayer')!.appendChild(this.hpBar);
      this.hpBar.style.display = 'none';
    }
    if (type === 'mimic') { this.state = 'dormant'; this.spawning = false; }
    else {
      // поднимается из-под земли в пентаграмме
      root.position.set(x, -1.2, z);
      game.fx.decal(this.pos, { tex: TEX.spawn, size: 1.8, color: rim, life: 1.1, fadeIn: 0.1, grow: 0.2 });
      game.fx.flash({ x, y: 0.3, z }, { color: rim, size: 2, life: 0.4 });
      audio.play('spawn');
    }
  }

  get player() { return this.game.player; }
  distToPlayer() { return this.pos.distanceTo(this.player.pos); }
  /** Множитель скорости от льда. */
  slowFactor() { return this.status.slow > 0 ? this.status.slowMult : 1; }
  setState(s: string) { this.state = s; this.stateTime = 0; }

  update(dt: number) {
    if (this.dead) return;
    if (this.updateStatus(dt)) return; // умер от горения/яда
    if (this.state === 'spawn') { this.updateSpawnRise(dt); return; }

    this.moveSpeed = 0;
    const s = this.status;
    if (s.stun > 0) {
      s.stun -= dt;
      if (Math.random() < dt * 8) this.game.fx.burst({ x: this.pos.x + rand(-0.3, 0.3), y: 1.25 * this.scale / CHAR_SCALE, z: this.pos.z + rand(-0.3, 0.3) }, { count: 1, color: 0xffe066, speed: 0.6, life: 0.5, size: 0.2, gravity: 0, up: 0 });
      this.clearTelegraph();
    } else {
      // лёд замедляет и мысли (таймеры атак), и шаги
      BRAINS[this.type](this, dt * this.slowFactor(), dt);
    }
    this.move(dt);
    this.render(dt);
  }

  /** Тикают статусы, частицы и цвет. true — если враг от этого умер. */
  private updateStatus(dt: number) {
    const s = this.status, { fx } = this.game;
    s.dotTimer -= dt;
    if (s.burn > 0) {
      s.burn -= dt;
      if (Math.random() < dt * 22) fx.burst({ x: this.pos.x + rand(-0.2, 0.2), y: rand(0.3, 0.9), z: this.pos.z + rand(-0.2, 0.2) }, { count: 1, color: Math.random() < 0.5 ? 0xff6a1a : 0xffc040, speed: 0.3, life: 0.5, size: 0.3, gravity: -3, up: 0.5 });
    }
    if (s.poison > 0) {
      s.poison -= dt;
      if (Math.random() < dt * 10) fx.burst({ x: this.pos.x + rand(-0.25, 0.25), y: rand(0.2, 0.8), z: this.pos.z + rand(-0.25, 0.25) }, { count: 1, color: 0x5cff46, speed: 0.2, life: 0.7, size: 0.2, gravity: -1.2, up: 0.4 });
    }
    if (s.slow > 0) {
      s.slow -= dt;
      if (Math.random() < dt * 8) fx.burst({ x: this.pos.x + rand(-0.3, 0.3), y: rand(0.2, 1.0), z: this.pos.z + rand(-0.3, 0.3) }, { count: 1, color: 0xaef0ff, speed: 0.2, life: 0.6, size: 0.15, gravity: 1, up: 0.2 });
    }
    // урон со временем — раз в полсекунды
    if (s.dotTimer <= 0 && (s.burn > 0 || s.poison > 0)) {
      s.dotTimer = 0.5;
      const d = (s.burn > 0 ? s.burnDps : 0) * 0.5 + (s.poison > 0 ? s.poisonDps : 0) * 0.5;
      this.game.combat.damageEnemy(this, d, { dot: true, color: s.burn > 0 ? '#ff9a3a' : '#7aff5a' });
      if (this.dead) return true;
    }
    // оттенок модели по статусу
    const tint = this.shading.tint.value, t = this.game.time;
    if (s.slow > 0) tint.set(0.55, 0.85, 1.0, 0.45);
    else if (s.poison > 0) tint.set(0.4, 1.0, 0.3, 0.28 + Math.sin(t * 8) * 0.08);
    else if (s.burn > 0) tint.set(1.0, 0.45, 0.1, 0.25 + Math.sin(t * 14) * 0.1);
    else tint.set(0, 0, 0, 0);
    this.flashTime -= dt;
    const f = Math.max(0, this.flashTime / 0.1);
    this.shading.flash.value.set(f * 1.6, f * 1.6, f * 1.6);
    return false;
  }

  /** Подъём из-под земли; в конце — можно бить. */
  private updateSpawnRise(dt: number) {
    this.stateTime += dt;
    const k = Math.min(1, this.stateTime / 0.55);
    this.root.position.set(this.pos.x, -1.2 * Math.pow(1 - k, 3), this.pos.z);
    this.root.rotation.y = this.facing;
    this.rig?.update(dt, 0);
    if (k >= 1) {
      this.spawning = false; this.targetable = true; this.setState('idle');
      this.rig?.punch(2);
      this.game.fx.burst({ x: this.pos.x, y: 0.1, z: this.pos.z }, { count: 10, color: this.rimColor, speed: 2.5, life: 0.4, size: 0.2, gravity: 2, up: 2 });
    }
    this.syncShadow();
  }

  /** Шаг, отбрасывание, расталкивание с другими врагами, стены. */
  private move(dt: number) {
    _v.copy(this.moveDir).multiplyScalar(this.moveSpeed * this.slowFactor());
    this.pos.addScaledVector(_v, dt);
    this.pos.addScaledVector(this.knockback, dt);
    this.knockback.multiplyScalar(Math.exp(-dt * 9));
    for (const o of this.game.enemies) {
      if (o === this || o.dead || o.state === 'dormant') continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz, rr = this.radius + o.radius;
      if (d2 < rr * rr && d2 > 1e-5) {
        const d = Math.sqrt(d2), push = (rr - d) * 0.5;
        this.pos.x += dx / d * push; this.pos.z += dz / d * push;
      }
    }
    this.game.world.collide(this.pos, this.radius);
  }

  /** Анимация, положение модели и полоска здоровья. */
  private render(dt: number) {
    const speed01 = this.moveSpeed * this.slowFactor() / Math.max(0.1, this.def.speed);
    this.rig?.update(dt * (this.status.slow > 0 ? 0.6 : 1), this.status.stun > 0 ? 0 : speed01);
    if (this.type !== 'mimic') { // мимик двигает модель сам (см. его мозг)
      this.root.position.copy(this.pos);
      const lean = (this.rig?.lean || 0) * 0.2;
      this.root.position.x += Math.sin(this.facing) * lean; this.root.position.z += Math.cos(this.facing) * lean;
      this.root.rotation.y = this.facing;
      this.root.rotation.z = this.status.stun > 0 ? Math.sin(this.game.time * 20) * 0.08 : 0; // шатается в оглушении
    }
    this.syncShadow();
    if (this.hpBar && this.hp < this.maxHp) {
      this.hpBar.style.display = 'block';
      const v = _a.set(this.pos.x, 1.35 * this.scale / CHAR_SCALE, this.pos.z).project(this.game.camera);
      this.hpBar.style.transform = `translate(${(v.x * 0.5 + 0.5) * this.game.screenW}px, ${(-v.y * 0.5 + 0.5) * this.game.screenH}px) translate(-50%,-50%)`;
      (this.hpBar.firstChild as HTMLElement).style.width = (this.hp / this.maxHp * 100) + '%';
    }
  }

  private syncShadow() { this.shadow.position.set(this.pos.x, 0.02, this.pos.z); }

  /** Плавно повернуться к углу angle. */
  turnTowards(angle: number, dt: number, rate = 10) {
    this.facing += wrapAngle(angle - this.facing) * Math.min(1, dt * rate);
  }

  /** Идти к target (с обходом стен) и смотреть по ходу движения. */
  walkTo(target: THREE.Vector3, speed: number, dt: number) {
    this.game.world.pathDirection(this.pos, target, this.moveDir);
    this.moveSpeed = speed;
    if (this.moveDir.lengthSq() > 0.01) this.turnTowards(Math.atan2(this.moveDir.x, this.moveDir.z), dt, 8);
  }

  /** Отменить текущую атаку: убрать зону опасности и удерживаемую позу. */
  clearTelegraph() {
    if (this.telegraph) { this.game.fx.kill(this.telegraph); this.telegraph = null; }
    if ((this.rig?.action?.dur ?? 0) > 5) this.rig!.stop();
    if (this.state !== 'idle' && this.state !== 'dormant') this.setState('idle');
  }

  /** Случайная клетка комнаты на удобном расстоянии от героя (желательно с прямой видимостью). */
  pickSpot(minDist: number, maxDist: number, needLineOfSight = true) {
    const { world } = this.game;
    const cells = world.floorCells(this.room);
    let best = this.pos.clone(), bestScore = -1e9;
    for (let i = 0; i < 18; i++) {
      const c = cells[(Math.random() * cells.length) | 0];
      const d = c.distanceTo(this.player.pos);
      let score = -Math.abs(d - (minDist + maxDist) / 2) - c.distanceTo(this.pos) * 0.25;
      if (needLineOfSight && !world.hasLineOfSight(c, this.player.pos)) score -= 5;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  /** Реакция на удар: вспышка, сплющивание, иногда анимация «больно». */
  onHurt(hit: HitInfo) {
    this.flashTime = 0.1;
    this.rig?.punch(-1.6);
    if (this.type !== 'king' && this.type !== 'mimic' && !hit.dot && Math.random() < 0.6 && !this.telegraph) this.rig?.play('hit');
    if (this.type === 'healer') this.goal = null; // лекарь после удара сразу ищет новое укрытие
  }
}
