// Точка входа: рендерер, свет, пост-обработка (bloom), загрузка моделей, игровой цикл
// и отладочные хуки для автотестов.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { loadAssets, renderIcons } from './assets';
import { Input } from './input';
import { Game } from './game/game';
import { UI } from './ui/ui';
import { audio } from './audio/audio';
import { WEAPONS } from './config';

// Игра только для телефона. На компьютере страница показывает её внутри рамки-телефона.
const params = new URLSearchParams(location.search);
const isPhone = matchMedia('(pointer: coarse)').matches;
if (!isPhone && window.self === window.top && !params.has('full')) {
  document.body.innerHTML = `<div id="phoneframe"><iframe src="${location.pathname}?full" title="Dungeon Knight"></iframe></div>`;
  throw new Error('desktop: running inside a phone frame');
}

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080d);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);

// Свет подземелья: холодная заливка сверху + нейтральный основной свет слева-сверху, чтобы всё читалось;
// тёплые пятна у стен дают факелы (LightPool).
scene.add(new THREE.HemisphereLight(0xa9b8ff, 0x2a2238, 1.25));
const keyLight = new THREE.DirectionalLight(0xfff1e2, 1.45);
keyLight.position.set(-4, 10, 6);
scene.add(keyLight);
scene.add(keyLight.target);

// Пост-обработка: сцена → свечение ярких мест (bloom, в половинном разрешении) → вывод на экран.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.4, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

let game: Game | null = null;

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
  await loadAssets();
  // иконки оружия и портрет героя для интерфейса рисуются из 3D-моделей
  const weaponModels = [...new Set(Object.values(WEAPONS).map((w) => w.model))];
  const icons = renderIcons(weaponModels);
  const heroIcon = renderIcons(['Hero'], { rot: [0.15, -0.35, 0], size: 200, zoom: 0.6, focusTop: 0.55 }).Hero;
  const ui = new UI(icons, heroIcon);
  const input = new Input(canvas);
  const g = game = new Game({ scene, camera, input, ui });
  window.__game = g; window.__renderer = renderer;
  resize();
  // все шейдеры и модели — в видеокарту заранее, чтобы ничего не подтормаживало в игре
  g.prewarm(renderer, composer.renderTarget1);
  // звук и музыка включаются на первом касании (раньше браузер не разрешит);
  // capture — чтобы нажатия на кнопки тоже считались
  const startSound = () => { audio.unlock(); audio.musicOn(true); };
  for (const ev of ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown']) window.addEventListener(ev, startSound, { capture: true, once: true });
  g.start();

  let last = performance.now();
  function frame(now: number) {
    if (window.__pause) { requestAnimationFrame(frame); return; }
    const dt = Math.min(0.05, (now - last) / 1000); // после долгой паузы не прыгаем вперёд
    last = now;
    g.update(dt);
    // основной свет едет за камерой
    const t = g.cameraRig.target;
    keyLight.position.set(t.x - 4, 10, t.z + 6);
    keyLight.target.position.copy(t);
    composer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- отладка (для автотестов) ----
  // прокрутить симуляцию на sec секунд с шагом 1/fps
  window.__step = (sec, fps = 60) => {
    const n = Math.round(sec * fps);
    for (let i = 0; i < n; i++) g.update(1 / fps);
    composer.render();
    last = performance.now();
  };
  // остановить цикл и отрисовать крупный план объекта (проверка моделей и хвата оружия)
  window.__closeup = (obj, { yaw = 0, dist = 2.2, height = 0.9, look = 0.55, fov = 30 } = {}) => {
    window.__pause = true;
    const p = new THREE.Vector3(); obj.getWorldPosition(p);
    const cam = camera.clone(); cam.fov = fov;
    cam.position.set(p.x + Math.sin(yaw) * dist, p.y + height, p.z + Math.cos(yaw) * dist);
    cam.lookAt(p.x, p.y + look, p.z); cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  };
  window.__resume = () => { window.__pause = false; last = performance.now(); };
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
}

boot().catch((e) => console.error(e));
