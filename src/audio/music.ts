// Generative workshop music bed: Rhodes-ish FM chords, soft bass, sparse kalimba/marimba
// melody, brushed percussion and a quiet vinyl/room bed. Never repeats literally: chords
// follow a Markov chain, melody is a constrained random walk, section energy drifts.

import { NoiseBank, clamp, filterNode, gainNode, midiToHz, noiseNode, oscNode, perc } from './synth';

const KEY = 53; // F3

interface Chord {
  name: string;
  root: number; // semitones above key
  tones: number[]; // semitones above key (chord tones incl. extensions)
}

const CHORDS: Record<string, Chord> = {
  I: { name: 'I', root: 0, tones: [0, 4, 7, 11, 14] },
  ii: { name: 'ii', root: 2, tones: [2, 5, 9, 12, 16] },
  iii: { name: 'iii', root: 4, tones: [4, 7, 11, 14] },
  IV: { name: 'IV', root: 5, tones: [5, 9, 12, 16, 19] },
  V: { name: 'V', root: 7, tones: [7, 12, 14, 17] },
  vi: { name: 'vi', root: 9, tones: [9, 12, 16, 19, 23] },
};

const NEXT: Record<string, [string, number][]> = {
  I: [['IV', 3], ['vi', 3], ['ii', 2], ['iii', 1]],
  ii: [['V', 3], ['I', 1], ['IV', 1]],
  iii: [['vi', 3], ['IV', 2]],
  IV: [['I', 2], ['ii', 2], ['V', 1], ['iii', 1], ['vi', 1]],
  V: [['I', 3], ['vi', 2]],
  vi: [['ii', 2], ['IV', 3], ['iii', 1]],
};

// F major pentatonic (F G A C D) melody pool, C5..F6
const PENTA = [72, 74, 77, 79, 81, 84, 86, 89].map((m) => m); // C5 D5 F5 G5 A5 C6 D6 F6

function pick<T>(items: [T, number][]): T {
  let tot = 0;
  for (const [, w] of items) tot += w;
  let r = Math.random() * tot;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1][0];
}

const pc = (m: number): number => ((m % 12) + 12) % 12;

export class Music {
  private ctx: BaseAudioContext;
  private dest: AudioNode;
  private wet: AudioNode;
  private nb: NoiseBank;

  private bus: GainNode | null = null;
  private rhodesBus: GainNode | null = null;
  private melBus: GainNode | null = null;
  private percBus: GainNode | null = null;
  private bassBus: GainNode | null = null;
  private bedSrcs: AudioScheduledSourceNode[] = [];

  private running = false;
  private bpm = 76;
  private swing = 0.57;
  private startTime = 0;
  private step = 0; // global 8th-note counter
  private chord: Chord = CHORDS.I;
  private chordStepsLeft = 0;
  private voicing: number[] = [];
  private melodyOn = false;
  private melIdx = 3;
  private energy = 0.6;
  private intensity = 0;
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

  setIntensity(x: number): void {
    this.target = clamp(Number.isFinite(x) ? x : 0, 0, 1);
  }

  start(): void {
    if (this.running) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.05;
    this.running = true;
    this.bpm = 72 + Math.floor(Math.random() * 10);
    const bus = gainNode(ctx, 0);
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(1, t + 2.5);
    bus.connect(this.dest);
    this.bus = bus;

    // Rhodes bus: gentle low-pass + slow tremolo
    const rh = gainNode(ctx, 1);
    const rlp = filterNode(ctx, 'lowpass', 3400, 0.5);
    const trem = gainNode(ctx, 0.9);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.2;
    const lg = gainNode(ctx, 0.08);
    lfo.connect(lg).connect(trem.gain);
    lfo.start(t);
    this.bedSrcs.push(lfo);
    rh.connect(rlp).connect(trem).connect(bus);
    const rwet = gainNode(ctx, 0.35);
    trem.connect(rwet).connect(this.wet);
    this.rhodesBus = rh;

    const mel = gainNode(ctx, 1);
    mel.connect(bus);
    const mwet = gainNode(ctx, 0.5);
    mel.connect(mwet).connect(this.wet);
    this.melBus = mel;

    const pb = gainNode(ctx, 1);
    pb.connect(bus);
    const pwet = gainNode(ctx, 0.25);
    pb.connect(pwet).connect(this.wet);
    this.percBus = pb;

    const bb = filterNode(ctx, 'lowpass', 520, 0.6);
    const bbg = gainNode(ctx, 1);
    bbg.connect(bb).connect(bus);
    this.bassBus = bbg;

    // Vinyl crackle + faint room hiss (very quiet, always on while music plays)
    const cr = noiseNode(ctx, this.nb.crackle, t, t + 1e5, 1);
    const crf = filterNode(ctx, 'bandpass', 2500, 0.5);
    const crg = gainNode(ctx, 0.022);
    cr.connect(crf).connect(crg).connect(bus);
    const hs = noiseNode(ctx, this.nb.pink, t, t + 1e5, 1);
    const hsf = filterNode(ctx, 'lowpass', 3500, 0.5);
    const hsh = filterNode(ctx, 'highpass', 300, 0.5);
    const hsg = gainNode(ctx, 0.0035);
    hs.connect(hsf).connect(hsh).connect(hsg).connect(bus);
    this.bedSrcs.push(cr, hs);

    this.startTime = t + 0.1;
    this.step = 0;
    this.chordStepsLeft = 0;
    this.chord = CHORDS[pick<string>([['I', 2], ['vi', 1], ['IV', 1]])];
    this.voicing = [];
    this.intensity = this.target;
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    const t = this.ctx.currentTime;
    if (this.bus) {
      const g = this.bus.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + 1.2);
      const old = this.bus;
      const srcs = this.bedSrcs;
      for (const s of srcs) {
        try { s.stop(t + 1.3); } catch { /* ignore */ }
      }
      // disconnect after the fade (realtime only; offline contexts just finish)
      if (typeof setTimeout !== 'undefined') setTimeout(() => { try { old.disconnect(); } catch { /* ignore */ } }, 4000);
    }
    this.bedSrcs = [];
    this.bus = null;
  }

  private stepTime(step: number): number {
    const beat = 60 / this.bpm;
    return this.startTime + Math.floor(step / 2) * beat + (step % 2 ? beat * this.swing : 0);
  }

  /** Schedule all notes whose start lies before `until` (context time). */
  scheduleUntil(until: number): void {
    if (!this.running) return;
    // after a long stall (e.g. tab suspended) skip ahead rather than bursting notes
    while (this.stepTime(this.step) < this.ctx.currentTime - 0.1) {
      this.step++;
      this.chordStepsLeft--;
    }
    let guard = 0;
    while (this.stepTime(this.step) < until && guard++ < 4096) {
      const t = this.stepTime(this.step);
      if (t >= this.ctx.currentTime - 0.02) this.scheduleStep(this.step, t);
      this.step++;
    }
  }

  private scheduleStep(step: number, t: number): void {
    // ease intensity
    this.intensity += (this.target - this.intensity) * 0.08;
    const I = this.intensity;
    const s8 = step % 8; // position in bar (8ths)
    const beat = 60 / this.bpm;

    if (s8 === 0) {
      // section energy drifts slowly, occasional breakdowns
      this.energy = clamp(this.energy + (Math.random() - 0.5) * 0.25, 0.25, 1);
      if (Math.random() < 0.04) this.energy = 0.25;
    }

    // --- chord changes (on bar starts)
    let newChord = false;
    if (s8 === 0 && this.chordStepsLeft <= 0) {
      if (step > 0) this.chord = CHORDS[pick(NEXT[this.chord.name])];
      this.chordStepsLeft = Math.random() < 0.7 ? 16 : 8;
      this.voicing = this.voice(this.chord);
      newChord = true;
      if (step % 16 === 0) this.melodyOn = Math.random() < 0.3 + 0.45 * I * this.energy + 0.1;
    }
    this.chordStepsLeft--;

    // --- Rhodes
    if (newChord) {
      this.voicing.forEach((m, i) => this.rhodes(t + i * 0.018 + Math.random() * 0.01, m, 0.055 * (0.85 + Math.random() * 0.3), beat * (this.chordStepsLeft + 1) * 0.5 + 0.5));
    } else if (s8 !== 0) {
      const p = (0.06 + 0.12 * I) * this.energy * (s8 % 2 ? 1 : 0.7);
      if (Math.random() < p) {
        const sub = this.voicing.filter(() => Math.random() < 0.5).slice(0, 3);
        sub.forEach((m, i) => this.rhodes(t + i * 0.012, m, 0.03, beat * 1.5));
      }
    }

    // --- Bass
    const root = KEY - 12 + this.chord.root; // F2 region
    const bassRoot = root > 47 ? root - 12 : root;
    if (newChord) this.bass(t, bassRoot, 0.045 + 0.035 * I, beat * (I > 0.3 ? 1.8 : 3.2));
    else if (s8 === 4 && I > 0.25 && Math.random() < 0.4 + 0.5 * I) this.bass(t, Math.random() < 0.6 ? bassRoot : bassRoot + 7, 0.055 + 0.015 * I, beat * 1.5);
    else if (s8 === 0 && I > 0.3) this.bass(t, bassRoot, 0.06, beat * 1.6);
    else if (s8 === 7 && I > 0.5 && Math.random() < 0.3) this.bass(t, bassRoot + (Math.random() < 0.5 ? 2 : -1), 0.05, beat * 0.4);

    // --- Melody (kalimba / marimba)
    if (this.melodyOn) {
      const strong = s8 % 2 === 0;
      const p = (0.12 + 0.3 * I) * (0.5 + 0.5 * this.energy) * (strong ? 1.2 : 0.8);
      if (Math.random() < p) {
        const moves: [number, number][] = [[-2, 1], [-1, 3], [0, 1], [1, 3], [2, 1]];
        this.melIdx = clamp(this.melIdx + pick(moves), 0, PENTA.length - 1);
        let m = PENTA[this.melIdx];
        if (strong) {
          // nudge to a chord tone if one is adjacent in the pentatonic pool
          const tones = this.chord.tones.map((x) => pc(KEY + x));
          if (!tones.includes(pc(m))) {
            for (const d of [1, -1]) {
              const j = this.melIdx + d;
              if (j >= 0 && j < PENTA.length && tones.includes(pc(PENTA[j]))) {
                this.melIdx = j;
                m = PENTA[j];
                break;
              }
            }
          }
        }
        const vel = 0.1 + Math.random() * 0.05;
        this.kalimba(t + Math.random() * 0.012, m, vel, Math.random() * 0.6 - 0.3);
        if (Math.random() < 0.08) this.kalimba(t + beat * 0.25, PENTA[clamp(this.melIdx + 1, 0, PENTA.length - 1)], vel * 0.6, 0.2);
      }
    }

    // --- Percussion
    const beatInBar = s8 / 2;
    if (I > 0.12 && s8 % 2 === 0 && (beatInBar === 1 || beatInBar === 3)) this.brush(t, 0.05 + 0.04 * I);
    if (I > 0.45 && s8 % 2 === 0 && Math.random() < 0.6) this.swish(t, beat, 0.018 + 0.012 * I);
    if (I > 0.5 && this.energy > 0.4) this.shaker(t, s8 % 2 ? 0.012 : 0.022 * I);
    if (I > 0.35 && (s8 === 0 || (s8 === 4 && I > 0.6 && Math.random() < 0.5))) this.kick(t, 0.06 + 0.03 * I);
    if (I > 0.55 && s8 % 2 === 1 && Math.random() < 0.06) this.woodblock(t, 0.035);
  }

  /** Voice chord tones around a centre for smooth voice leading. */
  private voice(ch: Chord): number[] {
    const centre = this.voicing.length ? this.voicing.reduce((a, b) => a + b, 0) / this.voicing.length : 66;
    const notes = ch.tones.map((x) => {
      let m = KEY + x;
      while (m < centre - 6) m += 12;
      while (m > centre + 6) m -= 12;
      return clamp(m, 57, 77);
    });
    const uniq = Array.from(new Set(notes)).sort((a, b) => a - b);
    return uniq.slice(0, 4);
  }

  // --- instruments -----------------------------------------------------------

  private rhodes(t: number, midi: number, amp: number, hold: number): void {
    if (!this.rhodesBus) return;
    const ctx = this.ctx;
    const f = midiToHz(midi) * Math.pow(2, (Math.random() - 0.5) * 0.006);
    const end = t + hold + 1.2;
    const car = oscNode(ctx, 'sine', f, t, end);
    const mod = oscNode(ctx, 'sine', f, t, end);
    const mg = gainNode(ctx, 0);
    mg.gain.setValueAtTime(f * 1.5, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.18, t + 0.6);
    mod.connect(mg).connect(car.frequency);
    // tine: a quick high partial for the bell-like attack
    const tine = oscNode(ctx, 'sine', f * 7.1, t, t + 0.2);
    const tg = gainNode(ctx, 0);
    perc(tg.gain, t, amp * 0.12, 0.001, 0.15);
    tine.connect(tg).connect(this.rhodesBus);
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(amp * 0.35, t + 0.9);
    g.gain.exponentialRampToValueAtTime(amp * 0.15, t + Math.max(1.0, hold));
    g.gain.exponentialRampToValueAtTime(amp * 1e-4, end);
    g.gain.setValueAtTime(0, end + 0.001);
    car.connect(g).connect(this.rhodesBus);
  }

  private kalimba(t: number, midi: number, amp: number, pan: number): void {
    if (!this.melBus) return;
    const ctx = this.ctx;
    const f = midiToHz(midi);
    const dest: AudioNode = this.melBus;
    let node: AudioNode = dest;
    if (typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(dest);
      node = p;
    }
    const end = t + 1.1;
    const car = oscNode(ctx, 'sine', f, t, end);
    const g = gainNode(ctx, 0);
    perc(g.gain, t, amp, 0.002, 1.05);
    car.connect(g).connect(node);
    // marimba-ish 4th partial + mallet FM thump
    const p4 = oscNode(ctx, 'sine', f * 4, t, t + 0.15);
    const g4 = gainNode(ctx, 0);
    perc(g4.gain, t, amp * 0.22, 0.001, 0.12);
    p4.connect(g4).connect(node);
    const mod = oscNode(ctx, 'sine', f * 3, t, t + 0.1);
    const mg = gainNode(ctx, 0);
    mg.gain.setValueAtTime(f * 1.2, t);
    mg.gain.exponentialRampToValueAtTime(1, t + 0.06);
    mod.connect(mg).connect(car.frequency);
  }

  private bass(t: number, midi: number, amp: number, len: number): void {
    if (!this.bassBus) return;
    const ctx = this.ctx;
    const f = midiToHz(midi);
    const end = t + len + 0.4;
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
    g.connect(this.bassBus);
  }

  private noiseHit(t: number, kind: 'white' | 'pink', ftype: BiquadFilterType, f: number, q: number, amp: number, attack: number, decay: number, pan: number): void {
    if (!this.percBus) return;
    const ctx = this.ctx;
    const end = t + attack + decay;
    const s = noiseNode(ctx, this.nb[kind], t, end);
    const fl = filterNode(ctx, ftype, f, q);
    const g = gainNode(ctx, 0);
    perc(g.gain, t, amp, attack, decay);
    let last: AudioNode = s.connect(fl).connect(g);
    if (typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      last = last.connect(p);
    }
    last.connect(this.percBus);
  }

  private brush(t: number, amp: number): void {
    this.noiseHit(t, 'white', 'bandpass', 4200, 0.6, amp, 0.012, 0.22, 0.25);
  }

  private swish(t: number, beat: number, amp: number): void {
    this.noiseHit(t, 'pink', 'bandpass', 3000, 0.5, amp, beat * 0.5, beat * 0.4, -0.2);
  }

  private shaker(t: number, amp: number): void {
    if (amp <= 0.0005) return;
    this.noiseHit(t, 'white', 'highpass', 7000, 0.7, amp, 0.008, 0.06, 0.35);
  }

  private woodblock(t: number, amp: number): void {
    if (!this.percBus) return;
    const ctx = this.ctx;
    for (const [f, a] of [[1150, 1], [1830, 0.4]] as [number, number][]) {
      const o = oscNode(ctx, 'sine', f, t, t + 0.08);
      const g = gainNode(ctx, 0);
      perc(g.gain, t, amp * a, 0.001, 0.06);
      o.connect(g).connect(this.percBus);
    }
  }

  private kick(t: number, amp: number): void {
    if (!this.percBus) return;
    const ctx = this.ctx;
    const o = oscNode(ctx, 'sine', 100, t, t + 0.35);
    o.frequency.setValueAtTime(100, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    const g = gainNode(ctx, 0);
    perc(g.gain, t, amp, 0.004, 0.3);
    o.connect(g).connect(this.percBus);
  }
}
