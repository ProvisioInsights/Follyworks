// ABSURD bonus calibration for the campaign.
// For every level, the reference solution (solutions[0]) must NOT earn ABSURD, and at least one listed
// solution (the one marked `// ABSURD:` in the level file) must earn it. Each solution is run once,
// unjittered, and stops as soon as it solves.

import { describe, expect, it } from 'vitest';
import '../../src/components';
import type { BuildDef, LevelDef } from '../../src/core/types';
import { CAMPAIGN } from '../../src/game/campaign';
import { scoreAttempt } from '../../src/game/scoring';
import { Simulation } from '../../src/sim/Simulation';

// Levels where no build within the inventory can beat solutions[0]'s stage count, so no ABSURD target
// can separate them. t1/t2 only offer static parts plus one ball that is not a stage (max 0 stages);
// t3/t4 top out at the same 2 stages as the reference; t5's shelf ball reaches the bin before the
// player's only ball can catch it (no 3+ stage build found). These keep the default target.
const NO_ABSURD_BUILD = new Set(['t1-first-drop', 't2-ramp-it-up', 't3-flip-the-switch', 't4-belt-up', 't5-tiny-machine']);

const score = (level: LevelDef, build: BuildDef) => {
  const sim = new Simulation(level, build);
  const limit = level.restrictions?.timeLimit ?? 30;
  for (let i = 0; i < limit * 60 && !sim.goals.solved; i++) sim.step();
  return scoreAttempt(level, sim.goals.solvedAt, sim.placedParts, sim.chain);
};

describe('ABSURD targets', () => {
  for (const { level, solutions } of CAMPAIGN) {
    const exempt = NO_ABSURD_BUILD.has(level.id);
    it(`${level.id}: ${exempt ? 'reference solution does not earn ABSURD' : 'reference misses ABSURD, an elaborate solution earns it'}`, () => {
      const results = solutions.map((b) => score(level, b));
      const summary = results.map((r) => `${r.stages}${r.solved ? '' : '(unsolved)'}`).join(', ');
      expect(results[0].solved, `${level.id} solutions[0] solves`).toBe(true);
      expect(results[0].absurd.earned, `${level.id} solutions[0] stages ${results[0].stages} vs target ${results[0].absurd.target}`).toBe(false);
      if (!exempt) expect(results.some((r) => r.absurd.earned), `${level.id} target ${results[0].absurd.target}, stages [${summary}]`).toBe(true);
    });
  }
});
