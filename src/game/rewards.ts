// Награды за комнаты: сундук с оружием, сундук с благословением или мимик.
import * as THREE from 'three';
import { clone } from '../assets';
import { audio } from '../audio/audio';
import { BUFFS, CHEST_WEAPONS, type BuffId, type WeaponId } from '../config';
import { rand, shuffle, type XZ } from '../utils';
import type { TimedItem } from '../fx/fx';
import type { LightSource } from '../world/lights';
import type { Room } from '../world/world';
import type { Enemy } from '../enemies/enemy';
import type { Game } from './game';

export type Reward = 'weapon' | 'buff' | 'mimic';

interface Chest {
  obj: THREE.Object3D;
  pos: THREE.Vector3;
  lid: THREE.Object3D;
  reward: Reward;
  state: 'drop' | 'closed' | 'opening';
  stateTime: number;
  light?: LightSource;
  popped?: boolean;   // крышка уже открылась, награда выдана
}

export class Rewards {
  /** Какое оружие выпадет следующим (без повторов). */
  private weaponPool: WeaponId[] = shuffle([...CHEST_WEAPONS]);
  /** Награда за каждую комнату: во 2-й всегда оружие, в 3–5 — оружие, бафф и мимик в случайном порядке. */
  private byRoom: Partial<Record<number, Reward>>;
  private chests: Chest[] = [];

  constructor(private game: Game) {
    const r = shuffle<Reward>(['buff', 'weapon', 'mimic']);
    this.byRoom = { 2: 'weapon', 3: r[0], 4: r[1], 5: r[2] };
  }

  /** Комната зачищена: если за неё положена награда — через мгновение падает сундук. */
  onRoomCleared(room: Room) {
    const reward = this.byRoom[room.index];
    if (reward) setTimeout(() => this.spawnChest(room, reward), 700);
  }

  private spawnChest(room: Room, reward: Reward) {
    const pos = new THREE.Vector3(room.chest.x, 0, room.chest.z);
    this.game.world.collide(pos, 0.5); // не ставить сундук в стену
    if (reward === 'mimic') {
      // мимик выглядит как сундук, пока к нему не подойдёшь
      const e = this.game.spawnEnemy('mimic', pos.x, pos.z, room);
      e.root.position.set(pos.x, 6, pos.z);
      this.dropIn(e.root, pos, () => { });
      return;
    }
    const obj = clone('T_Chest');
    obj.position.set(pos.x, 6, pos.z);
    this.game.scene.add(obj);
    const chest: Chest = { obj, pos, lid: obj.getObjectByName('T_Chest_Lid')!, reward, state: 'drop', stateTime: 0 };
    this.chests.push(chest);
    this.dropIn(obj, pos, () => { chest.state = 'closed'; });
    chest.light = this.game.lights.add({ x: pos.x, y: 1.4, z: pos.z, color: new THREE.Color(0xffd070), intensity: 3, range: 5, flicker: false });
  }

  /** Объект падает с высоты и с ударом приземляется в pos. */
  private dropIn(obj: THREE.Object3D, pos: THREE.Vector3, onLanded: () => void) {
    const { fx } = this.game;
    const t0 = this.game.time;
    const it: TimedItem = fx.timed(new THREE.Object3D(), 0.6, () => {
      const k = Math.min(1, (this.game.time - t0) / 0.45);
      obj.position.y = 6 * (1 - k * k);
      if (k >= 1 && !it.landed) {
        it.landed = true; obj.position.y = 0;
        audio.play('slam'); fx.shake(0.35);
        fx.ring(pos, { radius: 1.3, color: 0xffd070, life: 0.35 });
        fx.burst({ x: pos.x, y: 0.1, z: pos.z }, { count: 14, color: 0x6a7290, speed: 2.5, life: 0.5, size: 0.3, gravity: 3, up: 1.5, additive: false });
        obj.scale.set(1.25, 0.75, 1.25);
        onLanded();
      }
    });
  }

  /** Сундуки: покачиваются и искрятся; рядом с героем трясутся и открываются. */
  update(dt: number) {
    const { fx } = this.game, hero = this.game.player;
    for (const c of this.chests) {
      c.stateTime += dt;
      // возврат к нормальному масштабу после приземления
      const s = c.obj.scale; s.x += (1 - s.x) * Math.min(1, dt * 10); s.y += (1 - s.y) * Math.min(1, dt * 10); s.z = s.x;
      if (c.state === 'closed') {
        c.lid.rotation.x = Math.sin(this.game.time * 4) * 0.03;
        if (Math.random() < dt * 6) fx.burst({ x: c.pos.x + rand(-0.4, 0.4), y: 0.6, z: c.pos.z + rand(-0.3, 0.3) }, { count: 1, color: 0xffd070, speed: 0.2, life: 0.8, size: 0.15, gravity: -1, up: 0.3 });
        if (hero.pos.distanceTo(c.pos) < 1.5) { c.state = 'opening'; c.stateTime = 0; audio.play('telegraph'); }
      } else if (c.state === 'opening') {
        c.obj.rotation.z = Math.sin(c.stateTime * 60) * 0.05 * (c.stateTime < 0.35 ? 1 : 0);
        if (c.stateTime > 0.35 && !c.popped) {
          c.popped = true; c.obj.rotation.z = 0;
          audio.play('chestOpen'); fx.shake(0.3);
          fx.flash({ x: c.pos.x, y: 0.9, z: c.pos.z }, { color: 0xffe080, size: 4, life: 0.4 });
          fx.burst({ x: c.pos.x, y: 0.6, z: c.pos.z }, { count: 30, color: 0xffd070, speed: 4, life: 0.8, size: 0.2, gravity: 6, up: 5 });
          this.game.loot.dropCoins(c.pos, 6);
          if (c.reward === 'weapon') this.dropNextWeapon(c.pos);
          else if (c.reward === 'buff') setTimeout(() => this.offerBuffs(), 350);
        }
        if (c.popped) c.lid.rotation.x += ((-1.9) - c.lid.rotation.x) * Math.min(1, dt * 14);
      }
    }
  }

  private dropNextWeapon(pos: XZ) {
    this.game.loot.dropWeapon(pos, this.weaponPool.shift() || 'fire');
  }

  /** Пауза и выбор одного из трёх случайных благословений. */
  offerBuffs() {
    const keys = shuffle(Object.keys(BUFFS) as BuffId[]).slice(0, 3);
    this.game.paused = true;
    this.game.ui.buffChoice(keys, (k) => {
      this.game.paused = false;
      this.applyBuff(k);
    });
  }

  private applyBuff(k: BuffId) {
    const { fx, ui } = this.game, hero = this.game.player;
    if (k === 'hp') { hero.maxHp += 4; hero.heal(4, true); }
    if (k === 'atkspd') hero.attackSpeedMult *= 1.3;
    if (k === 'dmg') hero.damageMult *= 1.35;
    if (k === 'speed') hero.speedMult *= 1.18;
    const b = BUFFS[k];
    audio.play('buff');
    fx.burst({ x: hero.pos.x, y: 0.3, z: hero.pos.z }, { count: 36, color: b.color, speed: 2, life: 1, size: 0.25, gravity: -4, up: 2 });
    fx.ring(hero.pos, { radius: 2, color: b.color, life: 0.5 });
    fx.text({ x: hero.pos.x, y: 1.6, z: hero.pos.z }, b.desc, { color: b.color, size: 15, life: 1.4 }); // «+35% Damage» над героем
    hero.rig.punch(2);
    ui.updateHp(); ui.addBuff(k);
  }

  /** Убитый мимик даёт двойную награду: оружие и благословение. */
  onMimicDeath(e: Enemy) {
    audio.setIntensity(0);
    const pos = e.pos.clone();
    setTimeout(() => this.dropNextWeapon(pos), 300);
    setTimeout(() => this.offerBuffs(), 900);
  }
}
