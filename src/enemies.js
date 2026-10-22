import * as THREE from 'three';
import { cloneCharacter, clone } from './assets.js';
import { Rig } from './anim.js';
import { ENEMIES, CHAR_SCALE } from './config.js';
import { TEX } from './fx.js';
import { audio } from './audio.js';

const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const angTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const dirOf = (ang) => new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));

export class Enemy {
  constructor(G, type, x, z, room) {
    this.G = G; this.type = type; this.cfg = ENEMIES[type]; this.room = room;
    const rim = { warrior: 0xff6a5a, archer: 0x9aff7a, necro: 0xc07aff, healer: 0x7af0ff, king: 0xff4040, mimic: 0xffd040 }[type];
    const { root, fx } = cloneCharacter(this.cfg.model, rim, 0.35);
    this.obj = root; this.mfx = fx;
    G.scene.add(root);
    this.scale = CHAR_SCALE * this.cfg.scale;
    if (type !== 'mimic') {
      this.rig = new Rig(root, this.cfg.model);
      this.rig.baseScale = this.scale;
      if (this.cfg.weapon) {
        const w = clone(this.cfg.weapon);
        const basis = type === 'archer' ? 'bow' : type === 'necro' ? 'orb' : 'blade';
        this.rig.attach(w, basis);
        this.weaponObj = w;
        if (type === 'healer') { this.rig.idlePitch = -2.5; }
        if (type === 'archer') { this.rig.armRestR = -0.9; }
        if (type === 'king') { w.scale.setScalar(1.1); }
      }
    } else {
      root.scale.setScalar(this.scale);
      this.lid = root.getObjectByName('T_Mimic_Lid');
    }
    this.pos = new THREE.Vector3(x, 0, z);
    this.knock = new THREE.Vector3();
    this.moveDir = new THREE.Vector3();
    this.moveSpeed = 0;
    this.face = angTo(this.pos, G.player.pos);
    this.hp = this.maxHp = this.cfg.hp;
    this.radius = this.cfg.radius;
    this.state = 'spawn'; this.st = 0;
    this.cd = rnd(0.6, 1.4);
    this.spawning = true; this.targetable = false;
    this.status = { burn: 0, burnDps: 0, poison: 0, poisonDps: 0, slow: 0, slowMul: 1, stun: 0, tick: 0 };
    this.dead = false;
    this.flashT = 0;
    // shadow
    const sm = new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, depthWrite: false });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), sm);
    this.shadow.scale.setScalar(this.radius * 3);
    this.shadow.renderOrder = 2;
    G.scene.add(this.shadow);
    // hp bar (DOM)
    this.bar = null;
    if (type !== 'king') {
      this.bar = document.createElement('div'); this.bar.className = 'ehp'; this.bar.innerHTML = '<i></i>';
      document.getElementById('fxLayer').appendChild(this.bar);
      this.bar.style.display = 'none';
    }
    // spawn presentation
    if (type === 'mimic') { this.state = 'dormant'; this.spawning = false; }
    else {
      root.position.set(x, -1.2, z);
      G.fx.decal(this.pos, { tex: TEX.spawn, size: 1.8, color: rim, life: 1.1, fadeIn: 0.1, grow: 0.2 });
      G.fx.flash({ x, y: 0.3, z }, { color: rim, size: 2, life: 0.4 });
      audio.play('spawn');
    }
    this.rimColor = rim;
    this.hitCount = 0;
    this.aiT = 0;
    this.goal = null;
  }

  get player() { return this.G.player; }
  dist() { return this.pos.distanceTo(this.player.pos); }
  slowMul() { return this.status.slow > 0 ? this.status.slowMul : 1; }

  setState(s, t = 0) { this.state = s; this.st = t; }

  update(dt) {
    if (this.dead) return;
    const G = this.G;
    // status effects
    const s = this.status;
    s.tick -= dt;
    if (s.burn > 0) {
      s.burn -= dt;
      if (Math.random() < dt * 22) G.fx.burst({ x: this.pos.x + rnd(-0.2, 0.2), y: rnd(0.3, 0.9), z: this.pos.z + rnd(-0.2, 0.2) }, { count: 1, color: Math.random() < 0.5 ? 0xff6a1a : 0xffc040, speed: 0.3, life: 0.5, size: 0.3, gravity: -3, up: 0.5 });
    }
    if (s.poison > 0) {
      s.poison -= dt;
      if (Math.random() < dt * 10) G.fx.burst({ x: this.pos.x + rnd(-0.25, 0.25), y: rnd(0.2, 0.8), z: this.pos.z + rnd(-0.25, 0.25) }, { count: 1, color: 0x5cff46, speed: 0.2, life: 0.7, size: 0.2, gravity: -1.2, up: 0.4 });
    }
    if (s.slow > 0) {
      s.slow -= dt;
      if (Math.random() < dt * 8) G.fx.burst({ x: this.pos.x + rnd(-0.3, 0.3), y: rnd(0.2, 1.0), z: this.pos.z + rnd(-0.3, 0.3) }, { count: 1, color: 0xaef0ff, speed: 0.2, life: 0.6, size: 0.15, gravity: 1, up: 0.2 });
    }
    if (s.tick <= 0 && (s.burn > 0 || s.poison > 0)) {
      s.tick = 0.5;
      const d = (s.burn > 0 ? s.burnDps : 0) * 0.5 + (s.poison > 0 ? s.poisonDps : 0) * 0.5;
      G.damageEnemy(this, d, { dot: true, color: s.burn > 0 ? '#ff9a3a' : '#7aff5a' });
      if (this.dead) return;
    }
    // tint for status
    const tint = this.mfx.tint.value;
    if (s.slow > 0) tint.set(0.55, 0.85, 1.0, 0.45);
    else if (s.poison > 0) tint.set(0.4, 1.0, 0.3, 0.28 + Math.sin(G.time * 8) * 0.08);
    else if (s.burn > 0) tint.set(1.0, 0.45, 0.1, 0.25 + Math.sin(G.time * 14) * 0.1);
    else tint.set(0, 0, 0, 0);
    this.flashT -= dt;
    const f = Math.max(0, this.flashT / 0.1);
    this.mfx.flash.value.set(f * 1.6, f * 1.6, f * 1.6);

    // spawn rise
    if (this.state === 'spawn') {
      this.st += dt;
      const k = Math.min(1, this.st / 0.55);
      this.obj.position.set(this.pos.x, -1.2 * (1 - (1 - Math.pow(1 - k, 3))), this.pos.z);
      this.obj.rotation.y = this.face;
      this.rig?.update(dt, 0);
      if (k >= 1) {
        this.spawning = false; this.targetable = true; this.setState('idle');
        this.rig?.punch(2);
        G.fx.burst({ x: this.pos.x, y: 0.1, z: this.pos.z }, { count: 10, color: this.rimColor, speed: 2.5, life: 0.4, size: 0.2, gravity: 2, up: 2 });
      }
      this.syncShadow();
      return;
    }

    this.moveSpeed = 0;
    if (s.stun > 0) {
      s.stun -= dt;
      if (Math.random() < dt * 8) G.fx.burst({ x: this.pos.x + rnd(-0.3, 0.3), y: 1.25 * this.scale / CHAR_SCALE, z: this.pos.z + rnd(-0.3, 0.3) }, { count: 1, color: 0xffe066, speed: 0.6, life: 0.5, size: 0.2, gravity: 0, up: 0 });
      this.cleanupTele();
    } else {
      const sm = this.slowMul();
      this.brain(dt * sm, dt);
    }

    // movement
    const sm = this.slowMul();
    _v.copy(this.moveDir).multiplyScalar(this.moveSpeed * sm);
    this.pos.addScaledVector(_v, dt);
    this.pos.addScaledVector(this.knock, dt);
    this.knock.multiplyScalar(Math.exp(-dt * 9));
    // separation
    for (const o of G.enemies) {
      if (o === this || o.dead || o.state === 'dormant') continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz, rr = this.radius + o.radius;
      if (d2 < rr * rr && d2 > 1e-5) {
        const d = Math.sqrt(d2), push = (rr - d) * 0.5;
        this.pos.x += dx / d * push; this.pos.z += dz / d * push;
      }
    }
    G.world.collide(this.pos, this.radius);
    this.render(dt);
  }

  render(dt) {
    const speed01 = this.moveSpeed * this.slowMul() / Math.max(0.1, this.cfg.speed);
    this.rig?.update(dt * (this.status.slow > 0 ? 0.6 : 1), this.status.stun > 0 ? 0 : speed01);
    if (this.type !== 'mimic') {
      this.obj.position.copy(this.pos);
      const lean = (this.rig?.lean || 0) * 0.2;
      this.obj.position.x += Math.sin(this.face) * lean; this.obj.position.z += Math.cos(this.face) * lean;
      this.obj.rotation.y = this.face;
      if (this.status.stun > 0) this.obj.rotation.z = Math.sin(this.G.time * 20) * 0.08; else this.obj.rotation.z = 0;
    }
    this.syncShadow();
    if (this.bar) {
      if (this.hp < this.maxHp) {
        this.bar.style.display = 'block';
        const v = _a.set(this.pos.x, 1.35 * this.scale / CHAR_SCALE, this.pos.z).project(this.G.camera);
        this.bar.style.transform = `translate(${(v.x * 0.5 + 0.5) * this.G.W}px, ${(-v.y * 0.5 + 0.5) * this.G.H}px) translate(-50%,-50%)`;
        this.bar.firstChild.style.width = (this.hp / this.maxHp * 100) + '%';
      }
    }
  }

  syncShadow() { this.shadow.position.set(this.pos.x, 0.02, this.pos.z); }

  faceTo(ang, dt, rate = 10) {
    let d = ang - this.face; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.face += d * Math.min(1, dt * rate);
  }

  walkTo(target, speed, dt) {
    this.G.world.pathDir(this.pos, target, this.moveDir);
    this.moveSpeed = speed;
    if (this.moveDir.lengthSq() > 0.01) this.faceTo(Math.atan2(this.moveDir.x, this.moveDir.z), dt, 8);
  }

  cleanupTele() { if (this.tele) { this.G.fx.kill(this.tele); this.tele = null; } if (this.rig?.action?.dur > 5) this.rig.stop(); if (this.state !== 'idle' && this.state !== 'dormant') this.setState('idle'); }

  /** Find a floor cell at preferred distance from the player with line of sight. */
  pickSpot(minD, maxD, needLos = true) {
    const cells = this.G.world.floorCells(this.room);
    let best = null, bs = -1e9;
    for (let i = 0; i < 18; i++) {
      const c = cells[(Math.random() * cells.length) | 0];
      const d = c.distanceTo(this.player.pos);
      let s = -Math.abs(d - (minD + maxD) / 2) - c.distanceTo(this.pos) * 0.25;
      if (needLos && !this.G.world.los(c, this.player.pos)) s -= 5;
      if (s > bs) { bs = s; best = c; }
    }
    return best;
  }

  brain(dt, realDt) {
    const fn = BRAINS[this.type];
    fn && fn(this, dt, realDt);
  }

  onHurt(amount, info) {
    this.flashT = 0.1;
    this.rig?.punch(-1.6);
    if (this.type !== 'king' && this.type !== 'mimic' && !info.dot && Math.random() < 0.6 && !this.tele) this.rig?.play('hit');
    // healers flee harder when hit
    if (this.type === 'healer') this.goal = null;
  }

  destroy() {
    this.G.scene.remove(this.obj); this.G.scene.remove(this.shadow);
    this.bar?.remove();
    this.cleanupTele();
  }
}

// ----- telegraph helpers -----
function teleRect(e, len, width, time, color = 0xff2a2a) {
  return e.G.fx.telegraph({ shape: 'rect', pos: e.pos, dir: dirOf(e.face), length: len, width, time, color });
}

const BRAINS = {
  warrior(e, dt) {
    const G = e.G, P = e.player; const d = e.dist();
    e.st += dt; e.cd -= dt;
    switch (e.state) {
      case 'idle': case 'chase': {
        e.walkTo(P.pos, e.cfg.speed, dt);
        if (d < 1.0) e.moveSpeed = 0;
        if (e.cd <= 0 && d < 2.9 && G.world.los(e.pos, P.pos)) {
          e.face = angTo(e.pos, P.pos);
          if (d < 1.55) {
            e.setState('teleSlash'); e.rig.hold('windup'); audio.play('telegraph');
            e.tele = G.fx.telegraph({ shape: 'sector', pos: e.pos, dir: dirOf(e.face), radius: 1.75, angle: 2.3, time: 0.5 });
          } else {
            e.setState('teleThrust'); e.rig.hold('windup'); audio.play('telegraph');
            e.lockDir = dirOf(e.face);
            e.tele = teleRect(e, 3.0, 0.85, 0.6);
          }
        }
        break;
      }
      case 'teleSlash': {
        e.moveSpeed = 0;
        if (e.st > 0.5) {
          e.tele = null; e.rig.play('slashE'); audio.play('swing');
          G.fx.arc(e.pos, dirOf(e.face), { radius: 1.75, inner: 0.3, angle: 2.4, color: 0xff3a3a, life: 0.22 });
          if (d < 1.75 + P.radius && Math.abs(Math.atan2(Math.sin(angTo(e.pos, P.pos) - e.face), Math.cos(angTo(e.pos, P.pos) - e.face))) < 1.25) P.hurt(e.cfg.dmg, e.pos);
          e.setState('recover'); e.cd = rnd(1.2, 1.8);
        }
        break;
      }
      case 'teleThrust': {
        e.moveSpeed = 0;
        if (e.st < 0.35) { e.faceTo(angTo(e.pos, P.pos), dt, 6); e.lockDir = dirOf(e.face); if (e.tele) e.tele.mesh.rotation.y = e.face + Math.PI; }
        if (e.tele) e.tele.mesh.position.set(e.pos.x, 0.03, e.pos.z);
        if (e.st > 0.6) {
          e.tele = null; e.rig.play('thrustE'); audio.play('stab');
          e.setState('thrust'); e.hitDone = false;
          G.fx.thrust(e.pos.clone().addScaledVector(e.lockDir, 0.4), e.lockDir, { length: 2.4, width: 0.6, color: 0xff5a4a, life: 0.2 });
        }
        break;
      }
      case 'thrust': {
        e.moveDir.copy(e.lockDir); e.moveSpeed = 12;
        if (!e.hitDone && d < e.radius + P.radius + 0.7) {
          const ahead = _a.subVectors(P.pos, e.pos).dot(e.lockDir);
          if (ahead > -0.2) { e.hitDone = P.hurt(e.cfg.dmg, e.pos) || true; }
        }
        if (e.st > 0.2) { e.setState('recover'); e.cd = rnd(1.3, 1.9); }
        break;
      }
      case 'recover': {
        e.moveSpeed = 0;
        if (e.st > 0.55) e.setState('chase');
        break;
      }
      default: e.setState('chase');
    }
  },

  archer(e, dt) {
    const G = e.G, P = e.player; const d = e.dist();
    e.st += dt; e.cd -= dt;
    switch (e.state) {
      case 'idle': case 'move': {
        e.aiT -= dt;
        if (!e.goal || e.aiT <= 0 || e.pos.distanceTo(e.goal) < 0.4) { e.goal = e.pickSpot(4.2, 7); e.aiT = rnd(1.2, 2.2); }
        if (d < 3) e.goal = e.pickSpot(5, 8);
        e.walkTo(e.goal, e.cfg.speed, dt);
        if (e.cd <= 0 && d < 11 && G.world.los(e.pos, P.pos)) {
          e.setState('aim'); e.rig.hold('aim'); audio.play('telegraph');
          e.face = angTo(e.pos, P.pos);
          e.aimLen = rayLen(G, e.pos, dirOf(e.face), 14);
          e.tele = G.fx.telegraph({ shape: 'rect', pos: e.pos, dir: dirOf(e.face), length: e.aimLen, width: 0.12, time: 0.85, color: 0xff3030 });
          if (G.onArcherAim) G.onArcherAim(e);
        }
        break;
      }
      case 'aim': {
        e.moveSpeed = 0;
        const lockAt = 0.55;
        if (e.st < lockAt) {
          e.faceTo(angTo(e.pos, P.pos), dt, 14);
        }
        if (e.tele) {
          const L = rayLen(G, e.pos, dirOf(e.face), 14);
          e.tele.mesh.rotation.y = e.face + Math.PI;
          e.tele.mesh.position.set(e.pos.x, 0.03, e.pos.z);
          e.tele.mesh.scale.set(e.st > lockAt ? 2.2 : 1, 1, L / e.aimLen);
        }
        if (e.st > 0.85) {
          e.tele = null;
          e.rig.play('shoot'); audio.play('bowShot');
          const dir = dirOf(e.face);
          const hp = e.pos.clone().addScaledVector(dir, 0.4); hp.y = 0.55;
          G.shootEnemy('arrow', hp, dir, { speed: 15, dmg: e.cfg.dmg });
          e.setState('recover'); e.cd = rnd(1.5, 2.2);
        }
        break;
      }
      case 'recover': e.moveSpeed = 0; if (e.st > 0.35) e.setState('move'); break;
      default: e.setState('move');
    }
  },

  necro(e, dt, realDt) {
    const G = e.G, P = e.player; const d = e.dist();
    e.st += dt; e.cd -= dt;
    // floating orb glow
    if (e.weaponObj) e.weaponObj.rotation.y += realDt * 3;
    switch (e.state) {
      case 'idle': case 'move': {
        e.aiT -= dt;
        if (!e.goal || e.aiT <= 0 || e.pos.distanceTo(e.goal) < 0.4) { e.goal = e.pickSpot(4.5, 8); e.aiT = rnd(1.5, 2.6); }
        e.walkTo(e.goal, e.cfg.speed, dt);
        if (e.cd <= 0 && d < 10) {
          e.setState('cast'); e.rig.hold('castE'); audio.play('orbCast');
          e.face = angTo(e.pos, P.pos);
        }
        break;
      }
      case 'cast': {
        e.moveSpeed = 0;
        e.faceTo(angTo(e.pos, P.pos), dt, 8);
        if (e.weaponObj) e.weaponObj.scale.setScalar(1 + e.st * 1.2);
        if (Math.random() < dt * 30) G.fx.burst(e.rig.handR.getWorldPosition(new THREE.Vector3()), { count: 1, color: 0xb060ff, speed: 1.5, life: 0.3, size: 0.2, gravity: 0, up: 0.5 });
        if (e.st > 0.7) {
          e.rig.play('throwE');
          if (e.weaponObj) e.weaponObj.scale.setScalar(1);
          const target = P.pos.clone().addScaledVector(P.vel, 0.35);
          target.x += rnd(-0.4, 0.4); target.z += rnd(-0.4, 0.4);
          const from = e.pos.clone(); from.y = 0.9;
          G.shootEnemy('orb', from, null, { target, dmg: e.cfg.dmg, radius: 1.45, speed: 5.2 });
          e.setState('recover'); e.cd = rnd(2.4, 3.2);
        }
        break;
      }
      case 'recover': e.moveSpeed = 0; if (e.st > 0.4) e.setState('move'); break;
      default: e.setState('move');
    }
  },

  healer(e, dt, realDt) {
    const G = e.G, P = e.player;
    e.st += dt; e.cd -= dt;
    switch (e.state) {
      case 'idle': case 'flee': {
        e.aiT -= dt;
        if (!e.goal || e.aiT <= 0) { e.goal = hideSpot(e); e.aiT = rnd(0.8, 1.4); }
        if (e.pos.distanceTo(e.goal) > 0.35) e.walkTo(e.goal, e.cfg.speed, dt);
        else e.faceTo(angTo(e.pos, P.pos), dt, 5);
        if (e.cd <= 0) {
          const allies = G.enemies.filter((o) => o !== e && !o.dead && !o.spawning && o.hp < o.maxHp && o.pos.distanceTo(e.pos) < 8.5);
          if (allies.length) {
            e.setState('channel'); e.rig.hold('channel'); e.healTargets = allies;
            e.tele = G.fx.decal(e.pos, { tex: TEX.spawn, size: 2.2, color: 0x5aff9a, life: 0.9, fadeIn: 0.1, grow: 0.2 });
          } else e.cd = 0.5;
        }
        break;
      }
      case 'channel': {
        e.moveSpeed = 0;
        if (Math.random() < dt * 40) G.fx.burst({ x: e.pos.x + rnd(-0.4, 0.4), y: 0.1, z: e.pos.z + rnd(-0.4, 0.4) }, { count: 1, color: 0x6aff9a, speed: 0.2, life: 0.6, size: 0.22, gravity: -3, up: 1 });
        if (e.st > 0.8) {
          e.tele = null; audio.play('heal');
          const from = e.pos.clone(); from.y = 1.1;
          for (const o of e.healTargets) {
            if (o.dead) continue;
            const to = o.pos.clone(); to.y = 0.7;
            if (o.status.poison > 0) {
              G.fx.bolt([from, to], { color: 0x5a7a5a, life: 0.25, width: 0.08, jag: 0.15 });
              G.fx.text({ x: o.pos.x, y: 1.4, z: o.pos.z }, 'NO HEAL', { color: '#7aff5a', size: 16 });
              audio.play('healBlocked');
              continue;
            }
            G.fx.bolt([from, to], { color: 0x5aff9a, life: 0.35, width: 0.12, jag: 0.12 });
            const amt = Math.min(e.cfg.heal, o.maxHp - o.hp);
            o.hp += amt;
            G.fx.text({ x: o.pos.x, y: 1.4, z: o.pos.z }, '+' + Math.round(amt), { color: '#5aff9a', size: 20 });
            G.fx.burst({ x: o.pos.x, y: 0.6, z: o.pos.z }, { count: 10, color: 0x5aff9a, speed: 1.2, life: 0.6, size: 0.2, gravity: -2, up: 1.5 });
          }
          e.setState('flee'); e.cd = e.cfg.healEvery;
        }
        break;
      }
      default: e.setState('flee');
    }
  },

  mimic(e, dt, realDt) {
    const G = e.G, P = e.player; const d = e.dist();
    e.st += dt;
    const lid = e.lid;
    switch (e.state) {
      case 'dormant': {
        e.obj.position.copy(e.pos);
        // subtle breathing tell
        e.obj.scale.set(e.scale, e.scale * (1 + Math.sin(G.time * 3) * 0.015), e.scale);
        if (d < 2.2) {
          e.setState('reveal'); audio.play('mimic');
          e.face = angTo(e.pos, P.pos);
          G.fx.shake(0.4);
          G.fx.text({ x: e.pos.x, y: 1.6, z: e.pos.z }, 'MIMIC!', { color: '#ffd040', size: 30, crit: true, life: 1.1 });
          G.onMimicReveal?.(e);
        }
        return;
      }
      case 'reveal': {
        const k = Math.min(1, e.st / 0.7);
        e.obj.position.set(e.pos.x, Math.sin(k * Math.PI) * 1.2, e.pos.z);
        e.obj.rotation.y = e.face;
        lid.rotation.x = -Math.sin(e.st * 30) * 0.4 - 0.3;
        if (k >= 1) { e.targetable = true; e.setState('rest'); G.fx.ring(e.pos, { radius: 1.3, color: 0xffd040, life: 0.35 }); G.fx.shake(0.4); }
        return;
      }
      case 'rest': {
        e.obj.position.set(e.pos.x, 0, e.pos.z);
        lid.rotation.x = -0.15 - Math.abs(Math.sin(e.st * 6)) * 0.2;
        e.faceTo(angTo(e.pos, P.pos), dt, 6);
        if (e.st > 0.55) {
          e.hops = (e.hops || 0) + 1;
          if (e.hops % 4 === 0) { e.setState('bite'); }
          else {
            e.setState('hopTele');
            e.hopFrom = e.pos.clone();
            e.hopTo = P.pos.clone().addScaledVector(P.vel, 0.3);
            _v.subVectors(e.hopTo, e.hopFrom); if (_v.length() > 4.5) e.hopTo.copy(e.hopFrom).addScaledVector(_v.normalize(), 4.5);
            e.tele = G.fx.telegraph({ shape: 'circle', pos: e.hopTo, radius: 1.25, time: 0.75 });
          }
        }
        break;
      }
      case 'hopTele': {
        lid.rotation.x = -0.6;
        e.obj.scale.set(e.scale * 1.15, e.scale * 0.8, e.scale * 1.15);
        if (e.st > 0.25) { e.setState('hop'); e.obj.scale.setScalar(e.scale); }
        break;
      }
      case 'hop': {
        const k = Math.min(1, e.st / 0.5);
        e.pos.lerpVectors(e.hopFrom, e.hopTo, k);
        G.world.collide(e.pos, e.radius);
        e.obj.position.set(e.pos.x, Math.sin(k * Math.PI) * 1.6, e.pos.z);
        e.obj.rotation.x = Math.sin(k * Math.PI) * -0.4;
        lid.rotation.x = -0.9 * Math.sin(k * Math.PI);
        e.face = angTo(e.hopFrom, e.hopTo);
        e.obj.rotation.y = e.face;
        if (k >= 1) {
          e.tele = null; e.obj.rotation.x = 0;
          audio.play('slam'); G.fx.shake(0.5);
          G.fx.ring(e.pos, { radius: 1.4, color: 0xffd040, life: 0.35 });
          G.fx.burst({ x: e.pos.x, y: 0.1, z: e.pos.z }, { count: 16, color: 0x6a5a7a, speed: 3, life: 0.5, size: 0.3, gravity: 5, up: 2, additive: false });
          if (d < 1.25 + P.radius) P.hurt(e.cfg.dmg, e.pos);
          e.obj.scale.set(e.scale * 1.25, e.scale * 0.75, e.scale * 1.25);
          e.setState('rest');
        }
        return;
      }
      case 'bite': {
        e.walkTo(P.pos, e.cfg.speed * 1.5, dt);
        lid.rotation.x = -Math.abs(Math.sin(e.st * 18)) * 0.9;
        if (Math.sin(e.st * 18) > 0.95) audio.play('bite');
        if (d < e.radius + P.radius + 0.15) P.hurt(e.cfg.dmg, e.pos);
        if (e.st > 1.1) e.setState('rest');
        break;
      }
    }
    // mimic render (no rig)
    e.obj.position.x = e.pos.x; e.obj.position.z = e.pos.z;
    if (e.state !== 'hop') e.obj.position.y = Math.abs(Math.sin(e.st * 14)) * (e.state === 'bite' ? 0.25 : 0.05);
    e.obj.rotation.y = e.face;
    const sc = e.obj.scale; sc.x += (e.scale - sc.x) * Math.min(1, realDt * 10); sc.y += (e.scale - sc.y) * Math.min(1, realDt * 10); sc.z = sc.x;
  },

  king(e, dt, realDt) {
    const G = e.G, P = e.player; const d = e.dist();
    e.st += dt; e.cd -= dt;
    const p2 = e.hp < e.maxHp * 0.5;
    if (p2 && !e.enraged) {
      e.enraged = true; e.cleanupTele(); e.setState('roar'); e.rig.play('roar'); audio.play('roar');
      G.fx.shake(0.8); G.fx.ring(e.pos, { radius: 4, color: 0xff2020, life: 0.6 });
      G.fx.text({ x: e.pos.x, y: 2.4, z: e.pos.z }, 'ENRAGED!', { color: '#ff3a3a', size: 32, crit: true, life: 1.4 });
      e.mfx.rim.value.set(1.2, 0.15, 0.1);
    }
    if (e.enraged && Math.random() < realDt * 20) G.fx.burst({ x: e.pos.x + rnd(-0.5, 0.5), y: rnd(0.1, 1.4), z: e.pos.z + rnd(-0.5, 0.5) }, { count: 1, color: 0xff2a1a, speed: 0.3, life: 0.6, size: 0.3, gravity: -2.5, up: 0.5 });
    // contact damage
    if (d < e.radius + P.radius && e.state !== 'roar') P.hurt(1, e.pos);
    const spd = p2 ? 1.25 : 1;
    switch (e.state) {
      case 'idle': case 'walk': {
        e.walkTo(P.pos, e.cfg.speed * spd, dt);
        if (d < 1.6) e.moveSpeed = 0;
        if (e.cd <= 0) {
          const opts = ['wave', 'nova', 'charge'];
          if (p2 && (!e.lastSummon || G.time - e.lastSummon > 11)) opts.push('summon', 'summon');
          let pick; do { pick = opts[(Math.random() * opts.length) | 0]; } while (pick === e.lastAtk && opts.length > 1);
          e.lastAtk = pick;
          e.face = angTo(e.pos, P.pos);
          if (pick === 'wave') {
            e.setState('teleWave'); e.rig.hold('windup'); audio.play('telegraph');
            const n = p2 ? 5 : 3, spread = p2 ? 0.95 : 0.6;
            e.teles = [];
            for (let i = 0; i < n; i++) {
              const a = e.face + (i - (n - 1) / 2) * (spread / Math.max(1, (n - 1) / 2)) * 0.5;
              e.teles.push(G.fx.telegraph({ shape: 'rect', pos: e.pos, dir: dirOf(a), length: 7, width: 0.5, time: 0.65 }));
            }
          } else if (pick === 'nova') {
            e.setState('teleNova'); e.rig.hold('raise'); audio.play('telegraph');
            e.tele = G.fx.telegraph({ shape: 'circle', pos: e.pos, radius: 2.4, time: 0.75 });
          } else if (pick === 'charge') {
            e.setState('teleCharge'); e.rig.hold('windup'); audio.play('telegraph');
            e.lockDir = dirOf(e.face);
            e.chargeLen = Math.min(9, rayLen(G, e.pos, e.lockDir, 10) - 0.6);
            e.tele = G.fx.telegraph({ shape: 'rect', pos: e.pos, dir: e.lockDir, length: e.chargeLen, width: 1.5, time: 0.75 });
          } else {
            e.setState('summon'); e.rig.hold('raise'); audio.play('roar');
            e.lastSummon = G.time;
          }
        }
        break;
      }
      case 'teleWave': {
        e.moveSpeed = 0;
        if (e.st > 0.65) {
          e.teles = null; e.rig.play('slashE'); audio.play('slashFire');
          const n = p2 ? 5 : 3, spread = p2 ? 0.95 : 0.6;
          G.fx.arc(e.pos, dirOf(e.face), { radius: 2.4, inner: 0.5, angle: 2.6, color: 0xff2020, life: 0.25 });
          for (let i = 0; i < n; i++) {
            const a = e.face + (i - (n - 1) / 2) * (spread / Math.max(1, (n - 1) / 2)) * 0.5;
            const from = e.pos.clone().addScaledVector(dirOf(a), 0.8); from.y = 0.5;
            G.shootEnemy('crescent', from, dirOf(a), { speed: 8.5, dmg: 2 });
          }
          G.fx.shake(0.3);
          e.setState('recover'); e.cd = rnd(0.9, 1.4) / spd;
        }
        break;
      }
      case 'teleNova': {
        e.moveSpeed = 0;
        if (e.st > 0.75) {
          e.tele = null; e.rig.play('stomp'); audio.play('boom');
          G.fx.shake(0.8); G.fx.hitstop(50);
          G.fx.ring(e.pos, { radius: 2.6, color: 0xff3030, life: 0.4 });
          G.fx.decal(e.pos, { tex: TEX.scorch, size: 4, life: 3, additive: false, opacity: 0.8, rot: Math.random() * 6 });
          G.fx.burst({ x: e.pos.x, y: 0.1, z: e.pos.z }, { count: 24, color: 0x5a5060, speed: 4, life: 0.6, size: 0.35, gravity: 5, up: 3, additive: false });
          if (d < 2.4 + P.radius) P.hurt(3, e.pos);
          const rings = p2 ? 2 : 1;
          for (let r = 0; r < rings; r++) {
            const n = 14 + r * 4;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * TAU + r * 0.2;
              const from = e.pos.clone().addScaledVector(dirOf(a), 0.8); from.y = 0.5;
              G.shootEnemy('bullet', from, dirOf(a), { speed: 4.8 + r * 1.4, dmg: 1 });
            }
          }
          e.setState('recover'); e.cd = rnd(1.0, 1.5) / spd;
        }
        break;
      }
      case 'teleCharge': {
        e.moveSpeed = 0;
        if (e.st > 0.75) { e.tele = null; e.rig.hold('spin'); e.setState('charge'); e.chargeFrom = e.pos.clone(); audio.play('swing'); }
        break;
      }
      case 'charge': {
        e.moveDir.copy(e.lockDir); e.moveSpeed = 13;
        if (Math.random() < realDt * 30) audio.play('swing');
        G.fx.arc(e.pos, dirOf(G.time * 22), { radius: 1.6, inner: 0.6, angle: 1.8, color: 0xff2a2a, life: 0.12 });
        const traveled = e.pos.distanceTo(e.chargeFrom);
        if (d < 1.4 + P.radius) P.hurt(2, e.pos);
        if (traveled > e.chargeLen || e.st > 1.0) {
          e.rig.stop(); audio.play('boom'); G.fx.shake(0.6);
          G.fx.ring(e.pos, { radius: 2, color: 0xff3030, life: 0.35 });
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * TAU;
            const from = e.pos.clone().addScaledVector(dirOf(a), 0.8); from.y = 0.5;
            G.shootEnemy('bullet', from, dirOf(a), { speed: 5, dmg: 1 });
          }
          e.setState('dizzy'); e.cd = rnd(1.2, 1.6) / spd;
        }
        break;
      }
      case 'dizzy': {
        e.moveSpeed = 0;
        if (Math.random() < dt * 8) G.fx.burst({ x: e.pos.x + rnd(-0.4, 0.4), y: 2.2, z: e.pos.z + rnd(-0.4, 0.4) }, { count: 1, color: 0xffe066, speed: 0.5, life: 0.5, size: 0.25, gravity: 0, up: 0 });
        if (e.st > 1.1) e.setState('walk');
        break;
      }
      case 'summon': {
        e.moveSpeed = 0;
        if (e.st > 0.9) {
          for (let i = 0; i < 2; i++) {
            const a = e.face + (i ? 1.2 : -1.2);
            const p = e.pos.clone().addScaledVector(dirOf(a), 2);
            G.world.collide(p, 0.4);
            G.spawnEnemy('warrior', p.x, p.z, e.room);
          }
          e.rig.stop(); e.setState('recover'); e.cd = rnd(1.0, 1.5);
        }
        break;
      }
      case 'roar': e.moveSpeed = 0; if (e.st > 1.0) { e.setState('walk'); e.cd = 0.3; } break;
      case 'recover': e.moveSpeed = 0; if (e.st > 0.5) e.setState('walk'); break;
      default: e.setState('walk');
    }
  },
};

function rayLen(G, from, dir, max) {
  for (let t = 0.4; t < max; t += 0.2) if (G.world.blocksShot(from.x + dir.x * t, from.z + dir.z * t)) return t;
  return max;
}

function hideSpot(e) {
  const G = e.G, P = e.player;
  const cells = G.world.floorCells(e.room);
  let best = e.pos.clone(), bs = -1e9;
  for (let i = 0; i < 26; i++) {
    const c = cells[(Math.random() * cells.length) | 0];
    const dP = c.distanceTo(P.pos);
    let s = Math.min(dP, 8) * 1.2 - c.distanceTo(e.pos) * 0.35;
    if (!G.world.los(c, P.pos)) s += 6;
    if (dP < 3) s -= 10;
    // prefer staying near allies so heals reach them
    let near = 0; for (const o of G.enemies) if (o !== e && !o.dead && o.pos.distanceTo(c) < 7) near++;
    s += Math.min(near, 2);
    if (s > bs) { bs = s; best = c; }
  }
  return best;
}
