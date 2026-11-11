import * as THREE from 'three';

// ---------- canvas textures ----------
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const TEX = {};
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
  constructor(scene, max, additive) {
    this.max = max; this.n = 0;
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
  spawn(x, y, z, vx, vy, vz, color, size, life, grav, drag) {
    let i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.base[i * 3] = color.r; this.base[i * 3 + 1] = color.g; this.base[i * 3 + 2] = color.b;
    this.s0[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
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
    this.pa.needsUpdate = true; this.ca.needsUpdate = true; this.sa.needsUpdate = true;
  }
  copy(from, to) {
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

function arcGeometry(inner, outer, angle, seg = 20) {
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], idx = [];
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

export class FX {
  constructor(scene, camera) {
    makeTextures();
    this.scene = scene; this.camera = camera;
    this.add = new Particles(scene, 2500, true);
    this.norm = new Particles(scene, 1200, false);
    this.items = []; // timed objects {obj, life, max, update(t)}
    this.shakeT = 0; this.shakeAmt = 0;
    this.hitstopT = 0;
    this.timeScale = 1; this.slowT = 0;
    this.layer = document.getElementById('fxLayer');
    this.texts = [];
    this.planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this._c = new THREE.Color();
    this._v = new THREE.Vector3();
  }

  setScale(h, fov) {
    const s = h / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
    this.add.mat.uniforms.uScale.value = s;
    this.norm.mat.uniforms.uScale.value = s;
  }

  // ---- particles ----
  burst(p, o = {}) {
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

  spark(p, color, n = 8, speed = 6) { this.burst(p, { count: n, color, speed, life: 0.3, size: 0.14, gravity: 10, up: 3, drag: 3 }); }

  // ---- generic timed items ----
  timed(obj, life, update, onEnd) {
    this.scene.add(obj);
    const it = { obj, life, max: life, update, onEnd, dead: false };
    this.items.push(it);
    return it;
  }
  kill(it) { if (it) it.life = 0; }

  decal(p, { tex = TEX.glow, size = 1, color = 0xffffff, life = 1, additive = true, opacity = 1, rot = 0, grow = 0, fadeIn = 0, y = 0.02 } = {}) {
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

  ring(p, { radius = 2, color = 0xffffff, life = 0.4, y = 0.05, width = 1 } = {}) {
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
  telegraph({ shape = 'circle', pos, dir = { x: 0, z: 1 }, radius = 1, angle = 1, length = 3, width = 1, time = 0.6, color = 0xff2a2a, follow = null }) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: TELE_VERT, fragmentShader: TELE_FRAG, transparent: true, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(color) }, uProg: { value: 0 }, uMode: { value: shape === 'circle' ? 0 : shape === 'sector' ? 1 : 2 }, uAngle: { value: angle / 2 }, uAlpha: { value: 1 } },
    });
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
  arc(p, dir, { radius = 1.8, inner = 0.4, angle = 2.2, color = 0xffffff, life = 0.22, y = 0.55, flip = false, tilt = 0 } = {}) {
    const geo = arcGeometry(inner, radius, angle);
    const mat = new THREE.ShaderMaterial({
      vertexShader: TELE_VERT, fragmentShader: ARC_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(color) }, uT: { value: 0 }, uSweep: { value: 0 } },
    });
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
  thrust(p, dir, { length = 1.8, width = 0.5, color = 0xffffff, life = 0.16, y = 0.55 } = {}) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0); shape.lineTo(0, length); shape.lineTo(width / 2, 0); shape.lineTo(0, -0.15);
    const geo = new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: null, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
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

  /** Jagged lightning ribbon through points (array of Vector3). */
  bolt(points, { color = 0xa57bff, life = 0.22, width = 0.22, jag = 0.35 } = {}) {
    const pts = [];
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
    const build = (w, col, op) => {
      const pos = [], idx = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], n = pts[Math.min(pts.length - 1, i + 1)], pr = pts[Math.max(0, i - 1)];
        const d = n.clone().sub(pr); d.y = 0; d.normalize();
        const side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(w / 2);
        pos.push(p.x - side.x, p.y + 0.02, p.z - side.z, p.x + side.x, p.y + 0.02, p.z + side.z);
        if (i < pts.length - 1) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      return new THREE.Mesh(g, m);
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
  flash(p, { color = 0xffffff, size = 1.5, life = 0.15, y = 0.6 } = {}) {
    const m = new THREE.SpriteMaterial({ map: TEX.glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(m);
    s.position.set(p.x, p.y ?? y, p.z); s.scale.setScalar(size); s.renderOrder = 25;
    return this.timed(s, life, (t, it) => {
      const k = it.life / it.max; m.opacity = k; s.scale.setScalar(size * (1.2 - 0.4 * k));
    }, () => m.dispose());
  }

  // ---- damage numbers (DOM) ----
  text(p, str, { color = '#fff', size = 22, crit = false, life = 0.75, rise = 1.2 } = {}) {
    const el = document.createElement('div');
    el.className = 'dmg' + (crit ? ' crit' : '');
    el.textContent = str;
    el.style.color = color;
    el.style.fontSize = size + 'px';
    this.layer.appendChild(el);
    this.texts.push({ el, x: p.x + (Math.random() - 0.5) * 0.3, y: (p.y ?? 1.2), z: p.z, life, max: life, rise, vx: (Math.random() - 0.5) * 0.8 });
  }

  shake(a) { this.shakeAmt = Math.min(1, Math.max(this.shakeAmt, a)); }
  hitstop(ms) { this.hitstopT = Math.max(this.hitstopT, ms / 1000); }
  slowmo(t, scale = 0.25) { this.slowT = t; this.slowScale = scale; }

  /** returns scaled dt for the game simulation */
  step(realDt) {
    if (this.hitstopT > 0) { this.hitstopT -= realDt; return 0; }
    if (this.slowT > 0) { this.slowT -= realDt; return realDt * this.slowScale; }
    return realDt;
  }

  update(dt, realDt, w, h) {
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
      t.el.style.opacity = t.life < 0.25 ? t.life / 0.25 : 1;
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - realDt * 2.2);
  }

  shakeOffset(t) {
    const a = this.shakeAmt * this.shakeAmt * 0.35;
    return { x: (Math.sin(t * 91) + Math.sin(t * 57)) * 0.5 * a, z: (Math.cos(t * 83) + Math.sin(t * 41)) * 0.5 * a };
  }
}
