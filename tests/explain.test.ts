// The "So close!" failure explainer (game/explain.ts): how far an unsolved run got, where it
// stopped, and the tone of the one or two lines the HUD shows.

import { describe, expect, it } from 'vitest';
import { parseLevel } from '../src/core/level';
import type { BuildDef, LevelDef } from '../src/core/types';
import { CAMPAIGN, levelCode } from '../src/game/campaign';
import { explainRun, referenceFor, traceReference } from '../src/game/explain';
import { Simulation } from '../src/sim/Simulation';
import { level, obj } from './helpers';

const entryAt = (code: string) => {
  const i = CAMPAIGN.findIndex((_, k) => levelCode(k) === code);
  const e = CAMPAIGN[i];
  return { lv: parseLevel(JSON.parse(JSON.stringify(e.level))).level, sol: e.solutions[0] };
};

/** Run like the game does until it solves, stalls (2 s still) or times out. */
const play = (lv: LevelDef, build: BuildDef) => {
  const sim = new Simulation(lv, build, { lenient: true });
  let still = 0;
  for (let i = 0; i < (lv.restrictions?.timeLimit ?? 30) * 60 && !sim.goals.solved; i++) {
    sim.step();
    sim.events.length = 0;
    still = sim.isStill() ? still + 1 : 0;
    if (still >= 120 && sim.time > 1.5) break;
  }
  return sim;
};

const nudged = (sol: BuildDef, id: string, dx: number): BuildDef => ({
  objects: sol.objects.map((o) => (o.id === id ? { ...o, x: o.x + dx } : o)),
  connections: sol.connections,
});

describe('reference runs', () => {
  it('trace the solving chain, split out the player’s own stages and remember them per level', () => {
    const { lv, sol } = entryAt('1-1');
    const ref = referenceFor(lv, sol)!;
    expect(ref.chain.length).toBeGreaterThan(3);
    expect(ref.playerKeys.size).toBeGreaterThan(0);
    for (const k of ref.playerKeys) expect(sol.objects.some((o) => k.split(/[>:]/).includes(o.id))).toBe(true);
    expect(referenceFor(lv, sol)).toBe(ref);
    expect(referenceFor(lv, null)).toBeNull();
  });
});

describe('explainRun', () => {
  it('a near miss is "So close!", with the step count and where it stopped', () => {
    const { lv, sol } = entryAt('1-4');
    const sim = play(lv, nudged(sol, 'dom-b', -30));
    expect(sim.goals.solved).toBe(false);
    const x = explainRun(sim, referenceFor(lv, sol));
    expect(x.tone).toBe('close');
    expect(x.title).toBe('So close!');
    expect(x.steps!.got / x.steps!.of).toBeGreaterThanOrEqual(0.5);
    expect(x.steps!.got).toBeLessThan(x.steps!.of);
    expect(x.text).toMatch(/^Your machine got \d+ of about \d+ steps, then stopped at the domino\. The bucket is still empty\.$/);
    expect(sim.entities.get(x.stopAt!)?.type).toBe('domino');
  });

  it('marks the loose part that came to rest short of the next step', () => {
    const { lv, sol } = entryAt('1-7');
    const sim = play(lv, nudged(sol, 'plank-b', 30));
    const x = explainRun(sim, referenceFor(lv, sol));
    expect(x.tone).toBe('close');
    expect(x.restAt).toBe('g1g-bball');
    expect(x.restAt).not.toBe(x.stopAt);
  });

  it('an empty build is "Nothing moved yet", naming where the machine stopped by itself', () => {
    const { lv, sol } = entryAt('1-1');
    const x = explainRun(play(lv, { objects: [], connections: [] }), referenceFor(lv, sol));
    expect(x.tone).toBe('nothing');
    expect(x.title).toBe('Nothing moved yet.');
    expect(x.text).toBe('The chain stopped at the bucket. Nothing went through the hoop.');
    expect(x.stopAt).toBeTruthy();
    expect(x.restAt).toBeNull();
  });

  it('a machine that never starts says so', () => {
    const { lv, sol } = entryAt('T4');
    const x = explainRun(play(lv, { objects: [], connections: [] }), referenceFor(lv, sol));
    expect(x.tone).toBe('nothing');
    expect(x.text).toBe('The machine never got started. The bucket is still empty.');
    expect(x.stopAt).toBeNull();
  });

  it('without a reference (custom levels) it names the last stage and the unmet goal', () => {
    const target = obj('ball', 400, 840, {}, { id: 'target' });
    const lv = level([target], [], [{ kind: 'enterRegion', target: { id: 'target' }, region: { x: 1300, y: 700, w: 200, h: 200 } }]);
    const drop: BuildDef = { objects: [obj('ball', 380, 600, {}, { id: 'mine' })], connections: [] };
    const sim = play(lv, drop);
    const x = explainRun(sim, null);
    expect(x.steps).toBeNull();
    expect(x.tone).toBe('partway');
    expect(x.title).toBe('Getting there.');
    expect(x.text).toMatch(/^The chain stopped at the rubber ball\. The rubber ball ended up .*goal zone\.$/);
    expect(['mine', 'target']).toContain(x.stopAt);
  });

  it('stays short on every campaign level (empty build and the reference minus a part)', () => {
    for (let i = 0; i < CAMPAIGN.length; i += 6) {
      const e = CAMPAIGN[i];
      const lv = parseLevel(JSON.parse(JSON.stringify(e.level))).level;
      const sol = e.solutions[0];
      const ref = traceReference(lv, sol);
      const less = { objects: sol.objects.slice(1), connections: sol.connections.filter((c) => c.kind === 'wire') };
      for (const b of [{ objects: [], connections: [] }, less]) {
        const sim = play(lv, b);
        if (sim.goals.solved) continue;
        const x = explainRun(sim, ref);
        expect(x.text.length, levelCode(i)).toBeLessThan(170);
        expect(x.text.split('. ').length, levelCode(i)).toBeLessThanOrEqual(2);
        if (x.steps) expect(x.steps.got).toBeLessThan(x.steps.of);
      }
    }
  }, 60000);
});
