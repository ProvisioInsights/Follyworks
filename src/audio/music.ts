// Generative music conductor. One `Player` per theme style (see styles.ts): it owns a clock on a
// 16th-note grid, a song form (intro, A, A', B, break, A, rest, ...), chord progressions per
// section and short melodic motifs that repeat with variation (statement / answer / sequence /
// cadence), regenerated every pass through the form. Styles only decide which instruments play
// what on each step. `Music` keeps the public API (start/stop/setIntensity/scheduleUntil) and adds
// setTheme(), which crossfades from the current player to a new one.

import { Inst } from './instruments';
import { STYLES, StepFn, StyleDef } from './styles';
import { MusicTheme, normTheme } from './themes';
import { NoiseBank, clamp, gainNode } from './synth';

export type SectionKind = 'intro' | 'A' | 'B' | 'break' | 'rest';

export interface MelNote {
  /** midi note */
  m: number;
  /** length in 16th steps */
  len: number;
  /** first note of a motif / strong position */
  accent: boolean;
}

export interface StepInfo {
  t: number;
  /** 16th index inside the bar */
  step: number;
  beat: number;
  /** 16th inside the beat (0..3) */
  sub: number;
  /** global bar counter */
  bar: number;
  /** bar index inside the current section */
  barIn: number;
  secBars: number;
  kind: SectionKind;
  /** section energy 0..1 */
  E: number;
  /** eased intensity 0..1 (build ~0.3, run ~0.75) */
  I: number;
  /** seconds per beat / per 16th */
  spb: number;
  s16: number;
  stepsPerBar: number;
  /** current chord, voiced around the style's chord centre (midi) */
  chord: number[];
  /** chord root in the bass register (midi) */
  root: number;
  /** fifth above the bass root (midi) */
  fifth: number;
  /** first step of a chord */
  chordStart: boolean;
  /** last bar of the section (for fills / pickups) */
  lastBar: boolean;
  /** first bar of the section */
  firstBar: boolean;
  /** melody note starting on this step, if any */
  mel: MelNote | null;
  /** tonic (midi, chord register) */
  key: number;
  /** how many passes through the form so far */
  cycle: number;
}

export interface PlayerApi {
  readonly ctx: BaseAudioContext;
  readonly inst: Inst;
  readonly nb: NoiseBank;
  /** bus helper: a gain into the player's output with an optional reverb send */
  bus(level: number, wet: number, lowpass?: number): GainNode;
  /** dotted-8th-ish echo bus feeding the player's output */
  echo(steps: number, feedback: number, mix: number): GainNode;
  /** keep a continuous source alive until the player is disposed */
  hold(src: AudioScheduledSourceNode): void;
  /** seconds per 16th at the current tempo */
  readonly s16: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

/** Chord tones (semitones above tonic) for a degree; 7+ are borrowed chords. */
export function chordTones(degree: number, mode: 'major' | 'minor', seventh: boolean): number[] {
  switch (degree) {
    case 7: return [10, 14, 17]; // bVII
    case 8: return [5, 8, 12]; // iv (minor four)
    case 9: return [8, 12, 15]; // bVI
    case 10: return [7, 11, 14, 17]; // V7 (harmonic minor dominant)
    default: break;
  }
  const sc = mode === 'minor' ? MINOR : MAJOR;
  const at = (i: number): number => sc[i % 7] + 12 * Math.floor(i / 7);
  const d = ((degree % 7) + 7) % 7;
  const out = [at(d), at(d + 2), at(d + 4)];
  if (seventh) out.push(at(d + 6));
  return out;
}

function pickOne<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

interface FormRow { kind: SectionKind; bars: number; E: number }

function makeForm(first: boolean, mul: number): FormRow[] {
  const rows: FormRow[] = [];
  if (first) rows.push({ kind: 'intro', bars: 4, E: 0.45 });
  rows.push({ kind: 'A', bars: 8, E: 0.65 });
  rows.push({ kind: 'A', bars: 8, E: 0.78 });
  rows.push({ kind: 'B', bars: 8, E: 0.95 });
  if (Math.random() < 0.35) rows.push({ kind: 'B', bars: 8, E: 1 });
  rows.push({ kind: 'break', bars: 4, E: 0.38 });
  rows.push({ kind: 'A', bars: 8, E: 0.82 });
  if (Math.random() < 0.5) rows.push({ kind: 'A', bars: 4, E: 0.6 });
  rows.push({ kind: 'rest', bars: 2, E: 0.12 });
  return rows.map((r) => ({ ...r, bars: r.kind === 'rest' ? r.bars : r.bars * mul }));
}

interface Motif { notes: (MelNote | null)[] } // indexed by 16th step within 2 bars

class Player implements PlayerApi {
  readonly ctx: BaseAudioContext;
  readonly inst: Inst;
  readonly nb: NoiseBank;
  readonly def: StyleDef;
  private out: GainNode;
  private wet: AudioNode;
  private wetSend: GainNode;
  private stepFn: StepFn;
  private srcs: AudioScheduledSourceNode[] = [];
  private nodes: AudioNode[] = [];

  private bpm: number;
  private startTime: number;
  private n = 0; // global 16th counter
  private stepsPerBar: number;

  private form: FormRow[] = [];
  private formIdx = 0;
  private barIn = 0;
  private barCount = 0;
  private cycle = 0;
  private key: number;
  private prog: number[] = [0];
  private motifs: Partial<Record<SectionKind, Motif[]>> = {};
  private voicing: number[] = [];
  private lastChordIdx = -1;

  intensity = 0;
  target = 0;
  /** no new notes after this time (fade-out) */
  dieAt = Infinity;

  constructor(ctx: BaseAudioContext, dest: AudioNode, wet: AudioNode, nb: NoiseBank, def: StyleDef, t: number, fadeIn: number, intensity: number) {
    this.ctx = ctx;
    this.nb = nb;
    this.def = def;
    this.inst = new Inst(ctx, nb);
    this.bpm = def.bpm[0] + Math.random() * (def.bpm[1] - def.bpm[0]);
    this.stepsPerBar = def.beats * 4;
    this.key = def.keys[0];
    this.intensity = intensity;
    this.target = intensity;
    const out = gainNode(ctx, 0);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(def.level, t + Math.max(0.05, fadeIn));
    out.connect(dest);
    this.out = out;
    this.wet = wet;
    this.wetSend = gainNode(ctx, 0);
    this.wetSend.gain.setValueAtTime(0, t);
    this.wetSend.gain.linearRampToValueAtTime(def.level, t + Math.max(0.05, fadeIn));
    this.wetSend.connect(wet);
    this.startTime = t + 0.05;
    this.form = makeForm(true, def.barsMul ?? 1);
    this.enterSection();
    this.stepFn = def.create(this);
  }

  get s16(): number {
    return 60 / this.bpm / 4;
  }

  bus(level: number, wet: number, lowpass?: number): GainNode {
    const ctx = this.ctx;
    const g = gainNode(ctx, level);
    let tail: AudioNode = g;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      f.Q.value = 0.5;
      g.connect(f);
      tail = f;
      this.nodes.push(f);
    }
    tail.connect(this.out);
    if (wet > 0) {
      const w = gainNode(ctx, wet);
      tail.connect(w).connect(this.wetSend);
      this.nodes.push(w);
    }
    this.nodes.push(g);
    return g;
  }

  echo(steps: number, feedback: number, mix: number): GainNode {
    const ctx = this.ctx;
    const inp = gainNode(ctx, 1);
    const d = ctx.createDelay(2);
    d.delayTime.value = clamp(steps * this.s16, 0.02, 1.9);
    const fb = gainNode(ctx, clamp(feedback, 0, 0.7));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const m = gainNode(ctx, mix);
    inp.connect(d).connect(lp).connect(fb).connect(d);
    lp.connect(m).connect(this.out);
    this.nodes.push(inp, d, fb, lp, m);
    return inp;
  }

  hold(src: AudioScheduledSourceNode): void {
    this.srcs.push(src);
  }

  private stepTime(n: number): number {
    const spb = 60 / this.bpm;
    const beat = Math.floor(n / 4);
    const k = n % 4;
    const r = this.def.swing;
    let off: number;
    if (this.def.swingUnit === 8) off = k === 0 ? 0 : k === 1 ? (r * spb) / 2 : k === 2 ? r * spb : r * spb + ((1 - r) * spb) / 2;
    else off = k === 0 ? 0 : k === 1 ? (r * spb) / 2 : k === 2 ? spb / 2 : spb / 2 + (r * spb) / 2;
    return this.startTime + beat * spb + off;
  }

  // ---------------------------------------------------------------- form / harmony / motifs

  private get row(): FormRow {
    return this.form[this.formIdx];
  }

  private enterSection(): void {
    const row = this.row;
    const d = this.def;
    if (row.kind === 'B') this.prog = pickOne(d.progB);
    else if (row.kind === 'rest') this.prog = [0];
    else if (row.kind === 'break') this.prog = pickOne(d.progA).slice(0, 2);
    else this.prog = pickOne(d.progA);
    this.lastChordIdx = -1;
    const k: SectionKind = row.kind === 'B' ? 'B' : 'A';
    if (!this.motifs[k]) this.motifs[k] = this.makeMotifs(k === 'B');
  }

  private advanceBar(): void {
    this.barCount++;
    this.barIn++;
    if (this.barIn >= this.row.bars) {
      this.barIn = 0;
      this.formIdx++;
      if (this.formIdx >= this.form.length) {
        this.cycle++;
        this.formIdx = 0;
        this.form = makeForm(false, this.def.barsMul ?? 1);
        this.motifs = {};
        // every second pass, move to another key in the style's list
        if (this.cycle % 2 === 0 && this.def.keys.length > 1) this.key = this.def.keys[(this.cycle / 2) % this.def.keys.length];
        // and nudge the tempo a little
        this.bpm = clamp(this.bpm + (Math.random() - 0.5) * 4, this.def.bpm[0], this.def.bpm[1]);
        this.rebaseClock();
      }
      this.enterSection();
    }
  }

  /** Keep step times continuous after a tempo change: restart the grid at the next step. */
  private rebaseClock(): void {
    const t = this.stepTime(this.n);
    this.startTime = t;
    this.n = 0;
  }

  /** Four 2-bar variants: statement, answer, sequence, cadence. */
  private makeMotifs(isB: boolean): Motif[] {
    const d = this.def;
    const len = this.stepsPerBar * 2;
    const rhythm = pickOne(isB ? d.rhythmsB ?? d.rhythms : d.rhythms);
    const starts: number[] = [];
    for (let i = 0; i < Math.min(len, rhythm.length); i++) if (rhythm[i] === 'x') starts.push(i);
    if (!starts.length) starts.push(0);
    const pool = this.melodyPool();
    let idx = Math.floor(pool.length * (isB ? 0.55 : 0.4)) + Math.floor(Math.random() * 3) - 1;
    const degrees: number[] = [];
    for (let i = 0; i < starts.length; i++) {
      const mv = pickOne([-2, -1, -1, 1, 1, 2, 0, 3, -3]);
      idx = clamp(idx + mv, 0, pool.length - 1);
      degrees.push(idx);
    }
    const build = (deg: number[], cut: number): Motif => {
      const notes: (MelNote | null)[] = new Array(len).fill(null);
      for (let i = 0; i < starts.length; i++) {
        if (starts[i] >= cut) break;
        const next = i + 1 < starts.length ? starts[i + 1] : len;
        const di = clamp(deg[i], 0, pool.length - 1);
        notes[starts[i]] = { m: pool[di], len: Math.max(1, Math.min(next - starts[i], 8)), accent: i === 0 };
      }
      return { notes };
    };
    const statement = build(degrees, len);
    // answer: same rhythm, tail turns around
    const ans = degrees.slice();
    for (let i = Math.max(1, ans.length - 2); i < ans.length; i++) ans[i] = clamp(ans[i] + pickOne([-2, -1, 1, 2]), 0, pool.length - 1);
    const answer = build(ans, len);
    // sequence: statement shifted by a scale step
    const sh = pickOne([-1, 1, 2]);
    const sequence = build(degrees.map((x) => x + sh), len);
    // cadence: first half of the statement, then settle on the tonic
    const cad = degrees.slice();
    const tonicIdx = pool.findIndex((m) => ((m - this.key) % 12 + 12) % 12 === 0 && m >= pool[Math.floor(pool.length * 0.3)]);
    const cadence = build(cad, Math.floor(len * 0.6));
    const lastStart = starts.find((s) => s >= Math.floor(len * 0.6)) ?? Math.floor(len * 0.75);
    cadence.notes[lastStart] = { m: pool[tonicIdx >= 0 ? tonicIdx : 0], len: Math.min(8, len - lastStart), accent: true };
    return [statement, answer, sequence, cadence];
  }

  private melodyPool(): number[] {
    const d = this.def;
    const out: number[] = [];
    for (let m = this.key + d.melRange[0]; m <= this.key + d.melRange[1]; m++) {
      const pc = (((m - this.key) % 12) + 12) % 12;
      if (d.melody.includes(pc)) out.push(m);
    }
    return out.length ? out : [this.key + 12];
  }

  private chordNow(): { tones: number[]; idx: number } {
    const d = this.def;
    const idx = Math.floor(this.barIn / d.chordBars) % this.prog.length;
    return { tones: chordTones(this.prog[idx], d.mode, d.sevenths), idx };
  }

  private voice(tones: number[]): number[] {
    const centre = this.voicing.length ? this.voicing.reduce((a, b) => a + b, 0) / this.voicing.length : this.key + this.def.chordCentre;
    const lo = this.key + this.def.chordCentre - 8;
    const hi = this.key + this.def.chordCentre + 10;
    const notes = tones.map((x) => {
      let m = this.key + x;
      while (m < centre - 6) m += 12;
      while (m > centre + 6) m -= 12;
      while (m < lo) m += 12;
      while (m > hi) m -= 12;
      return m;
    });
    return Array.from(new Set(notes)).sort((a, b) => a - b).slice(0, 4);
  }

  // ---------------------------------------------------------------- scheduling

  scheduleUntil(until: number): void {
    const now = this.ctx.currentTime;
    let guard = 0;
    // after a long stall (tab suspended) skip ahead rather than bursting notes
    while (this.stepTime(this.n) < now - 0.1 && guard++ < 100000) this.tick(false);
    guard = 0;
    while (this.stepTime(this.n) < Math.min(until, this.dieAt) && guard++ < 4096) this.tick(true);
  }

  private tick(play: boolean): void {
    const n = this.n;
    const spbar = this.stepsPerBar;
    const step = n % spbar;
    const t = this.stepTime(n);
    if (play && t >= this.ctx.currentTime - 0.02) {
      this.intensity += (this.target - this.intensity) * 0.04;
      const row = this.row;
      const { tones, idx } = this.chordNow();
      const chordStart = step === 0 && idx !== this.lastChordIdx;
      if (chordStart) {
        this.lastChordIdx = idx;
        this.voicing = this.voice(tones);
      } else if (!this.voicing.length) this.voicing = this.voice(tones);
      const bassBase = this.key - 12;
      let root = bassBase + tones[0];
      while (root > bassBase + 7) root -= 12;
      while (root < bassBase - 5) root += 12;
      const mel = this.melodyAt(step, tones);
      const spb = 60 / this.bpm;
      const info: StepInfo = {
        t,
        step,
        beat: Math.floor(step / 4),
        sub: step % 4,
        bar: this.barCount,
        barIn: this.barIn,
        secBars: row.bars,
        kind: row.kind,
        E: row.E,
        I: this.intensity,
        spb,
        s16: spb / 4,
        stepsPerBar: spbar,
        chord: this.voicing,
        root,
        fifth: root + 7,
        chordStart,
        lastBar: this.barIn === row.bars - 1,
        firstBar: this.barIn === 0,
        mel,
        key: this.key,
        cycle: this.cycle,
      };
      try { this.stepFn(info); } catch { /* a style bug must never stop the music */ }
    } else if (step === 0) {
      // keep chord bookkeeping in sync while skipping
      this.lastChordIdx = this.chordNow().idx;
    }
    this.n++;
    if (this.n % spbar === 0) this.advanceBar();
  }

  private melodyAt(step: number, tones: number[]): MelNote | null {
    const k: SectionKind = this.row.kind === 'B' ? 'B' : 'A';
    const set = this.motifs[k];
    if (!set) return null;
    const len = this.stepsPerBar * 2;
    const phrase = Math.floor(this.barIn / 2);
    const last = this.barIn >= this.row.bars - 2;
    const variant = last ? 3 : phrase % 4 === 3 ? 2 : phrase % 2;
    const pos = ((this.barIn % 2) * this.stepsPerBar + step) % len;
    const note = set[variant].notes[pos];
    if (!note) return null;
    let m = note.m;
    // on beats, lean onto a chord tone when one is a step away
    if (step % 4 === 0) {
      const pcs = tones.map((x) => (((this.key + x) % 12) + 12) % 12);
      const pc = ((m % 12) + 12) % 12;
      if (!pcs.includes(pc)) {
        for (const dlt of [-1, 1, -2, 2]) {
          if (pcs.includes((((m + dlt) % 12) + 12) % 12)) { m += dlt; break; }
        }
      }
    }
    return { m, len: note.len, accent: note.accent };
  }

  fadeOut(t: number, len: number): void {
    for (const g of [this.out.gain, this.wetSend.gain]) {
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + len);
    }
    this.dieAt = Math.min(this.dieAt, t + len);
    for (const s of this.srcs) {
      try { s.stop(t + len + 0.1); } catch { /* ignore */ }
    }
  }

  dispose(): void {
    try { this.out.disconnect(); } catch { /* ignore */ }
    try { this.wetSend.disconnect(); } catch { /* ignore */ }
    for (const nd of this.nodes) {
      try { nd.disconnect(); } catch { /* ignore */ }
    }
    this.srcs = [];
    this.nodes = [];
  }

  get voicesInUse(): number {
    return this.inst.activeVoices;
  }

  get tempo(): number {
    return this.bpm;
  }
}

export class Music {
  private ctx: BaseAudioContext;
  private dest: AudioNode;
  private wet: AudioNode;
  private nb: NoiseBank;
  private running = false;
  private theme: MusicTheme = 'modern';
  private player: Player | null = null;
  private fading: Player[] = [];
  private target = 0;

  constructor(ctx: BaseAudioContext, dest: AudioNode, wet: AudioNode, nb: NoiseBank) {
    this.ctx = ctx;
    this.dest = dest;
    this.wet = wet;
    this.nb = nb;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentTheme(): MusicTheme {
    return this.theme;
  }

  /** Diagnostics: voices of the current player, its tempo and how many players are alive. */
  get stats(): { voices: number; bpm: number; players: number; dropped: number } {
    const p = this.player;
    return { voices: p ? p.voicesInUse : 0, bpm: p ? p.tempo : 0, players: (p ? 1 : 0) + this.fading.length, dropped: p ? p.inst.dropped : 0 };
  }

  setIntensity(x: number): void {
    this.target = clamp(Number.isFinite(x) ? x : 0, 0, 1);
    if (this.player) this.player.target = this.target;
  }

  /** Switch style; crossfades over `fade` seconds when the music is playing. */
  setTheme(id: unknown, fade = 2.5): void {
    const th = normTheme(id);
    if (th === this.theme && (this.player || !this.running)) return;
    this.theme = th;
    if (!this.running) return;
    const t = this.ctx.currentTime + 0.05;
    if (this.player) {
      // more than one old player still fading out (rapid toggling): cut the oldest quickly
      while (this.fading.length >= 2) {
        const old = this.fading.shift()!;
        old.fadeOut(t, 0.15);
        this.disposeLater(old, 0.5);
      }
      this.player.fadeOut(t, fade);
      this.fading.push(this.player);
      this.disposeLater(this.player, fade + 3);
    }
    this.player = new Player(this.ctx, this.dest, this.wet, this.nb, STYLES[th], t + 0.1, fade, this.player ? this.player.intensity : this.target);
    this.player.target = this.target;
  }

  private disposeLater(p: Player, sec: number): void {
    if (typeof setTimeout === 'undefined') return;
    setTimeout(() => {
      this.fading = this.fading.filter((x) => x !== p);
      p.dispose();
    }, sec * 1000);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const t = this.ctx.currentTime + 0.05;
    this.player = new Player(this.ctx, this.dest, this.wet, this.nb, STYLES[this.theme], t, 2.5, this.target);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    const t = this.ctx.currentTime;
    for (const p of [...this.fading, ...(this.player ? [this.player] : [])]) {
      p.fadeOut(t, 1.2);
      this.disposeLater(p, 4);
    }
    this.player = null;
    this.fading = [];
  }

  /** Schedule all notes whose start lies before `until` (context time). */
  scheduleUntil(until: number): void {
    if (!this.running) return;
    this.player?.scheduleUntil(until);
    for (const p of this.fading) if (p.dieAt > this.ctx.currentTime) p.scheduleUntil(until);
  }
}
