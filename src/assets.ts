import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import glbUrl from './assets/assets.glb?url';

const protos: Record<string, THREE.Object3D> = {};

export async function loadAssets(onProgress?: (p: number) => void) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(glbUrl, (e) => {
    if (e.total) onProgress?.(e.loaded / e.total);
  });
  for (const child of gltf.scene.children) {
    child.position.set(0, 0, 0);
    protos[child.name] = child;
    child.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const m = o.material as THREE.MeshStandardMaterial;
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

export function has(name: string) { return !!protos[name]; }
export function assetNames() { return Object.keys(protos); }

/** Plain clone sharing geometry & materials. */
export function clone(name: string): THREE.Object3D {
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

/** Per-character shader uniforms: hit flash, status tint, rim light. */
export interface CharFx {
  flash: THREE.IUniform<THREE.Vector3>;
  tint: THREE.IUniform<THREE.Vector4>;
  rim: THREE.IUniform<THREE.Color>;
  materials: THREE.Material[];
}

/**
 * Clone a character with its own materials that support a rim light, a hit flash and a tint.
 */
export function cloneCharacter(name: string, rimColor: THREE.ColorRepresentation = 0x6f86c8, rimStrength = 0.55) {
  const root = clone(name);
  const fx: CharFx = {
    flash: { value: new THREE.Vector3() },
    tint: { value: new THREE.Vector4(0, 0, 0, 0) },
    rim: { value: new THREE.Color(rimColor).multiplyScalar(rimStrength) },
    materials: [],
  };
  const cache = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const src = o.material as THREE.Material;
    let m = cache.get(src);
    if (!m) {
      m = src.clone();
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uFlash = fx.flash;
        shader.uniforms.uTint = fx.tint;
        shader.uniforms.uRim = fx.rim;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uFlash;\nuniform vec4 uTint;\nuniform vec3 uRim;')
          .replace('#include <emissivemap_fragment>', RIM_CHUNK);
      };
      m.customProgramCacheKey = () => 'charfx';
      cache.set(src, m);
      fx.materials.push(m);
    }
    o.material = m;
  });
  return { root, fx };
}

/** Find a node by suffix, e.g. find(root, '_ArmR'). */
export function find(root: THREE.Object3D, suffix: string): THREE.Object3D | null {
  let r: THREE.Object3D | null = null;
  root.traverse((o) => { if (!r && o.name.endsWith(suffix)) r = o; });
  return r;
}

/** One copy of a prop for instanced(). sy overrides the vertical scale. */
export interface InstanceTransform {
  x: number; y?: number; z: number;
  ry?: number; s?: number; sy?: number;
  color?: THREE.Color;
}

/**
 * Build InstancedMeshes for many copies of a prop.
 */
export function instanced(name: string, transforms: InstanceTransform[], parent: THREE.Object3D) {
  const p = protos[name];
  p.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(p.matrixWorld).invert();
  const out: THREE.InstancedMesh[] = [];
  const tmp = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  p.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const local = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const im = new THREE.InstancedMesh(o.geometry, o.material, transforms.length);
    transforms.forEach((t, i) => {
      q.setFromAxisAngle(up, t.ry || 0);
      const s = t.s || 1;
      tmp.compose(new THREE.Vector3(t.x, t.y || 0, t.z), q, new THREE.Vector3(s, t.sy || s, s));
      tmp.multiply(local);
      im.setMatrixAt(i, tmp);
      if (t.color) im.setColorAt(i, t.color);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false;
    parent.add(im);
    out.push(im);
  });
  return out;
}

export interface IconOptions { rot?: [number, number, number]; size?: number; zoom?: number; focusTop?: number }

/** Render small transparent icons of weapon models (data URLs keyed by model name). */
export function renderIcons(names: string[], { rot = [0, 0.35, -Math.PI / 4], size = 160, zoom = 0.56, focusTop = 0 }: IconOptions = {}) {
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
  const out: Record<string, string> = {};
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
