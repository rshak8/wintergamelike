// Обучение без слов (почти): рука на джойстике в начале, замедление с подсветкой
// в первом бою и подпись «Tap to swap» над кнопкой, когда появилось второе оружие.
import * as THREE from 'three';
import { CHAR_SCALE } from '../config';
import type { Enemy } from '../enemies/enemy';
import type { SpotHole } from '../ui/ui';
import type { Game } from './game';

/** На каком расстоянии от врага в первом бою срабатывает подсказка про автоатаку. */
const STOP_HINT_DISTANCE = 4.5;
const SLOWMO_SECONDS = 2.2;

const _p = new THREE.Vector3();

export class Tutorial {
  private moved = false;
  private stopHintShown = false;
  private swapHintShown = false;
  /** Подсветка героя и врага во время подсказки. */
  private spotlight: { enemy: Enemy; time: number } | null = null;

  constructor(private game: Game) {}

  start() { this.game.ui.handTutorial(true); }

  /** Вызывается в игровом шаге. */
  update() {
    const { ui, input, fx } = this.game, hero = this.game.player;
    // рука пропадает, как только игрок двинулся
    if (!this.moved && input.read().mag > 0.2) {
      this.moved = true;
      ui.handTutorial(false);
    }
    // первый бой: герой впервые подошёл к врагу → замедление, подсветка, «STOP TO / AUTO-ATTACK»
    const room = this.game.rooms.activeRoom;
    if (room?.index === 2 && room.spawned && !this.stopHintShown) {
      const near = this.game.enemies.find((e) => e.targetable && !e.dead && e.pos.distanceTo(hero.pos) < STOP_HINT_DISTANCE);
      if (near) {
        this.stopHintShown = true;
        fx.slowmo(SLOWMO_SECONDS, 0.3);
        this.spotlight = { enemy: near, time: SLOWMO_SECONDS };
        ui.spotlight(true);
        ui.hint('STOP TO', { second: 'AUTO-ATTACK', time: 2.6, low: true });
      }
    }
  }

  /** Окна подсветки следуют за героем и врагом. Вызывается каждый кадр с реальным временем. */
  updateSpotlight(realDt: number) {
    const s = this.spotlight;
    if (!s) return;
    s.time -= realDt;
    if (s.time <= 0) { this.spotlight = null; this.game.ui.spotlight(false); return; }
    this.game.ui.setSpot(this.holeAround(this.game.player.pos, 1.5), this.holeAround(s.enemy.pos, 1.5 * s.enemy.scale / CHAR_SCALE));
  }

  /** Круг на экране, в который помещается персонаж высотой height. */
  private holeAround(p: THREE.Vector3, height: number): SpotHole {
    const { camera, screenW: w, screenH: h } = this.game;
    const feet = _p.set(p.x, 0, p.z).project(camera);
    const fx = (feet.x * 0.5 + 0.5) * w, fy = (-feet.y * 0.5 + 0.5) * h;
    const head = _p.set(p.x, height, p.z).project(camera);
    const hy = (-head.y * 0.5 + 0.5) * h;
    return { x: fx, y: (fy + hy) / 2, r: Math.max(60, Math.abs(fy - hy) * 1.15) };
  }

  /** Подобрано второе оружие — один раз показываем подпись над кнопкой смены. */
  onSecondWeapon() {
    if (this.swapHintShown) return;
    this.swapHintShown = true;
    setTimeout(() => this.game.ui.weaponTip('Tap to swap'), 1800);
  }
}
