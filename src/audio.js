// Procedural WebAudio SFX + tiny music sequencer. No audio files.
let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let voices = 0;
const MAX_VOICES = 24;
const lastPlay = {};

export const audio = {
  muted: false,
  unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.0; musicBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    music.start();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend(); else if (!audio.muted) ctx.resume();
    });
  },
  setMuted(m) { this.muted = m; if (master) master.gain.value = m ? 0 : 0.8; },
  play(name, opts = {}) {
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    const gap = SFX[name]?.gap ?? 0.03;
    if (lastPlay[name] && now - lastPlay[name] < gap) return;
    lastPlay[name] = now;
    if (voices >= MAX_VOICES && !SFX[name]?.important) return;
    SFX[name]?.fn(now, opts);
  },
  setIntensity(v) { music.intensity = v; },
  musicOn(on) { if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.32 : 0.0, ctx.currentTime, 0.6); },
};

function track(node, dur) {
  voices++;
  setTimeout(() => { voices--; try { node.disconnect(); } catch (e) { } }, (dur + 0.1) * 1000);
}

function env(g, t, a, peak, dcy, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + dcy);
}

function tone(t, { type = 'sine', f = 440, f2 = null, dur = 0.2, vol = 0.3, a = 0.005, bus = sfxBus, detune = 0 }) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  const g = ctx.createGain(); env(g, t, a, vol, dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + a + dur + 0.05);
  track(g, a + dur);
}

function noise(t, { dur = 0.2, vol = 0.3, type = 'bandpass', f = 1000, f2 = null, q = 1, a = 0.003, bus = sfxBus }) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  s.playbackRate.value = 0.7 + Math.random() * 0.6;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); env(g, t, a, vol, dur);
  s.connect(fl); fl.connect(g); g.connect(bus);
  s.start(t, Math.random() * 0.5); s.stop(t + a + dur + 0.05);
  track(g, a + dur);
}

const r = (a, b) => a + Math.random() * (b - a);

const SFX = {
  swing: { fn: (t) => { noise(t, { dur: 0.13, vol: 0.32, f: 900, f2: 3200, q: 1.2 }); } },
  stab: { fn: (t) => { noise(t, { dur: 0.08, vol: 0.3, f: 2400, f2: 5000, q: 2 }); tone(t, { type: 'triangle', f: 900, f2: 1500, dur: 0.05, vol: 0.06 }); } },
  slashFire: { fn: (t) => { noise(t, { dur: 0.22, vol: 0.34, f: 700, f2: 2600, q: 0.8 }); noise(t + 0.02, { dur: 0.3, vol: 0.14, type: 'highpass', f: 3000 }); } },
  slam: { important: true, fn: (t) => { tone(t, { type: 'sine', f: 140, f2: 40, dur: 0.4, vol: 0.7 }); noise(t, { dur: 0.35, vol: 0.4, type: 'lowpass', f: 900, f2: 200 }); tone(t + 0.02, { type: 'triangle', f: 1200, f2: 600, dur: 0.5, vol: 0.08 }); } },
  hit: { gap: 0.025, fn: (t, o) => { const p = o.pitch || 1; tone(t, { type: 'square', f: 220 * p, f2: 70 * p, dur: 0.07, vol: 0.16 }); noise(t, { dur: 0.06, vol: 0.32, f: 1800 * p, q: 1.5 }); } },
  crunch: { gap: 0.04, fn: (t) => { noise(t, { dur: 0.12, vol: 0.4, f: 1300, q: 3 }); noise(t + 0.04, { dur: 0.1, vol: 0.25, f: 2600, q: 4 }); tone(t, { type: 'square', f: 160, f2: 50, dur: 0.12, vol: 0.18 }); } },
  kill: { gap: 0.04, fn: (t) => { tone(t, { type: 'square', f: 600, f2: 1200, dur: 0.06, vol: 0.12 }); tone(t + 0.05, { type: 'square', f: 900, f2: 1800, dur: 0.08, vol: 0.1 }); noise(t, { dur: 0.25, vol: 0.35, f: 1000, f2: 300, q: 1 }); } },
  bowShot: { fn: (t) => { tone(t, { type: 'triangle', f: 520, f2: 180, dur: 0.1, vol: 0.22 }); noise(t, { dur: 0.1, vol: 0.2, f: 4000, f2: 1500, q: 2 }); } },
  iceShot: { fn: (t) => { tone(t, { type: 'sine', f: 1800, f2: 2600, dur: 0.12, vol: 0.12 }); tone(t, { type: 'triangle', f: 600, f2: 260, dur: 0.1, vol: 0.18 }); noise(t, { dur: 0.1, vol: 0.18, type: 'highpass', f: 5000 }); } },
  iceHit: { gap: 0.04, fn: (t) => { for (let i = 0; i < 3; i++) tone(t + i * 0.025, { type: 'sine', f: r(2200, 3600), dur: 0.12, vol: 0.07 }); noise(t, { dur: 0.08, vol: 0.2, type: 'highpass', f: 4000 }); } },
  zap: { fn: (t) => { tone(t, { type: 'sawtooth', f: 180, f2: 900, dur: 0.08, vol: 0.12 }); noise(t, { dur: 0.16, vol: 0.28, f: 3200, q: 0.7 }); } },
  zapChain: { gap: 0.05, fn: (t) => { for (let i = 0; i < 4; i++) tone(t + i * 0.018, { type: 'square', f: r(700, 1600), dur: 0.03, vol: 0.06 }); noise(t, { dur: 0.1, vol: 0.22, type: 'highpass', f: 2500 }); } },
  burn: { gap: 0.15, fn: (t) => { noise(t, { dur: 0.25, vol: 0.12, f: 600, f2: 1500, q: 0.5 }); } },
  poison: { gap: 0.1, fn: (t) => { tone(t, { type: 'sine', f: 300, f2: 520, dur: 0.12, vol: 0.08 }); } },
  playerHurt: { important: true, fn: (t) => { tone(t, { type: 'sawtooth', f: 300, f2: 90, dur: 0.22, vol: 0.25 }); noise(t, { dur: 0.15, vol: 0.35, type: 'lowpass', f: 1200 }); } },
  telegraph: { gap: 0.08, fn: (t) => { tone(t, { type: 'sine', f: 500, f2: 900, dur: 0.2, vol: 0.06 }); } },
  arrowFly: { gap: 0.06, fn: (t) => { noise(t, { dur: 0.15, vol: 0.16, f: 3000, f2: 1200, q: 3 }); } },
  orbCast: { gap: 0.1, fn: (t) => { tone(t, { type: 'sine', f: 180, f2: 420, dur: 0.4, vol: 0.18, a: 0.08 }); tone(t, { type: 'triangle', f: 360, f2: 840, dur: 0.4, vol: 0.06, a: 0.08 }); } },
  boom: { important: true, gap: 0.05, fn: (t) => { tone(t, { type: 'sine', f: 110, f2: 35, dur: 0.45, vol: 0.55 }); noise(t, { dur: 0.45, vol: 0.45, type: 'lowpass', f: 1600, f2: 150 }); } },
  heal: { gap: 0.2, fn: (t) => { [523, 659, 784].forEach((f, i) => tone(t + i * 0.07, { type: 'sine', f, dur: 0.25, vol: 0.09 })); } },
  healBlocked: { gap: 0.2, fn: (t) => { tone(t, { type: 'square', f: 220, f2: 160, dur: 0.15, vol: 0.08 }); } },
  coin: { gap: 0.03, fn: (t) => { tone(t, { type: 'square', f: 988, dur: 0.05, vol: 0.06 }); tone(t + 0.05, { type: 'square', f: 1319, dur: 0.12, vol: 0.06 }); } },
  gate: { important: true, fn: (t) => { tone(t, { type: 'square', f: 90, f2: 60, dur: 0.3, vol: 0.2 }); noise(t, { dur: 0.3, vol: 0.4, f: 700, q: 4 }); tone(t, { type: 'triangle', f: 1600, f2: 1500, dur: 0.6, vol: 0.05 }); } },
  gateOpen: { important: true, fn: (t) => { noise(t, { dur: 0.6, vol: 0.2, f: 500, f2: 1400, q: 3 }); } },
  chestOpen: { important: true, fn: (t) => { noise(t, { dur: 0.12, vol: 0.25, f: 600, q: 2 }); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(t + 0.12 + i * 0.07, { type: 'triangle', f, dur: 0.35, vol: 0.13 })); } },
  pickup: { important: true, fn: (t) => { [784, 988, 1175, 1568].forEach((f, i) => tone(t + i * 0.05, { type: 'square', f, dur: 0.12, vol: 0.07 })); } },
  buff: { important: true, fn: (t) => { [659, 784, 988, 1319].forEach((f, i) => tone(t + i * 0.06, { type: 'sine', f, dur: 0.4, vol: 0.12 })); noise(t, { dur: 0.6, vol: 0.06, type: 'highpass', f: 6000 }); } },
  clear: { important: true, fn: (t) => { [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.1, { type: 'square', f, dur: i === 3 ? 0.5 : 0.12, vol: 0.09 })); } },
  spawn: { gap: 0.06, fn: (t) => { tone(t, { type: 'sine', f: 200, f2: 600, dur: 0.3, vol: 0.1, a: 0.05 }); noise(t, { dur: 0.3, vol: 0.12, f: 900, f2: 2500, q: 2 }); } },
  roar: { important: true, fn: (t) => { tone(t, { type: 'sawtooth', f: 90, f2: 55, dur: 0.9, vol: 0.32, a: 0.05, detune: 10 }); tone(t, { type: 'sawtooth', f: 92, f2: 56, dur: 0.9, vol: 0.25, a: 0.05, detune: -10 }); noise(t, { dur: 0.9, vol: 0.2, type: 'lowpass', f: 600 }); } },
  mimic: { important: true, fn: (t) => { tone(t, { type: 'sawtooth', f: 200, f2: 500, dur: 0.15, vol: 0.2 }); tone(t + 0.12, { type: 'sawtooth', f: 400, f2: 150, dur: 0.3, vol: 0.2 }); } },
  bite: { gap: 0.1, fn: (t) => { noise(t, { dur: 0.08, vol: 0.4, f: 1500, q: 3 }); tone(t, { type: 'square', f: 140, f2: 80, dur: 0.08, vol: 0.2 }); } },
  swap: { fn: (t) => { tone(t, { type: 'triangle', f: 700, f2: 1100, dur: 0.06, vol: 0.12 }); noise(t, { dur: 0.05, vol: 0.15, f: 3000, q: 2 }); } },
  shatter: { gap: 0.05, fn: (t) => { noise(t, { dur: 0.25, vol: 0.32, f: 900, f2: 400, q: 1.5 }); tone(t, { type: 'square', f: 180, f2: 70, dur: 0.1, vol: 0.12 }); } },
  win: { important: true, fn: (t) => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.11, { type: 'square', f, dur: 0.2, vol: 0.09 })); } },
  lose: { important: true, fn: (t) => { [392, 349, 311, 262].forEach((f, i) => tone(t + i * 0.18, { type: 'triangle', f, dur: 0.3, vol: 0.14 })); } },
  ui: { fn: (t) => { tone(t, { type: 'sine', f: 880, f2: 1200, dur: 0.06, vol: 0.1 }); } },
};

// --- tiny dungeon music: bass ostinato + pad + drums when intense ---
const music = {
  intensity: 0,
  step: 0,
  next: 0,
  start() {
    this.next = ctx.currentTime + 0.1;
    setInterval(() => this.tick(), 50);
  },
  tick() {
    if (!ctx || ctx.state !== 'running') return;
    const bpm = 112, sp = 60 / bpm / 2;
    while (this.next < ctx.currentTime + 0.25) {
      this.play(this.step, this.next, sp);
      this.next += sp; this.step = (this.step + 1) % 64;
    }
  },
  play(s, t, sp) {
    const bassLine = [45, 45, 52, 45, 48, 48, 50, 47];
    const chord = Math.floor(s / 16) % 4;
    const roots = [0, -4, -2, -5];
    const n = bassLine[s % 8] + roots[chord];
    const f = 440 * Math.pow(2, (n - 69) / 12);
    if (s % 2 === 0) tone(t, { type: 'triangle', f, dur: sp * 1.6, vol: 0.22, bus: musicBus });
    if (s % 16 === 0) {
      [0, 3, 7].forEach((iv) => tone(t, { type: 'sine', f: f * 2 * Math.pow(2, iv / 12), dur: sp * 15, vol: 0.05, a: 0.4, bus: musicBus }));
    }
    if (this.intensity > 0.5) {
      if (s % 4 === 0) tone(t, { type: 'sine', f: 120, f2: 40, dur: 0.18, vol: 0.4, bus: musicBus });
      if (s % 4 === 2) noise(t, { dur: 0.08, vol: 0.18, type: 'highpass', f: 6000, bus: musicBus });
      if (s % 8 === 4) noise(t, { dur: 0.15, vol: 0.22, f: 1800, q: 0.8, bus: musicBus });
      if (s % 2 === 1) {
        const arp = [0, 3, 7, 10, 12, 7][s % 6];
        tone(t, { type: 'square', f: f * 4 * Math.pow(2, arp / 12), dur: sp * 0.8, vol: 0.025, bus: musicBus });
      }
    }
  },
};
