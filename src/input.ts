export interface MoveInput { x: number; y: number; mag: number }

// Floating virtual joystick (appears under the finger). Touch only: the game is phone-only.
export class Input {
  el: HTMLElement;
  x = 0; y = 0;      // -1..1, y = down-screen
  mag = 0;
  touching = false;
  onFirstInput: (() => void) | null = null;
  enabled = true;
  pid: number | null = null;
  radius = 60;
  ox = 0; oy = 0;    // joystick centre on screen
  base: HTMLDivElement;
  knob: HTMLDivElement;

  constructor(el: HTMLElement) {
    this.el = el;

    const base = document.createElement('div');
    base.className = 'joy-base';
    const knob = document.createElement('div');
    knob.className = 'joy-knob';
    base.appendChild(knob);
    document.getElementById('app')!.appendChild(base);
    this.base = base; this.knob = knob;

    el.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.moveEv(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    window.addEventListener('blur', () => this.release());
  }

  first() {
    if (this.onFirstInput) { const f = this.onFirstInput; this.onFirstInput = null; f(); }
  }

  down(e: PointerEvent) {
    this.first();
    if (!this.enabled || this.pid !== null) return;
    this.pid = e.pointerId;
    this.ox = e.clientX; this.oy = e.clientY;
    this.radius = Math.max(46, Math.min(70, Math.min(window.innerWidth, window.innerHeight) * 0.11));
    this.base.style.width = this.base.style.height = this.radius * 2 + 'px';
    this.base.style.left = this.ox - this.radius + 'px';
    this.base.style.top = this.oy - this.radius + 'px';
    this.base.classList.add('on');
    this.touching = true;
    this.setKnob(0, 0);
  }

  moveEv(e: PointerEvent) {
    if (e.pointerId !== this.pid) return;
    this.setKnob(e.clientX - this.ox, e.clientY - this.oy);
  }

  /** The base stays where the finger first touched; the knob never leaves the base's rim. */
  setKnob(dx: number, dy: number) {
    const R = this.radius;
    const d = Math.hypot(dx, dy);
    const dead = R * 0.12;
    if (d < dead) { this.x = 0; this.y = 0; this.mag = 0; }
    else {
      const m = Math.min(1, (d - dead) / (R * 0.6 - dead));
      this.x = dx / d * m; this.y = dy / d * m; this.mag = m;
    }
    const k = d > R ? R / d : 1;
    this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }

  up(e: PointerEvent) {
    if (e.pointerId !== this.pid) return;
    this.release();
  }

  release() {
    this.pid = null;
    this.touching = false;
    this.x = 0; this.y = 0; this.mag = 0;
    this.base.classList.remove('on');
  }

  private out: MoveInput = { x: 0, y: 0, mag: 0 };
  /** Current move vector {x, y, mag}. The same object is reused every call: read it right away. */
  read(): MoveInput {
    const o = this.out;
    if (!this.enabled) { o.x = 0; o.y = 0; o.mag = 0; }
    else { o.x = this.x; o.y = this.y; o.mag = this.mag; }
    return o;
  }
}
