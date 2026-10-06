// The "everything's stopped" banner (RunController + Simulation.isStill) must never fire on a
// machine that is still going to work: replay every reference solution with the exact rule the
// game uses and require that none of them looks stalled before it solves.

import { describe, expect, it } from 'vitest';
import '../src/components';
import { parseLevel } from '../src/core/level';
import { CAMPAIGN } from '../src/game/campaign';
import { describeMiss, goalMarker } from '../src/sim/goals';
import { Simulation } from '../src/sim/Simulation';
import { level, obj } from './helpers';

const STALL_TICKS = 120;

/** Tick at which the game would show the stalled banner, or null if it never would before solving. */
const stallTick = (sim: Simulation, maxTicks: number): number | null => {
  let still = 0;
  for (let i = 0; i < maxTicks && !sim.goals.solved; i++) {
    sim.step();
    if (sim.goals.solved) break;
    still = sim.isStill() ? still + 1 : 0;
    if (still >= STALL_TICKS && sim.time > 1.5) return sim.tick;
  }
  return null;
};

describe('stalled-run detection', () => {
  for (const entry of CAMPAIGN) {
    entry.solutions.forEach((sol, k) => {
      it(`${entry.level.id} solution ${k} is never flagged as stalled before it solves`, () => {
        const lv = parseLevel(JSON.parse(JSON.stringify(entry.level))).level;
        const sim = new Simulation(lv, JSON.parse(JSON.stringify(sol)), { lenient: true });
        const limit = Math.round((lv.restrictions?.timeLimit ?? 30) * 60);
        expect(stallTick(sim, limit)).toBeNull();
        expect(sim.goals.solved).toBe(true);
      });
    });
  }

  it('flags a ball that comes to rest without reaching the goal', () => {
    const ball = obj('ball', 300, 800);
    const lv = level([ball], [], [{ kind: 'enterRegion', target: { id: ball.id }, region: { x: 1200, y: 700, w: 200, h: 200 } }]);
    const sim = new Simulation(lv, { objects: [], connections: [] });
    const t = stallTick(sim, 60 * 20);
    expect(t).not.toBeNull();
    expect(t!).toBeLessThan(60 * 6);
  });

  it('explains the miss in a plain sentence', () => {
    const ball = obj('ball', 300, 800);
    const lv = level([ball], [], [{ kind: 'enterRegion', target: { id: ball.id }, region: { x: 1200, y: 700, w: 200, h: 200 } }]);
    const sim = new Simulation(lv, { objects: [], connections: [] });
    for (let i = 0; i < 300; i++) sim.step();
    expect(describeMiss(sim)).toBe('The rubber ball ended up a long way from the goal zone.');
  });

  it('can describe the unmet goal of every campaign level without throwing', () => {
    for (const entry of CAMPAIGN) {
      const lv = parseLevel(JSON.parse(JSON.stringify(entry.level))).level;
      const sim = new Simulation(lv, { objects: [], connections: [] }, { lenient: true });
      for (let i = 0; i < 120; i++) sim.step();
      const text = describeMiss(sim);
      expect(typeof text, entry.level.id).toBe('string');
      expect(text!.length).toBeGreaterThan(10);
    }
  });
});

describe('in-room goal tags', () => {
  it('every campaign goal has a tag with text and a spot in the room', () => {
    for (const entry of CAMPAIGN) {
      const lv = parseLevel(JSON.parse(JSON.stringify(entry.level))).level;
      const sim = new Simulation(lv, { objects: [], connections: [] }, { lenient: true });
      lv.goals.forEach((g, i) => {
        const m = goalMarker(g, sim);
        expect(m.text.length, `${lv.id} goal ${i}`).toBeGreaterThan(3);
        expect(m.at, `${lv.id} goal ${i}`).not.toBeNull();
        expect(m.at!.x).toBeGreaterThanOrEqual(0);
        expect(m.at!.x).toBeLessThanOrEqual(lv.world.width);
      });
    }
  });

  it('counts live: a container tag shows how many are inside', () => {
    const bucket = obj('bucket', 600, 800, {}, { id: 'b' });
    const ball = obj('ball', 600, 790, {}, { id: 'ball' });
    const lv = level([bucket, ball], [], [{ kind: 'containerCount', container: 'b', count: 2, filter: { type: 'ball' } }]);
    const sim = new Simulation(lv, { objects: [], connections: [] });
    for (let i = 0; i < 60; i++) sim.step();
    const m = goalMarker(lv.goals[0], sim, sim.goals.status[0]);
    expect(m).toMatchObject({ text: 'Fill with balls', detail: '1/2' });
  });
});
