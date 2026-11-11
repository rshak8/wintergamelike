import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import glbUrl from './assets/assets.glb?url';

const protos = {};

export async function loadAssets(onProgress) {
  const loader = new GLTFLoader();
  const gltf = await new Promise((res, rej) => loader.load(glbUrl, res, (e) => {
    if (e.total) onProgress?.(e.loaded / e.total);
  }, rej));
  for (const child of gltf.scene.children) {
    child.position.set(0, 0, 0);
    protos[child.name] = child;
    child.traverse((o) => {
      if (o.isMesh) {
        const m = o.material;
        // stylized: less metal (no env reflections in a dungeon), keep emissive punchy
        m.metalness = Math.min(m.metalness, 0.35);
        m.roughness = Math.max(m.roughness, 0.45);
        if (m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) {
          m.emissiveIntensity = Math.min(m.emissiveIntensity, 3) * 0.75;
          m.toneMapped = true;
        }
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
  }
  return protos;
}

export function has(name) { return !!protos[name]; }

/** Plain clone sharing geometry & materials. */
export function clone(name) {
  const p = protos[name];
  if (!p) throw new Error('missing asset ' + name);
  return p.clone(true);
}

const RIM_CHUNK = `
#include <emissivemap_fragment>
{
  float rimF = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
  totalEmissiveRadiance += uRim * pow(rimF, 2.6);
  totalEmissiveRadiance += uFlash;
  diffuseColor.rgb = mix(diffuseColor.rgb, uTint.rgb, uTint.a);
}
`;

/**
 * Clone a character with its own materials that support a rim light, a hit flash and a tint.
 * Returns { root, fx } where fx.flash (THREE.Vector3 uniform), fx.tint (Vector4).
 */
export function cloneCharacter(name, rimColor = 0x6f86c8, rimStrength = 0.55) {
  const root = clone(name);
  const fx = {
    flash: { value: new THREE.Vector3() },
    tint: { value: new THREE.Vector4(0, 0, 0, 0) },
    rim: { value: new THREE.Color(rimColor).multiplyScalar(rimStrength) },
    materials: [],
  };
  const cache = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    let m = cache.get(o.material);
    if (!m) {
      m = o.material.clone();
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uFlash = fx.flash;
        shader.uniforms.uTint = fx.tint;
        shader.uniforms.uRim = fx.rim;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uFlash;\nuniform vec4 uTint;\nuniform vec3 uRim;')
          .replace('#include <emissivemap_fragment>', RIM_CHUNK);
      };
      m.customProgramCacheKey = () => 'charfx';
      cache.set(o.material, m);
      fx.materials.push(m);
    }
    o.material = m;
  });
  return { root, fx };
}

/** Find a node by suffix, e.g. find(root, '_ArmR'). */
export function find(root, suffix) {
  let r = null;
  root.traverse((o) => { if (!r && o.name.endsWith(suffix)) r = o; });
  return r;
}

/**
 * Build InstancedMeshes for many copies of a prop. transforms: array of {x,y,z,ry,s}
 */
export function instanced(name, transforms, parent) {
  const p = protos[name];
  p.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(p.matrixWorld).invert();
  const out = [];
  const tmp = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  p.traverse((o) => {
    if (!o.isMesh) return;
    const local = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const im = new THREE.InstancedMesh(o.geometry, o.material, transforms.length);
    transforms.forEach((t, i) => {
      q.setFromAxisAngle(up, t.ry || 0);
      const s = t.s || 1;
      tmp.compose(new THREE.Vector3(t.x, t.y || 0, t.z), q, new THREE.Vector3(s, t.sy || s, s));
      tmp.multiply(local);
      im.setMatrixAt(i, tmp);
      if (t.color && im.setColorAt) im.setColorAt(i, t.color);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false;
    parent.add(im);
    out.push(im);
  });
  return out;
}

/** Render small transparent icons of weapon models (data URLs). */
export function renderIcons(names, { rot = [0, 0.35, -Math.PI / 4], size = 160, zoom = 0.56, focusTop = 0 } = {}) {
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(size, size);
  r.setPixelRatio(1);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 2.2));
  const dl = new THREE.DirectionalLight(0xffffff, 2.5);
  dl.position.set(2, 3, 4);
  scene.add(dl);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  cam.position.set(0, 0, 5);
  const out = {};
  for (const n of names) {
    const o = clone(n);
    o.rotation.set(rot[0], rot[1], rot[2]); // diagonal like an inventory icon
    scene.add(o);
    o.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o);
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    if (focusTop) { c.y = box.max.y - sz.y * focusTop; sz.y *= focusTop * 1.6; }
    o.position.sub(c);
    const ext = Math.max(sz.x, sz.y) * zoom;
    cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext;
    cam.updateProjectionMatrix();
    r.render(scene, cam);
    out[n] = r.domElement.toDataURL();
    scene.remove(o);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}
