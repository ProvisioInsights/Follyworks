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


const score = (level: LevelDef, build: BuildDef) => {
  const sim = new Simulation(level, build);
  const limit = level.restrictions?.timeLimit ?? 30;
  for (let i = 0; i < limit * 60 && !sim.goals.solved; i++) sim.step();
  return scoreAttempt(level, sim.goals.solvedAt, sim.placedParts, sim.chain);
};

describe('ABSURD targets', () => {
  for (const { level, solutions } of CAMPAIGN) {
    // Levels with absurdStages: 0 (the tutorials) offer no ABSURD bonus.
    const exempt = level.bonus?.absurdStages === 0;
    it(`${level.id}: ${exempt ? 'reference solution does not earn ABSURD' : 'reference misses ABSURD, an elaborate solution earns it'}`, () => {
      const results = solutions.map((b) => score(level, b));
      const summary = results.map((r) => `${r.stages}${r.solved ? '' : '(unsolved)'}`).join(', ');
      expect(results[0].solved, `${level.id} solutions[0] solves`).toBe(true);
      expect(results[0].absurd.earned, `${level.id} solutions[0] stages ${results[0].stages} vs target ${results[0].absurd.target}`).toBe(false);
      if (!exempt) expect(results.some((r) => r.absurd.earned), `${level.id} target ${results[0].absurd.target}, stages [${summary}]`).toBe(true);
    });
  }
});
