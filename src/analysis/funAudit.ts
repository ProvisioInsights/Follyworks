// Fun audit: measurable stand-ins for "is this puzzle fun?", computed headlessly from a level and
// its reference build. Fun itself can't be read off a simulation, but the things players of this
// genre consistently enjoy or hate can be:
//
//   spectacle   how much visibly happens (chain stages, kinds of physics involved)
//   pacing      how soon the machine does something, and the longest stretch where nothing new does
//   agency      how much of the chain only happens because of what the player placed
//   forgiveness whether a good idea placed roughly still works (no pixel hunting)
//   near misses whether a wrong build gets partway, so failure reads as "almost" instead of "nothing"
//
// Player-side measures (retries, quitting, voluntary replays, ratings) come from real play; see
// telemetry/playtest.ts. DECISIONS.md explains the thresholds.

import type { BuildDef, LevelDef, ObjectDef } from '../core/types';
import { getComponent } from '../components';
import { DRAG_ROT_STEP } from '../game/manipulation';
import { invalidPlacements } from '../game/placement';
import { uniqueChain } from '../game/scoring';
import { Simulation, type ChainEntry } from '../sim/Simulation';

export interface RunTrace {
  solved: boolean;
  solvedAt: number | null;
  /** Unique chain stages in order, cut at the solve when there is one. */
  chain: ChainEntry[];
  /** Simulated seconds until the run solved, stalled, or hit the limit. */
  endedAt: number;
}

/** How long everything has to be still before a run counts as over (matches the in-game banner). */
const STILL_SECONDS = 2;

export const traceRun = (level: LevelDef, build: BuildDef, limit = level.restrictions?.timeLimit ?? 30): RunTrace => {
  const sim = new Simulation(level, build);
  const ticks = Math.round(limit * 60);
  let still = 0;
  let i = 0;
  for (; i < ticks; i++) {
    sim.step();
    if (sim.goals.solved) break;
    still = sim.isStill() ? still + 1 : 0;
    if (still >= STILL_SECONDS * 60) break;
    if (sim.events.length > 500) sim.events.length = 0;
  }
  const solvedAt = sim.goals.solved ? sim.time : null;
  const chain = uniqueChain(sim.chain).filter((c) => solvedAt === null || c.time <= solvedAt + 0.001);
  return { solved: solvedAt !== null, solvedAt, chain, endedAt: sim.time };
};

// ------------------------------------------------------------------ seeded randomness

export const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
};
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

/** The editor's default snapping: 10 px grid, and drag-turning in 5° steps (or the part's own step). */
export const GRID = 10;
const stepOf = (type: string) => getComponent(type)?.rotationStep ?? DRAG_ROT_STEP;
/** Sizes snap too (a plank's length goes in 10 cm steps); `down` rounds them down instead of to nearest. */
const snapProps = (o: ObjectDef, down = false) => {
  if (!o.props) return o.props;
  const out = { ...o.props };
  for (const p of (getComponent(o.type)?.props ?? []) as { key: string; type: string; step?: number; min?: number; max?: number }[]) {
    const v = out[p.key];
    if (p.type !== 'number' || typeof v !== 'number' || !p.step || p.step < 1) continue;
    const k = down ? Math.floor(v / p.step) : Math.round(v / p.step);
    out[p.key] = Math.min(p.max ?? Infinity, Math.max(p.min ?? -Infinity, k * p.step));
  }
  return out;
};

/** Gears are pulled onto their neighbour's teeth by the editor, so they are never off by a rough hand. */
const SELF_SEATING = new Set(['gear']);

const snapObj = (o: ObjectDef, dx = 0, dy = 0, turnSteps = 0, sizeDown = false): ObjectDef => {
  if (SELF_SEATING.has(o.type)) return o;
  const step = stepOf(o.type);
  return {
    ...o,
    props: snapProps(o, sizeDown),
    x: Math.round((o.x + dx) / GRID) * GRID,
    y: Math.round((o.y + dy) / GRID) * GRID,
    angle: (Math.round(o.angle / step) + turnSteps) * step,
  };
};

/** Grid offsets within ±20 px, nearest first. */
const RING: [number, number][] = [];
for (let dx = -20; dx <= 20; dx += GRID) for (let dy = -20; dy <= 20; dy += GRID) RING.push([dx, dy]);
RING.sort((p, q) => Math.hypot(...p) - Math.hypot(...q));

/**
 * The reference build as a player with snapping on would make it: each part on the editor's grid,
 * at a whole turning step and size step, at the nearest such spot (within ±20 px, one turning step
 * and one size step) where it still works with the rest of the reference. `stuck` lists parts with
 * no such spot: they can only be solved with snapping turned off.
 */
export const gridReference = (level: LevelDef, build: BuildDef, host: Simulation, limit: number): { build: BuildDef; stuck: string[] } => {
  const stuck: string[] = [];
  // Part by part, each settled into the build made so far, the way a player lines things up in turn.
  const objects = [...build.objects];
  objects.forEach((o, i) => {
    if (SELF_SEATING.has(o.type)) return;
    const swap = (x: ObjectDef): BuildDef => ({ objects: objects.map((q, j) => (j === i ? x : q)), connections: build.connections });
    for (const turn of [0, -1, 1])
      for (const down of [false, true])
        for (const [dx, dy] of RING) {
          const c = snapObj(o, dx, dy, turn, down);
          if (invalidPlacements(host, [c], new Set()).length || overlapsBuild(host, [c], swap(c).objects, objects.filter((_, j) => j !== i).map((q) => q.id))) continue;
          if (traceRun(level, swap(c), limit).solved) {
            objects[i] = c;
            return;
          }
        }
    stuck.push(o.type);
  });
  return { build: { objects, connections: build.connections }, stuck };
};

/**
 * Move the chosen placed parts (all of them by default) by a random offset of about `sigma` px,
 * then snap them like the editor does, the way a player who has the right idea but a rough hand
 * would place them. The wider the spread, the likelier a part also ends up one turning step off.
 * Placements the editor would refuse (overlaps, off the map) are re-rolled; returns null if none
 * is found.
 */
export const roughPlacement = (level: LevelDef, build: BuildDef, sigma: number, r: () => number, host?: Simulation, only?: string): BuildDef | null => {
  const h = host ?? new Simulation(level, { objects: [], connections: [] });
  for (let attempt = 0; attempt < 12; attempt++) {
    const objects: ObjectDef[] = build.objects.map((o) =>
      only && o.id !== only ? o : snapObj(o, gauss(r) * sigma, gauss(r) * sigma, Math.round(gauss(r) * (sigma / 48))),
    );
    const moved = only ? objects.filter((o) => o.id === only) : objects;
    const others = only ? objects.filter((o) => o.id !== only).map((o) => o.id) : [];
    if (!invalidPlacements(h, moved, new Set()).length && !overlapsBuild(h, moved, objects, others)) return { objects, connections: build.connections };
  }
  return null;
};

/** Placed parts may not overlap each other either; checked with the same geometry rule. */
const overlapsBuild = (host: Simulation, moved: ObjectDef[], all: ObjectDef[], others: string[]) => {
  if (!others.length) return false;
  const probeLevel = { ...host.level, fixedObjects: [], startingObjects: all.filter((o) => others.includes(o.id)), connections: [] };
  return invalidPlacements(new Simulation(probeLevel, { objects: [], connections: [] }), moved, new Set()).length > 0;
};

// ------------------------------------------------------------------ per-level report

export interface FunReport {
  id: string;
  name: string;
  /** Parts the reference build places (objects plus ropes and belts). */
  partsPlaced: number;
  /** Non-wall things already in the room. */
  prebuilt: number;
  /** Spectacle */
  stages: number;
  domains: string[];
  solveTime: number;
  /** Pacing: seconds from RUN to the first stage, and the longest gap with no new stage. */
  firstStageAt: number;
  longestLull: number;
  /** Agency: share of the solved chain that does not happen when RUN is pressed on an empty build. */
  playerShare: number;
  /** What an empty build does when run: stages reached, so the player sees the machine try. */
  emptyStages: number;
  /** Forgiveness: solve rate when every placed part is off by about ±6 px, then ±12 px. */
  forgiveness: Trial[];
  /** The same, one part at a time with the rest placed right, across SPREADS. */
  perPart: { id: string; type: string; ladder: Trial[]; tolerance: number }[];
  /** Tolerance (px) of the fiddliest part: the widest spread where it still solves at least half the time. */
  tolerance: number;
  /** Type of the part that needs pixel hunting, if any. */
  fiddliest: string | null;
  /** Near misses: of rough placements that failed, the mean share of the reference chain they reached. */
  nearMiss: number;
  /** Does the reference still solve when placed with the editor's default grid and angle snapping? */
  snapped: boolean;
  /** Parts that only work with snapping off. */
  stuck: string[];
  /** New part kinds this level introduces to the campaign so far (set by auditCampaign). */
  newParts: string[];
  flags: string[];
  /** 0–100 summary of the measures above; a triage aid, not a verdict. */
  score: number;
}

export interface Trial {
  sigma: number;
  rate: number;
  samples: number;
}

export const SPREADS = [6, 12, 24, 48];

/** Widest spread whose rate is at least one half, counting only spreads that were sampled. */
const toleranceOf = (ladder: Trial[]) => {
  let tol = 0;
  for (const t of ladder) {
    if (!t.samples) continue;
    if (t.rate >= 0.5) tol = t.sigma;
    else break;
  }
  return tol;
};

export interface AuditOptions {
  samples?: number;
  spreads?: number[];
  seed?: number;
}

export const partsPlacedBy = (b: BuildDef) => b.objects.length + b.connections.filter((c) => c.kind !== 'wire').length;

export const auditLevel = (level: LevelDef, reference: BuildDef, opts: AuditOptions = {}): FunReport => {
  const samples = opts.samples ?? 16;
  const spreads = opts.spreads ?? SPREADS;
  const r = rng(opts.seed ?? 7);
  const limit = level.restrictions?.timeLimit ?? 30;

  const ref = traceRun(level, reference, limit);
  const empty = traceRun(level, { objects: [], connections: [] }, limit);
  const emptyKeys = new Set(empty.chain.map((c) => c.key));
  const refKeys = new Set(ref.chain.map((c) => c.key));

  const times = ref.chain.map((c) => c.time);
  const end = ref.solvedAt ?? ref.endedAt;
  const firstStageAt = times.length ? times[0] : end;
  let longestLull = 0;
  let prev = 0;
  for (const t of [...times, end]) {
    longestLull = Math.max(longestLull, t - prev);
    prev = t;
  }
  const playerShare = ref.chain.length ? ref.chain.filter((c) => !emptyKeys.has(c.key)).length / ref.chain.length : 0;

  const host = new Simulation(level, { objects: [], connections: [] });
  // Rough hands are modelled around the build a snapping player would make, when one exists.
  const grid = gridReference(level, reference, host, limit);
  const snapped = grid.stuck.length === 0;
  const base = grid.build;
  const playerKeys = [...refKeys].filter((k) => !emptyKeys.has(k));
  const missReach: number[] = [];
  const trial = (sigma: number, only?: string) => {
    let ok = 0;
    let n = 0;
    for (let k = 0; k < samples; k++) {
      const b = roughPlacement(level, base, sigma, r, host, only);
      if (!b) continue;
      n++;
      const t = traceRun(level, b, limit);
      if (t.solved) ok++;
      else if (playerKeys.length) missReach.push(t.chain.filter((c) => playerKeys.includes(c.key)).length / playerKeys.length);
    }
    return { sigma, rate: n ? ok / n : 0, samples: n };
  };
  // Each part on its own: how roughly can it be placed while the rest is right?
  const perPart: FunReport['perPart'] = base.objects.filter((o) => !SELF_SEATING.has(o.type)).map((o) => {
    const ladder = spreads.map((sigma) => trial(sigma, o.id));
    return { id: o.id, type: o.type, ladder, tolerance: toleranceOf(ladder) };
  });
  // Everything at once with a careful-but-human hand.
  const forgiveness = [trial(6), trial(12)];
  const fiddliest = perPart.reduce<(typeof perPart)[number] | null>((m, p) => (!m || p.tolerance < m.tolerance ? p : m), null);
  const tolerance = fiddliest ? fiddliest.tolerance : spreads[spreads.length - 1];
  // Too few failures to say how failing feels: count it as fine.
  const nearMiss = missReach.length >= 3 ? missReach.reduce((x, y) => x + y, 0) / missReach.length : 1;

  const rep: FunReport = {
    id: level.id,
    name: level.name,
    partsPlaced: partsPlacedBy(reference),
    prebuilt: [...level.fixedObjects, ...level.startingObjects].filter((o) => o.type !== 'wall').length,
    stages: ref.chain.length,
    domains: [...new Set(ref.chain.map((c) => c.domain))],
    solveTime: ref.solvedAt ?? -1,
    firstStageAt,
    longestLull,
    playerShare,
    emptyStages: empty.chain.length,
    forgiveness,
    perPart,
    tolerance,
    fiddliest: fiddliest && fiddliest.tolerance < LIMITS.tolerance ? fiddliest.type : null,
    nearMiss,
    snapped,
    stuck: grid.stuck,
    newParts: [],
    flags: [],
    score: 0,
  };
  rep.flags = flagsFor(rep, ref.solved, !!level.metadata?.tutorial);
  rep.score = scoreOf(rep);
  return rep;
};

// ------------------------------------------------------------------ thresholds

/** Thresholds a level is flagged against. Tuned so the flags point at outliers, not at most levels. */
export const LIMITS = {
  /** Players start doubting the machine after a few seconds of nothing new happening. */
  lull: 6,
  /** Pressing RUN should get a reaction quickly. */
  firstStage: 3,
  /** Below this the solution barely survives a careful hand: pixel hunting. */
  tolerance: 12,
  /** If most of the chain runs without the player, their part is a switch, not a contraption. */
  playerShare: 0.25,
  /** Failures that reach almost nothing read as "nothing happened". */
  nearMiss: 0.3,
};

const flagsFor = (r: FunReport, solved: boolean, tutorial: boolean): string[] => {
  const f: string[] = [];
  if (!solved) f.push('reference build does not solve');
  if (r.longestLull > LIMITS.lull) f.push(`dead air: ${r.longestLull.toFixed(1)}s with nothing new happening`);
  if (r.firstStageAt > LIMITS.firstStage) f.push(`slow start: first reaction at ${r.firstStageAt.toFixed(1)}s`);
  if (r.fiddliest) f.push(`pixel hunting: the ${r.fiddliest} only works within ±${r.tolerance}px`);
  if (r.stages === 0) f.push('no visible stages: the solve happens without a single chain event');
  else if (r.playerShare < LIMITS.playerShare) f.push(`low agency: only ${pct(r.playerShare)} of the chain needs the player`);
  const loose = r.perPart.length > 0 && r.perPart.every((p) => p.tolerance >= SPREADS[SPREADS.length - 1]);
  if (!r.snapped) f.push(`needs fine control: the ${r.stuck.join(', ')} only work${r.stuck.length === 1 ? 's' : ''} off the 10px grid or between turning steps`);
  if (loose && !tutorial) f.push(`maybe trivial: every part still works dropped ±${SPREADS[SPREADS.length - 1]}px off`);
  if (r.nearMiss < LIMITS.nearMiss) f.push(`all-or-nothing: failed attempts reach ${pct(r.nearMiss)} of the player's part of the chain`);
  if (r.emptyStages === 0) f.push('silent on RUN: an empty build does nothing at all');
  return f;
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Weighted 0–100 summary. Spectacle and forgiveness weigh most because they are what this genre
 * is loved and hated for; the trivial case is penalised as hard as pixel hunting.
 */
export const scoreOf = (r: FunReport): number => {
  if (r.solveTime < 0) return 0;
  const spectacle = clamp01(r.stages / 10) * 0.7 + clamp01(r.domains.length / 4) * 0.3;
  const pacing = clamp01(1 - (r.longestLull - 2) / 8) * 0.7 + clamp01(1 - (r.firstStageAt - 0.5) / 4) * 0.3;
  const agency = clamp01(r.playerShare / 0.6);
  const top = SPREADS[SPREADS.length - 1];
  const loose = r.perPart.length > 0 && r.perPart.every((p) => p.tolerance >= top);
  const together = r.forgiveness[0]?.rate ?? 0;
  const forgiving = (r.snapped ? 1 : 0.7) * (0.6 * clamp01(r.tolerance / 24) + 0.4 * clamp01(together / 0.8)) * (loose ? 0.5 : 1);
  const near = clamp01(r.nearMiss / 0.6);
  return Math.round(100 * (0.25 * spectacle + 0.2 * pacing + 0.15 * agency + 0.25 * forgiving + 0.15 * near));
};
