// Шейдеры и материалы эффектов. Материалы эффектов создаются ТОЛЬКО этими функциями —
// так FX.prewarm() может заранее скомпилировать ровно такие же шейдеры (см. fx.ts).
import * as THREE from 'three';

const PLANE_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `;

// Зона опасности на полу: круг (uMode 0), сектор (1) или прямоугольник (2).
// Заливка uProg растёт от 0 до 1 — это таймер до удара.
const TELEGRAPH_FRAG = `
varying vec2 vUv; uniform vec3 uColor; uniform float uProg; uniform float uMode; uniform float uAngle; uniform float uAlpha;
void main(){
  vec2 p = vUv*2.0-1.0; float a = 0.0;
  if(uMode < 0.5){ // круг
    float r = length(p); if(r>1.0) discard;
    float edge = smoothstep(0.9,1.0,r); float fill = step(r, uProg);
    a = 0.13 + edge*0.65 + fill*0.2;
  } else if(uMode < 1.5){ // сектор, вперёд = +y
    float r = length(p); float ang = abs(atan(p.x, p.y)); if(r>1.0 || ang>uAngle) discard;
    float edge = max(smoothstep(0.9,1.0,r), smoothstep(uAngle-0.08,uAngle,ang));
    float fill = step(r, uProg);
    a = 0.12 + edge*0.65 + fill*0.2;
  } else { // прямоугольник, тянется вдоль +y от основания
    float yy = vUv.y; float edge = max(smoothstep(0.85,1.0,abs(p.x)), smoothstep(0.96,1.0,yy));
    float fill = step(yy, uProg);
    a = 0.14 + edge*0.55 + fill*0.24;
  }
  gl_FragColor = vec4(uColor, a*uAlpha);
}`;

// След удара мечом: дуга «прорисовывается» (uSweep) и гаснет (uT).
const SLASH_FRAG = `
varying vec2 vUv; uniform vec3 uColor; uniform float uT; uniform float uSweep;
void main(){
  // vUv.x: 0..1 вдоль дуги, vUv.y: 0 внутренний край .. 1 внешний
  float head = uSweep; float x = vUv.x;
  if (x > head) discard;
  float tail = clamp(1.0 - (head - x) * 2.2, 0.0, 1.0);
  float band = smoothstep(0.0, 0.5, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
  float core = smoothstep(0.6, 0.95, vUv.y) * (1.0 - smoothstep(0.95, 1.0, vUv.y));
  float a = (band * 0.7 + core) * tail * (1.0 - uT);
  vec3 c = mix(uColor * 1.6, vec3(1.0, 0.95, 0.85), core * 0.3);
  gl_FragColor = vec4(c * a, a);
}`;

/** mode: 0 круг, 1 сектор, 2 прямоугольник. halfAngle — половина ширины сектора. */
export function telegraphMaterial(color: THREE.ColorRepresentation, mode: number, halfAngle: number) {
  return new THREE.ShaderMaterial({
    vertexShader: PLANE_VERT, fragmentShader: TELEGRAPH_FRAG, transparent: true, depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uProg: { value: 0 }, uMode: { value: mode }, uAngle: { value: halfAngle }, uAlpha: { value: 1 } },
  });
}

export function slashMaterial(color: THREE.ColorRepresentation) {
  return new THREE.ShaderMaterial({
    vertexShader: PLANE_VERT, fragmentShader: SLASH_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uT: { value: 0 }, uSweep: { value: 0 } },
  });
}

/** Плоский светящийся цвет с двух сторон: росчерк укола, ленты молнии. */
export function streakMaterial(color: THREE.ColorRepresentation, opacity: number) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}

/** Плоская дуга-кольцо на полу (вперёд = +Z): uv.x идёт вдоль дуги, uv.y — от внутреннего края к внешнему. */
export function slashGeometry(inner: number, outer: number, angle: number, segments = 20) {
  const g = new THREE.BufferGeometry();
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = -angle / 2 + angle * t;
    pos.push(Math.sin(a) * inner, 0, Math.cos(a) * inner, Math.sin(a) * outer, 0, Math.cos(a) * outer);
    uv.push(t, 0, t, 1);
    if (i < segments) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
