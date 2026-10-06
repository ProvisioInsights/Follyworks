// Headless validation for every campaign level (tutorial and mission groups).
// For every level: it parses, an empty build does not solve it, every authored solution solves it,
// solutions respect the inventory and world bounds, do not overlap locked scenery, and still solve
// when every placed object is nudged by a few pixels (so the intended idea is forgiving). Listed
// counterexamples must fail, and each group must ramp up in difficulty.

import { describe, expect, it } from 'vitest';
import '../../src/components';
import { getComponent } from '../../src/components';
import { parseLevel, STANDARD_WORLD } from '../../src/core/level';
import type { BuildDef, LevelDef } from '../../src/core/types';
import { canPlace, countUsed } from '../../src/editor/inventory';
import { CAMPAIGN, CHAPTERS } from '../../src/game/campaign';
import type { CampaignEntry } from '../../src/game/levels/types';
import { M, type MBody } from '../../src/sim/matter';
import { Simulation } from '../../src/sim/Simulation';

const TOOLS = ['rope', 'belt', 'wire'];
const limitOf = (l: LevelDef) => l.restrictions?.timeLimit ?? 30;

const jitter = (b: BuildDef, dx: number, dy: number): BuildDef => ({
  objects: b.objects.map((o) => ({ ...o, x: o.x + dx, y: o.y + dy })),
  connections: b.connections,
});

const solves = (l: LevelDef, b: BuildDef) => new Simulation(l, b).runUntil(limitOf(l));

/** Parts the simplest reference build places (objects plus ropes and belts; wires are free). */
export const partsNeeded = (e: CampaignEntry) => e.solutions[0].objects.length + e.solutions[0].connections.filter((c) => c.kind !== 'wire').length;
/** Machinery already in the room: every non-wall fixed or starting object. */
export const startingThings = (e: CampaignEntry) => [...e.level.fixedObjects, ...e.level.startingObjects].filter((o) => o.type !== 'wall').length;

/** Depth of the deepest overlap between a placed body and any locked (fixed/starting) or other placed body at t=0. */
const worstOverlap = (l: LevelDef, b: BuildDef): { depth: number; what: string } => {
  const sim = new Simulation(l, b);
  const solidParts = (body: MBody) => (body.parts.length > 1 ? body.parts.slice(1) : [body]);
  const collidable = (body: MBody) => !body.isSensor && body.collisionFilter.mask !== 0;
  const locked = sim.list.filter((e) => e.alive && (e.origin === 'fixed' || e.origin === 'start'));
  const placed = sim.list.filter((e) => e.alive && e.origin === 'build');
  let depth = 0;
  let what = '';
  const check = (a: typeof placed[number], b: typeof placed[number]) => {
    for (const pb of a.bodies.filter(collidable))
      for (const qb of b.bodies.filter(collidable)) {
        if (!M.Detector.canCollide(pb.collisionFilter, qb.collisionFilter)) continue;
        for (const pp of solidParts(pb))
          for (const qp of solidParts(qb)) {
            const c = M.Collision.collides(pp, qp);
            if (c && c.collided && c.depth > depth) {
              depth = c.depth;
              what = `${a.id} vs ${b.id}`;
            }
          }
      }
  };
  for (const p of placed) for (const q of locked) check(p, q);
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) check(placed[i], placed[j]);
  return { depth, what };
};

describe('campaign structure', () => {
  it('uses unique level ids', () => {
    const ids = CAMPAIGN.map((e) => e.level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every level belongs to a known group, in group order', () => {
    const order = CHAPTERS.map((c) => c.index);
    let last = -1;
    for (const e of CAMPAIGN) {
      const k = order.indexOf(e.chapter);
      expect(k, e.level.id).toBeGreaterThanOrEqual(0);
      expect(k, e.level.id).toBeGreaterThanOrEqual(last);
      last = k;
    }
  });

  it('has a short tutorial and about ten missions per group', () => {
    const tut = CAMPAIGN.filter((e) => e.chapter === 0);
    expect(tut.length).toBeGreaterThanOrEqual(4);
    expect(tut.length).toBeLessThanOrEqual(7);
    for (const ch of CHAPTERS.filter((c) => c.index > 0)) {
      const n = CAMPAIGN.filter((e) => e.chapter === ch.index).length;
      expect(n, ch.title).toBeGreaterThanOrEqual(8);
      expect(n, ch.title).toBeLessThanOrEqual(12);
    }
  });

  for (const e of CAMPAIGN)
    it(`${e.level.id}: metadata and content are sane`, () => {
      expect(e.level.metadata?.chapter).toBe(e.chapter);
      expect(e.level.name.length).toBeGreaterThan(2);
      expect(e.level.description.length).toBeGreaterThan(20);
      expect(e.level.hints?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(e.level.hints!.length).toBeLessThanOrEqual(3);
      expect(e.level.goals.length).toBeGreaterThan(0);
      expect(e.level.restrictions?.timeLimit).toBeGreaterThan(0);
      expect(e.level.bonus).toBeTruthy();
      expect(e.solutions.length).toBeGreaterThan(0);
      expect(e.level.world.width).toBe(STANDARD_WORLD.width);
      expect(e.level.world.height).toBe(STANDARD_WORLD.height);
      if (e.chapter === 0) {
        expect(e.level.metadata?.tutorial).toBe(true);
        expect(e.level.guide?.length ?? 0, 'tutorials have guidance').toBeGreaterThan(0);
      }
    });
});

describe('difficulty ramps up', () => {
  const groups = CHAPTERS.map((c) => CAMPAIGN.filter((e) => e.chapter === c.index)).filter((g) => g.length > 1);
  const decreases = (xs: number[]) => xs.filter((x, i) => i > 0 && x < xs[i - 1]).length;

  for (const g of groups) {
    const name = CHAPTERS.find((c) => c.index === g[0].chapter)!.title;
    it(`${name}: missions need more parts and start with more machinery as they go`, () => {
      const needed = g.map(partsNeeded);
      const things = g.map(startingThings);
      const half = Math.floor(g.length / 2);
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      expect(needed[needed.length - 1], `parts needed ${needed}`).toBeGreaterThan(needed[0]);
      expect(things[things.length - 1], `starting things ${things}`).toBeGreaterThan(things[0]);
      expect(avg(needed.slice(half)), `parts needed ${needed}`).toBeGreaterThan(avg(needed.slice(0, half)));
      expect(avg(things.slice(half)), `starting things ${things}`).toBeGreaterThan(avg(things.slice(0, half)));
      expect(decreases(needed), `parts needed ${needed}`).toBeLessThanOrEqual(2);
      expect(decreases(things), `starting things ${things}`).toBeLessThanOrEqual(3);
    });
  }

  it('each group starts at least as hard as the previous one started', () => {
    for (let i = 1; i < groups.length; i++) {
      expect(partsNeeded(groups[i][0])).toBeGreaterThanOrEqual(partsNeeded(groups[i - 1][0]));
      expect(Math.max(...groups[i].map(partsNeeded))).toBeGreaterThan(Math.max(...groups[i - 1].map(partsNeeded)));
    }
  });
});

for (const entry of CAMPAIGN) {
  const level = entry.level;
  describe(`${level.id} — ${level.name}`, () => {
    it('parses cleanly and round-trips through JSON', () => {
      const { level: parsed, problems } = parseLevel(JSON.parse(JSON.stringify(level)));
      expect(problems).toEqual([]);
      expect(parsed.id).toBe(level.id);
      expect(parsed.fixedObjects.map((o) => o.id)).toEqual(level.fixedObjects.map((o) => o.id));
      expect(parsed.startingObjects.map((o) => o.id)).toEqual(level.startingObjects.map((o) => o.id));
      expect(parsed.connections.map((c) => c.id)).toEqual(level.connections.map((c) => c.id));
      expect(parsed.goals.length).toBe(level.goals.length);
      expect(parsed.guide?.length ?? 0).toBe(level.guide?.length ?? 0);
      for (const it of level.inventory) expect(TOOLS.includes(it.type) || !!getComponent(it.type)).toBe(true);
      for (const o of [...level.fixedObjects, ...level.startingObjects]) {
        expect(o.x).toBeGreaterThanOrEqual(0);
        expect(o.x).toBeLessThanOrEqual(level.world.width);
        expect(o.y).toBeGreaterThanOrEqual(0);
        expect(o.y).toBeLessThanOrEqual(level.world.height);
      }
      const sim = new Simulation(parsed, { objects: [], connections: [] });
      expect(sim.warnings).toEqual([]);
      expect(sim.ropes.length + sim.wires.length + sim.belts.length).toBe(parsed.connections.length);
    });

    it('is not solved by doing nothing', () => {
      expect(solves(level, { objects: [], connections: [] })).toBe(false);
    });

    for (const c of entry.counterexamples ?? [])
      it(`is not solved when ${c.why}`, () => {
        expect(new Simulation(level, c.build).warnings).toEqual([]);
        expect(solves(level, c.build)).toBe(false);
      });

    if (level.guide)
      it('guidance ghosts are placeable parts from the bin and solve-compatible', () => {
        for (const step of level.guide!) {
          if (step.ghost) expect(level.inventory.some((i) => i.type === step.ghost!.type), step.ghost.type).toBe(true);
          if (step.until.kind === 'place') expect(level.inventory.some((i) => i.type === (step.until as { type: string }).type)).toBe(true);
          if (step.point && 'bin' in step.point) expect(level.inventory.some((i) => i.type === (step.point as { bin: string }).bin)).toBe(true);
        }
      });

    entry.solutions.forEach((sol, si) => {
      describe(`solution #${si + 1}`, () => {
        it('only uses the parts bin, within counts', () => {
          const used = countUsed(sol);
          for (const [type, n] of used) {
            const row = level.inventory.find((r) => r.type === type);
            expect(row, `${type} not in inventory`).toBeTruthy();
            if (row!.count >= 0) expect(n, `${type} over count`).toBeLessThanOrEqual(row!.count);
          }
          const partial: BuildDef = { objects: [], connections: [] };
          for (const o of sol.objects) {
            expect(canPlace(level, partial, o.type, false).ok, `cannot place ${o.type}`).toBe(true);
            partial.objects.push(o);
          }
          for (const c of sol.connections) {
            expect(canPlace(level, partial, c.kind, false).ok, `cannot place ${c.kind}`).toBe(true);
            partial.connections.push(c);
          }
          const ids = [...level.fixedObjects, ...level.startingObjects].map((o) => o.id);
          for (const o of sol.objects) expect(ids).not.toContain(o.id);
        });

        it('placed parts are in bounds and do not overlap anything', () => {
          const sim = new Simulation(level, sol);
          expect(sim.warnings).toEqual([]);
          for (const e of sim.list.filter((x) => x.origin === 'build')) {
            for (const b of e.bodies) {
              expect(b.bounds.min.x, `${e.id} left`).toBeGreaterThanOrEqual(0);
              expect(b.bounds.max.x, `${e.id} right`).toBeLessThanOrEqual(level.world.width);
              expect(b.bounds.min.y, `${e.id} top`).toBeGreaterThanOrEqual(0);
              expect(b.bounds.max.y, `${e.id} bottom`).toBeLessThanOrEqual(level.world.height);
            }
          }
          const ov = worstOverlap(level, sol);
          expect(ov.depth, ov.what).toBeLessThanOrEqual(2);
        });

        it('solves within the time limit', () => {
          expect(solves(level, sol)).toBe(true);
        });

        it('still solves with every placed part nudged ±4px', () => {
          const combos: [number, number][] = [
            [4, 0],
            [-4, 0],
            [0, 4],
            [0, -4],
            [4, 4],
            [-4, -4],
          ];
          const failed = combos.filter(([dx, dy]) => !solves(level, jitter(sol, dx, dy)));
          expect(failed).toEqual([]);
        });
      });
    });
  });
}
