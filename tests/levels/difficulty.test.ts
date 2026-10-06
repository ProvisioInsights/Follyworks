// Easy / Normal / Hard for every campaign mission (game/difficulty.ts). Iterates CAMPAIGN, so new
// mission groups are covered automatically.

import { describe, expect, it } from 'vitest';
import '../../src/components';
import { parseLevel } from '../../src/core/level';
import type { BuildDef, LevelDef } from '../../src/core/types';
import { canPlace, countUsed, partsPlaced } from '../../src/editor/inventory';
import { CAMPAIGN } from '../../src/game/campaign';
import { applyDifficulty, buildKey, DIFFICULTIES, hardTimeLimit, referenceSolveTime } from '../../src/game/difficulty';
import { Simulation } from '../../src/sim/Simulation';

const limitOf = (l: LevelDef) => l.restrictions?.timeLimit ?? 30;
const INF = Number.POSITIVE_INFINITY;
const countOf = (l: LevelDef, type: string) => {
  const row = l.inventory.find((r) => r.type === type);
  return !row ? 0 : row.count < 0 ? INF : row.count;
};
const capOf = (l: LevelDef) => l.restrictions?.maxParts ?? INF;

/** The build fits the level's bin and part cap, placed one item at a time as a player would. */
const fitsBin = (l: LevelDef, b: BuildDef) => {
  const partial: BuildDef = { objects: [], connections: [] };
  for (const o of b.objects) {
    if (!canPlace(l, partial, o.type, false).ok) return `cannot place ${o.type}`;
    partial.objects.push(o);
  }
  for (const c of b.connections) {
    if (!canPlace(l, partial, c.kind, false).ok) return `cannot place ${c.kind}`;
    partial.connections.push(c);
  }
  return 'ok';
};

describe('difficulty rules', () => {
  it('hard time limit never drops below the reference solve time plus margin, nor rises above Normal', () => {
    expect(hardTimeLimit(30, 5)).toBe(18);
    expect(hardTimeLimit(30, 20)).toBe(28);
    expect(hardTimeLimit(30, 29)).toBe(30);
    expect(hardTimeLimit(30, null)).toBe(30);
  });

  it('normal is the level exactly as authored', () => {
    for (const e of CAMPAIGN) expect(applyDifficulty(e, 'normal').level).toEqual(e.level);
  });

  it('does not mutate the campaign entry', () => {
    const e = CAMPAIGN[CAMPAIGN.length - 1];
    const before = JSON.stringify(e);
    applyDifficulty(e, 'easy');
    applyDifficulty(e, 'hard');
    expect(JSON.stringify(e)).toBe(before);
  });

  it('a level without reference solutions only has Normal', () => {
    const e = { ...CAMPAIGN[0], solutions: [] };
    for (const d of DIFFICULTIES) {
      const r = applyDifficulty(e, d);
      expect(r.difficulty).toBe('normal');
      expect(r.level).toEqual(e.level);
    }
  });

  it('normal builds keep the plain level id as their save key', () => {
    expect(buildKey('g1-1', 'normal')).toBe('g1-1');
    expect(buildKey('g1-1', 'easy')).toBe('g1-1@easy');
  });
});

for (const entry of CAMPAIGN) {
  describe(`${entry.level.id} difficulties`, () => {
    const normal = entry.level;
    const easy = applyDifficulty(entry, 'easy');
    const hard = applyDifficulty(entry, 'hard');

    for (const d of [easy, hard]) {
      it(`${d.difficulty}: parses cleanly and solutions[0] solves it within its time limit`, () => {
        const { problems } = parseLevel(JSON.parse(JSON.stringify(d.level)));
        expect(problems).toEqual([]);
        expect(fitsBin(d.level, d.solution!)).toBe('ok');
        const sim = new Simulation(d.level, d.solution!);
        expect(sim.warnings).toEqual([]);
        expect(sim.runUntil(limitOf(d.level))).toBe(true);
      });
    }

    it('hard: solutions[0] nudged ±4px still beats the shorter clock', () => {
      for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) {
        const b: BuildDef = { objects: hard.solution!.objects.map((o) => ({ ...o, x: o.x + dx, y: o.y + dy })), connections: hard.solution!.connections };
        expect(new Simulation(hard.level, b).runUntil(limitOf(hard.level)), `${dx},${dy}`).toBe(true);
      }
    });

    it('easy is never harder than normal', () => {
      const l = easy.level;
      expect(limitOf(l)).toBeGreaterThan(limitOf(normal));
      expect(capOf(l)).toBeGreaterThanOrEqual(capOf(normal));
      for (const r of normal.inventory) expect(countOf(l, r.type), r.type).toBeGreaterThanOrEqual(countOf(normal, r.type));
      for (const [type] of countUsed(entry.solutions[0])) if (countOf(normal, type) !== INF) expect(countOf(l, type)).toBe(countOf(normal, type) + 1);
      // Everything authored is still there; Easy only adds a starting part.
      expect(l.startingObjects.slice(0, normal.startingObjects.length)).toEqual(normal.startingObjects);
      expect(l.startingObjects.length - normal.startingObjects.length).toBe(easy.preplaced.length);
      expect(l.fixedObjects).toEqual(normal.fixedObjects);
      expect(l.goals).toEqual(normal.goals);
      if (entry.solutions[0].objects.length >= 2) expect(easy.preplaced.length).toBe(1);
      else expect(easy.preplaced.length).toBe(0);
      expect(partsPlaced(easy.solution!)).toBe(partsPlaced(entry.solutions[0]) - easy.preplaced.length);
    });

    it('hard is never easier than normal and caps parts at solutions[0]', () => {
      const l = hard.level;
      const t = referenceSolveTime(entry)!;
      expect(t).not.toBeNull();
      expect(limitOf(l)).toBeLessThanOrEqual(limitOf(normal));
      expect(limitOf(l)).toBeGreaterThanOrEqual(Math.min(limitOf(normal), t * 1.3 + 2));
      expect(capOf(l)).toBe(Math.min(capOf(normal), partsPlaced(entry.solutions[0])));
      for (const r of normal.inventory) expect(countOf(l, r.type), r.type).toBeLessThanOrEqual(countOf(normal, r.type));
      // Decoys stay in the bin (at most one each) so Hard doesn't reveal which parts matter.
      expect(l.inventory.map((r) => r.type)).toEqual(normal.inventory.map((r) => r.type));
      expect(l.startingObjects).toEqual(normal.startingObjects);
      expect(l.goals).toEqual(normal.goals);
    });
  });
}
