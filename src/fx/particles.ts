// Система частиц: тысячи точек в одном объекте Points, физика считается на процессоре.
import * as THREE from 'three';
import { TEX } from './textures';

const VERT = `
attribute float aSize; attribute vec4 aColor;
varying vec4 vColor; uniform float uScale;
void main(){ vColor = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0);
 gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const FRAG = `
uniform sampler2D uTex; varying vec4 vColor;
void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vColor.rgb, vColor.a * t.a); if(gl_FragColor.a<0.01) discard; }`;

/**
 * Живые частицы лежат в начале массивов (0..count-1). Умершая частица
 * заменяется последней живой, так что массивы никогда не «дырявые».
 */
export class Particles {
  readonly max: number;
  count = 0;
  private pos: Float32Array; private vel: Float32Array;
  private rgba: Float32Array; private size: Float32Array;     // то, что уходит в шейдер
  private life: Float32Array; private maxLife: Float32Array;
  private baseSize: Float32Array; private gravity: Float32Array; private drag: Float32Array;
  private baseColor: Float32Array;
  private posAttr: THREE.BufferAttribute; private colorAttr: THREE.BufferAttribute; private sizeAttr: THREE.BufferAttribute;
  readonly material: THREE.ShaderMaterial;
  readonly points: THREE.Points;

  constructor(scene: THREE.Scene, max: number, additive: boolean) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.rgba = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max); this.gravity = new Float32Array(max); this.drag = new Float32Array(max);
    this.baseColor = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colorAttr = new THREE.BufferAttribute(this.rgba, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr); geo.setAttribute('aColor', this.colorAttr); geo.setAttribute('aSize', this.sizeAttr);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uTex: { value: TEX.dot }, uScale: { value: 400 } },
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 15;
    scene.add(this.points);
  }

  /** Добавить частицу. Если места нет — переписываем случайную. */
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: THREE.Color, size: number, life: number, gravity: number, drag: number) {
    const i = this.count < this.max ? this.count++ : Math.floor(Math.random() * this.max);
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.baseColor[i * 3] = color.r; this.baseColor[i * 3 + 1] = color.g; this.baseColor[i * 3 + 2] = color.b;
    this.baseSize[i] = size; this.life[i] = life; this.maxLife[i] = life; this.gravity[i] = gravity; this.drag[i] = drag;
  }

  update(dt: number) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.moveParticle(this.count - 1, i); this.count--; continue; }
      const k = i * 3;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[k] *= d; this.vel[k + 1] = this.vel[k + 1] * d - this.gravity[i] * dt; this.vel[k + 2] *= d;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      // падающие частицы отскакивают от пола
      if (this.pos[k + 1] < 0.02 && this.gravity[i] > 0) { this.pos[k + 1] = 0.02; this.vel[k + 1] *= -0.35; this.vel[k] *= 0.6; this.vel[k + 2] *= 0.6; }
      const t = this.life[i] / this.maxLife[i];  // 1 → 0 за жизнь частицы
      const alpha = Math.min(1, t * 2.5);         // гаснет в последние 40% жизни
      this.rgba[i * 4] = this.baseColor[k]; this.rgba[i * 4 + 1] = this.baseColor[k + 1]; this.rgba[i * 4 + 2] = this.baseColor[k + 2]; this.rgba[i * 4 + 3] = alpha;
      this.size[i] = this.baseSize[i] * (0.35 + 0.65 * t);
      i++;
    }
    this.points.geometry.setDrawRange(0, this.count);
    // в видеокарту отправляем только живую часть буферов
    this.posAttr.clearUpdateRanges(); this.posAttr.addUpdateRange(0, this.count * 3); this.posAttr.needsUpdate = true;
    this.colorAttr.clearUpdateRanges(); this.colorAttr.addUpdateRange(0, this.count * 4); this.colorAttr.needsUpdate = true;
    this.sizeAttr.clearUpdateRanges(); this.sizeAttr.addUpdateRange(0, this.count); this.sizeAttr.needsUpdate = true;
  }

  private moveParticle(from: number, to: number) {
    for (let c = 0; c < 3; c++) {
      this.pos[to * 3 + c] = this.pos[from * 3 + c]; this.vel[to * 3 + c] = this.vel[from * 3 + c]; this.baseColor[to * 3 + c] = this.baseColor[from * 3 + c];
    }
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from]; this.baseSize[to] = this.baseSize[from];
    this.gravity[to] = this.gravity[from]; this.drag[to] = this.drag[from];
  }
}
