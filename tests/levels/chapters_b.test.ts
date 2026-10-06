// Headless validation for campaign chapters 5-10 (designer B).
// Every level must parse cleanly, stay unsolved with an empty build, and every authored
// solution must solve within the time limit, respect the parts bin, stay in bounds, avoid
// overlapping existing objects, and survive ±4 px placement jitter.

import { describe, expect, it } from 'vitest';
import '../../src/components';
import { getComponent } from '../../src/components';
import { parseBuild, parseLevel } from '../../src/core/level';
import type { BuildDef, LevelDef } from '../../src/core/types';
import { canPlace, countUsed } from '../../src/editor/inventory';
import type { CampaignEntry } from '../../src/game/levels/types';
import { CHAPTER_5 } from '../../src/game/levels/ch05';
import { CHAPTER_6 } from '../../src/game/levels/ch06';
import { CHAPTER_7 } from '../../src/game/levels/ch07';
import { CHAPTER_8 } from '../../src/game/levels/ch08';
import { CHAPTER_9 } from '../../src/game/levels/ch09';
import { CHAPTER_10 } from '../../src/game/levels/ch10';
import { M } from '../../src/sim/matter';
import { Simulation } from '../../src/sim/Simulation';

const CHAPTERS: [number, CampaignEntry[]][] = [
  [5, CHAPTER_5],
  [6, CHAPTER_6],
  [7, CHAPTER_7],
  [8, CHAPTER_8],
  [9, CHAPTER_9],
  [10, CHAPTER_10],
];
const ALL = CHAPTERS.flatMap(([, list]) => list);
const TOOL_TYPES = ['rope', 'belt', 'wire'];
const JITTER: [number, number][] = [
  [-4, -4],
  [4, 4],
  [-4, 4],
  [4, -4],
  [4, 0],
  [0, -4],
];

const w = (id: string, from: string, fromPort: string, to: string, toPort: string) => ({
  id,
  kind: 'wire' as const,
  from: { obj: from, port: fromPort },
  to: { obj: to, port: toPort },
});
const ob = (id: string, type: string, x: number, y: number, props: Record<string, any> = {}, angle = 0) => ({ id, type, x, y, angle, props });

/** Tempting shortcuts that must NOT solve a level (keeps the intended idea load-bearing). */
const SHORTCUTS: Record<string, { why: string; build: BuildDef }[]> = {
  'c5-counter-culture': [
    {
      why: 'an empty bucket is lighter than the crate',
      build: { objects: [ob('x-bucket', 'bucket', 980, 300, { anchored: false })], connections: [{ id: 'x-r', kind: 'rope', from: { obj: 'c5a-crate', port: 'hook' }, to: { obj: 'x-bucket', port: 'handle' }, via: ['c5a-pulley'] }] },
    },
  ],
  'c6-belt-up': [
    { why: 'driving only the top conveyor strands the crate', build: { objects: [], connections: [{ id: 'x-b', kind: 'belt', from: { obj: 'c6a-motor', port: 'rotor' }, to: { obj: 'c6a-top', port: 'rotor' } }] } },
    {
      why: 'belting the motor straight to both conveyors runs the bottom one the wrong way',
      build: {
        objects: [],
        connections: [
          { id: 'x-b1', kind: 'belt', from: { obj: 'c6a-motor', port: 'rotor' }, to: { obj: 'c6a-top', port: 'rotor' } },
          { id: 'x-b2', kind: 'belt', from: { obj: 'c6a-motor', port: 'rotor' }, to: { obj: 'c6a-bottom', port: 'rotor' } },
        ],
      },
    },
  ],
  'c7-lighter-than-air': [
    {
      why: 'three balloons at default lift cannot raise a 3 kg crate',
      build: {
        objects: [ob('x-b1', 'balloon', 760, 700), ob('x-b2', 'balloon', 800, 660), ob('x-b3', 'balloon', 840, 700)],
        connections: ['x-b1', 'x-b2', 'x-b3'].map((b, i) => ({ id: `x-r${i}`, kind: 'rope' as const, from: { obj: b, port: 'string' }, to: { obj: 'c7b-crate', port: 'hook' } })),
      },
    },
  ],
  'c8-wake-up-call': [
    { why: 'Bolt powered non-stop wanders back out of the dock', build: { objects: [ob('x-bat', 'battery', 60, 871)], connections: [w('x-w', 'x-bat', 'out', 'c8a-bolt', 'in')] } },
  ],
  'c8-flip-the-switch': [
    { why: 'wiring the battery straight to the conveyor leaves the switch off', build: { objects: [], connections: [w('x-w', 'c8b-battery', 'out', 'c8b-conveyor', 'in')] } },
  ],
  'c9-wait-for-it': [
    { why: 'punching immediately drops the ball before the bucket arrives', build: { objects: [], connections: [w('x-w', 'c9a-battery', 'out', 'c9a-glove', 'in')] } },
  ],
  'c9-puff-piece': [
    { why: 'a fan that never stops blows the balloon onto the cactus', build: { objects: [], connections: [w('x-w', 'c9b-battery', 'out', 'c9b-fan', 'in')] } },
  ],
  'c10-social-climber': [
    { why: 'a flat plank bridge just bumps Bolt into the penthouse wall', build: { objects: [ob('x-plank', 'plank', 750, 907, { length: 300 })], connections: [] } },
  ],
  'c10-party-pooper': [
    { why: 'one candle frees only one balloon', build: { objects: [ob('x-candle', 'candle', 402, 1171)], connections: [] } },
  ],
};

const parsed = (entry: CampaignEntry): LevelDef => {
  const { level, problems } = parseLevel(JSON.parse(JSON.stringify(entry.level)));
  expect(problems).toEqual([]);
  return level;
};

const limitOf = (l: LevelDef) => l.restrictions?.timeLimit ?? 30;

const solves = (level: LevelDef, build: BuildDef) => {
  const b = parseBuild(JSON.parse(JSON.stringify(build)), level);
  expect(b.objects.length).toBe(build.objects.length);
  expect(b.connections.length).toBe(build.connections.length);
  const sim = new Simulation(level, b);
  expect(sim.warnings).toEqual([]);
  return sim.runUntil(limitOf(level));
};

/** Jitter combo k: each placed object gets its own offset from the pattern, so parts shift relative to each other too. */
const jittered = (build: BuildDef, k: number): BuildDef => ({
  objects: build.objects.map((o, i) => {
    const [dx, dy] = JITTER[(k + i * 2) % JITTER.length];
    return { ...o, x: o.x + dx, y: o.y + dy };
  }),
  connections: build.connections,
});

/** Leaf collision parts of a body (compound bodies list themselves first). */
const leafParts = (b: any): any[] => (b.parts.length > 1 ? b.parts.slice(1) : [b]);

/** Pairs of overlapping solid bodies between a placed object and anything else, at construction. */
const overlaps = (level: LevelDef, build: BuildDef): string[] => {
  const sim = new Simulation(level, build);
  const placed = new Set(build.objects.map((o) => o.id));
  const out: string[] = [];
  const ents = sim.list.filter((e) => e.alive);
  for (const e of ents) {
    if (!placed.has(e.id)) continue;
    for (const other of ents) {
      if (other === e) continue;
      // Each placed pair is checked once.
      if (placed.has(other.id) && other.id < e.id) continue;
      for (const ba of e.bodies) {
        for (const bb of other.bodies) {
          for (const pa of leafParts(ba)) {
            for (const pb of leafParts(bb)) {
              if (pa.isSensor || pb.isSensor) continue;
              // Gears are meant to sit snugly against motors and other gears to mesh.
              if (pa.label === 'gear' || pb.label === 'gear') continue;
              if (!M.Detector.canCollide(pa.collisionFilter, pb.collisionFilter)) continue;
              const c = M.Collision.collides(pa, pb);
              if (c && c.collided && c.depth > 1) out.push(`${e.id} overlaps ${other.id} (depth ${c.depth.toFixed(1)})`);
            }
          }
        }
      }
    }
  }
  return out;
};

const outOfBounds = (level: LevelDef, build: BuildDef): string[] => {
  const sim = new Simulation(level, build);
  const placed = new Set(build.objects.map((o) => o.id));
  const out: string[] = [];
  const { width, height } = level.world;
  for (const e of sim.list) {
    if (!placed.has(e.id)) continue;
    for (const b of e.bodies) {
      const { min, max } = b.bounds;
      if (min.x < -1 || min.y < -1 || max.x > width + 1 || max.y > height + 1) out.push(`${e.id} out of bounds`);
    }
  }
  return out;
};

describe('chapters 5-10: catalogue', () => {
  it('has two levels per chapter with matching chapter numbers', () => {
    for (const [n, list] of CHAPTERS) {
      expect(list.length).toBe(2);
      for (const entry of list) {
        expect(entry.chapter).toBe(n);
        expect(entry.level.metadata?.chapter).toBe(n);
        expect(entry.solutions.length).toBeGreaterThan(0);
      }
    }
  });

  it('uses unique ids and varied environments', () => {
    const ids = ALL.map((e) => e.level.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ALL.map((e) => e.level.environment)).size).toBeGreaterThanOrEqual(5);
  });

  it('features Bolt as a goal and several multi-approach levels', () => {
    const boltGoal = ALL.some((e) =>
      e.level.goals.some((g) => g.kind === 'enterRegion' && ('type' in g.target ? g.target.type === 'robot' : [...e.level.startingObjects].some((o) => o.type === 'robot' && 'id' in g.target && g.target.id === o.id))),
    );
    expect(boltGoal).toBe(true);
    expect(ALL.filter((e) => e.solutions.length >= 2).length).toBeGreaterThanOrEqual(4);
  });
});

for (const [n, list] of CHAPTERS) {
  describe(`chapter ${n}`, () => {
    for (const entry of list) {
      const L = entry.level;
      describe(`${L.id} — ${L.name}`, () => {
        it('parses cleanly and round-trips', () => {
          const level = parsed(entry);
          const again = parseLevel(JSON.parse(JSON.stringify(level)));
          expect(again.problems).toEqual([]);
          expect(again.level).toEqual(level);
          expect(level.fixedObjects.length).toBe(L.fixedObjects.length);
          expect(level.startingObjects.length).toBe(L.startingObjects.length);
          expect(level.connections.length).toBe(L.connections.length);
          expect(level.goals.length).toBe(L.goals.length);
          for (const it of level.inventory) expect(TOOL_TYPES.includes(it.type) || !!getComponent(it.type)).toBe(true);
          expect(L.name.length).toBeGreaterThan(2);
          expect(L.description.length).toBeGreaterThan(20);
          expect(L.hints?.length ?? 0).toBeGreaterThanOrEqual(1);
          expect(L.hints!.length).toBeLessThanOrEqual(3);
          expect(L.restrictions?.timeLimit).toBeGreaterThan(0);
          expect(L.bonus).toBeTruthy();
          // Authored starting state is legal: nothing out of the world.
          for (const o of [...level.fixedObjects, ...level.startingObjects]) {
            expect(o.x).toBeGreaterThanOrEqual(0);
            expect(o.x).toBeLessThanOrEqual(level.world.width);
            expect(o.y).toBeGreaterThanOrEqual(0);
            expect(o.y).toBeLessThanOrEqual(level.world.height);
          }
        });

        it('is not solved by an empty build', () => {
          const level = parsed(entry);
          const sim = new Simulation(level, { objects: [], connections: [] });
          expect(sim.warnings).toEqual([]);
          expect(sim.runUntil(limitOf(level))).toBe(false);
        });

        for (const sc of SHORTCUTS[L.id] ?? []) {
          it(`shortcut fails: ${sc.why}`, () => {
            expect(solves(parsed(entry), sc.build)).toBe(false);
          });
        }

        entry.solutions.forEach((sol, si) => {
          describe(`solution ${si + 1}`, () => {
            it('respects the parts bin, bounds and placement', () => {
              const level = parsed(entry);
              const used = countUsed(sol);
              const partial: BuildDef = { objects: [], connections: [] };
              for (const o of sol.objects) {
                expect(canPlace(level, partial, o.type, false), `${o.type} placeable`).toMatchObject({ ok: true });
                partial.objects.push(o);
              }
              for (const c of sol.connections) {
                expect(canPlace(level, partial, c.kind, false), `${c.kind} placeable`).toMatchObject({ ok: true });
                partial.connections.push(c);
              }
              for (const [type, n] of used) {
                const row = level.inventory.find((i) => i.type === type);
                expect(row, `${type} in inventory`).toBeTruthy();
                if (row!.count >= 0) expect(n).toBeLessThanOrEqual(row!.count);
              }
              expect(outOfBounds(level, sol)).toEqual([]);
              expect(overlaps(level, sol)).toEqual([]);
            });

            it('solves within the time limit', () => {
              expect(solves(parsed(entry), sol)).toBe(true);
            });

            it('still solves with ±4 px placement jitter', () => {
              const level = parsed(entry);
              const failed = JITTER.map((_, k) => k).filter((k) => !solves(level, jittered(sol, k)));
              expect(failed).toEqual([]);
            });
          });
        });
      });
    }
  });
}
