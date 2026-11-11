// Текстуры эффектов, нарисованные кодом на canvas (никаких картинок в сборке).
import * as THREE from 'three';

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Радиальный градиент из списка [позиция, цвет]. */
function radial(g: CanvasRenderingContext2D, s: number, stops: [number, string][]) {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [t, c] of stops) gr.addColorStop(t, c);
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
}

export type TexName = 'dot' | 'glow' | 'soft' | 'shadow' | 'ring' | 'scorch' | 'holy' | 'rune' | 'spawn' | 'crescent';

/** Все текстуры эффектов. Заполняется в createTextures() (вызывает FX до постройки мира). */
export const TEX = {} as Record<TexName, THREE.CanvasTexture>;

export function createTextures() {
  // плотная точка — частицы
  TEX.dot = canvasTexture(64, (g, s) => radial(g, s, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]));
  // свечение — вспышки, огонь факела
  TEX.glow = canvasTexture(128, (g, s) => radial(g, s, [[0, 'rgba(255,255,255,0.9)'], [0.4, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]));
  // очень мягкое пятно без видимого края (гаусс) — лужи света и ореолы
  TEX.soft = canvasTexture(256, (g, s) => {
    const stops: [number, string][] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      stops.push([t, `rgba(255,255,255,${(Math.exp(-t * t * 5) * (1 - t)).toFixed(4)})`]);
    }
    radial(g, s, stops);
  });
  // тень под персонажем
  TEX.shadow = canvasTexture(64, (g, s) => radial(g, s, [[0, 'rgba(0,0,0,0.65)'], [0.6, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]));
  // кольцо — волны, прицел
  TEX.ring = canvasTexture(128, (g, s) => {
    g.strokeStyle = 'white'; g.lineWidth = s * 0.06; g.shadowColor = 'white'; g.shadowBlur = s * 0.05;
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2); g.stroke();
  });
  // подпалина с трещинами — после взрывов
  TEX.scorch = canvasTexture(128, (g, s) => {
    radial(g, s, [[0, 'rgba(20,10,5,0.85)'], [0.5, 'rgba(20,10,5,0.5)'], [1, 'rgba(0,0,0,0)']]);
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * 6.28; g.beginPath(); g.moveTo(s / 2, s / 2);
      let x = s / 2, y = s / 2;
      for (let k = 0; k < 4; k++) { x += Math.cos(a + (Math.random() - 0.5)) * s * 0.11; y += Math.sin(a + (Math.random() - 0.5)) * s * 0.11; g.lineTo(x, y); }
      g.stroke();
    }
  });
  // святой знак — удар молота
  TEX.holy = canvasTexture(256, (g, s) => {
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
    // трещины
    g.lineWidth = 2; g.shadowBlur = 4;
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * 6.28; let x = Math.cos(a) * s * 0.2, y = Math.sin(a) * s * 0.2;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 3; k++) { x += Math.cos(a + (Math.random() - 0.5)) * s * 0.07; y += Math.sin(a + (Math.random() - 0.5)) * s * 0.07; g.lineTo(x, y); }
      g.stroke();
    }
  });
  // руна на полу стартовой комнаты
  TEX.rune = canvasTexture(256, (g, s) => {
    const c = s / 2; g.translate(c, c);
    g.strokeStyle = 'white'; g.shadowColor = 'white'; g.shadowBlur = 10; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, -s * 0.42); g.lineTo(s * 0.42, 0); g.lineTo(0, s * 0.42); g.lineTo(-s * 0.42, 0); g.closePath(); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(0, 0, s * 0.22, 0, 6.283); g.stroke();
    g.fillStyle = 'white'; g.beginPath(); g.moveTo(0, -s * 0.12); g.lineTo(s * 0.12, 0); g.lineTo(0, s * 0.12); g.lineTo(-s * 0.12, 0); g.fill();
  });
  // пентаграмма — появление врага
  TEX.spawn = canvasTexture(256, (g, s) => {
    const c = s / 2; g.translate(c, c);
    g.strokeStyle = 'white'; g.shadowColor = 'white'; g.shadowBlur = 8;
    g.lineWidth = 6; g.beginPath(); g.arc(0, 0, s * 0.43, 0, 6.283); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(0, 0, s * 0.34, 0, 6.283); g.stroke();
    for (let i = 0; i < 5; i++) {
      const a = i * 2 * Math.PI / 5 * 2 - Math.PI / 2, b = (i + 1) * 2 * Math.PI / 5 * 2 - Math.PI / 2;
      g.beginPath(); g.moveTo(Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34); g.lineTo(Math.cos(b) * s * 0.34, Math.sin(b) * s * 0.34); g.stroke();
    }
  });
  // полумесяц — волна меча босса
  TEX.crescent = canvasTexture(128, (g, s) => {
    g.fillStyle = 'white'; g.shadowColor = 'white'; g.shadowBlur = 10;
    g.beginPath(); g.arc(s * 0.5, s * 0.62, s * 0.42, Math.PI * 1.1, Math.PI * 1.9); g.arc(s * 0.5, s * 0.78, s * 0.42, Math.PI * 1.82, Math.PI * 1.18, true); g.fill();
  });
}
