// Versioned local persistence (src/persistence/save.ts).

import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/components';
import { blankLevel, exportLevel } from '../src/core/level';
import { LEVEL_SCHEMA_VERSION } from '../src/core/types';
import { mergeProgress, scoreAttempt } from '../src/game/scoring';
import {
  DEFAULT_SETTINGS,
  SAVE_KEY,
  SAVE_VERSION,
  SaveStore,
  defaultSave,
  emptyProgress,
  migrateSave,
  parseSave,
  parseSettings,
  type KV,
} from '../src/persistence/save';
import { obj } from './helpers';

/** In-memory localStorage stand-in. */
class MemKV implements KV {
  map = new Map<string, string>();
  failWrites = false;
  failReads = false;
  getItem(k: string) {
    if (this.failReads) throw new Error('denied');
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const kvWith = (data: unknown) => {
  const kv = new MemKV();
  kv.map.set(SAVE_KEY, typeof data === 'string' ? data : JSON.stringify(data));
  return kv;
};
const corruptKeys = (kv: MemKV) => [...kv.map.keys()].filter((k) => k.startsWith(`${SAVE_KEY}.corrupt-`));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('defaults', () => {
  it('a fresh store has defaults and is not "recovered"', () => {
    const s = new SaveStore(new MemKV());
    expect(s.data).toEqual(defaultSave());
    expect(s.recovered).toBe(false);
    expect(s.data.version).toBe(SAVE_VERSION);
  });

  it('defaultSave returns independent copies of settings', () => {
    const a = defaultSave();
    a.settings.master = 0;
    expect(DEFAULT_SETTINGS.master).toBe(0.8);
    expect(defaultSave().settings.master).toBe(0.8);
  });

  it('progress() for an unknown level is empty progress and not stored', () => {
    const s = new SaveStore(new MemKV());
    expect(s.progress('nope')).toEqual(emptyProgress());
    expect(s.data.progress).toEqual({});
  });

  it('works with no storage at all (kv = null)', () => {
    const s = new SaveStore(null);
    s.setProgress('a', { ...emptyProgress(), solved: true });
    expect(s.flush()).toBe(true);
    expect(s.progress('a').solved).toBe(true);
  });
});

describe('persistence round trip', () => {
  it('flush writes JSON that a new store reads back identically', () => {
    const kv = new MemKV();
    const s = new SaveStore(kv);
    s.data.settings.music = 0.1;
    s.data.settings.unlockAll = true;
    s.setProgress('lvl', { ...emptyProgress(), solved: true, bestParts: 2, bestTime: 3.5, attempts: 4, solvedAt: '2026-01-01T00:00:00Z' });
    const custom = blankLevel('my-level', 'Mine');
    custom.startingObjects.push(obj('ball', 10, 10, {}, { id: 'b' }));
    s.upsertCustomLevel(custom);
    s.setBuild('lvl', { objects: [obj('ball', 1, 2, {}, { id: 'pb' })], connections: [] });
    s.data.sandboxSlots.push({ id: 'slot1', name: 'Slot', environment: 'basement', build: { objects: [], connections: [] }, updated: '2026-02-02T00:00:00Z' });
    s.data.editorLevelId = 'my-level';
    expect(s.flush()).toBe(true);
    const back = new SaveStore(kv);
    expect(back.recovered).toBe(false);
    expect(JSON.parse(JSON.stringify(back.data))).toEqual(JSON.parse(JSON.stringify(s.data)));
  });

  it('save() is debounced and writes once after 250ms', () => {
    vi.useFakeTimers();
    const kv = new MemKV();
    const spy = vi.spyOn(kv, 'setItem');
    const s = new SaveStore(kv);
    s.setProgress('a', emptyProgress());
    s.setProgress('b', emptyProgress());
    s.setBuild('a', { objects: [], connections: [] });
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(249);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(kv.map.get(SAVE_KEY)!).progress).toHaveProperty('b');
  });

  it('flush cancels a pending debounced save', () => {
    vi.useFakeTimers();
    const kv = new MemKV();
    const spy = vi.spyOn(kv, 'setItem');
    const s = new SaveStore(kv);
    s.save();
    s.flush();
    vi.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('flush reports failure instead of throwing when storage is full', () => {
    const kv = new MemKV();
    const s = new SaveStore(kv);
    kv.failWrites = true;
    expect(() => s.flush()).not.toThrow();
    expect(s.flush()).toBe(false);
  });

  it('unreadable storage yields defaults without throwing', () => {
    const kv = new MemKV();
    kv.failReads = true;
    const s = new SaveStore(kv);
    expect(s.data).toEqual(defaultSave());
    expect(s.recovered).toBe(false);
  });

  it('uses the global localStorage when none is injected', () => {
    const map = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    });
    map.set(SAVE_KEY, JSON.stringify({ version: 2, progress: { x: { solved: true } } }));
    const s = new SaveStore();
    expect(s.progress('x').solved).toBe(true);
    s.data.editorLevelId = 'e';
    s.flush();
    expect(JSON.parse(map.get(SAVE_KEY)!).editorLevelId).toBe('e');
    expect(map.has('__fw_probe')).toBe(false);
  });

  it('falls back to no storage when localStorage throws (private mode)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => {},
    });
    const s = new SaveStore();
    expect(s.data).toEqual(defaultSave());
    expect(s.flush()).toBe(true); // nothing to write to, nothing fails
  });
});

describe('corruption recovery', () => {
  it('garbage JSON is quarantined and replaced by defaults', () => {
    const kv = kvWith('{"version":2, "progress": {');
    const s = new SaveStore(kv);
    expect(s.recovered).toBe(true);
    expect(s.data).toEqual(defaultSave());
    const keys = corruptKeys(kv);
    expect(keys).toHaveLength(1);
    expect(kv.map.get(keys[0])).toBe('{"version":2, "progress": {');
    // the original is not overwritten until the next flush
    expect(kv.map.get(SAVE_KEY)).toBe('{"version":2, "progress": {');
  });

  it('non-object JSON is treated as corrupt', () => {
    for (const text of ['[]', '42', '"hi"', 'null']) {
      const { data, recovered } = parseSave(text);
      expect(recovered).toBe(true);
      expect(data).toEqual(defaultSave());
    }
  });

  it('empty / missing text is a fresh start, not a recovery', () => {
    expect(parseSave(null).recovered).toBe(false);
    expect(parseSave('').recovered).toBe(false);
  });

  it('quarantine failure (storage full) does not throw', () => {
    const kv = kvWith('not json');
    kv.failWrites = true;
    const s = new SaveStore(kv);
    expect(s.recovered).toBe(true);
  });

  it('partially damaged saves keep everything that is still valid', () => {
    const good = blankLevel('good');
    const { data, recovered } = parseSave(
      JSON.stringify({
        version: 2,
        settings: { master: 0.3 },
        progress: { a: { solved: true, bestParts: 2 } },
        customLevels: [good, { ...blankLevel('future'), schemaVersion: LEVEL_SCHEMA_VERSION + 5 }, 'junk'],
        builds: { a: { objects: [], connections: [] }, b: 'oops', c: { objects: 'x', connections: [] } },
        sandboxSlots: [{ id: 's1' }, { name: 'no id' }, 5],
      }),
    );
    expect(recovered).toBe(true);
    expect(data.settings.master).toBe(0.3);
    expect(data.progress.a).toMatchObject({ solved: true, bestParts: 2 });
    // 'junk' is a string, so parseLevel throws on it -> dropped, as is the future-schema level
    expect(data.customLevels.map((l) => l.id)).toEqual(['good']);
    expect(Object.keys(data.builds)).toEqual(['a']);
    expect(data.sandboxSlots.map((s) => s.id)).toEqual(['s1']);
  });

  it('settings: out-of-range numbers are clamped, wrong types fall back to defaults', () => {
    const s = parseSettings({ master: 5, sfx: -1, music: NaN, muted: 'yes', textScale: 2, reducedMotion: true, tips: 0 });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, master: 1, sfx: 0, reducedMotion: true });
    expect(parseSettings({ textScale: 1.15 }).textScale).toBe(1.15);
    expect(parseSettings({ textScale: 1.3 }).textScale).toBe(1.3);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings([1, 2])).toEqual(DEFAULT_SETTINGS);
  });

  it('progress entries with junk fields are repaired field by field', () => {
    const { data } = parseSave(
      JSON.stringify({ progress: { a: { solved: 1, elegant: true, bestParts: '3', bestStages: 4, bestTime: 2.5, attempts: -3.7, solvedAt: 5 }, b: 'x' } }),
    );
    expect(data.progress.a).toEqual({ ...emptyProgress(), elegant: true, bestStages: 4, bestTime: 2.5, attempts: 0 });
    expect(data.progress.b).toEqual(emptyProgress());
    expect(parseSave(JSON.stringify({ progress: { a: { attempts: 3.9 } } })).data.progress.a.attempts).toBe(3);
  });

  it('a non-string editorLevelId is dropped', () => {
    expect(parseSave(JSON.stringify({ editorLevelId: 7 })).data.editorLevelId).toBeNull();
    expect(parseSave(JSON.stringify({ editorLevelId: 'x' })).data.editorLevelId).toBe('x');
  });
});

describe('versioning', () => {
  it('v1 saves with a customLevels map migrate to an array', () => {
    const a = blankLevel('a');
    const b = blankLevel('b');
    const { data, recovered } = parseSave(JSON.stringify({ version: 1, customLevels: { a, b } }));
    expect(recovered).toBe(false);
    expect(data.customLevels.map((l) => l.id).sort()).toEqual(['a', 'b']);
    expect(data.version).toBe(SAVE_VERSION);
  });

  it('a save with no version is treated as v1', () => {
    const { data } = parseSave(JSON.stringify({ customLevels: { a: blankLevel('a') } }));
    expect(data.customLevels.map((l) => l.id)).toEqual(['a']);
  });

  it('migrateSave leaves v2 alone and does not mutate unrelated fields', () => {
    const raw = { version: 2, customLevels: { a: 1 }, extra: 1 };
    expect(migrateSave({ ...raw })).toEqual(raw);
    expect(migrateSave({ version: 1, customLevels: { a: 1 } })).toEqual({ version: 2, customLevels: [1] });
  });

  it('a save from a newer build loads what it understands without crashing', () => {
    const { data, recovered } = parseSave(
      JSON.stringify({ version: SAVE_VERSION + 3, progress: { a: { solved: true } }, newFeature: { x: 1 } }),
    );
    expect(recovered).toBe(false);
    expect(data.progress.a.solved).toBe(true);
    expect(data.version).toBe(SAVE_VERSION);
    expect((data as any).newFeature).toBeUndefined();
  });

  it('custom levels are normalised through parseLevel on load (including exported wrappers)', () => {
    const lvl = JSON.parse(exportLevel(blankLevel('wrapped')));
    const { data } = parseSave(JSON.stringify({ version: 2, customLevels: [lvl, { id: 'raw', name: 'n'.repeat(200), world: { width: 1 } }] }));
    expect(data.customLevels.map((l) => l.id)).toEqual(['wrapped', 'raw']);
    expect(data.customLevels[1].name).toHaveLength(80);
    expect(data.customLevels[1].world.width).toBe(800);
  });
});

describe('progress merge across sessions', () => {
  const lvl = (() => {
    const l = blankLevel('p');
    l.bonus = { elegantParts: 2, absurdStages: 2 };
    return l;
  })();
  const chain = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: '', domain: 'gravity', time: 0 }));

  it('best scores and earned bonuses survive save/reload and later worse attempts', () => {
    const kv = new MemKV();
    let s = new SaveStore(kv);
    s.setProgress('p', mergeProgress(s.progress('p'), scoreAttempt(lvl, 5, 1, chain(0)))); // elegant
    s.flush();
    s = new SaveStore(kv);
    s.setProgress('p', mergeProgress(s.progress('p'), scoreAttempt(lvl, 2, 6, chain(3)))); // absurd, faster
    s.flush();
    s = new SaveStore(kv);
    s.setProgress('p', mergeProgress(s.progress('p'), scoreAttempt(lvl, null, 0, chain(9)))); // fail
    s.setProgress('p', mergeProgress(s.progress('p'), scoreAttempt(lvl, 9, 9, chain(1)))); // worse
    s.flush();
    const p = new SaveStore(kv).progress('p');
    expect(p).toMatchObject({ solved: true, elegant: true, absurd: true, bestParts: 1, bestStages: 3, bestTime: 2, attempts: 4 });
    expect(typeof p.solvedAt).toBe('string');
  });
});

describe('custom levels, builds and sandbox slots', () => {
  it('upsertCustomLevel inserts new levels first and replaces existing ones in place', () => {
    const s = new SaveStore(new MemKV());
    s.upsertCustomLevel(blankLevel('a', 'A'));
    s.upsertCustomLevel(blankLevel('b', 'B'));
    expect(s.data.customLevels.map((l) => l.id)).toEqual(['b', 'a']);
    s.upsertCustomLevel(blankLevel('a', 'A2'));
    expect(s.data.customLevels.map((l) => `${l.id}:${l.name}`)).toEqual(['b:B', 'a:A2']);
  });

  it('deleteCustomLevel removes the level, its build, its progress and the editor pointer', () => {
    const s = new SaveStore(new MemKV());
    s.upsertCustomLevel(blankLevel('a'));
    s.upsertCustomLevel(blankLevel('b'));
    s.setBuild('a', { objects: [], connections: [] });
    s.setProgress('a', { ...emptyProgress(), solved: true });
    s.setProgress('b', { ...emptyProgress(), solved: true });
    s.data.editorLevelId = 'a';
    s.deleteCustomLevel('a');
    expect(s.data.customLevels.map((l) => l.id)).toEqual(['b']);
    expect(s.data.builds.a).toBeUndefined();
    expect(s.data.progress.a).toBeUndefined();
    expect(s.data.progress.b.solved).toBe(true);
    expect(s.data.editorLevelId).toBeNull();
    s.data.editorLevelId = 'b';
    s.deleteCustomLevel('zzz');
    expect(s.data.editorLevelId).toBe('b');
  });

  it('getBuild re-validates the stored build against its level', () => {
    const s = new SaveStore(new MemKV());
    const l = blankLevel('lv');
    l.startingObjects.push(obj('battery', 0, 0, {}, { id: 'bat' }));
    expect(s.getBuild(l)).toBeNull();
    s.setBuild('lv', {
      objects: [obj('ball', 1, 1, {}, { id: 'mine' }), obj('ball', 1, 1, {}, { id: 'bat' }), { id: 'q', type: 'nope', x: 0, y: 0, angle: 0 }],
      connections: [{ id: 'w', kind: 'wire', from: { obj: 'bat', port: 'out' }, to: { obj: 'ghost', port: 'in' } }],
    });
    const b = s.getBuild(l)!;
    expect(b.objects.map((o) => o.id)).toEqual(['mine']);
    expect(b.connections).toEqual([]);
  });

  it('sandbox slots are repaired on load', () => {
    const { data } = parseSave(
      JSON.stringify({
        sandboxSlots: [
          { id: 'a', name: 'x'.repeat(100), environment: 'research', build: { objects: [obj('ball', 0, 0)], connections: [] }, updated: '2026-03-03' },
          { id: 'b', name: 5, build: 'bad' },
        ],
      }),
    );
    expect(data.sandboxSlots[0].name).toHaveLength(60);
    expect(data.sandboxSlots[0].environment).toBe('research');
    expect(data.sandboxSlots[0].build.objects).toHaveLength(1);
    expect(data.sandboxSlots[1]).toEqual({
      id: 'b',
      name: 'Sandbox machine',
      environment: 'garage',
      build: { objects: [], connections: [] },
      updated: new Date(0).toISOString(),
    });
  });
});
