import * as THREE from 'three';
import { clone, instanced } from './assets.js';
import { TEX } from './fx.js';

// Legend: ' ' void  '#' wall  '.' floor  T torch-wall  N banner-wall  P pillar  C crate  B barrel  S spikes
// K crystal  b bones  z brazier  g gated door  d open door  E exit door  @ start  * chest spot  r rune
// spawns: w warrior a archer n necro h healer k king
const ROOM1 = [
  '##T###dd###T##',
  '#............#',
  '#.B........C.#',
  '#............#',
  'T............T',
  '#.....r......#',
  '#............#',
  'T............T',
  '#.C...@....B.#',
  '#..b.......z.#',
  '##############',
];
const ROOM2 = [
  '##N#T#gg#T#N##',
  '#............#',
  '#B....*.....B#',
  '#..a......a..#',
  'T............T',
  '#....P.......#',
  '#.......w..C.#',
  '#..C.........#',
  'T............T',
  '#............#',
  '#.B.......b..#',
  '#............#',
  '######gg######',
];
const ROOM3 = [
  '##T###gg###T##',
  '#B..........B#',
  '#...h........#',
  '#..PP....PP..#',
  'T..P......P..T',
  '#.....*......#',
  '#.a.......w..#',
  '#....C..C....#',
  'T..P......P..T',
  '#..PP.w..PP..#',
  '#............#',
  '#B...b.....B.#',
  '######gg######',
];
const ROOM4 = [
  '##N#T#gg#T#N##',
  '#............#',
  '#.a...n...a..#',
  '#..B......B..#',
  'T.....*......T',
  '#..P......P..#',
  '#.....K......#',
  '#..P......P..#',
  'T....w.......T',
  '#..C.....h.C.#',
  '#............#',
  '#B...b......B#',
  '######gg######',
];
const ROOM5 = [
  '##T###gg###T##',
  '#B....n.....B#',
  '#.a........a.#',
  '#...SSSSSS...#',
  'T............T',
  '#.C..*....C..#',
  '#...PP..PP...#',
  '#.w........w.#',
  'T............T',
  '#...SSSSSS...#',
  '#.B........B.#',
  '#............#',
  '######gg######',
];
const ROOM6 = [
  '##T#N#EE#N#T##',
  '#............#',
  '#.z........z.#',
  '#.....k......#',
  '#P..........P#',
  'T............T',
  '#............#',
  '#.n........n.#',
  'T............T',
  '#P..........P#',
  '#............#',
  '#............#',
  '#.z........z.#',
  '#............#',
  '######gg######',
];
const CORR = ['     #..#     ', '     #..#     ', '     #..#     ', '     #..#     '];

export const TILE = { FLOOR: 0, WALL: 1, PROP: 2, PILLAR: 3, VOID: 4, GATE: 5 };

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    const parts = [ROOM6, CORR, ROOM5, CORR, ROOM4, CORR, ROOM3, CORR, ROOM2, CORR, ROOM1];
    const roomOrder = [6, null, 5, null, 4, null, 3, null, 2, null, 1];
    this.lines = [];
    this.rooms = [];
    let row = 0;
    parts.forEach((p, i) => {
      const idx = roomOrder[i];
      if (idx) this.rooms[idx] = { index: idx, rowTop: row, rowBottom: row + p.length - 1, spawns: [], torches: [], gates: [], cleared: idx === 1, props: [] };
      p.forEach((l) => this.lines.push(l));
      row += p.length;
    });
    this.W = 14; this.H = this.lines.length;
    this.zOff = -(this.H - 6); // put the start room near z=0
    this.grid = new Uint8Array(this.W * this.H);
    this.props = new Map(); // cell -> prop object
    this.spikes = [];
    this.torches = [];
    this.build();
  }

  cx(col) { return col - 6.5; }
  cz(row) { return row + this.zOff; }
  col(x) { return Math.floor(x + 7); }
  row(z) { return Math.floor(z - this.zOff + 0.5); }
  idx(c, r) { return r * this.W + c; }
  cell(x, z) { return [this.col(x), this.row(z)]; }

  tileAt(c, r) {
    if (c < 0 || r < 0 || c >= this.W || r >= this.H) return TILE.VOID;
    return this.grid[this.idx(c, r)];
  }
  solidAt(x, z) { const t = this.tileAt(this.col(x), this.row(z)); return t !== TILE.FLOOR; }
  blocksShot(x, z) { const t = this.tileAt(this.col(x), this.row(z)); return t === TILE.WALL || t === TILE.PILLAR || t === TILE.PROP || t === TILE.GATE || t === TILE.VOID; }

  roomAtRow(r) { return this.rooms.find((rm) => rm && r >= rm.rowTop && r <= rm.rowBottom); }

  build() {
    const floorT = [], floorB = [], walls = [], lowWalls = [], wallTint = [];
    const rand = mulberry(12345);
    for (let r = 0; r < this.H; r++) {
      const line = this.lines[r];
      const room = this.roomAtRow(r);
      for (let c = 0; c < this.W; c++) {
        const ch = line[c] || ' ';
        const x = this.cx(c), z = this.cz(r);
        let t = TILE.FLOOR;
        const floorHere = ch !== ' ' && ch !== '#' && ch !== 'T' && ch !== 'N' && ch !== 'E';
        if (floorHere || ch === 'E') {
          const shade = 0.88 + rand() * 0.2;
          const col = new THREE.Color(shade, shade, shade * (1 + (rand() - 0.5) * 0.06));
          ((c + r) % 2 === 0 ? floorT : floorB).push({ x, z, ry: Math.floor(rand() * 4) * Math.PI / 2, color: col });
        }
        switch (ch) {
          case ' ': t = TILE.VOID; break;
          case '#': case 'T': case 'N': case 'E': {
            t = TILE.WALL;
            if (ch === 'E') break;
            // bottom edge of a room = low wall so the camera can see in
            const below = this.lines[r + 1]?.[c];
            const above = this.lines[r - 1]?.[c];
            const isBottomEdge = room && r === room.rowBottom;
            const v = 0.9 + rand() * 0.18;
            if (isBottomEdge || (!room && false)) lowWalls.push({ x, z, sy: 0.42, color: new THREE.Color(v, v, v) });
            else walls.push({ x, z, color: new THREE.Color(v, v, v) });
            if (ch === 'T' || ch === 'N') {
              // facing: toward floor neighbour
              let dir = { x: 0, z: 1 };
              if (below && below !== '#' && below !== ' ') dir = { x: 0, z: 1 };
              else if (above && above !== '#' && above !== ' ') dir = { x: 0, z: -1 };
              else if (line[c + 1] && line[c + 1] !== '#' && line[c + 1] !== ' ') dir = { x: 1, z: 0 };
              else dir = { x: -1, z: 0 };
              if (ch === 'T') this.addTorch(x + dir.x * 0.5, z + dir.z * 0.5, dir, room);
              else this.addBanner(x + dir.x * 0.5, z + dir.z * 0.5, dir);
            }
            break;
          }
          case 'P': t = TILE.PILLAR; this.addProp('T_Pillar', c, r, { solid: true }); break;
          case 'C': t = TILE.PROP; this.addProp('T_Crate', c, r, { breakable: 3, rot: rand() * 0.4 - 0.2 }); break;
          case 'B': t = TILE.PROP; this.addProp('T_Barrel', c, r, { breakable: 2, rot: rand() * 6 }); break;
          case 'K': t = TILE.PILLAR; this.addProp('T_Crystal', c, r, { solid: true, glow: 0x3aa0ff }); break;
          case 'z': t = TILE.PILLAR; this.addProp('T_Brazier', c, r, { solid: true, fire: true }); break;
          case 'S': this.addSpikes(c, r); break;
          case 'b': this.addDeco('T_Bones', x, z, rand() * 6); break;
          case 'r': this.addRune(0, z); break;
          case '@': this.start = new THREE.Vector3(x + 0.5, 0, z); break;
          case '*': room.chest = { x: x + 0.5, z }; break;
          case 'g': if (c === 6) this.addGate(room, x + 0.5, z, r); break;
          case 'd': break;
          case 'w': case 'a': case 'n': case 'h': case 'k':
            room.spawns.push({ type: { w: 'warrior', a: 'archer', n: 'necro', h: 'healer', k: 'king' }[ch], x, z }); break;
          default: break;
        }
        this.grid[this.idx(c, r)] = t;
      }
    }
    instanced('T_Floor', floorT, this.group);
    instanced('T_FloorB', floorB, this.group);
    instanced('T_Wall', walls, this.group);
    instanced('T_Wall', lowWalls, this.group);

    // room metadata
    for (const rm of this.rooms) {
      if (!rm) continue;
      rm.zTop = this.cz(rm.rowTop); rm.zBottom = this.cz(rm.rowBottom);
      rm.center = new THREE.Vector3(0, 0, (rm.zTop + rm.zBottom) / 2);
      rm.chest = rm.chest || { x: 0, z: rm.center.z };
    }
    // boss room: rug + exit door
    const boss = this.rooms[6];
    const rug = clone('T_Rug'); rug.position.set(0, 0.005, boss.center.z - 1.5); rug.scale.set(1.1, 1, 1.3); this.group.add(rug);
    this.exitDoor = clone('T_ExitDoor');
    this.exitDoor.position.set(0, 0, boss.zTop + 0.35);
    this.group.add(this.exitDoor);
    this.exitLeaves = [this.exitDoor.getObjectByName('T_ExitDoor_LeafL'), this.exitDoor.getObjectByName('T_ExitDoor_LeafR')];
    const exitLight = new THREE.PointLight(0x3a8aff, 0, 7, 1.6); exitLight.position.set(0, 1.5, boss.zTop + 1.2);
    this.group.add(exitLight); this.exitLight = exitLight;
    // ambient floor glows from the void edges
    this.addVoidDust();
  }

  addProp(name, c, r, opt) {
    const o = clone(name);
    const x = this.cx(c), z = this.cz(r);
    o.position.set(x, 0, z);
    if (opt.rot) o.rotation.y = opt.rot;
    this.group.add(o);
    const p = { name, obj: o, c, r, x, z, hp: opt.breakable || 0, breakable: !!opt.breakable, room: this.roomAtRow(r) };
    this.props.set(this.idx(c, r), p);
    if (opt.glow) {
      const g = new THREE.PointLight(opt.glow, 2.5, 5, 1.5); g.position.set(x, 1.0, z); this.group.add(g);
      p.light = g;
    }
    if (opt.fire) this.torches.push({ x, y: 0.95, z, room: this.roomAtRow(r), brazier: true, phase: Math.random() * 10 });
    return p;
  }

  addDeco(name, x, z, ry) { const o = clone(name); o.position.set(x, 0, z); o.rotation.y = ry; this.group.add(o); }

  addRune(x, z) {
    const m = new THREE.MeshBasicMaterial({ map: TEX.rune, color: 0x3a8aff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), m);
    mesh.position.set(x, 0.02, z);
    this.group.add(mesh);
    this.rune = mesh;
    const l = new THREE.PointLight(0x3a8aff, 3, 5, 1.6); l.position.set(x, 0.8, z); this.group.add(l);
  }

  addTorch(x, z, dir, room) {
    const o = clone('T_Torch');
    o.position.set(x, 0.8, z);
    o.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI; // model faces -Y(blender) => +Z; mount points out of wall
    this.group.add(o);
    const fx = x + dir.x * 0.17, fz = z + dir.z * 0.17;
    this.torches.push({ x: fx, y: 1.02, z: fz, room, phase: Math.random() * 10, obj: o });
  }

  addBanner(x, z, dir) {
    const o = clone('T_Banner');
    o.position.set(x, 1.15, z);
    o.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
    this.group.add(o);
  }

  addSpikes(c, r) {
    const o = clone('T_Spikes');
    const x = this.cx(c), z = this.cz(r);
    o.position.set(x, 0, z);
    this.group.add(o);
    const sp = o.getObjectByName('T_Spikes_Spikes');
    this.spikes.push({ obj: o, spikes: sp, x, z, room: this.roomAtRow(r), up: 0, phase: (c % 2) * 0.0 });
    sp.position.y = -0.3;
  }

  addGate(room, x, z, r) {
    const o = clone('T_Gate');
    o.position.set(x, 0, z);
    this.group.add(o);
    const bars = o.getObjectByName('T_Gate_Bars');
    const gate = { obj: o, bars, x, z, r, closed: false, t: 0, room };
    bars.position.y = 1.4; // open (raised into wall)
    bars.visible = false;
    room.gates.push(gate);
  }

  setGate(gate, closed) {
    gate.closed = closed;
    for (const c of [6, 7]) this.grid[this.idx(c, gate.r)] = closed ? TILE.GATE : TILE.FLOOR;
    gate.bars.visible = true;
  }

  openExit() {
    this.exitOpen = true;
    for (const c of [6, 7]) this.grid[this.idx(c, this.rooms[6].rowTop)] = TILE.FLOOR;
  }

  addVoidDust() {
    // soft blue glow on floor near torches (fake bounce light)
    for (const t of this.torches) {
      const m = new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xff8a30, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2), m);
      mesh.position.set(t.x, 0.015, t.z);
      mesh.renderOrder = 3;
      this.group.add(mesh);
      t.pool = mesh;
      // flame glow sprite
      const sm = new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(sm); s.scale.setScalar(0.9); s.position.set(t.x, t.y, t.z); s.renderOrder = 24;
      this.group.add(s); t.sprite = s;
    }
  }

  breakProp(p) {
    this.props.delete(this.idx(p.c, p.r));
    this.grid[this.idx(p.c, p.r)] = TILE.FLOOR;
    this.group.remove(p.obj);
  }

  propAt(x, z) { return this.props.get(this.idx(this.col(x), this.row(z))); }

  /** Push a circle out of solid tiles. Returns true if collided. */
  collide(pos, rad) {
    let hit = false;
    const c0 = this.col(pos.x), r0 = this.row(pos.z);
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        if (this.tileAt(c, r) === TILE.FLOOR) continue;
        const minx = c - 7, maxx = minx + 1, minz = r + this.zOff - 0.5, maxz = minz + 1;
        const nx = Math.max(minx, Math.min(pos.x, maxx)), nz = Math.max(minz, Math.min(pos.z, maxz));
        const dx = pos.x - nx, dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < rad * rad) {
          hit = true;
          if (d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = nx + dx / d * rad; pos.z = nz + dz / d * rad; }
          else { pos.z += rad; }
        }
      }
    }
    return hit;
  }

  los(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    const n = Math.ceil(d / 0.25);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.blocksShot(a.x + dx * t, a.z + dz * t)) return false;
    }
    return true;
  }

  /** BFS distance field to target cell (cached per frame-ish). */
  flow(tc, tr) {
    const key = tc + ',' + tr;
    const now = performance.now();
    this._flow = this._flow || new Map();
    const cached = this._flow.get(key);
    if (cached && now - cached.t < 250) return cached.d;
    const d = new Int16Array(this.W * this.H).fill(-1);
    const q = [this.idx(tc, tr)]; d[q[0]] = 0;
    let h = 0;
    while (h < q.length) {
      const i = q[h++]; const c = i % this.W, r = (i / this.W) | 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (this.tileAt(nc, nr) !== TILE.FLOOR) continue;
        const ni = this.idx(nc, nr);
        if (d[ni] >= 0) continue;
        d[ni] = d[i] + 1; q.push(ni);
      }
    }
    this._flow.set(key, { t: now, d });
    if (this._flow.size > 40) this._flow.delete(this._flow.keys().next().value);
    return d;
  }

  /** Direction (x,z normalized) to walk from pos toward target using the flow field. */
  pathDir(pos, target, out) {
    const [tc, tr] = this.cell(target.x, target.z);
    if (this.los(pos, target) && this.clearPath(pos, target)) {
      out.set(target.x - pos.x, 0, target.z - pos.z); const l = out.length(); if (l > 1e-4) out.multiplyScalar(1 / l); return out;
    }
    const d = this.flow(tc, tr);
    const [c, r] = this.cell(pos.x, pos.z);
    let best = d[this.idx(c, r)], bc = c, br = r;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (this.tileAt(nc, nr) !== TILE.FLOOR) continue;
      if (dc && dr && (this.tileAt(c + dc, r) !== TILE.FLOOR || this.tileAt(c, r + dr) !== TILE.FLOOR)) continue;
      const v = d[this.idx(nc, nr)];
      if (v >= 0 && (best < 0 || v < best)) { best = v; bc = nc; br = nr; }
    }
    out.set(this.cx(bc) - pos.x, 0, this.cz(br) - pos.z);
    const l = out.length(); if (l > 1e-4) out.multiplyScalar(1 / l);
    return out;
  }

  clearPath(a, b) {
    // wide check for walkers (radius ~0.3)
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < 0.01) return true;
    const px = -dz / d * 0.3, pz = dx / d * 0.3;
    const n = Math.ceil(d / 0.3);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = a.x + dx * t, z = a.z + dz * t;
      if (this.solidAt(x + px, z + pz) || this.solidAt(x - px, z - pz)) return false;
    }
    return true;
  }

  randomFloorIn(room, rand = Math.random) {
    for (let k = 0; k < 50; k++) {
      const r = room.rowTop + 1 + Math.floor(rand() * (room.rowBottom - room.rowTop - 1));
      const c = 1 + Math.floor(rand() * 12);
      if (this.tileAt(c, r) === TILE.FLOOR) return new THREE.Vector3(this.cx(c), 0, this.cz(r));
    }
    return room.center.clone();
  }

  floorCells(room) {
    const out = [];
    for (let r = room.rowTop + 1; r < room.rowBottom; r++)
      for (let c = 1; c < 13; c++) if (this.tileAt(c, r) === TILE.FLOOR) out.push(new THREE.Vector3(this.cx(c), 0, this.cz(r)));
    return out;
  }
}

export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
