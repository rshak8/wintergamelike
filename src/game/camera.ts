// Камера: смотрит сверху под углом 58°, мягко следует за героем (пружиной) и никогда
// не показывает то, что за пределами подземелья.
import * as THREE from 'three';
import { smoothDamp } from '../utils';
import type { Game } from './game';

/** Что камера видит на полу относительно своей цели (считается в resize). */
interface View {
  top: number;      // насколько далеко вперёд (к -Z) виден пол от цели
  bottom: number;   // насколько назад
  halfTop: number;  // половина ширины видимого пола
  ahead: number;    // смещение цели вперёд, чтобы видеть больше пути
}

const PITCH = THREE.MathUtils.degToRad(58);
/** За сколько секунд камера примерно догоняет цель (0.22 ≈ одна клетка отставания на полном беге). */
const FOLLOW_TIME = 0.22;
const FOCUS_TIME = 0.45;

const _want = new THREE.Vector3();

export class CameraRig {
  /** Точка на полу, на которую смотрит камера. */
  readonly target: THREE.Vector3;
  private vel = new THREE.Vector3();
  /** Временно смотреть не на героя, а на точку (появление босса, открытая дверь). */
  private focus: { pos: THREE.Vector3; time: number } | null = null;
  private offset = { x: 0, y: 0, z: 0 }; // где камера относительно цели
  private view: View | null = null;
  private ready = false;

  constructor(private game: Game) {
    this.target = game.player.pos.clone();
  }

  focusOn(pos: THREE.Vector3, seconds: number) { this.focus = { pos, time: seconds }; }

  update(dt: number) {
    const { camera, fx } = this.game;
    let target = this.game.player.pos;
    if (this.focus) {
      this.focus.time -= dt;
      target = this.focus.pos;
      if (this.focus.time <= 0) this.focus = null;
    }
    const want = _want.copy(target);
    if (this.view) {
      if (!this.focus) want.z -= this.view.ahead;
      this.clampToDungeon(want);
      if (!this.ready) { this.target.copy(want); this.vel.set(0, 0, 0); this.ready = true; }
    }
    smoothDamp(this.target, want, this.vel, this.focus ? FOCUS_TIME : FOLLOW_TIME, dt);
    const shake = fx.shakeOffset(this.game.time);
    const off = this.offset;
    camera.position.set(this.target.x + off.x + shake.x, off.y, this.target.z + off.z + shake.z);
    camera.lookAt(this.target.x + shake.x, 0, this.target.z + shake.z);
  }

  /** Всё, что видит камера, должно оставаться внутри подземелья. */
  private clampToDungeon(want: THREE.Vector3) {
    const W = this.game.world, v = this.view!;
    const top = W.bossRoom.zTop - 0.5;
    const bottom = W.rooms[1]!.zBottom + 0.5;
    const lo = top - v.top, hi = bottom - v.bottom;
    want.z = lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, want.z));
    const maxX = Math.max(0, W.half - v.halfTop);
    want.x = Math.max(-maxX, Math.min(maxX, want.x));
  }

  /** Подбирает угол обзора и высоту камеры под размер экрана (портрет или ландшафт). */
  resize(w: number, h: number) {
    const { camera, world } = this.game;
    const aspect = w / h;
    const portrait = aspect < 1;
    camera.fov = portrait ? 42 : 34;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // ставим камеру на расстояние 1 и смотрим, какой кусок пола она видит (всё масштабируется с расстоянием)
    const dir = { y: Math.sin(PITCH), z: Math.cos(PITCH) };
    camera.position.set(0, dir.y, dir.z);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const rc = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    const groundAt = (x: number, y: number) => { rc.setFromCamera(new THREE.Vector2(x, y), camera); return rc.ray.intersectPlane(ground, hit) ? hit.clone() : new THREE.Vector3(0, 0, -50); };
    const tl = groundAt(-1, 1), tr = groundAt(1, 1), bc = groundAt(0, -1), ml = groundAt(-1, 0), mr = groundAt(1, 0);
    const top1 = Math.min(tl.z, tr.z), bottom1 = bc.z, halfTop1 = Math.max(Math.abs(tl.x), Math.abs(tr.x));
    const across1 = mr.x - ml.x;
    // в портрете даже широкие верхние углы помещаются между боковыми стенами; в широком
    // ландшафте так не выйдет, поэтому там помещается средняя линия, а углы закрывает скала
    const sideHalf1 = portrait ? halfTop1 : across1 / 2;
    // желаемая близость: ~6 клеток поперёк экрана в портрете, ~12 в ландшафте
    let dist = (portrait ? 6.2 : 12) / across1;
    // но не дальше, чем позволяет самая короткая комната и боковые стены
    let minDepth = Infinity;
    for (const rm of world.rooms) if (rm) minDepth = Math.min(minDepth, rm.rowBottom - rm.rowTop + 1);
    dist = Math.min(dist, (minDepth - 0.3) / (bottom1 - top1), (world.half - 0.05) / sideHalf1);
    this.offset = { x: 0, y: dir.y * dist, z: dir.z * dist };
    this.view = { top: top1 * dist, bottom: bottom1 * dist, halfTop: sideHalf1 * dist, ahead: portrait ? 1.0 : 0.4 };
  }
}
