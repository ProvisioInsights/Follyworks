// Rewind history (src/sim/history.ts) and Simulation snapshot/restore determinism.

import { describe, expect, it } from 'vitest';
import '../src/components';
import { History } from '../src/sim/history';
import type { Simulation } from '../src/sim/Simulation';
import { obj, sim, wire } from './helpers';

const pose = (s: Simulation) => s.tracked.flatMap((b) => [b.position.x, b.position.y, b.angle]);
const maxDiff = (a: number[], b: number[]) => {
  expect(a.length).toBe(b.length);
  return a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
};
const steps = (s: Simulation, n: number) => {
  for (let i = 0; i < n; i++) s.step();
  return s;
};

/** A small busy scene: a ball rolls down a ramp into a row of dominoes. */
const dominoScene = () =>
  sim([
    obj('ball', 200, 640, {}, { id: 'ball' }),
    obj('plank', 260, 720, { length: 220 }, { id: 'ramp', angle: 0.45 }),
    ...[0, 1, 2, 3, 4, 5].map((i) => obj('domino', 420 + i * 40, 860, {}, { id: `d${i}` })),
  ]);
const fallScene = () => sim([obj('ball', 400, 100, {}, { id: 'a' }), obj('crate', 700, 150, {}, { id: 'c' })]);

describe('History buffer', () => {
  it('records every `interval` ticks, and only moves forward', () => {
    const h = new History(3, 100);
    const s = fallScene();
    h.record(s, true); // tick 0
    for (let i = 0; i < 12; i++) {
      s.step();
      h.record(s);
    }
    expect(h.length).toBe(5);
    expect([0, 1, 2, 3, 4].map((i) => h.at(i).tick)).toEqual([0, 3, 6, 9, 12]);
    h.record(s); // same tick again: ignored
    h.record(s, true); // even when forced
    expect(h.length).toBe(5);
  });

  it('force records off-interval ticks', () => {
    const h = new History(10, 100);
    const s = fallScene();
    s.step();
    h.record(s);
    expect(h.length).toBe(0);
    h.record(s, true);
    expect(h.length).toBe(1);
    expect(h.first.tick).toBe(1);
  });

  it('is bounded: keeps only the newest `max` snapshots', () => {
    const h = new History(1, 50);
    const s = sim([obj('ball', 400, 100)]);
    for (let i = 0; i < 1000; i++) {
      s.step();
      h.record(s);
    }
    expect(h.length).toBe(50);
    expect(h.first.tick).toBe(951);
    expect(h.last.tick).toBe(1000);
    for (let i = 1; i < h.length; i++) expect(h.at(i).tick).toBe(h.at(i - 1).tick + 1);
  });

  it('the in-game configuration (every 2 ticks, 2700 max) covers 90 seconds', () => {
    const h = new History();
    expect(h.interval).toBe(2);
    expect(h.max).toBe(2700);
    expect((h.interval * h.max) / 60).toBe(90);
  });

  it('a snapshot stores a fixed-size kinematics block per tracked body', () => {
    const s = dominoScene();
    const snap = s.snapshot();
    expect(snap.kin).toBeInstanceOf(Float64Array);
    expect(snap.kin.length).toBe(s.tracked.length * 6);
    expect(snap.ents).toHaveLength(s.list.length);
  });

  it('at() clamps the index', () => {
    const h = new History(1, 10);
    const s = fallScene();
    for (let i = 0; i < 3; i++) {
      s.step();
      h.record(s);
    }
    expect(h.at(-5).tick).toBe(1);
    expect(h.at(99).tick).toBe(3);
    expect(new History().at(0)).toBeUndefined();
  });

  it('indexAtOrBefore finds the latest snapshot at or before a tick (binary search)', () => {
    const h = new History(5, 100);
    const s = sim([obj('ball', 400, 100)]);
    h.record(s, true);
    for (let i = 0; i < 50; i++) {
      s.step();
      h.record(s);
    }
    // ticks 0,5,...,50
    expect(h.indexAtOrBefore(0)).toBe(0);
    expect(h.indexAtOrBefore(4)).toBe(0);
    expect(h.indexAtOrBefore(5)).toBe(1);
    expect(h.indexAtOrBefore(27)).toBe(5);
    expect(h.indexAtOrBefore(50)).toBe(10);
    expect(h.indexAtOrBefore(10_000)).toBe(10);
    // before the first snapshot it clamps to the first one rather than -1
    expect(h.indexAtOrBefore(-3)).toBe(0);
    expect(new History().indexAtOrBefore(5)).toBe(-1);
  });

  it('truncateAfter drops the abandoned future and recording resumes after a rewind', () => {
    const h = new History(1, 100);
    const s = fallScene();
    h.record(s, true);
    for (let i = 0; i < 20; i++) {
      s.step();
      h.record(s);
    }
    const i = h.indexAtOrBefore(8);
    s.restore(h.at(i));
    // without truncation, older ticks are refused
    s.step();
    h.record(s);
    expect(h.length).toBe(21);
    h.truncateAfter(i);
    expect(h.length).toBe(9);
    expect(h.last.tick).toBe(8);
    s.restore(h.last);
    s.step();
    h.record(s);
    expect(h.length).toBe(10);
    expect(h.last.tick).toBe(9);
    h.truncateAfter(-1);
    expect(h.length).toBe(0);
    h.truncateAfter(500);
    expect(h.length).toBe(0);
  });

  it('clear empties the buffer', () => {
    const h = new History(1, 10);
    h.record(fallScene(), true);
    h.clear();
    expect(h.length).toBe(0);
    expect(h.last).toBeUndefined();
  });
});

describe('Simulation determinism and snapshot/restore', () => {
  it('two simulations of the same level are bit-identical', () => {
    const a = steps(dominoScene(), 240);
    const b = steps(dominoScene(), 240);
    expect(pose(a)).toEqual(pose(b));
    expect(a.chain.map((c) => c.key)).toEqual(b.chain.map((c) => c.key));
  });

  it('restore puts every tracked body back where the snapshot had it', () => {
    const s = steps(dominoScene(), 60);
    const snap = s.snapshot();
    const at = pose(s);
    steps(s, 90);
    expect(maxDiff(pose(s), at)).toBeGreaterThan(1);
    s.restore(snap);
    expect(s.tick).toBe(60);
    expect(s.time).toBeCloseTo(1, 10);
    expect(maxDiff(pose(s), at)).toBeLessThan(1e-9);
  });

  it('rewinding and re-running a contact-free stretch reproduces the original', () => {
    const s = steps(fallScene(), 5);
    const snap = s.snapshot();
    steps(s, 30);
    const ref = pose(s);
    s.restore(snap);
    steps(s, 30);
    expect(maxDiff(pose(s), ref)).toBeLessThan(1e-6);
  });

  // BUG (src/sim/Simulation.ts:601-631, restore): rewinding to a snapshot and re-running does not
  // reproduce the original run once bodies touch. Two causes:
  //  1. restore uses M.Body.setPosition/setAngle, which apply a *delta* (pos += target - pos), so
  //     restored positions are off by ~1e-14 (e.g. 114.54645529854535 -> ...531); and
  //  2. Matter's contact cache (pairs, warm-start impulses, body.positionImpulse/constraintImpulse)
  //     is not captured: restore clears pairs, so resting/ongoing contacts solve differently.
  // Repro: dominoScene, step 60, snapshot, step 120 (record poses), restore, step 120 again:
  // poses differ by several pixels (up to ~120px observed in a seesaw scene).
  // KNOWN LIMITATION, handled one level up: snapshots are only used to *show* a moment of the run.
  // Before simulating forward from a rewound point, RunController.resync() rebuilds the sim and
  // fast-forwards it from tick 0, which is exact because runs are deterministic (tested below).
  it.fails('rewinding then re-running through collisions reproduces the original run', () => {
    for (const T of [10, 60]) {
      const s = steps(dominoScene(), T);
      const snap = s.snapshot();
      steps(s, 120);
      const ref = pose(s);
      s.restore(snap);
      steps(s, 120);
      expect(maxDiff(pose(s), ref)).toBeLessThan(1e-6);
    }
  });

  // Same bug as above, stronger form: even two replays from the *same* snapshot disagree,
  // because restore leaves per-body solver state (positionImpulse, constraintImpulse) from whatever
  // the world was doing before the rewind, and the delta-based setPosition rounds differently.
  it.fails('restore is repeatable: two replays from the same snapshot are identical', () => {
    const s = steps(dominoScene(), 30);
    const snap = s.snapshot();
    steps(s, 30);
    s.restore(snap);
    steps(s, 150);
    const first = pose(s);
    s.restore(snap);
    steps(s, 150);
    expect(maxDiff(pose(s), first)).toBeLessThan(1e-6);
  });

  it('restore rewinds goals, solvedAt and the chain reaction', () => {
    const bucket = obj('bucket', 800, 860, {}, { id: 'bucket' });
    const ball = obj('ball', 800, 500, {}, { id: 'ball' });
    const s = sim([bucket, ball], [], [{ kind: 'containerCount', container: 'bucket', count: 1 }]);
    const start = s.snapshot();
    expect(s.runUntil(4)).toBe(true);
    const solvedAt = s.goals.solvedAt;
    expect(solvedAt).not.toBeNull();
    const solvedSnap = s.snapshot();
    s.restore(start);
    expect(s.goals.solved).toBe(false);
    expect(s.goals.solvedAt).toBeNull();
    expect(s.chain.length).toBe(start.chainLen);
    expect(s.tick).toBe(0);
    s.restore(solvedSnap);
    expect(s.goals.solved).toBe(true);
    expect(s.goals.solvedAt).toBe(solvedAt);
    // re-running from the start solves again
    s.restore(start);
    expect(s.runUntil(4)).toBe(true);
  });

  it('restore kills and revives entities (cannon shots go back in the barrel)', () => {
    const bat = obj('battery', 100, 860, {}, { id: 'bat' });
    const cannon = obj('cannon', 400, 800, {}, { id: 'cannon' });
    const s = sim([bat, cannon], [wire(bat, 'out', cannon, 'in')]);
    const before = s.snapshot();
    const shot = s.entities.get('cannon~shot0')!;
    expect(shot.alive).toBe(false);
    steps(s, 30);
    expect(shot.alive).toBe(true);
    expect(s.entities.get('cannon')!.state.fired).toBe(1);
    expect(s.chain.some((c) => c.key === 'cannon')).toBe(true);
    s.restore(before);
    expect(shot.alive).toBe(false);
    expect(s.entities.get('cannon')!.state.fired).toBe(0);
    expect(s.entities.get('cannon')!.activated).toBe(false);
    expect(s.chain).toEqual([]);
    // and it fires again on replay
    steps(s, 30);
    expect(shot.alive).toBe(true);
  });

  it('snapshots are independent of later mutation of entity state', () => {
    const bat = obj('battery', 100, 860, {}, { id: 'bat' });
    const cannon = obj('cannon', 400, 800, {}, { id: 'cannon' });
    const s = sim([bat, cannon], [wire(bat, 'out', cannon, 'in')]);
    const snap = s.snapshot();
    const idx = s.list.findIndex((e) => e.id === 'cannon');
    steps(s, 30);
    expect(snap.ents[idx].state.fired).toBe(0);
    expect(snap.ents[idx].state.pool).not.toBe(s.entities.get('cannon')!.state.pool);
  });

  it('rewind history in a run is bounded: memory stays flat over a long run', () => {
    const h = new History(2, 100);
    const s = dominoScene();
    h.record(s, true);
    for (let i = 0; i < 600; i++) {
      s.step();
      h.record(s);
    }
    expect(h.length).toBe(100);
    expect(h.last.tick).toBe(600);
    expect(h.first.tick).toBe(402);
  });
});

describe('resync strategy used by the run controller', () => {
  it('a fresh simulation fast-forwarded to tick T matches the original run at T and after', () => {
    const a = steps(dominoScene(), 200);
    const ref = pose(a);
    steps(a, 100);
    const ref2 = pose(a);
    const b = steps(dominoScene(), 200);
    expect(maxDiff(pose(b), ref)).toBe(0);
    steps(b, 100);
    expect(maxDiff(pose(b), ref2)).toBe(0);
  });
});
