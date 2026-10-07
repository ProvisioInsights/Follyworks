// Run mode: a fresh Simulation stepped at a fixed 60 Hz with an accumulator, plus slow motion,
// pause, single-frame step, timeline scrubbing / hold-to-rewind, ghost trails and translation of
// simulation events into sound and visual effects.

import type { AudioEngine, LoopName, SfxName } from '../audio/AudioEngine';
import type { BuildDef, LevelDef, Vec } from '../core/types';
import { History } from '../sim/history';
import { STEP_MS } from '../sim/matter';
import { Simulation } from '../sim/Simulation';
import type { WorkshopScene } from '../render/WorkshopScene';
import { scoreAttempt, type AttemptResult } from './scoring';

const STEP = STEP_MS / 1000;
const MAX_STEPS_PER_FRAME = 8;

const LOOP_FOR: Record<string, LoopName> = {
  motor: 'motor',
  fan: 'fan',
  conveyor: 'conveyor',
  rocket: 'rocket',
  candle: 'flame',
  magnet: 'magnet',
  laser: 'laserHum',
  teapot: 'steam',
};

export interface RunCallbacks {
  onSolved(result: AttemptResult): void;
  onTimeUp(): void;
  /** Everything stopped moving without solving the level (fired once per run). */
  onSettled?(): void;
  onTick(): void;
}

export class RunController {
  sim: Simulation;
  private level: LevelDef;
  private build: BuildDef;
  /** Set when the sim was restored from a snapshot; see resync(). */
  private needsResync = false;
  readonly history = new History(2, 2700);
  speed = 1;
  paused = false;
  scrubbing = false;
  rewinding = false;
  timedOut = false;
  private stillTicks = 0;
  private settledReported = false;
  solvedResult: AttemptResult | null = null;
  private solvedReported = false;
  private solvedWallClock = 0;
  private acc = 0;
  private scene: WorkshopScene;
  private audio: AudioEngine | null;
  private cb: RunCallbacks;
  timeLimit: number;
  /** Positions of moving player/level parts, for ghost trails after reset. */
  readonly trails = new Map<string, Vec[]>();
  private loopIds = new Set<string>();
  private scrubIndex = -1;
  private lastScrubTick = -1;
  private goalRegionCenter: Vec | null = null;

  constructor(scene: WorkshopScene, level: LevelDef, build: BuildDef, audio: AudioEngine | null, cb: RunCallbacks) {
    this.scene = scene;
    this.audio = audio;
    this.cb = cb;
    this.level = level;
    this.build = build;
    this.sim = new Simulation(level, build, { lenient: true });
    this.sim.capturePrev();
    this.history.record(this.sim, true);
    this.timeLimit = level.restrictions?.timeLimit ?? (level.goals.length ? 30 : Infinity);
    const region = level.goals.find((g) => g.kind === 'enterRegion') as any;
    if (region) this.goalRegionCenter = { x: region.region.x + region.region.w / 2, y: region.region.y + region.region.h / 2 };
    scene.setSim(this.sim);
    scene.running = true;
    scene.renderTime = 0;
    for (const w of this.sim.warnings) console.warn('[sim]', w);
  }

  get time() {
    return this.sim.time;
  }
  get maxTick() {
    return this.history.last?.tick ?? 0;
  }
  get minTick() {
    return this.history.first?.tick ?? 0;
  }
  get atLiveEdge() {
    return this.sim.tick >= this.maxTick;
  }

  update(dt: number) {
    let steps = 0;
    if (this.rewinding) {
      this.stepBack(3);
      this.scene.renderAlpha = 1;
    } else if (!this.paused && !this.scrubbing && !this.timedOut) {
      this.acc += dt * this.speed;
      while (this.acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
        this.advance();
        this.acc -= STEP;
        steps++;
        if (this.timedOut) break;
      }
      if (steps >= MAX_STEPS_PER_FRAME) this.acc = Math.min(this.acc, STEP);
      this.scene.renderAlpha = Math.min(1, this.acc / STEP);
    } else {
      this.scene.renderAlpha = 1;
    }
    this.scene.renderTime = this.sim.time + (this.scene.renderAlpha - 1) * STEP;
    this.updateLoops();
    if (this.solvedResult && !this.solvedReported && performance.now() - this.solvedWallClock > 1300) {
      this.solvedReported = true;
      this.cb.onSolved(this.solvedResult);
    }
    if (steps) this.cb.onTick();
  }

  /** One simulation tick, with all side effects (history, trails, events). */
  private advance() {
    if (this.needsResync) this.resync();
    // stepping from a rewound point discards the abandoned future
    if (!this.atLiveEdge) {
      const i = this.history.indexAtOrBefore(this.sim.tick);
      this.history.truncateAfter(i);
    }
    this.sim.step();
    this.history.record(this.sim);
    if (this.sim.tick % 4 === 0) this.recordTrails();
    this.flushEvents(true);
    if (this.sim.goals.solved && !this.solvedResult) {
      this.solvedResult = scoreAttempt(this.sim.level, this.sim.goals.solvedAt, this.sim.placedParts, this.sim.chain);
      this.solvedWallClock = performance.now();
      this.audio?.play('goal');
      const c = this.goalRegionCenter ?? { x: this.sim.bounds.w / 2, y: this.sim.bounds.h * 0.4 };
      this.scene.fx.burst('confetti', c.x, c.y, 0, 0, 1);
    }
    if (!this.solvedResult && !this.timedOut && !this.settledReported && this.sim.level.goals.length) {
      this.stillTicks = this.sim.isStill() ? this.stillTicks + 1 : 0;
      if (this.stillTicks >= 120 && this.sim.time > 1.5) {
        this.settledReported = true;
        this.cb.onSettled?.();
      }
    }
    if (!this.solvedResult && this.sim.time >= this.timeLimit && !this.timedOut) {
      this.timedOut = true;
      this.audio?.play('error', { vol: 0.5, pitch: 0.8 });
      this.cb.onTimeUp();
    }
  }

  private flushEvents(withAudio: boolean) {
    const sim = this.sim;
    const audio = withAudio ? this.audio : null;
    for (const ev of sim.events) {
      this.scene.handleEvent(ev);
      if (!audio) continue;
      switch (ev.t) {
        case 'impact':
          audio.impact(ev.matA, ev.matB, ev.speed, this.pan(ev.x), ev.kindA, ev.kindB);
          break;
        case 'sfx':
          audio.play(ev.name as SfxName, { vol: ev.vol, pan: this.pan(ev.x), pitch: ev.pitch });
          break;
        case 'goal':
          audio.play('ding');
          break;
        case 'activate':
          audio.play('tick', { vol: 0.35, pitch: 1 + Math.min(1, sim.chain.length * 0.04) });
          break;
        default:
          break;
      }
    }
    sim.events.length = 0;
  }

  private pan(x: number) {
    const cam = this.scene.cameras.main;
    const half = cam.worldView.width / 2 || 800;
    return Math.max(-1, Math.min(1, (x - cam.worldView.centerX) / half)) * 0.8;
  }

  private recordTrails() {
    for (const e of this.sim.list) {
      if (!e.alive || !e.body || e.body.isStatic || e.origin === 'fixed') continue;
      const p = e.body.position;
      let tr = this.trails.get(e.id);
      if (!tr) this.trails.set(e.id, (tr = []));
      const last = tr[tr.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 6) {
        if (tr.length < 500) tr.push({ x: p.x, y: p.y });
      }
    }
  }

  private updateLoops() {
    const audio = this.audio;
    if (!audio) return;
    const quiet = this.paused || this.scrubbing || this.rewinding || this.timedOut;
    const live = new Set<string>();
    if (!quiet) {
      for (const e of this.sim.list) {
        const loop = LOOP_FOR[e.type];
        if (!loop || !e.alive || !e.isActive()) continue;
        const pos = e.body?.position ?? { x: e.x, y: e.y };
        let rate = this.speed;
        if (e.type === 'motor') rate *= 0.6 + e.num('rpm') / 120;
        if (e.type === 'conveyor') rate *= 0.6 + Math.abs(e.num('speed')) / 200;
        audio.setLoop(e.id, loop, 0.8, this.pan(pos.x), Math.max(0.1, rate));
        live.add(e.id);
      }
    }
    for (const id of this.loopIds) if (!live.has(id)) audio.stopLoop(id);
    this.loopIds = live;
  }

  // ------------------------------------------------------------------ transport

  setPaused(p: boolean) {
    this.paused = p;
    this.acc = 0;
  }

  stepOnce() {
    if (this.timedOut || this.solvedReported) return;
    this.paused = true;
    this.advance();
    this.scene.renderAlpha = 1;
    this.cb.onTick();
  }

  /**
   * Snapshots are perfect for showing any moment of the run, but Matter keeps solver state
   * (warm-started contact impulses, position corrections) that a snapshot cannot carry, so a run
   * resumed from a restored snapshot slowly diverges from the original. Before simulating forward
   * from a rewound point we therefore rebuild the sim from scratch and fast-forward it to the same
   * tick: runs are deterministic, so this lands in exactly the state the original run had.
   */
  private resync() {
    this.needsResync = false;
    const target = this.sim.tick;
    this.stillTicks = 0;
    const fresh = new Simulation(this.level, this.build, { lenient: true });
    while (fresh.tick < target) fresh.step();
    fresh.events.length = 0;
    fresh.capturePrev();
    this.sim = fresh;
    this.scene.setSim(fresh);
  }

  /** Jump to a tick (timeline drag). */
  scrubTo(tick: number) {
    const i = this.history.indexAtOrBefore(tick);
    if (i < 0) return;
    const snap = this.history.at(i);
    if (snap.tick === this.lastScrubTick) return;
    const dir = Math.sign(snap.tick - this.sim.tick);
    this.sim.restore(snap);
    this.needsResync = true;
    this.sim.capturePrev();
    this.sim.events.length = 0;
    this.scrubIndex = i;
    this.lastScrubTick = snap.tick;
    this.audio?.setScrub(dir * 1.5);
    if (snap.tick < this.timeLimit * 60) this.timedOut = false;
    this.cb.onTick();
  }

  beginScrub() {
    this.scrubbing = true;
    this.lastScrubTick = -1;
  }

  endScrub() {
    this.scrubbing = false;
    this.audio?.setScrub(0);
    this.acc = 0;
  }

  /** Hold-to-rewind: move back n snapshots per frame. */
  private stepBack(n: number) {
    const i = this.history.indexAtOrBefore(this.sim.tick - 1);
    const target = Math.max(0, i - (n - 1));
    const snap = this.history.at(target);
    if (!snap || snap.tick >= this.sim.tick) {
      this.audio?.setScrub(0);
      return;
    }
    this.sim.restore(snap);
    this.needsResync = true;
    this.sim.capturePrev();
    this.sim.events.length = 0;
    this.timedOut = false;
    this.audio?.setScrub(-2);
    this.cb.onTick();
  }

  setRewinding(on: boolean) {
    if (this.rewinding === on) return;
    this.rewinding = on;
    if (on) this.audio?.play('rewind', { vol: 0.6 });
    else {
      this.audio?.setScrub(0);
      this.paused = true;
    }
  }

  /** Allow the run to continue past the time limit after the player dismisses the notice. */
  extendTime() {
    this.timeLimit = this.sim.time + 30;
    this.timedOut = false;
  }

  dispose() {
    this.audio?.stopAllLoops();
    this.audio?.setScrub(0);
    this.scene.running = false;
    this.scene.renderAlpha = 1;
  }

  /** Trails as polylines (for build-mode ghost display). */
  trailLines(): Vec[][] {
    return [...this.trails.values()].filter((t) => t.length > 2);
  }
}
