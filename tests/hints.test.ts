// Tiered hints (src/game/hints.ts).

import { describe, expect, it } from 'vitest';
import '../src/components';
import { blankLevel } from '../src/core/level';
import type { BuildDef } from '../src/core/types';
import { CAMPAIGN } from '../src/game/campaign';
import { applyDifficulty } from '../src/game/difficulty';
import { applyHintPenalty, ghostEntities, HintLadder } from '../src/game/hints';
import { scoreAttempt } from '../src/game/scoring';

const sol: BuildDef = {
  objects: [
    { id: 'a', type: 'plank', x: 100, y: 100, angle: 0 },
    { id: 'b', type: 'ball', x: 300, y: 50, angle: 0 },
    { id: 'c', type: 'plank', x: 500, y: 200, angle: 0.3 },
  ],
  connections: [{ id: 'w', kind: 'wire', from: { obj: 'a', port: 'out' }, to: { obj: 'b', port: 'in' } }],
};
const empty: BuildDef = { objects: [], connections: [] };

describe('hint ladder', () => {
  it('steps nudges, then the parts list, then one ghost at a time', () => {
    const l = new HintLadder(['first', 'second'], sol);
    expect(l.next(empty)).toMatchObject({ tier: 1, kind: 'nudge', text: 'first', index: 0, of: 2 });
    expect(l.next(empty)).toMatchObject({ tier: 1, text: 'second' });
    expect(l.next(empty)).toEqual({ tier: 2, kind: 'parts', parts: [{ type: 'plank', count: 2 }, { type: 'ball', count: 1 }], wires: 1 });
    expect(l.next(empty)).toMatchObject({ tier: 3, kind: 'ghost', ghost: { id: 'a' }, shown: 1, of: 3 });
    expect(l.next(empty)).toMatchObject({ tier: 4, kind: 'ghost', ghost: { id: 'b' } });
    expect(l.hasMore(empty)).toBe(true);
    expect(l.next(empty)).toMatchObject({ tier: 5, kind: 'ghost', ghost: { id: 'c' } });
    expect(l.hasMore(empty)).toBe(false);
    expect(l.next(empty)).toMatchObject({ kind: 'done', tier: 5 });
    expect(l.tierUsed).toBe(5);
  });

  it('never ghosts a part the player already placed there, and hides ghosts once matched', () => {
    const l = new HintLadder([], sol);
    expect(l.next(empty)?.kind).toBe('parts');
    const build: BuildDef = { objects: [{ id: 'p1', type: 'plank', x: 104, y: 98, angle: Math.PI }], connections: [] };
    expect(l.next(build)).toMatchObject({ kind: 'ghost', ghost: { id: 'b' } });
    expect(l.visibleGhosts(build).map((o) => o.id)).toEqual(['b']);
    const more: BuildDef = { objects: [...build.objects, { id: 'p2', type: 'ball', x: 300, y: 60, angle: 0 }], connections: [] };
    expect(l.visibleGhosts(more)).toEqual([]);
    // wrong type or far away does not count as placed
    const wrong: BuildDef = { objects: [{ id: 'q', type: 'ball', x: 500, y: 200, angle: 0.3 }], connections: [] };
    expect(l.next(wrong)).toMatchObject({ ghost: { id: 'a' } });
  });

  it('custom levels without a solution stop at tier 1', () => {
    const l = new HintLadder(['only'], null);
    expect(l.next(empty)).toMatchObject({ tier: 1, text: 'only' });
    expect(l.hasMore(empty)).toBe(false);
    expect(l.next(empty)).toMatchObject({ tier: 1, text: 'only' });
    expect(l.tierUsed).toBe(1);
    expect(new HintLadder([], null).available).toBe(false);
    expect(new HintLadder([], null).next(empty)).toBeNull();
  });

  it('automatic hints do not count as used', () => {
    const l = new HintLadder(['a', 'b'], sol);
    l.next(empty, true);
    expect(l.tierUsed).toBe(0);
    l.next(empty);
    expect(l.tierUsed).toBe(1);
  });

  it('on Easy the pre-placed part is never ghosted', () => {
    for (const e of CAMPAIGN) {
      const d = applyDifficulty(e, 'easy');
      const l = new HintLadder(e.level.hints, d.solution);
      const seen: string[] = [];
      for (let i = 0; i < 20; i++) {
        const v = l.next(empty);
        if (v?.kind === 'ghost') seen.push(v.ghost.id);
      }
      for (const id of d.preplaced) expect(seen, e.level.id).not.toContain(id);
      expect(seen.length).toBe(d.solution!.objects.length);
    }
  });

  it('ghost outlines use real collision geometry', () => {
    const g = ghostEntities(blankLevel('x'), sol.objects);
    expect(g.length).toBe(3);
    expect(g.every((e) => e.bodies.length > 0)).toBe(true);
  });
});

describe('hint penalty', () => {
  const lvl = blankLevel('p');
  lvl.bonus = { elegantParts: 3, absurdStages: 1 };
  const chain = [{ key: 'k', label: '', domain: 'gravity', time: 0 }];

  it('keeps ELEGANT for nudges and the parts list, withholds it after a ghost, keeps the other stamps', () => {
    const r = scoreAttempt(lvl, 2, 1, chain);
    expect(r.elegant.earned && r.absurd.earned).toBe(true);
    expect(applyHintPenalty(r, 2).elegant.earned).toBe(true);
    const g = applyHintPenalty(r, 3);
    expect(g.elegant.earned).toBe(false);
    expect(g.elegant.reason).toMatch(/ghost/);
    expect(g.solved).toBe(true);
    expect(g.absurd.earned).toBe(true);
    expect(g.hintTier).toBe(3);
    expect(r.elegant.earned).toBe(true); // original untouched
  });
});
