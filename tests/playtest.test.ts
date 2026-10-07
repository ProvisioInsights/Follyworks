import { describe, expect, it } from 'vitest';
import { Playtest, summarize, type PlaytestLog } from '../src/telemetry/playtest';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('playtest log', () => {
  it('records the build-run-fix loop of one mission and survives a reload', () => {
    let t = 0;
    const store = memory();
    const p = new Playtest(store, () => t);
    p.begin('g1-a', 'campaign');
    t = 20_000;
    p.edit();
    p.run();
    t = 25_000;
    p.result('settled');
    p.reset();
    t = 35_000;
    p.hint(1);
    p.run();
    t = 40_000;
    p.result('solved', { stages: 9, absurd: false });
    p.run(); // tinkering after the solve
    p.end();
    const s = new Playtest(store).log.sessions[0];
    expect(s).toMatchObject({ level: 'g1-a', firstRun: 20, solvedAt: 40, hint: 1, edits: 1, length: 40 });
    expect(s.runs.map((r) => [r.built, r.end])).toEqual([
      [20, 'settled'],
      [10, 'solved'],
      [15, 'reset'],
    ]);
    expect(s.open).toBeUndefined();
  });

  it('a reset after a run ended keeps how it ended', () => {
    let t = 0;
    const p = new Playtest(null, () => t);
    p.begin('x', 'campaign');
    p.run();
    t = 3000;
    p.result('timeup');
    t = 9000;
    p.reset();
    expect(p.current!.runs[0]).toMatchObject({ end: 'timeup', lasted: 3 });
  });

  it('starting a new mission closes the previous one', () => {
    const p = new Playtest(null);
    p.begin('a', 'campaign');
    p.begin('b', 'campaign');
    expect(p.log.sessions.map((s) => [s.level, !!s.open])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  it('a corrupt stored log is replaced instead of crashing', () => {
    const store = memory();
    store.setItem('follyworks.playtest', '{oops');
    expect(new Playtest(store).log.sessions).toEqual([]);
  });
});

describe('playtest summary', () => {
  const session = (level: string, start: number, runs: [number, string][], solvedAt: number | null, extra = {}) => ({
    level,
    kind: 'campaign',
    start,
    length: solvedAt ?? 300,
    runs: runs.map(([built, end]) => ({ built, lasted: 3, end: end as any })),
    edits: 5,
    firstRun: runs.length ? runs[0][0] : null,
    solvedAt,
    hint: 0,
    rewinds: 0,
    ...extra,
  });
  const logs: PlaytestLog[] = [
    { v: 1, player: 'p1', sessions: [session('m', 0, [[30, 'settled'], [20, 'solved'], [5, 'solved']], 60, { rating: 5 })] },
    { v: 1, player: 'p2', sessions: [session('m', 0, [[200, 'settled']], null), session('m', 1e6, [[40, 'solved']], 40, { hint: 3, rating: 2 })] },
    { v: 1, player: 'p3', sessions: [session('m', 0, [[100, 'timeup'], [100, 'settled']], null)] },
  ];

  it('works out solve and quit rates, effort to solve, help and voluntary replays per player', () => {
    const [m] = summarize(logs);
    expect(m.players).toBe(3);
    expect(m.solveRate).toBeCloseTo(2 / 3);
    expect(m.quitRate).toBeCloseTo(1 / 3);
    // p1: 2 runs in 1 min; p2: 1 + 1 runs across 300 s + 40 s
    expect(m.runsToSolve).toBe(2);
    expect(m.minutesToSolve).toBeCloseTo((1 + 340 / 60) / 2);
    expect(m.ghostRate).toBe(0.5);
    expect(m.replayRate).toBe(0.5);
    expect(m.rating).toBe(3.5);
    expect(m.flags).toContain('33% gave up on it');
    expect(m.flags).toContain('50% needed ghost hints');
  });

  it('ignores sandbox and editor sessions', () => {
    expect(summarize([{ v: 1, player: 'p', sessions: [session('s', 0, [], null, { kind: 'sandbox' })] }])).toEqual([]);
  });
});
