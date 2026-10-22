import * as THREE from 'three';
import { clone } from './assets.js';
import { Player } from './player.js';
import { Enemy } from './enemies.js';
import { World } from './world.js';
import { FX, TEX } from './fx.js';
import { audio } from './audio.js';
import { WEAPONS, CHEST_WEAPONS, BUFFS, CHAR_SCALE } from './config.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const rnd = (a, b) => a + Math.random() * (b - a);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class Game {
  constructor({ scene, camera, input, ui }) {
    this.scene = scene; this.camera = camera; this.input = input; this.ui = ui;
    this.time = 0;
    this.fx = new FX(scene, camera);
    this.world = new World(scene);
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.debris = [];
    this.chests = [];
    this.player = new Player(this);
    this.currentRoom = 1;
    this.activeRoom = null;
    this.over = false;
    this.camPos = new THREE.Vector3();
    this.camTarget = this.player.pos.clone();
    this.camFocus = null; // {pos, t}
    this.weaponPool = shuffle([...CHEST_WEAPONS]);
    this.rewards = { 2: 'weapon' };
    const r = shuffle(['buff', 'weapon', 'mimic']);
    this.rewards[3] = r[0]; this.rewards[4] = r[1]; this.rewards[5] = r[2];
    this.tutorial = { moved: false, stopHint: false, dodgeHint: false };
    this.torchLights = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xff9a40, 0, 6.5, 1.7);
      scene.add(l); this.torchLights.push(l);
    }
    this.coinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.035, 10).rotateZ(Math.PI / 2);
    this.coinMat = new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0xffa020, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.35 });
    this.player.cantDie = true;
    this.W = window.innerWidth; this.H = window.innerHeight;
    ui.bind(this);
  }

  start() {
    this.ui.hint('Drag anywhere to move', { hand: true });
    this.input.enabled = true;
  }

  // ================= combat =================
  meleeHit(origin, dir, range, arc, dmg, opts) {
    let hits = 0;
    const face = Math.atan2(dir.x, dir.z);
    for (const e of this.enemies) {
      if (e.dead || !e.targetable) continue;
      _v.subVectors(e.pos, origin); _v.y = 0;
      const d = _v.length() - e.radius;
      if (d > range) continue;
      const a = Math.atan2(_v.x, _v.z);
      const da = Math.abs(Math.atan2(Math.sin(a - face), Math.cos(a - face)));
      if (da > arc / 2 + Math.atan2(e.radius, Math.max(0.3, d)) && d > 0.35) continue;
      this.damageEnemy(e, dmg, { ...opts, dir: _v.clone().normalize() });
      hits++;
    }
    this.hitProps(origin, dir, range, arc);
    if (hits) {
      this.fx.hitstop(opts.light ? 22 : 55);
      this.fx.shake(opts.light ? 0.18 : 0.32);
    }
    return hits;
  }

  aoeHit(c, radius, dmg, opts) {
    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead || !e.targetable) continue;
      const d = e.pos.distanceTo(c);
      if (d > radius + e.radius) continue;
      this.damageEnemy(e, dmg, { ...opts, dir: _v.subVectors(e.pos, c).setY(0).normalize().clone() });
      hits++;
    }
    for (const p of [...this.world.props.values()]) {
      if (p.breakable && Math.hypot(p.x - c.x, p.z - c.z) < radius + 0.4) this.damageProp(p, 3);
    }
    if (hits) this.fx.hitstop(40);
  }

  hitProps(origin, dir, range, arc) {
    const face = Math.atan2(dir.x, dir.z);
    for (const p of [...this.world.props.values()]) {
      if (!p.breakable) continue;
      const dx = p.x - origin.x, dz = p.z - origin.z; const d = Math.hypot(dx, dz) - 0.45;
      if (d > range) continue;
      const da = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - face), Math.cos(Math.atan2(dx, dz) - face)));
      if (da < arc / 2 + 0.4) this.damageProp(p, 1);
    }
  }

  damageProp(p, n) {
    p.hp -= n;
    const c = p.name === 'T_Crate' ? 0x8a5a34 : 0x7a4a2a;
    audio.play('hit', { pitch: 0.6 });
    this.fx.burst({ x: p.x, y: 0.5, z: p.z }, { count: 6, color: c, speed: 2.5, life: 0.5, size: 0.18, gravity: 9, up: 2, additive: false });
    p.obj.scale.set(1.12, 0.88, 1.12);
    setTimeout(() => p.obj.scale.set(1, 1, 1), 70);
    if (p.hp <= 0) {
      this.world.breakProp(p);
      audio.play('shatter');
      this.fx.burst({ x: p.x, y: 0.4, z: p.z }, { count: 22, color: c, speed: 4.5, life: 0.8, size: 0.26, gravity: 12, up: 4, additive: false });
      this.fx.burst({ x: p.x, y: 0.3, z: p.z }, { count: 10, color: 0x5a6070, speed: 1.5, life: 0.7, size: 0.4, gravity: -0.5, up: 0.5, additive: false });
      this.fx.shake(0.2);
      // debris chunks
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(rnd(0.12, 0.3), rnd(0.05, 0.1), rnd(0.12, 0.25)), new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
        m.position.set(p.x, 0.4, p.z);
        this.scene.add(m);
        this.addDebris(m, new THREE.Vector3(rnd(-3, 3), rnd(3, 6), rnd(-3, 3)), 1.4, true);
      }
      if (Math.random() < 0.7) this.dropCoins(new THREE.Vector3(p.x, 0, p.z), 2);
    }
  }

  damageEnemy(e, dmg, info = {}) {
    if (e.dead) return;
    let amount = dmg, crit = false;
    if (!info.dot && Math.random() < 0.15) { amount *= 1.7; crit = true; }
    amount = Math.round(amount * 10) / 10;
    e.hp -= amount;
    e.onHurt(amount, info);
    const hpPos = { x: e.pos.x, y: 1.3 * e.scale / CHAR_SCALE, z: e.pos.z };
    const txt = amount >= 1 ? Math.round(amount).toString() : amount.toFixed(1);
    if (info.dot) this.fx.text(hpPos, txt, { color: info.color, size: 16, life: 0.55, rise: 0.8 });
    else this.fx.text(hpPos, txt + (crit ? '!' : ''), { color: crit ? '#ffd23a' : '#ffffff', size: crit ? 30 : 22, crit });
    if (!info.dot) {
      audio.play('hit', { pitch: crit ? 1.3 : 1 + Math.random() * 0.2 });
      const dir = info.dir || _v.set(0, 0, 1);
      const resist = e.type === 'king' ? 0.15 : e.type === 'mimic' ? 0.4 : 1;
      e.knock.addScaledVector(dir, (info.knock || 2) * resist * (crit ? 1.5 : 1));
      const col = info.weapon ? WEAPONS[info.weapon].color : '#ffffff';
      this.fx.spark({ x: e.pos.x, y: 0.65, z: e.pos.z }, col, crit ? 14 : 8, 6);
      this.fx.burst({ x: e.pos.x, y: 0.65, z: e.pos.z }, { count: 4, color: e.type === 'mimic' ? 0x8a6a3a : 0xe9dcc0, speed: 3, life: 0.5, size: 0.13, gravity: 12, up: 3, additive: false, dir, spread: 1.6 });
      this.fx.flash({ x: e.pos.x, y: 0.7, z: e.pos.z }, { color: col, size: crit ? 2 : 1.3, life: 0.09 });
      if (crit) this.fx.shake(0.3);
      // statuses
      if (info.burn) {
        if (e.status.burn <= 0) audio.play('burn');
        e.status.burn = info.burn.time; e.status.burnDps = info.burn.dps;
      }
      if (info.poison) { e.status.poison = info.poison.time; e.status.poisonDps = info.poison.dps; audio.play('poison'); }
      if (info.slow) {
        if (e.status.slow <= 0) this.fx.text({ x: e.pos.x, y: hpPos.y + 0.35, z: e.pos.z }, 'SLOW', { color: '#8fe6ff', size: 15 });
        e.status.slow = info.slow.time; e.status.slowMul = info.slow.mult;
      }
      if (info.stun && e.type !== 'king') { e.status.stun = info.stun; }
      if (info.stun && e.type === 'king') { e.status.stun = 0.15; }
    }
    if (e.type === 'king') this.ui.updateBoss(e.hp / e.maxHp);
    if (e.hp <= 0) this.killEnemy(e, info);
  }

  killEnemy(e, info) {
    e.dead = true; e.hp = 0;
    e.cleanupTele();
    audio.play('kill'); audio.play('crunch');
    this.fx.hitstop(e.type === 'king' ? 200 : 70);
    this.fx.shake(e.type === 'king' ? 1 : 0.45);
    const p = { x: e.pos.x, y: 0.6, z: e.pos.z };
    this.fx.burst(p, { count: 18, color: 0xe9dcc0, speed: 4, life: 0.7, size: 0.16, gravity: 12, up: 4, additive: false });
    this.fx.burst(p, { count: 16, color: e.rimColor, speed: 3, life: 0.6, size: 0.3, gravity: -1, up: 2 });
    this.fx.flash(p, { color: e.rimColor, size: 3, life: 0.2 });
    this.fx.ring(e.pos, { radius: 1.2, color: e.rimColor, life: 0.3 });
    // soul wisp
    this.fx.burst({ x: p.x, y: 1, z: p.z }, { count: 6, color: e.rimColor, speed: 0.4, life: 1.2, size: 0.45, gravity: -2.5, up: 0.5 });
    // explode the rig into flying parts
    const dir = info?.dir || new THREE.Vector3(0, 0, -1);
    if (e.rig) {
      const parts = [e.rig.head, e.rig.armL, e.rig.armR, e.rig.legL, e.rig.legR, e.rig.body, e.rig.cape].filter(Boolean);
      for (const part of parts) {
        this.scene.attach(part);
        const v = new THREE.Vector3(dir.x * rnd(2, 5) + rnd(-2.5, 2.5), rnd(3, 7), dir.z * rnd(2, 5) + rnd(-2.5, 2.5));
        if (part === e.rig.head) v.y += 2;
        this.addDebris(part, v, 1.6);
      }
    } else {
      // mimic: lid flies off
      const lid = e.lid; if (lid) { this.scene.attach(lid); this.addDebris(lid, new THREE.Vector3(rnd(-2, 2), 7, rnd(-2, 2)), 1.6); }
      const base = e.obj.getObjectByName('T_Mimic_Base'); if (base) { this.scene.attach(base); this.addDebris(base, new THREE.Vector3(0, 3, 0), 1.6); }
    }
    this.scene.remove(e.obj); this.scene.remove(e.shadow); e.bar?.remove();
    this.dropCoins(e.pos, e.cfg.coins);
    if (e.type === 'king') this.onBossDeath(e);
    if (e.type === 'mimic') this.onMimicDeath(e);
  }

  addDebris(obj, vel, life, small = false) {
    this.debris.push({ obj, vel, life, max: life, av: new THREE.Vector3(rnd(-12, 12), rnd(-12, 12), rnd(-12, 12)), small, s0: obj.scale.clone() });
  }

  dropCoins(pos, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.coinGeo, this.coinMat);
      m.position.set(pos.x, 0.5, pos.z);
      this.scene.add(m);
      this.pickups.push({ kind: 'coin', obj: m, pos: m.position, vel: new THREE.Vector3(rnd(-3, 3), rnd(4, 7), rnd(-3, 3)), age: 0 });
    }
  }

  // ================= projectiles =================
  shootPlayer(kind, from, dir, dmg, w) {
    let obj;
    if (kind === 'ice') { obj = clone('P_IceArrow'); obj.scale.setScalar(1.3); }
    else {
      const m = new THREE.SpriteMaterial({ map: TEX.glow, color: 0xb08aff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      obj = new THREE.Sprite(m); obj.scale.setScalar(0.9);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.dot, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      core.scale.setScalar(0.45); obj.add(core);
    }
    obj.position.copy(from);
    this.scene.add(obj);
    this.projectiles.push({ owner: 'player', kind, obj, pos: obj.position, vel: dir.clone().multiplyScalar(w.speed), dmg, w, life: 1.6, radius: 0.28, trailT: 0, wob: Math.random() * 6, prev: from.clone() });
  }

  shootEnemy(kind, from, dir, o) {
    let obj, radius = 0.2, life = 3;
    if (kind === 'arrow') { obj = clone('P_Arrow'); obj.scale.setScalar(1.4); radius = 0.2; audio.play('arrowFly'); }
    else if (kind === 'orb') {
      obj = clone('W_NecroOrb'); obj.scale.setScalar(1.6);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xa040ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      gl.scale.setScalar(1.4); obj.add(gl);
      radius = 0.3; life = 9;
    } else if (kind === 'crescent') {
      const m = new THREE.MeshBasicMaterial({ map: TEX.crescent, color: 0xff2a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      obj = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), m);
      radius = 0.5;
    } else { // bullet
      const m = new THREE.SpriteMaterial({ map: TEX.dot, color: 0xff3a2a, transparent: true, depthWrite: false });
      obj = new THREE.Sprite(m); obj.scale.setScalar(0.55);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.dot, color: 0xffffff, transparent: true, depthWrite: false }));
      core.scale.setScalar(0.5); obj.add(core);
      radius = 0.2;
    }
    obj.position.copy(from);
    this.scene.add(obj);
    const p = { owner: 'enemy', kind, obj, pos: obj.position, dmg: o.dmg, life, radius, age: 0 };
    if (kind === 'orb') {
      p.from = from.clone(); p.target = o.target.clone(); p.aoe = o.radius;
      p.flight = Math.max(0.7, from.distanceTo(o.target) / o.speed);
      p.tele = this.fx.telegraph({ shape: 'circle', pos: o.target, radius: o.radius, time: p.flight, color: 0xb040ff });
    } else {
      p.vel = dir.clone().multiplyScalar(o.speed);
      if (kind === 'arrow' || kind === 'crescent') obj.rotation.y = Math.atan2(dir.x, dir.z);
    }
    this.projectiles.push(p);
  }

  updateProjectiles(dt) {
    const P = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt; p.age = (p.age || 0) + dt;
      let dead = p.life <= 0;
      if (p.owner === 'enemy' && p.kind === 'orb') {
        const k = Math.min(1, p.age / p.flight);
        p.pos.lerpVectors(p.from, p.target, k);
        p.pos.y = p.from.y * (1 - k) + Math.sin(k * Math.PI) * 2.2 + 0.3 * k;
        p.obj.rotation.y += dt * 6;
        if (Math.random() < dt * 40) this.fx.burst(p.pos, { count: 1, color: 0xa040ff, speed: 0.3, life: 0.5, size: 0.3, gravity: 0, up: 0 });
        if (k >= 1) {
          dead = true;
          audio.play('boom');
          this.fx.shake(0.35);
          this.fx.ring(p.target, { radius: p.aoe + 0.2, color: 0xb040ff, life: 0.35 });
          this.fx.flash({ x: p.target.x, y: 0.5, z: p.target.z }, { color: 0x6a20b0, size: 2.4, life: 0.2 });
          this.fx.burst({ x: p.target.x, y: 0.2, z: p.target.z }, { count: 16, color: 0x9a50e0, speed: 4, life: 0.5, size: 0.24, gravity: 2, up: 3 });
          this.fx.decal(p.target, { tex: TEX.scorch, size: p.aoe * 2.2, life: 2.2, additive: false, opacity: 0.6, rot: Math.random() * 6 });
          if (P.pos.distanceTo(p.target) < p.aoe + P.radius * 0.5) P.hurt(p.dmg, p.target);
        }
      } else {
        p.prev?.copy(p.pos);
        if (p.kind === 'lightning') {
          // slightly wavy magic bolt
          p.wob += dt * 20;
          const side = _w.set(-p.vel.z, 0, p.vel.x).normalize().multiplyScalar(Math.cos(p.wob) * 0.9 * dt * 6);
          p.pos.add(side);
        }
        p.pos.addScaledVector(p.vel, dt);
        // wall hit
        if (this.world.blocksShot(p.pos.x, p.pos.z)) {
          dead = true;
          const prop = this.world.propAt(p.pos.x, p.pos.z);
          if (prop && prop.breakable && p.owner === 'player') this.damageProp(prop, 1);
          this.fx.spark(p.pos, p.owner === 'player' ? (p.w?.color || '#fff') : 0xff6a4a, 6, 3);
        }
        if (p.owner === 'enemy') {
          if (p.kind === 'crescent') { p.obj.scale.setScalar(1 + p.age * 0.5); }
          if (p.kind === 'bullet' && Math.random() < dt * 15) this.fx.burst(p.pos, { count: 1, color: 0xff3a2a, speed: 0.1, life: 0.25, size: 0.25, gravity: 0, up: 0 });
          if (p.kind === 'arrow' && Math.random() < dt * 25) this.fx.burst(p.pos, { count: 1, color: 0xffa080, speed: 0.1, life: 0.2, size: 0.12, gravity: 0, up: 0 });
          const dx = p.pos.x - P.pos.x, dz = p.pos.z - P.pos.z;
          if (!dead && dx * dx + dz * dz < (p.radius + P.radius) ** 2) {
            if (P.hurt(p.dmg, p.pos.clone().sub(p.vel))) dead = true;
          }
        } else {
          // trail
          p.trailT -= dt;
          if (p.trailT <= 0) {
            p.trailT = 0.016;
            if (p.kind === 'ice') this.fx.burst(p.pos, { count: 2, color: 0x8fe6ff, speed: 0.3, life: 0.35, size: 0.18, gravity: 0.5, up: 0 });
            else this.fx.burst(p.pos, { count: 2, color: 0xa57bff, speed: 0.6, life: 0.3, size: 0.25, gravity: 0, up: 0 });
          }
          if (p.kind === 'ice') p.obj.rotation.set(Math.PI / 2, 0, 0, 'YXZ'), p.obj.rotation.y = Math.atan2(p.vel.x, p.vel.z);
          for (const e of this.enemies) {
            if (dead || e.dead || !e.targetable) continue;
            const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
            if (dx * dx + dz * dz < (p.radius + e.radius) ** 2) {
              dead = true;
              const dir = p.vel.clone().normalize();
              if (p.kind === 'ice') {
                audio.play('iceHit');
                this.damageEnemy(e, p.dmg, { knock: p.w.knock, weapon: 'ice', slow: p.w.slow, dir });
                this.fx.burst({ x: e.pos.x, y: 0.7, z: e.pos.z }, { count: 12, color: 0xbef4ff, speed: 3, life: 0.5, size: 0.16, gravity: 6, up: 2 });
                this.fx.decal(e.pos, { tex: TEX.glow, size: 1.6, color: 0x6fd4ff, life: 0.6 });
              } else {
                this.lightningHit(e, p.dmg, p.w, dir, p.pos.clone());
              }
            }
          }
        }
      }
      if (dead) {
        this.scene.remove(p.obj);
        if (p.tele) this.fx.kill(p.tele);
        this.projectiles.splice(i, 1);
      } else if (p.kind === 'arrow' && p.owner === 'enemy') {
        p.obj.rotation.set(Math.PI / 2, 0, 0); p.obj.rotation.order = 'YXZ'; p.obj.rotation.y = Math.atan2(p.vel.x, p.vel.z);
      }
    }
  }

  lightningHit(first, dmg, w, dir, at) {
    audio.play('zapChain');
    const hitList = [first];
    this.damageEnemy(first, dmg, { knock: w.knock, weapon: 'lightning', dir });
    let cur = first;
    const pts = [at, first.pos.clone().setY(0.7)];
    for (let k = 0; k < w.chain.count; k++) {
      let best = null, bd = w.chain.radius;
      for (const e of this.enemies) {
        if (e.dead || !e.targetable || hitList.includes(e)) continue;
        const d = e.pos.distanceTo(cur.pos);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      hitList.push(best);
      const from = cur.pos.clone().setY(0.7), to = best.pos.clone().setY(0.7);
      this.fx.bolt([from, to], { color: 0xa57bff, life: 0.28, width: 0.16 });
      this.damageEnemy(best, w.chain.dmg * this.player.dmgMul, { knock: 1, weapon: 'lightning', dir: to.clone().sub(from).normalize() });
      this.fx.flash(to, { color: 0xc0a0ff, size: 1.6, life: 0.15 });
      cur = best;
    }
    this.fx.bolt(pts, { color: 0xa57bff, life: 0.18, width: 0.14 });
    this.fx.burst({ x: first.pos.x, y: 0.7, z: first.pos.z }, { count: 14, color: 0xc0a0ff, speed: 5, life: 0.3, size: 0.14, gravity: 0, up: 1 });
    // small electric marks on the floor
    this.fx.decal(first.pos, { tex: TEX.glow, size: 1.4, color: 0x8a5cff, life: 0.5 });
  }

  spawnEnemy(type, x, z, room) {
    const e = new Enemy(this, type, x, z, room);
    this.enemies.push(e);
    return e;
  }

  // ================= rooms & flow =================
  updateRooms(dt) {
    const P = this.player;
    const row = this.world.row(P.pos.z);
    const room = this.world.roomAtRow(row);
    if (room && room.index !== this.currentRoom) {
      this.currentRoom = room.index;
      this.ui.setRoom(room.index);
    }
    // entering a fresh room
    if (room && !room.cleared && !room.active && row < room.rowBottom - 1 && row > room.rowTop) {
      this.beginRoom(room);
    }
    // room cleared?
    if (this.activeRoom && this.activeRoom.spawned) {
      const alive = this.enemies.some((e) => !e.dead && e.room === this.activeRoom && e.type !== 'mimic');
      if (!alive && !this.activeRoom.cleared) this.clearRoom(this.activeRoom);
    }
    // tutorial hints
    if (!this.tutorial.moved && this.input.read().mag > 0.2) {
      this.tutorial.moved = true;
      if (this.currentRoom === 1) this.ui.hint('Follow the corridor up', { time: 2.2 });
      else this.ui.hideHint();
    }
    if (this.activeRoom?.index === 2 && !this.tutorial.stopHint && this.activeRoom.spawned) {
      if (this.enemies.some((e) => e.targetable)) {
        this.tutorial.stopHint = true;
        this.ui.hint('STOP to auto-attack!', { hand: false, stop: true, time: 3.2 });
      }
    }
    // spikes
    for (const s of this.world.spikes) {
      if (!s.room.active && !s.room.cleared) { s.spikes.position.y = -0.3; continue; }
      const cyc = (this.time + s.phase) % 2.6;
      const target = cyc < 1.4 ? -0.3 : cyc < 1.65 ? -0.15 : 0;
      const was = s.up;
      s.up = target;
      s.spikes.position.y += (target - s.spikes.position.y) * Math.min(1, dt * (target === 0 ? 30 : 8));
      if (target === 0 && was !== 0 && P.pos.distanceTo(_v.set(s.x, 0, s.z)) < 6) audio.play('stab');
      if (target === 0 && Math.abs(P.pos.x - s.x) < 0.5 && Math.abs(P.pos.z - s.z) < 0.5) P.hurt(1, new THREE.Vector3(s.x, 0, s.z));
    }
    // exit door
    if (this.world.exitOpen && !this.over && P.pos.z < this.world.rooms[6].zTop + 0.6) {
      this.win();
    }
  }

  beginRoom(room) {
    room.active = true;
    this.activeRoom = room;
    this.player.cantDie = room.index === 2;
    for (const g of room.gates) { this.world.setGate(g, true); g.anim = 0; }
    audio.play('gate');
    this.fx.shake(0.3);
    audio.setIntensity(1);
    const spawns = room.spawns.slice();
    if (room.index === 6) {
      this.bossIntro(room, spawns);
      return;
    }
    this.ui.toast(`ROOM ${room.index - 1}`, room.index === 2 ? 'Defeat the skeletons' : `${spawns.length} enemies`);
    spawns.forEach((s, i) => {
      setTimeout(() => { if (!this.over) this.spawnEnemy(s.type, s.x, s.z, room); if (i === spawns.length - 1) room.spawned = true; }, 450 + i * 260);
    });
  }

  bossIntro(room, spawns) {
    const ks = spawns.find((s) => s.type === 'king');
    this.camFocus = { pos: new THREE.Vector3(ks.x, 0, ks.z), t: 2.4 };
    this.input.enabled = false;
    setTimeout(() => {
      const k = this.spawnEnemy('king', ks.x, ks.z, room);
      this.boss = k;
      setTimeout(() => {
        k.rig.play('roar'); audio.play('roar'); this.fx.shake(0.9);
        this.fx.ring(k.pos, { radius: 5, color: 0xff2020, life: 0.7 });
        this.ui.showBoss('SKELETON KING');
      }, 650);
    }, 300);
    setTimeout(() => {
      spawns.filter((s) => s.type !== 'king').forEach((s) => this.spawnEnemy(s.type, s.x, s.z, room));
      room.spawned = true;
      this.input.enabled = true;
    }, 2300);
  }

  clearRoom(room) {
    room.cleared = true; room.active = false;
    this.activeRoom = null;
    audio.setIntensity(0);
    if (room.index === 6) return; // boss handled separately
    audio.play('clear');
    this.fx.slowmo(0.45, 0.3);
    this.ui.toast('ROOM CLEAR!', 'HP restored');
    const P = this.player;
    const missing = P.maxHp - P.hp;
    P.heal(P.maxHp);
    this.fx.burst({ x: P.pos.x, y: 0.2, z: P.pos.z }, { count: 30, color: 0x5aff7a, speed: 1.2, life: 1.0, size: 0.25, gravity: -3, up: 1.5 });
    this.fx.ring(P.pos, { radius: 1.6, color: 0x5aff7a, life: 0.5 });
    if (missing > 0) audio.play('heal');
    setTimeout(() => {
      for (const g of room.gates) this.world.setGate(g, false);
      audio.play('gateOpen');
    }, 600);
    const reward = this.rewards[room.index];
    if (reward) setTimeout(() => this.spawnChest(room, reward), 700);
  }

  spawnChest(room, reward) {
    const pos = new THREE.Vector3(room.chest.x, 0, room.chest.z);
    // keep chest off solid tiles
    this.world.collide(pos, 0.5);
    if (reward === 'mimic') {
      const e = this.spawnEnemy('mimic', pos.x, pos.z, room);
      e.obj.position.set(pos.x, 6, pos.z);
      this.dropIn(e.obj, pos, () => { });
      return;
    }
    const obj = clone('T_Chest');
    obj.position.set(pos.x, 6, pos.z);
    this.scene.add(obj);
    const chest = { obj, pos, lid: obj.getObjectByName('T_Chest_Lid'), reward, state: 'drop', t: 0, room };
    this.chests.push(chest);
    this.dropIn(obj, pos, () => { chest.state = 'closed'; });
    // beacon light
    const l = new THREE.PointLight(0xffd070, 3, 5, 1.6); l.position.set(pos.x, 1.4, pos.z); this.scene.add(l); chest.light = l;
  }

  dropIn(obj, pos, done) {
    const t0 = this.time;
    const it = this.fx.timed(new THREE.Object3D(), 0.6, () => {
      const k = Math.min(1, (this.time - t0) / 0.45);
      obj.position.y = 6 * (1 - k * k);
      if (k >= 1 && !it.landed) {
        it.landed = true; obj.position.y = 0;
        audio.play('slam'); this.fx.shake(0.35);
        this.fx.ring(pos, { radius: 1.3, color: 0xffd070, life: 0.35 });
        this.fx.burst({ x: pos.x, y: 0.1, z: pos.z }, { count: 14, color: 0x6a7290, speed: 2.5, life: 0.5, size: 0.3, gravity: 3, up: 1.5, additive: false });
        obj.scale.set(1.25, 0.75, 1.25);
        done();
      }
    });
  }

  updateChests(dt) {
    const P = this.player;
    for (const c of this.chests) {
      c.t += dt;
      const s = c.obj.scale; s.x += (1 - s.x) * Math.min(1, dt * 10); s.y += (1 - s.y) * Math.min(1, dt * 10); s.z = s.x;
      if (c.state === 'closed') {
        c.lid.rotation.x = Math.sin(this.time * 4) * 0.03;
        if (Math.random() < dt * 6) this.fx.burst({ x: c.pos.x + rnd(-0.4, 0.4), y: 0.6, z: c.pos.z + rnd(-0.3, 0.3) }, { count: 1, color: 0xffd070, speed: 0.2, life: 0.8, size: 0.15, gravity: -1, up: 0.3 });
        if (P.pos.distanceTo(c.pos) < 1.5) { c.state = 'opening'; c.t = 0; audio.play('telegraph'); }
      } else if (c.state === 'opening') {
        c.obj.rotation.z = Math.sin(c.t * 60) * 0.05 * (c.t < 0.35 ? 1 : 0);
        if (c.t > 0.35 && !c.popped) {
          c.popped = true; c.obj.rotation.z = 0;
          audio.play('chestOpen'); this.fx.shake(0.3);
          this.fx.flash({ x: c.pos.x, y: 0.9, z: c.pos.z }, { color: 0xffe080, size: 4, life: 0.4 });
          this.fx.burst({ x: c.pos.x, y: 0.6, z: c.pos.z }, { count: 30, color: 0xffd070, speed: 4, life: 0.8, size: 0.2, gravity: 6, up: 5 });
          this.dropCoins(c.pos, 6);
          this.giveReward(c);
        }
        if (c.popped) c.lid.rotation.x += ((-1.9) - c.lid.rotation.x) * Math.min(1, dt * 14);
      }
    }
  }

  giveReward(c) {
    if (c.reward === 'weapon') this.spawnWeaponPickup(c.pos);
    else if (c.reward === 'buff') setTimeout(() => this.offerBuffs(), 350);
  }

  spawnWeaponPickup(pos) {
    const id = this.weaponPool.shift() || 'fire';
    const w = WEAPONS[id];
    const holder = new THREE.Group();
    const m = clone(w.model);
    m.position.y = -0.3;
    holder.add(m);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: w.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    gl.scale.setScalar(1.8); holder.add(gl);
    holder.position.set(pos.x, 0.8, pos.z);
    this.scene.add(holder);
    const ringMat = new THREE.MeshBasicMaterial({ map: TEX.ring, color: w.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), ringMat);
    ring.position.set(pos.x, 0.04, pos.z - 0.9);
    this.scene.add(ring);
    const pk = { kind: 'weapon', id, obj: holder, ring, pos: new THREE.Vector3(pos.x, 0, pos.z - 0.9), age: 0, from: new THREE.Vector3(pos.x, 0.8, pos.z) };
    this.pickups.push(pk);
    this.ui.weaponCard(id);
  }

  offerBuffs() {
    const keys = shuffle(Object.keys(BUFFS)).slice(0, 3);
    this.paused = true;
    this.ui.buffChoice(keys, (k) => {
      this.paused = false;
      this.applyBuff(k);
    });
  }

  applyBuff(k) {
    const P = this.player;
    if (k === 'hp') { P.maxHp += 4; P.heal(4, true); }
    if (k === 'atkspd') P.atkMul *= 1.3;
    if (k === 'dmg') P.dmgMul *= 1.35;
    if (k === 'speed') P.spdMul *= 1.18;
    audio.play('buff');
    this.fx.burst({ x: P.pos.x, y: 0.3, z: P.pos.z }, { count: 36, color: BUFFS[k].color, speed: 2, life: 1, size: 0.25, gravity: -4, up: 2 });
    this.fx.ring(P.pos, { radius: 2, color: BUFFS[k].color, life: 0.5 });
    this.fx.text({ x: P.pos.x, y: 1.6, z: P.pos.z }, BUFFS[k].desc, { color: BUFFS[k].color, size: 22, life: 1.3 });
    P.rig.punch(2);
    this.ui.updateHp(); this.ui.addBuff(k);
  }

  onMimicReveal(e) { this.ui.toast('MIMIC!', 'Defeat it for double loot'); audio.setIntensity(1); }

  onMimicDeath(e) {
    audio.setIntensity(0);
    const pos = e.pos.clone();
    setTimeout(() => { this.spawnWeaponPickup(pos); }, 300);
    setTimeout(() => this.offerBuffs(), 900);
  }

  onArcherAim(e) {
    if (this.activeRoom?.index === 2 && !this.tutorial.dodgeHint) {
      this.tutorial.dodgeHint = true;
      this.fx.slowmo(1.1, 0.25);
      this.ui.hint('Dodge the arrows!', { time: 2.4, warn: true });
    }
  }

  onBossDeath(k) {
    this.ui.hideBoss();
    this.fx.slowmo(1.6, 0.2);
    audio.play('roar');
    // destroy remaining minions
    setTimeout(() => {
      for (const e of this.enemies) if (!e.dead) this.damageEnemy(e, 999, { knock: 5 });
      this.projectiles.forEach((p) => { this.scene.remove(p.obj); if (p.tele) this.fx.kill(p.tele); });
      this.projectiles.length = 0;
    }, 200);
    // big explosion sequence
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const p = { x: k.pos.x + rnd(-1, 1), y: rnd(0.4, 1.5), z: k.pos.z + rnd(-1, 1) };
        this.fx.flash(p, { color: 0xff3a2a, size: 3, life: 0.25 });
        this.fx.burst(p, { count: 20, color: i % 2 ? 0xff3a2a : 0xffd070, speed: 5, life: 0.7, size: 0.3, gravity: 3, up: 3 });
        audio.play('boom'); this.fx.shake(0.6);
      }, i * 160);
    }
    this.dropCoins(k.pos, 20);
    this.activeRoom && (this.activeRoom.cleared = true);
    setTimeout(() => {
      audio.play('clear');
      this.ui.toast('VICTORY!', 'The exit is open');
      this.world.openExit();
      this.exitAnim = 0;
      audio.play('gateOpen');
      this.camFocus = { pos: new THREE.Vector3(0, 0, this.world.rooms[6].zTop + 1), t: 1.6 };
      this.player.heal(99);
    }, 1400);
  }

  onPlayerDeath() {
    if (this.over) return;
    this.over = true;
    audio.play('lose');
    this.fx.slowmo(1.2, 0.25);
    const P = this.player;
    P.rig.play('hit');
    P.obj.rotation.x = -1.4;
    this.fx.burst({ x: P.pos.x, y: 0.6, z: P.pos.z }, { count: 30, color: 0xff3030, speed: 3, life: 0.8, size: 0.25 });
    setTimeout(() => this.ui.packshot(false), 1300);
  }

  win() {
    if (this.over) return;
    this.over = true;
    this.input.enabled = false;
    audio.play('win');
    this.ui.fadeOut(() => this.ui.packshot(true));
  }

  // ================= frame =================
  update(realDt) {
    if (this.paused) { this.fx.update(0, realDt, this.W, this.H); return; }
    const dt = this.fx.step(realDt);
    this.time += dt;
    if (dt > 0) {
      if (!this.over || this.player.dead) this.player.update(dt);
      for (const e of this.enemies) e.update(dt);
      for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].dead) this.enemies.splice(i, 1);
      this.updateProjectiles(dt);
      this.updatePickups(dt);
      this.updateDebris(dt);
      this.updateChests(dt);
      this.updateRooms(dt);
      this.updateGates(dt);
    }
    this.updateLights(realDt);
    this.fx.update(dt, realDt, this.W, this.H);
    this.updateCamera(realDt);
  }

  updateGates(dt) {
    for (const rm of this.world.rooms) {
      if (!rm) continue;
      for (const g of rm.gates) {
        const target = g.closed ? 0 : 1.45;
        const b = g.bars;
        if (!b.visible) continue;
        const prev = b.position.y;
        b.position.y += (target - b.position.y) * Math.min(1, dt * (g.closed ? 18 : 4));
        if (g.closed && prev > 0.05 && b.position.y <= 0.05) {
          this.fx.burst({ x: g.x, y: 0.05, z: g.z }, { count: 14, color: 0x6a7290, speed: 2.5, life: 0.5, size: 0.3, gravity: 3, up: 1.2, additive: false });
        }
        if (!g.closed && b.position.y > 1.4) b.visible = false;
      }
    }
    if (this.world.exitOpen) {
      this.exitAnim = Math.min(1, (this.exitAnim || 0) + dt * 0.8);
      const k = 1 - Math.pow(1 - this.exitAnim, 3);
      const [L, R] = this.world.exitLeaves;
      L.rotation.y = -k * 1.9; R.rotation.y = k * 1.9;
      this.world.exitLight.intensity = 8 * k;
      if (Math.random() < dt * 30) this.fx.burst({ x: rnd(-0.8, 0.8), y: rnd(0.2, 2), z: this.world.rooms[6].zTop + 0.6 }, { count: 1, color: 0x6ab0ff, speed: 0.6, life: 1, size: 0.25, gravity: -1, up: 0.5 });
    }
  }

  updatePickups(dt) {
    const P = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.age += dt;
      if (p.kind === 'coin') {
        const d = p.pos.distanceTo(P.pos);
        if (p.age > 0.5 && d < 3.2) {
          // magnet
          _v.subVectors(P.pos, p.pos).setY(0.4 - p.pos.y).normalize().multiplyScalar(14 + p.age * 8);
          p.vel.lerp(_v, Math.min(1, dt * 8));
        } else {
          p.vel.y -= 22 * dt;
          p.vel.x *= Math.exp(-dt * 2); p.vel.z *= Math.exp(-dt * 2);
        }
        p.pos.addScaledVector(p.vel, dt);
        if (p.pos.y < 0.12) { p.pos.y = 0.12; p.vel.y = Math.abs(p.vel.y) * 0.45; }
        this.world.collide(p.pos, 0.1);
        p.obj.rotation.y += dt * 8;
        if (d < 0.5 && p.age > 0.5) {
          this.scene.remove(p.obj); this.pickups.splice(i, 1);
          P.coins++; audio.play('coin'); this.ui.updateCoins();
          this.fx.burst({ x: P.pos.x, y: 0.6, z: P.pos.z }, { count: 3, color: 0xffd040, speed: 1.5, life: 0.3, size: 0.15, gravity: 0, up: 1 });
        }
      } else if (p.kind === 'weapon') {
        const k = Math.min(1, p.age / 0.6);
        p.obj.position.lerpVectors(p.from, _v.set(p.pos.x, 0.9, p.pos.z), 1 - Math.pow(1 - k, 3));
        p.obj.position.y = 0.9 + Math.sin(k * Math.PI) * 1.2 + Math.sin(this.time * 3) * 0.1;
        p.obj.rotation.y += dt * 2.5;
        p.ring.rotation.y -= dt;
        if (p.age > 0.7 && P.pos.distanceTo(p.pos) < 1.0) {
          this.scene.remove(p.obj); this.scene.remove(p.ring); this.pickups.splice(i, 1);
          P.addWeapon(p.id);
          audio.play('pickup');
          this.fx.flash({ x: P.pos.x, y: 0.8, z: P.pos.z }, { color: WEAPONS[p.id].color, size: 3, life: 0.3 });
          this.fx.burst({ x: P.pos.x, y: 0.5, z: P.pos.z }, { count: 30, color: WEAPONS[p.id].color, speed: 3, life: 0.7, size: 0.22, gravity: -2, up: 2 });
          this.fx.ring(P.pos, { radius: 1.8, color: WEAPONS[p.id].color, life: 0.4 });
          this.ui.hideWeaponCard();
          this.ui.toast(WEAPONS[p.id].name.toUpperCase(), WEAPONS[p.id].desc);
          if (P.weapons.length === 2 && !this.swapHinted) { this.swapHinted = true; setTimeout(() => this.ui.hint('Tap the weapon button to swap', { time: 2.6, swap: true }), 1800); }
        }
      }
    }
  }

  updateDebris(dt) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      d.vel.y -= 20 * dt;
      d.obj.position.addScaledVector(d.vel, dt);
      if (d.obj.position.y < 0.08) {
        d.obj.position.y = 0.08;
        if (d.vel.y < -1.5) { d.vel.y *= -0.38; d.av.multiplyScalar(0.6); if (!d.small && Math.random() < 0.3) audio.play('crunch'); }
        else d.vel.y = 0;
        d.vel.x *= 0.7; d.vel.z *= 0.7;
      }
      if (this.world.solidAt(d.obj.position.x, d.obj.position.z)) { d.vel.x *= -0.5; d.vel.z *= -0.5; }
      d.obj.rotation.x += d.av.x * dt; d.obj.rotation.y += d.av.y * dt; d.obj.rotation.z += d.av.z * dt;
      d.av.multiplyScalar(Math.exp(-dt * 1.5));
      if (d.life < 0.4) d.obj.scale.copy(d.s0).multiplyScalar(Math.max(0.001, d.life / 0.4));
      if (d.life <= 0) { this.scene.remove(d.obj); this.debris.splice(i, 1); }
    }
  }

  updateLights(dt) {
    // assign pooled point lights to the torches closest to the player
    const P = this.player.pos;
    const ts = this.world.torches;
    const sorted = ts.map((t) => ({ t, d: (t.x - P.x) ** 2 + (t.z - P.z) ** 2 })).sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.torchLights.length; i++) {
      const l = this.torchLights[i]; const s = sorted[i];
      if (!s) { l.intensity = 0; continue; }
      const t = s.t;
      const fl = 0.85 + Math.sin(this.time * 13 + t.phase) * 0.08 + Math.sin(this.time * 23 + t.phase * 2) * 0.06;
      l.position.set(t.x, t.y + 0.3, t.z);
      l.intensity = 7 * fl;
    }
    for (const t of ts) {
      const fl = 0.85 + Math.sin(this.time * 13 + t.phase) * 0.1 + Math.sin(this.time * 31 + t.phase) * 0.05;
      if (t.sprite) t.sprite.scale.setScalar((t.brazier ? 1.4 : 0.95) * fl);
      if (t.pool) t.pool.material.opacity = 0.32 * fl;
      if (Math.random() < dt * 5) this.fx.burst({ x: t.x, y: t.y + 0.1, z: t.z }, { count: 1, color: 0xffa040, speed: 0.2, life: 0.6, size: 0.12, gravity: -1.5, up: 0.3 });
    }
  }

  updateCamera(dt) {
    const P = this.player;
    let target = _v.copy(P.pos).addScaledVector(P.vel, 0.12);
    if (this.camFocus) {
      this.camFocus.t -= dt;
      target = this.camFocus.pos;
      if (this.camFocus.t <= 0) this.camFocus = null;
    }
    // clamp to the current room so we don't stare at the void
    const want = _w.copy(target);
    const room = this.world.roomAtRow(this.world.row(P.pos.z));
    if (!this.camFocus && this.view) {
      want.z -= this.view.ahead;
      const maxX = Math.max(0, 7 - this.view.halfW - 0.2);
      want.x = Math.max(-maxX, Math.min(maxX, want.x));
      if (room) {
        const bottomLimit = room.zBottom + 0.8 - this.view.down;
        if (want.z > bottomLimit) want.z = bottomLimit;
      }
    }
    this.camTarget.lerp(want, Math.min(1, dt * (this.camFocus ? 3 : 7)));
    const off = this.camOffset;
    const sh = this.fx.shakeOffset(this.time);
    this.camera.position.set(this.camTarget.x + off.x + sh.x, off.y, this.camTarget.z + off.z + sh.z);
    this.camera.lookAt(this.camTarget.x + sh.x, 0, this.camTarget.z - 0.6 + sh.z);
  }

  resize(w, h) {
    this.W = w; this.H = h;
    const aspect = w / h;
    const portrait = aspect < 1;
    this.camera.fov = portrait ? 46 : 38;
    // distance scales so ~8.5 tiles fit across a phone in portrait, more in landscape
    const dist = portrait ? 7.6 / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect) * 0.92 : 12;
    const pitch = THREE.MathUtils.degToRad(60);
    this.camOffset = { x: 0, y: Math.sin(pitch) * dist, z: Math.cos(pitch) * dist };
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // measure what the camera sees on the ground (relative to its target)
    this.camera.position.set(this.camOffset.x, this.camOffset.y, this.camOffset.z);
    this.camera.lookAt(0, 0, -0.6);
    this.camera.updateMatrixWorld();
    const rc = new THREE.Raycaster(); const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const hit = new THREE.Vector3();
    const at = (x, y) => { rc.setFromCamera(new THREE.Vector2(x, y), this.camera); return rc.ray.intersectPlane(ground, hit) ? hit.clone() : new THREE.Vector3(); };
    const bottom = at(0, -1), mid = at(0, -0.2);
    const halfW = Math.abs(at(1, -0.2).x - mid.x);
    this.view = { down: bottom.z, halfW, ahead: portrait ? 1.6 : 0.8 };
    this.fx.setScale(h, this.camera.fov);
  }
}
