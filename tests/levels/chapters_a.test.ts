// Headless validation for the tutorial and chapters 1–4.
// For every level: it parses, an empty build does not solve it, every authored solution solves it,
// solutions respect the inventory and world bounds, do not overlap locked scenery, and still solve
// when every placed object is nudged by a few pixels (so the intended idea is forgiving).

import { describe, expect, it } from 'vitest';
import '../../src/components';
import { getComponent } from '../../src/components';
import { parseLevel } from '../../src/core/level';
import type { BuildDef, LevelDef } from '../../src/core/types';
import { canPlace, countUsed } from '../../src/editor/inventory';
import { CHAPTER_0 } from '../../src/game/levels/ch00_tutorial';
import { CHAPTER_1 } from '../../src/game/levels/ch01';
import { CHAPTER_2 } from '../../src/game/levels/ch02';
import { CHAPTER_3 } from '../../src/game/levels/ch03';
import { CHAPTER_4 } from '../../src/game/levels/ch04';
import type { CampaignEntry } from '../../src/game/levels/types';
import { M, type MBody } from '../../src/sim/matter';
import { Simulation } from '../../src/sim/Simulation';

const CHAPTERS: [number, CampaignEntry[]][] = [
  [0, CHAPTER_0],
  [1, CHAPTER_1],
  [2, CHAPTER_2],
  [3, CHAPTER_3],
  [4, CHAPTER_4],
];
const ALL = CHAPTERS.flatMap(([, c]) => c);
const TOOLS = ['rope', 'belt', 'wire'];

/**
 * Builds that should NOT solve a level, because the level exists to teach why they fail
 * (light vs heavy, one switch is not two...). Guards against later engine tweaks quietly
 * turning a lesson into a freebie.
 */
const ob = (id: string, type: string, x: number, y: number, props: Record<string, string | number | boolean> = {}, angle = 0) => ({
  id,
  type,
  x,
  y,
  angle,
  props,
});
const COUNTEREXAMPLES: { level: string; why: string; build: BuildDef }[] = [
  {
    level: 'c1-double-trouble',
    why: 'one switch alone is not enough',
    build: { objects: [ob('p', 'plank', 870, 310, { length: 220 }, 0.3), ob('b', 'ball', 800, 200)], connections: [] },
  },
  {
    level: 'c2-featherweight',
    why: 'a single rubber ball only balances the crate',
    build: { objects: [ob('b', 'ball', 960, 250)], connections: [] },
  },
  {
    level: 'c2-heavy-lifting',
    why: 'a bucket of rubber balls is lighter than the steel crate',
    build: {
      objects: [
        ob('k', 'bucket', 1100, 300, { anchored: false }),
        ob('b1', 'ball', 1090, 300),
        ob('b2', 'ball', 1112, 290),
        ob('b3', 'ball', 1100, 250),
      ],
      connections: [
        { id: 'r', kind: 'rope', from: { obj: 'c2b-crate', port: 'hook' }, to: { obj: 'k', port: 'handle' }, via: ['c2b-pulley-l', 'c2b-pulley-r'] },
      ],
    },
  },
  {
    level: 'c3-push-comes-to-shove',
    why: 'a rubber ball has too little momentum',
    build: { objects: [ob('p', 'plank', 843, 277, { length: 450 }, 0.5), ob('b', 'ball', 700, 130)], connections: [] },
  },
  {
    level: 'c4-lever-expectations',
    why: 'a rubber ball is too light to work the lever',
    build: { objects: [ob('b', 'ball', 822, 200)], connections: [] },
  },
  {
    level: 'c4-knock-on-knockout',
    why: 'a rubber ball cannot shift the crate by itself',
    build: { objects: [ob('p', 'plank', 1130, 420, { length: 200 }, 0.35), ob('b', 'ball', 1060, 340)], connections: [] },
  },
];

const limitOf = (l: LevelDef) => l.restrictions?.timeLimit ?? 30;

const jitter = (b: BuildDef, dx: number, dy: number): BuildDef => ({
  objects: b.objects.map((o) => ({ ...o, x: o.x + dx, y: o.y + dy })),
  connections: b.connections,
});

const solves = (l: LevelDef, b: BuildDef) => new Simulation(l, b).runUntil(limitOf(l));

/** Depth of the deepest overlap between a placed body and any locked (fixed/starting) body at t=0. */
const worstOverlap = (l: LevelDef, b: BuildDef): { depth: number; what: string } => {
  const sim = new Simulation(l, b);
  const solidParts = (body: MBody) => (body.parts.length > 1 ? body.parts.slice(1) : [body]);
  const collidable = (body: MBody) => !body.isSensor && body.collisionFilter.mask !== 0;
  const locked = sim.list.filter((e) => e.alive && (e.origin === 'fixed' || e.origin === 'start'));
  const placed = sim.list.filter((e) => e.alive && e.origin === 'build');
  let depth = 0;
  let what = '';
  for (const p of placed)
    for (const pb of p.bodies.filter(collidable))
      for (const q of locked)
        for (const qb of q.bodies.filter(collidable)) {
          if (!M.Detector.canCollide(pb.collisionFilter, qb.collisionFilter)) continue;
          for (const pp of solidParts(pb))
            for (const qp of solidParts(qb)) {
              const c = M.Collision.collides(pp, qp);
              if (c && c.collided && c.depth > depth) {
                depth = c.depth;
                what = `${p.id} vs ${q.id}`;
              }
            }
        }
  // Placed parts against each other too.
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++)
      for (const pb of placed[i].bodies.filter(collidable))
        for (const qb of placed[j].bodies.filter(collidable)) {
          if (!M.Detector.canCollide(pb.collisionFilter, qb.collisionFilter)) continue;
          for (const pp of solidParts(pb))
            for (const qp of solidParts(qb)) {
              const c = M.Collision.collides(pp, qp);
              if (c && c.collided && c.depth > depth) {
                depth = c.depth;
                what = `${placed[i].id} vs ${placed[j].id}`;
              }
            }
        }
  return { depth, what };
};

describe('campaign chapters 0–4: structure', () => {
  it('has 5 tutorials and 2 levels in each of chapters 1–4', () => {
    expect(CHAPTER_0.length).toBe(5);
    for (const c of [CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4]) expect(c.length).toBe(2);
  });

  it('uses unique level ids', () => {
    const ids = ALL.map((e) => e.level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const [ch, entries] of CHAPTERS)
    for (const e of entries)
      it(`${e.level.id}: chapter number, metadata and content are sane`, () => {
        expect(e.chapter).toBe(ch);
        expect(e.level.metadata?.chapter).toBe(ch);
        expect(e.level.name.length).toBeGreaterThan(2);
        expect(e.level.description.length).toBeGreaterThan(20);
        expect(e.level.hints?.length ?? 0).toBeGreaterThanOrEqual(1);
        expect(e.level.hints!.length).toBeLessThanOrEqual(3);
        expect(e.level.goals.length).toBeGreaterThan(0);
        expect(e.level.restrictions?.timeLimit).toBeGreaterThan(0);
        expect(e.level.bonus).toBeTruthy();
        expect(e.solutions.length).toBeGreaterThan(0);
        if (ch === 0) expect(e.level.environment).toBe('garage');
      });
});

describe('campaign chapters 0–4: lessons hold', () => {
  for (const c of COUNTEREXAMPLES)
    it(`${c.level}: ${c.why}`, () => {
      const entry = ALL.find((e) => e.level.id === c.level)!;
      expect(entry).toBeTruthy();
      expect(new Simulation(entry.level, c.build).warnings).toEqual([]);
      expect(solves(entry.level, c.build)).toBe(false);
    });
});

for (const [, entries] of CHAPTERS) {
  for (const entry of entries) {
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
        for (const it of level.inventory) expect(TOOLS.includes(it.type) || !!getComponent(it.type)).toBe(true);
        // Every object sits inside the world.
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

      entry.solutions.forEach((sol, si) => {
        describe(`solution #${si + 1}`, () => {
          it('only uses the parts bin, within counts', () => {
            const used = countUsed(sol);
            for (const [type, n] of used) {
              const row = level.inventory.find((r) => r.type === type);
              expect(row, `${type} not in inventory`).toBeTruthy();
              if (row!.count >= 0) expect(n, `${type} over count`).toBeLessThanOrEqual(row!.count);
            }
            // Replay placement one item at a time through the editor's own rule.
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
}
