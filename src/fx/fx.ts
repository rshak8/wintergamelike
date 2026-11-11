// Все визуальные эффекты: частицы, следы ударов, зоны опасности, молнии, вспышки,
// числа урона, тряска камеры, стоп-кадр при ударе и замедление времени.
import * as THREE from 'three';
import type { XYZ, XZ } from '../utils';
import { TEX, createTextures } from './textures';
import { Particles } from './particles';
import { telegraphMaterial, slashMaterial, streakMaterial, slashGeometry } from './materials';

export { TEX } from './textures';

/** Эффект, который живёт life секунд; update вызывается каждый кадр, onEnd — в конце. */
export interface TimedItem {
  obj: THREE.Object3D;
  life: number;
  maxLife: number;
  update?: (dt: number, it: TimedItem) => void;
  onEnd?: () => void;
  mesh?: THREE.Mesh;  // у зон опасности: сам меш (враги поворачивают его за собой)
  landed?: boolean;   // для падающих объектов (сундук): уже коснулся пола
}

export interface BurstOpts {
  count?: number; color?: THREE.ColorRepresentation; speed?: number; life?: number; size?: number;
  gravity?: number;      // > 0 падают, < 0 всплывают
  up?: number;           // начальная скорость вверх
  spread?: number;       // разброс вокруг dir (радианы)
  additive?: boolean;    // светящиеся (true) или обычные (пыль, щепки)
  drag?: number;         // торможение в воздухе
  dir?: XZ | null;       // если задано — летят в эту сторону, иначе во все стороны
  jitter?: number;       // разброс точки появления
  colorVar?: number;     // случайный сдвиг оттенка
}

export interface DecalOpts {
  tex?: THREE.Texture; size?: number; color?: THREE.ColorRepresentation; life?: number; additive?: boolean;
  opacity?: number; rot?: number; grow?: number; fadeIn?: number; y?: number;
}

export interface TelegraphOpts {
  shape?: 'circle' | 'sector' | 'rect';
  pos: XZ; dir?: XZ;
  radius?: number; angle?: number;       // круг и сектор
  length?: number; width?: number;       // прямоугольник
  time?: number;                         // через сколько секунд удар (заливка дойдёт до края)
  color?: THREE.ColorRepresentation;
}

export interface TextOpts { color?: string; size?: number; crit?: boolean; life?: number; rise?: number }

/** Всплывающий текст (урон и т. п.) — обычный HTML-элемент поверх канваса. */
interface PopupText { el: HTMLDivElement; x: number; y: number; z: number; life: number; maxLife: number; rise: number; vx: number }

export class FX {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  private glowParticles: Particles;   // светящиеся (складываются со сценой)
  private solidParticles: Particles;  // обычные (пыль, щепки, кости)
  private items: TimedItem[] = [];
  private texts: PopupText[] = [];
  private textLayer: HTMLElement;
  /** Плоский квадрат 1×1 на полу — общий для всех декалей и колец. */
  readonly floorQuad: THREE.BufferGeometry;

  // управление временем и камерой
  private shakeAmount = 0;
  private hitstopTime = 0;   // сколько ещё секунд игра стоит (стоп-кадр при ударе)
  slowTime = 0;              // сколько ещё секунд длится замедление
  slowScale = 1;             // во сколько раз замедлено

  private tmpColor = new THREE.Color();
  private tmpVec = new THREE.Vector3();
  /** Образцы всех эффектов для прогрева шейдеров; хранятся всю игру, чтобы шейдеры не удалялись (см. prewarm). */
  keepAlive: THREE.Group | null = null;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    createTextures();
    this.scene = scene; this.camera = camera;
    this.glowParticles = new Particles(scene, 2500, true);
    this.solidParticles = new Particles(scene, 1200, false);
    this.textLayer = document.getElementById('fxLayer')!;
    this.floorQuad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  }

  /** Размер частиц зависит от высоты экрана и угла обзора камеры. */
  setScreen(h: number, fov: number) {
    const s = h / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
    this.glowParticles.material.uniforms.uScale.value = s;
    this.solidParticles.material.uniforms.uScale.value = s;
  }

  /**
   * Компилирует все шейдеры эффектов (и объектов extra) один раз при загрузке.
   *
   * Зачем: короткие эффекты удаляют свои материалы, а когда пропадает последний материал
   * с данным шейдером, three.js выбрасывает и скомпилированную программу — и следующий взмах
   * мечом компилировал её заново прямо в бою (это и были подлагивания). Образцы, созданные здесь,
   * никогда не удаляются, поэтому каждая программа живёт всю игру.
   *
   * Рисуем образцы один раз внутри настоящей сцены (те же источники света) и в текстуру
   * пост-обработки target (те же настройки цвета, что и каждый кадр) — иначе скомпилируется
   * другой вариант шейдера. Заодно все модели загружаются в видеокарту заранее.
   */
  prewarm(renderer: THREE.WebGLRenderer, camera: THREE.Camera, extra: THREE.Object3D[], target: THREE.WebGLRenderTarget) {
    const keep = new THREE.Group();
    keep.add(
      new THREE.Mesh(this.floorQuad, telegraphMaterial(0xffffff, 0, 1)),
      new THREE.Mesh(this.floorQuad, slashMaterial(0xffffff)),
      new THREE.Mesh(this.floorQuad, streakMaterial(0xffffff, 1)),
      ...extra,
    );
    keep.traverse((o) => { o.frustumCulled = false; });
    const prev = renderer.getRenderTarget();
    this.scene.add(keep);
    renderer.setRenderTarget(target);
    renderer.compile(this.scene, camera);
    renderer.render(this.scene, camera);
    renderer.setRenderTarget(prev);
    this.scene.remove(keep);
    this.keepAlive = keep;
  }

  // ---------- частицы ----------

  burst(p: XYZ, o: BurstOpts = {}) {
    const {
      count = 10, color = 0xffffff, speed = 3, life = 0.5, size = 0.25, gravity = 6, up = 2, spread = 1,
      additive = true, drag = 2, dir = null, jitter = 0.1, colorVar = 0,
    } = o;
    const sys = additive ? this.glowParticles : this.solidParticles;
    const c = this.tmpColor.set(color);
    for (let i = 0; i < count; i++) {
      let vx, vz;
      if (dir) {
        const a = Math.atan2(dir.x, dir.z) + (Math.random() - 0.5) * spread;
        const sp = speed * (0.4 + Math.random() * 0.8);
        vx = Math.sin(a) * sp; vz = Math.cos(a) * sp;
      } else {
        const a = Math.random() * Math.PI * 2; const sp = speed * (0.3 + Math.random() * 0.9);
        vx = Math.cos(a) * sp; vz = Math.sin(a) * sp;
      }
      let cc = c;
      if (colorVar) { cc = this.tmpColor.clone().offsetHSL((Math.random() - 0.5) * colorVar, 0, (Math.random() - 0.5) * colorVar); }
      sys.spawn(p.x + (Math.random() - 0.5) * jitter, (p.y ?? 0.5) + (Math.random() - 0.5) * jitter, p.z + (Math.random() - 0.5) * jitter,
        vx, up * (0.5 + Math.random()), vz, cc, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.8), gravity, drag);
    }
  }

  /** Искры при попадании. */
  spark(p: XYZ, color: THREE.ColorRepresentation, n = 8, speed = 6) { this.burst(p, { count: n, color, speed, life: 0.3, size: 0.14, gravity: 10, up: 3, drag: 3 }); }

  // ---------- временные объекты ----------

  /** Добавить объект на life секунд; update вызывается каждый кадр. */
  timed(obj: THREE.Object3D, life: number, update?: TimedItem['update'], onEnd?: () => void): TimedItem {
    this.scene.add(obj);
    const it: TimedItem = { obj, life, maxLife: life, update, onEnd };
    this.items.push(it);
    return it;
  }
  /** Убрать эффект досрочно. */
  kill(it: TimedItem | null | undefined) { if (it) it.life = 0; }

  /** Картинка, лежащая на полу (подпалина, свечение, пентаграмма). */
  decal(p: XZ, { tex = TEX.glow, size = 1, color = 0xffffff, life = 1, additive = true, opacity = 1, rot = 0, grow = 0, fadeIn = 0, y = 0.02 }: DecalOpts = {}) {
    const m = new THREE.MeshBasicMaterial({
      map: tex, color, transparent: true, depthWrite: false, opacity,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(this.floorQuad, m);
    mesh.position.set(p.x, y, p.z);
    mesh.rotation.y = rot;
    mesh.scale.setScalar(size);
    mesh.renderOrder = 5;
    return this.timed(mesh, life, (_dt, it) => {
      const k = 1 - it.life / it.maxLife;
      const fade = fadeIn > 0 ? Math.min(1, (it.maxLife - it.life) / fadeIn) : 1;
      m.opacity = opacity * fade * Math.min(1, it.life / Math.min(0.6, it.maxLife * 0.6));
      if (grow) mesh.scale.setScalar(size * (1 + grow * k));
    }, () => m.dispose());
  }

  /** Расходящееся кольцо-волна на полу. */
  ring(p: XZ, { radius = 2, color = 0xffffff as THREE.ColorRepresentation, life = 0.4, y = 0.05, width = 1 } = {}) {
    const m = new THREE.MeshBasicMaterial({ map: TEX.ring, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(this.floorQuad, m);
    mesh.position.set(p.x, y, p.z);
    mesh.renderOrder = 6;
    return this.timed(mesh, life, (_dt, it) => {
      const k = 1 - it.life / it.maxLife;
      const e = 1 - Math.pow(1 - k, 3);
      mesh.scale.setScalar(Math.max(0.01, radius * 2 * e * 1.15));
      m.opacity = (1 - k) * width;
    }, () => m.dispose());
  }

  /** Зона опасности на полу перед атакой врага. Заливка доходит до края за time секунд. */
  telegraph({ shape = 'circle', pos, dir = { x: 0, z: 1 }, radius = 1, angle = 1, length = 3, width = 1, time = 0.6, color = 0xff2a2a }: TelegraphOpts) {
    const mat = telegraphMaterial(color, shape === 'circle' ? 0 : shape === 'sector' ? 1 : 2, angle / 2);
    // прямоугольник тянется вперёд от врага, поэтому у него своя геометрия
    const geo = shape === 'rect'
      ? new THREE.PlaneGeometry(width, length).rotateX(-Math.PI / 2).translate(0, 0, -length / 2)
      : this.floorQuad;
    const mesh = new THREE.Mesh(geo, mat);
    // у плоскости после rotateX(-PI/2) верх текстуры смотрит в -Z; разворачиваем, чтобы «вперёд» = dir
    mesh.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
    if (shape !== 'rect') mesh.scale.setScalar(radius * 2);
    mesh.position.set(pos.x, 0.03, pos.z);
    mesh.renderOrder = 4;
    const it = this.timed(mesh, time + 0.12, (_dt, it) => {
      const k = Math.min(1, (it.maxLife - it.life) / time);
      mat.uniforms.uProg.value = k;
      mat.uniforms.uAlpha.value = it.life < 0.12 ? it.life / 0.12 : Math.min(1, (it.maxLife - it.life) * 8);
    }, () => { mat.dispose(); if (geo !== this.floorQuad) geo.dispose(); });
    it.mesh = mesh;
    return it;
  }

  /** След размашистого удара: дуга вокруг p, направленная в dir. */
  slash(p: XZ, dir: XZ, { radius = 1.8, inner = 0.4, angle = 2.2, color = 0xffffff as THREE.ColorRepresentation, life = 0.22, y = 0.55, flip = false, tilt = 0 } = {}) {
    const geo = slashGeometry(inner, radius, angle);
    const mat = slashMaterial(color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, y, p.z);
    mesh.rotation.y = Math.atan2(dir.x, dir.z);
    if (flip) mesh.scale.x = -1; // удар в обратную сторону
    mesh.rotation.z = tilt;
    mesh.renderOrder = 22;
    return this.timed(mesh, life, (_dt, it) => {
      const k = 1 - it.life / it.maxLife;
      mat.uniforms.uSweep.value = Math.min(1, k * 2.6);
      mat.uniforms.uT.value = Math.max(0, (k - 0.35) / 0.65);
    }, () => { geo.dispose(); mat.dispose(); });
  }

  /** Росчерк укола: узкий клин вперёд. */
  stab(p: XZ, dir: XZ, { length = 1.8, width = 0.5, color = 0xffffff as THREE.ColorRepresentation, life = 0.16, y = 0.55 } = {}) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0); shape.lineTo(0, length); shape.lineTo(width / 2, 0); shape.lineTo(0, -0.15);
    const geo = new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2);
    const mat = streakMaterial(color, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, y, p.z);
    mesh.rotation.y = Math.atan2(dir.x, dir.z);
    mesh.renderOrder = 22;
    return this.timed(mesh, life, (_dt, it) => {
      const k = 1 - it.life / it.maxLife;
      mesh.scale.set(1 - k * 0.6, 1, 0.6 + k * 0.6);
      mat.opacity = 1 - k;
    }, () => { geo.dispose(); mat.dispose(); });
  }

  /** Ломаная лента молнии через точки (широкое свечение + белая сердцевина). */
  bolt(points: THREE.Vector3[], { color = 0xa57bff as THREE.ColorRepresentation, life = 0.22, width = 0.22, jag = 0.35 } = {}) {
    // разбиваем отрезки на короткие куски и дёргаем их в стороны
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const segs = Math.max(3, Math.floor(a.distanceTo(b) / 0.35));
      for (let s = 0; s < segs; s++) {
        const q = a.clone().lerp(b, s / segs);
        if (s > 0) { q.x += (Math.random() - 0.5) * jag; q.z += (Math.random() - 0.5) * jag; q.y += (Math.random() - 0.5) * jag * 0.5; }
        pts.push(q);
      }
    }
    pts.push(points[points.length - 1].clone());
    const ribbon = (w: number, col: THREE.ColorRepresentation, opacity: number) => {
      const pos: number[] = [], idx: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], next = pts[Math.min(pts.length - 1, i + 1)], prev = pts[Math.max(0, i - 1)];
        const d = next.clone().sub(prev); d.y = 0; d.normalize();
        const side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(w / 2);
        pos.push(p.x - side.x, p.y + 0.02, p.z - side.z, p.x + side.x, p.y + 0.02, p.z + side.z);
        if (i < pts.length - 1) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      return new THREE.Mesh(g, streakMaterial(col, opacity));
    };
    const group = new THREE.Group();
    const glow = ribbon(width * 3, color, 0.45), core = ribbon(width * 0.7, 0xffffff, 1);
    group.add(glow, core);
    group.renderOrder = 23;
    return this.timed(group, life, (_dt, it) => {
      const k = it.life / it.maxLife;
      glow.material.opacity = 0.45 * k; core.material.opacity = k;
      core.visible = glow.visible = Math.random() > 0.15 || k > 0.7; // мерцание
    }, () => { for (const m of [glow, core]) { m.geometry.dispose(); m.material.dispose(); } });
  }

  /** Короткая круглая вспышка (спрайт, всегда повёрнут к камере). */
  flash(p: XYZ, { color = 0xffffff as THREE.ColorRepresentation, size = 1.5, life = 0.15, y = 0.6 } = {}) {
    const m = new THREE.SpriteMaterial({ map: TEX.glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(m);
    s.position.set(p.x, p.y ?? y, p.z); s.scale.setScalar(size); s.renderOrder = 25;
    return this.timed(s, life, (_dt, it) => {
      const k = it.life / it.maxLife; m.opacity = k; s.scale.setScalar(size * (1.2 - 0.4 * k));
    }, () => m.dispose());
  }

  // ---------- всплывающий текст ----------

  /** Число урона или короткое слово над точкой мира. Всплывает и гаснет. */
  text(p: XYZ, str: string, { color = '#fff', size = 22, crit = false, life = 0.75, rise = 1.2 }: TextOpts = {}) {
    const el = document.createElement('div');
    el.className = 'dmg' + (crit ? ' crit' : '');
    el.textContent = str;
    el.style.color = color;
    el.style.fontSize = size + 'px';
    this.textLayer.appendChild(el);
    this.texts.push({ el, x: p.x + (Math.random() - 0.5) * 0.3, y: (p.y ?? 1.2), z: p.z, life, maxLife: life, rise, vx: (Math.random() - 0.5) * 0.8 });
  }

  // ---------- время и камера ----------

  /** Тряска камеры (0..1). Берётся максимум из текущей и новой. */
  shake(amount: number) { this.shakeAmount = Math.min(1, Math.max(this.shakeAmount, amount)); }
  /** Стоп-кадр на ms миллисекунд — делает удар весомым. */
  hitstop(ms: number) { this.hitstopTime = Math.max(this.hitstopTime, ms / 1000); }
  /** Замедление времени на seconds реальных секунд. */
  slowmo(seconds: number, scale = 0.25) { this.slowTime = seconds; this.slowScale = scale; }

  /** Реальное время кадра → игровое (с учётом стоп-кадра и замедления). */
  gameDt(realDt: number) {
    if (this.hitstopTime > 0) { this.hitstopTime -= realDt; return 0; }
    if (this.slowTime > 0) { this.slowTime -= realDt; return realDt * this.slowScale; }
    return realDt;
  }

  /** Смещение камеры от тряски в момент t. */
  shakeOffset(t: number) {
    const a = this.shakeAmount * this.shakeAmount * 0.35;
    return { x: (Math.sin(t * 91) + Math.sin(t * 57)) * 0.5 * a, z: (Math.cos(t * 83) + Math.sin(t * 41)) * 0.5 * a };
  }

  /** dt — игровое время (эффекты замирают в стоп-кадре), realDt — реальное (текст и тряска). w×h — экран. */
  update(dt: number, realDt: number, w: number, h: number) {
    this.glowParticles.update(dt); this.solidParticles.update(dt);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.life <= 0) {
        this.scene.remove(it.obj); it.onEnd?.(); this.items.splice(i, 1); continue;
      }
      it.update?.(dt, it);
    }
    const v = this.tmpVec;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= realDt;
      if (t.life <= 0) { t.el.remove(); this.texts.splice(i, 1); continue; }
      const k = 1 - t.life / t.maxLife;
      v.set(t.x + t.vx * k, t.y + t.rise * (1 - Math.pow(1 - k, 2)), t.z).project(this.camera);
      const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
      // «выпрыгивает» в начале, потом чуть уменьшается
      const pop = k < 0.15 ? 0.6 + k / 0.15 * 0.7 : 1.3 - Math.min(0.3, (k - 0.15) * 1.5);
      t.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-50%) scale(${pop})`;
      t.el.style.opacity = String(t.life < 0.25 ? t.life / 0.25 : 1);
    }
    this.shakeAmount = Math.max(0, this.shakeAmount - realDt * 2.2);
  }
}
