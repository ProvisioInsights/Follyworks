// Synthesised instruments for the generative music. One `Inst` per music player; every method
// schedules a short-lived node graph at time `t` into `dest` and never throws. A small voice
// limiter (by end time) keeps CPU bounded: low-priority notes are dropped first when busy.

import { NoiseBank, clamp, filterNode, gainNode, midiToHz, noiseNode, oscNode, perc } from './synth';

/** 0 = ornament (drop first), 1 = normal, 2 = structural (bass/chords). */
export type Prio = 0 | 1 | 2;

const VOICE_CAP = 30;

export class Inst {
  readonly ctx: BaseAudioContext;
  readonly nb: NoiseBank;
  private ends: number[] = [];
  private pulse: PeriodicWave | null = null;
  private organ: PeriodicWave | null = null;
  /** count of notes refused by the limiter (diagnostics) */
  dropped = 0;

  constructor(ctx: BaseAudioContext, nb: NoiseBank) {
    this.ctx = ctx;
    this.nb = nb;
    try {
      // 25 % pulse: a_n = 2/(n pi) sin(n pi d)
      const n = 24;
      const re = new Float32Array(n);
      const im = new Float32Array(n);
      for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
      this.pulse = ctx.createPeriodicWave(re, im);
      // calliope / organ pipe: strong fundamental, octave, a little twelfth
      const re2 = new Float32Array(8);
      const im2 = new Float32Array([0, 1, 0.5, 0.22, 0.12, 0.05, 0.03, 0.01]);
      this.organ = ctx.createPeriodicWave(re2, im2);
    } catch {
      this.pulse = null;
      this.organ = null;
    }
  }

  /** Reserve a voice that lasts until `end`. */
  admit(t: number, end: number, prio: Prio): boolean {
    const now = this.ctx.currentTime;
    if (this.ends.length > 8) this.ends = this.ends.filter((e) => e > now);
    // voices still sounding when this one starts (notes are scheduled ahead of time)
    let n = 0;
    for (const e of this.ends) if (e > t) n++;
    const cap = prio === 2 ? VOICE_CAP + 10 : prio === 1 ? VOICE_CAP : VOICE_CAP - 8;
    if (n >= cap) {
      this.dropped++;
      return false;
    }
    this.ends.push(Math.max(end, t));
    return true;
  }

  get activeVoices(): number {
    const now = this.ctx.currentTime;
    return this.ends.filter((e) => e > now).length;
  }

  private osc(type: OscillatorType | 'pulse' | 'organ', f: number, t: number, end: number): OscillatorNode {
    const o = oscNode(this.ctx, type === 'pulse' || type === 'organ' ? 'square' : type, f, t, end);
    const w = type === 'pulse' ? this.pulse : type === 'organ' ? this.organ : null;
    if (w) o.setPeriodicWave(w);
    else if (type === 'organ') o.type = 'triangle';
    return o;
  }

  private panned(dest: AudioNode, pan: number): AudioNode {
    if (!pan || typeof this.ctx.createStereoPanner !== 'function') return dest;
    const p = this.ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    p.connect(dest);
    return p;
  }

  // ------------------------------------------------------------------ keys / mallets

  /** FM electric piano (Rhodes-ish) with a tine transient. */
  ep(t: number, m: number, amp: number, hold: number, dest: AudioNode, prio: Prio = 2): void {
    const end = t + hold + 1.2;
    if (!this.admit(t, end, prio)) return;
    const ctx = this.ctx;
    const f = midiToHz(m) * Math.pow(2, (Math.random() - 0.5) * 0.006);
    const car = oscNode(ctx, 'sine', f, t, end);
    const mod = oscNode(ctx, 'sine', f, t, end);
    const mg = gainNode(ctx, 0);
    mg.gain.setValueAtTime(f * 1.5, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.18, t + 0.6);
    mod.connect(mg).connect(car.frequency);
    const tine = oscNode(ctx, 'sine', f * 7.1, t, t + 0.2);
    const tg = gainNode(ctx, 0);
    perc(tg.gain, t, amp * 0.12, 0.001, 0.15);
    tine.connect(tg).connect(dest);
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(amp * 0.35, t + 0.9);
    g.gain.exponentialRampToValueAtTime(amp * 0.15, t + Math.max(1.0, hold));
    g.gain.exponentialRampToValueAtTime(amp * 1e-4, end);
    g.gain.setValueAtTime(0, end + 0.001);
    car.connect(g).connect(dest);
  }

  /** Mallet/tine family. */
  mallet(t: number, m: number, amp: number, dest: AudioNode, kind: 'kalimba' | 'marimba' | 'musicbox' | 'glock' | 'vibes', pan = 0, prio: Prio = 1): void {
    const ctx = this.ctx;
    const f = midiToHz(m);
    const len = kind === 'musicbox' ? 1.6 : kind === 'glock' ? 1.3 : kind === 'vibes' ? 1.8 : kind === 'marimba' ? 0.7 : 1.05;
    if (!this.admit(t, t + len, prio)) return;
    const out = this.panned(dest, pan);
    const car = oscNode(ctx, 'sine', f, t, t + len);
    const g = gainNode(ctx, 0);
    perc(g.gain, t, amp, kind === 'marimba' ? 0.003 : 0.0015, len);
    car.connect(g).connect(out);
    const partial = (ratio: number, a: number, d: number): void => {
      if (f * ratio > ctx.sampleRate * 0.42) return;
      const o = oscNode(ctx, 'sine', f * ratio, t, t + d);
      const pg = gainNode(ctx, 0);
      perc(pg.gain, t, amp * a, 0.001, d);
      o.connect(pg).connect(out);
    };
    switch (kind) {
      case 'kalimba': {
        partial(4, 0.22, 0.12);
        const mod = oscNode(ctx, 'sine', f * 3, t, t + 0.1);
        const mg = gainNode(ctx, 0);
        mg.gain.setValueAtTime(f * 1.2, t);
        mg.gain.exponentialRampToValueAtTime(1, t + 0.06);
        mod.connect(mg).connect(car.frequency);
        break;
      }
      case 'marimba':
        partial(3.93, 0.3, 0.09);
        partial(9.2, 0.08, 0.03);
        break;
      case 'musicbox':
        partial(5.95, 0.18, 0.18);
        partial(2.0, 0.12, 0.7);
        break;
      case 'glock':
        partial(2.76, 0.35, 0.5);
        partial(5.4, 0.15, 0.2);
        break;
      case 'vibes': {
        partial(4, 0.15, 0.4);
        // motor tremolo
        const lfo = oscNode(ctx, 'sine', 5.2, t, t + len);
        const lg = gainNode(ctx, amp * 0.3);
        lfo.connect(lg).connect(g.gain);
        break;
      }
    }
  }

  /** Short wooden/plastic pluck (pizzicato-ish), cheap. */
  pizz(t: number, m: number, amp: number, dest: AudioNode, pan = 0, prio: Prio = 1): void {
    if (!this.admit(t, t + 0.35, prio)) return;
    const ctx = this.ctx;
    const f = midiToHz(m);
    const o = oscNode(ctx, 'triangle', f, t, t + 0.35);
    const lp = filterNode(ctx, 'lowpass', Math.min(8000, f * 6), 0.8);
    lp.frequency.setValueAtTime(Math.min(8000, f * 8), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), t + 0.2);
    const g = gainNode(ctx, 0);
    perc(g.gain, t, amp, 0.002, 0.32);
    o.connect(lp).connect(g).connect(this.panned(dest, pan));
  }

  // ------------------------------------------------------------------ bass

  bass(t: number, m: number, amp: number, len: number, dest: AudioNode, kind: 'round' | 'tuba' | 'fm' | 'sub' | 'wood', prio: Prio = 2): void {
    const ctx = this.ctx;
    const f = midiToHz(m);
    const tail = kind === 'wood' ? 0.25 : kind === 'fm' ? 0.12 : 0.3;
    const end = t + len + tail;
    if (!this.admit(t, end, prio)) return;
    switch (kind) {
      case 'round': {
        const s = oscNode(ctx, 'sine', f, t, end);
        const tri = oscNode(ctx, 'triangle', f, t, end);
        const tg = gainNode(ctx, 0.25);
        const g = gainNode(ctx, 0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.02);
        g.gain.exponentialRampToValueAtTime(amp * 0.5, t + len);
        g.gain.exponentialRampToValueAtTime(amp * 1e-4, end);
        g.gain.setValueAtTime(0, end + 0.001);
        s.connect(g);
        tri.connect(tg).connect(g);
        g.connect(dest);
        break;
      }
      case 'tuba': {
        const o = oscNode(ctx, 'sawtooth', f, t, end);
        const s = oscNode(ctx, 'sine', f, t, end);
        const lp = filterNode(ctx, 'lowpass', 200, 1.2);
        lp.frequency.setValueAtTime(180, t);
        lp.frequency.linearRampToValueAtTime(Math.min(1400, f * 7), t + 0.04);
        lp.frequency.exponentialRampToValueAtTime(Math.max(150, f * 2.5), t + len);
        const g = gainNode(ctx, 0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.03);
        g.gain.exponentialRampToValueAtTime(amp * 0.55, t + len);
        g.gain.exponentialRampToValueAtTime(amp * 1e-4, end);
        g.gain.setValueAtTime(0, end + 0.001);
        const og = gainNode(ctx, 0.55);
        o.connect(og).connect(lp);
        s.connect(lp);
        lp.connect(g).connect(dest);
        break;
      }
      case 'fm': {
        // bouncy 2-op FM bass (DX/OPL-ish slap)
        const car = oscNode(ctx, 'sine', f, t, end);
        const mod = oscNode(ctx, 'sine', f, t, end);
        const mg = gainNode(ctx, 0);
        mg.gain.setValueAtTime(f * 2.4, t);
        mg.gain.exponentialRampToValueAtTime(f * 0.35, t + 0.09);
        mg.gain.exponentialRampToValueAtTime(f * 0.15, t + len);
        mod.connect(mg).connect(car.frequency);
        const g = gainNode(ctx, 0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.004);
        g.gain.exponentialRampToValueAtTime(amp * 0.5, t + Math.min(0.2, len));
        g.gain.exponentialRampToValueAtTime(amp * 1e-4, end);
        g.gain.setValueAtTime(0, end + 0.001);
        car.connect(g).connect(dest);
        break;
      }
      case 'sub': {
        const s = oscNode(ctx, 'sine', f, t, end);
        const h = oscNode(ctx, 'triangle', f * 2, t, end);
        const hg = gainNode(ctx, 0.12);
        const g = gainNode(ctx, 0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.015);
        g.gain.setValueAtTime(amp, t + Math.max(0.02, len - 0.05));
        g.gain.exponentialRampToValueAtTime(amp * 1e-4, end);
        g.gain.setValueAtTime(0, end + 0.001);
        s.connect(g);
        h.connect(hg).connect(g);
        g.connect(dest);
        break;
      }
      case 'wood': {
        // low marimba / slit-drum bass: sine with a pitch blip and woody click
        const s = oscNode(ctx, 'sine', f, t, end);
        s.frequency.setValueAtTime(f * 1.5, t);
        s.frequency.exponentialRampToValueAtTime(f, t + 0.03);
        const g = gainNode(ctx, 0);
        perc(g.gain, t, amp, 0.003, len + tail - 0.01);
        s.connect(g).connect(dest);
        const p = oscNode(ctx, 'sine', f * 3.9, t, t + 0.06);
        const pg = gainNode(ctx, 0);
        perc(pg.gain, t, amp * 0.25, 0.001, 0.05);
        p.connect(pg).connect(dest);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ leads

  lead(t: number, m: number, amp: number, len: number, dest: AudioNode, kind: 'square' | 'fmbell' | 'calliope' | 'brass' | 'saw', pan = 0, prio: Prio = 1, glideFrom = 0): void {
    const ctx = this.ctx;
    const f = midiToHz(m);
    const rel = kind === 'fmbell' ? 0.9 : kind === 'brass' ? 0.18 : kind === 'calliope' ? 0.12 : 0.1;
    const end = t + len + rel;
    if (!this.admit(t, end, prio)) return;
    const out = this.panned(dest, pan);
    switch (kind) {
      case 'square': {
        const o = this.osc('pulse', f, t, end);
        if (glideFrom > 0) {
          o.frequency.setValueAtTime(midiToHz(glideFrom), t);
          o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
        }
        // delayed vibrato
        const lfo = oscNode(ctx, 'sine', 5.6, t, end);
        const lg = gainNode(ctx, 0);
        lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.5, len));
        lfo.connect(lg).connect(o.frequency);
        const lp = filterNode(ctx, 'lowpass', 3600, 0.7);
        const g = gainNode(ctx, 0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.005);
        g.gain.setTargetAtTime(amp * 0.7, t + 0.005, 0.12);
        g.gain.setValueAtTime(amp * 0.7, t + len);
        g.gain.exponentialRampToValueAtTime(amp * 1e-4, end);
        g.gain.setValueAtTime(0, end + 0.001);
        o.connect(lp).connect(g).connect(out);
        break;
      }
      case 'fmbell': {
        const car = oscNode(ctx, 'sine', f, t, end);
        const mod = oscNode(ctx, 'sine', f * 3.5, t, end);
        const mg = gainNode(ctx, 0);
        mg.gain.setValueAtTime(f * 2.2, t);
        mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.5);
        mod.connect(mg).connect(car.frequency);
        const g = gainNode(ctx, 0);
        perc(g.gain, t, amp, 0.002, len + rel - 0.003);
        car.connect(g).connect(out);
        break;
      }
      case 'calliope': {
        const o = this.osc('organ', f, t, end);
        const lfo = oscNode(ctx, 'sine', 6.3, t, end);
        const lg = gainNode(ctx, f * 0.009);
        lfo.connect(lg).connect(o.frequency);
        const g = gainNode(ctx, 0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.035);
        g.gain.setValueAtTime(amp, t + len);
        g.gain.exponentialRampToValueAtTime(amp * 1e-4, end);
        g.gain.setValueAtTime(0, end + 0.001);
        o.connect(g).connect(out);
        // breath
        const n = noiseNode(ctx, this.nb.white, t, t + 0.12);
        const bp = filterNode(ctx, 'bandpass', Math.min(9000, f * 3), 2);
        const ng = gainNode(ctx, 0);
        perc(ng.gain, t, amp * 0.25, 0.01, 0.1);
        n.connect(bp).connect(ng).connect(out);
        break;
      }
      case 'brass': {
        const lp = filterNode(ctx, 'lowpass', 400, 1.6);
        lp.frequency.setValueAtTime(Math.max(250, f * 1.2), t);
        lp.frequency.linearRampToValueAtTime(Math.min(6000, f * 6), t + 0.05);
        lp.frequency.setTargetAtTime(Math.min(4000, f * 3.5), t + 0.06, 0.15);
        lp.frequency.setValueAtTime(Math.min(4000, f * 3.5), t + len);
        lp.frequency.exponentialRampToValueAtTime(Math.max(200, f), end);
        for (const d of [-6, 6]) {
          const o = oscNode(ctx, 'sawtooth', f, t, end);
          o.detune.value = d;
          o.connect(lp);
        }
        const g = gainNode(ctx, 0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.03);
        g.gain.setTargetAtTime(amp * 0.75, t + 0.03, 0.1);
        g.gain.setValueAtTime(amp * 0.75, t + len);
        g.gain.exponentialRampToValueAtTime(amp * 1e-4, end);
        g.gain.setValueAtTime(0, end + 0.001);
        lp.connect(g).connect(out);
        break;
      }
      case 'saw': {
        const o = oscNode(ctx, 'sawtooth', f, t, end);
        if (glideFrom > 0) {
          o.frequency.setValueAtTime(midiToHz(glideFrom), t);
          o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
        }
        const o2 = oscNode(ctx, 'square', f * 0.5, t, end);
        const o2g = gainNode(ctx, 0.3);
        const lp = filterNode(ctx, 'lowpass', 2200, 2.5);
        lp.frequency.setValueAtTime(3200, t);
        lp.frequency.setTargetAtTime(1400, t, 0.2);
        const g = gainNode(ctx, 0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.012);
        g.gain.setValueAtTime(amp, t + len);
        g.gain.exponentialRampToValueAtTime(amp * 1e-4, end);
        g.gain.setValueAtTime(0, end + 0.001);
        o.connect(lp);
        o2.connect(o2g).connect(lp);
        lp.connect(g).connect(out);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ chords / pads

  /** Sustained chord. `kind` picks the timbre; one shared filter per call keeps it cheap. */
  pad(t: number, notes: number[], amp: number, len: number, dest: AudioNode, kind: 'analog' | 'organ' | 'strings' | 'choir', prio: Prio = 2): void {
    const ctx = this.ctx;
    const atk = kind === 'organ' ? 0.06 : kind === 'analog' ? 0.5 : 0.35;
    const rel = kind === 'organ' ? 0.25 : 1.2;
    const end = t + len + rel;
    if (!this.admit(t, end, prio)) return;
    const lp = filterNode(ctx, 'lowpass', kind === 'analog' ? 1100 : kind === 'organ' ? 2600 : 1800, kind === 'analog' ? 1.8 : 0.7);
    if (kind === 'analog') {
      lp.frequency.setValueAtTime(500, t);
      lp.frequency.linearRampToValueAtTime(1500, t + Math.min(len, 1.5));
      lp.frequency.linearRampToValueAtTime(800, end);
    }
    const g = gainNode(ctx, 0);
    const per = amp / Math.sqrt(Math.max(1, notes.length));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(per, t + atk);
    g.gain.setValueAtTime(per, t + Math.max(atk, len));
    g.gain.exponentialRampToValueAtTime(per * 1e-4, end);
    g.gain.setValueAtTime(0, end + 0.001);
    lp.connect(g).connect(dest);
    for (const m of notes) {
      const f = midiToHz(m);
      if (kind === 'organ') {
        const o = this.osc('organ', f, t, end);
        o.connect(lp);
      } else if (kind === 'choir') {
        const o = oscNode(ctx, 'triangle', f, t, end);
        const o2 = oscNode(ctx, 'sine', f * 2, t, end);
        o2.detune.value = 5;
        const g2 = gainNode(ctx, 0.3);
        o.connect(lp);
        o2.connect(g2).connect(lp);
      } else {
        const det = kind === 'analog' ? 9 : 5;
        for (const d of [-det, det]) {
          const o = oscNode(ctx, 'sawtooth', f, t, end);
          o.detune.value = d + (Math.random() - 0.5) * 3;
          o.connect(lp);
        }
      }
    }
  }

  /** Arpeggiator pluck: saw/pulse through a snappy filter envelope. */
  arp(t: number, m: number, amp: number, bright: number, dest: AudioNode, pan = 0, prio: Prio = 0): void {
    const end = t + 0.32;
    if (!this.admit(t, end, prio)) return;
    const ctx = this.ctx;
    const f = midiToHz(m);
    const o = oscNode(ctx, 'sawtooth', f, t, end);
    const o2 = this.osc('pulse', f * 1.003, t, end);
    const o2g = gainNode(ctx, 0.5);
    const lp = filterNode(ctx, 'lowpass', 600, 4);
    const top = 900 + 4200 * clamp(bright, 0, 1);
    lp.frequency.setValueAtTime(top, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(250, f * 1.2), t + 0.16);
    const g = gainNode(ctx, 0);
    perc(g.gain, t, amp, 0.002, 0.3);
    o.connect(lp);
    o2.connect(o2g).connect(lp);
    lp.connect(g).connect(this.panned(dest, pan));
  }

  /** Short staccato chord ("pah", brass stab, square chord blip). */
  stab(t: number, notes: number[], amp: number, len: number, dest: AudioNode, kind: 'organ' | 'brass' | 'square' | 'ep', prio: Prio = 1): void {
    const ctx = this.ctx;
    const end = t + len + 0.12;
    if (!this.admit(t, end, prio)) return;
    const per = amp / Math.sqrt(Math.max(1, notes.length));
    const lp = filterNode(ctx, 'lowpass', kind === 'brass' ? 3000 : kind === 'square' ? 2400 : 3200, kind === 'brass' ? 1.4 : 0.7);
    if (kind === 'brass') {
      lp.frequency.setValueAtTime(600, t);
      lp.frequency.linearRampToValueAtTime(3800, t + 0.03);
      lp.frequency.exponentialRampToValueAtTime(900, end);
    }
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(per, t + (kind === 'brass' ? 0.02 : 0.006));
    g.gain.setValueAtTime(per * 0.8, t + len);
    g.gain.exponentialRampToValueAtTime(per * 1e-4, end);
    g.gain.setValueAtTime(0, end + 0.001);
    lp.connect(g).connect(dest);
    for (const m of notes) {
      const f = midiToHz(m);
      if (kind === 'brass') {
        const o = oscNode(ctx, 'sawtooth', f, t, end);
        o.detune.value = (Math.random() - 0.5) * 12;
        o.connect(lp);
      } else if (kind === 'ep') {
        const o = oscNode(ctx, 'triangle', f, t, end);
        o.connect(lp);
      } else {
        const o = this.osc(kind === 'organ' ? 'organ' : 'pulse', f, t, end);
        o.connect(lp);
      }
    }
  }

  // ------------------------------------------------------------------ percussion

  private noiseHit(t: number, kind: 'white' | 'pink' | 'brown', ftype: BiquadFilterType, f: number, q: number, amp: number, attack: number, decay: number, dest: AudioNode, pan = 0): void {
    const ctx = this.ctx;
    const end = t + attack + decay;
    const s = noiseNode(ctx, this.nb[kind], t, end);
    const fl = filterNode(ctx, ftype, f, q);
    const g = gainNode(ctx, 0);
    perc(g.gain, t, amp, attack, decay);
    s.connect(fl).connect(g).connect(this.panned(dest, pan));
  }

  kick(t: number, amp: number, dest: AudioNode, kind: 'soft' | 'machine' | 'deep' = 'soft', prio: Prio = 1): void {
    const len = kind === 'deep' ? 0.5 : kind === 'machine' ? 0.32 : 0.35;
    if (!this.admit(t, t + len, prio)) return;
    const ctx = this.ctx;
    const f0 = kind === 'machine' ? 150 : kind === 'deep' ? 120 : 100;
    const f1 = kind === 'deep' ? 40 : kind === 'machine' ? 50 : 46;
    const o = oscNode(ctx, 'sine', f0, t, t + len);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + (kind === 'machine' ? 0.07 : 0.12));
    const g = gainNode(ctx, 0);
    perc(g.gain, t, amp, 0.003, len - 0.01);
    o.connect(g).connect(dest);
    if (kind !== 'soft') this.noiseHit(t, 'white', 'bandpass', 3500, 1.0, amp * 0.25, 0.001, 0.012, dest);
  }

  snare(t: number, amp: number, dest: AudioNode, kind: 'machine' | 'brush' | 'march' | 'clap' = 'machine', pan = 0, prio: Prio = 1): void {
    const ctx = this.ctx;
    const len = kind === 'brush' ? 0.24 : kind === 'clap' ? 0.2 : 0.18;
    if (!this.admit(t, t + len, prio)) return;
    switch (kind) {
      case 'brush':
        this.noiseHit(t, 'white', 'bandpass', 4200, 0.6, amp, 0.012, 0.22, dest, pan);
        break;
      case 'clap':
        for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.011, 'white', 'bandpass', 1500, 1.2, amp * (i === 2 ? 1 : 0.6), 0.001, i === 2 ? 0.16 : 0.01, dest, pan);
        break;
      default: {
        const tone = oscNode(ctx, 'triangle', kind === 'march' ? 230 : 190, t, t + 0.1);
        tone.frequency.exponentialRampToValueAtTime(kind === 'march' ? 180 : 150, t + 0.08);
        const tg = gainNode(ctx, 0);
        perc(tg.gain, t, amp * 0.5, 0.001, 0.08);
        tone.connect(tg).connect(this.panned(dest, pan));
        this.noiseHit(t, 'white', kind === 'march' ? 'highpass' : 'bandpass', kind === 'march' ? 2500 : 2600, 0.7, amp * 0.8, 0.001, kind === 'march' ? 0.14 : 0.16, dest, pan);
      }
    }
  }

  /** Snare roll as one AM-gated noise source (cheap): crescendo from a to b over len. */
  roll(t: number, len: number, a: number, b: number, dest: AudioNode, rate = 22): void {
    if (!this.admit(t, t + len + 0.2, 1)) return;
    const ctx = this.ctx;
    const end = t + len + 0.15;
    const s = noiseNode(ctx, this.nb.white, t, end);
    const hp = filterNode(ctx, 'bandpass', 3200, 0.6);
    const am = gainNode(ctx, 0.5);
    const lfo = oscNode(ctx, 'square', rate, t, end);
    const lg = gainNode(ctx, 0.5);
    lfo.connect(lg).connect(am.gain);
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(Math.max(1e-4, a), t + 0.02);
    g.gain.linearRampToValueAtTime(Math.max(1e-4, b), t + len);
    g.gain.exponentialRampToValueAtTime(1e-4, end);
    g.gain.setValueAtTime(0, end + 0.001);
    s.connect(hp).connect(am).connect(g).connect(dest);
  }

  hat(t: number, amp: number, dest: AudioNode, open = false, pan = 0.2, prio: Prio = 0): void {
    const d = open ? 0.22 : 0.035;
    if (!this.admit(t, t + d, prio)) return;
    this.noiseHit(t, 'white', 'highpass', 7500, 0.8, amp, 0.001, d, dest, pan);
  }

  shaker(t: number, amp: number, dest: AudioNode, pan = 0.35, prio: Prio = 0): void {
    if (amp <= 0.0005 || !this.admit(t, t + 0.07, prio)) return;
    this.noiseHit(t, 'white', 'highpass', 6500, 0.7, amp, 0.008, 0.06, dest, pan);
  }

  crash(t: number, amp: number, dest: AudioNode, len = 1.6, pan = -0.25): void {
    if (!this.admit(t, t + len, 1)) return;
    this.noiseHit(t, 'white', 'highpass', 5000, 0.5, amp, 0.002, len, dest, pan);
    this.noiseHit(t, 'pink', 'bandpass', 3300, 1.5, amp * 0.6, 0.002, len * 0.6, dest, pan);
  }

  /** Slit / log drum: a pitched wooden tone. */
  logDrum(t: number, m: number, amp: number, dest: AudioNode, pan = 0, prio: Prio = 1): void {
    if (!this.admit(t, t + 0.4, prio)) return;
    const ctx = this.ctx;
    const f = midiToHz(m);
    const o = oscNode(ctx, 'sine', f, t, t + 0.4);
    o.frequency.setValueAtTime(f * 1.25, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.025);
    const g = gainNode(ctx, 0);
    perc(g.gain, t, amp, 0.002, 0.36);
    const out = this.panned(dest, pan);
    o.connect(g).connect(out);
    const o2 = oscNode(ctx, 'sine', f * 2.7, t, t + 0.08);
    const g2 = gainNode(ctx, 0);
    perc(g2.gain, t, amp * 0.3, 0.001, 0.07);
    o2.connect(g2).connect(out);
    this.noiseHit(t, 'pink', 'bandpass', 1200, 2, amp * 0.25, 0.001, 0.02, dest, pan);
  }

  /** Hand drum (djembe/conga): 'bass' (open low), 'tone' (open mid), 'slap' (bright crack). */
  hand(t: number, kind: 'bass' | 'tone' | 'slap', amp: number, dest: AudioNode, pan = 0, prio: Prio = 0): void {
    if (!this.admit(t, t + 0.3, prio)) return;
    const ctx = this.ctx;
    const out = this.panned(dest, pan);
    const f = kind === 'bass' ? 78 : kind === 'tone' ? 215 : 330;
    const d = kind === 'bass' ? 0.28 : kind === 'tone' ? 0.16 : 0.07;
    const o = oscNode(ctx, 'sine', f, t, t + d + 0.02);
    o.frequency.setValueAtTime(f * 1.35, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.02);
    const g = gainNode(ctx, 0);
    perc(g.gain, t, amp * (kind === 'slap' ? 0.5 : 1), 0.002, d);
    o.connect(g).connect(out);
    const nf = kind === 'slap' ? 2400 : kind === 'tone' ? 900 : 500;
    this.noiseHit(t, kind === 'bass' ? 'pink' : 'white', 'bandpass', nf, 1.2, amp * (kind === 'slap' ? 0.9 : 0.25), 0.001, kind === 'slap' ? 0.06 : 0.03, dest, pan);
  }

  woodblock(t: number, amp: number, dest: AudioNode, hi = true, pan = 0, prio: Prio = 0): void {
    if (!this.admit(t, t + 0.09, prio)) return;
    const ctx = this.ctx;
    const out = this.panned(dest, pan);
    const base = hi ? 1150 : 820;
    for (const [r, a] of [[1, 1], [1.59, 0.4]] as [number, number][]) {
      const o = oscNode(ctx, 'sine', base * r, t, t + 0.08);
      const g = gainNode(ctx, 0);
      perc(g.gain, t, amp * a, 0.001, 0.06);
      o.connect(g).connect(out);
    }
  }

  timpani(t: number, m: number, amp: number, dest: AudioNode, prio: Prio = 1): void {
    if (!this.admit(t, t + 1.0, prio)) return;
    const ctx = this.ctx;
    const f = midiToHz(m);
    for (const [r, a, d] of [[1, 1, 0.9], [1.5, 0.35, 0.5], [1.98, 0.2, 0.35]] as [number, number, number][]) {
      const o = oscNode(ctx, 'sine', f * r, t, t + d);
      o.frequency.setValueAtTime(f * r * 1.04, t);
      o.frequency.exponentialRampToValueAtTime(f * r, t + 0.08);
      const g = gainNode(ctx, 0);
      perc(g.gain, t, amp * a, 0.004, d);
      o.connect(g).connect(dest);
    }
    this.noiseHit(t, 'brown', 'lowpass', 600, 0.7, amp * 0.5, 0.002, 0.15, dest);
  }

  triangleBell(t: number, amp: number, dest: AudioNode, pan = 0.4): void {
    if (!this.admit(t, t + 1.2, 0)) return;
    const ctx = this.ctx;
    const out = this.panned(dest, pan);
    for (const [f, a, d] of [[2637, 1, 1.1], [5190, 0.4, 0.7], [7400, 0.2, 0.4]] as [number, number, number][]) {
      const o = oscNode(ctx, 'sine', f, t, t + d);
      const g = gainNode(ctx, 0);
      perc(g.gain, t, amp * a, 0.001, d);
      o.connect(g).connect(out);
    }
  }

  /** Steam puff: breathy filtered noise ("chuff"). */
  chuff(t: number, amp: number, dest: AudioNode, pan = 0, prio: Prio = 0): void {
    if (!this.admit(t, t + 0.16, prio)) return;
    this.noiseHit(t, 'pink', 'bandpass', 1800, 0.9, amp, 0.01, 0.13, dest, pan);
  }

  /** Rain stick / shimmer swell: gated crackle, used at section boundaries. */
  rainstick(t: number, len: number, amp: number, dest: AudioNode): void {
    if (!this.admit(t, t + len, 0)) return;
    const ctx = this.ctx;
    const s = noiseNode(ctx, this.nb.crackle, t, t + len, 2.2);
    const bp = filterNode(ctx, 'bandpass', 3500, 0.8);
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + len * 0.45);
    g.gain.linearRampToValueAtTime(0, t + len);
    s.connect(bp).connect(g).connect(this.panned(dest, -0.3));
  }

  /** Rising noise sweep (future transitions). */
  riser(t: number, len: number, amp: number, dest: AudioNode): void {
    if (!this.admit(t, t + len, 0)) return;
    const ctx = this.ctx;
    const s = noiseNode(ctx, this.nb.white, t, t + len);
    const bp = filterNode(ctx, 'bandpass', 400, 2.5);
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(6000, t + len);
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + len * 0.9);
    g.gain.linearRampToValueAtTime(0, t + len);
    s.connect(bp).connect(g).connect(dest);
  }
}
