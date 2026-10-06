// One-shot sound recipes. Each recipe schedules nodes into `v.out` starting at `v.t`
// and returns its total length in seconds (relative to v.t).

import { NoiseBank, clamp, filterNode, gainNode, glide, noiseNode, oscNode, perc } from './synth';

export interface Voice {
  ctx: BaseAudioContext;
  out: AudioNode;
  t: number;
  /** pitch multiplier */
  p: number;
  nb: NoiseBank;
}

type NoiseKind = 'white' | 'pink' | 'brown';

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

function tone(
  v: Voice,
  type: OscillatorType,
  f0: number,
  f1: number | null,
  at: number,
  dur: number,
  amp: number,
  attack = 0.002,
  glideDur = -1,
  dest: AudioNode = v.out,
): number {
  const { ctx } = v;
  const t = v.t + Math.max(0, at);
  const end = t + attack + dur;
  const o = oscNode(ctx, type, f0 * v.p, t, end);
  if (f1 !== null) glide(o.frequency, t, f0 * v.p, f1 * v.p, glideDur > 0 ? glideDur : dur);
  const g = gainNode(ctx, 0);
  perc(g.gain, t, amp, attack, dur);
  o.connect(g).connect(dest);
  return end + 0.003 - v.t;
}

function noise(
  v: Voice,
  kind: NoiseKind,
  at: number,
  dur: number,
  amp: number,
  ftype: BiquadFilterType,
  f0: number,
  f1: number | null,
  q = 0.707,
  attack = 0.002,
  dest: AudioNode = v.out,
  rate = 1,
): number {
  const { ctx } = v;
  const t = v.t + Math.max(0, at);
  const end = t + attack + dur;
  const s = noiseNode(ctx, v.nb[kind], t, end, rate);
  const f = filterNode(ctx, ftype, f0 * v.p, q);
  if (f1 !== null) glide(f.frequency, t, f0 * v.p, f1 * v.p, dur + attack);
  const g = gainNode(ctx, 0);
  perc(g.gain, t, amp, attack, dur);
  s.connect(f).connect(g).connect(dest);
  return end + 0.003 - v.t;
}

/** Sum of decaying sine partials (modal synthesis) — woods, metals, bells. */
function modal(v: Voice, at: number, base: number, ratios: number[], decays: number[], amps: number[], amp: number, attack = 0.001): number {
  let end = 0;
  for (let i = 0; i < ratios.length; i++) {
    const f = base * ratios[i];
    if (f * v.p > v.ctx.sampleRate * 0.42) continue;
    end = Math.max(end, tone(v, 'sine', f, null, at, decays[i], amp * amps[i], attack));
  }
  return end;
}

/** Two-operator FM pluck (kalimba / marimba / Rhodes-ish). */
export function fmPluck(
  v: Voice,
  at: number,
  freq: number,
  ratio: number,
  index: number,
  indexDecay: number,
  amp: number,
  dur: number,
  dest: AudioNode = v.out,
  attack = 0.003,
): number {
  const { ctx } = v;
  const t = v.t + Math.max(0, at);
  const f = freq * v.p;
  const end = t + attack + dur;
  const car = oscNode(ctx, 'sine', f, t, end);
  const mod = oscNode(ctx, 'sine', f * ratio, t, end);
  const mg = gainNode(ctx, 0);
  const dev = index * f * ratio;
  mg.gain.setValueAtTime(dev, t);
  mg.gain.exponentialRampToValueAtTime(Math.max(0.01, dev * 0.02), t + indexDecay);
  mod.connect(mg).connect(car.frequency);
  const g = gainNode(ctx, 0);
  perc(g.gain, t, amp, attack, dur);
  car.connect(g).connect(dest);
  return end + 0.003 - v.t;
}

/** A small wooden/plastic tick (used by several UI sounds). */
function tick(v: Voice, at: number, f: number, amp: number, len = 0.03): number {
  const a = noise(v, 'white', at, len * 0.5, amp * 0.6, 'bandpass', f, null, 4);
  const b = tone(v, 'sine', f * 0.55, null, at, len, amp * 0.5);
  return Math.max(a, b);
}

export type Recipe = (v: Voice) => number;

export const RECIPES: Record<string, Recipe> = {
  click: (v) => Math.max(tick(v, 0, 3200, 0.35, 0.025), tone(v, 'sine', 2100, 1900, 0, 0.02, 0.12)),

  uiHover: (v) => tone(v, 'sine', 1750, 1850, 0, 0.035, 0.07, 0.004),

  ui: (v) => Math.max(fmPluck(v, 0, 784, 3, 1.4, 0.05, 0.3, 0.28), tick(v, 0, 2600, 0.12, 0.02)),

  clunk: (v) => {
    const a = tone(v, 'sine', 125, 62, 0, 0.22, 0.75, 0.002, 0.09);
    const b = tone(v, 'triangle', 210, 150, 0, 0.09, 0.28, 0.001, 0.05);
    const c = noise(v, 'brown', 0, 0.06, 0.5, 'lowpass', 900, 250, 1.2);
    const d = noise(v, 'white', 0, 0.012, 0.15, 'bandpass', 1500, null, 2);
    return Math.max(a, b, c, d);
  },

  place: (v) => {
    // wood-block "thock" + low body
    const a = modal(v, 0, 470, [1, 2.71, 4.4], [0.09, 0.04, 0.02], [1, 0.35, 0.12], 0.42);
    const b = tone(v, 'sine', 150, 105, 0, 0.11, 0.45, 0.002, 0.06);
    const c = noise(v, 'white', 0, 0.01, 0.18, 'bandpass', 2200, null, 1.5);
    return Math.max(a, b, c);
  },

  pickup: (v) => {
    const a = tone(v, 'sine', 330, 640, 0, 0.11, 0.38, 0.012, 0.08);
    const b = tone(v, 'triangle', 660, 1280, 0.01, 0.06, 0.08, 0.008, 0.05);
    return Math.max(a, b, tick(v, 0, 2800, 0.1, 0.015));
  },

  delete: (v) => {
    const a = noise(v, 'pink', 0, 0.26, 0.45, 'bandpass', 2400, 280, 1.4, 0.01);
    const b = tone(v, 'sine', 420, 120, 0, 0.2, 0.35, 0.004, 0.16);
    const c = tone(v, 'triangle', 260, 90, 0.03, 0.15, 0.15, 0.002, 0.12);
    return Math.max(a, b, c);
  },

  rotate: (v) => {
    let e = 0;
    for (let i = 0; i < 3; i++) {
      e = Math.max(e, tick(v, i * 0.028, 2400 + i * 300, 0.3 - i * 0.05, 0.025));
      e = Math.max(e, tone(v, 'sine', 880 + i * 90, null, i * 0.028, 0.03, 0.06));
    }
    return e;
  },

  error: (v) => {
    // soft "bonk-bonk", low-passed square so it isn't harsh
    const f = filterNode(v.ctx, 'lowpass', 1100, 0.9);
    f.connect(v.out);
    const a = tone(v, 'square', 233, 220, 0, 0.12, 0.16, 0.004, 0.1, f);
    const b = tone(v, 'square', 185, 175, 0.15, 0.2, 0.17, 0.004, 0.15, f);
    const c = tone(v, 'sine', 117, null, 0, 0.12, 0.25);
    const d = tone(v, 'sine', 92, null, 0.15, 0.2, 0.25);
    return Math.max(a, b, c, d);
  },

  spring: (v) => {
    // "sproing": vibrato that slows and narrows while the pitch rises
    const { ctx } = v;
    const t = v.t;
    const dur = 0.55;
    const o = oscNode(ctx, 'triangle', 220 * v.p, t, t + dur);
    glide(o.frequency, t, 190 * v.p, 330 * v.p, dur);
    const lfo = oscNode(ctx, 'sine', 32, t, t + dur);
    lfo.frequency.setValueAtTime(34, t);
    lfo.frequency.exponentialRampToValueAtTime(9, t + dur);
    const lg = gainNode(ctx, 0);
    lg.gain.setValueAtTime(90 * v.p, t);
    lg.gain.exponentialRampToValueAtTime(4, t + dur);
    lfo.connect(lg).connect(o.frequency);
    const f = filterNode(ctx, 'lowpass', 2400, 2);
    const g = gainNode(ctx, 0);
    perc(g.gain, t, 0.42, 0.004, dur - 0.004);
    o.connect(f).connect(g).connect(v.out);
    const b = noise(v, 'white', 0, 0.015, 0.15, 'bandpass', 3000, null, 3);
    return Math.max(dur + 0.01, b);
  },

  boing: (v) => {
    // classic cartoon boing: fast upward glide with decaying wobble
    const { ctx } = v;
    const t = v.t;
    const dur = 0.7;
    const n = 128;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = (i / (n - 1)) * dur;
      const f = 150 + 230 * (1 - Math.exp(-s * 9)) + 70 * Math.sin(2 * Math.PI * 11 * s) * Math.exp(-s * 4.5);
      curve[i] = f * v.p;
    }
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueCurveAtTime(curve, t, dur);
    o.start(t);
    o.stop(t + dur + 0.02);
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    const c2 = new Float32Array(n);
    for (let i = 0; i < n; i++) c2[i] = curve[i] * 2;
    o2.frequency.setValueCurveAtTime(c2, t, dur);
    o2.start(t);
    o2.stop(t + dur + 0.02);
    const g = gainNode(ctx, 0);
    perc(g.gain, t, 0.5, 0.006, dur - 0.01);
    const g2 = gainNode(ctx, 0);
    perc(g2.gain, t, 0.1, 0.006, dur * 0.6);
    o.connect(g).connect(v.out);
    o2.connect(g2).connect(v.out);
    const thump = tone(v, 'sine', 110, 70, 0, 0.1, 0.3);
    return Math.max(dur + 0.02, thump);
  },

  whoosh: (v) => {
    const { ctx } = v;
    const t = v.t;
    const dur = 0.42;
    const s = noiseNode(ctx, v.nb.pink, t, t + dur);
    const f = filterNode(ctx, 'bandpass', 400 * v.p, 1.6);
    f.frequency.setValueAtTime(350 * v.p, t);
    f.frequency.exponentialRampToValueAtTime(2200 * v.p, t + dur * 0.45);
    f.frequency.exponentialRampToValueAtTime(600 * v.p, t + dur);
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    g.gain.setValueAtTime(0, t + dur + 0.001);
    s.connect(f).connect(g).connect(v.out);
    return dur + 0.01;
  },

  pop: (v) => {
    const a = tone(v, 'sine', 950, 210, 0, 0.07, 0.55, 0.001, 0.03);
    const b = noise(v, 'white', 0, 0.012, 0.25, 'highpass', 1800, null, 0.7);
    const c = tone(v, 'sine', 320, 260, 0.012, 0.06, 0.12);
    return Math.max(a, b, c);
  },

  gear: (v) => {
    let e = 0;
    for (let i = 0; i < 4; i++) {
      const at = i * 0.042 + rnd(-0.004, 0.004);
      e = Math.max(e, noise(v, 'white', at, 0.018, 0.32, 'bandpass', 3300, null, 6));
      e = Math.max(e, modal(v, at, 1150 + i * 40, [1, 2.4], [0.04, 0.02], [1, 0.5], 0.09));
    }
    return Math.max(e, tone(v, 'sine', 160, 140, 0, 0.16, 0.15));
  },

  zap: (v) => {
    const { ctx } = v;
    const t = v.t;
    const buf = v.nb.zaps[Math.floor(Math.random() * v.nb.zaps.length)];
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = v.p;
    const hp = filterNode(ctx, 'highpass', 120, 0.7);
    const pk = filterNode(ctx, 'peaking', 2400, 1.2);
    pk.gain.value = 6;
    const g = gainNode(ctx, 0.5);
    s.connect(hp).connect(pk).connect(g).connect(v.out);
    s.start(t);
    const d = buf.duration / v.p;
    const b = tone(v, 'sawtooth', 1800, 300, 0, 0.12, 0.05, 0.001);
    return Math.max(d + 0.01, b);
  },

  boom: (v) => {
    const a = noise(v, 'brown', 0, 1.1, 0.95, 'lowpass', 1400, 90, 0.8, 0.004);
    const b = tone(v, 'sine', 85, 32, 0, 0.7, 0.75, 0.003, 0.5);
    const c = noise(v, 'white', 0, 0.06, 0.25, 'lowpass', 3500, 800, 0.7);
    const d = noise(v, 'pink', 0.05, 0.6, 0.18, 'bandpass', 500, 150, 0.8, 0.03);
    return Math.max(a, b, c, d);
  },

  snap: (v) => {
    const a = noise(v, 'white', 0, 0.022, 0.5, 'highpass', 1800, null, 0.9);
    const b = tone(v, 'triangle', 340, 110, 0.004, 0.14, 0.3, 0.001, 0.06);
    const c = tone(v, 'sine', 1400, 700, 0, 0.03, 0.12);
    return Math.max(a, b, c);
  },

  fuse: (v) => {
    const { ctx } = v;
    const t = v.t;
    const dur = 0.55;
    const s = noiseNode(ctx, v.nb.crackle, t, t + dur, 1.6);
    const s2 = noiseNode(ctx, v.nb.white, t, t + dur);
    const hp = filterNode(ctx, 'highpass', 1800, 0.8);
    const soft = filterNode(ctx, 'lowpass', 8000, 0.7);
    const g2 = gainNode(ctx, 0);
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(0.12, t + 0.03);
    g2.gain.setValueAtTime(0.12, t + dur - 0.15);
    g2.gain.linearRampToValueAtTime(0, t + dur);
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.6, t + 0.01);
    g.gain.setValueAtTime(0.6, t + dur - 0.12);
    g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(hp);
    s2.connect(g2).connect(hp);
    hp.connect(soft).connect(g).connect(v.out);
    return dur + 0.01;
  },

  punch: (v) => {
    const a = tone(v, 'sine', 120, 55, 0, 0.14, 0.7, 0.002, 0.06);
    const b = noise(v, 'pink', 0, 0.07, 0.55, 'lowpass', 2200, 500, 0.9);
    const c = noise(v, 'white', 0, 0.035, 0.6, 'bandpass', 1300, 700, 1.1);
    return Math.max(a, b, c);
  },

  cannon: (v) => {
    const a = tone(v, 'sine', 120, 38, 0, 0.55, 0.85, 0.002, 0.25);
    const b = noise(v, 'brown', 0, 0.7, 0.8, 'lowpass', 1800, 120, 0.8);
    const c = noise(v, 'white', 0, 0.04, 0.35, 'bandpass', 1200, 500, 0.8);
    const d = tone(v, 'triangle', 300, 140, 0, 0.1, 0.25, 0.001, 0.08);
    return Math.max(a, b, c, d);
  },

  ding: (v) => {
    // small bell: inharmonic partials with longer low decay
    return modal(v, 0, 1318.5, [1, 2.0, 2.76, 5.4, 8.93], [1.3, 0.7, 0.5, 0.2, 0.08], [1, 0.25, 0.3, 0.12, 0.05], 0.3, 0.002);
  },

  switch: (v) => {
    const a = tick(v, 0, 2600, 0.38, 0.025);
    const b = tick(v, 0.022, 4100, 0.2, 0.02);
    const c = tone(v, 'sine', 1200, null, 0, 0.015, 0.1);
    return Math.max(a, b, c);
  },

  plate: (v) => {
    const f = filterNode(v.ctx, 'lowpass', 900, 1.0);
    f.connect(v.out);
    const a = tone(v, 'square', 220, 180, 0, 0.07, 0.22, 0.002, 0.05, f);
    const b = tone(v, 'sine', 110, 85, 0, 0.12, 0.35);
    const c = tick(v, 0.003, 2000, 0.25, 0.02);
    return Math.max(a, b, c);
  },

  robotStep: (v) => {
    const a = modal(v, 0, 610, [1, 2.37, 3.9], [0.07, 0.05, 0.03], [1, 0.5, 0.25], 0.2);
    const b = tone(v, 'sine', 140, 100, 0, 0.08, 0.35);
    const f = filterNode(v.ctx, 'lowpass', 1200, 1.5);
    f.connect(v.out);
    const c = tone(v, 'sawtooth', 300, 460, 0.01, 0.06, 0.06, 0.01, 0.05, f);
    return Math.max(a, b, c);
  },

  robotBeep: (v) => {
    const f = filterNode(v.ctx, 'lowpass', 2600, 0.8);
    f.connect(v.out);
    const a = tone(v, 'square', 880, null, 0, 0.07, 0.11, 0.004, -1, f);
    const b = tone(v, 'square', 1318, null, 0.09, 0.09, 0.11, 0.004, -1, f);
    const c = tone(v, 'sine', 880, null, 0, 0.07, 0.12, 0.004);
    const d = tone(v, 'sine', 1318, null, 0.09, 0.09, 0.12, 0.004);
    return Math.max(a, b, c, d);
  },

  success: (v) => {
    // F major kalimba arpeggio: F5 A5 C6 F6 then a soft dyad
    const notes = [698.46, 880.0, 1046.5, 1396.9];
    let e = 0;
    notes.forEach((f, i) => {
      e = Math.max(e, fmPluck(v, i * 0.085, f, 3, 1.2, 0.06, 0.26 - i * 0.02, 0.6));
      e = Math.max(e, tone(v, 'sine', f, null, i * 0.085, 0.5, 0.1, 0.003));
    });
    e = Math.max(e, fmPluck(v, 0.38, 880, 1, 0.8, 0.3, 0.14, 1.1, v.out, 0.008));
    e = Math.max(e, fmPluck(v, 0.38, 1318.5, 1, 0.6, 0.3, 0.1, 1.1, v.out, 0.008));
    e = Math.max(e, tone(v, 'sine', 349.23, null, 0.38, 1.0, 0.16, 0.01));
    return e;
  },

  goal: (v) => {
    // bigger celebration: two-bar rising kalimba run, bell, warm chord
    const run = [523.25, 587.33, 698.46, 880.0, 1046.5, 1174.7, 1396.9];
    let e = 0;
    run.forEach((f, i) => {
      e = Math.max(e, fmPluck(v, i * 0.07, f, 3, 1.1, 0.05, 0.2, 0.5));
    });
    const tc = 0.55;
    const chord = [349.23, 440.0, 523.25, 659.25, 880.0];
    chord.forEach((f, i) => {
      e = Math.max(e, fmPluck(v, tc + i * 0.012, f, 1, 1.0, 0.4, 0.1, 1.9, v.out, 0.01));
    });
    e = Math.max(e, modal(v, tc, 1396.9, [1, 2.0, 2.76, 5.4], [1.6, 0.9, 0.6, 0.2], [1, 0.25, 0.3, 0.1], 0.16, 0.002));
    e = Math.max(e, tone(v, 'sine', 174.61, null, tc, 1.6, 0.25, 0.02));
    e = Math.max(e, noise(v, 'white', tc, 0.9, 0.04, 'highpass', 7000, null, 0.7, 0.05));
    return e;
  },

  rewind: (v) => {
    const { ctx } = v;
    const t = v.t;
    const dur = 0.6;
    const s = ctx.createBufferSource();
    s.buffer = v.nb.tapeRev;
    s.loop = true;
    s.playbackRate.setValueAtTime(0.6, t);
    s.playbackRate.exponentialRampToValueAtTime(3.2, t + dur * 0.7);
    s.playbackRate.exponentialRampToValueAtTime(1.4, t + dur);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
    const lp = filterNode(ctx, 'lowpass', 2800, 0.9);
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.05);
    g.gain.setValueAtTime(0.4, t + dur - 0.15);
    g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(lp).connect(g).connect(v.out);
    const b = tone(v, 'sine', 900, 300, 0, dur * 0.8, 0.06, 0.04);
    return Math.max(dur + 0.02, b);
  },

  tick: (v) => tick(v, 0, 3000, 0.22, 0.02),

  connect: (v) => {
    const a = fmPluck(v, 0, 659.25, 2, 0.9, 0.04, 0.22, 0.18);
    const b = fmPluck(v, 0.06, 987.77, 2, 0.9, 0.04, 0.2, 0.22);
    return Math.max(a, b, tick(v, 0, 3500, 0.15, 0.015));
  },

  disconnect: (v) => {
    const a = fmPluck(v, 0, 987.77, 2, 0.9, 0.04, 0.2, 0.16);
    const b = fmPluck(v, 0.06, 587.33, 2, 0.9, 0.04, 0.2, 0.2);
    const c = tone(v, 'sine', 600, 250, 0.06, 0.07, 0.15, 0.001, 0.04);
    return Math.max(a, b, c);
  },

  ignite: (v) => {
    const { ctx } = v;
    const t = v.t;
    const dur = 0.65;
    const s = noiseNode(ctx, v.nb.pink, t, t + dur);
    const f = filterNode(ctx, 'bandpass', 200, 0.9);
    f.frequency.setValueAtTime(180 * v.p, t);
    f.frequency.exponentialRampToValueAtTime(1500 * v.p, t + 0.18);
    f.frequency.exponentialRampToValueAtTime(500 * v.p, t + dur);
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.7, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    g.gain.setValueAtTime(0, t + dur + 0.001);
    s.connect(f).connect(g).connect(v.out);
    const b = tone(v, 'sine', 70, 50, 0, 0.4, 0.3, 0.03);
    const c = noise(v, 'white', 0, 0.02, 0.18, 'highpass', 3000, null, 0.7);
    return Math.max(dur + 0.01, b, c);
  },

  splash: (v) => {
    let e = noise(v, 'white', 0, 0.35, 0.4, 'bandpass', 2600, 900, 0.6, 0.006);
    e = Math.max(e, noise(v, 'pink', 0, 0.2, 0.35, 'lowpass', 900, 300, 0.7));
    // bubbles: short upward sine chirps
    const n = 6;
    for (let i = 0; i < n; i++) {
      const at = 0.03 + Math.random() * 0.4;
      const f = rnd(450, 1100);
      e = Math.max(e, tone(v, 'sine', f, f * rnd(1.6, 2.4), at, rnd(0.03, 0.06), rnd(0.06, 0.14), 0.002, 0.04));
    }
    return e;
  },
};

// ---------------------------------------------------------------------------
// Collision impacts

export type Material = 'metal' | 'wood' | 'rubber' | 'glass' | 'paper' | 'robot' | 'stone';

export function normMaterial(m: string): Material {
  switch (m) {
    case 'metal': case 'wood': case 'rubber': case 'glass': case 'paper': case 'robot': case 'stone':
      return m;
    default:
      return 'wood';
  }
}

/** Synthesises one material layer of a collision. e = energy 0..1, amp = layer gain. */
export function impactLayer(v: Voice, mat: Material, e: number, amp: number): number {
  const bright = 0.45 + 0.55 * e;
  const j = rnd(0.94, 1.06);
  switch (mat) {
    case 'wood': {
      const a = modal(v, 0, 300 * j * (1 + 0.15 * e), [1, 2.31, 4.1], [0.09, 0.045, 0.025], [1, 0.45 * bright, 0.2 * bright], amp * 0.55);
      const b = noise(v, 'white', 0, 0.01, amp * 0.25 * bright, 'bandpass', 1900, null, 1.2);
      const c = tone(v, 'sine', 140 * j, 100 * j, 0, 0.07, amp * 0.3 * e);
      return Math.max(a, b, c);
    }
    case 'metal': {
      const d = 0.15 + 0.35 * e;
      const a = modal(v, 0, 620 * j, [1, 2.76, 5.4, 8.9], [d, d * 0.7, d * 0.4, d * 0.2], [1, 0.5 * bright, 0.3 * bright, 0.15 * bright], amp * 0.3);
      const b = noise(v, 'white', 0, 0.008, amp * 0.25 * bright, 'highpass', 3000, null, 0.8);
      return Math.max(a, b);
    }
    case 'glass': {
      const d = 0.12 + 0.3 * e;
      const a = modal(v, 0, 2100 * j, [1, 2.32, 4.25], [d, d * 0.6, d * 0.35], [1, 0.4 * bright, 0.2 * bright], amp * 0.2);
      const b = noise(v, 'white', 0, 0.006, amp * 0.18, 'highpass', 4000, null, 0.8);
      return Math.max(a, b);
    }
    case 'rubber': {
      const a = tone(v, 'sine', 160 * j, 85 * j, 0, 0.12, amp * 0.6, 0.004, 0.06);
      const b = noise(v, 'pink', 0, 0.05, amp * 0.25 * bright, 'lowpass', 600 * (0.6 + e), null, 1.4);
      const c = tone(v, 'sine', 320 * j, 210 * j, 0, 0.05, amp * 0.15 * e, 0.002);
      return Math.max(a, b, c);
    }
    case 'paper': {
      const a = noise(v, 'white', 0, 0.045, amp * 0.25, 'bandpass', 3200 * j, null, 0.9, 0.003);
      const b = noise(v, 'pink', 0.02, 0.04, amp * 0.15, 'bandpass', 1800 * j, null, 0.9, 0.004);
      return Math.max(a, b);
    }
    case 'robot': {
      const a = modal(v, 0, 360 * j, [1, 1.93, 3.31, 5.1], [0.18, 0.13, 0.08, 0.05], [1, 0.6 * bright, 0.35 * bright, 0.2 * bright], amp * 0.3);
      const b = tone(v, 'sine', 170 * j, 110 * j, 0, 0.09, amp * 0.4);
      const c = noise(v, 'white', 0, 0.01, amp * 0.2 * bright, 'bandpass', 2600, null, 1.5);
      return Math.max(a, b, c);
    }
    case 'stone': {
      const a = noise(v, 'brown', 0, 0.08, amp * 0.6, 'lowpass', 700 * (0.6 + e), null, 1.0);
      const b = tone(v, 'sine', 100 * j, 70 * j, 0, 0.1, amp * 0.45);
      const c = noise(v, 'white', 0, 0.006, amp * 0.2 * bright, 'bandpass', 2300, null, 1.2);
      return Math.max(a, b, c);
    }
  }
}

export const clampE = (x: number): number => clamp(x, 0, 1);
