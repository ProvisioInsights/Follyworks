// Shared headless checks for one level entry (CampaignEntry shape): it parses, an empty build
// doesn't solve it, every reference solution respects the parts bin, stays in bounds without
// overlapping anything, solves within the time limit and still solves when nudged ±4 px, and
// every listed counterexample fails. Used by the Physics Lab tests; mirrors the per-level checks
// in campaign.test.ts (which stay there so the campaign file is untouched).

import { describe, expect, it } from 'vitest';
import '../../src/components';
import { getComponent } from '../../src/components';
import { parseLevel } from '../../src/core/level';
import type { BuildDef, LevelDef } from '../../src/core/types';
import { canPlace, countUsed } from '../../src/editor/inventory';
import type { CampaignEntry } from '../../src/game/levels/types';
import { M, type MBody } from '../../src/sim/matter';
import { Simulation } from '../../src/sim/Simulation';

const TOOLS = ['rope', 'belt', 'wire'];
export const limitOf = (l: LevelDef) => l.restrictions?.timeLimit ?? 30;
export const solves = (l: LevelDef, b: BuildDef) => new Simulation(l, b).runUntil(limitOf(l));
const jitter = (b: BuildDef, dx: number, dy: number): BuildDef => ({
  objects: b.objects.map((o) => ({ ...o, x: o.x + dx, y: o.y + dy })),
  connections: b.connections,
});

/** Deepest overlap between a placed body and any locked or other placed body at t=0. */
export const worstOverlap = (l: LevelDef, b: BuildDef): { depth: number; what: string } => {
  const sim = new Simulation(l, b);
  const solidParts = (body: MBody) => (body.parts.length > 1 ? body.parts.slice(1) : [body]);
  const collidable = (body: MBody) => !body.isSensor && body.collisionFilter.mask !== 0;
  const locked = sim.list.filter((e) => e.alive && (e.origin === 'fixed' || e.origin === 'start'));
  const placed = sim.list.filter((e) => e.alive && e.origin === 'build');
  let depth = 0;
  let what = '';
  const check = (a: (typeof placed)[number], q: (typeof placed)[number]) => {
    for (const pb of a.bodies.filter(collidable))
      for (const qb of q.bodies.filter(collidable)) {
        if (!M.Detector.canCollide(pb.collisionFilter, qb.collisionFilter)) continue;
        for (const pp of solidParts(pb))
          for (const qp of solidParts(qb)) {
            const c = M.Collision.collides(pp, qp);
            if (c && c.collided && c.depth > depth) {
              depth = c.depth;
              what = `${a.id} vs ${q.id}`;
            }
          }
      }
  };
  for (const p of placed) for (const q of locked) check(p, q);
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) check(placed[i], placed[j]);
  return { depth, what };
};

export const describeEntryChecks = (entry: CampaignEntry) => {
  const level = entry.level;
  describe(`${level.id} — ${level.name}`, () => {
    it('parses cleanly and round-trips through JSON', () => {
      const { level: parsed, problems } = parseLevel(JSON.parse(JSON.stringify(level)));
      expect(problems).toEqual([]);
      expect(parsed.fixedObjects.map((o) => o.id)).toEqual(level.fixedObjects.map((o) => o.id));
      expect(parsed.startingObjects.map((o) => o.id)).toEqual(level.startingObjects.map((o) => o.id));
      expect(parsed.connections.map((c) => c.id)).toEqual(level.connections.map((c) => c.id));
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

    entry.solutions.forEach((sol, si) => {
      describe(`solution #${si + 1}`, () => {
        it('only uses the parts bin, within counts', () => {
          for (const [type, n] of countUsed(sol)) {
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
        });

        it('placed parts are in bounds and do not overlap anything', () => {
          const sim = new Simulation(level, sol);
          expect(sim.warnings).toEqual([]);
          for (const e of sim.list.filter((x) => x.origin === 'build'))
            for (const b of e.bodies) {
              expect(b.bounds.min.x, `${e.id} left`).toBeGreaterThanOrEqual(0);
              expect(b.bounds.max.x, `${e.id} right`).toBeLessThanOrEqual(level.world.width);
              expect(b.bounds.min.y, `${e.id} top`).toBeGreaterThanOrEqual(0);
              expect(b.bounds.max.y, `${e.id} bottom`).toBeLessThanOrEqual(level.world.height);
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
          expect(combos.filter(([dx, dy]) => !solves(level, jitter(sol, dx, dy)))).toEqual([]);
        });
      });
    });
  });
};
