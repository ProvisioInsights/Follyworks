// Level parsing, validation, migration and export/import round-trips (src/core/level.ts).

import { describe, expect, it } from 'vitest';
import '../src/components';
import { getComponent, normalizeProps } from '../src/components';
import {
  ENVIRONMENT_IDS,
  LevelError,
  blankLevel,
  exportLevel,
  migrateLevel,
  parseBuild,
  parseConnection,
  parseGoal,
  parseLevel,
  parseObject,
} from '../src/core/level';
import { LEVEL_SCHEMA_VERSION, type LevelDef } from '../src/core/types';
import { CAMPAIGN } from '../src/game/campaign';
import { level, obj, wire } from './helpers';

/** JSON-normalised copy (drops undefined keys), the form a level takes on disk. */
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** A level with every object's props filled/clamped exactly as the registry (and the simulation) does. */
const withNormalisedProps = (l: LevelDef): LevelDef => {
  const c = plain(l);
  for (const o of [...c.fixedObjects, ...c.startingObjects]) o.props = normalizeProps(getComponent(o.type)!, o.props);
  return c;
};

const sampleLevel = (): LevelDef => {
  const bat = obj('battery', 200, 800, {}, { id: 'bat' });
  const sw = obj('toggle_switch', 320, 800, { on: true }, { id: 'sw', angle: Math.PI / 2, flip: true });
  const motor = obj('motor', 500, 800, { rpm: 80 }, { id: 'mot', flip: true });
  const shelf = obj('wall', 800, 600, { w: 300, h: 30, material: 'steel' }, { id: 'shelf', angle: 0.1 });
  const ball = obj('ball', 400, 200, {}, { id: 'ball' });
  const bucket = obj('bucket', 900, 860, { anchored: false }, { id: 'bucket' });
  const l = level([bat, sw, motor, ball, bucket], [wire(bat, 'out', sw, 'in'), wire(sw, 'out', motor, 'in')], [
    { kind: 'containerCount', container: 'bucket', count: 2, filter: { type: 'ball' }, label: 'Two in' },
    { kind: 'enterRegion', target: { id: 'ball' }, region: { x: 10, y: 20, w: 30, h: 40 }, hold: 1.5 },
    { kind: 'contact', a: { tag: 'ball' }, b: { id: 'bucket' } },
    { kind: 'activate', target: { id: 'mot' }, duration: 2 },
    { kind: 'height', target: { type: 'ball' }, maxY: 120 },
    { kind: 'destroyed', target: { id: 'ball' } },
  ]);
  l.id = 'sample';
  l.name = 'Sample';
  l.description = 'A sample level';
  l.environment = 'greenhouse';
  l.world = { width: 2000, height: 1000, gravity: 0.5 };
  l.fixedObjects = [shelf];
  l.inventory = [
    { type: 'ball', count: 2 },
    { type: 'rope', count: -1 },
    { type: 'wire', count: 3 },
  ];
  l.restrictions = { maxParts: 5, timeLimit: 30 };
  l.bonus = { elegantParts: 2, absurdStages: 6, elegantTime: 4 };
  l.hints = ['one', 'two'];
  l.metadata = { author: 'Tester', chapter: 3, order: 2, created: '2026-01-01T00:00:00.000Z', updated: '2026-01-02T00:00:00.000Z', tutorial: true, blurb: 'hi' };
  return withNormalisedProps(l);
};

describe('parseLevel: round trips', () => {
  it('a fully populated level survives export -> import unchanged', () => {
    const l = sampleLevel();
    const { level: back, problems } = parseLevel(exportLevel(l));
    expect(problems).toEqual([]);
    expect(plain(back)).toEqual(plain(l));
  });

  it('parsing is idempotent: parse(serialise(parse(x))) == parse(x)', () => {
    const once = parseLevel(exportLevel(sampleLevel())).level;
    const twice = parseLevel(JSON.stringify(once)).level;
    expect(plain(twice)).toEqual(plain(once));
  });

  it('accepts a raw object, a raw JSON string and the export wrapper alike', () => {
    const l = sampleLevel();
    const a = parseLevel(l).level;
    const b = parseLevel(JSON.stringify(l)).level;
    const c = parseLevel(exportLevel(l)).level;
    expect(plain(a)).toEqual(plain(b));
    expect(plain(b)).toEqual(plain(c));
  });

  it('exportLevel produces the versioned wrapper', () => {
    const w = JSON.parse(exportLevel(sampleLevel()));
    expect(w.format).toBe('follyworks-level');
    expect(w.version).toBe(LEVEL_SCHEMA_VERSION);
    expect(w.level.id).toBe('sample');
  });

  it('does not mutate its input', () => {
    const l = sampleLevel();
    const before = JSON.stringify(l);
    parseLevel(l);
    expect(JSON.stringify(l)).toBe(before);
    const legacy: any = { objects: [obj('ball', 1, 2, {}, { id: 'b' })] };
    parseLevel(legacy);
    expect(legacy.startingObjects).toBeUndefined();
    expect(legacy.schemaVersion).toBeUndefined();
  });

  it('blankLevel parses cleanly and round-trips', () => {
    const b = blankLevel('blank', 'My Blank');
    expect(b.schemaVersion).toBe(LEVEL_SCHEMA_VERSION);
    expect(b.name).toBe('My Blank');
    expect(b.environment).toBe('garage');
    expect(b.world).toEqual({ width: 1600, height: 900, gravity: 1 });
    expect(b.metadata?.author).toBe('You');
    expect(Number.isNaN(Date.parse(b.metadata!.created!))).toBe(false);
    const { level: back, problems } = parseLevel(exportLevel(b));
    expect(problems).toEqual([]);
    expect(plain(back)).toEqual(plain(b));
    expect(blankLevel('x').name).toBe('Untitled Contraption');
  });

  it('blankLevel returns fresh arrays each call', () => {
    const a = blankLevel('a');
    const b = blankLevel('b');
    a.startingObjects.push(obj('ball', 0, 0));
    expect(b.startingObjects).toEqual([]);
  });
});

describe('campaign levels round-trip through export -> import', () => {
  it('has a campaign to check', () => {
    expect(CAMPAIGN.length).toBeGreaterThan(20);
    expect(new Set(CAMPAIGN.map((c) => c.level.id)).size).toBe(CAMPAIGN.length);
  });

  for (const entry of CAMPAIGN) {
    it(`${entry.level.id} is unchanged (modulo prop defaults) and problem-free`, () => {
      const { level: back, problems } = parseLevel(exportLevel(entry.level));
      expect(problems).toEqual([]);
      expect(plain(back)).toEqual(withNormalisedProps(entry.level));
      // and the imported form is a fixed point: exporting it again changes nothing at all
      expect(plain(parseLevel(exportLevel(back)).level)).toEqual(plain(back));
      // and the known solutions survive parseBuild against the re-imported level
      for (const s of entry.solutions) {
        const want = plain(s);
        for (const o of want.objects) o.props = normalizeProps(getComponent(o.type)!, o.props);
        expect(plain(parseBuild(plain(s), back))).toEqual(want);
      }
    });
  }
});

describe('campaign authoring vs component specs', () => {
  // BUG (content, src/game/levels/*): several campaign walls are authored thinner than the wall
  // component's minimum size (w/h min 20), e.g. t2-ramp-it-up "t2-chute-l" w: 14. normalizeProps
  // silently widens them to 20 both on import and in the Simulation, so the geometry the player
  // gets is not the geometry the level file describes (chute gaps shrink by 6-8px).
  it('every authored prop in the campaign is already within its component spec', () => {
    const out: string[] = [];
    for (const e of CAMPAIGN)
      for (const o of [...e.level.fixedObjects, ...e.level.startingObjects]) {
        const n = normalizeProps(getComponent(o.type)!, o.props);
        for (const [k, v] of Object.entries(o.props ?? {})) if (n[k] !== v) out.push(`${e.level.id}/${o.id}.${k}=${v}->${n[k]}`);
      }
    expect(out).toEqual([]);
  });

  it('campaign objects only use angle/flip where the part supports it', () => {
    for (const e of CAMPAIGN)
      for (const o of [...e.level.fixedObjects, ...e.level.startingObjects]) {
        const d = getComponent(o.type)!;
        if (!d.rotatable) expect(o.angle ?? 0).toBe(0);
        if (!d.flippable) expect(o.flip ?? false).toBe(false);
      }
  });
});

describe('parseLevel: errors that make data unusable', () => {
  it('throws LevelError on garbage JSON', () => {
    expect(() => parseLevel('{not json')).toThrow(LevelError);
    expect(() => parseLevel('')).toThrow(LevelError);
    expect(() => parseLevel('{not json')).toThrow(/JSON/);
  });

  it('throws LevelError on JSON that is not an object', () => {
    for (const bad of ['[]', '42', '"level"', 'null', 'true']) expect(() => parseLevel(bad)).toThrow(LevelError);
    for (const bad of [null, undefined, 7, [], 'x' as unknown]) expect(() => parseLevel(bad)).toThrow(LevelError);
  });

  it('throws LevelError on a newer schema version', () => {
    const l = { ...sampleLevel(), schemaVersion: LEVEL_SCHEMA_VERSION + 1 };
    expect(() => parseLevel(l)).toThrow(LevelError);
    expect(() => parseLevel(l)).toThrow(/newer/);
    expect(() => parseLevel(exportLevel(l as LevelDef))).toThrow(LevelError);
  });

  it('LevelError is an Error', () => {
    try {
      parseLevel('nope');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(LevelError);
    }
  });

  it('an export wrapper with a non-object level falls back to treating the wrapper as the level', () => {
    // { format, level: "x" } is not unwrapped; the wrapper itself parses as an empty level.
    const { level: l } = parseLevel({ format: 'follyworks-level', level: 'x' });
    expect(l.startingObjects).toEqual([]);
  });
});

describe('parseLevel: recoverable problems (reported, not thrown)', () => {
  it('an empty object becomes a valid default level', () => {
    const { level: l, problems } = parseLevel({});
    expect(problems).toEqual([]);
    expect(l.schemaVersion).toBe(LEVEL_SCHEMA_VERSION);
    expect(l.id).toMatch(/^custom-/);
    expect(l.name).toBe('Untitled Contraption');
    expect(l.description).toBe('');
    expect(l.environment).toBe('garage');
    expect(l.world).toEqual({ width: 1600, height: 900, gravity: 1 });
    expect(l.fixedObjects).toEqual([]);
    expect(l.startingObjects).toEqual([]);
    expect(l.connections).toEqual([]);
    expect(l.inventory).toEqual([]);
    expect(l.goals).toEqual([]);
    expect(l.restrictions).toBeUndefined();
    expect(l.bonus).toBeUndefined();
    expect(l.metadata).toBeUndefined();
  });

  it('unknown component types are dropped with a problem', () => {
    const { level: l, problems } = parseLevel({
      startingObjects: [{ id: 'x', type: 'warp_drive', x: 1, y: 1 }, obj('ball', 5, 5, {}, { id: 'b' })],
    });
    expect(l.startingObjects.map((o) => o.id)).toEqual(['b']);
    expect(problems.some((p) => p.includes('warp_drive'))).toBe(true);
  });

  it('objects without id, non-object entries and duplicate ids are dropped', () => {
    const { level: l, problems } = parseLevel({
      fixedObjects: [{ type: 'wall', x: 0, y: 0 }, 'junk', obj('wall', 10, 10, {}, { id: 'dup' })],
      startingObjects: [obj('ball', 1, 1, {}, { id: 'dup' }), obj('ball', 2, 2, {}, { id: 'ok' })],
    });
    expect(l.fixedObjects.map((o) => o.id)).toEqual(['dup']);
    expect(l.fixedObjects[0].type).toBe('wall');
    expect(l.startingObjects.map((o) => o.id)).toEqual(['ok']);
    expect(problems).toHaveLength(3);
    expect(problems.some((p) => /without id/.test(p))).toBe(true);
    expect(problems.some((p) => /not an object/.test(p))).toBe(true);
    expect(problems.some((p) => /duplicate id dup/.test(p))).toBe(true);
  });

  it('missing / non-finite coordinates default to 0, props are normalised and clamped', () => {
    const { level: l } = parseLevel({
      startingObjects: [{ id: 'p', type: 'plank', x: 'left', y: Infinity, props: { length: 99999, bogus: 1 } }],
    });
    const p = l.startingObjects[0];
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
    expect(p.props).toEqual({ length: 600 });
  });

  it('angle is kept only for rotatable parts and flip only for flippable parts', () => {
    const { level: l } = parseLevel({
      startingObjects: [
        { id: 'ball', type: 'ball', x: 0, y: 0, angle: 1, flip: true },
        { id: 'plank', type: 'plank', x: 0, y: 0, angle: 1, flip: true },
        { id: 'fan', type: 'fan', x: 0, y: 0, angle: 0.5, flip: true },
        { id: 'fan2', type: 'fan', x: 0, y: 0, flip: 'yes' },
      ],
    });
    const [ball, plank, fan, fan2] = l.startingObjects;
    expect(ball.angle).toBe(0);
    expect(ball.flip).toBeUndefined();
    expect(plank.angle).toBe(1);
    expect(plank.flip).toBeUndefined();
    expect(fan.angle).toBe(0.5);
    expect(fan.flip).toBe(true);
    expect(fan2.flip).toBeUndefined();
  });

  it('world dimensions and gravity are clamped', () => {
    const lo = parseLevel({ world: { width: 10, height: 10, gravity: 0 } }).level.world;
    expect(lo).toEqual({ width: 800, height: 500, gravity: 0.2 });
    const hi = parseLevel({ world: { width: 1e6, height: 1e6, gravity: 50 } }).level.world;
    expect(hi).toEqual({ width: 3200, height: 1800, gravity: 2 });
    const junk = parseLevel({ world: 'big' }).level.world;
    expect(junk).toEqual({ width: 1600, height: 900, gravity: 1 });
  });

  it('unknown environment falls back to garage, known ones are kept', () => {
    expect(parseLevel({ environment: 'moon' }).level.environment).toBe('garage');
    for (const env of ENVIRONMENT_IDS) expect(parseLevel({ environment: env }).level.environment).toBe(env);
  });

  it('name, description, hints, author and blurb are length-limited', () => {
    const { level: l } = parseLevel({
      name: 'n'.repeat(500),
      description: 'd'.repeat(1000),
      hints: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 3],
      metadata: { author: 'a'.repeat(100), blurb: 'b'.repeat(300), tutorial: 'yes', chapter: '2' },
    });
    expect(l.name).toHaveLength(80);
    expect(l.description).toHaveLength(400);
    expect(l.hints).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(l.metadata!.author).toHaveLength(60);
    expect(l.metadata!.blurb).toHaveLength(160);
    expect(l.metadata!.tutorial).toBeUndefined();
    expect(l.metadata!.chapter).toBeUndefined();
  });

  it('connections to missing objects are dropped with a problem', () => {
    const a = obj('battery', 0, 0, {}, { id: 'a' });
    const { level: l, problems } = parseLevel({
      startingObjects: [a],
      connections: [{ id: 'w1', kind: 'wire', from: { obj: 'a', port: 'out' }, to: { obj: 'ghost', port: 'in' } }],
    });
    expect(l.connections).toEqual([]);
    expect(problems).toContain('connection w1 points at missing objects');
  });

  it('connections with a bad kind or bad endpoints are dropped', () => {
    const a = obj('battery', 0, 0, {}, { id: 'a' });
    const b = obj('motor', 0, 0, {}, { id: 'b' });
    const { level: l, problems } = parseLevel({
      startingObjects: [a, b],
      connections: [
        { id: 'c1', kind: 'chain', from: { obj: 'a', port: 'out' }, to: { obj: 'b', port: 'in' } },
        { id: 'c2', kind: 'wire', from: { obj: 'a' }, to: { obj: 'b', port: 'in' } },
        { id: 'c3', kind: 'wire', from: { obj: 'a', port: 'out' }, to: { obj: 'b', port: 'in' } },
      ],
    });
    expect(l.connections.map((c) => c.id)).toEqual(['c3']);
    expect(problems.some((p) => p.includes('bad connection kind chain'))).toBe(true);
    expect(problems.some((p) => p.includes('bad endpoints'))).toBe(true);
  });

  it('inventory: unknown and internal parts dropped, tools allowed, counts clamped and merged', () => {
    const { level: l, problems } = parseLevel({
      inventory: [
        { type: 'ball', count: 2 },
        { type: 'ball', count: 3 },
        { type: 'crate', count: 500 },
        { type: 'rope', count: -5 },
        { type: 'rope', count: 2 },
        { type: 'belt' },
        { type: 'cannonball', count: 1 },
        { type: 'nonsense', count: 1 },
        { count: 2 },
        'junk',
      ],
    });
    expect(l.inventory).toEqual([
      { type: 'ball', count: 5 },
      { type: 'crate', count: 99 },
      { type: 'rope', count: -1 },
      { type: 'belt', count: 1 },
    ]);
    expect(problems).toContain('inventory has unknown part cannonball');
    expect(problems).toContain('inventory has unknown part nonsense');
  });

  // BUG (src/core/level.ts:216): a single inventory entry is clamped to 99, but duplicate entries
  // for the same type are summed after clamping, so two entries of 60 yield 120.
  it('merged duplicate inventory entries respect the same 99 cap as a single entry', () => {
    const { level: l } = parseLevel({ inventory: [{ type: 'ball', count: 60 }, { type: 'ball', count: 60 }] });
    expect(l.inventory).toEqual([{ type: 'ball', count: 99 }]);
  });

  it('restrictions and bonus are clamped', () => {
    const { level: l } = parseLevel({
      restrictions: { maxParts: -3.4, timeLimit: 0 },
      bonus: { elegantParts: 2.6, absurdStages: -3, elegantTime: 0.1 },
    });
    expect(l.restrictions).toEqual({ maxParts: 0, timeLimit: 1 });
    expect(l.bonus).toEqual({ elegantParts: 3, absurdStages: 0, elegantTime: 0.5 });
    const { level: l2 } = parseLevel({ restrictions: { maxParts: 'many' }, bonus: {} });
    expect(l2.restrictions).toEqual({});
    expect(l2.bonus).toEqual({});
  });

  it('goals: every kind parses; bad ones are dropped with a problem', () => {
    const problems: string[] = [];
    expect(parseGoal({ kind: 'enterRegion', target: { id: 'x' }, region: { x: 1, y: 2, w: 1, h: 900 } }, problems)).toEqual({
      kind: 'enterRegion',
      target: { id: 'x' },
      region: { x: 1, y: 2, w: 4, h: 900 },
      hold: undefined,
      label: undefined,
    });
    expect(parseGoal({ kind: 'containerCount', container: 'b', count: 0 }, problems)).toMatchObject({ count: 1 });
    expect(parseGoal({ kind: 'containerCount', container: 'b', count: 2.6 }, problems)).toMatchObject({ count: 3 });
    expect(parseGoal({ kind: 'height', target: { tag: 'ball' } }, problems)).toMatchObject({ maxY: 0 });
    expect(problems).toEqual([]);

    for (const bad of [
      { kind: 'enterRegion', target: { id: 'x' } },
      { kind: 'enterRegion', region: { x: 0, y: 0, w: 10, h: 10 } },
      { kind: 'contact', a: { id: 'x' } },
      { kind: 'activate', target: { colour: 'red' } },
      { kind: 'containerCount', container: 5 },
      { kind: 'height' },
      { kind: 'destroyed', target: 'x' },
      { kind: 'teleport', target: { id: 'x' } },
    ]) {
      const ps: string[] = [];
      expect(parseGoal(bad, ps)).toBeNull();
      expect(ps).toHaveLength(1);
      expect(ps[0]).toMatch(/unrecognised goal/);
    }
  });

  it('selectors prefer id over type over tag', () => {
    const ps: string[] = [];
    expect(parseGoal({ kind: 'destroyed', target: { id: 'a', type: 'b', tag: 'c' } }, ps)).toMatchObject({ target: { id: 'a' } });
    expect(parseGoal({ kind: 'destroyed', target: { type: 'b', tag: 'c' } }, ps)).toMatchObject({ target: { type: 'b' } });
  });

  it('goals referencing objects that do not exist are kept as-is (not validated)', () => {
    // Documenting actual behaviour: goal refs are not cross-checked against the object list,
    // so this neither throws nor reports a problem.
    const { level: l, problems } = parseLevel({
      goals: [{ kind: 'containerCount', container: 'no-such-bucket', count: 1 }, { kind: 'destroyed', target: { id: 'ghost' } }],
    });
    expect(l.goals).toHaveLength(2);
    expect(problems).toEqual([]);
  });
});

describe('migrateLevel', () => {
  it('upgrades schema 0 drafts: objects -> startingObjects', () => {
    const { level: l, problems } = parseLevel({ objects: [obj('ball', 10, 20, {}, { id: 'b' })] });
    expect(problems).toEqual([]);
    expect(l.startingObjects.map((o) => o.id)).toEqual(['b']);
    expect(l.schemaVersion).toBe(LEVEL_SCHEMA_VERSION);
  });

  it('does not overwrite startingObjects that already exist', () => {
    const r = migrateLevel({ objects: [1], startingObjects: [2] });
    expect(r.startingObjects).toEqual([2]);
    expect(r.schemaVersion).toBe(1);
  });

  it('leaves current-version levels untouched', () => {
    const raw = { schemaVersion: 1, objects: [1] };
    const r = migrateLevel(raw);
    expect(r.startingObjects).toBeUndefined();
  });

  it('throws on newer versions', () => {
    expect(() => migrateLevel({ schemaVersion: 2 })).toThrow(LevelError);
  });
});

describe('parseObject / parseConnection', () => {
  it('parseObject normalises props for every palette component', () => {
    const ps: string[] = [];
    const o = parseObject({ id: 'g', type: 'gear', x: 3, y: 4, props: { size: 'huge' } }, ps);
    expect(o).toEqual({ id: 'g', type: 'gear', x: 3, y: 4, angle: 0, props: normalizeProps(getComponent('gear')!, {}) });
    expect(ps).toEqual([]);
  });

  it('parseConnection keeps only primitive props and string via entries', () => {
    const ps: string[] = [];
    const c = parseConnection(
      { id: 'r', kind: 'rope', from: { obj: 'a', port: 'top' }, to: { obj: 'b', port: 'top' }, via: ['p1', 2, 'p2'], props: { slack: 5, f: true, s: 'x', o: {}, n: null } },
      ps,
    );
    expect(c).toEqual({ id: 'r', kind: 'rope', from: { obj: 'a', port: 'top' }, to: { obj: 'b', port: 'top' }, via: ['p1', 'p2'], props: { slack: 5, f: true, s: 'x' } });
  });

  it('parseConnection invents an id when missing', () => {
    const c = parseConnection({ kind: 'belt', from: { obj: 'a', port: 'rotor' }, to: { obj: 'b', port: 'rotor' } }, []);
    expect(c!.id).toMatch(/^c[a-z0-9]+$/);
  });

  it('parseConnection ignores non-objects', () => {
    expect(parseConnection(5, [])).toBeNull();
  });
});

describe('parseBuild', () => {
  const lvl = () => {
    const l = level([obj('battery', 100, 800, {}, { id: 'bat' }), obj('motor', 300, 800, {}, { id: 'mot' })]);
    l.fixedObjects = [obj('wall', 500, 700, {}, { id: 'floor' })];
    return l;
  };

  it('returns an empty build for non-objects', () => {
    expect(parseBuild(null, lvl())).toEqual({ objects: [], connections: [] });
    expect(parseBuild('x', lvl())).toEqual({ objects: [], connections: [] });
    expect(parseBuild([], lvl())).toEqual({ objects: [], connections: [] });
    expect(parseBuild({}, lvl())).toEqual({ objects: [], connections: [] });
  });

  it('keeps valid objects and connections, including wires into level objects', () => {
    const b = obj('ball', 200, 200, {}, { id: 'myball' });
    const sw = obj('toggle_switch', 200, 800, {}, { id: 'mysw' });
    const build = {
      objects: [b, sw],
      connections: [
        { id: 'w1', kind: 'wire', from: { obj: 'bat', port: 'out' }, to: { obj: 'mysw', port: 'in' } },
        { id: 'w2', kind: 'wire', from: { obj: 'mysw', port: 'out' }, to: { obj: 'mot', port: 'in' } },
      ],
    };
    const out = parseBuild(build, lvl());
    expect(out.objects.map((o) => o.id)).toEqual(['myball', 'mysw']);
    expect(out.connections.map((c) => c.id)).toEqual(['w1', 'w2']);
  });

  it('drops objects that clash with level ids or each other, and bad types', () => {
    const out = parseBuild(
      {
        objects: [
          obj('ball', 0, 0, {}, { id: 'bat' }),
          obj('ball', 0, 0, {}, { id: 'floor' }),
          obj('ball', 0, 0, {}, { id: 'x' }),
          obj('crate', 0, 0, {}, { id: 'x' }),
          { id: 'y', type: 'unobtainium' },
        ],
        connections: [],
      },
      lvl(),
    );
    expect(out.objects).toHaveLength(1);
    expect(out.objects[0]).toMatchObject({ id: 'x', type: 'ball' });
  });

  it('drops dangling connections', () => {
    const out = parseBuild(
      {
        objects: [obj('hook', 0, 0, {}, { id: 'h' })],
        connections: [
          { id: 'r1', kind: 'rope', from: { obj: 'h', port: 'hook' }, to: { obj: 'gone', port: 'hook' } },
          { id: 'bad', kind: 'glue', from: { obj: 'h', port: 'x' }, to: { obj: 'h', port: 'x' } },
        ],
      },
      lvl(),
    );
    expect(out.connections).toEqual([]);
  });

  it('a level object referenced by the build may not be re-declared in it', () => {
    const out = parseBuild({ objects: [obj('motor', 0, 0, {}, { id: 'mot' })], connections: [] }, lvl());
    expect(out.objects).toEqual([]);
  });
});
