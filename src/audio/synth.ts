// Low-level procedural synthesis helpers shared by sfx, loops and music.
// Everything here is pure Web Audio: no files, no external assets.

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** Small deterministic PRNG (mulberry32) so buffers are reproducible. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface NoiseBank {
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
  /** Sparse vinyl/fire crackle (mostly silence with small pops). */
  crackle: AudioBuffer;
  /** Conveyor clack pattern: 1s, 6 evenly spaced roller clacks. Loop with playbackRate. */
  clacks: AudioBuffer;
  /** Garbled tape content used by the rewind scrub, forward and reversed. */
  tape: AudioBuffer;
  tapeRev: AudioBuffer;
  /** Electrical crackle bursts for 'zap' (3 variants). */
  zaps: AudioBuffer[];
}

/**
 * Builds a loop-safe mono buffer: generates `len + fade` samples, then crossfades the
 * overflow into the head so sample[len-1] -> sample[0] is continuous. DC removed, peak normalised.
 */
function loopBuffer(ctx: BaseAudioContext, seconds: number, gen: (i: number) => number, peak = 0.95): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(seconds * sr));
  const fade = Math.min(Math.floor(0.05 * sr), Math.floor(len / 4));
  const raw = new Float32Array(len + fade);
  for (let i = 0; i < raw.length; i++) raw[i] = gen(i);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = raw[i];
  for (let i = 0; i < fade; i++) {
    const w = i / fade; // 0 at head -> 1 after fade
    out[i] = raw[i] * w + raw[len + i] * (1 - w);
  }
  let mean = 0;
  for (let i = 0; i < len; i++) mean += out[i];
  mean /= len;
  let mx = 1e-9;
  for (let i = 0; i < len; i++) {
    out[i] -= mean;
    const a = Math.abs(out[i]);
    if (a > mx) mx = a;
  }
  const k = peak / mx;
  for (let i = 0; i < len; i++) out[i] *= k;
  const buf = ctx.createBuffer(1, len, sr);
  buf.getChannelData(0).set(out);
  return buf;
}

export function makeNoiseBank(ctx: BaseAudioContext): NoiseBank {
  const rng = makeRng(0xf011);
  const sr = ctx.sampleRate;
  const white = loopBuffer(ctx, 2, () => rng() * 2 - 1);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  const pink = loopBuffer(ctx, 2, () => {
    const w = rng() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    const v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    return v;
  });

  let br = 0;
  const brown = loopBuffer(ctx, 2, () => {
    br = (br + 0.02 * (rng() * 2 - 1)) / 1.02;
    return br;
  });

  // Crackle: sparse decaying pops of random polarity, slightly low-passed.
  let pop = 0, popDecay = 0, lp = 0;
  const crackle = loopBuffer(ctx, 3, () => {
    if (rng() < 7 / sr) {
      pop = (rng() * 2 - 1) * (0.3 + 0.7 * rng() * rng());
      popDecay = Math.exp(-1 / (sr * (0.0002 + 0.0008 * rng())));
    }
    pop *= popDecay;
    lp += 0.5 * (pop - lp);
    return lp + (rng() * 2 - 1) * 0.004;
  }, 0.9);

  // Conveyor clacks: 6 per second, resonant 1.4-1.9 kHz pings + low thump.
  const clacks = (() => {
    const len = sr; // exactly 1 s so playbackRate maps to clack rate
    const data = new Float32Array(len);
    const n = 6;
    for (let c = 0; c < n; c++) {
      const start = Math.floor((c / n) * len);
      const f1 = 1400 + rng() * 500;
      const f2 = 180 + rng() * 40;
      const amp = 0.7 + rng() * 0.3;
      const dlen = Math.floor(0.05 * sr);
      for (let i = 0; i < dlen; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 140);
        const env2 = Math.exp(-t * 60);
        const idx = (start + i) % len;
        data[idx] += amp * (0.5 * Math.sin(2 * Math.PI * f1 * t) * env + 0.6 * Math.sin(2 * Math.PI * f2 * t) * env2 + (rng() * 2 - 1) * 0.25 * env);
      }
    }
    let mx = 1e-9;
    for (let i = 0; i < len; i++) mx = Math.max(mx, Math.abs(data[i]));
    for (let i = 0; i < len; i++) data[i] *= 0.9 / mx;
    const buf = ctx.createBuffer(1, len, sr);
    buf.getChannelData(0).set(data);
    return buf;
  })();

  // Tape: garbled "music" — overlapping pentatonic sine blips + low hiss.
  const tapeData = (() => {
    const len = Math.floor(2 * sr);
    const data = new Float32Array(len);
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19];
    for (let k = 0; k < 26; k++) {
      const f = midiToHz(60 + scale[Math.floor(rng() * scale.length)] + (rng() < 0.3 ? -12 : 0));
      const st = Math.floor(rng() * len);
      const dl = Math.floor((0.06 + rng() * 0.25) * sr);
      const amp = 0.2 + rng() * 0.3;
      for (let i = 0; i < dl; i++) {
        const t = i / sr;
        const env = Math.min(1, i / (0.004 * sr)) * Math.exp(-t * 9);
        data[(st + i) % len] += amp * env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t));
      }
    }
    let h = 0;
    for (let i = 0; i < len; i++) {
      h = 0.9 * h + 0.1 * (rng() * 2 - 1);
      data[i] += h * 0.25;
    }
    // loop-smooth: crossfade tail into head
    const fade = Math.floor(0.03 * sr);
    for (let i = 0; i < fade; i++) {
      const w = i / fade;
      data[i] = data[i] * w + data[len - fade + i] * (1 - w);
    }
    const trimmed = data.subarray(0, len - fade);
    let mx = 1e-9;
    for (let i = 0; i < trimmed.length; i++) mx = Math.max(mx, Math.abs(trimmed[i]));
    for (let i = 0; i < trimmed.length; i++) trimmed[i] *= 0.9 / mx;
    return new Float32Array(trimmed);
  })();
  const tape = ctx.createBuffer(1, tapeData.length, sr);
  tape.getChannelData(0).set(tapeData);
  const tapeRev = ctx.createBuffer(1, tapeData.length, sr);
  const rev = new Float32Array(tapeData.length);
  for (let i = 0; i < rev.length; i++) rev[i] = tapeData[rev.length - 1 - i];
  tapeRev.getChannelData(0).set(rev);

  // Zap bursts: 120 Hz buzz gated by random crackle, with spiky arcs.
  const zaps: AudioBuffer[] = [];
  for (let v = 0; v < 3; v++) {
    const len = Math.floor(0.38 * sr);
    const data = new Float32Array(len);
    let gate = 0, target = 1, hp = 0, prev = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      if (rng() < 90 / sr) target = rng() < 0.35 ? 0.1 : 0.5 + rng() * 0.5;
      gate += 0.004 * (target - gate);
      const buzz = Math.sign(Math.sin(2 * Math.PI * (118 + v * 7) * t)) * 0.35 + Math.sin(2 * Math.PI * 236 * t) * 0.2;
      let arc = 0;
      if (rng() < 0.02) arc = (rng() * 2 - 1) * 1.2;
      const w = rng() * 2 - 1;
      // crude high-pass on the hiss so it sizzles instead of rumbles
      hp = 0.6 * (hp + w - prev);
      prev = w;
      const env = Math.min(1, t / 0.004) * Math.exp(-t * 5.5);
      data[i] = env * (gate * (buzz + hp * 0.5) + arc);
    }
    let mx = 1e-9;
    for (let i = 0; i < len; i++) mx = Math.max(mx, Math.abs(data[i]));
    for (let i = 0; i < len; i++) data[i] *= 0.9 / mx;
    // fade last 10 ms
    const f = Math.floor(0.01 * sr);
    for (let i = 0; i < f; i++) data[len - 1 - i] *= i / f;
    const buf = ctx.createBuffer(1, len, sr);
    buf.getChannelData(0).set(data);
    zaps.push(buf);
  }

  return { white, pink, brown, crackle, clacks, tape, tapeRev, zaps };
}

/** Procedural small-room impulse response: early reflections + darkening exponential tail. */
export function makeRoomIR(ctx: BaseAudioContext, seconds = 1.1, t60 = 0.85): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(seconds * sr);
  const ir = ctx.createBuffer(2, len, sr);
  const rng = makeRng(0x2007);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    // early reflections (small workshop: 3-35 ms)
    const taps = [0.0037, 0.0071, 0.0113, 0.0168, 0.0219, 0.0291, 0.0347];
    for (let k = 0; k < taps.length; k++) {
      const idx = Math.floor((taps[k] + (ch ? 0.0011 * k : 0)) * sr);
      if (idx < len) d[idx] += (rng() < 0.5 ? -1 : 1) * 0.5 * Math.pow(0.82, k);
    }
    let lp = 0;
    const decay = Math.log(1000) / t60;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      // low-pass coefficient falls with time -> tail gets darker
      const a = 0.55 * Math.exp(-t * 3) + 0.08;
      lp += a * ((rng() * 2 - 1) - lp);
      const onset = Math.min(1, t / 0.012);
      d[i] += lp * Math.exp(-decay * t) * onset * 0.55;
    }
    // fade the very end
    const f = Math.floor(0.05 * sr);
    for (let i = 0; i < f; i++) d[len - 1 - i] *= i / f;
  }
  // normalise energy so the wet return sits at a predictable level
  let e = 0;
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) e += d[i] * d[i];
  }
  const k = 1 / Math.sqrt(e / 2);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] *= k * 0.6;
  }
  return ir;
}

// ---------------------------------------------------------------------------
// Node helpers

export function gainNode(ctx: BaseAudioContext, v: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

export function filterNode(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.707): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = clamp(freq, 10, ctx.sampleRate * 0.45);
  f.Q.value = q;
  return f;
}

/** Percussive envelope: linear attack to `peak`, exponential decay to -80 dB at t+attack+decay, then hard 0. */
export function perc(p: AudioParam, t: number, peak: number, attack: number, decay: number): number {
  const a = Math.max(0.0008, attack);
  const pk = Math.max(1e-5, peak);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(pk, t + a);
  p.exponentialRampToValueAtTime(pk * 1e-4, t + a + decay);
  p.setValueAtTime(0, t + a + decay + 0.001);
  return t + a + decay + 0.002;
}

/** Attack / hold / exponential release envelope. */
export function ahr(p: AudioParam, t: number, peak: number, attack: number, hold: number, release: number): number {
  const pk = Math.max(1e-5, peak);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(pk, t + Math.max(0.0008, attack));
  p.setValueAtTime(pk, t + attack + hold);
  p.exponentialRampToValueAtTime(pk * 1e-4, t + attack + hold + release);
  p.setValueAtTime(0, t + attack + hold + release + 0.001);
  return t + attack + hold + release + 0.002;
}

export function oscNode(ctx: BaseAudioContext, type: OscillatorType, freq: number, t: number, end: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(clamp(freq, 1, ctx.sampleRate * 0.45), t);
  o.start(t);
  o.stop(end + 0.01);
  return o;
}

export function noiseNode(ctx: BaseAudioContext, buf: AudioBuffer, t: number, end: number, rate = 1, offset = -1): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.playbackRate.value = rate;
  const off = offset >= 0 ? offset : Math.random() * buf.duration;
  s.start(t, off);
  s.stop(end + 0.01);
  return s;
}

/** Exponential frequency glide on a param (safe for positive targets). */
export function glide(p: AudioParam, t: number, from: number, to: number, dur: number): void {
  p.setValueAtTime(Math.max(1, from), t);
  p.exponentialRampToValueAtTime(Math.max(1, to), t + Math.max(0.001, dur));
}
