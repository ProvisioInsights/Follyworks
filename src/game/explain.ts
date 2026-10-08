// "So close!": after a run ends without solving (everything stopped, or time ran out), say in one
// or two short lines how far the machine got and where it stopped, and name the parts to mark in
// the room. Pure logic over a Simulation, so it is tested headlessly; the HUD shows the words
// (ui/PlayScreen.ts) and Overlays draws the markers.
//
// With a reference solution (campaign) the run is compared against the reference run's chain:
// stages of the level's own parts are matched by key, and stages of the player's parts (whose ids
// differ from the reference's) are matched by count. Without one (custom levels) only the unmet
// goal is described.

import type { BuildDef, GoalDef, LevelDef, Selector, Vec } from '../core/types';
import type { Entity } from '../sim/Entity';
import { describeMiss, matches } from '../sim/goals';
import { Simulation, type ChainEntry } from '../sim/Simulation';
import { uniqueChain } from './scoring';

/** What a reference build and an empty build do on a level (computed once per level, see referenceFor). */
export interface ReferenceRun {
  /** Unique stages of the solving run, in order, up to the solve. */
  chain: ChainEntry[];
  /** Keys of stages that involve one of the reference build's own parts. */
  playerKeys: Set<string>;
  /** Keys of stages that happen with nothing placed at all. */
  emptyKeys: Set<string>;
}

export type Tone = 'close' | 'partway' | 'nothing';

export interface Explanation {
  tone: Tone;
  /** "So close!", "Getting there." or "Nothing moved yet." */
  title: string;
  /** One or two plain sentences. */
  text: string;
  /** Steps reached out of the reference run's steps, when there is a reference. */
  steps: { got: number; of: number } | null;
  /** Entity id of the last part that did something new (marked "stopped here"). */
  stopAt: string | null;
  /** Entity id of a loose thing that came to rest without finishing the job (e.g. the ball). */
  restAt: string | null;
}

/** Share of the reference's steps a run must reach to be "so close". */
export const CLOSE_SHARE = 0.5;

const ids = (key: string) => key.split(/[>:]/).filter(Boolean);
const subjectId = (key: string) => ids(key)[0] ?? key;

const traceChain = (level: LevelDef, build: BuildDef): ChainEntry[] => {
  const sim = new Simulation(level, build, { lenient: true });
  const ticks = Math.round((level.restrictions?.timeLimit ?? 30) * 60);
  let still = 0;
  for (let i = 0; i < ticks && !sim.goals.solved; i++) {
    sim.step();
    sim.events.length = 0;
    still = sim.isStill() ? still + 1 : 0;
    if (still >= 120 && sim.time > 1.5) break;
  }
  const end = sim.goals.solvedAt;
  return uniqueChain(sim.chain).filter((c) => end === null || c.time <= end + 0.001);
};

/** Run the reference build and an empty build headlessly (each well under a second of work). */
export const traceReference = (level: LevelDef, solution: BuildDef): ReferenceRun => {
  const buildIds = new Set(solution.objects.map((o) => o.id));
  const chain = traceChain(level, solution);
  const playerKeys = new Set(chain.filter((c) => ids(c.key).some((id) => buildIds.has(id))).map((c) => c.key));
  const emptyKeys = new Set(traceChain(level, { objects: [], connections: [] }).map((c) => c.key));
  return { chain, playerKeys, emptyKeys };
};

const refCache = new WeakMap<LevelDef, { solution: BuildDef; ref: ReferenceRun }>();

/** traceReference, remembered per level object (a level is derived once per visit). */
export const referenceFor = (level: LevelDef, solution: BuildDef | null | undefined): ReferenceRun | null => {
  if (!solution || !solution.objects.length) return null;
  const hit = refCache.get(level);
  if (hit && hit.solution === solution) return hit.ref;
  const ref = traceReference(level, solution);
  refCache.set(level, { solution, ref });
  return ref;
};

/** "the seesaw", or a creature's own name ("Bolt"). */
export const partName = (e: Entity) => (e.def.category === 'creature' ? e.def.name.split(' ')[0] : `the ${e.def.name.toLowerCase()}`);

const posOf = (e: Entity): Vec => e.body?.position ?? { x: e.x, y: e.y };

/** Where the first unmet goal wants things to go, and which things it is about. */
const goalFocus = (g: GoalDef, sim: Simulation): { at: Vec | null; target: Selector | null } => {
  const at = (sel: Selector) => {
    const e = sim.select(sel).find((q) => q.alive);
    return e ? posOf(e) : null;
  };
  switch (g.kind) {
    case 'enterRegion':
      return { at: { x: g.region.x + g.region.w / 2, y: g.region.y + g.region.h / 2 }, target: g.target };
    case 'containerCount': {
      const c = sim.entities.get(g.container);
      return { at: c ? posOf(c) : null, target: g.filter ?? null };
    }
    case 'height':
      return { at: null, target: g.target };
    case 'contact':
      return { at: at(g.b), target: g.a };
    case 'activate':
    case 'destroyed':
      return { at: at(g.target), target: null };
  }
};

/** How close a resting mover must be to the next missed step to be the one that stopped short. */
const NEAR_NEXT = 260;

/**
 * A loose part that moved during the run and then came to rest without finishing the job (the
 * ball that stopped short). Prefers what the unmet goal is about (nearest to where it should go);
 * otherwise the mover nearest to the next step the reference run took, when one is close by.
 */
const restingMover = (sim: Simulation, goal: { at: Vec | null; target: Selector | null }, next: Vec | null): Entity | null => {
  const movers = sim.list.filter((e) => {
    if (!e.alive || !e.body || e.body.isStatic || !e.def.dynamic || e.type === 'wall') return false;
    const p = e.body.position;
    return Math.hypot(p.x - e.x, p.y - e.y) > 24;
  });
  const dist = (e: Entity, to: Vec) => Math.hypot(posOf(e).x - to.x, posOf(e).y - to.y);
  const nearest = (pool: Entity[], to: Vec) => pool.reduce((m, e) => (dist(e, to) < dist(m, to) ? e : m));
  const wanted = goal.target ? movers.filter((e) => matches(e, goal.target!)) : [];
  if (wanted.length) return goal.at ? nearest(wanted, goal.at) : wanted[0];
  if (!next) return null;
  const close = movers.filter((e) => dist(e, next) <= NEAR_NEXT);
  return close.length ? nearest(close, next) : null;
};

/**
 * Explain an unsolved run as it stands now. `ref` (see referenceFor) adds the step count; without
 * it the explanation names where the chain stopped and what is still missing.
 */
export const explainRun = (sim: Simulation, ref: ReferenceRun | null): Explanation => {
  const chain = uniqueChain(sim.chain);
  const isBuild = (id: string) => sim.entities.get(id)?.origin === 'build';
  const own = chain.filter((c) => ids(c.key).some(isBuild));
  const emptyKeys = ref?.emptyKeys ?? null;
  // Did anything happen because of the player? Their parts doing something, or (with a reference)
  // the machine getting further than it does on its own.
  const caused = own.length > 0 || (!!emptyKeys && chain.some((c) => !emptyKeys.has(c.key)));

  let steps: Explanation['steps'] = null;
  if (ref && ref.chain.length) {
    const reached = new Set(chain.map((c) => c.key));
    const levelGot = ref.chain.filter((c) => !ref.playerKeys.has(c.key) && reached.has(c.key)).length;
    const of = ref.chain.length;
    const got = Math.min(of - 1, levelGot + Math.min(own.length, ref.playerKeys.size));
    steps = { got: Math.max(0, got), of };
  }

  // The last stage whose part is still around marks where the chain stopped.
  let stop: Entity | null = null;
  for (let i = chain.length - 1; i >= 0 && !stop; i--) {
    const e = sim.entities.get(subjectId(chain[i].key));
    if (e?.alive && e.type !== 'wall') stop = e;
  }

  const gi = sim.level.goals.findIndex((_, k) => !sim.goals.status[k]?.met);
  const focus = gi >= 0 ? goalFocus(sim.level.goals[gi], sim) : { at: null, target: null };
  // The first step of the reference run (on the level's own parts) that this run never reached.
  const reachedKeys = new Set(chain.map((c) => c.key));
  const nextStep = ref?.chain.find((c) => !ref.playerKeys.has(c.key) && !reachedKeys.has(c.key));
  const nextEnt = nextStep ? sim.entities.get(subjectId(nextStep.key)) : undefined;
  let rest = caused ? restingMover(sim, focus, nextEnt?.alive ? posOf(nextEnt) : null) : null;
  // one ring is enough when the two would sit on top of each other
  if (rest && stop && (rest.id === stop.id || Math.hypot(posOf(rest).x - posOf(stop).x, posOf(rest).y - posOf(stop).y) < 60)) rest = null;

  const tone: Tone = !caused ? 'nothing' : steps ? (steps.got / steps.of >= CLOSE_SHARE ? 'close' : 'partway') : 'partway';
  const title = tone === 'close' ? 'So close!' : tone === 'partway' ? 'Getting there.' : 'Nothing moved yet.';
  const where = stop ? partName(stop) : null;
  let first: string;
  if (tone === 'nothing') first = where ? `The chain stopped at ${where}.` : 'The machine never got started.';
  else if (steps) first = `Your machine got ${steps.got} of about ${steps.of} steps${where ? `, then stopped at ${where}` : ''}.`;
  else first = where ? `The chain stopped at ${where}.` : 'The chain stopped early.';
  const miss = describeMiss(sim);
  return { tone, title, text: miss ? `${first} ${miss}` : first, steps, stopAt: stop?.id ?? null, restAt: rest?.id ?? null };
};
