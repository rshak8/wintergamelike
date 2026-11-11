// Уровень: строится из ASCII-карт, хранит сетку клеток и отвечает на вопросы
// «можно ли тут стоять», «видно ли отсюда туда», «куда идти к цели».
import * as THREE from 'three';
import { clone, instanced, type InstanceTransform } from '../assets';
import { TEX } from '../fx/textures';
import type { FX } from '../fx/fx';
import type { LightSource } from './lights';
import type { EnemyType } from '../config';
import type { XZ } from '../utils';
import { LEVEL } from './maps';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const;

const SPAWN_CODES: Record<string, EnemyType> = { w: 'warrior', a: 'archer', n: 'necro', h: 'healer', k: 'king' };

/** Что лежит в клетке. Всё, кроме FLOOR, непроходимо. */
export const TILE = { FLOOR: 0, WALL: 1, PROP: 2, PILLAR: 3, VOID: 4, GATE: 5 } as const;
export type Tile = typeof TILE[keyof typeof TILE];

export interface Spawn { type: EnemyType; x: number; z: number }

/** Ворота между комнатой и коридором; закрываются на время боя. */
export interface Gate {
  obj: THREE.Object3D;
  bars: THREE.Object3D;   // решётка, которая опускается
  x: number; z: number; row: number;
  closed: boolean;
  room: Room;
}

export interface Room {
  index: number;               // 1 стартовая … 6 босс
  rowTop: number; rowBottom: number;
  zTop: number; zBottom: number;
  center: THREE.Vector3;
  chest: XZ;                   // куда падает сундук с наградой
  chestSpot?: XZ;              // '*' на карте, если есть
  spawns: Spawn[];
  gates: Gate[];
  cleared: boolean;
  active?: boolean;            // идёт бой
  spawned?: boolean;           // все враги уже появились
}

/** Ящик, бочка, колонна и т. п. */
export interface Prop {
  name: string;
  obj: THREE.Object3D;
  col: number; row: number; x: number; z: number;
  hp: number;
  breakable: boolean;
  room?: Room;
  light?: LightSource;
}

/** Огонь (факел на стене или жаровня): визуальные части и параметры мерцания. */
export interface Torch {
  x: number; y: number; z: number;
  room?: Room;
  brazier?: boolean;
  phase: number;           // сдвиг мерцания, чтобы факелы не мигали в такт
  dir?: XZ;                // настенный факел: направление из стены в комнату
  obj?: THREE.Object3D;
  pool?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; // тёплое пятно на полу
  sprite?: THREE.Sprite;   // яркое ядро пламени
  halo?: THREE.Sprite;     // большой мягкий ореол
}

export interface Spikes {
  obj: THREE.Object3D;
  spikes: THREE.Object3D;
  x: number; z: number;
  room: Room;
  up: number;
  phase: number;
}

interface PropOptions { solid?: boolean; breakable?: number; rot?: number; glow?: number; fire?: boolean }

export class World {
  readonly scene: THREE.Scene;
  readonly group = new THREE.Group();
  /** Все строки всех карт подряд, сверху вниз. */
  private lines: string[] = [];
  /** Комнаты по номеру 1..6 (индекс 0 пустой). */
  rooms: (Room | undefined)[] = [];
  readonly cols: number;
  readonly rows: number;
  readonly half: number;          // половина ширины уровня (x идёт от -half до +half)
  private zOffset: number;        // сдвиг, чтобы стартовая комната была около z = 0
  private grid: Uint8Array;
  props = new Map<number, Prop>(); // номер клетки → проп
  spikes: Spikes[] = [];
  torches: Torch[] = [];
  /** Все источники света уровня. Реальные лампы раздаёт LightPool. */
  lights: LightSource[] = [];
  start = new THREE.Vector3();
  exitDoor!: THREE.Object3D;
  exitLeaves!: [THREE.Object3D, THREE.Object3D];
  exitLight!: LightSource;
  exitOpen = false;
  private flowCache = new Map<string, { time: number; dist: Int16Array }>();
  private bfsQueue: Int32Array;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.add(this.group);
    let row = 0;
    for (const part of LEVEL) {
      const idx = part.room;
      if (idx) {
        this.rooms[idx] = {
          index: idx, rowTop: row, rowBottom: row + part.map.length - 1, spawns: [], gates: [], cleared: idx === 1,
          zTop: 0, zBottom: 0, center: new THREE.Vector3(), chest: { x: 0, z: 0 }, // заполняется в build()
        };
      }
      for (const l of part.map) this.lines.push(l);
      row += part.map.length;
    }
    this.cols = this.lines[0].length; this.rows = this.lines.length;
    this.half = this.cols / 2;
    this.zOffset = -(this.rows - 6);
    this.grid = new Uint8Array(this.cols * this.rows);
    this.bfsQueue = new Int32Array(this.cols * this.rows);
    this.build();
  }

  /** Комната босса (номер 6, верх карты). */
  get bossRoom(): Room { return this.rooms[6]!; }

  // ---------- клетки ↔ координаты ----------
  colToX(col: number) { return col - this.half + 0.5; }
  rowToZ(row: number) { return row + this.zOffset; }
  xToCol(x: number) { return Math.floor(x + this.half); }
  zToRow(z: number) { return Math.floor(z - this.zOffset + 0.5); }
  cellIndex(col: number, row: number) { return row * this.cols + col; }

  tileAt(col: number, row: number): number {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return TILE.VOID;
    return this.grid[this.cellIndex(col, row)];
  }
  /** Нельзя стоять. */
  isSolid(x: number, z: number) { return this.tileAt(this.xToCol(x), this.zToRow(z)) !== TILE.FLOOR; }
  /** Останавливает снаряды и закрывает обзор. */
  blocksShots(x: number, z: number) {
    const t = this.tileAt(this.xToCol(x), this.zToRow(z));
    return t === TILE.WALL || t === TILE.PILLAR || t === TILE.PROP || t === TILE.GATE || t === TILE.VOID;
  }

  roomAtRow(row: number) { return this.rooms.find((rm) => rm && row >= rm.rowTop && row <= rm.rowBottom); }

  // ---------- постройка уровня ----------

  private build() {
    const floorA: InstanceTransform[] = [], floorB: InstanceTransform[] = []; // шахматка из двух плиток
    const walls: InstanceTransform[] = [], lowWalls: InstanceTransform[] = [];
    const voids: { x: number; z: number; low: boolean }[] = [];
    const rand = mulberry(12345); // один и тот же вид уровня при каждом запуске
    for (let r = 0; r < this.rows; r++) {
      const line = this.lines[r];
      const room = this.roomAtRow(r);
      for (let c = 0; c < this.cols; c++) {
        const ch = line[c] || ' ';
        const x = this.colToX(c), z = this.rowToZ(r);
        let tile: Tile = TILE.FLOOR;
        const floorHere = ch !== ' ' && ch !== '#' && ch !== 'T' && ch !== 'N' && ch !== 'E';
        if (floorHere || ch === 'E') {
          const shade = 0.88 + rand() * 0.2;
          const col = new THREE.Color(shade, shade, shade * (1 + (rand() - 0.5) * 0.06));
          ((c + r) % 2 === 0 ? floorA : floorB).push({ x, z, ry: Math.floor(rand() * 4) * Math.PI / 2, color: col });
        }
        switch (ch) {
          case ' ': tile = TILE.VOID; voids.push({ x, z, low: !room }); break;
          case '#': case 'T': case 'N': case 'E': {
            tile = TILE.WALL;
            if (ch === 'E') break;
            const below = this.lines[r + 1]?.[c];
            const above = this.lines[r - 1]?.[c];
            const v = 0.9 + rand() * 0.18;
            // нижняя стена комнаты и стены коридоров низкие — иначе камера не видит, что за ними
            const isBottomEdge = room && r === room.rowBottom;
            if (isBottomEdge || !room) lowWalls.push({ x, z, sy: 0.42, color: new THREE.Color(v, v, v) });
            else walls.push({ x, z, color: new THREE.Color(v, v, v) });
            if (ch === 'T' || ch === 'N') {
              // факел/знамя смотрит в сторону соседней клетки пола
              let dir: XZ;
              if (below && below !== '#' && below !== ' ') dir = { x: 0, z: 1 };
              else if (above && above !== '#' && above !== ' ') dir = { x: 0, z: -1 };
              else if (line[c + 1] && line[c + 1] !== '#' && line[c + 1] !== ' ') dir = { x: 1, z: 0 };
              else dir = { x: -1, z: 0 };
              if (ch === 'T') this.addTorch(x + dir.x * 0.5, z + dir.z * 0.5, dir, room);
              else this.addBanner(x + dir.x * 0.5, z + dir.z * 0.5, dir);
            }
            break;
          }
          case 'P': tile = TILE.PILLAR; this.addProp('T_Pillar', c, r, { solid: true }); break;
          case 'C': tile = TILE.PROP; this.addProp('T_Crate', c, r, { breakable: 3, rot: rand() * 0.4 - 0.2 }); break;
          case 'B': tile = TILE.PROP; this.addProp('T_Barrel', c, r, { breakable: 2, rot: rand() * 6 }); break;
          case 'K': tile = TILE.PILLAR; this.addProp('T_Crystal', c, r, { solid: true, glow: 0x3aa0ff }); break;
          case 'z': tile = TILE.PILLAR; this.addProp('T_Brazier', c, r, { solid: true, fire: true }); break;
          case 'S': this.addSpikes(c, r); break;
          case 'b': this.addDeco('T_Bones', x, z, rand() * 6); break;
          case 'r': this.addRune(0, z); break;
          case '@': this.start.set(x + 0.5, 0, z); break;
          // символы ниже встречаются только внутри комнат
          case '*': room!.chestSpot = { x: x + 0.5, z }; break;
          case 'g': if (c === this.half - 1) this.addGate(room!, x + 0.5, z, r); break; // одни ворота на две клетки 'gg'
          case 'd': break;
          case 'w': case 'a': case 'n': case 'h': case 'k':
            room!.spawns.push({ type: SPAWN_CODES[ch], x, z }); break;
          default: break;
        }
        this.grid[this.cellIndex(c, r)] = tile;
      }
    }
    instanced('T_Floor', floorA, this.group);
    instanced('T_FloorB', floorB, this.group);
    instanced('T_Wall', walls, this.group);
    instanced('T_Wall', lowWalls, this.group);
    this.addRock(voids);

    for (const rm of this.rooms) {
      if (!rm) continue;
      rm.zTop = this.rowToZ(rm.rowTop); rm.zBottom = this.rowToZ(rm.rowBottom);
      rm.center = new THREE.Vector3(0, 0, (rm.zTop + rm.zBottom) / 2);
      rm.chest = rm.chestSpot || { x: 0, z: rm.center.z };
    }
    // комната босса: ковёр и дверь-выход
    const boss = this.bossRoom;
    const rug = clone('T_Rug'); rug.position.set(0, 0.005, boss.center.z - 1.5); rug.scale.set(1.1, 1, 1.3); this.group.add(rug);
    this.exitDoor = clone('T_ExitDoor');
    this.exitDoor.position.set(0, 0, boss.zTop + 0.35);
    this.group.add(this.exitDoor);
    this.exitLeaves = [this.exitDoor.getObjectByName('T_ExitDoor_LeafL')!, this.exitDoor.getObjectByName('T_ExitDoor_LeafR')!];
    this.exitLight = this.addLight(0, 1.5, boss.zTop + 1.2, 0x3a8aff, 0, 7);
    this.addFireGlows();
  }

  private addProp(name: string, col: number, row: number, opt: PropOptions) {
    const o = clone(name);
    const x = this.colToX(col), z = this.rowToZ(row);
    o.position.set(x, 0, z);
    if (opt.rot) o.rotation.y = opt.rot;
    this.group.add(o);
    const p: Prop = { name, obj: o, col, row, x, z, hp: opt.breakable || 0, breakable: !!opt.breakable, room: this.roomAtRow(row) };
    this.props.set(this.cellIndex(col, row), p);
    if (opt.glow) p.light = this.addLight(x, 1.0, z, opt.glow, 3, 5);
    if (opt.fire) this.addFire({ x, y: 0.95, z, room: this.roomAtRow(row), brazier: true, phase: Math.random() * 10 });
    return p;
  }

  private addDeco(name: string, x: number, z: number, ry: number) { const o = clone(name); o.position.set(x, 0, z); o.rotation.y = ry; this.group.add(o); }

  private addRune(x: number, z: number) {
    const m = new THREE.MeshBasicMaterial({ map: TEX.rune, color: 0x3a8aff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), m);
    mesh.position.set(x, 0.02, z);
    this.group.add(mesh);
    this.addLight(x, 0.8, z, 0x3a8aff, 3, 5);
  }

  /** Зарегистрировать источник света. Какие из них получат настоящую лампу, решает LightPool. */
  addLight(x: number, y: number, z: number, color: THREE.ColorRepresentation, intensity: number, range: number): LightSource {
    const s = { x, y, z, color: new THREE.Color(color), intensity, range, flicker: false };
    this.lights.push(s);
    return s;
  }

  /** Тёмная скала поверх пустых клеток и вокруг всей карты — за пределами комнат никогда не видно пустоты. */
  private addRock(voids: { x: number; z: number; low: boolean }[]) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x12151f });
    const geos: THREE.BufferGeometry[] = [];
    const quad = (x0: number, z0: number, x1: number, z1: number, y: number) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
      g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
      geos.push(g);
    };
    const HIGH = 1.15, LOW = 0.42;
    for (const v of voids) quad(v.x - 0.5, v.z - 0.5, v.x + 0.5, v.z + 0.5, v.low ? LOW : HIGH);
    // широкие полосы скалы вокруг карты
    const x0 = -this.half, x1 = this.half, zT = this.rowToZ(0) - 0.5, zB = this.rowToZ(this.rows - 1) + 0.5, F = 40;
    quad(x0 - F, zT - F, x0, zB + F, HIGH);
    quad(x1, zT - F, x1 + F, zB + F, HIGH);
    quad(x0, zT - F, x1, zT, HIGH);
    quad(x0, zB, x1, zB + F, LOW);
    this.group.add(new THREE.Mesh(mergeGeometries(geos), mat));
  }

  private addTorch(x: number, z: number, dir: XZ, room: Room | undefined) {
    const o = clone('T_Torch');
    o.position.set(x, 0.8, z);
    o.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI; // крепление смотрит из стены
    this.group.add(o);
    const fx = x + dir.x * 0.17, fz = z + dir.z * 0.17;   // пламя чуть впереди стены
    this.addFire({ x: fx, y: 1.02, z: fz, room, phase: Math.random() * 10, obj: o, dir });
  }

  /**
   * Огонь (факел или жаровня). Настоящий свет стоит заметно дальше от стены и выше пламени,
   * с мягким затуханием — так он растекается по полу комнаты, а не бьёт пятном под факел.
   */
  private addFire(t: Torch) {
    this.torches.push(t);
    const out = t.dir ? 1.0 : 0;
    this.lights.push({
      x: t.x + (t.dir?.x ?? 0) * out, y: t.y + 1.3, z: t.z + (t.dir?.z ?? 0) * out,
      color: new THREE.Color(t.brazier ? 0xff8a34 : 0xff9a40), intensity: t.brazier ? 7 : 6, range: 10, decay: 1,
      flicker: true, phase: t.phase,
    });
  }

  private addBanner(x: number, z: number, dir: XZ) {
    const o = clone('T_Banner');
    o.position.set(x, 1.15, z);
    o.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
    this.group.add(o);
  }

  private addSpikes(col: number, row: number) {
    const o = clone('T_Spikes');
    const x = this.colToX(col), z = this.rowToZ(row);
    o.position.set(x, 0, z);
    this.group.add(o);
    const sp = o.getObjectByName('T_Spikes_Spikes')!;
    this.spikes.push({ obj: o, spikes: sp, x, z, room: this.roomAtRow(row)!, up: 0, phase: 0 });
    sp.position.y = -0.3; // спрятаны в полу
  }

  private addGate(room: Room, x: number, z: number, row: number) {
    const o = clone('T_Gate');
    o.position.set(x, 0, z);
    this.group.add(o);
    const bars = o.getObjectByName('T_Gate_Bars')!;
    bars.position.y = 1.4; // открыты: решётка поднята в стену
    bars.visible = false;
    room.gates.push({ obj: o, bars, x, z, row, closed: false, room });
  }

  setGate(gate: Gate, closed: boolean) {
    gate.closed = closed;
    for (const c of [this.half - 1, this.half]) this.grid[this.cellIndex(c, gate.row)] = closed ? TILE.GATE : TILE.FLOOR;
    gate.bars.visible = true;
  }

  openExit() {
    this.exitOpen = true;
    for (const c of [this.half - 1, this.half]) this.grid[this.cellIndex(c, this.bossRoom.rowTop)] = TILE.FLOOR;
  }

  /** У каждого огня: тёплое пятно на полу перед ним, яркое ядро пламени и большой мягкий ореол. */
  private addFireGlows() {
    for (const t of this.torches) {
      const dx = t.dir?.x ?? 0, dz = t.dir?.z ?? 0;
      const pm = new THREE.MeshBasicMaterial({ map: TEX.soft, color: 0xff8a30, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
      const size = t.brazier ? 5 : 6;
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), pm);
      pool.position.set(t.x + dx * 1.6, 0.015, t.z + dz * 1.6);
      pool.renderOrder = 3;
      this.group.add(pool);
      t.pool = pool;
      const cm = new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffd890, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const core = new THREE.Sprite(cm); core.scale.setScalar(0.55); core.position.set(t.x, t.y, t.z); core.renderOrder = 24;
      this.group.add(core); t.sprite = core;
      // ореол чуть вынесен из стены, чтобы стена его не обрезала
      const hm = new THREE.SpriteMaterial({ map: TEX.soft, color: 0xff8a30, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending });
      const halo = new THREE.Sprite(hm); halo.scale.setScalar(2.8); halo.position.set(t.x + dx * 0.4, t.y + 0.05, t.z + dz * 0.4); halo.renderOrder = 23;
      this.group.add(halo); t.halo = halo;
    }
  }

  /** Мерцание огней и редкие искры. */
  updateTorches(time: number, dt: number, fx: FX) {
    for (const t of this.torches) {
      const flicker = 0.85 + Math.sin(time * 13 + t.phase) * 0.1 + Math.sin(time * 31 + t.phase) * 0.05;
      if (t.sprite) t.sprite.scale.setScalar((t.brazier ? 0.95 : 0.65) * flicker);
      if (t.halo) t.halo.scale.setScalar((t.brazier ? 3.6 : 2.8) * (0.92 + flicker * 0.1));
      if (t.pool) t.pool.material.opacity = 0.2 * flicker;
      if (Math.random() < dt * 5) fx.burst({ x: t.x, y: t.y + 0.1, z: t.z }, { count: 1, color: 0xffa040, speed: 0.2, life: 0.6, size: 0.12, gravity: -1.5, up: 0.3 });
    }
  }

  breakProp(p: Prop) {
    this.props.delete(this.cellIndex(p.col, p.row));
    this.grid[this.cellIndex(p.col, p.row)] = TILE.FLOOR;
    this.group.remove(p.obj);
  }

  propAt(x: number, z: number) { return this.props.get(this.cellIndex(this.xToCol(x), this.zToRow(z))); }

  // ---------- физика и поиск пути ----------

  /** Выталкивает круг радиуса rad из непроходимых клеток (меняет pos). true — если было столкновение. */
  collide(pos: THREE.Vector3, rad: number) {
    let hit = false;
    const c0 = this.xToCol(pos.x), r0 = this.zToRow(pos.z);
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        if (this.tileAt(c, r) === TILE.FLOOR) continue;
        // ближайшая к центру круга точка клетки
        const minx = c - this.half, maxx = minx + 1, minz = r + this.zOffset - 0.5, maxz = minz + 1;
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

  /** Есть ли прямая видимость (ничего не стоит на пути выстрела). */
  hasLineOfSight(a: XZ, b: XZ) {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    const n = Math.ceil(d / 0.25);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.blocksShots(a.x + dx * t, a.z + dz * t)) return false;
    }
    return true;
  }

  /** Есть ли проход шириной с персонажа (радиус ~0.3) по прямой. */
  private hasWidePath(a: XZ, b: XZ) {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < 0.01) return true;
    const px = -dz / d * 0.3, pz = dx / d * 0.3;
    const n = Math.ceil(d / 0.3);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = a.x + dx * t, z = a.z + dz * t;
      if (this.isSolid(x + px, z + pz) || this.isSolid(x - px, z - pz)) return false;
    }
    return true;
  }

  /**
   * Карта расстояний (поиск в ширину) от каждой клетки до целевой.
   * Кэшируется на 250 мс — все враги, идущие к герою, пользуются одной картой.
   */
  private distanceField(targetCol: number, targetRow: number) {
    const key = targetCol + ',' + targetRow;
    const now = performance.now();
    const cached = this.flowCache.get(key);
    if (cached && now - cached.time < 250) return cached.dist;
    const dist = new Int16Array(this.cols * this.rows).fill(-1);
    const q = this.bfsQueue; let qn = 0;
    q[qn++] = this.cellIndex(targetCol, targetRow); dist[q[0]] = 0;
    let head = 0;
    while (head < qn) {
      const i = q[head++]; const c = i % this.cols, r = (i / this.cols) | 0;
      for (const [dc, dr] of DIRS4) {
        const nc = c + dc, nr = r + dr;
        if (this.tileAt(nc, nr) !== TILE.FLOOR) continue;
        const ni = this.cellIndex(nc, nr);
        if (dist[ni] >= 0) continue;
        dist[ni] = dist[i] + 1; q[qn++] = ni;
      }
    }
    this.flowCache.set(key, { time: now, dist });
    if (this.flowCache.size > 40) this.flowCache.delete(this.flowCache.keys().next().value!);
    return dist;
  }

  /** Куда шагать из pos, чтобы дойти до target. Если путь прямой — прямо, иначе по карте расстояний. */
  pathDirection(pos: THREE.Vector3, target: THREE.Vector3, out: THREE.Vector3) {
    if (this.hasLineOfSight(pos, target) && this.hasWidePath(pos, target)) {
      out.set(target.x - pos.x, 0, target.z - pos.z); const l = out.length(); if (l > 1e-4) out.multiplyScalar(1 / l); return out;
    }
    const dist = this.distanceField(this.xToCol(target.x), this.zToRow(target.z));
    const c = this.xToCol(pos.x), r = this.zToRow(pos.z);
    // соседняя клетка с наименьшим расстоянием до цели (по диагонали — только если не срезаем угол)
    let best = dist[this.cellIndex(c, r)], bc = c, br = r;
    for (const [dc, dr] of DIRS8) {
      const nc = c + dc, nr = r + dr;
      if (this.tileAt(nc, nr) !== TILE.FLOOR) continue;
      if (dc && dr && (this.tileAt(c + dc, r) !== TILE.FLOOR || this.tileAt(c, r + dr) !== TILE.FLOOR)) continue;
      const v = dist[this.cellIndex(nc, nr)];
      if (v >= 0 && (best < 0 || v < best)) { best = v; bc = nc; br = nr; }
    }
    out.set(this.colToX(bc) - pos.x, 0, this.rowToZ(br) - pos.z);
    const l = out.length(); if (l > 1e-4) out.multiplyScalar(1 / l);
    return out;
  }

  /** Все клетки пола внутри комнаты (без стен). */
  floorCells(room: Room) {
    const out: THREE.Vector3[] = [];
    for (let r = room.rowTop + 1; r < room.rowBottom; r++)
      for (let c = 1; c < this.cols - 1; c++) if (this.tileAt(c, r) === TILE.FLOOR) out.push(new THREE.Vector3(this.colToX(c), 0, this.rowToZ(r)));
    return out;
  }
}

/** Простой генератор случайных чисел с зерном (одинаковый результат при каждом запуске). */
export function mulberry(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
