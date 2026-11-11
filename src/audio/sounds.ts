// Все звуковые эффекты игры. Каждый — маленький рецепт из tone() и noise().
import { tone, noise } from './synth';

export interface PlayOpts { pitch?: number }

export interface SoundDef {
  fn: (t: number, o: PlayOpts) => void;
  gap?: number;        // минимальная пауза между повторами этого звука, сек (по умолчанию 0.03)
  important?: boolean; // играет, даже если звучит слишком много голосов
}

const r = (a: number, b: number) => a + Math.random() * (b - a);

export const SOUNDS = {
  // атаки героя
  swing: { fn: (t) => { noise(t, { dur: 0.13, vol: 0.32, f: 900, f2: 3200, q: 1.2 }); } },
  stab: { fn: (t) => { noise(t, { dur: 0.08, vol: 0.3, f: 2400, f2: 5000, q: 2 }); tone(t, { type: 'triangle', f: 900, f2: 1500, dur: 0.05, vol: 0.06 }); } },
  slashFire: { fn: (t) => { noise(t, { dur: 0.22, vol: 0.34, f: 700, f2: 2600, q: 0.8 }); noise(t + 0.02, { dur: 0.3, vol: 0.14, type: 'highpass', f: 3000 }); } },
  slam: { important: true, fn: (t) => { tone(t, { type: 'sine', f: 140, f2: 40, dur: 0.4, vol: 0.7 }); noise(t, { dur: 0.35, vol: 0.4, type: 'lowpass', f: 900, f2: 200 }); tone(t + 0.02, { type: 'triangle', f: 1200, f2: 600, dur: 0.5, vol: 0.08 }); } },
  bowShot: { fn: (t) => { tone(t, { type: 'triangle', f: 520, f2: 180, dur: 0.1, vol: 0.22 }); noise(t, { dur: 0.1, vol: 0.2, f: 4000, f2: 1500, q: 2 }); } },
  iceShot: { fn: (t) => { tone(t, { type: 'sine', f: 1800, f2: 2600, dur: 0.12, vol: 0.12 }); tone(t, { type: 'triangle', f: 600, f2: 260, dur: 0.1, vol: 0.18 }); noise(t, { dur: 0.1, vol: 0.18, type: 'highpass', f: 5000 }); } },
  zap: { fn: (t) => { tone(t, { type: 'sawtooth', f: 180, f2: 900, dur: 0.08, vol: 0.12 }); noise(t, { dur: 0.16, vol: 0.28, f: 3200, q: 0.7 }); } },
  swap: { fn: (t) => { tone(t, { type: 'triangle', f: 700, f2: 1100, dur: 0.06, vol: 0.12 }); noise(t, { dur: 0.05, vol: 0.15, f: 3000, q: 2 }); } },

  // попадания и статусы
  hit: { gap: 0.025, fn: (t, o) => { const p = o.pitch || 1; tone(t, { type: 'square', f: 220 * p, f2: 70 * p, dur: 0.07, vol: 0.16 }); noise(t, { dur: 0.06, vol: 0.32, f: 1800 * p, q: 1.5 }); } },
  crunch: { gap: 0.04, fn: (t) => { noise(t, { dur: 0.12, vol: 0.4, f: 1300, q: 3 }); noise(t + 0.04, { dur: 0.1, vol: 0.25, f: 2600, q: 4 }); tone(t, { type: 'square', f: 160, f2: 50, dur: 0.12, vol: 0.18 }); } },
  kill: { gap: 0.04, fn: (t) => { tone(t, { type: 'square', f: 600, f2: 1200, dur: 0.06, vol: 0.12 }); tone(t + 0.05, { type: 'square', f: 900, f2: 1800, dur: 0.08, vol: 0.1 }); noise(t, { dur: 0.25, vol: 0.35, f: 1000, f2: 300, q: 1 }); } },
  iceHit: { gap: 0.04, fn: (t) => { for (let i = 0; i < 3; i++) tone(t + i * 0.025, { type: 'sine', f: r(2200, 3600), dur: 0.12, vol: 0.07 }); noise(t, { dur: 0.08, vol: 0.2, type: 'highpass', f: 4000 }); } },
  zapChain: { gap: 0.05, fn: (t) => { for (let i = 0; i < 4; i++) tone(t + i * 0.018, { type: 'square', f: r(700, 1600), dur: 0.03, vol: 0.06 }); noise(t, { dur: 0.1, vol: 0.22, type: 'highpass', f: 2500 }); } },
  burn: { gap: 0.15, fn: (t) => { noise(t, { dur: 0.25, vol: 0.12, f: 600, f2: 1500, q: 0.5 }); } },
  poison: { gap: 0.1, fn: (t) => { tone(t, { type: 'sine', f: 300, f2: 520, dur: 0.12, vol: 0.08 }); } },
  shatter: { gap: 0.05, fn: (t) => { noise(t, { dur: 0.25, vol: 0.32, f: 900, f2: 400, q: 1.5 }); tone(t, { type: 'square', f: 180, f2: 70, dur: 0.1, vol: 0.12 }); } },
  playerHurt: { important: true, fn: (t) => { tone(t, { type: 'sawtooth', f: 300, f2: 90, dur: 0.22, vol: 0.25 }); noise(t, { dur: 0.15, vol: 0.35, type: 'lowpass', f: 1200 }); } },

  // враги
  telegraph: { gap: 0.08, fn: (t) => { tone(t, { type: 'sine', f: 500, f2: 900, dur: 0.2, vol: 0.06 }); } },
  arrowFly: { gap: 0.06, fn: (t) => { noise(t, { dur: 0.15, vol: 0.16, f: 3000, f2: 1200, q: 3 }); } },
  orbCast: { gap: 0.1, fn: (t) => { tone(t, { type: 'sine', f: 180, f2: 420, dur: 0.4, vol: 0.18, a: 0.08 }); tone(t, { type: 'triangle', f: 360, f2: 840, dur: 0.4, vol: 0.06, a: 0.08 }); } },
  boom: { important: true, gap: 0.05, fn: (t) => { tone(t, { type: 'sine', f: 110, f2: 35, dur: 0.45, vol: 0.55 }); noise(t, { dur: 0.45, vol: 0.45, type: 'lowpass', f: 1600, f2: 150 }); } },
  heal: { gap: 0.2, fn: (t) => { [523, 659, 784].forEach((f, i) => tone(t + i * 0.07, { type: 'sine', f, dur: 0.25, vol: 0.09 })); } },
  healBlocked: { gap: 0.2, fn: (t) => { tone(t, { type: 'square', f: 220, f2: 160, dur: 0.15, vol: 0.08 }); } },
  spawn: { gap: 0.06, fn: (t) => { tone(t, { type: 'sine', f: 200, f2: 600, dur: 0.3, vol: 0.1, a: 0.05 }); noise(t, { dur: 0.3, vol: 0.12, f: 900, f2: 2500, q: 2 }); } },
  roar: { important: true, fn: (t) => { tone(t, { type: 'sawtooth', f: 90, f2: 55, dur: 0.9, vol: 0.32, a: 0.05, detune: 10 }); tone(t, { type: 'sawtooth', f: 92, f2: 56, dur: 0.9, vol: 0.25, a: 0.05, detune: -10 }); noise(t, { dur: 0.9, vol: 0.2, type: 'lowpass', f: 600 }); } },
  mimic: { important: true, fn: (t) => { tone(t, { type: 'sawtooth', f: 200, f2: 500, dur: 0.15, vol: 0.2 }); tone(t + 0.12, { type: 'sawtooth', f: 400, f2: 150, dur: 0.3, vol: 0.2 }); } },
  bite: { gap: 0.1, fn: (t) => { noise(t, { dur: 0.08, vol: 0.4, f: 1500, q: 3 }); tone(t, { type: 'square', f: 140, f2: 80, dur: 0.08, vol: 0.2 }); } },

  // награды и мир
  coin: { gap: 0.03, fn: (t) => { tone(t, { type: 'square', f: 988, dur: 0.05, vol: 0.06 }); tone(t + 0.05, { type: 'square', f: 1319, dur: 0.12, vol: 0.06 }); } },
  gate: { important: true, fn: (t) => { tone(t, { type: 'square', f: 90, f2: 60, dur: 0.3, vol: 0.2 }); noise(t, { dur: 0.3, vol: 0.4, f: 700, q: 4 }); tone(t, { type: 'triangle', f: 1600, f2: 1500, dur: 0.6, vol: 0.05 }); } },
  gateOpen: { important: true, fn: (t) => { noise(t, { dur: 0.6, vol: 0.2, f: 500, f2: 1400, q: 3 }); } },
  chestOpen: { important: true, fn: (t) => { noise(t, { dur: 0.12, vol: 0.25, f: 600, q: 2 }); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(t + 0.12 + i * 0.07, { type: 'triangle', f, dur: 0.35, vol: 0.13 })); } },
  pickup: { important: true, fn: (t) => { [784, 988, 1175, 1568].forEach((f, i) => tone(t + i * 0.05, { type: 'square', f, dur: 0.12, vol: 0.07 })); } },
  buff: { important: true, fn: (t) => { [659, 784, 988, 1319].forEach((f, i) => tone(t + i * 0.06, { type: 'sine', f, dur: 0.4, vol: 0.12 })); noise(t, { dur: 0.6, vol: 0.06, type: 'highpass', f: 6000 }); } },
  clear: { important: true, fn: (t) => { [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.1, { type: 'square', f, dur: i === 3 ? 0.5 : 0.12, vol: 0.09 })); } },
  win: { important: true, fn: (t) => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.11, { type: 'square', f, dur: 0.2, vol: 0.09 })); } },
  lose: { important: true, fn: (t) => { [392, 349, 311, 262].forEach((f, i) => tone(t + i * 0.18, { type: 'triangle', f, dur: 0.3, vol: 0.14 })); } },
  ui: { fn: (t) => { tone(t, { type: 'sine', f: 880, f2: 1200, dur: 0.06, vol: 0.1 }); } },
} satisfies Record<string, SoundDef>;

/** Имя любого звука. Опечатка в audio.play('...') — ошибка компиляции. */
export type SoundName = keyof typeof SOUNDS;
