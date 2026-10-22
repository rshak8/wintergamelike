import * as THREE from 'three';

const ease = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

// Action poses. t in 0..1. Return partial pose: aR/aL = arm {x,z}, bx/by = body lean/twist, dy = body height,
// p = weapon pitch (0 = along arm), sq = squash, lean = forward root offset (entity applies)
export const ACTIONS = {
  stab: {
    dur: 0.3, pose(t) {
      const w = seg(t, 0, 0.3), s = seg(t, 0.3, 0.45), r = seg(t, 0.55, 1);
      const ax = lerp(lerp(-0.4, 0.5, ease.out(w)), -1.62, ease.out(s));
      return { aR: { x: lerp(ax, -0.5, ease.inOut(r)), z: 0.15 }, aL: { x: lerp(0.3, 0.6, s) * (1 - r), z: -0.2 }, bx: lerp(lerp(-0.08, 0.32, s), 0.05, r), by: lerp(lerp(0.25, -0.3, s), 0, r), p: lerp(lerp(-1.7, -0.1, ease.out(w + s)), -1.7, r), lean: s * (1 - r) };
    },
  },
  jab: {
    dur: 0.16, pose(t, alt) {
      const s = seg(t, 0, 0.35), r = seg(t, 0.45, 1);
      const arm = { x: lerp(lerp(-0.2, -1.65, ease.out(s)), -0.5, r), z: 0.1 };
      const rest = { x: -0.3, z: -0.1 };
      return alt ? { aL: arm, aR: rest, by: lerp(-0.35, 0, r), bx: 0.2 * (1 - r), p: lerp(-0.2, -1.6, r), lean: s * (1 - r) }
        : { aR: arm, aL: rest, by: lerp(0.35, 0, r), bx: 0.2 * (1 - r), p: lerp(-0.2, -1.6, r), lean: s * (1 - r) };
    },
  },
  slash: {
    dur: 0.36, pose(t) {
      const w = seg(t, 0, 0.28), s = seg(t, 0.28, 0.5), r = seg(t, 0.6, 1);
      const tw = lerp(lerp(0, 1.15, ease.out(w)), -1.2, ease.out(s));
      return { aR: { x: lerp(-1.3, -0.5, r), z: lerp(lerp(0.2, 1.0, w), 0.2, s) }, aL: { x: 0.3, z: -0.3 }, by: lerp(tw, 0, ease.inOut(r)), bx: 0.2 * s * (1 - r), p: lerp(-0.25, -1.7, r), lean: s * (1 - r) * 0.8, dy: -0.04 * s * (1 - r) };
    },
  },
  slam: {
    dur: 0.62, pose(t) {
      const w = seg(t, 0, 0.42), s = seg(t, 0.42, 0.55), r = seg(t, 0.7, 1);
      const ax = lerp(lerp(-0.4, -2.9, ease.out(w)), -1.1, ease.in(s));
      return { aR: { x: lerp(ax, -0.4, r), z: 0.05 }, aL: { x: lerp(ax, -0.3, r), z: -0.05 }, bx: lerp(lerp(0, -0.35, w), 0.45, s) * (1 - r), dy: lerp(lerp(0, 0.06, w), -0.12, s) * (1 - r), p: lerp(-0.2, -1.8, r), sq: s * (1 - r) * 0.18, lean: s * (1 - r) * 0.6 };
    },
  },
  shoot: {
    dur: 0.24, pose(t) {
      const r = seg(t, 0.25, 1);
      const rec = Math.sin(seg(t, 0, 0.35) * Math.PI) * 0.25;
      return { aR: { x: -1.5 + rec, z: 0.0 }, aL: { x: lerp(-1.45, -0.9, r), z: -0.35 }, bx: -0.08 * (1 - r), by: 0.3, p: 0 };
    },
  },
  cast: {
    dur: 0.3, pose(t) {
      const w = seg(t, 0, 0.35), s = seg(t, 0.35, 0.55), r = seg(t, 0.6, 1);
      return { aR: { x: lerp(lerp(-0.8, -2.3, ease.out(w)), -1.45, ease.out(s)) * (1 - r) + -0.7 * r, z: 0.1 }, aL: { x: lerp(-0.2, 0.4, s), z: -0.2 }, bx: lerp(-0.1, 0.25, s) * (1 - r), p: lerp(-0.4, 0, w) * (1 - r) + -2.2 * r, lean: s * (1 - r) * 0.3 };
    },
  },
  hit: {
    dur: 0.26, pose(t) {
      const k = Math.sin(seg(t, 0, 1) * Math.PI);
      return { bx: -0.35 * k, sq: -0.14 * k, aR: { x: 0.4 * k - 0.4, z: 0.4 * k }, aL: { x: 0.4 * k - 0.2, z: -0.4 * k } };
    },
  },
  // enemy moves
  windup: { dur: 9, pose(t) { return { aR: { x: 0.9, z: 0.5 }, by: 0.6, bx: -0.15, p: -1.2, dy: -0.03 }; } },
  thrustE: {
    dur: 0.35, pose(t) {
      const s = seg(t, 0, 0.25), r = seg(t, 0.5, 1);
      return { aR: { x: lerp(lerp(0.9, -1.6, ease.out(s)), -0.5, r), z: 0.1 }, by: lerp(lerp(0.6, -0.2, s), 0, r), bx: 0.3 * s * (1 - r), p: lerp(-0.1, -1.6, r), lean: s * (1 - r) };
    },
  },
  slashE: {
    dur: 0.4, pose(t) {
      const s = seg(t, 0, 0.3), r = seg(t, 0.5, 1);
      return { aR: { x: lerp(-1.3, -0.5, r), z: lerp(1.1, 0.2, s) }, by: lerp(lerp(1.2, -1.3, ease.out(s)), 0, r), bx: 0.15, p: lerp(-0.2, -1.6, r), dy: -0.04 * s * (1 - r) };
    },
  },
  aim: { dur: 9, pose(t) { return { aR: { x: -1.5, z: 0 }, aL: { x: -1.2, z: -0.5 }, by: 0.35, bx: -0.05, p: 0 }; } },
  channel: { dur: 9, pose(t, a, time) { const b = Math.sin(time * 10) * 0.08; return { aR: { x: -2.6 + b, z: 0.3 }, aL: { x: -2.6 - b, z: -0.3 }, bx: -0.2, dy: 0.04, p: 0 }; } },
  castE: {
    dur: 9, pose(t, a, time) { const b = Math.sin(time * 14) * 0.06; return { aR: { x: -1.9 + b, z: 0.2 }, aL: { x: -0.6, z: -0.5 }, bx: -0.15, p: 0 }; },
  },
  throwE: {
    dur: 0.35, pose(t) { const s = seg(t, 0, 0.3), r = seg(t, 0.4, 1); return { aR: { x: lerp(-2.4, -1.2, ease.out(s)) * (1 - r) - 0.4 * r, z: 0.2 }, bx: 0.3 * s * (1 - r), p: 0, lean: 0.4 * s * (1 - r) }; },
  },
  raise: { dur: 9, pose(t, a, time) { const b = Math.sin(time * 18) * 0.05; return { aR: { x: -2.9 + b, z: 0.1 }, aL: { x: -2.7 - b, z: -0.2 }, bx: -0.3, dy: 0.06, p: 0 }; } },
  stomp: {
    dur: 0.5, pose(t) { const s = seg(t, 0, 0.25), r = seg(t, 0.4, 1); return { aR: { x: lerp(-2.9, -0.8, ease.in(s)) * (1 - r) - 0.4 * r, z: 0.1 }, aL: { x: lerp(-2.7, -0.6, ease.in(s)) * (1 - r), z: -0.2 }, bx: lerp(-0.3, 0.5, s) * (1 - r), dy: -0.12 * s * (1 - r), sq: 0.2 * s * (1 - r), p: lerp(0, -1.4, r) }; },
  },
  spin: { dur: 9, pose(t, a, time) { return { aR: { x: -1.5, z: 1.3 }, aL: { x: -1.5, z: -1.3 }, by: time * 22, p: 0 }; } },
  roar: { dur: 1.0, pose(t) { const k = Math.sin(seg(t, 0, 1) * Math.PI); return { aR: { x: -0.6 * k, z: 1.2 * k }, aL: { x: -0.6 * k, z: -1.2 * k }, bx: -0.4 * k, hx: -0.5 * k }; } },
};

export class Rig {
  constructor(root, prefix) {
    this.root = root;
    const get = (n) => root.getObjectByName(prefix + '_' + n);
    this.body = get('Body'); this.head = get('Head');
    this.armL = get('ArmL'); this.armR = get('ArmR');
    this.legL = get('LegL'); this.legR = get('LegR');
    this.cape = get('Cape'); this.handR = get('HandR'); this.handL = get('HandL');
    this.rest = new Map();
    for (const p of [this.body, this.head, this.armL, this.armR, this.legL, this.legR, this.cape]) {
      if (p) this.rest.set(p, { pos: p.position.clone(), rot: p.rotation.clone() });
    }
    this.phase = 0; this.move = 0; this.time = Math.random() * 10;
    this.action = null; this.at = 0; this.alt = false;
    this.squash = 0; this.squashV = 0;
    this.pitch = -1.7; // weapon idle pitch
    this.idlePitch = -1.7;
    this.armRestR = -0.35; this.armRestL = -0.1;
    this.lean = 0;
    this.holder = null;
  }

  play(name, alt = false) {
    this.action = ACTIONS[name]; this.actionName = name; this.at = 0; this.alt = alt;
  }
  hold(name) { if (this.actionName !== name) this.play(name); }
  stop() { this.action = null; this.actionName = null; }
  punch(amount) { this.squashV += amount; }

  /** Attach a weapon object to the right hand with a holder for pitch animation. basis: 'blade' | 'bow' | 'orb' */
  attach(obj, basis = 'blade', hand = 'R') {
    const h = hand === 'R' ? this.handR : this.handL;
    if (!h) return;
    if (this.holder) this.holder.parent?.remove(this.holder);
    const holder = new THREE.Group();
    h.add(holder);
    if (basis === 'blade') obj.rotation.set(Math.PI, 0, 0);
    else if (basis === 'bow') {
      const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0));
      obj.quaternion.setFromRotationMatrix(m);
    } else if (basis === 'orb') { obj.position.set(0, -0.12, 0.08); }
    holder.add(obj);
    this.holder = holder; this.weapon = obj; this.basis = basis;
  }

  update(dt, speed01) {
    this.time += dt;
    this.move += (Math.min(1, speed01) - this.move) * Math.min(1, dt * 12);
    this.phase += dt * (6 + 8 * this.move) * (this.move > 0.05 ? 1 : 0);
    const mv = this.move;
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    let pose = null;
    if (this.action) {
      this.at += dt;
      const t = Math.min(1, this.at / this.action.dur);
      pose = this.action.pose(t, this.alt, this.time);
      if (t >= 1 && this.action.dur < 5) { this.action = null; this.actionName = null; }
    }
    pose = pose || {};
    const R = this.rest;
    // legs
    if (this.legL) {
      this.legL.rotation.x = R.get(this.legL).rot.x + s * 0.75 * mv;
      this.legR.rotation.x = R.get(this.legR).rot.x - s * 0.75 * mv;
    }
    // body
    if (this.body) {
      const rb = R.get(this.body);
      const bob = Math.abs(c) * 0.045 * mv + Math.sin(this.time * 2.2) * 0.008 * (1 - mv);
      this.body.position.y = rb.pos.y + bob + (pose.dy || 0);
      this.body.rotation.x = rb.rot.x + 0.14 * mv + (pose.bx || 0);
      this.body.rotation.y = rb.rot.y + (pose.by || 0) + s * 0.08 * mv;
      this.body.rotation.z = rb.rot.z + c * 0.03 * mv;
    }
    if (this.head) {
      const rh = R.get(this.head);
      this.head.rotation.x = rh.rot.x - 0.08 * mv + Math.sin(this.time * 2.2 + 1) * 0.02 + (pose.hx || 0);
      this.head.rotation.y = rh.rot.y - (pose.by || 0) * 0.35;
    }
    // arms
    const swing = s * 0.6 * mv;
    if (this.armR) {
      const ar = pose.aR || { x: this.armRestR - swing * 0.6, z: 0.08 };
      this.armR.rotation.x = ar.x; this.armR.rotation.z = R.get(this.armR).rot.z + ar.z;
    }
    if (this.armL) {
      const al = pose.aL || { x: this.armRestL + swing, z: -0.08 };
      this.armL.rotation.x = al.x; this.armL.rotation.z = R.get(this.armL).rot.z + al.z;
    }
    if (this.cape) {
      const rc = R.get(this.cape);
      this.cape.rotation.x = rc.rot.x + 0.15 + mv * 0.55 + Math.sin(this.time * 9) * 0.06 * (0.3 + mv);
    }
    // weapon pitch
    if (this.holder) {
      const target = pose.p !== undefined ? pose.p : this.idlePitch;
      this.pitch += (target - this.pitch) * Math.min(1, dt * (pose.p !== undefined ? 40 : 14));
      this.holder.rotation.x = this.basis === 'blade' ? this.pitch : 0;
    }
    this.lean = pose.lean || 0;
    // squash spring
    this.squashV += (-this.squash * 220 - this.squashV * 16) * dt;
    this.squash += this.squashV * dt;
    const sq = this.squash + (pose.sq || 0);
    this.root.scale.set(this.baseScale * (1 + sq * 0.6), this.baseScale * (1 - sq), this.baseScale * (1 + sq * 0.6));
  }
}
