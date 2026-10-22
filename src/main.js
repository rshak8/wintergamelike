import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { loadAssets, renderIcons } from './assets.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { audio } from './audio.js';
import { WEAPONS } from './config.js';

const canvas = document.getElementById('game');
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 1100);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.75 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b13);
scene.fog = new THREE.Fog(0x090b13, 18, 34);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);

// Soul Knight-ish lighting: cool blue ambient, soft key, warm torches
scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x2a2440, 1.35));
const key = new THREE.DirectionalLight(0xd8e0ff, 1.5);
key.position.set(-4, 10, 6);
scene.add(key);
scene.add(key.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.4, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const bar = document.querySelector('#loading .ld-bar i');
let game = null;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  composer.setSize(w, h);
  bloom.setSize(Math.round(w / 2), Math.round(h / 2));
  game?.resize(w, h);
  document.documentElement.classList.toggle('landscape', w > h);
}
window.addEventListener('resize', resize);

async function boot() {
  await loadAssets((p) => { bar.style.width = (p * 90) + '%'; });
  const weaponModels = [...new Set(Object.values(WEAPONS).map((w) => w.model))];
  const icons = renderIcons(weaponModels);
  const heroIcon = renderIcons(['Hero'], { rot: [0.15, -0.35, 0], size: 200, zoom: 0.6, focusTop: 0.55 }).Hero;
  const ui = new UI(icons, heroIcon);
  const input = new Input(canvas);
  game = new Game({ scene, camera, input, ui });
  window.__game = game; // debug hook
  resize();
  // pre-compile shaders so the first hit doesn't hitch
  renderer.compile(scene, camera);
  bar.style.width = '100%';
  setTimeout(() => document.getElementById('loading').classList.add('done'), 150);
  input.onFirstInput = () => { audio.unlock(); audio.musicOn(true); };
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  game.start();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    key.position.set(game.camTarget.x - 4, 10, game.camTarget.z + 6);
    key.target.position.copy(game.camTarget);
    composer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // debug: advance the simulation deterministically (for automated QA)
  window.__step = (sec, fps = 60) => {
    const n = Math.round(sec * fps);
    for (let i = 0; i < n; i++) game.update(1 / fps);
    composer.render();
    last = performance.now();
  };
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
}

boot().catch((e) => {
  console.error(e);
  document.querySelector('#loading .ld-title').textContent = 'Failed to load';
});
