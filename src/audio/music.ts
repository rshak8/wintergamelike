// Маленький секвенсор музыки: бас-остинато + аккорд-подложка; в бою добавляются барабаны и арпеджио.
import { engine, tone, noise } from './synth';

const BPM = 112;
const BASS_LINE = [45, 45, 52, 45, 48, 48, 50, 47]; // MIDI-ноты
const CHORD_ROOTS = [0, -4, -2, -5];                // сдвиг баса каждые 16 шагов

const midiToHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export const music = {
  /** 0 = спокойно, 1 = бой (включает барабаны). */
  intensity: 0,
  step: 0,      // номер восьмой доли в цикле из 64
  next: 0,      // время следующей доли в секундах аудиоконтекста

  start() {
    this.next = engine.ctx!.currentTime + 0.1;
    setInterval(() => this.schedule(), 50);
  },

  /** Ставит в очередь ноты на ближайшие 0.25 с (так музыка не зависит от лагов кадра). */
  schedule() {
    const ctx = engine.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const stepLen = 60 / BPM / 2;
    while (this.next < ctx.currentTime + 0.25) {
      this.playStep(this.step, this.next, stepLen);
      this.next += stepLen; this.step = (this.step + 1) % 64;
    }
  },

  playStep(s: number, t: number, stepLen: number) {
    const bus = engine.musicBus;
    const chord = Math.floor(s / 16) % 4;
    const f = midiToHz(BASS_LINE[s % 8] + CHORD_ROOTS[chord]);
    // бас
    if (s % 2 === 0) tone(t, { type: 'triangle', f, dur: stepLen * 1.6, vol: 0.22, bus });
    // подложка-аккорд в начале каждого такта
    if (s % 16 === 0) {
      [0, 3, 7].forEach((iv) => tone(t, { type: 'sine', f: f * 2 * Math.pow(2, iv / 12), dur: stepLen * 15, vol: 0.05, a: 0.4, bus }));
    }
    if (this.intensity > 0.5) {
      if (s % 4 === 0) tone(t, { type: 'sine', f: 120, f2: 40, dur: 0.18, vol: 0.4, bus });            // бочка
      if (s % 4 === 2) noise(t, { dur: 0.08, vol: 0.18, type: 'highpass', f: 6000, bus });             // хэт
      if (s % 8 === 4) noise(t, { dur: 0.15, vol: 0.22, f: 1800, q: 0.8, bus });                       // малый
      if (s % 2 === 1) {
        const arp = [0, 3, 7, 10, 12, 7][s % 6];
        tone(t, { type: 'square', f: f * 4 * Math.pow(2, arp / 12), dur: stepLen * 0.8, vol: 0.025, bus });
      }
    }
  },
};
