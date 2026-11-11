// Плавающий виртуальный джойстик: появляется там, где палец коснулся экрана.

/** Направление движения: x/y от -1 до 1 (y — вниз по экрану), mag — сила наклона 0..1. */
export interface MoveInput { x: number; y: number; mag: number }

export class Input {
  enabled = true;
  /** Срабатывает один раз при первом касании. */
  onFirstInput: (() => void) | null = null;

  // текущее направление
  x = 0; y = 0; mag = 0;
  touching = false;

  private pointerId: number | null = null;
  radius = 60;                 // радиус основания джойстика, px
  private originX = 0;         // центр основания на экране
  private originY = 0;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private out: MoveInput = { x: 0, y: 0, mag: 0 };

  constructor(touchArea: HTMLElement) {
    const base = document.createElement('div');
    base.className = 'joy-base';
    const knob = document.createElement('div');
    knob.className = 'joy-knob';
    base.appendChild(knob);
    document.getElementById('app')!.appendChild(base);
    this.base = base; this.knob = knob;

    touchArea.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    window.addEventListener('blur', () => this.release());
  }

  /** Текущее направление. Возвращает один и тот же объект — читайте сразу. */
  read(): MoveInput {
    const o = this.out;
    if (!this.enabled) { o.x = 0; o.y = 0; o.mag = 0; }
    else { o.x = this.x; o.y = this.y; o.mag = this.mag; }
    return o;
  }

  private onDown(e: PointerEvent) {
    if (this.onFirstInput) { const f = this.onFirstInput; this.onFirstInput = null; f(); }
    if (!this.enabled || this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.originX = e.clientX; this.originY = e.clientY;
    // размер основания подстраивается под экран
    this.radius = Math.max(46, Math.min(70, Math.min(window.innerWidth, window.innerHeight) * 0.11));
    this.base.style.width = this.base.style.height = this.radius * 2 + 'px';
    this.base.style.left = this.originX - this.radius + 'px';
    this.base.style.top = this.originY - this.radius + 'px';
    this.base.classList.add('on');
    this.touching = true;
    this.setKnob(0, 0);
  }

  private onMove(e: PointerEvent) {
    if (e.pointerId !== this.pointerId) return;
    this.setKnob(e.clientX - this.originX, e.clientY - this.originY);
  }

  private onUp(e: PointerEvent) {
    if (e.pointerId !== this.pointerId) return;
    this.release();
  }

  /** Основание стоит на месте; стик не выходит за его край. Небольшая мёртвая зона в центре. */
  private setKnob(dx: number, dy: number) {
    const R = this.radius;
    const d = Math.hypot(dx, dy);
    const dead = R * 0.12;
    if (d < dead) { this.x = 0; this.y = 0; this.mag = 0; }
    else {
      // полная скорость уже на 60% радиуса
      const m = Math.min(1, (d - dead) / (R * 0.6 - dead));
      this.x = dx / d * m; this.y = dy / d * m; this.mag = m;
    }
    const k = d > R ? R / d : 1;
    this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }

  release() {
    this.pointerId = null;
    this.touching = false;
    this.x = 0; this.y = 0; this.mag = 0;
    this.base.classList.remove('on');
  }
}
