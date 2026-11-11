// Синтезатор на WebAudio: все звуки игры собираются из тонов и шума, без аудиофайлов.

/** Аудиограф. Создаётся при первом касании экрана (браузеры не дают играть звук раньше). */
export const engine = {
  ctx: null as AudioContext | null,
  master: null as GainNode | null,
  sfxBus: null as GainNode | null,     // эффекты
  musicBus: null as GainNode | null,   // музыка
  noise: null as AudioBuffer | null,   // секунда белого шума
  voices: 0,                           // сколько звуков звучит прямо сейчас
};

/** Создаёт аудиоконтекст и шины. Возвращает false, если WebAudio нет. */
export function createEngine() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  const ctx = engine.ctx = new AC();
  engine.master = ctx.createGain(); engine.master.gain.value = 0.8; engine.master.connect(ctx.destination);
  // компрессор, чтобы много одновременных звуков не хрипели
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  comp.connect(engine.master);
  engine.sfxBus = ctx.createGain(); engine.sfxBus.gain.value = 0.9; engine.sfxBus.connect(comp);
  engine.musicBus = ctx.createGain(); engine.musicBus.gain.value = 0.0; engine.musicBus.connect(comp);
  engine.noise = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
  const d = engine.noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

/** Считает звучащие голоса и отключает узел, когда звук закончился. */
function track(node: AudioNode, dur: number) {
  engine.voices++;
  setTimeout(() => { engine.voices--; try { node.disconnect(); } catch (e) { } }, (dur + 0.1) * 1000);
}

/** Огибающая громкости: быстрая атака a до peak, затем спад за dcy секунд. */
function envelope(g: GainNode, t: number, a: number, peak: number, dcy: number, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + dcy);
}

export interface ToneOpts {
  type?: OscillatorType;
  f?: number;            // частота
  f2?: number | null;    // если задана — частота плавно уезжает к ней
  dur?: number; vol?: number; a?: number;
  bus?: GainNode | null; // по умолчанию шина эффектов
  detune?: number;
}

/** Один тон (осциллятор). Вызывать только после createEngine(). */
export function tone(t: number, { type = 'sine', f = 440, f2 = null, dur = 0.2, vol = 0.3, a = 0.005, bus = engine.sfxBus, detune = 0 }: ToneOpts) {
  const ctx = engine.ctx!;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  const g = ctx.createGain(); envelope(g, t, a, vol, dur);
  o.connect(g); g.connect(bus!);
  o.start(t); o.stop(t + a + dur + 0.05);
  track(g, a + dur);
}

export interface NoiseOpts {
  dur?: number; vol?: number;
  type?: BiquadFilterType;  // фильтр шума
  f?: number; f2?: number | null; q?: number; a?: number;
  bus?: GainNode | null;
}

/** Отфильтрованный шум (удары, свист, взрывы). Вызывать только после createEngine(). */
export function noise(t: number, { dur = 0.2, vol = 0.3, type = 'bandpass', f = 1000, f2 = null, q = 1, a = 0.003, bus = engine.sfxBus }: NoiseOpts) {
  const ctx = engine.ctx!;
  const s = ctx.createBufferSource(); s.buffer = engine.noise;
  s.playbackRate.value = 0.7 + Math.random() * 0.6;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); envelope(g, t, a, vol, dur);
  s.connect(fl); fl.connect(g); g.connect(bus!);
  s.start(t, Math.random() * 0.5); s.stop(t + a + dur + 0.05);
  track(g, a + dur);
}
