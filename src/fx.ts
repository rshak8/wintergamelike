import * as THREE from 'three';

/** A point in the world; y is optional (each effect picks its own default height). */
export interface XYZ { x: number; y?: number; z: number }
/** A direction on the ground plane. */
export interface XZ { x: number; z: number }

// ---------- canvas textures ----------
function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type TexName = 'dot' | 'glow' | 'soft' | 'shadow' | 'ring' | 'scorch' | 'holy' | 'rune' | 'spawn' | 'crescent';
/** Filled when FX is created (before the world and characters are built). */
export const TEX = {} as Record<TexName, THREE.CanvasTexture>;

function makeTextures() {
  TEX.dot = canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  TEX.glow = canvasTex(128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  // gaussian-like falloff with no visible edge: light pools and halos
  TEX.soft = canvasTex(256, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      gr.addColorStop(t, `rgba(255,255,255,${(Math.exp(-t * t * 5) * (1 - t)).toFixed(4)})`);
    }
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  TEX.shadow = canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.65)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  TEX.ring = canvasTex(128, (g, s) => {
    g.strokeStyle = 'white'; g.lineWidth = s * 0.06; g.shadowColor = 'white'; g.shadowBlur = s * 0.05;
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2); g.stroke();
  });
  TEX.scorch = canvasTex(128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(20,10,5,0.85)'); gr.addColorStop(0.5, 'rgba(20,10,5,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * 6.28; g.beginPath(); g.moveTo(s / 2, s / 2);
      let x = s / 2, y = s / 2;
      for (let k = 0; k < 4; k++) { x += Math.cos(a + (Math.random() - 0.5)) * s * 0.11; y += Math.sin(a + (Math.random() - 0.5)) * s * 0.11; g.lineTo(x, y); }
      g.stroke();
    }
  });
  TEX.holy = canvasTex(256, (g, s) => {
    const c = s / 2;
    g.translate(c, c);
    g.strokeStyle = 'white'; g.shadowColor = 'white'; g.shadowBlur = 12;
    g.lineWidth = 6; g.beginPath(); g.arc(0, 0, s * 0.44, 0, 6.283); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(0, 0, s * 0.36, 0, 6.283); g.stroke();
    for (let i = 0; i < 8; i++) {
      g.save(); g.rotate(i * Math.PI / 4);
      g.lineWidth = 5; g.beginPath(); g.moveTo(0, s * 0.12); g.lineTo(0, s * 0.34); g.stroke();
      g.restore();
    }
    g.lineWidth = 7; g.beginPath(); g.moveTo(0, -s * 0.2); g.lineTo(0, s * 0.2); g.moveTo(-s * 0.13, -s * 0.06); g.lineTo(s * 0.13, -s * 0.06); g.stroke();
    // cracks
    g.lineWidth = 2; g.shadowBlur = 4;
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * 6.28; let x = Math.cos(a) * s * 0.2, y = Math.sin(a) * s * 0.2;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 3; k++) { x += Math.cos(a + (Math.random() - 0.5)) * s * 0.07; y += Math.sin(a + (Math.random() - 0.5)) * s * 0.07; g.lineTo(x, y); }
      g.stroke();
    }
  });
  TEX.rune = canvasTex(256, (g, s) => {
    const c = s / 2; g.translate(c, c);
    g.strokeStyle = 'white'; g.shadowColor = 'white'; g.shadowBlur = 10; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, -s * 0.42); g.lineTo(s * 0.42, 0); g.lineTo(0, s * 0.42); g.lineTo(-s * 0.42, 0); g.closePath(); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(0, 0, s * 0.22, 0, 6.283); g.stroke();
    g.fillStyle = 'white'; g.beginPath(); g.moveTo(0, -s * 0.12); g.lineTo(s * 0.12, 0); g.lineTo(0, s * 0.12); g.lineTo(-s * 0.12, 0); g.fill();
  });
  TEX.spawn = canvasTex(256, (g, s) => {
    const c = s / 2; g.translate(c, c);
    g.strokeStyle = 'white'; g.shadowColor = 'white'; g.shadowBlur = 8;
    g.lineWidth = 6; g.beginPath(); g.arc(0, 0, s * 0.43, 0, 6.283); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(0, 0, s * 0.34, 0, 6.283); g.stroke();
    for (let i = 0; i < 5; i++) {
      const a = i * 2 * Math.PI / 5 * 2 - Math.PI / 2, b = (i + 1) * 2 * Math.PI / 5 * 2 - Math.PI / 2;
      g.beginPath(); g.moveTo(Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34); g.lineTo(Math.cos(b) * s * 0.34, Math.sin(b) * s * 0.34); g.stroke();
    }
  });
  TEX.crescent = canvasTex(128, (g, s) => {
    g.fillStyle = 'white'; g.shadowColor = 'white'; g.shadowBlur = 10;
    g.beginPath(); g.arc(s * 0.5, s * 0.62, s * 0.42, Math.PI * 1.1, Math.PI * 1.9); g.arc(s * 0.5, s * 0.78, s * 0.42, Math.PI * 1.82, Math.PI * 1.18, true); g.fill();
  });
}

// ---------- particle system (Points, CPU sim) ----------
const PVERT = `
attribute float aSize; attribute vec4 aColor;
varying vec4 vColor; uniform float uScale;
void main(){ vColor = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0);
 gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const PFRAG = `
uniform sampler2D uTex; varying vec4 vColor;
void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vColor.rgb, vColor.a * t.a); if(gl_FragColor.a<0.01) discard; }`;

class Particles {
  max: number; n = 0;
  pos: Float32Array; vel: Float32Array;
  col: Float32Array; size: Float32Array;
  life: Float32Array; maxLife: Float32Array;
  s0: Float32Array; grav: Float32Array; drag: Float32Array;
  base: Float32Array;
  pa: THREE.BufferAttribute; ca: THREE.BufferAttribute; sa: THREE.BufferAttribute;
  mat: THREE.ShaderMaterial;
  points: THREE.Points;

  constructor(scene: THREE.Scene, max: number, additive: boolean) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    this.base = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.pos, 3); this.pa.setUsage(THREE.DynamicDrawUsage);
    this.ca = new THREE.BufferAttribute(this.col, 4); this.ca.setUsage(THREE.DynamicDrawUsage);
    this.sa = new THREE.BufferAttribute(this.size, 1); this.sa.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pa); geo.setAttribute('aColor', this.ca); geo.setAttribute('aSize', this.sa);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uTex: { value: TEX.dot }, uScale: { value: 400 } },
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 15;
    scene.add(this.points);
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: THREE.Color, size: number, life: number, grav: number, drag: number) {
    const i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.base[i * 3] = color.r; this.base[i * 3 + 1] = color.g; this.base[i * 3 + 2] = color.b;
    this.s0[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt: number) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.copy(this.n - 1, i); this.n--; continue; }
      const k = i * 3;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[k] *= d; this.vel[k + 1] = this.vel[k + 1] * d - this.grav[i] * dt; this.vel[k + 2] *= d;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0.02 && this.grav[i] > 0) { this.pos[k + 1] = 0.02; this.vel[k + 1] *= -0.35; this.vel[k] *= 0.6; this.vel[k + 2] *= 0.6; }
      const t = this.life[i] / this.maxLife[i];
      const a = Math.min(1, t * 2.5);
      this.col[i * 4] = this.base[k]; this.col[i * 4 + 1] = this.base[k + 1]; this.col[i * 4 + 2] = this.base[k + 2]; this.col[i * 4 + 3] = a;
      this.size[i] = this.s0[i] * (0.35 + 0.65 * t);
      i++;
    }
    this.points.geometry.setDrawRange(0, this.n);
    // upload only the live part of each buffer
    this.pa.clearUpdateRanges(); this.pa.addUpdateRange(0, this.n * 3); this.pa.needsUpdate = true;
    this.ca.clearUpdateRanges(); this.ca.addUpdateRange(0, this.n * 4); this.ca.needsUpdate = true;
    this.sa.clearUpdateRanges(); this.sa.addUpdateRange(0, this.n); this.sa.needsUpdate = true;
  }
  copy(from: number, to: number) {
    for (let c = 0; c < 3; c++) {
      this.pos[to * 3 + c] = this.pos[from * 3 + c]; this.vel[to * 3 + c] = this.vel[from * 3 + c]; this.base[to * 3 + c] = this.base[from * 3 + c];
    }
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from]; this.s0[to] = this.s0[from];
    this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from];
  }
}

// ---------- telegraph shader (danger zones on the floor) ----------
const TELE_FRAG = `
varying vec2 vUv; uniform vec3 uColor; uniform float uProg; uniform float uMode; uniform float uAngle; uniform float uAlpha;
void main(){
  vec2 p = vUv*2.0-1.0; float a = 0.0;
  if(uMode < 0.5){ // circle
    float r = length(p); if(r>1.0) discard;
    float edge = smoothstep(0.9,1.0,r); float fill = step(r, uProg);
    a = 0.13 + edge*0.65 + fill*0.2;
  } else if(uMode < 1.5){ // sector, +y forward
    float r = length(p); float ang = abs(atan(p.x, p.y)); if(r>1.0 || ang>uAngle) discard;
    float edge = max(smoothstep(0.9,1.0,r), smoothstep(uAngle-0.08,uAngle,ang));
    float fill = step(r, uProg);
    a = 0.12 + edge*0.65 + fill*0.2;
  } else { // rect, extends along +y from bottom
    float yy = vUv.y; float edge = max(smoothstep(0.85,1.0,abs(p.x)), smoothstep(0.96,1.0,yy));
    float fill = step(yy, uProg);
    a = 0.14 + edge*0.55 + fill*0.24;
  }
  gl_FragColor = vec4(uColor, a*uAlpha);
}`;
const TELE_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `;

// ---------- slash arc shader ----------
const ARC_FRAG = `
varying vec2 vUv; uniform vec3 uColor; uniform float uT; uniform float uSweep;
void main(){
  // vUv.x: 0..1 along arc, vUv.y: 0 inner .. 1 outer
  float head = uSweep; float x = vUv.x;
  if (x > head) discard;
  float tail = clamp(1.0 - (head - x) * 2.2, 0.0, 1.0);
  float band = smoothstep(0.0, 0.5, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
  float core = smoothstep(0.6, 0.95, vUv.y) * (1.0 - smoothstep(0.95, 1.0, vUv.y));
  float a = (band * 0.7 + core) * tail * (1.0 - uT);
  vec3 c = mix(uColor * 1.6, vec3(1.0, 0.95, 0.85), core * 0.3);
  gl_FragColor = vec4(c * a, a);
}`;

// Effect materials are made by these helpers only, so prewarm() can build the exact same shaders.
function teleMaterial(color: THREE.ColorRepresentation, mode: number, halfAngle: number) {
  return new THREE.ShaderMaterial({
    vertexShader: TELE_VERT, fragmentShader: TELE_FRAG, transparent: true, depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uProg: { value: 0 }, uMode: { value: mode }, uAngle: { value: halfAngle }, uAlpha: { value: 1 } },
  });
}
function arcMaterial(color: THREE.ColorRepresentation) {
  return new THREE.ShaderMaterial({
    vertexShader: TELE_VERT, fragmentShader: ARC_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uT: { value: 0 }, uSweep: { value: 0 } },
  });
}
/** Flat additive colour, both sides: stab streaks and lightning ribbons. */
function streakMaterial(color: THREE.ColorRepresentation, opacity: number) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}

function arcGeometry(inner: number, outer: number, angle: number, seg = 20) {
  const g = new THREE.BufferGeometry();
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = -angle / 2 + angle * t;
    // +Z forward in local space
    pos.push(Math.sin(a) * inner, 0, Math.cos(a) * inner, Math.sin(a) * outer, 0, Math.cos(a) * outer);
    uv.push(t, 0, t, 1);
    if (i < seg) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** An effect object that lives for a while; update runs every frame until life runs out. */
export interface TimedItem {
  obj: THREE.Object3D;
  life: number;
  max: number;
  update?: (dt: number, it: TimedItem) => void;
  onEnd?: () => void;
  dead: boolean;
  mesh?: THREE.Mesh;  // telegraphs: the floor mesh (enemies re-aim it)
  landed?: boolean;   // dropIn: the object has hit the floor
}

export interface BurstOpts {
  count?: number; color?: THREE.ColorRepresentation; speed?: number; life?: number; size?: number;
  gravity?: number; up?: number; spread?: number; additive?: boolean; drag?: number;
  dir?: XZ | null; jitter?: number; colorVar?: number;
}

export interface DecalOpts {
  tex?: THREE.Texture; size?: number; color?: THREE.ColorRepresentation; life?: number; additive?: boolean;
  opacity?: number; rot?: number; grow?: number; fadeIn?: number; y?: number;
}

export interface TelegraphOpts {
  shape?: 'circle' | 'sector' | 'rect';
  pos: XZ; dir?: XZ;
  radius?: number; angle?: number; length?: number; width?: number;
  time?: number; color?: THREE.ColorRepresentation;
  follow?: ((mesh: THREE.Mesh) => void) | null;
}

export interface TextOpts { color?: string; size?: number; crit?: boolean; life?: number; rise?: number }

interface FloatingText { el: HTMLDivElement; x: number; y: number; z: number; life: number; max: number; rise: number; vx: number }

export class FX {
  scene: THREE.Scene; camera: THREE.Camera;
  add: Particles; norm: Particles;
  items: TimedItem[] = [];
  shakeT = 0; shakeAmt = 0;
  hitstopT = 0;
  timeScale = 1; slowT = 0; slowScale = 1;
  layer: HTMLElement;
  texts: FloatingText[] = [];
  planeGeo: THREE.BufferGeometry;
  _c = new THREE.Color();
  _v = new THREE.Vector3();

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    makeTextures();
    this.scene = scene; this.camera = camera;
    this.add = new Particles(scene, 2500, true);
    this.norm = new Particles(scene, 1200, false);
    this.layer = document.getElementById('fxLayer')!;
    this.planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  }

  setScale(h: number, fov: number) {
    const s = h / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
    this.add.mat.uniforms.uScale.value = s;
    this.norm.mat.uniforms.uScale.value = s;
  }

  /**
   * Compile every shader the effects (and `extra` objects) use, once, at load time.
   * Short-lived effects dispose their materials; when the last user of a shader goes away,
   * three.js drops the compiled program and the next slash would compile it again mid-fight.
   * The sample objects made here are never disposed, so every program stays alive.
   */
  prewarm(renderer: THREE.WebGLRenderer, camera: THREE.Camera, extra: THREE.Object3D[], target: THREE.WebGLRenderTarget) {
    const keep = new THREE.Group();
    keep.add(
      new THREE.Mesh(this.planeGeo, teleMaterial(0xffffff, 0, 1)),
      new THREE.Mesh(this.planeGeo, arcMaterial(0xffffff)),
      new THREE.Mesh(this.planeGeo, streakMaterial(0xffffff, 1)),
      ...extra,
    );
    keep.traverse((o) => { o.frustumCulled = false; });
    // Draw everything once, inside the real scene (same lights) and into the post-processing
    // target (same colour/tone settings as every frame), so shaders compile and models upload now.
    const prev = renderer.getRenderTarget();
    this.scene.add(keep);
    renderer.setRenderTarget(target);
    renderer.compile(this.scene, camera);
    renderer.render(this.scene, camera);
    renderer.setRenderTarget(prev);
    this.scene.remove(keep);
    this.warm = keep; // never disposed: keeps one user of every shader alive
  }
  warm: THREE.Group | null = null;

  // ---- particles ----
  burst(p: XYZ, o: BurstOpts = {}) {
    const {
      count = 10, color = 0xffffff, speed = 3, life = 0.5, size = 0.25, gravity = 6, up = 2, spread = 1,
      additive = true, drag = 2, dir = null, jitter = 0.1, colorVar = 0,
    } = o;
    const sys = additive ? this.add : this.norm;
    const c = this._c.set(color);
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
      if (colorVar) { cc = this._c.clone().offsetHSL((Math.random() - 0.5) * colorVar, 0, (Math.random() - 0.5) * colorVar); }
      sys.spawn(p.x + (Math.random() - 0.5) * jitter, (p.y ?? 0.5) + (Math.random() - 0.5) * jitter, p.z + (Math.random() - 0.5) * jitter,
        vx, up * (0.5 + Math.random()), vz, cc, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.8), gravity, drag);
    }
  }

  spark(p: XYZ, color: THREE.ColorRepresentation, n = 8, speed = 6) { this.burst(p, { count: n, color, speed, life: 0.3, size: 0.14, gravity: 10, up: 3, drag: 3 }); }

  // ---- generic timed items ----
  timed(obj: THREE.Object3D, life: number, update?: TimedItem['update'], onEnd?: () => void): TimedItem {
    this.scene.add(obj);
    const it: TimedItem = { obj, life, max: life, update, onEnd, dead: false };
    this.items.push(it);
    return it;
  }
  kill(it: TimedItem | null | undefined) { if (it) it.life = 0; }

  decal(p: XZ, { tex = TEX.glow, size = 1, color = 0xffffff, life = 1, additive = true, opacity = 1, rot = 0, grow = 0, fadeIn = 0, y = 0.02 }: DecalOpts = {}) {
    const m = new THREE.MeshBasicMaterial({
      map: tex, color, transparent: true, depthWrite: false, opacity,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(this.planeGeo, m);
    mesh.position.set(p.x, y, p.z);
    mesh.rotation.y = rot;
    mesh.scale.setScalar(size);
    mesh.renderOrder = 5;
    return this.timed(mesh, life, (t, it) => {
      const k = 1 - it.life / it.max;
      const fi = fadeIn > 0 ? Math.min(1, (it.max - it.life) / fadeIn) : 1;
      m.opacity = opacity * fi * Math.min(1, it.life / Math.min(0.6, it.max * 0.6));
      if (grow) mesh.scale.setScalar(size * (1 + grow * k));
    }, () => m.dispose());
  }

  ring(p: XZ, { radius = 2, color = 0xffffff as THREE.ColorRepresentation, life = 0.4, y = 0.05, width = 1 } = {}) {
    const m = new THREE.MeshBasicMaterial({ map: TEX.ring, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(this.planeGeo, m);
    mesh.position.set(p.x, y, p.z);
    mesh.renderOrder = 6;
    return this.timed(mesh, life, (t, it) => {
      const k = 1 - it.life / it.max;
      const e = 1 - Math.pow(1 - k, 3);
      mesh.scale.setScalar(Math.max(0.01, radius * 2 * e * 1.15));
      m.opacity = (1 - k) * width;
    }, () => m.dispose());
  }

  /** Ground danger telegraph. shape: circle|sector|rect. Returns item; progress fills over `time`. */
  telegraph({ shape = 'circle', pos, dir = { x: 0, z: 1 }, radius = 1, angle = 1, length = 3, width = 1, time = 0.6, color = 0xff2a2a, follow = null }: TelegraphOpts) {
    const mat = teleMaterial(color, shape === 'circle' ? 0 : shape === 'sector' ? 1 : 2, angle / 2);
    let geo;
    if (shape === 'rect') { geo = new THREE.PlaneGeometry(width, length).rotateX(-Math.PI / 2).translate(0, 0, -length / 2); }
    else { geo = this.planeGeo; }
    const mesh = new THREE.Mesh(geo, mat);
    // plane UV: v=1 is -Z after rotateX(-PI/2); flip so +y in shader = +Z (forward)
    mesh.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
    if (shape !== 'rect') mesh.scale.setScalar(radius * 2);
    mesh.position.set(pos.x, 0.03, pos.z);
    mesh.renderOrder = 4;
    const it = this.timed(mesh, time + 0.12, (t, it) => {
      const k = Math.min(1, (it.max - it.life) / time);
      mat.uniforms.uProg.value = k;
      mat.uniforms.uAlpha.value = it.life < 0.12 ? it.life / 0.12 : Math.min(1, (it.max - it.life) * 8);
      if (follow) { follow(mesh); }
    }, () => { mat.dispose(); if (shape === 'rect') geo.dispose(); });
    it.mesh = mesh;
    return it;
  }

  /** Melee slash arc around p, facing dir. */
  arc(p: XZ, dir: XZ, { radius = 1.8, inner = 0.4, angle = 2.2, color = 0xffffff as THREE.ColorRepresentation, life = 0.22, y = 0.55, flip = false, tilt = 0 } = {}) {
    const geo = arcGeometry(inner, radius, angle);
    const mat = arcMaterial(color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, y, p.z);
    mesh.rotation.y = Math.atan2(dir.x, dir.z);
    if (flip) mesh.scale.x = -1;
    mesh.rotation.z = tilt;
    mesh.renderOrder = 22;
    return this.timed(mesh, life, (t, it) => {
      const k = 1 - it.life / it.max;
      mat.uniforms.uSweep.value = Math.min(1, k * 2.6);
      mat.uniforms.uT.value = Math.max(0, (k - 0.35) / 0.65);
    }, () => { geo.dispose(); mat.dispose(); });
  }

  /** Thrust streak (stab). */
  thrust(p: XZ, dir: XZ, { length = 1.8, width = 0.5, color = 0xffffff as THREE.ColorRepresentation, life = 0.16, y = 0.55 } = {}) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0); shape.lineTo(0, length); shape.lineTo(width / 2, 0); shape.lineTo(0, -0.15);
    const geo = new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2);
    const mat = streakMaterial(color, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, y, p.z);
    mesh.rotation.y = Math.atan2(dir.x, dir.z);
    mesh.renderOrder = 22;
    return this.timed(mesh, life, (t, it) => {
      const k = 1 - it.life / it.max;
      mesh.scale.set(1 - k * 0.6, 1, 0.6 + k * 0.6);
      mat.opacity = 1 - k;
    }, () => { geo.dispose(); mat.dispose(); });
  }

  /** Jagged lightning ribbon through points. */
  bolt(points: THREE.Vector3[], { color = 0xa57bff as THREE.ColorRepresentation, life = 0.22, width = 0.22, jag = 0.35 } = {}) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const segs = Math.max(3, Math.floor(a.distanceTo(b) / 0.35));
      for (let s = 0; s < segs; s++) {
        const t = s / segs;
        const q = a.clone().lerp(b, t);
        if (s > 0) { q.x += (Math.random() - 0.5) * jag; q.z += (Math.random() - 0.5) * jag; q.y += (Math.random() - 0.5) * jag * 0.5; }
        pts.push(q);
      }
    }
    pts.push(points[points.length - 1].clone());
    const build = (w: number, col: THREE.ColorRepresentation, op: number) => {
      const pos: number[] = [], idx: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], n = pts[Math.min(pts.length - 1, i + 1)], pr = pts[Math.max(0, i - 1)];
        const d = n.clone().sub(pr); d.y = 0; d.normalize();
        const side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(w / 2);
        pos.push(p.x - side.x, p.y + 0.02, p.z - side.z, p.x + side.x, p.y + 0.02, p.z + side.z);
        if (i < pts.length - 1) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      return new THREE.Mesh(g, streakMaterial(col, op));
    };
    const grp = new THREE.Group();
    const glow = build(width * 3, color, 0.45), core = build(width * 0.7, 0xffffff, 1);
    grp.add(glow, core);
    grp.renderOrder = 23;
    return this.timed(grp, life, (t, it) => {
      const k = it.life / it.max;
      glow.material.opacity = 0.45 * k; core.material.opacity = k;
      core.visible = glow.visible = Math.random() > 0.15 || k > 0.7;
    }, () => { [glow, core].forEach((m) => { m.geometry.dispose(); m.material.dispose(); }); });
  }

  /** Billboard glow sprite (for flashes, muzzle, light pools) */
  flash(p: XYZ, { color = 0xffffff as THREE.ColorRepresentation, size = 1.5, life = 0.15, y = 0.6 } = {}) {
    const m = new THREE.SpriteMaterial({ map: TEX.glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(m);
    s.position.set(p.x, p.y ?? y, p.z); s.scale.setScalar(size); s.renderOrder = 25;
    return this.timed(s, life, (t, it) => {
      const k = it.life / it.max; m.opacity = k; s.scale.setScalar(size * (1.2 - 0.4 * k));
    }, () => m.dispose());
  }

  // ---- damage numbers (DOM) ----
  text(p: XYZ, str: string, { color = '#fff', size = 22, crit = false, life = 0.75, rise = 1.2 }: TextOpts = {}) {
    const el = document.createElement('div');
    el.className = 'dmg' + (crit ? ' crit' : '');
    el.textContent = str;
    el.style.color = color;
    el.style.fontSize = size + 'px';
    this.layer.appendChild(el);
    this.texts.push({ el, x: p.x + (Math.random() - 0.5) * 0.3, y: (p.y ?? 1.2), z: p.z, life, max: life, rise, vx: (Math.random() - 0.5) * 0.8 });
  }

  shake(a: number) { this.shakeAmt = Math.min(1, Math.max(this.shakeAmt, a)); }
  hitstop(ms: number) { this.hitstopT = Math.max(this.hitstopT, ms / 1000); }
  slowmo(t: number, scale = 0.25) { this.slowT = t; this.slowScale = scale; }

  /** returns scaled dt for the game simulation */
  step(realDt: number) {
    if (this.hitstopT > 0) { this.hitstopT -= realDt; return 0; }
    if (this.slowT > 0) { this.slowT -= realDt; return realDt * this.slowScale; }
    return realDt;
  }

  update(dt: number, realDt: number, w: number, h: number) {
    this.add.update(dt); this.norm.update(dt);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.life <= 0) {
        this.scene.remove(it.obj); it.onEnd?.(); this.items.splice(i, 1); continue;
      }
      it.update?.(dt, it);
    }
    // texts
    const v = this._v;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= realDt;
      if (t.life <= 0) { t.el.remove(); this.texts.splice(i, 1); continue; }
      const k = 1 - t.life / t.max;
      v.set(t.x + t.vx * k, t.y + t.rise * (1 - Math.pow(1 - k, 2)), t.z).project(this.camera);
      const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
      const pop = k < 0.15 ? 0.6 + k / 0.15 * 0.7 : 1.3 - Math.min(0.3, (k - 0.15) * 1.5);
      t.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-50%) scale(${pop})`;
      t.el.style.opacity = String(t.life < 0.25 ? t.life / 0.25 : 1);
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - realDt * 2.2);
  }

  shakeOffset(t: number) {
    const a = this.shakeAmt * this.shakeAmt * 0.35;
    return { x: (Math.sin(t * 91) + Math.sin(t * 57)) * 0.5 * a, z: (Math.cos(t * 83) + Math.sin(t * 41)) * 0.5 * a };
  }
}
