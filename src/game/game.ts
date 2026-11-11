// Главный объект игры: создаёт мир, героя и все системы и обновляет их каждый кадр.
// Системы обращаются друг к другу через game (game.combat, game.loot, game.rooms и т. д.).
import * as THREE from 'three';
import { clone, cloneCharacter, assetNames } from '../assets';
import { audio } from '../audio/audio';
import { FX } from '../fx/fx';
import { World } from '../world/world';
import { LightPool } from '../world/lights';
import { Player } from '../player/player';
import { Enemy } from '../enemies/enemy';
import { ENEMIES, type EnemyType } from '../config';
import { makeShared, debrisMaterial, type Shared } from './shared';
import { Combat } from './combat';
import { Projectiles } from './projectiles';
import { Loot } from './loot';
import { Debris } from './debris';
import { Rewards } from './rewards';
import { Rooms } from './rooms';
import { CameraRig } from './camera';
import { Tutorial } from './tutorial';
import type { Input } from '../input';
import type { UI } from '../ui/ui';
import type { Room } from '../world/world';

export interface GameDeps { scene: THREE.Scene; camera: THREE.PerspectiveCamera; input: Input; ui: UI }

export class Game {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly input: Input;
  readonly ui: UI;
  readonly fx: FX;
  readonly shared: Shared;
  readonly world: World;
  readonly lights: LightPool;
  readonly player: Player;
  enemies: Enemy[] = [];

  // системы
  readonly combat: Combat;
  readonly projectiles: Projectiles;
  readonly loot: Loot;
  readonly debris: Debris;
  readonly rewards: Rewards;
  readonly rooms: Rooms;
  readonly cameraRig: CameraRig;
  readonly tutorial: Tutorial;

  /** Игровое время в секундах (стоит в стоп-кадре, медленнее в замедлении). */
  time = 0;
  /** Игра окончена (победа или поражение). */
  over = false;
  /** Пауза (выбор благословения). */
  paused = false;
  screenW = window.innerWidth;
  screenH = window.innerHeight;

  constructor({ scene, camera, input, ui }: GameDeps) {
    this.scene = scene; this.camera = camera; this.input = input; this.ui = ui;
    this.fx = new FX(scene, camera);
    this.shared = makeShared(); // после FX: нужны его текстуры
    this.world = new World(scene);
    this.lights = new LightPool(scene, 8);
    for (const s of this.world.lights) this.lights.add(s);
    this.player = new Player(this);
    this.player.cannotDie = true; // в стартовой комнате умереть нельзя
    this.combat = new Combat(this);
    this.projectiles = new Projectiles(this);
    this.loot = new Loot(this);
    this.debris = new Debris(this);
    this.rewards = new Rewards(this);
    this.rooms = new Rooms(this);
    this.cameraRig = new CameraRig(this);
    this.tutorial = new Tutorial(this);
    ui.bind(this);
  }

  /**
   * Заранее компилирует все шейдеры и загружает все модели в видеокарту,
   * чтобы ничего не подтормаживало посреди игры (подробности в FX.prewarm).
   */
  prewarm(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) {
    const s = this.shared;
    const extra: THREE.Object3D[] = [
      new THREE.Mesh(s.crescentGeo, s.crescentMat),
      new THREE.Mesh(s.coinGeo, s.coinMat),
      new THREE.Mesh(s.debrisGeo, debrisMaterial(s, 0x8a5a34)),
      new THREE.Sprite(s.bulletMat),
    ];
    for (const name of assetNames()) extra.push(clone(name));                              // оружие, снаряды, сундуки, пропы
    for (const def of Object.values(ENEMIES)) extra.push(cloneCharacter(def.model).root); // шейдер персонажей с подсветкой
    this.fx.prewarm(renderer, this.camera, extra, target);
  }

  start() {
    this.tutorial.start();
    this.input.enabled = true;
  }

  spawnEnemy(type: EnemyType, x: number, z: number, room: Room) {
    const e = new Enemy(this, type, x, z, room);
    this.enemies.push(e);
    return e;
  }

  // ---------- кадр ----------

  update(realDt: number) {
    if (this.paused) { this.fx.update(0, realDt, this.screenW, this.screenH); return; }
    const dt = this.fx.gameDt(realDt); // 0 в стоп-кадре, меньше в замедлении
    this.time += dt;
    if (dt > 0) {
      if (!this.over || this.player.dead) this.player.update(dt);
      for (const e of this.enemies) e.update(dt);
      for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].dead) this.enemies.splice(i, 1);
      this.projectiles.update(dt);
      this.loot.update(dt);
      this.debris.update(dt);
      this.rewards.update(dt);
      this.rooms.update(dt);
      this.tutorial.update();
    }
    this.lights.update(realDt, this.time, this.cameraRig.target);
    this.world.updateTorches(this.time, realDt, this.fx);
    this.fx.update(dt, realDt, this.screenW, this.screenH);
    this.cameraRig.update(realDt);
    this.tutorial.updateSpotlight(realDt);
  }

  resize(w: number, h: number) {
    this.screenW = w; this.screenH = h;
    this.cameraRig.resize(w, h);
    this.fx.setScreen(h, this.camera.fov);
  }

  // ---------- конец игры ----------

  /** Герой погиб: замедление, падение, через секунду — финальный экран. */
  lose() {
    if (this.over) return;
    this.over = true;
    audio.play('lose');
    this.fx.slowmo(1.2, 0.25);
    const hero = this.player;
    hero.rig.play('hit');
    hero.root.rotation.x = -1.4;
    this.fx.burst({ x: hero.pos.x, y: 0.6, z: hero.pos.z }, { count: 30, color: 0xff3030, speed: 3, life: 0.8, size: 0.25 });
    setTimeout(() => this.ui.packshot(false), 1300);
  }

  /** Вышли через дверь: затемнение и финальный экран. */
  win() {
    if (this.over) return;
    this.over = true;
    this.input.enabled = false;
    audio.play('win');
    this.ui.fadeOut(() => this.ui.packshot(true));
  }
}
