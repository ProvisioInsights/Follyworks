// SOLVED / ELEGANT / ABSURD scoring (src/game/scoring.ts).

import { describe, expect, it } from 'vitest';
import '../src/components';
import { blankLevel } from '../src/core/level';
import type { BonusDef } from '../src/core/types';
import { emptyProgress } from '../src/persistence/save';
import { DEFAULT_ABSURD_STAGES, mergeProgress, scoreAttempt, uniqueChain } from '../src/game/scoring';
import type { ChainEntry } from '../src/sim/Simulation';
import { CAMPAIGN } from '../src/game/campaign';

const lv = (bonus?: BonusDef) => {
  const l = blankLevel('s');
  if (bonus) l.bonus = bonus;
  return l;
};
const ch = (key: string, time: number, domain = 'gravity'): ChainEntry => ({ key, label: key, domain, time });
const chainOf = (n: number, domains = ['gravity']) => Array.from({ length: n }, (_, i) => ch(`k${i}`, i * 0.5, domains[i % domains.length]));

describe('uniqueChain', () => {
  it('keeps first occurrence order and drops repeats', () => {
    const out = uniqueChain([ch('a', 0), ch('b', 1), ch('a', 2), ch('c', 3), ch('b', 4)]);
    expect(out.map((c) => `${c.key}@${c.time}`)).toEqual(['a@0', 'b@1', 'c@3']);
  });
  it('handles empty input', () => {
    expect(uniqueChain([])).toEqual([]);
  });
});

describe('SOLVED', () => {
  it('solved iff solvedAt is not null (0 counts as solved)', () => {
    expect(scoreAttempt(lv(), null, 1, []).solved).toBe(false);
    expect(scoreAttempt(lv(), 0, 1, []).solved).toBe(true);
    expect(scoreAttempt(lv(), 12.5, 1, []).time).toBe(12.5);
    expect(scoreAttempt(lv(), null, 1, []).time).toBeNull();
  });

  it('passes parts through', () => {
    expect(scoreAttempt(lv(), 1, 7, []).parts).toBe(7);
  });
});

describe('ELEGANT', () => {
  it('unavailable when the level has no target', () => {
    const r = scoreAttempt(lv(), 1, 0, []);
    expect(r.elegant).toEqual({ earned: false, available: false, reason: 'No elegance target on this level.' });
    expect(scoreAttempt(lv({ absurdStages: 3 }), 1, 0, []).elegant.available).toBe(false);
  });

  it('elegantParts: earned at or below the target, only when solved', () => {
    const l = lv({ elegantParts: 2 });
    expect(scoreAttempt(l, 3, 1, []).elegant.earned).toBe(true);
    expect(scoreAttempt(l, 3, 2, []).elegant.earned).toBe(true);
    expect(scoreAttempt(l, 3, 3, []).elegant.earned).toBe(false);
    expect(scoreAttempt(l, null, 0, []).elegant.earned).toBe(false);
    expect(scoreAttempt(l, null, 0, []).elegant.available).toBe(true);
  });

  it('elegantParts: 0 means "no parts at all"', () => {
    const l = lv({ elegantParts: 0 });
    expect(scoreAttempt(l, 1, 0, []).elegant.earned).toBe(true);
    expect(scoreAttempt(l, 1, 1, []).elegant.earned).toBe(false);
  });

  it('elegantParts reasons are pluralised and informative', () => {
    const l = lv({ elegantParts: 2 });
    expect(scoreAttempt(l, 1, 1, []).elegant.reason).toBe('Used 1 part (target: 2 or fewer).');
    expect(scoreAttempt(l, 1, 2, []).elegant.reason).toBe('Used 2 parts (target: 2 or fewer).');
    expect(scoreAttempt(l, 1, 5, []).elegant.reason).toBe('Use 2 or fewer parts (you used 5).');
  });

  it('elegantTime alone: earned when solved at or before the target', () => {
    const l = lv({ elegantTime: 3 });
    expect(scoreAttempt(l, 2.99, 50, []).elegant.earned).toBe(true);
    expect(scoreAttempt(l, 3, 50, []).elegant.earned).toBe(true);
    expect(scoreAttempt(l, 3.01, 50, []).elegant.earned).toBe(false);
    expect(scoreAttempt(l, null, 0, []).elegant.earned).toBe(false);
    expect(scoreAttempt(l, 2, 0, []).elegant.reason).toBe('Solved in 2.0s (target: 3s).');
    expect(scoreAttempt(l, 4.26, 0, []).elegant.reason).toBe('Solve it within 3s (you took 4.3s).');
    expect(scoreAttempt(l, null, 0, []).elegant.reason).toBe('Solve it within 3s.');
  });

  it('with both targets set, the parts target applies (time is not consulted for a slow, lean solve)', () => {
    const l = lv({ elegantParts: 2, elegantTime: 3 });
    const r = scoreAttempt(l, 99, 1, []);
    expect(r.elegant.earned).toBe(true);
    expect(r.elegant.reason).toMatch(/part/);
  });

  // BUG (src/game/scoring.ts:50): `else if` makes elegantTime dead whenever elegantParts is also
  // set. BonusDef documents elegantTime as "ELEGANT alternatively when solved within this many
  // simulated seconds", and 23 of the 26 campaign levels set both, so none of their time targets
  // can ever be earned. (PlayScreen.ts:709 also hides the time pill in that case, matching the code
  // but not the data/docs.) Repro: bonus {elegantParts: 1, elegantTime: 4}, solve in 2s with 3 parts
  // -> elegant.earned === false.
  it('with both targets set, a fast solve earns ELEGANT even with more parts (elegantTime is "alternatively")', () => {
    const l = lv({ elegantParts: 1, elegantTime: 4 });
    expect(scoreAttempt(l, 2, 3, []).elegant.earned).toBe(true);
  });

  it('most campaign levels define both elegance targets (so the time target matters)', () => {
    const both = CAMPAIGN.filter((c) => c.level.bonus?.elegantParts !== undefined && c.level.bonus?.elegantTime !== undefined);
    expect(both.length).toBeGreaterThan(20);
  });
});

describe('ABSURD', () => {
  it('defaults to 7 distinct stages', () => {
    expect(DEFAULT_ABSURD_STAGES).toBe(7);
    expect(scoreAttempt(lv(), 10, 1, chainOf(6)).absurd).toMatchObject({ earned: false, target: 7 });
    expect(scoreAttempt(lv(), 10, 1, chainOf(7)).absurd).toMatchObject({ earned: true, target: 7 });
  });

  it('honours the level absurdStages target', () => {
    const l = lv({ absurdStages: 3 });
    expect(scoreAttempt(l, 10, 1, chainOf(2)).absurd.earned).toBe(false);
    expect(scoreAttempt(l, 10, 1, chainOf(3)).absurd.earned).toBe(true);
    expect(scoreAttempt(l, 10, 1, chainOf(3)).absurd.target).toBe(3);
  });

  it('absurdStages 0 means the level offers no ABSURD bonus', () => {
    const r = scoreAttempt(lv({ absurdStages: 0 }), 10, 1, chainOf(30));
    expect(r.absurd).toMatchObject({ earned: false, available: false, reason: 'No ABSURD bonus on this puzzle.' });
    expect(scoreAttempt(lv(), 10, 1, chainOf(1)).absurd.available).toBe(true);
  });

  it('never earned without a solve, however long the chain', () => {
    const r = scoreAttempt(lv({ absurdStages: 1 }), null, 1, chainOf(30));
    expect(r.absurd.earned).toBe(false);
    expect(r.stages).toBe(30); // unsolved attempts still report every stage
  });

  it('repeats of the same stage count once', () => {
    const chain = [ch('a', 0), ch('a', 1), ch('a', 2), ch('b', 3)];
    const r = scoreAttempt(lv({ absurdStages: 3 }), 10, 1, chain);
    expect(r.stages).toBe(2);
    expect(r.chain.map((c) => c.key)).toEqual(['a', 'b']);
    expect(r.absurd.earned).toBe(false);
  });

  it('stages that happen after the solve do not count (with a 1ms tolerance)', () => {
    const chain = [ch('a', 0), ch('b', 1), ch('c', 2.0005), ch('d', 2.01), ch('e', 5)];
    const r = scoreAttempt(lv({ absurdStages: 4 }), 2, 1, chain);
    expect(r.chain.map((c) => c.key)).toEqual(['a', 'b', 'c']);
    expect(r.stages).toBe(3);
    expect(r.absurd.earned).toBe(false);
  });

  it('a repeat before the solve of a stage first seen after it is still counted once at its first time', () => {
    // first occurrence decides the time used for filtering
    const r = scoreAttempt(lv(), 1, 1, [ch('late', 5), ch('late', 0.5)]);
    expect(r.stages).toBe(0);
  });

  it('reports distinct domains with pluralisation', () => {
    const r = scoreAttempt(lv({ absurdStages: 3 }), 10, 1, chainOf(4, ['gravity', 'electric', 'gravity', 'heat']));
    expect(r.domains).toEqual(['gravity', 'electric', 'heat']);
    expect(r.absurd.reason).toBe('4-stage chain reaction across 3 domains (target: 3).');
    const one = scoreAttempt(lv({ absurdStages: 1 }), 10, 1, [ch('x', 0)]);
    expect(one.absurd.reason).toBe('1-stage chain reaction across 1 domain (target: 1).');
    const miss = scoreAttempt(lv(), 10, 1, chainOf(2));
    expect(miss.absurd.reason).toBe('Chain at least 7 distinct things happening (you had 2).');
  });

  it('ELEGANT and ABSURD are independent and can both be earned at once', () => {
    const r = scoreAttempt(lv({ elegantParts: 3, absurdStages: 2 }), 5, 2, chainOf(5));
    expect(r.elegant.earned).toBe(true);
    expect(r.absurd.earned).toBe(true);
  });

  it('an empty chain yields zero stages and no domains', () => {
    const r = scoreAttempt(lv(), 1, 0, []);
    expect(r.stages).toBe(0);
    expect(r.domains).toEqual([]);
    expect(r.chain).toEqual([]);
  });
});

describe('mergeProgress', () => {
  const attempt = (solvedAt: number | null, parts: number, stages: number, bonus: BonusDef = { elegantParts: 2, absurdStages: 3 }) =>
    scoreAttempt(lv(bonus), solvedAt, parts, chainOf(stages));

  it('a failed attempt only counts the attempt', () => {
    const p = mergeProgress(emptyProgress(), attempt(null, 1, 10));
    expect(p).toEqual({ ...emptyProgress(), attempts: 1 });
  });

  it('a solve records bests and a timestamp', () => {
    const p = mergeProgress(emptyProgress(), attempt(4, 5, 2));
    expect(p.solved).toBe(true);
    expect(p.elegant).toBe(false);
    expect(p.absurd).toBe(false);
    expect(p.bestParts).toBe(5);
    expect(p.bestStages).toBe(2);
    expect(p.bestTime).toBe(4);
    expect(p.attempts).toBe(1);
    expect(Number.isNaN(Date.parse(p.solvedAt!))).toBe(false);
  });

  it('keeps the best of each metric across attempts and never loses a bonus', () => {
    let p = emptyProgress();
    p = mergeProgress(p, attempt(4, 5, 4)); // absurd
    p = mergeProgress(p, attempt(9, 1, 1)); // elegant, slower, fewer stages
    p = mergeProgress(p, attempt(null, 0, 99)); // failure
    p = mergeProgress(p, attempt(6, 3, 2)); // nothing special
    expect(p).toMatchObject({ solved: true, elegant: true, absurd: true, bestParts: 1, bestStages: 4, bestTime: 4, attempts: 4 });
  });

  it('keeps the first solvedAt timestamp', () => {
    const first = mergeProgress(emptyProgress(), attempt(4, 5, 2));
    const again = mergeProgress({ ...first }, attempt(2, 1, 2));
    expect(again.solvedAt).toBe(first.solvedAt);
    expect(again.bestTime).toBe(2);
  });

  it('a solve at t=0 is a valid best time', () => {
    const p = mergeProgress(mergeProgress(emptyProgress(), attempt(3, 1, 1)), attempt(0, 1, 1));
    expect(p.bestTime).toBe(0);
  });

  it('does not mutate the previous progress object', () => {
    const prev = emptyProgress();
    mergeProgress(prev, attempt(1, 1, 1));
    expect(prev).toEqual(emptyProgress());
  });
});
