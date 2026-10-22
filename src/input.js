// Floating virtual joystick (appears under the finger) + keyboard fallback.
export class Input {
  constructor(el) {
    this.el = el;
    this.x = 0; this.y = 0;      // -1..1, y = down-screen
    this.mag = 0;
    this.touching = false;
    this.onFirstInput = null;
    this.enabled = true;
    this.keys = new Set();
    this.pid = null;
    this.radius = 60;

    const base = document.createElement('div');
    base.className = 'joy-base';
    const knob = document.createElement('div');
    knob.className = 'joy-knob';
    base.appendChild(knob);
    document.getElementById('app').appendChild(base);
    this.base = base; this.knob = knob;

    el.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.moveEv(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    window.addEventListener('keydown', (e) => { this.keys.add(e.code); this.first(); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.release(); });
  }

  first() {
    if (this.onFirstInput) { const f = this.onFirstInput; this.onFirstInput = null; f(); }
  }

  down(e) {
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

  moveEv(e) {
    if (e.pointerId !== this.pid) return;
    let dx = e.clientX - this.ox, dy = e.clientY - this.oy;
    const d = Math.hypot(dx, dy);
    const R = this.radius;
    if (d > R) {
      // drag the base along so direction changes stay instant (feels better than a hard clamp)
      const k = (d - R) / d;
      this.ox += dx * k; this.oy += dy * k;
      dx = e.clientX - this.ox; dy = e.clientY - this.oy;
      this.base.style.left = this.ox - R + 'px';
      this.base.style.top = this.oy - R + 'px';
    }
    this.setKnob(dx, dy);
  }

  setKnob(dx, dy) {
    const R = this.radius;
    const d = Math.hypot(dx, dy);
    const dead = R * 0.12;
    if (d < dead) { this.x = 0; this.y = 0; this.mag = 0; }
    else {
      const m = Math.min(1, (d - dead) / (R * 0.6 - dead));
      this.x = dx / d * m; this.y = dy / d * m; this.mag = m;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  up(e) {
    if (e.pointerId !== this.pid) return;
    this.release();
  }

  release() {
    this.pid = null;
    this.touching = false;
    this.x = 0; this.y = 0; this.mag = 0;
    this.base.classList.remove('on');
  }

  /** Returns current move vector {x, y, mag}. Keyboard overrides when used. */
  read() {
    if (!this.enabled) return { x: 0, y: 0, mag: 0 };
    let kx = 0, ky = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) kx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) kx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) ky -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) ky += 1;
    if (kx || ky) { const l = Math.hypot(kx, ky); return { x: kx / l, y: ky / l, mag: 1 }; }
    return { x: this.x, y: this.y, mag: this.mag };
  }
}
