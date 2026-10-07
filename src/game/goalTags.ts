// World-space obstacles for goal tag placement (see tagPlacement.ts): the rectangles of the
// parts in a simulation, and the spots a reference solution builds on.

import type { BuildDef, LevelDef } from '../core/types';
import type { Entity } from '../sim/Entity';
import { Simulation } from '../sim/Simulation';
import type { Rect } from './tagPlacement';

export const entityRect = (e: Entity): Rect | null => {
  if (!e.body) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of e.bodies) {
    x0 = Math.min(x0, b.bounds.min.x);
    y0 = Math.min(y0, b.bounds.min.y);
    x1 = Math.max(x1, b.bounds.max.x);
    y1 = Math.max(y1, b.bounds.max.y);
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
};

export const partRects = (sim: Simulation): Rect[] =>
  [...sim.entities.values()].filter((e) => e.alive).map(entityRect).filter((r): r is Rect => !!r);

/** Where the solution's own parts sit when built into the level: space the player needs. */
export function buildSpots(level: LevelDef, solution: BuildDef | null | undefined): Rect[] {
  if (!solution?.objects.length) return [];
  const ids = new Set(solution.objects.map((o) => o.id));
  try {
    const sim = new Simulation(level, solution);
    return [...sim.entities.values()].filter((e) => ids.has(e.id)).map(entityRect).filter((r): r is Rect => !!r);
  } catch {
    return [];
  }
}
