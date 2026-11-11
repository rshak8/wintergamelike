// Ход игры по комнатам: вход в комнату → ворота закрываются, появляются враги →
// все убиты → ворота открываются и падает награда. Плюс шипы, босс и дверь-выход.
import * as THREE from 'three';
import { audio } from '../audio/audio';
import { rand, type XYZ } from '../utils';
import type { Room, Spawn } from '../world/world';
import type { Enemy } from '../enemies/enemy';
import type { Game } from './game';

const _v = new THREE.Vector3();

export class Rooms {
  /** Комната, в которой сейчас герой (для шкалы пути). */
  currentRoom = 1;
  /** Комната, где идёт бой (ворота закрыты). */
  activeRoom: Room | null = null;
  boss: Enemy | null = null;
  private exitAnim = 0; // 0..1 — створки двери-выхода

  constructor(private game: Game) {}

  /** Идёт ли сейчас бой. */
  get inFight() { return !!this.activeRoom && !this.activeRoom.cleared; }

  update(dt: number) {
    const { world, ui } = this.game, hero = this.game.player;
    const row = world.zToRow(hero.pos.z);
    const room = world.roomAtRow(row);
    if (room && room.index !== this.currentRoom) {
      this.currentRoom = room.index;
      ui.setRoom(room.index);
    }
    // герой зашёл в новую комнату (на пару клеток вглубь)
    if (room && !room.cleared && !room.active && row < room.rowBottom - 1 && row > room.rowTop) {
      this.begin(room);
    }
    // все враги комнаты убиты? (мимик не в счёт — он появляется после зачистки)
    const active = this.activeRoom;
    if (active && active.spawned && !active.cleared) {
      const alive = this.game.enemies.some((e) => !e.dead && e.room === active && e.type !== 'mimic');
      if (!alive) this.clear(active);
    }
    this.updateSpikes(dt);
    this.updateGates(dt);
    // вышли через дверь — победа
    if (world.exitOpen && !this.game.over && hero.pos.z < world.bossRoom.zTop + 0.6) this.game.win();
  }

  private begin(room: Room) {
    const { world, ui, fx } = this.game;
    room.active = true;
    this.activeRoom = room;
    this.game.player.cannotDie = room.index === 2; // в первом бою (обучение) герой не умирает
    for (const g of room.gates) world.setGate(g, true);
    ui.showRooms(false); // шкала пути прячется на время боя
    audio.play('gate');
    fx.shake(0.3);
    audio.setIntensity(1);
    const spawns = room.spawns.slice();
    if (room.index === 6) { this.bossIntro(room, spawns); return; }
    ui.toast(`ROOM ${room.index - 1}`);
    // враги появляются по одному
    spawns.forEach((s, i) => {
      setTimeout(() => {
        if (!this.game.over) this.game.spawnEnemy(s.type, s.x, s.z, room);
        if (i === spawns.length - 1) room.spawned = true;
      }, 450 + i * 260);
    });
  }

  /** Камера показывает короля, он ревёт, потом появляется свита и управление возвращается. */
  private bossIntro(room: Room, spawns: Spawn[]) {
    const { fx, ui, input } = this.game;
    const ks = spawns.find((s) => s.type === 'king')!;
    this.game.cameraRig.focusOn(new THREE.Vector3(ks.x, 0, ks.z), 2.4);
    input.enabled = false;
    setTimeout(() => {
      const king = this.game.spawnEnemy('king', ks.x, ks.z, room);
      this.boss = king;
      setTimeout(() => {
        king.rig!.play('roar'); audio.play('roar'); fx.shake(0.9);
        fx.ring(king.pos, { radius: 5, color: 0xff2020, life: 0.7 });
        ui.showBoss('SKELETON KING');
      }, 650);
    }, 300);
    setTimeout(() => {
      spawns.filter((s) => s.type !== 'king').forEach((s) => this.game.spawnEnemy(s.type, s.x, s.z, room));
      room.spawned = true;
      input.enabled = true;
    }, 2300);
  }

  /** Комната зачищена: лечение, ворота открываются, падает награда. */
  private clear(room: Room) {
    const { fx, ui, world } = this.game, hero = this.game.player;
    room.cleared = true; room.active = false;
    this.activeRoom = null;
    audio.setIntensity(0);
    ui.showRooms(true);
    if (room.index === 6) return; // у босса своя концовка (onBossDeath)
    audio.play('clear');
    fx.slowmo(0.45, 0.3);
    ui.toast('ROOM CLEAR!', '', 'white');
    const missing = hero.maxHp - hero.hp;
    hero.heal(hero.maxHp);
    fx.burst({ x: hero.pos.x, y: 0.2, z: hero.pos.z }, { count: 30, color: 0x5aff7a, speed: 1.2, life: 1.0, size: 0.25, gravity: -3, up: 1.5 });
    fx.ring(hero.pos, { radius: 1.6, color: 0x5aff7a, life: 0.5 });
    if (missing > 0) audio.play('heal');
    setTimeout(() => {
      for (const g of room.gates) world.setGate(g, false);
      audio.play('gateOpen');
    }, 600);
    this.game.rewards.onRoomCleared(room);
  }

  /** Король повержен: свита рассыпается, серия взрывов, дверь-выход открывается. */
  onBossDeath(king: Enemy) {
    const { fx, ui, world } = this.game;
    ui.hideBoss();
    fx.slowmo(1.6, 0.2);
    audio.play('roar');
    setTimeout(() => {
      for (const e of this.game.enemies) if (!e.dead) this.game.combat.damageEnemy(e, 999, { knock: 5 });
      this.game.projectiles.clear();
    }, 200);
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const p: XYZ = { x: king.pos.x + rand(-1, 1), y: rand(0.4, 1.5), z: king.pos.z + rand(-1, 1) };
        fx.flash(p, { color: 0xff3a2a, size: 3, life: 0.25 });
        fx.burst(p, { count: 20, color: i % 2 ? 0xff3a2a : 0xffd070, speed: 5, life: 0.7, size: 0.3, gravity: 3, up: 3 });
        audio.play('boom'); fx.shake(0.6);
      }, i * 160);
    }
    this.game.loot.dropCoins(king.pos, 20);
    if (this.activeRoom) this.activeRoom.cleared = true;
    setTimeout(() => {
      audio.play('clear');
      ui.toast('VICTORY!', 'The exit is open');
      ui.showRooms(true);
      world.openExit();
      this.exitAnim = 0;
      audio.play('gateOpen');
      this.game.cameraRig.focusOn(new THREE.Vector3(0, 0, world.bossRoom.zTop + 1), 1.6);
      this.game.player.heal(99);
    }, 1400);
  }

  /** Шипы выдвигаются по циклу 2.6 с, только в комнате с боем или уже зачищенной. */
  private updateSpikes(dt: number) {
    const hero = this.game.player;
    for (const s of this.game.world.spikes) {
      if (!s.room.active && !s.room.cleared) { s.spikes.position.y = -0.3; continue; }
      const cyc = (this.game.time + s.phase) % 2.6;
      const target = cyc < 1.4 ? -0.3 : cyc < 1.65 ? -0.15 : 0; // спрятаны → предупреждение → удар
      const was = s.up;
      s.up = target;
      s.spikes.position.y += (target - s.spikes.position.y) * Math.min(1, dt * (target === 0 ? 30 : 8));
      if (target === 0 && was !== 0 && hero.pos.distanceTo(_v.set(s.x, 0, s.z)) < 6) audio.play('stab');
      if (target === 0 && Math.abs(hero.pos.x - s.x) < 0.5 && Math.abs(hero.pos.z - s.z) < 0.5) hero.hurt(1, new THREE.Vector3(s.x, 0, s.z));
    }
  }

  /** Решётки ворот опускаются/поднимаются; створки выхода открываются. */
  private updateGates(dt: number) {
    const { world, fx } = this.game;
    for (const rm of world.rooms) {
      if (!rm) continue;
      for (const g of rm.gates) {
        const b = g.bars;
        if (!b.visible) continue;
        const target = g.closed ? 0 : 1.45;
        const prev = b.position.y;
        b.position.y += (target - b.position.y) * Math.min(1, dt * (g.closed ? 18 : 4));
        if (g.closed && prev > 0.05 && b.position.y <= 0.05) {
          fx.burst({ x: g.x, y: 0.05, z: g.z }, { count: 14, color: 0x6a7290, speed: 2.5, life: 0.5, size: 0.3, gravity: 3, up: 1.2, additive: false });
        }
        if (!g.closed && b.position.y > 1.4) b.visible = false;
      }
    }
    if (world.exitOpen) {
      this.exitAnim = Math.min(1, this.exitAnim + dt * 0.8);
      const k = 1 - Math.pow(1 - this.exitAnim, 3);
      const [left, right] = world.exitLeaves;
      left.rotation.y = -k * 1.9; right.rotation.y = k * 1.9;
      world.exitLight.intensity = 8 * k;
      if (Math.random() < dt * 30) fx.burst({ x: rand(-0.8, 0.8), y: rand(0.2, 2), z: world.bossRoom.zTop + 0.6 }, { count: 1, color: 0x6ab0ff, speed: 0.6, life: 1, size: 0.25, gravity: -1, up: 0.5 });
    }
  }
}
