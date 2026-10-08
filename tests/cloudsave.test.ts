// Save codes, the merge rule, change stamps, the /api Worker (over a real SQLite stand-in for D1)
// and the cloud sync client, including two "devices" syncing through one in-process Worker.

import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/components';
import { blankLevel } from '../src/core/level';
import { CloudSync, CLOUD_KEY, PUSH_EVERY_MS } from '../src/persistence/cloud';
import { formatCloudId, isCloudId, newCloudId, parseCloudCode } from '../src/persistence/cloudId';
import { describeSave, mergeLevelProgress, mergeSaves } from '../src/persistence/merge';
import { defaultSave, emptyProgress, parseSave, SAVE_KEY, SaveStore, type KV, type LevelProgress, type SaveData } from '../src/persistence/save';
import { decodeSaveCode, encodeSaveCode, SaveCodeError } from '../src/persistence/saveCode';
import { handle, MAX_SAVE_BYTES, type Env } from '../worker/api';
import { sqliteD1 } from '../worker/dev/sqliteD1.mjs';

class MemKV implements KV {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const solved = (o: Partial<LevelProgress> = {}): LevelProgress => ({ ...emptyProgress(), solved: true, ...o });

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------- ids

describe('cloud ids', () => {
  it('are 16 Crockford base32 characters (80 bits) and differ every time', () => {
    const a = newCloudId();
    expect(a).toHaveLength(16);
    expect(isCloudId(a)).toBe(true);
    expect(new Set(Array.from({ length: 50 }, () => newCloudId())).size).toBe(50);
  });

  it('show as dashed groups and read back however they are typed', () => {
    const id = 'K7QM2XRP9DTBW4QA';
    expect(formatCloudId(id)).toBe('K7QM-2XRP-9DTB-W4QA');
    expect(parseCloudCode('k7qm-2xrp-9dtb-w4qa')).toBe(id);
    expect(parseCloudCode(' K7QM 2XRP 9DTB W4QA ')).toBe(id);
    expect(parseCloudCode('1O0L-0000-0000-0000')).toBe('1001000000000000');
    expect(parseCloudCode('K7QM-2XRP')).toBeNull();
    expect(parseCloudCode('K7QM-2XRP-9DTB-W4QU')).toBeNull(); // U is not in the alphabet
  });
});

// ---------------------------------------------------------------- save codes

const sampleSave = (): SaveData => {
  const d = defaultSave();
  d.settings.music = 0.2;
  d.progress['t-01'] = solved({ bestTime: 4.2, attempts: 3 });
  d.customLevels.push(blankLevel('my-level', 'Mine'));
  d.builds['t-01'] = { objects: [], connections: [] };
  return d;
};

describe('save codes', () => {
  it('round trip compressed and uncompressed', async () => {
    const d = sampleSave();
    const z = await encodeSaveCode(d);
    const j = await encodeSaveCode(d, false);
    expect(z.startsWith('FW1.')).toBe(true);
    expect(j.startsWith('FW1j.')).toBe(true);
    expect(z.length).toBeLessThan(j.length);
    expect(/^[A-Za-z0-9._-]+$/.test(z)).toBe(true); // url-safe, no padding
    expect(await decodeSaveCode(z)).toEqual(parseSave(JSON.stringify(d)).data);
    expect(await decodeSaveCode(j)).toEqual(parseSave(JSON.stringify(d)).data);
  });

  it('ignore line breaks and spaces added by chat apps', async () => {
    const z = await encodeSaveCode(sampleSave());
    const wrapped = z.match(/.{1,30}/g)!.join('\n  ');
    expect((await decodeSaveCode(wrapped)).progress['t-01'].solved).toBe(true);
  });

  it('reject junk, truncation and non-saves with a plain message', async () => {
    const z = await encodeSaveCode(sampleSave());
    await expect(decodeSaveCode('hello')).rejects.toThrow(/not a Follyworks save code/);
    await expect(decodeSaveCode(z.slice(0, z.length - 12))).rejects.toBeInstanceOf(SaveCodeError);
    const notSave = 'FW1j.' + btoa(JSON.stringify([1, 2])).replace(/=+$/, '');
    await expect(decodeSaveCode(notSave)).rejects.toThrow(/damaged/);
  });
});

// ---------------------------------------------------------------- merge

describe('merge rule', () => {
  it('takes the best of each mission field, per difficulty', () => {
    const a = solved({ elegant: true, bestTime: 5, bestParts: 4, attempts: 9, solvedAt: '2026-03-01T00:00:00.000Z', bestStages: 2 });
    a.byDifficulty.normal = { solved: true, elegant: true, absurd: false, bestTime: 5, noHints: false };
    const b = solved({ absurd: true, bestTime: 7, bestParts: 3, attempts: 2, solvedAt: '2026-01-01T00:00:00.000Z', bestStages: 5 });
    b.byDifficulty.normal = { solved: true, elegant: false, absurd: true, bestTime: 4, noHints: true };
    b.byDifficulty.hard = { solved: true, elegant: false, absurd: false, bestTime: 9, noHints: false };
    const m = mergeLevelProgress(a, b);
    expect(m).toMatchObject({ solved: true, elegant: true, absurd: true, bestTime: 5, bestParts: 3, attempts: 9, bestStages: 5, solvedAt: '2026-01-01T00:00:00.000Z' });
    expect(m.byDifficulty.normal).toEqual({ solved: true, elegant: true, absurd: true, bestTime: 4, noHints: true });
    expect(m.byDifficulty.hard.solved).toBe(true);
    expect(m.byDifficulty.easy.solved).toBe(false);
    expect(mergeLevelProgress(m, emptyProgress())).toEqual(m);
  });

  it('never loses a mission either side has played', () => {
    const a = defaultSave();
    const b = defaultSave();
    a.progress.one = solved();
    b.progress.two = solved();
    const m = mergeSaves(a, b);
    expect(Object.keys(m.progress).sort()).toEqual(['one', 'two']);
  });

  it('settings, builds, levels and sandbox slots: the newer change wins', () => {
    const a = defaultSave();
    const b = defaultSave();
    a.settings.music = 0.1;
    b.settings.music = 0.9;
    a.sync.stamps.settings = '2026-05-01T00:00:00.000Z';
    b.sync.stamps.settings = '2026-05-02T00:00:00.000Z';
    a.builds.x = { objects: [], connections: [], layout: 'a' } as never;
    b.builds.x = { objects: [], connections: [], layout: 'b' } as never;
    a.sync.stamps['b:x'] = '2026-05-03T00:00:00.000Z';
    b.sync.stamps['b:x'] = '2026-05-01T00:00:00.000Z';
    const la = blankLevel('lv', 'Old name');
    const lb = blankLevel('lv', 'New name');
    a.customLevels.push(la);
    b.customLevels.push(lb);
    b.sync.stamps['l:lv'] = '2026-05-01T00:00:00.000Z'; // a's copy was never stamped: older
    const m = mergeSaves(a, b);
    expect(m.settings.music).toBe(0.9);
    expect((m.builds.x as any).layout).toBe('a');
    expect(m.customLevels.map((l) => l.name)).toEqual(['New name']);
    expect(m.sync.stamps).toMatchObject({ settings: '2026-05-02T00:00:00.000Z', 'b:x': '2026-05-03T00:00:00.000Z' });
  });

  it('on a tie this device wins, and device-only fields stay local', () => {
    const a = defaultSave();
    const b = defaultSave();
    a.settings.snap = false;
    a.customLevels.push(blankLevel('mine'));
    a.editorLevelId = 'mine';
    b.editorLevelId = 'theirs';
    expect(mergeSaves(a, b).settings.snap).toBe(false);
    expect(mergeSaves(a, b).editorLevelId).toBe('mine');
  });

  it('a deletion newer than the other copy sticks; an older one does not', () => {
    const a = defaultSave();
    const b = defaultSave();
    b.customLevels.push(blankLevel('gone'), blankLevel('kept'));
    b.sync.stamps['l:gone'] = '2026-05-01T00:00:00.000Z';
    b.sync.stamps['l:kept'] = '2026-05-09T00:00:00.000Z';
    a.sync.removed['l:gone'] = '2026-05-05T00:00:00.000Z';
    a.sync.removed['l:kept'] = '2026-05-05T00:00:00.000Z';
    // progress reset on a after b last played it
    b.progress.reset = solved();
    b.sync.stamps['p:reset'] = '2026-05-01T00:00:00.000Z';
    a.sync.removed['p:reset'] = '2026-05-02T00:00:00.000Z';
    const m = mergeSaves(a, b);
    expect(m.customLevels.map((l) => l.id)).toEqual(['kept']);
    expect(m.progress.reset).toBeUndefined();
    expect(m.sync.removed).toMatchObject({ 'l:gone': '2026-05-05T00:00:00.000Z', 'p:reset': '2026-05-02T00:00:00.000Z' });
    expect(m.sync.removed['l:kept']).toBeUndefined();
  });

  it('is idempotent and describes a save in plain words', () => {
    const d = sampleSave();
    expect(mergeSaves(d, d)).toEqual(d);
    expect(describeSave(d)).toBe('1 solved puzzle and 1 custom level');
    expect(describeSave(defaultSave())).toBe('0 solved puzzles');
  });
});

// ---------------------------------------------------------------- stamps

describe('change stamps', () => {
  it('flush stamps exactly what changed, and deletions become tombstones', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));
    const s = new SaveStore(new MemKV());
    s.setProgress('a', solved());
    s.upsertCustomLevel(blankLevel('lv'));
    s.flush();
    expect(s.data.sync.stamps).toEqual({ 'p:a': '2026-06-01T00:00:00.000Z', 'l:lv': '2026-06-01T00:00:00.000Z' });
    vi.setSystemTime(new Date('2026-06-02T00:00:00.000Z'));
    s.data.settings.music = 0;
    s.deleteCustomLevel('lv');
    s.flush();
    expect(s.data.sync.stamps).toEqual({ 'p:a': '2026-06-01T00:00:00.000Z', settings: '2026-06-02T00:00:00.000Z' });
    expect(s.data.sync.removed).toEqual({ 'l:lv': '2026-06-02T00:00:00.000Z' });
  });

  it('adopt takes merged data without stamping it as a local change, and stamps survive reload', () => {
    const kv = new MemKV();
    const s = new SaveStore(kv);
    const incoming = sampleSave();
    s.adopt(incoming);
    expect(s.data.sync.stamps).toEqual({});
    expect(new SaveStore(kv).data.progress['t-01'].solved).toBe(true);
  });
});

// ---------------------------------------------------------------- worker

const ID = 'K7QM2XRP9DTBW4QA';
const worker = () => {
  const db = sqliteD1();
  const env: Env = { DB: db };
  const call = (method: string, path: string, body?: string, headers: Record<string, string> = {}) =>
    handle(new Request(`https://follyworks.test${path}`, { method, body, headers }), env);
  return { db, env, call };
};

describe('worker /api', () => {
  it('GET is 404 until a save is PUT, then returns it with its revision', async () => {
    const { call } = worker();
    expect((await call('GET', `/api/save/${ID}`)).status).toBe(404);
    const put = await call('PUT', `/api/save/${ID}`, '{"version":3,"progress":{}}', { 'if-none-match': '*' });
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ rev: 1 });
    const got = await call('GET', `/api/save/${ID}`);
    expect(got.status).toBe(200);
    expect(got.headers.get('etag')).toBe('"1"');
    expect(got.headers.get('cache-control')).toBe('no-store');
    expect(await got.text()).toBe('{"version":3,"progress":{}}');
  });

  it('refuses a write based on an old revision (412) and accepts the current one', async () => {
    const { call } = worker();
    await call('PUT', `/api/save/${ID}`, '{"n":1}', { 'if-none-match': '*' });
    expect((await call('PUT', `/api/save/${ID}`, '{"n":2}', { 'if-none-match': '*' })).status).toBe(412);
    expect((await call('PUT', `/api/save/${ID}`, '{"n":2}', { 'if-match': '"1"' })).status).toBe(200);
    const stale = await call('PUT', `/api/save/${ID}`, '{"n":3}', { 'if-match': '"1"' });
    expect(stale.status).toBe(412);
    expect(stale.headers.get('etag')).toBe('"2"');
    expect(await (await call('GET', `/api/save/${ID}`)).text()).toBe('{"n":2}');
    // unconditional writes create or replace
    expect(await (await call('PUT', `/api/save/${ID}`, '{"n":4}')).json()).toMatchObject({ rev: 3 });
  });

  it('stores updated_at, and rejects oversize, non-JSON and non-object bodies', async () => {
    const { call, db } = worker();
    await call('PUT', `/api/save/${ID}`, '{}');
    const row = db.all('SELECT updated_at FROM saves')[0] as { updated_at: number };
    expect(Math.abs(row.updated_at - Date.now())).toBeLessThan(5000);
    const big = JSON.stringify({ pad: 'x'.repeat(MAX_SAVE_BYTES) });
    expect((await call('PUT', `/api/save/${ID}`, big)).status).toBe(413);
    expect((await call('PUT', `/api/save/${ID}`, 'nope')).status).toBe(400);
    expect((await call('PUT', `/api/save/${ID}`, '[1,2]')).status).toBe(400);
    expect((await call('PUT', `/api/save/${ID}`, '{}', { 'if-match': 'banana' })).status).toBe(400);
  });

  it('POST /api/playtest stores the log with a timestamp and answers 204', async () => {
    const { call, db } = worker();
    const log = { v: 1, player: 'p1', sessions: [{ level: 't-01' }] };
    const res = await call('POST', '/api/playtest', JSON.stringify({ log, note: 'fun!' }));
    expect(res.status).toBe(204);
    const rows = db.all('SELECT player, note, log, created_at FROM playtests') as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ player: 'p1', note: 'fun!' });
    expect(JSON.parse(rows[0].log)).toEqual(log);
    expect(rows[0].created_at).toBeGreaterThan(0);
    expect((await call('POST', '/api/playtest', JSON.stringify({ note: 'no log' }))).status).toBe(400);
  });

  it('everything else under /api/ is 404', async () => {
    const { call } = worker();
    for (const [m, p] of [
      ['GET', '/api/'],
      ['GET', '/api/nope'],
      ['GET', '/api/save/not-an-id'],
      ['GET', `/api/save/${ID}/x`],
      ['DELETE', `/api/save/${ID}`],
      ['GET', '/api/playtest'],
    ]) {
      expect((await call(m, p)).status, `${m} ${p}`).toBe(404);
    }
  });
});

// ---------------------------------------------------------------- client

/** A device: its own storage, save store and sync client, talking to the shared in-process Worker. */
const device = (env: Env, opts: { offline?: () => boolean } = {}) => {
  const kv = new MemKV();
  const store = new SaveStore(kv);
  const fetch = async (input: string, init?: RequestInit) => {
    if (opts.offline?.()) throw new TypeError('Failed to fetch');
    return handle(new Request(`https://follyworks.test${input}`, init), env);
  };
  const cloud = new CloudSync(store, { kv, fetch, listen: false });
  return { kv, store, cloud };
};

describe('cloud sync client', () => {
  it('keeps its id in storage and pushes a fresh save on start', async () => {
    const { env, db } = worker();
    const a = device(env);
    const saved = JSON.parse(a.kv.getItem(CLOUD_KEY)!);
    expect(saved.id).toBe(a.cloud.id);
    const methods: string[] = [];
    const inner = (a.cloud as any).fetch;
    (a.cloud as any).fetch = (i: string, init?: RequestInit) => (methods.push(init?.method ?? 'GET'), inner(i, init));
    a.store.setProgress('t-01', solved());
    a.store.flush();
    await a.cloud.start();
    a.cloud.pushNow();
    await a.cloud.idle();
    expect(a.cloud.status).toBe('saved');
    expect(methods).toEqual(['PUT']); // a brand-new id is not looked up first (no 404 in the console)
    const row = db.all('SELECT data FROM saves')[0] as { data: string };
    expect(JSON.parse(row.data).progress['t-01'].solved).toBe(true);
  });

  it('two devices: linking merges both and later progress flows both ways', async () => {
    const { env } = worker();
    const a = device(env);
    const b = device(env);
    a.store.setProgress('one', solved({ bestTime: 9 }));
    a.store.setProgress('zero', solved());
    a.store.flush();
    await a.cloud.start();
    a.cloud.pushNow();
    await a.cloud.idle();

    b.store.setProgress('one', solved({ bestTime: 5 }));
    b.store.setProgress('two', solved());
    b.store.flush();
    await b.cloud.start();
    let changed = 0;
    b.cloud.onChange = () => changed++;
    expect(await b.cloud.link(a.cloud.code.toLowerCase())).toBe('linked');
    expect(b.cloud.id).toBe(a.cloud.id);
    expect(changed).toBe(1);
    expect(b.store.data.progress.one.bestTime).toBe(5);
    expect(b.store.data.progress.two.solved).toBe(true);
    expect(b.store.data.progress.zero.solved).toBe(true);

    // a picks up b's progress on its next pull, even though it was offline-merged on b
    a.store.setProgress('three', solved());
    a.cloud.pushNow(); // stale revision: a pulls, merges, pushes again
    await a.cloud.idle();
    expect(Object.keys(a.store.data.progress).sort()).toEqual(['one', 'three', 'two', 'zero']);
    expect(a.store.data.progress.one.bestTime).toBe(5);
    expect(a.cloud.status).toBe('saved');

    await b.cloud.start();
    expect(b.store.data.progress.three?.solved).toBe(true);
  });

  it('linking reports unknown, invalid and own codes', async () => {
    const { env } = worker();
    const a = device(env);
    await a.cloud.start();
    expect(await a.cloud.link('ZZZZ-ZZZZ-ZZZZ-ZZZZ')).toBe('not-found');
    expect(await a.cloud.link('hello')).toBe('invalid');
    expect(await a.cloud.link(a.cloud.code)).toBe('same');
  });

  it('offline or with no API it stays quiet, keeps local saves, and retries later', async () => {
    vi.useFakeTimers();
    const { env, db } = worker();
    let down = true;
    const a = device(env, { offline: () => down });
    await a.cloud.start(); // a new device skips the pull and pushes a few seconds later
    await vi.advanceTimersByTimeAsync(5000);
    expect(a.cloud.status).toBe('offline');
    a.store.setProgress('x', solved());
    a.store.flush();
    expect(JSON.parse(a.kv.getItem(SAVE_KEY)!).progress.x.solved).toBe(true);
    down = false;
    await vi.advanceTimersByTimeAsync(PUSH_EVERY_MS + 20_000);
    await a.cloud.idle();
    expect(a.cloud.status).toBe('saved');
    expect(db.all('SELECT id FROM saves')).toHaveLength(1);
  });

  it('a host that answers /api with the game page counts as offline', async () => {
    const kv = new MemKV();
    const store = new SaveStore(kv);
    const html = async () => new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } });
    kv.setItem(CLOUD_KEY, JSON.stringify({ id: 'K7QM2XRP9DTBW4QA', rev: 3 })); // a returning device pulls first
    const cloud = new CloudSync(store, { kv, fetch: html, listen: false });
    await cloud.start();
    expect(cloud.status).toBe('offline');
    cloud.pushNow();
    await cloud.idle();
    expect(cloud.status).toBe('offline');
  });

  it('pushes no more than about once every 20 s while playing', async () => {
    vi.useFakeTimers();
    const { env } = worker();
    const a = device(env);
    let puts = 0;
    const inner = (a.cloud as any).fetch;
    (a.cloud as any).fetch = (i: string, init?: RequestInit) => (init?.method === 'PUT' && puts++, inner(i, init));
    await a.cloud.start();
    for (let t = 0; t < 60; t++) {
      a.store.setProgress(`l${t}`, solved());
      a.store.flush();
      await vi.advanceTimersByTimeAsync(1000);
    }
    await vi.advanceTimersByTimeAsync(30_000);
    expect(puts).toBeGreaterThanOrEqual(3);
    expect(puts).toBeLessThanOrEqual(5);
  });
});
