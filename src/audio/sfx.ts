// One-shot sound recipes. Each recipe schedules nodes into `v.out` starting at `v.t`
// and returns its total length in seconds (relative to v.t).

import { Inst } from './instruments';
import type { MusicTheme } from './themes';
import { NoiseBank, clamp, filterNode, gainNode, glide, midiToHz, noiseNode, oscNode, perc } from './synth';

export interface Voice {
  ctx: BaseAudioContext;
  out: AudioNode;
  t: number;
  /** pitch multiplier */
  p: number;
  nb: NoiseBank;
  /** current theme, for themed stingers */
  theme?: MusicTheme;
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

/** Sparse crackle (fire / debris fizz) through a high-pass. */
function crackle(v: Voice, at: number, dur: number, amp: number, hp: number): number {
  const { ctx } = v;
  const t = v.t + at;
  const s = noiseNode(ctx, v.nb.crackle, t, t + dur, 1.4);
  const f = filterNode(ctx, 'highpass', hp, 0.7);
  const g = gainNode(ctx, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + 0.01);
  g.gain.exponentialRampToValueAtTime(amp * 0.001, t + dur);
  g.gain.setValueAtTime(0, t + dur + 0.001);
  s.connect(f).connect(g).connect(v.out);
  return at + dur + 0.01;
}

/** Falling debris: n small wood ticks and metal pings scattered over `spread` seconds, fading. */
function debris(v: Voice, at: number, spread: number, n: number, amp: number): number {
  let e = 0;
  for (let i = 0; i < n; i++) {
    const u = Math.pow(Math.random(), 0.8);
    const tt = at + u * spread;
    const a = amp * (1 - 0.7 * u) * rnd(0.5, 1);
    if (Math.random() < 0.6) {
      const f = rnd(900, 2400);
      e = Math.max(e, noise(v, 'white', tt, 0.012, a, 'bandpass', f, null, 3, 0.0005));
      e = Math.max(e, tone(v, 'sine', f * 0.45, null, tt, 0.03, a * 0.5, 0.001));
    } else {
      e = Math.max(e, modal(v, tt, rnd(1400, 3200), [1, 2.76], [0.06, 0.03], [1, 0.4], a * 0.6));
    }
  }
  return e;
}

// ---------------------------------------------------------------------------
// Themed stingers: 'ding' (a goal met), 'success' (results card), 'goal' (level solved).

const TONIC: Record<MusicTheme, number> = { modern: 53, stone: 50, steam: 48, retro: 55, comic: 46, future: 57 };

function sparkle(v: Voice, at: number, len: number, amp: number): number {
  return noise(v, 'white', at, len, amp, 'highpass', 7000, null, 0.7, 0.04);
}

function whump(v: Voice, at: number, amp: number): number {
  return tone(v, 'sine', 90, 42, at, 0.45, amp, 0.003, 0.2);
}

/** Steam whistle: two detuned pipe tones with breath, a small upward scoop. */
function whistle(v: Voice, at: number, len: number, m: number): number {
  const { ctx } = v;
  const t = v.t + at;
  const f = midiToHz(m);
  const end = t + len + 0.15;
  const g = gainNode(ctx, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.05);
  g.gain.setValueAtTime(0.12, t + len);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  g.gain.setValueAtTime(0, end + 0.001);
  g.connect(v.out);
  for (const r of [1, 1.26]) {
    const o = oscNode(ctx, 'sine', f * r * 0.94, t, end);
    o.frequency.exponentialRampToValueAtTime(f * r, t + 0.08);
    o.connect(g);
  }
  const n = noise(v, 'white', at, len, 0.06, 'bandpass', f * 1.1, null, 3, 0.04);
  return Math.max(n, at + len + 0.16);
}

/** Per-theme loudness trims (dB), measured from offline renders so every theme's stinger lands alike. */
const STINGER_TRIM: Record<'ding' | 'success' | 'goal', Record<MusicTheme, number>> = {
  ding: { modern: 1, stone: 0, steam: -3, retro: 6, comic: -1, future: 4 },
  success: { modern: 0, stone: 3, steam: -3, retro: 3, comic: 0, future: -1 },
  goal: { modern: 0, stone: 3, steam: -2, retro: 3, comic: 1, future: 0 },
};

export function stinger(v0: Voice, size: 'ding' | 'success' | 'goal'): number {
  const th: MusicTheme = v0.theme ?? 'modern';
  const trim = gainNode(v0.ctx, Math.pow(10, STINGER_TRIM[size][th] / 20));
  trim.connect(v0.out);
  const v: Voice = { ...v0, out: trim };
  const k = new Inst(v.ctx, v.nb);
  const o = v.out;
  const K = TONIC[th];
  const maj = (r: number): number[] => [r, r + 4, r + 7];
  const at = (x: number): number => v.t + x;
  let e = 0;

  if (size === 'ding') {
    switch (th) {
      case 'modern':
        return modal(v, 0, 1318.5, [1, 2.0, 2.76, 5.4, 8.93], [1.3, 0.7, 0.5, 0.2, 0.08], [1, 0.25, 0.3, 0.12, 0.05], 0.3, 0.002);
      case 'stone':
        k.mallet(at(0), K + 31, 0.28, o, 'kalimba');
        k.mallet(at(0.09), K + 36, 0.3, o, 'kalimba');
        k.logDrum(at(0), K + 7, 0.25, o);
        return 1.2;
      case 'steam':
        k.mallet(at(0), K + 31, 0.28, o, 'musicbox');
        k.mallet(at(0.1), K + 36, 0.3, o, 'musicbox');
        k.triangleBell(at(0.1), 0.08, o);
        return 1.8;
      case 'retro':
        k.lead(at(0), K + 28, 0.16, 0.06, o, 'square');
        k.lead(at(0.07), K + 35, 0.16, 0.22, o, 'square');
        k.lead(at(0.25), K + 35, 0.05, 0.12, o, 'square');
        return 0.6;
      case 'comic':
        k.mallet(at(0), K + 31, 0.25, o, 'glock');
        k.mallet(at(0.08), K + 36, 0.28, o, 'glock');
        k.stab(at(0.08), maj(K + 24), 0.16, 0.12, o, 'brass');
        return 1.5;
      case 'future':
        k.lead(at(0), K + 24, 0.22, 0.3, o, 'fmbell');
        k.arp(at(0.06), K + 31, 0.12, 0.6, o);
        k.arp(at(0.12), K + 36, 0.1, 0.7, o);
        return 1.3;
    }
  }

  if (size === 'success') {
    // a short confirmation: rising tonic arpeggio + chord
    const arp = [K + 12, K + 16, K + 19, K + 24];
    const chord = maj(K + 12).concat([K + 24]);
    switch (th) {
      case 'modern':
        arp.forEach((m, i) => { e = Math.max(e, fmPluck(v, i * 0.085, midiToHz(m + 12), 3, 1.2, 0.06, 0.26 - i * 0.02, 0.6)); });
        chord.forEach((m, i) => k.ep(at(0.38 + i * 0.012), m, 0.12, 0.6, o));
        k.bass(at(0.38), K - 12, 0.2, 0.7, o, 'round');
        return Math.max(e, 2.0);
      case 'stone':
        arp.forEach((m, i) => k.mallet(at(i * 0.08), m + 12, 0.24, o, 'marimba'));
        chord.forEach((m) => k.mallet(at(0.36), m + 12, 0.14, o, 'kalimba'));
        k.logDrum(at(0.36), K, 0.3, o);
        k.hand(at(0.36), 'bass', 0.25, o);
        return 1.5;
      case 'steam':
        arp.forEach((m, i) => k.mallet(at(i * 0.09), m + 24, 0.2, o, 'musicbox'));
        k.stab(at(0.4), chord, 0.2, 0.6, o, 'organ');
        k.bass(at(0.4), K - 12, 0.25, 0.6, o, 'tuba');
        return 2.0;
      case 'retro':
        arp.forEach((m, i) => k.lead(at(i * 0.06), m + 12, 0.13, 0.05, o, 'square'));
        k.stab(at(0.27), chord.map((m) => m + 12), 0.16, 0.35, o, 'square');
        k.bass(at(0.27), K - 12, 0.25, 0.35, o, 'fm');
        k.kick(at(0.27), 0.3, o, 'machine');
        return 1.0;
      case 'comic':
        k.roll(at(0), 0.3, 0.03, 0.12, o);
        k.stab(at(0.32), chord.map((m) => m + 12), 0.25, 0.5, o, 'brass');
        k.timpani(at(0.32), K - 12, 0.3, o);
        k.crash(at(0.32), 0.08, o, 1.2);
        return 1.7;
      case 'future':
        arp.forEach((m, i) => k.arp(at(i * 0.06), m + 12, 0.12, 0.5 + i * 0.1, o));
        k.pad(at(0.25), chord, 0.16, 0.6, o, 'analog');
        k.bass(at(0.25), K - 24, 0.3, 0.5, o, 'sub');
        return 2.2;
    }
  }

  // size === 'goal': level solved. Pickup run, a big chord hit at H, sub whump and sparkle.
  const H = 0.55;
  e = Math.max(whump(v, H, 0.55), sparkle(v, H, 1.0, 0.035));
  switch (th) {
    case 'modern': {
      [72, 74, 77, 79, 81, 84, 86].forEach((m, i) => k.mallet(at(i * 0.07), m + (K - 53), 0.22, o, 'kalimba', (i - 3) * 0.1));
      [K, K + 4, K + 7, K + 11, K + 14].forEach((m, i) => k.ep(at(H + i * 0.014), m, 0.13, 1.2, o));
      k.bass(at(H), K - 12, 0.28, 1.2, o, 'round');
      k.mallet(at(H), K + 36, 0.16, o, 'glock');
      k.kick(at(H), 0.3, o, 'soft');
      return Math.max(e, 2.8);
    }
    case 'stone': {
      // log-drum triplet pickup, marimba run, then a marimba tremolo chord
      [0, 7, 12].forEach((x, i) => k.logDrum(at(i * 0.1), K + 12 + x, 0.3, o, (i - 1) * 0.3));
      [K + 14, K + 16, K + 19, K + 21, K + 24].forEach((m, i) => k.mallet(at(0.25 + i * 0.06), m + 12, 0.18, o, 'marimba'));
      for (let r = 0; r < 8; r++) {
        const a = 0.14 * (1 - r / 10);
        [K + 24, K + 28, K + 31].forEach((m) => k.mallet(at(H + r * 0.07), m, a, o, 'marimba'));
      }
      k.mallet(at(H), K + 36, 0.22, o, 'kalimba');
      k.bass(at(H), K - 12, 0.35, 0.8, o, 'wood');
      k.hand(at(H), 'bass', 0.3, o);
      k.hand(at(H + 0.15), 'slap', 0.25, o, 0.3);
      k.rainstick(at(H), 1.4, 0.07, o);
      return Math.max(e, 2.4);
    }
    case 'steam': {
      // steam whistle, music-box run, then the calliope chord
      e = Math.max(e, whistle(v, 0, 0.5, K + 36));
      [K + 24, K + 28, K + 31, K + 36].forEach((m, i) => k.mallet(at(0.08 + i * 0.09), m, 0.2, o, 'musicbox'));
      k.stab(at(H), [K + 12, K + 16, K + 19, K + 24], 0.24, 1.0, o, 'organ');
      k.lead(at(H), K + 28, 0.16, 1.0, o, 'calliope');
      k.bass(at(H), K - 12, 0.3, 1.0, o, 'tuba');
      k.triangleBell(at(H), 0.1, o);
      k.chuff(at(H + 0.2), 0.12, o, -0.3);
      k.chuff(at(H + 0.4), 0.1, o, 0.3);
      return Math.max(e, 2.8);
    }
    case 'retro': {
      // an original "stage clear": quick square arpeggio, a held chord with a bouncing echo
      [K + 12, K + 16, K + 19, K + 24, K + 28, K + 31].forEach((m, i) => k.lead(at(i * 0.07), m + 12, 0.12, 0.06, o, 'square'));
      k.stab(at(H), [K + 24, K + 28, K + 31], 0.22, 0.5, o, 'square');
      k.lead(at(H), K + 36, 0.12, 0.6, o, 'square');
      k.stab(at(H + 0.22), [K + 24, K + 28, K + 31], 0.08, 0.3, o, 'square');
      k.bass(at(H), K - 12, 0.3, 0.25, o, 'fm');
      k.bass(at(H + 0.25), K, 0.22, 0.3, o, 'fm');
      k.kick(at(H), 0.35, o, 'machine');
      k.hat(at(H), 0.08, o, true);
      return Math.max(e, 2.0);
    }
    case 'comic': {
      // snare roll, "ta-ta-taaa!" brass, crash and timpani
      k.roll(at(0), 0.42, 0.03, 0.16, o);
      k.lead(at(0.3), K + 19, 0.16, 0.09, o, 'brass');
      k.lead(at(0.42), K + 19, 0.16, 0.09, o, 'brass');
      k.lead(at(H), K + 24, 0.2, 1.0, o, 'brass');
      k.stab(at(H), [K + 12, K + 16, K + 19], 0.26, 1.0, o, 'brass');
      k.timpani(at(H), K - 12, 0.35, o);
      k.timpani(at(H + 0.3), K - 5, 0.2, o);
      k.crash(at(H), 0.12, o, 1.8);
      k.mallet(at(H), K + 36, 0.14, o, 'glock');
      return Math.max(e, 2.8);
    }
    case 'future': {
      // riser + 16th sweep, then a major pad (a bright resolve) with a sub drop
      k.riser(at(0), H, 0.08, o);
      [0, 3, 5, 7, 10, 12, 15, 17].forEach((x, i) => k.arp(at(i * 0.055), K + 12 + x, 0.11, 0.4 + i * 0.07, o, i % 2 ? 0.4 : -0.4));
      k.pad(at(H), [K, K + 4, K + 7, K + 14], 0.26, 1.1, o, 'analog');
      k.lead(at(H), K + 24, 0.16, 0.9, o, 'fmbell');
      k.bass(at(H), K - 24, 0.4, 0.8, o, 'sub');
      k.kick(at(H), 0.35, o, 'deep');
      return Math.max(e, 3.0);
    }
  }
  return e;
}

export type Recipe = (v: Voice) => number;

export const RECIPES: Record<string, Recipe> = {
  click: (v) => {
    // crisp: bright transient, small plastic body, a hint of low "seat"
    const a = noise(v, 'white', 0, 0.006, 0.3, 'highpass', 4200, null, 0.8, 0.0006);
    const b = tick(v, 0, 3200, 0.3, 0.022);
    const c = tone(v, 'sine', 2100, 1700, 0, 0.018, 0.12, 0.001, 0.015);
    const d = tone(v, 'sine', 420, 300, 0, 0.03, 0.08, 0.001, 0.02);
    return Math.max(a, b, c, d);
  },

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
    // satisfying snap: bright click, wood-block "thock", low thump, then a tiny latch "seat"
    const a = noise(v, 'white', 0, 0.007, 0.32, 'bandpass', 3600, null, 1.6, 0.0006);
    const b = modal(v, 0, 520, [1, 2.71, 4.4], [0.08, 0.035, 0.018], [1, 0.35, 0.12], 0.42);
    const c = tone(v, 'sine', 160, 92, 0, 0.12, 0.55, 0.0015, 0.05);
    const d = tick(v, 0.03, 4200, 0.13, 0.016);
    const e = tone(v, 'sine', 1240, null, 0.03, 0.03, 0.05, 0.001);
    return Math.max(a, b, c, d, e);
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
    // sub thump + crack + rolling body + crackle + falling debris
    const sub = tone(v, 'sine', 72, 27, 0, 0.95, 0.95, 0.002, 0.45);
    const crack = noise(v, 'white', 0, 0.035, 0.55, 'highpass', 1200, null, 0.7, 0.0005);
    const body = noise(v, 'brown', 0, 1.2, 0.95, 'lowpass', 1800, 90, 0.8, 0.003);
    const mid = noise(v, 'pink', 0.03, 0.7, 0.22, 'bandpass', 600, 160, 0.8, 0.02);
    let e = Math.max(sub, crack, body, mid);
    e = Math.max(e, crackle(v, 0.06, 1.1, 0.35, 1300));
    e = Math.max(e, debris(v, 0.18, 1.2, 9, 0.12));
    return e;
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
    const a = tone(v, 'sine', 120, 36, 0, 0.6, 0.9, 0.0015, 0.22);
    const b = noise(v, 'brown', 0, 0.75, 0.8, 'lowpass', 2000, 120, 0.8);
    const c = noise(v, 'white', 0, 0.03, 0.5, 'bandpass', 1500, 500, 0.8, 0.0005);
    const d = tone(v, 'triangle', 300, 140, 0, 0.1, 0.25, 0.001, 0.08);
    // the barrel rings briefly
    const ring = modal(v, 0.005, 240, [1, 2.76, 5.1], [0.35, 0.2, 0.1], [1, 0.4, 0.15], 0.07);
    const smoke = crackle(v, 0.05, 0.45, 0.15, 1800);
    return Math.max(a, b, c, d, ring, smoke);
  },

  // goal met: a themed bell ping (see stinger())
  ding: (v) => stinger(v, 'ding'),

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

  // results card / level solved: themed flourishes (see stinger())
  success: (v) => stinger(v, 'success'),
  goal: (v) => stinger(v, 'goal'),

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

  // --- optics (best effort; the optics parts may or may not call these)
  laserOn: (v) => {
    const a = tone(v, 'sawtooth', 220, 1760, 0, 0.14, 0.12, 0.002, 0.12);
    const b = tone(v, 'sine', 330, 2640, 0, 0.16, 0.16, 0.002, 0.14);
    const c = tone(v, 'sine', 120, 110, 0, 0.35, 0.25, 0.004);
    const d = tone(v, 'sine', 880, null, 0.12, 0.25, 0.06, 0.02);
    const e = noise(v, 'white', 0, 0.008, 0.18, 'highpass', 3000, null, 0.7, 0.0005);
    return Math.max(a, b, c, d, e);
  },

  beamHit: (v) => {
    const a = noise(v, 'white', 0, 0.07, 0.6, 'bandpass', 4200, 2200, 1.5, 0.001);
    const b = tone(v, 'sine', 3100, 2400, 0, 0.05, 0.2, 0.001);
    const c = tone(v, 'square', 1800, 900, 0, 0.03, 0.08, 0.001);
    const d = tone(v, 'sine', 700, 500, 0, 0.04, 0.12, 0.001);
    return Math.max(a, b, c, d);
  },

  sensorOn: (v) => {
    const a = fmPluck(v, 0, 1318.5, 2, 0.7, 0.04, 0.2, 0.14);
    const b = fmPluck(v, 0.07, 1975.5, 2, 0.7, 0.04, 0.18, 0.2);
    const c = tick(v, 0, 3800, 0.12, 0.012);
    return Math.max(a, b, c);
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

/** What a body is, beyond its material, for impact flavour ('' when nothing special). */
export type ImpactKind = '' | 'domino' | 'heavy' | 'ball' | 'floor';

export function normKind(k: unknown): ImpactKind {
  return k === 'domino' || k === 'heavy' || k === 'ball' || k === 'floor' ? k : '';
}

/**
 * Synthesises one material layer of a collision: a short transient (the "click" of contact), a
 * body (modal partials / pitched thump) and a material tail. e = energy 0..1, amp = layer gain.
 */
export function impactLayer(v: Voice, mat: Material, e: number, amp: number, kind: ImpactKind = ''): number {
  const bright = 0.45 + 0.55 * e;
  const j = rnd(0.94, 1.06);
  if (kind === 'heavy') {
    // bowling ball / cannonball: a deep thud with weight, a little floor rumble, a dull ring
    const body = tone(v, 'sine', 95 * j, 44 * j, 0, 0.18 + 0.12 * e, amp * (0.55 + 0.35 * e), 0.002, 0.08);
    const knock = tone(v, 'triangle', 190 * j, 120 * j, 0, 0.06, amp * 0.25 * bright, 0.001, 0.04);
    const trans = noise(v, 'white', 0, 0.006, amp * 0.22 * bright, 'bandpass', 1400, null, 1.1, 0.0005);
    const rumble = noise(v, 'brown', 0, 0.2 + 0.2 * e, amp * 0.45 * e, 'lowpass', 260, 120, 0.9, 0.004);
    const ring = mat === 'metal' && e > 0.35 ? modal(v, 0, 420 * j, [1, 2.71, 5.2], [0.25, 0.15, 0.08], [1, 0.35, 0.12], amp * 0.06 * e) : 0;
    return Math.max(body, knock, trans, rumble, ring);
  }
  if (kind === 'domino') {
    // the classic clack: bright, short, slightly hollow; lower against the floor
    const f = (mat === 'wood' ? 1150 : 900) * j;
    const trans = noise(v, 'white', 0, 0.004, amp * 0.4 * bright, 'bandpass', 3400 * j, null, 2, 0.0004);
    const body = modal(v, 0, f, [1, 1.73, 2.94], [0.035, 0.02, 0.012], [1, 0.45 * bright, 0.2 * bright], amp * 0.6);
    const knock = tone(v, 'sine', 520 * j, 380 * j, 0, 0.03, amp * 0.35 * (0.3 + 0.7 * e), 0.001, 0.02);
    return Math.max(trans, body, knock);
  }
  switch (mat) {
    case 'wood': {
      const trans = noise(v, 'white', 0, 0.006, amp * 0.28 * bright, 'bandpass', 2400, null, 1.4, 0.0005);
      const a = modal(v, 0, 300 * j * (1 + 0.15 * e), [1, 2.31, 4.1], [0.09, 0.045, 0.025], [1, 0.45 * bright, 0.2 * bright], amp * 0.55);
      const c = tone(v, 'sine', 140 * j, 96 * j, 0, 0.07 + 0.03 * e, amp * 0.35 * e, 0.001, 0.05);
      return Math.max(trans, a, c);
    }
    case 'metal': {
      // clang: detuned partial pairs beat against each other; harder hits ring longer
      const d = 0.18 + 0.55 * e;
      const trans = noise(v, 'white', 0, 0.006, amp * 0.28 * bright, 'highpass', 3000, null, 0.8, 0.0004);
      const a = modal(v, 0, 620 * j, [1, 1.007, 2.76, 2.79, 5.4, 8.9], [d, d * 0.9, d * 0.7, d * 0.6, d * 0.4, d * 0.2], [1, 0.6, 0.5 * bright, 0.3 * bright, 0.3 * bright, 0.15 * bright], amp * 0.26);
      const thunk = tone(v, 'sine', 180 * j, 130 * j, 0, 0.06, amp * 0.3 * e, 0.001, 0.04);
      return Math.max(trans, a, thunk);
    }
    case 'glass': {
      const d = 0.12 + 0.3 * e;
      const a = modal(v, 0, 2100 * j, [1, 2.32, 4.25], [d, d * 0.6, d * 0.35], [1, 0.4 * bright, 0.2 * bright], amp * 0.2);
      const b = noise(v, 'white', 0, 0.006, amp * 0.18, 'highpass', 4000, null, 0.8);
      return Math.max(a, b);
    }
    case 'rubber': {
      // soft thump; a bouncing ball (or a hard bounce) adds a little "boing"
      const a = tone(v, 'sine', 160 * j, 85 * j, 0, 0.12, amp * 0.6, 0.004, 0.06);
      const b = noise(v, 'pink', 0, 0.05, amp * 0.25 * bright, 'lowpass', 600 * (0.6 + e), null, 1.4);
      const c = tone(v, 'sine', 320 * j, 210 * j, 0, 0.05, amp * 0.15 * e, 0.002);
      let boing = 0;
      if (kind === 'ball' || e > 0.55) {
        const { ctx } = v;
        const t = v.t;
        const dur = 0.16 + 0.14 * e;
        const o = oscNode(ctx, 'sine', 210 * j * v.p, t, t + dur);
        o.frequency.setValueAtTime(190 * j * v.p, t);
        o.frequency.exponentialRampToValueAtTime(340 * j * v.p, t + dur);
        const lfo = oscNode(ctx, 'sine', 24, t, t + dur);
        const lg = gainNode(ctx, 30 * v.p);
        lfo.connect(lg).connect(o.frequency);
        const g = gainNode(ctx, 0);
        perc(g.gain, t + 0.004, amp * 0.22 * e, 0.006, dur - 0.01);
        o.connect(g).connect(v.out);
        boing = dur + 0.02;
      }
      return Math.max(a, b, c, boing);
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
      // thud + grit
      const a = noise(v, 'brown', 0, 0.08, amp * 0.6, 'lowpass', 700 * (0.6 + e), null, 1.0);
      const b = tone(v, 'sine', 100 * j, 66 * j, 0, 0.1, amp * 0.45, 0.002, 0.06);
      const c = noise(v, 'white', 0, 0.006, amp * 0.2 * bright, 'bandpass', 2300, null, 1.2, 0.0005);
      const grit = e > 0.4 ? crackle(v, 0.002, 0.05 + 0.05 * e, amp * 0.25 * e, 2500) : 0;
      return Math.max(a, b, c, grit);
    }
  }
}

export const clampE = (x: number): number => clamp(x, 0, 1);
