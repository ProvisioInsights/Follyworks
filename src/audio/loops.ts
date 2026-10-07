// Continuous machine loops (motor, fan, conveyor, rocket, flame, magnet).
// Each voice is a small node graph ending in `out` (a fade gain controlled by the engine).

import { NoiseBank, clamp, filterNode, gainNode } from './synth';

export type LoopKind = 'motor' | 'fan' | 'conveyor' | 'rocket' | 'flame' | 'magnet' | 'laserHum' | 'steam';

export interface LoopVoice {
  /** Fade/level gain; the engine drives this. */
  out: GainNode;
  setRate(rate: number, t: number): void;
  /** Stop all sources at time t (after the engine has faded `out`). */
  stop(t: number): void;
}

interface Builder {
  srcs: AudioScheduledSourceNode[];
  bufs: AudioBufferSourceNode[];
  rateHooks: ((r: number, t: number) => void)[];
}

function osc(ctx: BaseAudioContext, b: Builder, type: OscillatorType, f: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  b.srcs.push(o);
  return o;
}

function buf(ctx: BaseAudioContext, b: Builder, buffer: AudioBuffer, rate = 1): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = buffer;
  s.loop = true;
  s.playbackRate.value = rate;
  b.srcs.push(s);
  b.bufs.push(s);
  return s;
}

/** gain node whose gain = base + lfo*depth (amplitude modulation). */
function amNode(ctx: BaseAudioContext, b: Builder, rate: number, base: number, depth: number): { node: GainNode; lfo: OscillatorNode } {
  const node = gainNode(ctx, base);
  const lfo = osc(ctx, b, 'sine', rate);
  const d = gainNode(ctx, depth);
  lfo.connect(d).connect(node.gain);
  return { node, lfo };
}

export function buildLoop(ctx: BaseAudioContext, kind: LoopKind, nb: NoiseBank, rate0: number, t0: number): LoopVoice {
  const out = gainNode(ctx, 0);
  const b: Builder = { srcs: [], bufs: [], rateHooks: [] };
  const r0 = clamp(rate0, 0.1, 4);
  const smooth = 0.08;

  switch (kind) {
    case 'motor': {
      const level = gainNode(ctx, 0.11);
      const saw = osc(ctx, b, 'sawtooth', 95 * r0);
      const sub = osc(ctx, b, 'sine', 190 * r0);
      const sg = gainNode(ctx, 0.35);
      const lp = filterNode(ctx, 'lowpass', 1000, 1.4);
      const am = amNode(ctx, b, 7 * r0, 0.75, 0.25);
      saw.connect(lp);
      sub.connect(sg).connect(lp);
      lp.connect(am.node).connect(level);
      const hiss = buf(ctx, b, nb.white);
      const bp = filterNode(ctx, 'bandpass', 2600, 2);
      const hg = gainNode(ctx, 0.08);
      hiss.connect(bp).connect(hg).connect(am.node);
      level.connect(out);
      b.rateHooks.push((r, t) => {
        saw.frequency.setTargetAtTime(95 * r, t, smooth);
        sub.frequency.setTargetAtTime(190 * r, t, smooth);
        am.lfo.frequency.setTargetAtTime(7 * r, t, smooth);
        lp.frequency.setTargetAtTime(700 + 400 * r, t, smooth);
      });
      break;
    }
    case 'fan': {
      const level = gainNode(ctx, 0.2);
      const n = buf(ctx, b, nb.pink);
      const bp = filterNode(ctx, 'bandpass', 700, 0.6);
      const lp = filterNode(ctx, 'lowpass', 1800, 0.7);
      const am = amNode(ctx, b, 16 * r0, 0.75, 0.25);
      n.connect(bp).connect(lp).connect(am.node).connect(level);
      const whir = osc(ctx, b, 'sine', 140 * r0);
      const wg = gainNode(ctx, 0.08);
      whir.connect(wg).connect(level);
      level.connect(out);
      b.rateHooks.push((r, t) => {
        am.lfo.frequency.setTargetAtTime(16 * r, t, smooth);
        whir.frequency.setTargetAtTime(140 * r, t, smooth);
        bp.frequency.setTargetAtTime(500 + 200 * r, t, smooth);
      });
      break;
    }
    case 'conveyor': {
      const level = gainNode(ctx, 0.16);
      const cl = buf(ctx, b, nb.clacks, r0);
      const cg = gainNode(ctx, 0.45);
      cl.connect(cg).connect(level);
      const rum = buf(ctx, b, nb.brown);
      const lp = filterNode(ctx, 'lowpass', 260, 0.8);
      const rg = gainNode(ctx, 0.6);
      rum.connect(lp).connect(rg).connect(level);
      const hum = osc(ctx, b, 'triangle', 70 * r0);
      const hg = gainNode(ctx, 0.12);
      hum.connect(hg).connect(level);
      level.connect(out);
      b.rateHooks.push((r, t) => {
        cl.playbackRate.setTargetAtTime(r, t, smooth);
        hum.frequency.setTargetAtTime(70 * r, t, smooth);
      });
      break;
    }
    case 'rocket': {
      const level = gainNode(ctx, 0.22);
      const br = buf(ctx, b, nb.brown);
      const lp = filterNode(ctx, 'lowpass', 600 * r0, 0.9);
      const flick = osc(ctx, b, 'sine', 5.3);
      const fg = gainNode(ctx, 140);
      flick.connect(fg).connect(lp.frequency);
      br.connect(lp).connect(level);
      const wh = buf(ctx, b, nb.white);
      const bp = filterNode(ctx, 'bandpass', 1500, 0.8);
      const wg = gainNode(ctx, 0.07);
      wh.connect(bp).connect(wg).connect(level);
      const am = amNode(ctx, b, 11, 0.85, 0.15);
      level.connect(am.node).connect(out);
      b.rateHooks.push((r, t) => {
        lp.frequency.setTargetAtTime(400 + 300 * r, t, smooth);
        bp.frequency.setTargetAtTime(1100 + 500 * r, t, smooth);
      });
      break;
    }
    case 'flame': {
      const level = gainNode(ctx, 0.2);
      const n = buf(ctx, b, nb.pink);
      const bp = filterNode(ctx, 'bandpass', 420, 0.7);
      const ng = gainNode(ctx, 0.6);
      const am = amNode(ctx, b, 1.7, 0.8, 0.2);
      n.connect(bp).connect(ng).connect(am.node);
      const cr = buf(ctx, b, nb.crackle, r0);
      const hp = filterNode(ctx, 'highpass', 1100, 0.7);
      const cg = gainNode(ctx, 0.35);
      cr.connect(hp).connect(cg).connect(am.node);
      am.node.connect(level).connect(out);
      b.rateHooks.push((r, t) => {
        bp.frequency.setTargetAtTime(300 + 150 * r, t, smooth);
        cr.playbackRate.setTargetAtTime(clamp(r, 0.5, 2), t, smooth);
      });
      break;
    }
    case 'magnet': {
      const level = gainNode(ctx, 0.06);
      const parts: [number, number][] = [[1, 1], [2, 0.45], [3, 0.15]];
      const oscs: [OscillatorNode, number][] = [];
      const am = amNode(ctx, b, 0.8, 0.75, 0.25);
      for (const [m, a] of parts) {
        const o = osc(ctx, b, 'sine', 100 * m * r0);
        const g = gainNode(ctx, a);
        o.connect(g).connect(am.node);
        oscs.push([o, m]);
      }
      const sh1 = osc(ctx, b, 'sine', 1500);
      const sh2 = osc(ctx, b, 'sine', 1503.5);
      const shg = gainNode(ctx, 0.04);
      sh1.connect(shg);
      sh2.connect(shg);
      shg.connect(am.node);
      am.node.connect(level).connect(out);
      b.rateHooks.push((r, t) => {
        for (const [o, m] of oscs) o.frequency.setTargetAtTime(100 * m * r, t, smooth);
      });
      break;
    }
    case 'laserHum': {
      // mains-hum core with a slow beating pair and a faint high sizzle
      const level = gainNode(ctx, 0.07);
      const am = amNode(ctx, b, 0.6, 0.85, 0.15);
      const parts: [OscillatorNode, number][] = [];
      for (const [m, a, det] of [[1, 1, 0], [2, 0.5, 0.7], [2, 0.35, -0.6], [3, 0.12, 0]] as [number, number, number][]) {
        const o = osc(ctx, b, 'sine', 120 * m * r0 + det);
        const g = gainNode(ctx, a);
        o.connect(g).connect(am.node);
        parts.push([o, m]);
      }
      const hiss = buf(ctx, b, nb.white);
      const bp = filterNode(ctx, 'bandpass', 6200, 3);
      const hg = gainNode(ctx, 0.05);
      hiss.connect(bp).connect(hg).connect(am.node);
      am.node.connect(level).connect(out);
      b.rateHooks.push((r, t) => {
        for (const [o, m] of parts) o.frequency.setTargetAtTime(120 * m * r, t, smooth);
      });
      break;
    }
    case 'steam': {
      // a steady hiss with a flutter and a faint whistle riding on top
      const level = gainNode(ctx, 0.12);
      const am = amNode(ctx, b, 9 * r0, 0.85, 0.15);
      const n = buf(ctx, b, nb.white);
      const bp = filterNode(ctx, 'bandpass', 3200, 0.9);
      n.connect(bp).connect(am.node);
      const w = osc(ctx, b, 'sine', 1850 * r0);
      const wob = osc(ctx, b, 'sine', 5.5);
      const wg = gainNode(ctx, 18);
      wob.connect(wg).connect(w.frequency);
      const g = gainNode(ctx, 0.05);
      w.connect(g).connect(am.node);
      am.node.connect(level).connect(out);
      b.rateHooks.push((r, t) => {
        w.frequency.setTargetAtTime(1850 * r, t, smooth);
        am.lfo.frequency.setTargetAtTime(9 * r, t, smooth);
      });
      break;
    }
  }

  for (const s of b.srcs) {
    if (b.bufs.includes(s as AudioBufferSourceNode)) {
      const bs = s as AudioBufferSourceNode;
      bs.start(t0, Math.random() * (bs.buffer ? bs.buffer.duration : 0));
    } else s.start(t0);
  }
  let stopped = false;
  return {
    out,
    setRate(r: number, t: number) {
      const rr = clamp(r, 0.1, 4);
      for (const h of b.rateHooks) h(rr, t);
    },
    stop(t: number) {
      if (stopped) return;
      stopped = true;
      for (const s of b.srcs) {
        try { s.stop(t); } catch { /* already stopped */ }
      }
    },
  };
}
