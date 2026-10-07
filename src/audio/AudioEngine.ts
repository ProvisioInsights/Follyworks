// Follyworks procedural audio engine. No audio files: every sound is synthesised with Web Audio.
//
// Graph:
//   one-shot voices --(dry)--> sfxGain ----------\
//                   --(send)-> sfxWetGain --> convolver (small room) --> reverbReturn --\
//   loops / scrub ---------->  sfxGain            ^                                      |
//   music ------------------>  musicDuck -> musicGain --> preMaster <--------------------/
//                     (send)-> musicWetGain ------/
//   preMaster -> glue compressor -> limiter -> masterGain (volume/mute) -> destination
//
// All public methods are no-ops before unlock() or when Web Audio is unavailable, and never throw.

import { LoopKind, LoopVoice, buildLoop } from './loops';
import { Music } from './music';
import { ImpactKind, Material, RECIPES, Voice, impactLayer, normKind, normMaterial } from './sfx';
import { NoiseBank, clamp, gainNode, makeNoiseBank, makeRoomIR } from './synth';
import { MusicTheme, normTheme } from './themes';

export type { MusicTheme } from './themes';

export type SfxName =
  | 'click' | 'clunk' | 'place' | 'pickup' | 'delete' | 'rotate' | 'error' | 'ui' | 'uiHover'
  | 'spring' | 'boing' | 'whoosh' | 'pop' | 'gear' | 'zap' | 'boom' | 'snap' | 'fuse'
  | 'punch' | 'cannon' | 'ding' | 'switch' | 'plate' | 'robotStep' | 'robotBeep'
  | 'success' | 'goal' | 'rewind' | 'tick' | 'connect' | 'disconnect' | 'ignite' | 'splash'
  | 'laserOn' | 'beamHit' | 'sensorOn'
  | 'squawk' | 'trapSnap' | 'toasterLever' | 'toasterDing' | 'kettle' | 'yowl' | 'meow' | 'bell' | 'swish'
  | 'secret';
export type LoopName = 'motor' | 'fan' | 'conveyor' | 'rocket' | 'flame' | 'magnet' | 'laserHum' | 'steam';

export interface Volumes { master: number; sfx: number; music: number } // 0..1 each

export const SFX_NAMES: readonly SfxName[] = [
  'click', 'clunk', 'place', 'pickup', 'delete', 'rotate', 'error', 'ui', 'uiHover',
  'spring', 'boing', 'whoosh', 'pop', 'gear', 'zap', 'boom', 'snap', 'fuse',
  'punch', 'cannon', 'ding', 'switch', 'plate', 'robotStep', 'robotBeep',
  'success', 'goal', 'rewind', 'tick', 'connect', 'disconnect', 'ignite', 'splash',
  'laserOn', 'beamHit', 'sensorOn',
  'squawk', 'trapSnap', 'toasterLever', 'toasterDing', 'kettle', 'yowl', 'meow', 'bell', 'swish',
  'secret',
];
export const LOOP_NAMES: readonly LoopName[] = ['motor', 'fan', 'conveyor', 'rocket', 'flame', 'magnet', 'laserHum', 'steam'];

interface SfxSpec {
  /** output gain */
  g: number;
  /** reverb send */
  wet: number;
  /** minimum seconds between two plays of this name */
  gap: number;
  /** 0 = expendable, 1 = normal, 2 = must play (UI feedback / rewards) */
  prio: 0 | 1 | 2;
  /** random pitch spread (+/-) */
  jit: number;
}

const SPEC: Record<SfxName, SfxSpec> = {
  click: { g: 0.7, wet: 0.05, gap: 0.03, prio: 2, jit: 0.03 },
  uiHover: { g: 0.5, wet: 0.0, gap: 0.06, prio: 0, jit: 0.02 },
  ui: { g: 0.7, wet: 0.12, gap: 0.04, prio: 2, jit: 0.0 },
  clunk: { g: 0.55, wet: 0.1, gap: 0.05, prio: 1, jit: 0.06 },
  place: { g: 0.45, wet: 0.1, gap: 0.04, prio: 2, jit: 0.05 },
  pickup: { g: 0.7, wet: 0.08, gap: 0.04, prio: 2, jit: 0.04 },
  delete: { g: 0.7, wet: 0.12, gap: 0.05, prio: 2, jit: 0.04 },
  rotate: { g: 0.95, wet: 0.06, gap: 0.04, prio: 2, jit: 0.04 },
  error: { g: 0.7, wet: 0.08, gap: 0.15, prio: 2, jit: 0.0 },
  spring: { g: 0.7, wet: 0.12, gap: 0.06, prio: 1, jit: 0.07 },
  boing: { g: 0.7, wet: 0.12, gap: 0.06, prio: 1, jit: 0.07 },
  whoosh: { g: 1.0, wet: 0.15, gap: 0.06, prio: 1, jit: 0.1 },
  pop: { g: 0.5, wet: 0.08, gap: 0.03, prio: 1, jit: 0.1 },
  gear: { g: 0.55, wet: 0.08, gap: 0.08, prio: 0, jit: 0.06 },
  zap: { g: 0.5, wet: 0.1, gap: 0.08, prio: 1, jit: 0.08 },
  boom: { g: 0.75, wet: 0.25, gap: 0.12, prio: 1, jit: 0.08 },
  snap: { g: 0.6, wet: 0.08, gap: 0.04, prio: 1, jit: 0.08 },
  fuse: { g: 0.45, wet: 0.05, gap: 0.2, prio: 0, jit: 0.05 },
  punch: { g: 0.58, wet: 0.08, gap: 0.05, prio: 1, jit: 0.06 },
  cannon: { g: 0.7, wet: 0.22, gap: 0.1, prio: 1, jit: 0.05 },
  ding: { g: 0.55, wet: 0.25, gap: 0.08, prio: 1, jit: 0.0 },
  switch: { g: 1.0, wet: 0.05, gap: 0.04, prio: 1, jit: 0.04 },
  plate: { g: 0.45, wet: 0.08, gap: 0.05, prio: 1, jit: 0.05 },
  robotStep: { g: 0.45, wet: 0.06, gap: 0.08, prio: 0, jit: 0.06 },
  robotBeep: { g: 0.7, wet: 0.1, gap: 0.25, prio: 1, jit: 0.0 },
  success: { g: 0.75, wet: 0.3, gap: 0.5, prio: 2, jit: 0.0 },
  goal: { g: 0.8, wet: 0.35, gap: 1.0, prio: 2, jit: 0.0 },
  rewind: { g: 0.6, wet: 0.1, gap: 0.2, prio: 2, jit: 0.0 },
  tick: { g: 0.45, wet: 0.04, gap: 0.05, prio: 0, jit: 0.03 },
  connect: { g: 0.6, wet: 0.12, gap: 0.05, prio: 2, jit: 0.0 },
  disconnect: { g: 0.6, wet: 0.12, gap: 0.05, prio: 2, jit: 0.0 },
  ignite: { g: 0.6, wet: 0.15, gap: 0.1, prio: 1, jit: 0.06 },
  splash: { g: 0.6, wet: 0.15, gap: 0.08, prio: 1, jit: 0.08 },
  laserOn: { g: 0.6, wet: 0.15, gap: 0.08, prio: 1, jit: 0.03 },
  beamHit: { g: 0.7, wet: 0.08, gap: 0.07, prio: 0, jit: 0.08 },
  sensorOn: { g: 0.6, wet: 0.15, gap: 0.08, prio: 1, jit: 0.0 },
  squawk: { g: 0.62, wet: 0.12, gap: 0.12, prio: 1, jit: 0.04 },
  trapSnap: { g: 0.7, wet: 0.1, gap: 0.05, prio: 1, jit: 0.05 },
  toasterLever: { g: 0.6, wet: 0.08, gap: 0.1, prio: 1, jit: 0.04 },
  toasterDing: { g: 0.6, wet: 0.2, gap: 0.1, prio: 1, jit: 0.02 },
  kettle: { g: 0.6, wet: 0.2, gap: 0.5, prio: 1, jit: 0.03 },
  yowl: { g: 0.62, wet: 0.15, gap: 0.3, prio: 1, jit: 0.06 },
  meow: { g: 0.5, wet: 0.12, gap: 0.3, prio: 0, jit: 0.08 },
  bell: { g: 0.6, wet: 0.35, gap: 0.12, prio: 1, jit: 0.01 },
  swish: { g: 0.65, wet: 0.25, gap: 0.2, prio: 1, jit: 0.03 },
  // secret theme unlocked: a ~1 s chiptune power-up jingle
  secret: { g: 0.7, wet: 0.15, gap: 1.0, prio: 2, jit: 0.0 },
};

/** Per-loop-kind level trims so that vol=1 loops sit well under the sfx. */
const LOOP_TRIM: Record<LoopName, number> = { motor: 0.8, fan: 1.2, conveyor: 1, rocket: 0.8, flame: 2.0, magnet: 0.65, laserHum: 0.8, steam: 0.9 };

const MAX_VOICES = 24;
const MAX_IMPACT_VOICES = 8;
const MAX_LOOPS = 6;
const IMPACT_RATE = 16; // tokens per second
const IMPACT_BURST = 6;

interface ActiveVoice { end: number; gain: GainNode; prio: number; impact: boolean; }

interface LoopRec {
  name: LoopName;
  vol: number;
  pan: number;
  rate: number;
  v: { lv: LoopVoice; panner: StereoPannerNode | null; gain: number; pan: number; rate: number } | null;
}

interface ScrubVoice { src: AudioBufferSourceNode; lp: BiquadFilterNode; g: GainNode; lfo: OscillatorNode; dir: number; }

type AudioCtor = new (opts?: AudioContextOptions) => AudioContext;

function getAudioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

const finite = (x: number | undefined, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);

export class AudioEngine {
  private ctx: BaseAudioContext | null = null;
  private readonly provided: BaseAudioContext | null;
  private realtime = false;
  private ready = false;

  private nb: NoiseBank | null = null;
  private sfxIn: GainNode | null = null;
  private sfxWetIn: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private sfxWetGain: GainNode | null = null;
  private musicIn: GainNode | null = null;
  private musicWetIn: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicWetGain: GainNode | null = null;
  private musicDuck: GainNode | null = null;
  private masterGain: GainNode | null = null;

  private volumes: Volumes = { master: 0.8, sfx: 0.8, music: 0.5 };
  private muted = false;

  private voices: ActiveVoice[] = [];
  private lastPlay = new Map<string, number>();
  private recent = new Map<string, { c: number; t: number }>();

  private tokens = IMPACT_BURST;
  private tokenT = 0;
  private pairLast = new Map<string, number>();

  private loops = new Map<string, LoopRec>();
  private lastReconcile = -1;

  private music: Music | null = null;
  private musicWanted = false;
  private musicIntensity = 0;
  private theme: MusicTheme = 'modern';
  private musicTimer: ReturnType<typeof setInterval> | null = null;

  private scrub: ScrubVoice | null = null;

  /** Offline testing only: shifts "now" for scheduling inside an OfflineAudioContext. */
  private timeOffset = 0;

  /**
   * @param ctx Optional context (e.g. an OfflineAudioContext for tests/rendering). When omitted,
   *            a realtime AudioContext is created lazily on the first unlock().
   */
  constructor(ctx?: BaseAudioContext) {
    this.provided = ctx ?? null;
  }

  // ---------------------------------------------------------------------------
  // lifecycle

  unlock(): void {
    try {
      if (!this.ctx) {
        if (this.provided) {
          this.ctx = this.provided;
        } else {
          const Ctor = getAudioCtor();
          if (!Ctor) return;
          let c: AudioContext;
          try {
            c = new Ctor({ latencyHint: 'interactive' });
          } catch {
            c = new Ctor();
          }
          this.ctx = c;
        }
        const AC = getAudioCtor();
        this.realtime = !!AC && this.ctx instanceof AC;
        this.build();
      }
      const c = this.ctx;
      if (this.realtime && c && c.state !== 'running') {
        void (c as AudioContext).resume().catch(() => undefined);
      }
      if (this.ready && this.musicWanted && this.music && !this.music.isRunning) this.startMusicNow();
      if (this.ready) this.reconcileLoops(true);
    } catch {
      /* never throw from audio */
    }
  }

  private build(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.nb = makeNoiseBank(ctx);

    const pre = gainNode(ctx, 1);
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -16;
    glue.knee.value = 12;
    glue.ratio.value = 2.5;
    glue.attack.value = 0.006;
    glue.release.value = 0.25;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.12;
    const master = gainNode(ctx, 0);
    const dcBlock = ctx.createBiquadFilter();
    dcBlock.type = 'highpass';
    dcBlock.frequency.value = 28;
    dcBlock.Q.value = 0.6;
    pre.connect(dcBlock).connect(glue).connect(lim).connect(master).connect(ctx.destination);
    this.masterGain = master;

    const conv = ctx.createConvolver();
    conv.normalize = false;
    conv.buffer = makeRoomIR(ctx);
    const ret = gainNode(ctx, 1);
    conv.connect(ret).connect(pre);

    this.sfxIn = gainNode(ctx, 1);
    this.sfxGain = gainNode(ctx, 0);
    this.sfxIn.connect(this.sfxGain).connect(pre);
    this.sfxWetIn = gainNode(ctx, 1);
    this.sfxWetGain = gainNode(ctx, 0);
    this.sfxWetIn.connect(this.sfxWetGain).connect(conv);

    this.musicIn = gainNode(ctx, 1);
    this.musicDuck = gainNode(ctx, 1);
    this.musicGain = gainNode(ctx, 0);
    this.musicIn.connect(this.musicDuck).connect(this.musicGain).connect(pre);
    this.musicWetIn = gainNode(ctx, 1);
    this.musicWetGain = gainNode(ctx, 0);
    this.musicWetIn.connect(this.musicWetGain).connect(conv);

    this.music = new Music(ctx, this.musicIn, this.musicWetIn, this.nb);
    this.music.setTheme(this.theme);
    this.music.setIntensity(this.musicIntensity);
    this.ready = true;
    this.tokenT = this.now();
    this.applyVolumes(true);
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime + this.timeOffset : 0;
  }

  /** Start time for newly scheduled sounds (tiny lookahead in realtime avoids late-start clicks). */
  private startTime(): number {
    return this.now() + (this.realtime ? 0.008 : 0);
  }

  private later(fn: () => void, sec: number): void {
    if (!this.realtime || typeof setTimeout === 'undefined') return;
    setTimeout(() => { try { fn(); } catch { /* ignore */ } }, Math.max(0, sec * 1000));
  }

  // ---------------------------------------------------------------------------
  // volume

  setVolumes(v: Volumes): void {
    try {
      this.volumes = {
        master: clamp(finite(v?.master, this.volumes.master), 0, 1),
        sfx: clamp(finite(v?.sfx, this.volumes.sfx), 0, 1),
        music: clamp(finite(v?.music, this.volumes.music), 0, 1),
      };
      this.applyVolumes(false);
    } catch { /* ignore */ }
  }

  setMuted(muted: boolean): void {
    try {
      this.muted = !!muted;
      this.applyVolumes(false);
    } catch { /* ignore */ }
  }

  private applyVolumes(immediate: boolean): void {
    if (!this.ready || !this.ctx) return;
    const t = this.ctx.currentTime;
    // perceptual (squared) taper: slider 0.5 ~ -12 dB
    const m = this.muted ? 0 : this.volumes.master * this.volumes.master * 0.9;
    const s = this.volumes.sfx * this.volumes.sfx;
    const mu = this.volumes.music * this.volumes.music;
    const set = (g: GainNode | null, v: number): void => {
      if (!g) return;
      if (immediate) g.gain.setValueAtTime(v, t);
      else g.gain.setTargetAtTime(v, t, 0.04);
    };
    set(this.masterGain, m);
    set(this.sfxGain, s);
    set(this.sfxWetGain, s * 0.5);
    set(this.musicGain, mu * 0.55);
    set(this.musicWetGain, mu * 0.55 * 0.6);
  }

  // ---------------------------------------------------------------------------
  // one-shots

  private pruneVoices(now: number): void {
    if (this.voices.length === 0) return;
    this.voices = this.voices.filter((v) => v.end > now);
  }

  /** Reserve a voice slot; returns false when the sound should be dropped. */
  private admit(prio: number, impact: boolean, now: number): boolean {
    this.pruneVoices(now);
    if (impact) {
      let n = 0;
      for (const v of this.voices) if (v.impact) n++;
      if (n >= MAX_IMPACT_VOICES) return false;
    }
    if (this.voices.length < MAX_VOICES) return true;
    if (prio === 0) return false;
    // steal the oldest voice of lower priority
    let victim = -1;
    for (let i = 0; i < this.voices.length; i++) {
      if (this.voices[i].prio < prio) { victim = i; break; }
    }
    if (victim < 0) return false;
    const v = this.voices[victim];
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setTargetAtTime(0, Math.max(now, this.ctx ? this.ctx.currentTime : now), 0.012);
    } catch { /* ignore */ }
    this.voices.splice(victim, 1);
    return true;
  }

  private makeVoice(gain: number, pan: number, wet: number): { node: GainNode; ctx: BaseAudioContext } | null {
    const ctx = this.ctx;
    if (!ctx || !this.sfxIn || !this.sfxWetIn) return null;
    const g = gainNode(ctx, gain);
    let tail: AudioNode = g;
    if (typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p);
      tail = p;
    }
    tail.connect(this.sfxIn);
    if (wet > 0) {
      const w = gainNode(ctx, wet);
      tail.connect(w).connect(this.sfxWetIn);
    }
    return { node: g, ctx };
  }

  play(name: SfxName, opts?: { vol?: number; pan?: number; pitch?: number }): void {
    try {
      if (!this.ready || !this.ctx || !this.nb || typeof name !== 'string') return;
      // unknown names (e.g. sounds a newer part asks for) are ignored
      if (!Object.prototype.hasOwnProperty.call(SPEC, name)) return;
      const spec = SPEC[name];
      const recipe = RECIPES[name];
      if (!spec || !recipe) return;
      const now = this.now();
      const vol = clamp(finite(opts?.vol, 1), 0, 1.5);
      if (vol <= 0.001) return;
      const last = this.lastPlay.get(name);
      if (last !== undefined && now - last < spec.gap) return;

      // repetition ducking: the more often a sound fires, the quieter each instance
      const r = this.recent.get(name);
      const c = r ? r.c * Math.exp(-(now - r.t) / 0.6) : 0;
      this.recent.set(name, { c: c + 1, t: now });
      const duck = Math.max(0.3, 1 / (1 + 0.35 * c));
      if (!this.admit(spec.prio, false, now)) return;
      this.lastPlay.set(name, now);

      const density = 1 / (1 + Math.max(0, this.voices.length - 6) * 0.06);
      const pitch = clamp(finite(opts?.pitch, 1), 0.25, 4) * (1 + (Math.random() * 2 - 1) * spec.jit);
      const pan = clamp(finite(opts?.pan, 0), -1, 1);
      const voice = this.makeVoice(spec.g * vol * duck * density, pan * 0.8, spec.wet);
      if (!voice) return;
      const t = this.startTime();
      const v: Voice = { ctx: voice.ctx, out: voice.node, t, p: pitch, nb: this.nb, theme: this.theme };
      const dur = recipe(v);
      this.voices.push({ end: t + dur, gain: voice.node, prio: spec.prio, impact: false });
      this.later(() => voice.node.disconnect(), dur + 0.3);

      if (name === 'success' || name === 'goal' || name === 'secret') this.duckMusic(t, name === 'goal' ? 2.4 : name === 'secret' ? 1.3 : 1.6);
    } catch { /* never throw */ }
  }

  private duckMusic(t: number, len: number): void {
    const d = this.musicDuck;
    if (!d) return;
    d.gain.cancelScheduledValues(t);
    d.gain.setTargetAtTime(0.45, t, 0.05);
    d.gain.setTargetAtTime(1, t + len, 0.5);
  }

  /**
   * A collision. `kindA`/`kindB` optionally say what each body is ('domino', 'heavy', 'ball',
   * 'floor'), which picks a domino clack or a bowling-ball thud over the plain material sound.
   */
  impact(matA: string, matB: string, intensity: number, pan: number, kindA?: string, kindB?: string): void {
    try {
      if (!this.ready || !this.ctx || !this.nb) return;
      const I = finite(intensity, 0);
      if (I < 1.2) return;
      const now = this.now();
      // token bucket
      this.tokens = Math.min(IMPACT_BURST, this.tokens + (now - this.tokenT) * IMPACT_RATE);
      this.tokenT = now;
      const e = clamp(Math.log(I / 1.2) / Math.log(25 / 1.2), 0, 1);
      if (this.tokens < 1) {
        // still let a genuinely violent hit through occasionally
        if (!(e > 0.75 && this.tokens > -2)) return;
      }
      const a = normMaterial(String(matA));
      const b = normMaterial(String(matB));
      const ka = normKind(kindA);
      const kb = normKind(kindB);
      const ia = a + ka;
      const ib = b + kb;
      const key = ia < ib ? ia + '|' + ib : ib + '|' + ia;
      const lastPair = this.pairLast.get(key);
      if (lastPair !== undefined && now - lastPair < 0.05) return;
      if (!this.admit(0, true, now)) return;
      this.tokens -= 1;
      this.pairLast.set(key, now);
      if (this.pairLast.size > 64) this.pairLast.clear();

      const r = this.recent.get('impact');
      const c = r ? r.c * Math.exp(-(now - r.t) / 0.4) : 0;
      this.recent.set('impact', { c: c + 1, t: now });
      const duck = Math.max(0.35, 1 / (1 + 0.15 * c));

      const vol = (0.08 + 0.92 * Math.pow(e, 1.4)) * duck * 0.85;
      const voice = this.makeVoice(vol, clamp(finite(pan, 0), -1, 1) * 0.8, 0.06);
      if (!voice) return;
      const t = this.startTime();
      const v: Voice = { ctx: voice.ctx, out: voice.node, t, p: 1, nb: this.nb };
      const dur = this.impactLayers(v, a, ka, b, kb, e);
      this.voices.push({ end: t + dur, gain: voice.node, prio: 0, impact: true });
      this.later(() => voice.node.disconnect(), dur + 0.3);
    } catch { /* never throw */ }
  }

  private impactLayers(v: Voice, a: Material, ka: ImpactKind, b: Material, kb: ImpactKind, e: number): number {
    // a special body (domino, heavy ball) leads; the other side adds a quieter material layer
    const special = (k: ImpactKind): boolean => k === 'domino' || k === 'heavy' || k === 'pin';
    if (special(ka) || special(kb)) {
      const [ma, mka, mb, mkb] = special(ka) && (!special(kb) || ka === 'heavy') ? [a, ka, b, kb] : [b, kb, a, ka];
      let d = impactLayer(v, ma, e, 1, mka);
      if (mkb === 'domino' && mka === 'domino') return d; // domino on domino: just the clack
      d = Math.max(d, impactLayer(v, mb, e, mkb === 'floor' ? 0.35 : 0.5, mkb));
      return d;
    }
    if (a === b) return impactLayer(v, a, e, 1, ka || kb);
    return Math.max(impactLayer(v, a, e, 0.7, ka), impactLayer(v, b, e, 0.7, kb));
  }

  // ---------------------------------------------------------------------------
  // loops

  setLoop(id: string, name: LoopName, vol: number, pan?: number, rate?: number): void {
    try {
      const v = clamp(finite(vol, 0), 0, 1);
      let rec = this.loops.get(id);
      if (!rec) {
        if (v <= 0.001 || !LOOP_TRIM[name]) return;
        rec = { name, vol: v, pan: clamp(finite(pan, 0), -1, 1), rate: clamp(finite(rate, 1), 0.1, 4), v: null };
        this.loops.set(id, rec);
        if (this.ready) this.reconcileLoops(true);
        return;
      }
      if (rec.name !== name && LOOP_TRIM[name]) {
        this.releaseLoop(rec);
        rec.name = name;
      }
      rec.vol = v;
      rec.pan = clamp(finite(pan, rec.pan), -1, 1);
      rec.rate = clamp(finite(rate, rec.rate), 0.1, 4);
      if (v <= 0.001) {
        this.releaseLoop(rec);
        this.loops.delete(id);
        if (this.ready) this.reconcileLoops(true);
        return;
      }
      if (!this.ready) return;
      const now = this.now();
      if (now - this.lastReconcile > 0.25 || !rec.v) this.reconcileLoops(false);
      else this.applyLoop(rec, this.sameKindCount(rec.name));
    } catch { /* ignore */ }
  }

  stopLoop(id: string): void {
    try {
      const rec = this.loops.get(id);
      if (!rec) return;
      this.releaseLoop(rec);
      this.loops.delete(id);
      if (this.ready) this.reconcileLoops(true);
    } catch { /* ignore */ }
  }

  stopAllLoops(): void {
    try {
      for (const rec of this.loops.values()) this.releaseLoop(rec);
      this.loops.clear();
    } catch { /* ignore */ }
  }

  private sameKindCount(name: LoopName): number {
    let n = 0;
    for (const r of this.loops.values()) if (r.v && r.name === name) n++;
    return Math.max(1, n);
  }

  private reconcileLoops(_force: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.nb || !this.sfxIn) return;
    this.lastReconcile = this.now();
    const recs = Array.from(this.loops.values()).filter((r) => r.vol > 0.001);
    recs.sort((a, b) => b.vol - a.vol);
    const keep = new Set(recs.slice(0, MAX_LOOPS));
    for (const r of recs) if (!keep.has(r)) this.releaseLoop(r);
    const t = this.startTime();
    for (const r of keep) {
      if (!r.v) {
        const lv = buildLoop(ctx, r.name, this.nb, r.rate, t);
        let panner: StereoPannerNode | null = null;
        if (typeof ctx.createStereoPanner === 'function') {
          panner = ctx.createStereoPanner();
          panner.pan.value = r.pan * 0.8;
          lv.out.connect(panner).connect(this.sfxIn);
        } else {
          lv.out.connect(this.sfxIn);
        }
        r.v = { lv, panner, gain: -1, pan: r.pan, rate: r.rate };
      }
    }
    const counts = new Map<LoopName, number>();
    for (const r of keep) counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
    for (const r of keep) this.applyLoop(r, counts.get(r.name) ?? 1);
  }

  private applyLoop(r: LoopRec, sameKind: number): void {
    const ctx = this.ctx;
    if (!ctx || !r.v) return;
    const t = ctx.currentTime;
    // many identical machines should not add up linearly
    const target = Math.pow(r.vol, 1.3) * LOOP_TRIM[r.name] / Math.sqrt(sameKind);
    if (Math.abs(target - r.v.gain) > 0.005) {
      r.v.lv.out.gain.setTargetAtTime(target, t, r.v.gain < 0 ? 0.06 : 0.05);
      r.v.gain = target;
    }
    if (r.v.panner && Math.abs(r.pan - r.v.pan) > 0.02) {
      r.v.panner.pan.setTargetAtTime(r.pan * 0.8, t, 0.05);
      r.v.pan = r.pan;
    }
    if (Math.abs(r.rate - r.v.rate) > 0.01) {
      r.v.lv.setRate(r.rate, t);
      r.v.rate = r.rate;
    }
  }

  private releaseLoop(r: LoopRec): void {
    const ctx = this.ctx;
    if (!ctx || !r.v) { r.v = null; return; }
    const v = r.v;
    r.v = null;
    const t = ctx.currentTime;
    const g = v.lv.out.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, 0.07);
    v.lv.stop(t + 0.6);
    this.later(() => {
      v.lv.out.disconnect();
      v.panner?.disconnect();
    }, 0.8);
  }

  // ---------------------------------------------------------------------------
  // music

  startMusic(): void {
    try {
      this.musicWanted = true;
      if (this.ready) this.startMusicNow();
    } catch { /* ignore */ }
  }

  private startMusicNow(): void {
    if (!this.music || this.music.isRunning) return;
    this.music.setIntensity(this.musicIntensity);
    this.music.start();
    if (this.realtime && this.musicTimer === null && typeof setInterval !== 'undefined') {
      const tick = (): void => {
        try {
          if (this.ctx && this.music) this.music.scheduleUntil(this.ctx.currentTime + 0.5);
        } catch { /* ignore */ }
      };
      tick();
      this.musicTimer = setInterval(tick, 100);
    }
  }

  stopMusic(): void {
    try {
      this.musicWanted = false;
      this.music?.stop();
      if (this.musicTimer !== null) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    } catch { /* ignore */ }
  }

  /**
   * Crossfade the generative music to the style for a theme ('retro', 'stone', 'steam', 'modern',
   * 'comic', 'future', 'arcade'; unknown ids fall back to 'modern'). Also picks the themed stingers.
   * Safe to call before unlock(): the choice is remembered.
   */
  setMusicTheme(id: string): void {
    try {
      this.theme = normTheme(id);
      this.music?.setTheme(this.theme);
    } catch { /* ignore */ }
  }

  get musicTheme(): MusicTheme {
    return this.theme;
  }

  /** Diagnostics: current music voices, tempo, live players and limiter drops. */
  get musicStats(): { voices: number; bpm: number; players: number; dropped: number } {
    return this.music ? this.music.stats : { voices: 0, bpm: 0, players: 0, dropped: 0 };
  }

  setMusicIntensity(x: number): void {
    try {
      this.musicIntensity = clamp(finite(x, 0), 0, 1);
      this.music?.setIntensity(this.musicIntensity);
    } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // rewind scrub

  setScrub(speed: number): void {
    try {
      const ctx = this.ctx;
      if (!this.ready || !ctx || !this.nb || !this.sfxIn) return;
      const s = clamp(finite(speed, 0), -4, 4);
      const t = ctx.currentTime;
      if (Math.abs(s) < 0.05) {
        if (this.scrub) this.fadeScrub(this.scrub, t);
        this.scrub = null;
        return;
      }
      const dir = s < 0 ? -1 : 1;
      if (!this.scrub || this.scrub.dir !== dir) {
        if (this.scrub) this.fadeScrub(this.scrub, t);
        const src = ctx.createBufferSource();
        src.buffer = dir < 0 ? this.nb.tapeRev : this.nb.tape;
        src.loop = true;
        src.playbackRate.value = 0.5;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.5;
        const lg = gainNode(ctx, 35);
        lfo.connect(lg).connect(src.detune);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1200;
        lp.Q.value = 0.8;
        const g = gainNode(ctx, 0);
        src.connect(lp).connect(g).connect(this.sfxIn);
        src.start(t, Math.random() * (src.buffer?.duration ?? 1));
        lfo.start(t);
        this.scrub = { src, lp, g, lfo, dir };
      }
      const a = Math.abs(s);
      const sc = this.scrub;
      sc.src.playbackRate.setTargetAtTime(clamp(0.35 + a * 0.55, 0.3, 2.6), t, 0.05);
      sc.lp.frequency.setTargetAtTime(900 + a * 550, t, 0.05);
      sc.g.gain.setTargetAtTime(0.2 * Math.min(1, 0.45 + a * 0.25), t, 0.04);
    } catch { /* ignore */ }
  }

  private fadeScrub(sc: ScrubVoice, t: number): void {
    sc.g.gain.cancelScheduledValues(t);
    sc.g.gain.setTargetAtTime(0, t, 0.04);
    try { sc.src.stop(t + 0.3); sc.lfo.stop(t + 0.3); } catch { /* ignore */ }
    this.later(() => sc.g.disconnect(), 0.5);
  }

  // ---------------------------------------------------------------------------
  // offline rendering / testing hooks (not needed by game code)

  /** For OfflineAudioContext rendering: treat "now" as `sec` when scheduling sounds. */
  setOfflineTimeOffset(sec: number): void {
    if (!this.realtime) this.timeOffset = Math.max(0, finite(sec, 0));
  }

  /** For OfflineAudioContext rendering: schedule music notes up to now + `seconds`. */
  renderMusicAhead(seconds: number): void {
    if (this.music && this.ctx) this.music.scheduleUntil(this.now() + seconds);
  }

  /** The underlying context, if created (for debugging / advanced use). */
  get context(): BaseAudioContext | null {
    return this.ctx;
  }
}
