// Звук игры: единая точка входа. audio.play('hit') и т. п.
import { engine, createEngine } from './synth';
import { SOUNDS, type SoundDef, type SoundName, type PlayOpts } from './sounds';
import { music } from './music';

export type { SoundName } from './sounds';

const MAX_VOICES = 24;
const lastPlayed: Partial<Record<SoundName, number>> = {};

export const audio = {
  muted: false,

  /** Включить звук. Вызывается на первом касании экрана (раньше браузер не разрешит). */
  unlock() {
    const ctx = engine.ctx;
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    if (!createEngine()) return;
    const c = engine.ctx!;
    music.start();
    // свернули вкладку — пауза звука
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) c.suspend(); else if (!audio.muted) c.resume();
    });
  },

  setMuted(m: boolean) { this.muted = m; if (engine.master) engine.master.gain.value = m ? 0 : 0.8; },

  play(name: SoundName, opts: PlayOpts = {}) {
    const ctx = engine.ctx;
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    const sound: SoundDef = SOUNDS[name];
    // один и тот же звук не чаще, чем раз в gap секунд
    const last = lastPlayed[name];
    if (last && now - last < (sound.gap ?? 0.03)) return;
    lastPlayed[name] = now;
    if (engine.voices >= MAX_VOICES && !sound.important) return;
    sound.fn(now, opts);
  },

  /** 0 = спокойная музыка, 1 = боевая. */
  setIntensity(v: number) { music.intensity = v; },

  musicOn(on: boolean) {
    if (engine.ctx && engine.musicBus) engine.musicBus.gain.setTargetAtTime(on ? 0.32 : 0.0, engine.ctx.currentTime, 0.6);
  },
};
