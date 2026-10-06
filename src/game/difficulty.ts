// Per-mission difficulty. Normal is the level exactly as authored; Easy and Hard are derived from
// the level plus its campaign reference solution (solutions[0]) by one pure function, so every
// mission (including groups added later) gets all three without any authoring.
//
// Easy:   time limit ×1.5 (rounded up); every part type solutions[0] uses gets one extra in the
//         bin; a part cap, if any, rises by one; and when solutions[0] places two or more objects,
//         one of them (the first that no connection in the solution touches, else the first) is
//         pre-placed at its exact spot as a locked starting object. The bin is not reduced for
//         the gift, so Easy's bin is always a superset of Normal's. Tutorial guide steps that ask
//         for exactly that part are dropped.
// Hard:   time limit cut toward 60% of Normal, but never below the measured solve time of
//         solutions[0] ×1.3 + 2 s (measured headlessly and memoised; the slowest of the reference
//         and its ±4 px nudges), and never above Normal;
//         each part type solutions[0] uses is trimmed to exactly the count it uses, every other
//         type (the decoys) to at most one, so the bin does not give away which parts matter;
//         the part cap becomes solutions[0]'s part count; ABSURD is switched off (with the cap at
//         the simplest solution's size it is out of reach, so the briefing would advertise
//         something impossible).
//
// Levels without reference solutions (custom levels) only ever get Normal.

import { deepClone } from '../core/util';
import type { BuildDef, InventoryItem, LevelDef, ObjectDef } from '../core/types';
import { countUsed, partsPlaced } from '../editor/inventory';
import { DIFFICULTIES, type Difficulty } from '../persistence/save';
import { Simulation } from '../sim/Simulation';
import { triggerMet } from './guide';
import type { CampaignEntry } from './levels/types';

export { DIFFICULTIES, type Difficulty };

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: 'More time, spare parts, and one part already in place',
  normal: 'The puzzle as designed',
  hard: 'Less time, a lean parts bin and a strict part cap',
};

export const EASY_TIME_FACTOR = 1.5;
export const HARD_TIME_FACTOR = 0.6;
export const HARD_SAFETY_FACTOR = 1.3;
export const HARD_SAFETY_SECONDS = 2;
const DEFAULT_TIME = 30;

export interface DerivedLevel {
  difficulty: Difficulty;
  level: LevelDef;
  /** solutions[0] adjusted for this difficulty (minus Easy's pre-placed part). Used by tests and the hint ladder. */
  solution: BuildDef | null;
  /** Ids of solution objects that were pre-placed as starting objects (Easy). */
  preplaced: string[];
}

const timeOf = (l: LevelDef) => l.restrictions?.timeLimit ?? DEFAULT_TIME;

const solveTimes = new Map<string, number | null>();

const NUDGES: [number, number][] = [
  [0, 0],
  [4, 0],
  [-4, 0],
  [0, 4],
  [0, -4],
];

/**
 * Simulated seconds solutions[0] needs to solve the authored level: the slowest of the reference
 * build and the same build nudged 4 px each way (the campaign tests require those to solve too),
 * so a player's slightly-off copy of the intended machine is not timed out on Hard. Null if the
 * reference does not solve. Deterministic, so memoised per level id.
 */
export const referenceSolveTime = (entry: CampaignEntry): number | null => {
  const id = entry.level.id;
  if (solveTimes.has(id)) return solveTimes.get(id)!;
  const sol = entry.solutions[0];
  let t: number | null = null;
  if (sol) {
    for (const [dx, dy] of NUDGES) {
      const b: BuildDef = { objects: sol.objects.map((o) => ({ ...o, x: o.x + dx, y: o.y + dy })), connections: sol.connections };
      const sim = new Simulation(deepClone(entry.level), deepClone(b));
      const ok = sim.runUntil(timeOf(entry.level));
      if (!ok && dx === 0 && dy === 0) break;
      if (ok) t = Math.max(t ?? 0, sim.goals.solvedAt ?? sim.time);
    }
  }
  solveTimes.set(id, t);
  return t;
};

/** The Hard time limit for a level whose reference solution solves in `solveTime` seconds. */
export const hardTimeLimit = (normal: number, solveTime: number | null) => {
  if (solveTime === null) return normal;
  const floor = Math.ceil(solveTime * HARD_SAFETY_FACTOR + HARD_SAFETY_SECONDS);
  return Math.min(normal, Math.max(Math.ceil(normal * HARD_TIME_FACTOR), floor));
};

/** Which solution object Easy pre-places: the first one no solution connection touches, else the first. */
const pickHelp = (sol: BuildDef): ObjectDef | null => {
  if (sol.objects.length < 2) return null;
  const touched = new Set(sol.connections.flatMap((c) => [c.from.obj, c.to.obj, ...(c.via ?? [])]));
  return sol.objects.find((o) => !touched.has(o.id)) ?? sol.objects[0];
};

const TOOLS = new Set(['wire']);

export const applyDifficulty = (entry: CampaignEntry, d: Difficulty, opts: { solveTime?: number | null } = {}): DerivedLevel => {
  const level = deepClone(entry.level);
  const sol = entry.solutions[0] ? deepClone(entry.solutions[0]) : null;
  if (d === 'normal' || !sol) return { difficulty: sol ? d : 'normal', level, solution: sol, preplaced: [] };
  const used = countUsed(sol);
  const normalTime = timeOf(entry.level);
  level.restrictions = { ...(level.restrictions ?? {}) };

  if (d === 'easy') {
    level.restrictions.timeLimit = Math.ceil(normalTime * EASY_TIME_FACTOR);
    const inv: InventoryItem[] = level.inventory.map((it) => ({ ...it, count: it.count >= 0 && used.has(it.type) ? it.count + 1 : it.count }));
    for (const [type] of used) if (!inv.some((it) => it.type === type)) inv.push({ type, count: 1 });
    level.inventory = inv;
    if (level.restrictions.maxParts !== undefined) level.restrictions.maxParts += 1;
    const help = pickHelp(sol);
    const preplaced: string[] = [];
    let solution = sol;
    if (help) {
      level.startingObjects = [...level.startingObjects, deepClone(help)];
      // Tutorial guidance: drop "place this part" steps the pre-placed part already does.
      if (level.guide) level.guide = level.guide.filter((g) => !(g.until.kind === 'place' && triggerMet(g.until, { objects: [help], connections: [] }, { ran: false, acked: new Set() }, 0)));
      solution = { objects: sol.objects.filter((o) => o.id !== help.id), connections: sol.connections };
      preplaced.push(help.id);
    }
    return { difficulty: d, level, solution, preplaced };
  }

  // hard
  const t = opts.solveTime !== undefined ? opts.solveTime : referenceSolveTime(entry);
  level.restrictions.timeLimit = hardTimeLimit(normalTime, t);
  level.inventory = level.inventory.map((it) => {
    if (TOOLS.has(it.type)) return { ...it };
    const n = used.get(it.type);
    const cap = n ?? 1;
    return { ...it, count: it.count < 0 ? cap : Math.min(it.count, cap) };
  });
  const cap = partsPlaced(sol);
  level.restrictions.maxParts = Math.min(level.restrictions.maxParts ?? Infinity, cap);
  level.bonus = { ...(level.bonus ?? {}), absurdStages: 0 };
  return { difficulty: d, level, solution: sol, preplaced: [] };
};

/** Save key for the autosaved build of a level at a difficulty (Normal keeps the plain level id, so old saves carry over). */
export const buildKey = (levelId: string, d: Difficulty) => (d === 'normal' ? levelId : `${levelId}@${d}`);
