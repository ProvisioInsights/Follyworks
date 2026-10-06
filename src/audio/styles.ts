// The six music styles, one per visual theme. Each style declares its tempo, metre, keys, chord
// progressions and motif rhythms (the conductor in music.ts turns those into sections, chords and
// melodies) and a `create` function that builds its buses and returns the per-16th step function.
//
// Intensity (I) is ~0.2 on menus, ~0.3 while building and ~0.75 while a machine runs; section
// energy (E) rises from intro to B and drops in breaks and rests. Every style adds layers with
// I*E so build mode stays calm and run mode gets busier, and every style thins out in 'break'
// and nearly stops in 'rest' so long sessions breathe.

import type { PlayerApi, StepInfo } from './music';
import type { MusicTheme } from './themes';
import { noiseNode, filterNode, gainNode } from './synth';

export type StepFn = (s: StepInfo) => void;

export interface StyleDef {
  id: MusicTheme;
  bpm: [number, number];
  beats: 3 | 4;
  /** 0.5 = straight; >0.5 delays the off-beat of each pair */
  swing: number;
  swingUnit: 8 | 16;
  /** tonic candidates (midi, chord register); the conductor rotates through them */
  keys: number[];
  mode: 'major' | 'minor';
  sevenths: boolean;
  /** pitch classes (semitones above tonic) the melody may use */
  melody: number[];
  /** melody range relative to the tonic */
  melRange: [number, number];
  /** chord voicing centre relative to the tonic */
  chordCentre: number;
  /** degree sequences (0-based scale degrees; 7 bVII, 8 iv, 9 bVI, 10 V7) */
  progA: number[][];
  progB: number[][];
  chordBars: number;
  /** section length multiplier (fast metres use 2) */
  barsMul?: number;
  /** output trim, calibrated so the themes sit within ~1.5 dB of each other */
  level: number;
  /** 2-bar motif rhythms: 'x' = note start (16th grid) */
  rhythms: string[];
  rhythmsB?: string[];
  create(p: PlayerApi): StepFn;
}

const ch = (p: number): boolean => Math.random() < p;
const jit = (amt = 0.006): number => Math.random() * amt;

// ---------------------------------------------------------------------------- modern

const modern: StyleDef = {
  id: 'modern',
  bpm: [72, 82],
  beats: 4,
  swing: 0.57,
  swingUnit: 8,
  keys: [53, 51, 55],
  mode: 'major',
  sevenths: true,
  melody: [0, 2, 4, 7, 9],
  melRange: [19, 36],
  chordCentre: 13,
  progA: [[0, 5, 1, 4], [0, 2, 5, 3], [3, 2, 1, 0], [0, 3, 5, 4]],
  progB: [[5, 3, 0, 4], [1, 4, 0, 5], [3, 4, 2, 5]],
  chordBars: 2,
  level: 1.0,
  rhythms: [
    'x.....x...x.....x...........x...',
    '..x...x.x.......x.....x.x.......',
    'x...x...x.......x.x...x.........',
  ],
  rhythmsB: ['x.x...x...x.x...x...x...x.......', '..x.x...x...x...x.x.....x...x...'],
  create(p) {
    const { inst } = p;
    const keys = p.bus(1, 0.35, 3400);
    const mel = p.bus(1, 0.5);
    const perc = p.bus(1, 0.25);
    const bass = p.bus(1, 0, 520);
    // vinyl crackle + faint room hiss
    const t0 = p.ctx.currentTime + 0.05;
    const cr = noiseNode(p.ctx, p.nb.crackle, t0, t0 + 1e5, 1);
    const crf = filterNode(p.ctx, 'bandpass', 2500, 0.5);
    const crg = gainNode(p.ctx, 0.022);
    cr.connect(crf).connect(crg).connect(perc);
    p.hold(cr);
    return (s) => {
      const { t, I, E, spb } = s;
      const beat = s.sub === 0;
      const rest = s.kind === 'rest';
      if (s.chordStart) s.chord.forEach((m, i) => inst.ep(t + i * 0.018 + jit(0.01), m, (rest ? 0.035 : 0.055) * (0.85 + Math.random() * 0.3), spb * 4 * 2 * 0.5 + 0.5, keys));
      if (rest) return;
      if (!s.chordStart && s.sub % 2 === 0 && ch((0.05 + 0.1 * I) * E)) {
        s.chord.filter(() => ch(0.5)).slice(0, 3).forEach((m, i) => inst.ep(t + i * 0.012, m, 0.03, spb * 1.5, keys, 1));
      }
      // bass
      if (s.chordStart) inst.bass(t, s.root, 0.045 + 0.035 * I, spb * (I > 0.3 ? 1.8 : 3.2), bass, 'round');
      else if (s.step === 8 && I > 0.25 && ch(0.4 + 0.5 * I)) inst.bass(t, ch(0.6) ? s.root : s.fifth, 0.055 + 0.015 * I, spb * 1.5, bass, 'round');
      else if (s.step === 0 && I > 0.3) inst.bass(t, s.root, 0.06, spb * 1.6, bass, 'round');
      else if (s.step === 14 && I > 0.5 && ch(0.3)) inst.bass(t, s.root + (ch(0.5) ? 2 : -1), 0.05, spb * 0.4, bass, 'round', 1);
      // melody: kalimba, sparser while building, absent in breaks
      if (s.mel && s.kind !== 'break' && (s.kind !== 'intro' || I > 0.5) && ch(0.45 + 0.5 * I)) {
        const v = 0.1 + Math.random() * 0.05;
        inst.mallet(t + jit(0.012), s.mel.m, v, mel, 'kalimba', Math.random() * 0.6 - 0.3);
      }
      // percussion
      if (beat && I > 0.12 && (s.beat === 1 || s.beat === 3)) inst.snare(t, 0.05 + 0.04 * I, perc, 'brush', 0.25);
      if (beat && I > 0.45 && s.kind !== 'break' && ch(0.6)) inst.snare(t, 0.02 + 0.012 * I, perc, 'brush', -0.2, 0);
      if (I > 0.5 && E > 0.4 && s.sub % 2 === 0) inst.shaker(t, s.sub === 2 ? 0.012 : 0.022 * I, perc);
      if (s.kind !== 'break' && I > 0.35 && (s.step === 0 || (s.step === 8 && I > 0.6 && ch(0.5)))) inst.kick(t, 0.06 + 0.03 * I, perc);
      if (I > 0.55 && s.sub === 2 && ch(0.06)) inst.woodblock(t, 0.035, perc);
    };
  },
};

// ---------------------------------------------------------------------------- stone

const stone: StyleDef = {
  id: 'stone',
  bpm: [92, 104],
  beats: 4,
  swing: 0.54,
  swingUnit: 16,
  keys: [50, 52, 48],
  mode: 'major',
  sevenths: false,
  melody: [0, 2, 4, 7, 9],
  melRange: [14, 31],
  chordCentre: 10,
  progA: [[0, 0, 5, 5], [0, 3, 0, 4], [5, 3, 0, 4], [0, 5, 3, 0]],
  progB: [[3, 4, 5, 5], [5, 3, 4, 0], [3, 0, 4, 4]],
  chordBars: 2,
  level: 1.4,
  rhythms: [
    'x..x..x...x.....x..x..x...x.x...',
    'x.x...x.x.......x.x...x.x...x...',
    '..x..x..x.......x...x.x.x.......',
  ],
  rhythmsB: ['x.xx..x.x.x...x.x.xx..x.x.......', 'x..x..x.x..x..x.x...x...x.x.x...'],
  create(p) {
    const { inst } = p;
    const marim = p.bus(1, 0.3);
    const mel = p.bus(1, 0.45);
    const drums = p.bus(1, 0.2);
    const bass = p.bus(1, 0, 900);
    // log-drum ostinato (3-3-2) and arpeggio shapes
    const LOG = 'x..x..x.x.x.x...';
    const ARP = [0, 2, 1, 2, 0, 3, 1, 2];
    return (s) => {
      const { t, I, E, sub } = s;
      const run = I > 0.5;
      const rest = s.kind === 'rest';
      const brk = s.kind === 'break';
      if (s.firstBar && s.step === 0 && (rest || ch(0.5))) inst.rainstick(t, s.spb * (rest ? 6 : 3), 0.05, drums);
      if (rest) {
        if (s.step === 0) inst.logDrum(t, s.root + 12, 0.07, drums);
        if (s.step === 0) inst.mallet(t + 0.02, s.chord[0] + 12, 0.05, marim, 'marimba', -0.2, 2);
        return;
      }
      // marimba ostinato over the chord (8ths while building, 16th pickups when running)
      const tones = s.chord.map((m) => m + 12);
      if (sub % 2 === 0) {
        const idx = ARP[(s.step / 2) % ARP.length] % tones.length;
        const a = (s.sub === 0 ? 0.085 : 0.06) * (brk ? 0.8 : 1);
        if (!(brk && ch(0.4))) inst.mallet(t + jit(), tones[idx], a, marim, 'marimba', idx % 2 ? 0.3 : -0.3, 1);
      } else if (run && E > 0.6 && ch(0.25)) {
        inst.mallet(t, tones[Math.floor(Math.random() * tones.length)] + 12, 0.025, marim, 'marimba', 0.4, 0);
      }
      // wooden bass: root on 1, dotted push on the '&' of 2 when lively
      if (s.chordStart || s.step === 0) inst.bass(t, s.root, 0.13 + 0.03 * I, s.spb * 1.2, bass, 'wood');
      else if (I > 0.3 && s.step === 6 && !brk) inst.bass(t, ch(0.5) ? s.root : s.fifth, 0.07, s.spb * 0.8, bass, 'wood');
      // log drums (run / B sections)
      if ((run || s.kind === 'B') && !brk && LOG[s.step % 16] === 'x' && ch(0.85)) {
        const hi = s.step % 16 === 6 || s.step % 16 === 12;
        inst.logDrum(t, (hi ? s.fifth : s.root) + 12, 0.06 + 0.03 * E, drums, hi ? 0.25 : -0.15);
      } else if (!run && s.step === 0 && I > 0.25) inst.logDrum(t, s.root + 12, 0.045, drums);
      // hand drums
      if (I > 0.4) {
        if (s.step === 0 || s.step === 10) inst.hand(t, 'bass', 0.09 * I, drums, -0.1, 1);
        if ((s.step === 4 || s.step === 12) && !brk) inst.hand(t, 'slap', 0.07 + 0.03 * E, drums, 0.2, 1);
        if ((s.step === 7 || s.step === 14) && ch(0.6)) inst.hand(t, 'tone', 0.05, drums, 0.15);
        if (sub % 2 === 1 && ch(0.12 * I * E)) inst.hand(t, 'tone', 0.025, drums, 0.3);
      }
      // shaker
      if (I > 0.35 && E > 0.3) inst.shaker(t, sub === 0 ? 0.02 * I : sub === 2 ? 0.014 : 0.008, drums, 0.4);
      // kalimba melody, doubled an octave down on marimba in lively B sections
      if (s.mel && !brk && (s.kind !== 'intro' || I > 0.5) && ch(0.5 + 0.45 * I)) {
        inst.mallet(t + jit(0.01), s.mel.m, 0.14 + Math.random() * 0.04, mel, 'kalimba', Math.random() * 0.5 - 0.25);
        if (run && s.kind === 'B') inst.mallet(t, s.mel.m - 12, 0.05, marim, 'marimba', 0, 0);
      }
    };
  },
};

// ---------------------------------------------------------------------------- steam

const steam: StyleDef = {
  id: 'steam',
  bpm: [138, 152],
  beats: 3,
  swing: 0.5,
  swingUnit: 16,
  keys: [48, 46, 50],
  mode: 'major',
  sevenths: false,
  melody: [0, 2, 4, 5, 7, 9, 11],
  melRange: [12, 31],
  chordCentre: 12,
  progA: [[0, 3, 4, 0], [0, 5, 1, 4], [0, 0, 3, 4], [0, 4, 4, 0]],
  progB: [[3, 0, 4, 0], [5, 1, 4, 4], [3, 3, 0, 4]],
  chordBars: 2,
  barsMul: 2,
  level: 1.0,
  rhythms: [
    'x...x...x...x...........',
    'x.......x.x.x...x...x...',
    'x...........x...x...x...',
    '....x.x.x...x...........',
  ],
  rhythmsB: ['x...x.x.x...x...x...x...', 'x.x.x...x...x.x.x...x...'],
  create(p) {
    const { inst } = p;
    const oom = p.bus(1, 0.15, 1800);
    const pah = p.bus(1, 0.3);
    const mel = p.bus(1, 0.45);
    const box = p.bus(1, 0.55);
    const perc = p.bus(1, 0.2);
    return (s) => {
      const { t, I, E } = s;
      const run = I > 0.5;
      const rest = s.kind === 'rest';
      const brk = s.kind === 'break';
      const onBeat = s.sub === 0;
      // workshop clock: tick-tock while building, fades out when running
      if (onBeat && I < 0.6 && !rest) inst.woodblock(t, 0.018 * (1 - I), perc, s.beat % 2 === 0, s.beat % 2 ? 0.4 : -0.4);
      if (rest) {
        // the music box winding down: one chord tone per beat
        if (onBeat) inst.mallet(t, s.chord[s.beat % s.chord.length] + 24, 0.05, box, 'musicbox', 0.2, 2);
        return;
      }
      // oom: tuba root on 1, alternating root / fifth by bar
      if (s.step === 0) {
        const m = s.bar % 2 === 0 ? s.root : s.fifth - 12;
        if (!brk) inst.bass(t, m, run ? 0.11 : 0.09, s.spb * 0.8, oom, 'tuba');
        else if (s.barIn % 2 === 0) inst.bass(t, s.root, 0.05, s.spb * 1.6, oom, 'tuba');
      }
      // pah-pah on beats 2 and 3
      if (onBeat && s.beat > 0 && !brk) {
        if (run) inst.stab(t, s.chord, 0.06, s.spb * 0.35, pah, 'organ');
        else s.chord.slice(0, 3).forEach((m, i) => inst.pizz(t + i * 0.004, m, 0.06, pah, i - 1));
      }
      // waltz bass walk-up into a new section
      if (s.lastBar && run && onBeat && s.beat > 0) inst.bass(t, s.root + (s.beat === 1 ? 2 : 4), 0.06, s.spb * 0.6, oom, 'tuba', 1);
      // melody: music box while building, calliope when the machine runs
      if (s.mel && (s.kind !== 'intro' || I > 0.5)) {
        const len = s.mel.len * s.s16;
        if (run && !brk) {
          inst.lead(t, s.mel.m, 0.06, Math.min(len * 0.9, s.spb * 2), mel, 'calliope', 0.1);
          if (s.kind === 'B' && ch(0.7)) inst.mallet(t, s.mel.m + 12, 0.04, box, 'glock', -0.3, 0);
        } else if (ch(0.6 + 0.4 * I)) {
          inst.mallet(t + jit(0.008), s.mel.m + 12, 0.13, box, 'musicbox', Math.random() * 0.4 - 0.2);
        }
      }
      // music-box counter-arpeggio on the off-beat in calm sections
      if (!run && s.sub === 2 && s.beat === 2 && ch(0.35 * E)) inst.mallet(t, s.chord[Math.floor(Math.random() * s.chord.length)] + 24, 0.035, box, 'musicbox', 0.4, 0);
      // run-mode percussion: steam chuffs on the pahs, triangle at phrase starts
      if (run && !brk) {
        if (onBeat && s.beat > 0) inst.chuff(t, 0.03 + 0.02 * E, perc, s.beat === 1 ? -0.3 : 0.3);
        if (s.step === 0 && s.barIn % 4 === 0) inst.triangleBell(t, 0.03, perc);
        if (s.sub === 2 && ch(0.15 * E)) inst.chuff(t, 0.015, perc, 0);
      }
    };
  },
};

// ---------------------------------------------------------------------------- retro

const retro: StyleDef = {
  id: 'retro',
  bpm: [124, 136],
  beats: 4,
  swing: 0.5,
  swingUnit: 16,
  keys: [55, 57, 53],
  mode: 'major',
  sevenths: false,
  melody: [0, 2, 4, 5, 7, 9, 11],
  melRange: [12, 31],
  chordCentre: 7,
  progA: [[0, 4, 5, 3], [0, 3, 0, 4], [5, 3, 4, 0], [0, 5, 3, 4]],
  progB: [[3, 4, 2, 5], [1, 4, 0, 5], [3, 3, 4, 4]],
  chordBars: 1,
  level: 1.1,
  rhythms: [
    'x.x.x..x..x.x...x.x...x.x.x.....',
    'x...x.x...x.x.x.x.....x...x.....',
    'x..x..x.x.x.....x..x..x.x.......',
  ],
  rhythmsB: ['x.xxx.x.x.x.x...x.xxx.x.x...x...', 'x..x..x...x.x.x.x..x..x...x.....'],
  create(p) {
    const { inst } = p;
    const lead = p.bus(1, 0.2);
    const echo = p.echo(3, 0.32, 0.35);
    const bass = p.bus(1, 0, 2400);
    const chords = p.bus(1, 0.2);
    const drums = p.bus(1, 0.1);
    const BOUNCE = [0, 12, 0, 12, 7, 12, 0, 12];
    return (s) => {
      const { t, I, E } = s;
      const run = I > 0.5;
      const rest = s.kind === 'rest';
      const brk = s.kind === 'break';
      const eighth = s.sub % 2 === 0;
      if (rest) {
        if (s.step === 0) inst.stab(t, s.chord, 0.05, s.spb * 2, chords, 'ep', 2);
        if (eighth && s.sub === 2) inst.hat(t, 0.012, drums);
        return;
      }
      // FM bass: quarter notes while building, octave-bouncing 8ths when running
      if (run && !brk) {
        if (eighth) {
          const k = (s.step / 2) % 8;
          inst.bass(t, s.root + BOUNCE[k], k % 2 ? 0.07 : 0.1, s.s16 * 1.6, bass, 'fm', k === 0 ? 2 : 1);
        }
      } else if (s.sub === 0 && (s.beat % 2 === 0 || I > 0.25)) {
        inst.bass(t, s.beat === 2 ? s.fifth : s.root, 0.09, s.spb * 0.8, bass, 'fm');
      }
      // chords: off-beat square blips when running, a soft EP chord per bar while building
      if (run && s.sub === 2 && !brk) inst.stab(t, s.chord, 0.035, s.s16 * 1.2, chords, 'square', 0);
      else if (!run && s.chordStart) inst.stab(t, s.chord, 0.045, s.spb * 3, chords, 'ep', 2);
      // B-section counter arpeggio (pulse) when lively
      if (run && s.kind === 'B' && s.sub % 2 === 1 && E > 0.8) inst.arp(t, s.chord[(s.step >> 1) % s.chord.length] + 12, 0.025, 0.25, chords, 0.3);
      // lead: square with echo when running, softer FM vibes while building
      if (s.mel && !brk && (s.kind !== 'intro' || I > 0.5)) {
        const len = Math.min(s.mel.len, 4) * s.s16 * 0.85;
        if (run) {
          inst.lead(t, s.mel.m, 0.05, len, lead, 'square', 0);
          inst.lead(t, s.mel.m, 0.03, len, echo, 'square', 0, 0);
        } else if (ch(0.55 + 0.4 * I)) {
          inst.lead(t, s.mel.m, 0.07, len, lead, 'fmbell', 0.1);
        }
      }
      // drum machine
      if (s.step === 0 && I > 0.2) inst.kick(t, 0.11, drums, 'machine');
      if (s.step === 8 && I > 0.3 && !brk) inst.kick(t, 0.1, drums, 'machine');
      if (run && s.step === 6 && E > 0.7 && ch(0.5)) inst.kick(t, 0.07, drums, 'machine', 0);
      if (run && (s.step === 4 || s.step === 12) && !brk) inst.snare(t, 0.08, drums, 'machine', 0.05);
      if (I > 0.3 && eighth) inst.hat(t, s.sub === 2 ? 0.03 : 0.02, drums, false, 0.25);
      if (run && E > 0.85 && !eighth) inst.hat(t, 0.012, drums, false, 0.3);
      // fill: 16th snares on the last beat of a section
      if (run && s.lastBar && s.beat === 3) inst.snare(t, 0.04 + 0.015 * s.sub, drums, 'machine', 0.1);
    };
  },
};

// ---------------------------------------------------------------------------- comic

const comic: StyleDef = {
  id: 'comic',
  bpm: [112, 124],
  beats: 4,
  swing: 0.5,
  swingUnit: 16,
  keys: [46, 48, 51],
  mode: 'major',
  sevenths: false,
  melody: [0, 2, 4, 5, 7, 9, 11],
  melRange: [12, 28],
  chordCentre: 10,
  progA: [[0, 3, 4, 0], [0, 7, 3, 0], [0, 5, 3, 4]],
  progB: [[3, 4, 2, 5], [9, 7, 0, 0], [3, 8, 0, 4]],
  chordBars: 1,
  level: 1.0,
  rhythms: [
    'x..x.x..x.......x..x.x..x.x.....',
    'x...x..xx.......x...x..xx...x...',
    '......xxx.......x..x....x.......',
  ],
  rhythmsB: ['x..xx..xx..xx...x..x.x..x.......', 'x...x...x..x.x..x...x.x.x.......'],
  create(p) {
    const { inst } = p;
    const brass = p.bus(1, 0.3);
    const strings = p.bus(1, 0.4, 2600);
    const light = p.bus(1, 0.35);
    const bass = p.bus(1, 0.05, 1600);
    const drums = p.bus(1, 0.2);
    return (s) => {
      const { t, I, E } = s;
      const run = I > 0.5;
      const rest = s.kind === 'rest';
      const brk = s.kind === 'break';
      const onBeat = s.sub === 0;
      if (rest) {
        if (s.step === 0) inst.timpani(t, s.root, 0.06, drums);
        if (onBeat && s.beat === 2) s.chord.forEach((m, i) => inst.pizz(t + i * 0.01, m, 0.035, light, i - 1));
        return;
      }
      // crash + timpani into a section when running
      if (s.firstBar && s.step === 0 && run && s.kind !== 'break') {
        inst.crash(t, 0.05 * E, drums);
        inst.timpani(t, s.root, 0.09, drums);
      }
      // march bass on 1 and 3 (tuba when running, pizz while building)
      if (onBeat && (s.beat === 0 || s.beat === 2)) {
        const m = s.beat === 0 ? s.root : s.fifth - 12 >= 33 ? s.fifth - 12 : s.fifth;
        if (run) inst.bass(t, m, 0.09, s.spb * 0.7, bass, 'tuba');
        else inst.pizz(t, m, 0.16, bass, 0, 2);
      }
      if (run) {
        // brass stabs: hit the chord, then the "& of 4" push into the next bar
        if (!brk && (s.chordStart || (s.step === 14 && ch(0.5 * E)))) inst.stab(t, s.chord.map((m) => m + 12), 0.075, s.s16 * 2.5, brass, 'brass', 1);
        if (s.kind === 'B' && s.chordStart) inst.pad(t, s.chord, 0.05, s.spb * 4, strings, 'strings');
        if (s.mel && !brk) inst.lead(t, s.mel.m, 0.06, Math.min(s.mel.len, 6) * s.s16 * 0.9, brass, 'brass', 0.1);
        // march snare: 2 and 4, ghosts, roll into the next section
        if (onBeat && (s.beat === 1 || s.beat === 3) && !(s.lastBar && s.beat === 3)) inst.snare(t, 0.07, drums, 'march', 0.1);
        else if (!onBeat && s.sub === 2 && ch(0.35 * E)) inst.snare(t, 0.018, drums, 'march', 0.1, 0);
        if (s.lastBar && s.step === 8) inst.roll(t, s.spb * 2, 0.012, 0.07, drums);
        if (s.step === 0 && !brk) inst.timpani(t, s.root, 0.04, drums, 0);
      } else {
        // sneaky build: pizz chords on 2 and 4, glockenspiel melody, light snare taps
        if (onBeat && (s.beat === 1 || s.beat === 3)) s.chord.forEach((m, i) => inst.pizz(t + i * 0.006, m + 12, 0.1, light, (i - 1) * 0.4, 1));
        if (s.chordStart && s.kind !== 'intro') inst.pad(t, s.chord, 0.055, s.spb * 4, strings, 'strings');
        if (s.mel && !brk && (s.kind !== 'intro' || I > 0.4) && ch(0.6 + 0.3 * I)) inst.mallet(t, s.mel.m + 12, 0.13, light, 'glock', 0.2);
        if (I > 0.22 && s.sub === 2 && s.beat === 3 && ch(0.5)) inst.snare(t, 0.025, drums, 'march', 0.2, 0);
        if (s.lastBar && s.step === 12 && I > 0.25) inst.roll(t, s.spb, 0.006, 0.035, drums);
        if (s.firstBar && s.step === 0) inst.timpani(t, s.root, 0.05, drums);
      }
    };
  },
};

// ---------------------------------------------------------------------------- future

const future: StyleDef = {
  id: 'future',
  bpm: [100, 110],
  beats: 4,
  swing: 0.5,
  swingUnit: 16,
  keys: [57, 55, 59],
  mode: 'minor',
  sevenths: true,
  melody: [0, 3, 5, 7, 10],
  melRange: [12, 27],
  chordCentre: 3,
  progA: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6]],
  progB: [[5, 6, 0, 0], [3, 4, 5, 10], [5, 2, 6, 0]],
  chordBars: 2,
  level: 0.75,
  rhythms: [
    'x.......x...x...x...............',
    'x.....x.....x...x.....x.x.......',
    '....x...x.......x...x...x.......',
  ],
  rhythmsB: ['x..x..x...x.x...x..x..x.....x...', 'x.....x.x.....x.x.....x.x.......'],
  create(p) {
    const { inst, ctx } = p;
    // pad + arp go through a pump gain (gentle sidechain from the kick grid)
    const pumpBus = p.bus(1, 0.45);
    const pump = gainNode(ctx, 1);
    pump.connect(pumpBus);
    const pad = gainNode(ctx, 1);
    pad.connect(pump);
    const arp = gainNode(ctx, 1);
    arp.connect(pump);
    const arpEcho = p.echo(3, 0.35, 0.3);
    const sub = p.bus(1, 0, 300);
    const drums = p.bus(1, 0.12);
    const lead = p.bus(1, 0.4);
    const UP = [0, 1, 2, 3, 2, 1];
    let ai = 0;
    return (s) => {
      const { t, I, E } = s;
      const run = I > 0.5;
      const rest = s.kind === 'rest';
      const brk = s.kind === 'break';
      // sidechain duck: every beat when running, half notes while building
      if (s.sub === 0 && !rest && (run || s.beat % 2 === 0)) {
        const depth = run && !brk ? 0.45 : 0.22;
        pump.gain.setValueAtTime(1 - depth, t);
        pump.gain.setTargetAtTime(1, t + 0.01, s.spb * 0.22);
      }
      if (s.chordStart) inst.pad(t, s.chord.concat([s.chord[0] + 12]), rest ? 0.045 : run ? 0.07 : 0.055, s.spb * 4 * 2 - 0.2, pad, 'analog');
      if (rest) return;
      // sub bass: long roots while building, off-beat 8ths when running
      if (run && !brk) {
        if (s.sub === 2) inst.bass(t, s.root - 12, 0.07, s.s16 * 1.5, sub, 'sub');
        else if (s.step === 0) inst.bass(t, s.root - 12, 0.06, s.s16 * 1.5, sub, 'sub');
      } else if (s.chordStart) inst.bass(t, s.root - 12, 0.06, s.spb * 7, sub, 'sub');
      // arpeggiator
      const rate = run ? 1 : 2; // 16ths / 8ths
      if (s.sub % rate === 0 && !(brk && s.sub !== 0)) {
        const tones = s.chord.map((m) => m + 12);
        const k = UP[ai++ % UP.length] % tones.length;
        const oct = s.kind === 'B' && run && (ai % 8 === 7) ? 12 : 0;
        const bright = (run ? 0.35 : 0.12) + 0.4 * E * I;
        const a = run ? 0.035 : 0.03;
        inst.arp(t, tones[k] + oct, a, bright, arp, (ai % 2 ? 0.35 : -0.35), s.sub === 0 ? 1 : 0);
        if (run && s.sub === 0) inst.arp(t, tones[k] + oct, a * 0.6, bright, arpEcho, 0, 0);
      }
      // drums: four-on-the-floor when running
      if (run && !brk && s.sub === 0) inst.kick(t, 0.13, drums, 'deep');
      else if (!run && s.step === 0 && I > 0.25) inst.kick(t, 0.07, drums, 'deep');
      if (run && s.sub === 2 && !brk) inst.hat(t, 0.025, drums, s.beat === 3 && ch(0.3), 0.25);
      if (run && E > 0.6 && !brk && (s.step === 4 || s.step === 12)) inst.snare(t, 0.06, drums, 'clap', -0.1);
      if (s.lastBar && s.step === 0 && run) inst.riser(t, s.spb * 4, 0.035, drums);
      // lead: saw with glide in lively B sections, sparse FM bell otherwise
      if (s.mel && !brk && s.kind !== 'intro') {
        const len = Math.min(s.mel.len, 6) * s.s16;
        if (run && s.kind === 'B') inst.lead(t, s.mel.m, 0.045, len * 0.9, lead, 'saw', 0.15, 1, s.mel.accent ? 0 : s.mel.m - 2);
        else if (ch(0.35 + 0.3 * I)) inst.lead(t, s.mel.m, 0.06, len, lead, 'fmbell', -0.15);
      }
    };
  },
};

export const STYLES: Record<MusicTheme, StyleDef> = { modern, stone, steam, retro, comic, future };
