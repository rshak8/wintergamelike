import * as THREE from 'three';
import { cloneCharacter, clone } from './assets.js';
import { Rig } from './anim.js';
import { PLAYER, WEAPONS, CHAR_SCALE } from './config.js';
import { TEX } from './fx.js';
import { audio } from './audio.js';

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();

export class Player {
  constructor(G) {
    this.G = G;
    const { root, fx } = cloneCharacter('Hero', 0x8fa8ff, 0.5);
    this.obj = root; this.mfx = fx;
    G.scene.add(root);
    this.rig = new Rig(root, 'Hero');
    this.rig.baseScale = CHAR_SCALE;
    this.pos = G.world.start.clone();
    this.vel = new THREE.Vector3();
    this.face = Math.PI; // facing up the dungeon (-Z)
    this.maxHp = PLAYER.hp; this.hp = this.maxHp;
    this.radius = PLAYER.radius;
    this.inv = 0;
    this.dmgMul = 1; this.atkMul = 1; this.spdMul = 1;
    this.weapons = ['sword'];
    this.cur = 0;
    this.cd = 0;
    this.still = 0;
    this.moving = false;
    this.pending = []; // scheduled hits {t, fn}
    this.target = null;
    this.dead = false;
    this.cantDie = false;
    this.lungeV = new THREE.Vector3();
    this.jabAlt = false;
    this.coins = 0;
    // blob shadow
    const sm = new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, depthWrite: false });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), sm);
    this.shadow.renderOrder = 2;
    G.scene.add(this.shadow);
    // aim indicator under target
    const am = new THREE.MeshBasicMaterial({ map: TEX.ring, color: 0xffe066, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });
    this.aimRing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), am);
    this.aimRing.renderOrder = 7; this.aimRing.visible = false;
    G.scene.add(this.aimRing);
    this.equip(0, true);
  }

  get weapon() { return WEAPONS[this.weapons[this.cur]]; }
  get wid() { return this.weapons[this.cur]; }

  equip(i, silent) {
    this.cur = i;
    const w = this.weapon;
    const m = clone(w.model);
    const basis = w.kind === 'bow' ? 'bow' : 'blade';
    this.rig.attach(m, basis);
    this.rig.idlePitch = w.kind === 'staff' ? -2.75 : w.kind === 'bow' ? 0 : w.model === 'W_HolyHammer' ? -2.3 : -1.7;
    this.rig.armRestR = w.kind === 'bow' ? -0.9 : -0.35;
    if (w.model === 'W_HolyHammer') m.scale.setScalar(1.25);
    if (w.model === 'W_PoisonDagger') m.scale.setScalar(1.2);
    this.weaponObj = m;
    this.cd = Math.min(this.cd, 0.15);
    if (!silent) {
      audio.play('swap');
      this.G.fx.burst(this.handPos(), { count: 14, color: w.color, speed: 2.5, life: 0.4, size: 0.2, gravity: -1, up: 1 });
      this.rig.punch(1.2);
    }
    this.G.ui?.updateWeapons();
  }

  addWeapon(id) {
    if (this.weapons.includes(id)) { this.equip(this.weapons.indexOf(id)); return; }
    if (this.weapons.length < 2) { this.weapons.push(id); this.equip(1); }
    else { this.weapons[this.cur] = id; this.equip(this.cur); }
  }

  swap() {
    if (this.weapons.length < 2) return;
    this.equip(1 - this.cur);
  }

  handPos() {
    const h = this.rig.handR; h.updateWorldMatrix(true, false);
    return h.getWorldPosition(new THREE.Vector3());
  }

  findTarget() {
    const G = this.G; let best = null, bd = 1e9;
    const range = this.weapon.kind === 'melee' ? 7 : this.weapon.range + 2;
    for (const e of G.enemies) {
      if (e.dead || e.spawning || !e.targetable) continue;
      const d = e.pos.distanceTo(this.pos);
      if (d > range) continue;
      const vis = G.world.los(this.pos, e.pos);
      const score = d + (vis ? 0 : 8);
      if (score < bd) { bd = score; best = e; }
    }
    return best;
  }

  update(dt) {
    const G = this.G;
    if (this.dead) { this.rig.update(dt, 0); this.sync(); return; }
    const inp = G.input.read();
    const speed = PLAYER.speed * this.spdMul;
    const want = _v.set(inp.x, 0, inp.y).multiplyScalar(speed * inp.mag > 0 ? 1 : 0);
    if (inp.mag > 0) want.normalize().multiplyScalar(speed * Math.max(0.35, inp.mag));
    // snappy acceleration
    const k = Math.min(1, dt * (inp.mag > 0 ? PLAYER.accel / speed : 22));
    this.vel.lerp(want, k);
    this.moving = inp.mag > 0.05;
    if (this.moving) this.still = 0; else this.still += dt;

    // lunge impulse
    this.pos.addScaledVector(this.vel, dt);
    this.pos.addScaledVector(this.lungeV, dt);
    this.lungeV.multiplyScalar(Math.exp(-dt * 14));
    G.world.collide(this.pos, this.radius);

    // facing
    let faceTarget = null;
    this.target = null;
    if (!this.moving && this.still > PLAYER.stopDelay) {
      this.target = this.findTarget();
      if (this.target) faceTarget = Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z);
    }
    if (this.moving && this.vel.lengthSq() > 0.1) faceTarget = Math.atan2(this.vel.x, this.vel.z);
    if (faceTarget !== null) {
      let d = faceTarget - this.face; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.face += d * Math.min(1, dt * (this.target ? 22 : 16));
    }

    // attack
    this.cd -= dt;
    if (this.target && this.cd <= 0) this.tryAttack(this.target);

    // scheduled contacts
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]; p.t -= dt;
      if (p.t <= 0) { this.pending.splice(i, 1); p.fn(); }
    }

    this.inv -= dt;
    // footstep dust
    if (this.moving && this.vel.length() > 2) {
      this.dustT = (this.dustT || 0) - dt;
      if (this.dustT <= 0) {
        this.dustT = 0.12;
        G.fx.burst({ x: this.pos.x, y: 0.08, z: this.pos.z }, { count: 2, color: 0x8a94b8, speed: 0.6, life: 0.35, size: 0.22, gravity: -0.5, up: 0.4, additive: false, drag: 3 });
      }
    }
    this.rig.update(dt, this.vel.length() / speed);
    this.sync();
    // hurt blink
    this.obj.visible = this.inv > 0 ? Math.floor(this.inv * 20) % 2 === 0 : true;
    // aim ring
    if (this.target && !this.target.dead) {
      this.aimRing.visible = true;
      const r = this.target.radius * 2.6;
      this.aimRing.position.set(this.target.pos.x, 0.04, this.target.pos.z);
      this.aimRing.scale.setScalar(r * (1 + Math.sin(G.time * 10) * 0.06));
      this.aimRing.rotation.y += dt * 2;
    } else this.aimRing.visible = false;
  }

  sync() {
    this.obj.position.copy(this.pos);
    const lean = this.rig.lean * 0.18;
    this.obj.position.x += Math.sin(this.face) * lean; this.obj.position.z += Math.cos(this.face) * lean;
    this.obj.rotation.y = this.face;
    this.shadow.position.set(this.pos.x, 0.02, this.pos.z);
  }

  tryAttack(t) {
    const w = this.weapon;
    const dist = t.pos.distanceTo(this.pos) - t.radius;
    const G = this.G;
    if (w.kind === 'melee') {
      // close the gap with a dash if the enemy is a little out of reach
      const reach = w.range + w.lunge * 1.6;
      if (dist > reach + 0.8) return;
      if (dist > w.range - 0.2) {
        _d.subVectors(t.pos, this.pos).setY(0).normalize();
        this.lungeV.addScaledVector(_d, Math.min(9, (dist - w.range + 0.6) * 9));
      }
    } else if (dist > w.range) return;
    this.cd = w.cd / this.atkMul;
    const dir = new THREE.Vector3(Math.sin(this.face), 0, Math.cos(this.face));
    const aimDir = new THREE.Vector3().subVectors(t.pos, this.pos).setY(0).normalize();
    const dmg = w.dmg * this.dmgMul;
    const W = this.wid;
    if (W === 'sword') {
      this.rig.play('stab'); audio.play('stab');
      this.schedule(0.1, () => {
        const d = new THREE.Vector3(Math.sin(this.face), 0, Math.cos(this.face));
        this.lungeV.addScaledVector(d, 5);
        G.fx.thrust(this.pos.clone().addScaledVector(d, 0.3), d, { length: w.range + 0.2, width: 0.55, color: 0xdfe8ff, life: 0.14 });
        G.meleeHit(this.pos, d, w.range, w.arc, dmg, { knock: w.knock, weapon: W });
      });
    } else if (W === 'poison') {
      this.jabAlt = !this.jabAlt;
      this.rig.play('jab', this.jabAlt); audio.play('stab');
      this.schedule(0.04, () => {
        const d = new THREE.Vector3(Math.sin(this.face + (this.jabAlt ? 0.15 : -0.15)), 0, Math.cos(this.face + (this.jabAlt ? 0.15 : -0.15)));
        this.lungeV.addScaledVector(d, 2.5);
        G.fx.thrust(this.pos.clone().addScaledVector(d, 0.25).add(new THREE.Vector3(this.jabAlt ? 0.15 : -0.15, 0, 0)), d, { length: w.range, width: 0.32, color: 0x6aff4a, life: 0.12 });
        G.meleeHit(this.pos, d, w.range, w.arc, dmg, { knock: w.knock, weapon: W, poison: w.poison, light: true });
      });
    } else if (W === 'fire') {
      this.rig.play('slash'); audio.play('slashFire');
      this.slashFlip = !this.slashFlip;
      this.schedule(0.1, () => {
        const d = new THREE.Vector3(Math.sin(this.face), 0, Math.cos(this.face));
        this.lungeV.addScaledVector(d, 3.5);
        G.fx.arc(this.pos, d, { radius: w.range + 0.2, inner: 0.3, angle: w.arc + 0.3, color: 0xff6a1a, life: 0.26, flip: this.slashFlip });
        G.fx.arc(this.pos, d, { radius: w.range - 0.3, inner: 0.2, angle: w.arc, color: 0xffd04a, life: 0.2, y: 0.5, flip: this.slashFlip });
        // embers along the arc
        for (let i = 0; i < 10; i++) {
          const a = this.face + (Math.random() - 0.5) * w.arc;
          const r = 0.6 + Math.random() * (w.range - 0.4);
          G.fx.burst({ x: this.pos.x + Math.sin(a) * r, y: 0.5, z: this.pos.z + Math.cos(a) * r }, { count: 1, color: Math.random() < 0.5 ? 0xff7a1a : 0xffc040, speed: 1, life: 0.5, size: 0.22, gravity: -2, up: 1 });
        }
        G.meleeHit(this.pos, d, w.range, w.arc, dmg, { knock: w.knock, weapon: W, burn: w.burn });
      });
    } else if (W === 'hammer') {
      this.rig.play('slam'); audio.play('swing');
      this.schedule(0.27, () => {
        const d = new THREE.Vector3(Math.sin(this.face), 0, Math.cos(this.face));
        const c = this.pos.clone().addScaledVector(d, 1.15);
        this.lungeV.addScaledVector(d, 2);
        audio.play('slam');
        G.fx.shake(0.75); G.fx.hitstop(70);
        G.fx.ring(c, { radius: w.aoe + 0.3, color: 0xffd24a, life: 0.4 });
        G.fx.ring(c, { radius: w.aoe * 0.6, color: 0xffffff, life: 0.25 });
        G.fx.decal(c, { tex: TEX.holy, size: w.aoe * 2.1, color: 0xffcc44, life: 2.8, rot: this.face, fadeIn: 0.05, opacity: 0.6 });
        G.fx.decal(c, { tex: TEX.scorch, size: w.aoe * 1.6, color: 0xffffff, life: 3, additive: false, opacity: 0.7, rot: Math.random() * 6 });
        G.fx.flash({ x: c.x, y: 0.4, z: c.z }, { color: 0xffe080, size: 4, life: 0.2 });
        G.fx.burst({ x: c.x, y: 0.15, z: c.z }, { count: 26, color: 0xffd24a, speed: 6, life: 0.6, size: 0.22, gravity: 9, up: 4 });
        G.fx.burst({ x: c.x, y: 0.1, z: c.z }, { count: 14, color: 0x5a6278, speed: 3, life: 0.6, size: 0.35, gravity: 4, up: 2.5, additive: false });
        for (let i = 0; i < 6; i++) { // rays of light
          G.fx.burst({ x: c.x, y: 0.2, z: c.z }, { count: 1, color: 0xfff0a0, speed: 0.5, life: 0.7, size: 0.6, gravity: -5, up: 2 });
        }
        G.aoeHit(c, w.aoe, dmg, { knock: w.knock, weapon: W, stun: w.stun });
      });
    } else if (W === 'ice') {
      this.rig.play('shoot'); audio.play('iceShot');
      this.schedule(0.03, () => {
        const hp = this.handPos(); hp.y = 0.6;
        G.fx.flash(hp, { color: 0x6fd4ff, size: 0.9, life: 0.1 });
        G.shootPlayer('ice', hp, aimDir, dmg, w);
      });
    } else if (W === 'lightning') {
      this.rig.play('cast'); audio.play('zap');
      this.schedule(0.09, () => {
        const hp = this.handPos(); hp.y = Math.max(0.7, hp.y);
        G.fx.flash(hp, { color: 0xa57bff, size: 1.2, life: 0.12 });
        const ad = new THREE.Vector3().subVectors(t.pos, this.pos).setY(0).normalize();
        G.shootPlayer('lightning', hp, ad, dmg, w);
      });
    }
  }

  schedule(t, fn) { this.pending.push({ t, fn }); }

  hurt(dmg, from) {
    if (this.inv > 0 || this.dead) return false;
    const G = this.G;
    this.hp -= dmg;
    if (this.cantDie && this.hp < 1) this.hp = 1;
    this.inv = PLAYER.invuln;
    audio.play('playerHurt');
    G.fx.shake(0.55); G.fx.hitstop(60);
    G.fx.text({ x: this.pos.x, y: 1.4, z: this.pos.z }, '-' + dmg, { color: '#ff4a4a', size: 26 });
    G.fx.burst({ x: this.pos.x, y: 0.7, z: this.pos.z }, { count: 12, color: 0xff3030, speed: 3, life: 0.4, size: 0.18 });
    this.rig.play('hit'); this.rig.punch(-1.5);
    this.mfx.flash.value.set(1.2, 0.2, 0.2);
    setTimeout(() => this.mfx.flash.value.set(0, 0, 0), 90);
    if (from) {
      _d.subVectors(this.pos, from).setY(0).normalize();
      this.lungeV.addScaledVector(_d, 6);
    }
    G.ui.hurt();
    if (this.hp <= 0) { this.hp = 0; this.die(); }
    G.ui.updateHp();
    return true;
  }

  heal(n, silent) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    const d = Math.round(this.hp - before);
    if (!silent && d > 0) {
      this.G.fx.text({ x: this.pos.x, y: 1.5, z: this.pos.z }, '+' + d, { color: '#5aff7a', size: 26 });
    }
    this.G.ui.updateHp();
  }

  die() {
    this.dead = true;
    this.G.onPlayerDeath();
  }
}
