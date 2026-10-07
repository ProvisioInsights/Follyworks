import { describe, expect, it } from 'vitest';
import '../src/components';
import { auditLevel, gridReference, traceRun } from '../src/analysis/funAudit';
import { CAMPAIGN } from '../src/game/campaign';
import { Simulation } from '../src/sim/Simulation';

const entry = (id: string) => CAMPAIGN.find((c) => c.level.id === id)!;

describe('fun audit', () => {
  it('traces the reference chain of the first mission and stops at the solve', () => {
    const e = entry('t1-first-drop');
    const t = traceRun(e.level, e.solutions[0]);
    expect(t.solved).toBe(true);
    expect(t.chain.length).toBeGreaterThan(2);
    expect(t.chain.every((c) => c.time <= t.solvedAt! + 0.001)).toBe(true);
    expect(traceRun(e.level, { objects: [], connections: [] }).solved).toBe(false);
  });

  it('finds a grid-snapped build that still solves, and is deterministic', () => {
    const e = entry('t2-ramp-it-up');
    const host = new Simulation(e.level, { objects: [], connections: [] });
    const g = gridReference(e.level, e.solutions[0], host, 30);
    expect(g.stuck).toEqual([]);
    for (const o of g.build.objects) expect([o.x % 10, o.y % 10]).toEqual([0, 0]);
    expect(traceRun(e.level, g.build).solved).toBe(true);
    const a = auditLevel(e.level, e.solutions[0], { samples: 3, spreads: [6, 24] });
    const b = auditLevel(e.level, e.solutions[0], { samples: 3, spreads: [6, 24] });
    expect(a).toEqual(b);
    expect(a.score).toBeGreaterThan(0);
    expect(a.perPart.length).toBe(e.solutions[0].objects.length);
  });
});
