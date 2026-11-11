// Процедурный «скелет» персонажа: бег, покачивание, позы атак, оружие в руке, сплющивание.
// Модели собраны из отдельных частей (Body, Head, ArmL, ArmR, ...), Rig просто их поворачивает.
import * as THREE from 'three';
import { ACTIONS, type Action, type ActionName, type Pose } from './poses';

/** Как оружие лежит в руке: клинок, лук или шар, парящий над ладонью. */
export type GripBasis = 'blade' | 'bow' | 'orb';

interface RestPose { pos: THREE.Vector3; rot: THREE.Euler }

export class Rig {
  readonly root: THREE.Object3D;
  // части тела (у некоторых моделей каких-то нет)
  body?: THREE.Object3D; head?: THREE.Object3D;
  armL?: THREE.Object3D; armR?: THREE.Object3D;
  legL?: THREE.Object3D; legR?: THREE.Object3D;
  cape?: THREE.Object3D; handR?: THREE.Object3D; handL?: THREE.Object3D;
  /** Исходное положение частей — всё анимируется относительно него. */
  private rest = new Map<THREE.Object3D, RestPose>();

  private walkPhase = 0;          // фаза шага
  private moveBlend = 0;          // 0 стоит .. 1 бежит (сглажено)
  private time = Math.random() * 10;

  action: Action | null = null;
  actionName: ActionName | null = null;
  private actionTime = 0;
  private actionAlt = false;

  private squash = 0; private squashVel = 0;   // пружина сплющивания
  private weaponPitch = -1.7;
  /** Наклон оружия в покое (у посоха, лука и молота свой). */
  idlePitch = -1.7;
  /** Положение рук в покое. */
  armRestR = -0.35; armRestL = -0.1;
  /** Смещение вперёд от текущей позы; персонаж применяет его к своей позиции. */
  lean = 0;
  baseScale = 1;

  // оружие
  private holder: THREE.Group | null = null;  // «запястье»: живёт в системе руки и наклоняет оружие
  private basis: GripBasis = 'blade';

  constructor(root: THREE.Object3D, prefix: string) {
    this.root = root;
    const part = (n: string) => root.getObjectByName(prefix + '_' + n);
    this.body = part('Body'); this.head = part('Head');
    this.armL = part('ArmL'); this.armR = part('ArmR');
    this.legL = part('LegL'); this.legR = part('LegR');
    this.cape = part('Cape'); this.handR = part('HandR'); this.handL = part('HandL');
    for (const p of [this.body, this.head, this.armL, this.armR, this.legL, this.legR, this.cape]) {
      if (p) this.rest.set(p, { pos: p.position.clone(), rot: p.rotation.clone() });
    }
  }

  /** Запустить действие с начала. */
  play(name: ActionName, alt = false) {
    this.action = ACTIONS[name]; this.actionName = name; this.actionTime = 0; this.actionAlt = alt;
  }
  /** Держать позу (не перезапускает, если она уже идёт). */
  hold(name: ActionName) { if (this.actionName !== name) this.play(name); }
  stop() { this.action = null; this.actionName = null; }
  /** Толчок пружины сплющивания (+ сплющить, − вытянуть). */
  punch(amount: number) { this.squashVel += amount; }

  /**
   * Вложить оружие в правый кулак.
   * Оружие смоделировано так, что центр рукояти в начале координат, а рукоять идёт вдоль +Y.
   * Сокет руки стоит в центре кулака; отверстие кулака смотрит вперёд (+Z), когда рука опущена.
   */
  attach(obj: THREE.Object3D, basis: GripBasis = 'blade', hand: 'R' | 'L' = 'R') {
    const h = hand === 'R' ? this.handR : this.handL;
    if (!h || !h.parent) return;
    if (this.holder) this.holder.parent?.remove(this.holder);
    const holder = new THREE.Group();
    holder.position.copy(h.position);
    h.parent.add(holder);
    const grip = new THREE.Group();
    holder.add(grip);
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    if (basis === 'blade') {
      // рукоять сквозь кулак вперёд, ширина клинка вверх (при взмахе ведёт лезвие)
      grip.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 1, 0), V(0, 0, 1), V(1, 0, 0)));
    } else if (basis === 'bow') {
      // рукоять вперёд; когда рука поднята для выстрела, лук стоит вертикально, тетивой к лучнику
      grip.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(1, 0, 0), V(0, 0, 1), V(0, -1, 0)));
    } else {
      obj.position.set(0, -0.07, 0.07); // шар парит прямо перед открытой ладонью
    }
    grip.add(obj);
    this.holder = holder; this.basis = basis;
  }

  /** speed01: 0 стоит, 1 бежит на полной скорости. */
  update(dt: number, speed01: number) {
    this.time += dt;
    this.moveBlend += (Math.min(1, speed01) - this.moveBlend) * Math.min(1, dt * 12);
    this.walkPhase += dt * (6 + 8 * this.moveBlend) * (this.moveBlend > 0.05 ? 1 : 0);
    const mv = this.moveBlend;
    const s = Math.sin(this.walkPhase), c = Math.cos(this.walkPhase);

    let pose: Pose = {};
    if (this.action) {
      this.actionTime += dt;
      const t = Math.min(1, this.actionTime / this.action.dur);
      pose = this.action.pose(t, this.actionAlt, this.time);
      // разовые действия заканчиваются сами, удерживаемые (dur > 5) — нет
      if (t >= 1 && this.action.dur < 5) { this.action = null; this.actionName = null; }
    }
    const R = this.rest;

    // ноги
    if (this.legL && this.legR) {
      this.legL.rotation.x = R.get(this.legL)!.rot.x + s * 0.75 * mv;
      this.legR.rotation.x = R.get(this.legR)!.rot.x - s * 0.75 * mv;
    }
    // корпус: покачивание при беге и дыхание в покое
    if (this.body) {
      const rb = R.get(this.body)!;
      const bob = Math.abs(c) * 0.045 * mv + Math.sin(this.time * 2.2) * 0.008 * (1 - mv);
      this.body.position.y = rb.pos.y + bob + (pose.bodyLift || 0);
      this.body.rotation.x = rb.rot.x + 0.14 * mv + (pose.bodyPitch || 0);
      this.body.rotation.y = rb.rot.y + (pose.bodyYaw || 0) + s * 0.08 * mv;
      this.body.rotation.z = rb.rot.z + c * 0.03 * mv;
    }
    if (this.head) {
      const rh = R.get(this.head)!;
      this.head.rotation.x = rh.rot.x - 0.08 * mv + Math.sin(this.time * 2.2 + 1) * 0.02 + (pose.headPitch || 0);
      this.head.rotation.y = rh.rot.y - (pose.bodyYaw || 0) * 0.35; // голова частично компенсирует поворот корпуса
    }
    // руки: поза или размах при беге
    const swing = s * 0.6 * mv;
    if (this.armR) {
      const ar = pose.armR || { x: this.armRestR - swing * 0.6, z: 0.08 };
      this.armR.rotation.x = ar.x; this.armR.rotation.z = R.get(this.armR)!.rot.z + ar.z;
    }
    if (this.armL) {
      const al = pose.armL || { x: this.armRestL + swing, z: -0.08 };
      this.armL.rotation.x = al.x; this.armL.rotation.z = R.get(this.armL)!.rot.z + al.z;
    }
    if (this.cape) {
      const rc = R.get(this.cape)!;
      this.cape.rotation.x = rc.rot.x + 0.15 + mv * 0.55 + Math.sin(this.time * 9) * 0.06 * (0.3 + mv);
    }
    // наклон оружия: в атаке быстро, в покое плавнее
    if (this.holder) {
      const target = pose.weaponPitch !== undefined ? pose.weaponPitch : this.idlePitch;
      this.weaponPitch += (target - this.weaponPitch) * Math.min(1, dt * (pose.weaponPitch !== undefined ? 40 : 14));
      this.holder.rotation.x = this.basis === 'blade' ? this.weaponPitch + Math.PI / 2 : 0;
    }
    this.lean = pose.lean || 0;
    // пружина сплющивания
    this.squashVel += (-this.squash * 220 - this.squashVel * 16) * dt;
    this.squash += this.squashVel * dt;
    const sq = this.squash + (pose.squash || 0);
    this.root.scale.set(this.baseScale * (1 + sq * 0.6), this.baseScale * (1 - sq), this.baseScale * (1 + sq * 0.6));
  }
}
