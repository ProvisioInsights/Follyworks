// Tiered hints. Each press of the hint button climbs one step:
//   tier 1  a nudge: the level's authored hint lines, one per press;
//   tier 2  "parts you'll need": the part types and counts the reference solution uses;
//   tier 3+ a ghost outline of one reference part at its exact spot, one more per press, never
//           for a part the player has already put there.
// Levels without a reference solution (custom levels) stop at tier 1. Pure logic, so it is
// tested headlessly; the HUD draws it (ui/PlayScreen.ts) and builds the ghost outlines.

import { blankLevel } from '../core/level';
import type { AttemptResult } from './scoring';
import type { BuildDef, LevelDef, ObjectDef } from '../core/types';
import { countUsed } from '../editor/inventory';
import type { Entity } from '../sim/Entity';
import { Simulation } from '../sim/Simulation';
import { playtest } from '../telemetry/playtest';
import { angleGap } from './guide';

/** Tier at which ELEGANT is withheld (a ghost showed a part's exact spot). */
export const GHOST_TIER = 3;

export type HintView =
  | { tier: 1; kind: 'nudge'; text: string; index: number; of: number }
  | { tier: 2; kind: 'parts'; parts: { type: string; count: number }[]; wires: number }
  | { tier: number; kind: 'ghost'; ghost: ObjectDef; shown: number; of: number }
  | { tier: number; kind: 'done'; text: string };

/** Close enough to the ghost's spot to count as "already placed there". */
const PLACED_RADIUS = 24;
const PLACED_ANGLE = 0.25;

export const placedAt = (build: BuildDef, o: ObjectDef) =>
  build.objects.some((b) => b.type === o.type && Math.hypot(b.x - o.x, b.y - o.y) <= PLACED_RADIUS && angleGap(b.angle ?? 0, o.angle ?? 0) <= PLACED_ANGLE);

export class HintLadder {
  readonly hints: string[];
  readonly solution: BuildDef | null;
  private nudge = -1;
  private partsShown = false;
  /** Reference objects whose ghost has been revealed, in reveal order. */
  readonly revealed: ObjectDef[] = [];
  /** Highest tier the player asked for (0 = none). Automatic hints do not count. */
  tierUsed = 0;
  current: HintView | null = null;

  constructor(hints: string[] | undefined, solution: BuildDef | null | undefined) {
    this.hints = hints ?? [];
    this.solution = solution && solution.objects.length + solution.connections.length > 0 ? solution : null;
  }

  /** Whether the ladder has anything at all to show. */
  get available() {
    return this.hints.length > 0 || !!this.solution;
  }

  /** Ghosts still worth showing: revealed, and not yet matched by a part the player placed. */
  visibleGhosts(build: BuildDef) {
    return this.revealed.filter((o) => !placedAt(build, o));
  }

  /** What the next press would show, or null when there is nothing new. */
  nextKind(build: BuildDef): 'nudge' | 'parts' | 'ghost' | null {
    if (this.nudge < this.hints.length - 1) return 'nudge';
    if (!this.solution) return null;
    if (!this.partsShown) return 'parts';
    return this.nextGhost(build) ? 'ghost' : null;
  }

  /** Whether another press would show something new. */
  hasMore(build: BuildDef) {
    return this.nextKind(build) !== null;
  }

  private nextGhost(build: BuildDef) {
    return this.solution?.objects.find((o) => !this.revealed.includes(o) && !placedAt(build, o)) ?? null;
  }

  /** Climb one step (or stay on the last one when there is nothing more). `auto` hints are not counted. */
  next(build: BuildDef, auto = false): HintView | null {
    let v: HintView | null = null;
    if (this.nudge < this.hints.length - 1) {
      this.nudge++;
      v = { tier: 1, kind: 'nudge', text: this.hints[this.nudge], index: this.nudge, of: this.hints.length };
    } else if (this.solution && !this.partsShown) {
      this.partsShown = true;
      const used = countUsed(this.solution);
      v = {
        tier: 2,
        kind: 'parts',
        parts: [...used].map(([type, count]) => ({ type, count })),
        wires: this.solution.connections.filter((c) => c.kind === 'wire').length,
      };
    } else if (this.solution) {
      const g = this.nextGhost(build);
      if (g) {
        this.revealed.push(g);
        v = { tier: GHOST_TIER + this.revealed.length - 1, kind: 'ghost', ghost: g, shown: this.revealed.length, of: this.solution.objects.length };
      } else {
        const kinds = (['rope', 'belt', 'wire'] as const)
          .map((k) => [k, this.solution!.connections.filter((c) => c.kind === k).length] as const)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${n} ${k}${n === 1 ? '' : 's'}`);
        const links = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}` : kinds[0];
        v = {
          tier: this.current?.tier ?? GHOST_TIER,
          kind: 'done',
          text: `Every part's spot is outlined.${links ? ` Then connect ${links}.` : ''} Press Run and watch what happens.`,
        };
      }
    } else if (this.hints.length) {
      v = { tier: 1, kind: 'nudge', text: this.hints[this.nudge], index: this.nudge, of: this.hints.length };
    }
    if (v && !auto) {
      this.tierUsed = Math.max(this.tierUsed, v.tier);
      playtest.hint(v.tier);
    }
    this.current = v;
    return v;
  }
}

/** ELEGANT is withheld once a ghost hint showed where a part goes; stars (SOLVED/ABSURD) are kept. */
export const applyHintPenalty = (r: AttemptResult, tierUsed: number): AttemptResult => {
  const out: AttemptResult = { ...r, hintTier: tierUsed };
  if (tierUsed >= GHOST_TIER && r.elegant.available) {
    out.elegant = { ...r.elegant, earned: false, reason: r.elegant.earned ? 'Withheld: a ghost hint showed where a part goes.' : r.elegant.reason };
  }
  return out;
};

export const hintTierLabel = (tier: number) => (tier <= 0 ? '' : tier === 1 ? 'a nudge' : tier === 2 ? 'the parts list' : 'ghost outlines');

/** Real collision outlines for ghost parts, in a scratch simulation of the level's room. */
export const ghostEntities = (level: LevelDef, objs: ObjectDef[]): Entity[] => {
  if (!objs.length) return [];
  const probe = blankLevel('hint-ghost');
  probe.world = { ...level.world };
  try {
    const sim = new Simulation(probe, { objects: objs.map((o) => ({ ...o, props: o.props ?? {} })), connections: [] }, { lenient: true });
    return sim.list.filter((e) => e.alive);
  } catch {
    return [];
  }
};
