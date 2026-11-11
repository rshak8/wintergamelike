// Герой: движение от джойстика, автоприцел и автоатака, когда стоит, урон, лечение, оружие.
import * as THREE from 'three';
import { cloneCharacter, clone, type CharShading } from '../assets';
import { Rig } from '../anim/rig';
import { PLAYER, WEAPONS, CHAR_SCALE, type WeaponDef, type WeaponId } from '../config';
import { TEX } from '../fx/textures';
import { audio } from '../audio/audio';
import { wrapAngle } from '../utils';
import { ATTACKS } from './attacks';
import type { Game } from '../game/game';
import type { Enemy } from '../enemies/enemy';

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();

/** Отложенное действие (например, момент, когда удар достигает цели). */
interface Scheduled { time: number; fn: () => void }

export class Player {
  readonly game: Game;
  readonly root: THREE.Object3D;
  readonly shading: CharShading;
  readonly rig: Rig;
  readonly pos: THREE.Vector3;
  readonly vel = new THREE.Vector3();
  /** Куда смотрит (угол вокруг Y). Сначала — вверх по подземелью (-Z). */
  facing = Math.PI;
  maxHp = PLAYER.hp; hp = PLAYER.hp;
  readonly radius = PLAYER.radius;
  invulnTime = 0;               // неуязвимость после удара, сек
  /** В обучающих комнатах герой не может умереть (hp не падает ниже 1). */
  cannotDie = false;
  dead = false;
  coins = 0;

  // множители от благословений
  damageMult = 1; attackSpeedMult = 1; speedMult = 1;

  /** До двух видов оружия; slot — какое сейчас в руке. */
  weapons: WeaponId[] = ['sword'];
  slot = 0;
  private attackCooldown = 0;
  private stillTime = 0;        // сколько стоим на месте (автоатака начинается после PLAYER.stopDelay)
  moving = false;
  target: Enemy | null = null;
  private scheduled: Scheduled[] = [];
  /** Рывок при атаке и отбрасывание при уроне. */
  readonly lungeVel = new THREE.Vector3();
  jabLeft = false;              // кинжал: какой рукой следующий укол
  slashFlip = false;            // огненный меч: в какую сторону следующий взмах
  private dustTimer = 0;

  private shadow: THREE.Mesh;
  private aimRing: THREE.Mesh;  // кольцо под текущей целью

  constructor(game: Game) {
    this.game = game;
    const { root, shading } = cloneCharacter('Hero', 0x8fa8ff, 0.5);
    this.root = root; this.shading = shading;
    game.scene.add(root);
    this.rig = new Rig(root, 'Hero');
    this.rig.baseScale = CHAR_SCALE;
    this.pos = game.world.start.clone();
    this.shadow = new THREE.Mesh(game.shared.floorQuad, game.shared.shadowMat);
    this.shadow.scale.setScalar(0.9);
    this.shadow.renderOrder = 2;
    game.scene.add(this.shadow);
    const am = new THREE.MeshBasicMaterial({ map: TEX.ring, color: 0xffe066, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });
    this.aimRing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), am);
    this.aimRing.renderOrder = 7; this.aimRing.visible = false;
    game.scene.add(this.aimRing);
    this.equip(0, true);
  }

  get weapon(): WeaponDef { return WEAPONS[this.weapons[this.slot]]; }
  get weaponId(): WeaponId { return this.weapons[this.slot]; }

  // ---------- оружие ----------

  equip(slot: number, silent = false) {
    this.slot = slot;
    const w = this.weapon;
    const model = clone(w.model);
    this.rig.attach(model, w.kind === 'bow' ? 'bow' : 'blade');
    // как держать оружие в покое
    this.rig.idlePitch = w.kind === 'staff' ? -2.75 : w.kind === 'bow' ? 0 : w.model === 'W_HolyHammer' ? -2.3 : -1.7;
    this.rig.armRestR = w.kind === 'bow' ? -0.9 : -0.35;
    if (w.model === 'W_HolyHammer') model.scale.setScalar(1.25);
    if (w.model === 'W_PoisonDagger') model.scale.setScalar(1.2);
    this.attackCooldown = Math.min(this.attackCooldown, 0.15); // после смены оружия можно сразу бить
    if (!silent) {
      audio.play('swap');
      this.game.fx.burst(this.handPosition(), { count: 14, color: w.color, speed: 2.5, life: 0.4, size: 0.2, gravity: -1, up: 1 });
      this.rig.punch(1.2);
    }
    this.game.ui?.updateWeapons();
  }

  /** Подобрали оружие: такое уже есть — берём его в руку; есть место — во второй слот; иначе меняем текущее. */
  addWeapon(id: WeaponId) {
    if (this.weapons.includes(id)) { this.equip(this.weapons.indexOf(id)); return; }
    if (this.weapons.length < 2) { this.weapons.push(id); this.equip(1); }
    else { this.weapons[this.slot] = id; this.equip(this.slot); }
  }

  swapWeapon() {
    if (this.weapons.length < 2) return;
    this.equip(1 - this.slot);
  }

  handPosition() {
    const h = this.rig.handR!; h.updateWorldMatrix(true, false);
    return h.getWorldPosition(new THREE.Vector3());
  }

  // ---------- кадр ----------

  update(dt: number) {
    const { input, world, fx } = this.game;
    if (this.dead) { this.rig.update(dt, 0); this.syncModel(); return; }

    // движение: быстрый разгон к скорости джойстика
    const inp = input.read();
    const speed = PLAYER.speed * this.speedMult;
    const want = _v.set(inp.x, 0, inp.y).multiplyScalar(speed * inp.mag > 0 ? 1 : 0);
    if (inp.mag > 0) want.normalize().multiplyScalar(speed * Math.max(0.35, inp.mag));
    this.vel.lerp(want, Math.min(1, dt * (inp.mag > 0 ? PLAYER.accel / speed : 22)));
    this.moving = inp.mag > 0.05;
    if (this.moving) this.stillTime = 0; else this.stillTime += dt;
    this.pos.addScaledVector(this.vel, dt);
    this.pos.addScaledVector(this.lungeVel, dt);
    this.lungeVel.multiplyScalar(Math.exp(-dt * 14));
    world.collide(this.pos, this.radius);
    this.keepOutOfEnemies();

    // поворот: в движении — по ходу, стоя — на цель
    let faceTo: number | null = null;
    this.target = null;
    if (!this.moving && this.stillTime > PLAYER.stopDelay) {
      this.target = this.findTarget();
      if (this.target) faceTo = Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z);
    }
    if (this.moving && this.vel.lengthSq() > 0.1) faceTo = Math.atan2(this.vel.x, this.vel.z);
    if (faceTo !== null) this.facing += wrapAngle(faceTo - this.facing) * Math.min(1, dt * (this.target ? 22 : 16));

    // автоатака
    this.attackCooldown -= dt;
    if (this.target && this.attackCooldown <= 0) this.tryAttack(this.target);

    // отложенные удары
    for (let i = this.scheduled.length - 1; i >= 0; i--) {
      const s = this.scheduled[i]; s.time -= dt;
      if (s.time <= 0) { this.scheduled.splice(i, 1); s.fn(); }
    }

    this.invulnTime -= dt;
    // пыль из-под ног на бегу
    if (this.moving && this.vel.length() > 2) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.12;
        fx.burst({ x: this.pos.x, y: 0.08, z: this.pos.z }, { count: 2, color: 0x8a94b8, speed: 0.6, life: 0.35, size: 0.22, gravity: -0.5, up: 0.4, additive: false, drag: 3 });
      }
    }
    this.rig.update(dt, this.vel.length() / speed);
    this.syncModel();
    // мигание во время неуязвимости
    this.root.visible = this.invulnTime > 0 ? Math.floor(this.invulnTime * 20) % 2 === 0 : true;
    // кольцо под целью
    if (this.target && !this.target.dead) {
      this.aimRing.visible = true;
      this.aimRing.position.set(this.target.pos.x, 0.04, this.target.pos.z);
      this.aimRing.scale.setScalar(this.target.radius * 2.6 * (1 + Math.sin(this.game.time * 10) * 0.06));
      this.aimRing.rotation.y += dt * 2;
    } else this.aimRing.visible = false;
  }

  /**
   * Герой не может зайти в тело врага: его выталкивает наружу, а часть рывка, направленная
   * во врага, гасится. Иначе рывок атаки заносил героя в босса, и тот ранил касанием.
   */
  private keepOutOfEnemies() {
    let pushed = false;
    for (const e of this.game.enemies) {
      if (e.dead || e.spawning) continue;
      const dx = this.pos.x - e.pos.x, dz = this.pos.z - e.pos.z;
      const minDist = e.radius + this.radius + 0.05; // небольшой зазор, чтобы касание не засчитывалось
      const d2 = dx * dx + dz * dz;
      if (d2 >= minDist * minDist || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
      this.pos.x = e.pos.x + nx * minDist; this.pos.z = e.pos.z + nz * minDist;
      const into = -(this.lungeVel.x * nx + this.lungeVel.z * nz);
      if (into > 0) { this.lungeVel.x += nx * into; this.lungeVel.z += nz * into; }
      pushed = true;
    }
    if (pushed) this.game.world.collide(this.pos, this.radius); // не вытолкнуть в стену
  }

  /** Ближайший враг в пределах досягаемости; кого видно напрямую — предпочтительнее. */
  private findTarget() {
    const { enemies, world } = this.game;
    let best: Enemy | null = null, bestScore = 1e9;
    const range = this.weapon.kind === 'melee' ? 7 : this.weapon.range + 2;
    for (const e of enemies) {
      if (e.dead || e.spawning || !e.targetable) continue;
      const d = e.pos.distanceTo(this.pos);
      if (d > range) continue;
      const score = d + (world.hasLineOfSight(this.pos, e.pos) ? 0 : 8);
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  /** Ставит модель и тень на позицию героя (с наклоном вперёд от позы). */
  private syncModel() {
    this.root.position.copy(this.pos);
    const lean = this.rig.lean * 0.18;
    this.root.position.x += Math.sin(this.facing) * lean; this.root.position.z += Math.cos(this.facing) * lean;
    this.root.rotation.y = this.facing;
    this.shadow.position.set(this.pos.x, 0.02, this.pos.z);
  }

  private tryAttack(target: Enemy) {
    const w = this.weapon;
    const dist = target.pos.distanceTo(this.pos) - target.radius;
    if (w.kind === 'melee') {
      // цель чуть дальше удара — сокращаем дистанцию рывком
      const reach = w.range + w.lunge! * 1.6;
      if (dist > reach + 0.8) return;
      if (dist > w.range - 0.2) {
        _d.subVectors(target.pos, this.pos).setY(0).normalize();
        this.lungeVel.addScaledVector(_d, Math.min(9, (dist - w.range + 0.6) * 9));
      }
    } else if (dist > w.range) return;
    this.attackCooldown = w.cd / this.attackSpeedMult;
    const aimDir = new THREE.Vector3().subVectors(target.pos, this.pos).setY(0).normalize();
    ATTACKS[this.weaponId](this, { weapon: w, id: this.weaponId, damage: w.dmg * this.damageMult, target, aimDir });
  }

  /** Выполнить fn через time секунд игрового времени. */
  schedule(time: number, fn: () => void) { this.scheduled.push({ time, fn }); }

  // ---------- здоровье ----------

  /** Получить урон. false — если удар не прошёл (неуязвимость или уже мёртв). */
  hurt(dmg: number, from?: THREE.Vector3 | null) {
    if (this.invulnTime > 0 || this.dead) return false;
    const { fx, ui } = this.game;
    this.hp -= dmg;
    if (this.cannotDie && this.hp < 1) this.hp = 1;
    this.invulnTime = PLAYER.invuln;
    audio.play('playerHurt');
    fx.shake(0.55); fx.hitstop(60);
    fx.text({ x: this.pos.x, y: 1.4, z: this.pos.z }, '-' + dmg, { color: '#ff4a4a', size: 18 });
    fx.burst({ x: this.pos.x, y: 0.7, z: this.pos.z }, { count: 12, color: 0xff3030, speed: 3, life: 0.4, size: 0.18 });
    this.rig.play('hit'); this.rig.punch(-1.5);
    this.shading.flash.value.set(1.2, 0.2, 0.2); // красная вспышка
    setTimeout(() => this.shading.flash.value.set(0, 0, 0), 90);
    if (from) {
      _d.subVectors(this.pos, from).setY(0).normalize();
      this.lungeVel.addScaledVector(_d, 6); // отбрасывает от удара
    }
    ui.hurt();
    if (this.hp <= 0) { this.hp = 0; this.die(); }
    ui.updateHp();
    return true;
  }

  heal(n: number, silent = false) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    const d = Math.round(this.hp - before);
    if (!silent && d > 0) this.game.fx.text({ x: this.pos.x, y: 1.5, z: this.pos.z }, '+' + d, { color: '#5aff7a', size: 18 });
    this.game.ui.updateHp();
  }

  private die() {
    this.dead = true;
    this.game.lose();
  }
}
