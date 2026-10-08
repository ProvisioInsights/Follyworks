import { describe, expect, it, vi } from 'vitest';
import { Playtest, summarize, type PlaytestLog } from '../src/telemetry/playtest';
import { playtestFileName, playtestMode, sendPlaytest, wantsPlaytest, type SendDeps } from '../src/telemetry/playtestSend';
import { filesFromD1, PULL_SQL } from '../tools/playtests/d1.mjs';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

const log = (): PlaytestLog => ({ v: 1, player: 'abc123', sessions: [{ level: 't1', kind: 'campaign', start: 0, length: 30, runs: [], edits: 2, firstRun: null, solvedAt: null, hint: 0, rewinds: 0 }] });

const reply = (status: number, type = '') => ({ ok: status >= 200 && status < 300, status, headers: new Headers(type ? { 'content-type': type } : {}) });

describe('playtest ratings and comments', () => {
  it('rates a closed session with a one-line comment and keeps it after a reload', () => {
    const store = memory();
    const p = new Playtest(store);
    p.begin('t1', 'campaign');
    p.end();
    const s = p.log.sessions[0];
    p.rateSession(s, 4);
    p.rateSession(s, undefined, '  the seesaw\n was   fiddly  ');
    const back = new Playtest(store).log.sessions[0];
    expect(back).toMatchObject({ rating: 4, comment: 'the seesaw was fiddly' });
    p.rateSession(s, 9, 'x'.repeat(400));
    expect(s.rating).toBe(5);
    expect(s.comment).toHaveLength(300);
  });

  it('ignores sessions that are not in its log, and a blank comment', () => {
    const p = new Playtest(null);
    p.begin('t1', 'campaign');
    p.end();
    const stray = { ...p.log.sessions[0] };
    p.rateSession(stray, 3, 'hi');
    expect(stray.rating).toBeUndefined();
    p.rateSession(p.log.sessions[0], undefined, '   ');
    expect(p.log.sessions[0].comment).toBeUndefined();
  });

  it('tells listeners about the first solve and about every closed session', () => {
    const p = new Playtest(null);
    const heard: string[] = [];
    const off = p.listen((ev, s) => heard.push(`${ev}:${s.level}`));
    p.begin('a', 'campaign');
    p.run();
    p.result('solved');
    p.reset();
    p.run();
    p.result('solved');
    p.begin('b', 'campaign');
    off();
    p.end();
    expect(heard).toEqual(['solved:a', 'ended:a']);
  });

  it('old logs without the new fields still load and summarize', () => {
    const store = memory();
    store.setItem('follyworks.playtest', JSON.stringify(log()));
    const p = new Playtest(store);
    expect(p.log.player).toBe('abc123');
    expect(summarize([p.log])[0].comments).toEqual([]);
  });

  it('collects comments per level in the summary', () => {
    const a = log();
    a.sessions[0].rating = 2;
    a.sessions[0].comment = 'could not find the ball';
    const b = { ...log(), player: 'z' };
    b.sessions = [{ ...b.sessions[0], comment: 'cute cat' }];
    expect(summarize([a, b])[0].comments).toEqual(['2/5 could not find the ball', 'cute cat']);
  });

  it('fresh() starts a new player with an empty log', () => {
    const p = new Playtest(null);
    const id = p.log.player;
    p.begin('a', 'campaign');
    p.fresh();
    expect(p.log.sessions).toEqual([]);
    expect(p.current).toBeNull();
    expect(p.log.player).not.toBe(id);
  });
});

describe('playtest mode switch', () => {
  it('reads ?playtest from the address', () => {
    expect(wantsPlaytest('?playtest')).toBe(true);
    expect(wantsPlaytest('?a=1&playtest=1')).toBe(true);
    expect(wantsPlaytest('?playtest=0')).toBe(false);
    expect(wantsPlaytest('?playtest=off')).toBe(false);
    expect(wantsPlaytest('')).toBe(false);
  });

  it('is remembered until switched off, and survives blocked storage', () => {
    const s = memory();
    expect(playtestMode.on(s)).toBe(false);
    playtestMode.set(s, true);
    expect(playtestMode.on(s)).toBe(true);
    playtestMode.set(s, false);
    expect(playtestMode.on(s)).toBe(false);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} };
    expect(() => playtestMode.set(broken, true)).not.toThrow();
    expect(playtestMode.on(broken)).toBe(false);
  });
});

describe('sending a finished playtest', () => {
  const deps = (res: () => Promise<ReturnType<typeof reply>>) => {
    const d: SendDeps & { fetch: ReturnType<typeof vi.fn>; download: ReturnType<typeof vi.fn> } = { fetch: vi.fn(res), download: vi.fn() } as any;
    return d;
  };

  it('POSTs { log, note } as JSON with no-store and reports sent on 204', async () => {
    const d = deps(async () => reply(204));
    expect(await sendPlaytest(log(), '  Sam  ', d)).toBe('sent');
    expect(d.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = d.fetch.mock.calls[0];
    expect(url).toBe('/api/playtest');
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' } });
    const body = JSON.parse(init.body);
    expect(body.note).toBe('Sam');
    expect(body.log).toMatchObject({ v: 1, player: 'abc123', name: 'Sam' });
    expect(body.log.sessions).toHaveLength(1);
    expect(d.download).not.toHaveBeenCalled();
  });

  it('leaves the note out when there is no name', async () => {
    const d = deps(async () => reply(204));
    await sendPlaytest(log(), '   ', d);
    const body = JSON.parse(d.fetch.mock.calls[0][1].body);
    expect('note' in body).toBe(false);
    expect(body.log.name).toBeUndefined();
  });

  it('falls back to saving the file when offline', async () => {
    const d = deps(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await sendPlaytest(log(), 'Sam', d)).toBe('saved');
    expect(d.download).toHaveBeenCalledWith(expect.objectContaining({ player: 'abc123', name: 'Sam' }));
  });

  it('falls back on a server error or a missing API', async () => {
    for (const r of [reply(500), reply(404), reply(405)]) {
      const d = deps(async () => r);
      expect(await sendPlaytest(log(), undefined, d)).toBe('saved');
      expect(d.download).toHaveBeenCalledTimes(1);
    }
  });

  it('does not mistake a static host answering with its index page for success', async () => {
    const d = deps(async () => reply(200, 'text/html; charset=utf-8'));
    expect(await sendPlaytest(log(), undefined, d)).toBe('saved');
  });

  it('names the saved file after the player', () => {
    expect(playtestFileName(log())).toBe('follyworks-playtest-abc123.json');
    expect(playtestFileName({ ...log(), name: 'Zoë & Max!' })).toBe('follyworks-playtest-zo-max-abc123.json');
  });
});

describe('pulling playtests from D1', () => {
  it('selects exactly the columns of the playtests table', () => {
    expect(PULL_SQL).toMatch(/SELECT id, created_at, note, log FROM playtests/);
  });

  it('writes one file per readable row and copies the note into the log', () => {
    const out = `Some wrangler banner\n${JSON.stringify([
      {
        results: [
          { id: 1, created_at: '2026-10-08 10:00:00', note: 'Sam', log: JSON.stringify(log()) },
          { id: 2, created_at: '2026-10-08 11:00:00', note: null, log: JSON.stringify({ ...log(), name: 'Kim' }) },
          { id: 3, created_at: '2026-10-08 12:00:00', note: 'x', log: 'not json' },
        ],
        success: true,
      },
    ])}`;
    const { files, skipped } = filesFromD1(out);
    expect(files.map((f) => f.file)).toEqual(['d1-0001-sam.json', 'd1-0002-kim.json']);
    expect(files[0].log.name).toBe('Sam');
    expect(files[0].log.sessions).toHaveLength(1);
    expect(skipped).toEqual([3]);
  });
});
