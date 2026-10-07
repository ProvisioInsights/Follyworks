// Editing sessions (src/editor/Session.ts) and inventory rules (src/editor/inventory.ts).

import { describe, expect, it } from 'vitest';
import '../src/components';
import { blankLevel } from '../src/core/level';
import type { BuildDef, LevelDef } from '../src/core/types';
import { UNLIMITED, canPlace, countUsed, inventoryRows, partsPlaced } from '../src/editor/inventory';
import { Session, normalizeAngle } from '../src/editor/Session';
import { level, obj, wire } from './helpers';

const emptyBuild = (): BuildDef => ({ objects: [], connections: [] });

/** A level with a battery -> switch -> conveyor circuit, a spare motor and a parts bin. */
const circuitLevel = (): LevelDef => {
  const bat = obj('battery', 100, 860, {}, { id: 'bat' });
  const sw = obj('toggle_switch', 250, 860, {}, { id: 'sw' });
  const conv = obj('conveyor', 500, 860, {}, { id: 'conv' });
  const motor = obj('motor', 800, 860, {}, { id: 'motor' });
  const shelf = obj('wall', 800, 400, {}, { id: 'shelf' });
  const l = level([bat, sw, conv, motor], [wire(bat, 'out', sw, 'in'), wire(sw, 'out', conv, 'in')], [
    { kind: 'activate', target: { id: 'conv' } },
  ]);
  l.fixedObjects = [shelf];
  l.inventory = [
    { type: 'ball', count: 2 },
    { type: 'crate', count: 1 },
    { type: 'toggle_switch', count: 1 },
    { type: 'hook', count: 3 },
    { type: 'rope', count: 1 },
    { type: 'gear', count: -1 },
  ];
  return l;
};

const player = (l = circuitLevel(), b = emptyBuild()) => new Session('campaign', l, b);
const editor = (l = circuitLevel()) => new Session('editor', l, emptyBuild());

describe('Session basics', () => {
  it('copies its inputs so outside mutation does not leak in', () => {
    const l = circuitLevel();
    const s = player(l);
    l.startingObjects.length = 0;
    expect(s.level.startingObjects).toHaveLength(4);
  });

  it('kind decides who edits what', () => {
    expect(new Session('editor', blankLevel('x'), emptyBuild()).editsLevel).toBe(true);
    for (const k of ['campaign', 'custom', 'sandbox', 'test'] as const) expect(new Session(k, blankLevel('x'), emptyBuild()).editsLevel).toBe(false);
    expect(new Session('sandbox', blankLevel('x'), emptyBuild()).unlimited).toBe(true);
    expect(new Session('editor', blankLevel('x'), emptyBuild()).unlimited).toBe(true);
    expect(new Session('campaign', blankLevel('x'), emptyBuild()).unlimited).toBe(false);
    expect(new Session('custom', blankLevel('x'), emptyBuild()).unlimited).toBe(false);
  });

  it('makeObject gives unique ids and normalised props', () => {
    const s = player();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(s.makeObject('plank', 0, 0).id);
    expect(ids.size).toBe(50);
    const p = s.makeObject('plank', 1, 2, { length: 99999 });
    expect(p).toMatchObject({ type: 'plank', x: 1, y: 2, angle: 0, props: { length: 600 } });
    expect(p.id.startsWith('pla')).toBe(true);
  });

  it('emits change events and bumps version only on real changes', () => {
    const s = player();
    const reasons: string[] = [];
    const off = s.onChange((r) => reasons.push(r));
    const v0 = s.version;
    const b = s.makeObject('ball', 300, 300);
    expect(s.addObject(b)).toBe(true);
    expect(s.moveObjects([b.id], 0, 0)).toBe(false); // no-op: nothing changed
    expect(s.moveObjects([b.id], 5, 0)).toBe(true);
    expect(reasons).toEqual(['add', 'move']);
    expect(s.version).toBe(v0 + 2);
    off();
    s.moveObjects([b.id], 5, 0);
    expect(reasons).toHaveLength(2);
  });

  it('commit returning false rolls back partial mutations', () => {
    const s = player();
    const before = JSON.stringify(s.build);
    const ok = s.commit('x', () => {
      s.build.objects.push(s.makeObject('ball', 0, 0));
      return false;
    });
    expect(ok).toBe(false);
    expect(JSON.stringify(s.build)).toBe(before);
    expect(s.canUndo).toBe(false);
  });

  it('normalizeAngle wraps into (-PI, PI] and rounds to 1e-4', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(Math.PI * 2)).toBe(0);
    expect(normalizeAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2, 4);
    expect(normalizeAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2, 4);
    expect(normalizeAngle(Math.PI * 7)).toBeCloseTo(Math.PI, 4);
    expect(normalizeAngle(0.123456789)).toBe(0.1235);
  });
});

describe('Session: player placing, moving and deleting', () => {
  it('places parts from the bin into the build only', () => {
    const s = player();
    const b = s.makeObject('ball', 300, 300);
    expect(s.addObject(b)).toBe(true);
    expect(s.build.objects.map((o) => o.id)).toEqual([b.id]);
    expect(s.level.startingObjects).toHaveLength(4);
    expect(s.isEditable(b.id)).toBe(true);
    expect(s.find(b.id)).toBe(s.build.objects[0]);
  });

  it('refuses parts not in the bin, and parts that ran out', () => {
    const s = player();
    expect(s.addObject(s.makeObject('bowling_ball', 300, 300))).toBe(false);
    expect(s.addObject(s.makeObject('crate', 300, 300))).toBe(true);
    expect(s.addObject(s.makeObject('crate', 400, 300))).toBe(false);
    expect(s.build.objects).toHaveLength(1);
    expect(s.canUndo).toBe(true);
  });

  it('level objects are locked for the player', () => {
    const s = player();
    expect(s.isEditable('bat')).toBe(false);
    expect(s.isEditable('shelf')).toBe(false);
    expect(s.isFixed('shelf')).toBe(true);
    expect(s.isFixed('bat')).toBe(false);
    expect(s.moveObjects(['bat', 'shelf'], 10, 10)).toBe(false);
    expect(s.deleteObjects(['bat'])).toBe(false);
    expect(s.setTransform('bat', { x: 0 })).toBe(false);
    expect(s.setProp('bat', 'on', false)).toBe(false);
    expect(s.rotateObjects(['shelf'], 1)).toBe(false);
    expect(s.find('bat')!.x).toBe(100);
  });

  it('moves round to 0.1 and only touch the listed editable objects', () => {
    const s = player();
    const a = s.makeObject('ball', 100, 100);
    const b = s.makeObject('ball', 200, 200);
    s.addObject(a);
    s.addObject(b);
    s.moveObjects([a.id, 'bat'], 1.234, -2.06);
    expect(s.find(a.id)).toMatchObject({ x: 101.2, y: 97.9 });
    expect(s.find(b.id)).toMatchObject({ x: 200, y: 200 });
    expect(s.find('bat')).toMatchObject({ x: 100, y: 860 });
  });

  it('setTransform, rotate, flip and setProp respect part capabilities', () => {
    const s = player();
    const sw = s.makeObject('toggle_switch', 400, 400);
    const ball = s.makeObject('ball', 300, 300);
    s.addObject(sw);
    s.addObject(ball);
    expect(s.setTransform(sw.id, { x: 10.04, y: 20.06, angle: Math.PI * 2.5, flip: true })).toBe(true);
    expect(s.find(sw.id)).toMatchObject({ x: 10, y: 20.1, flip: true });
    expect(s.find(sw.id)!.angle).toBeCloseTo(Math.PI / 2, 4);
    s.setTransform(sw.id, { flip: false });
    expect(s.find(sw.id)!.flip).toBeUndefined();

    expect(s.rotateObjects([ball.id], 1)).toBe(false); // ball is not rotatable
    expect(s.flipObjects([ball.id])).toBe(false);
    expect(s.flipObjects([sw.id])).toBe(true);
    expect(s.find(sw.id)!.flip).toBe(true);
    expect(s.flipObjects([sw.id])).toBe(true);
    expect(s.find(sw.id)!.flip).toBeUndefined();

    expect(s.setProp(sw.id, 'on', true)).toBe(true);
    expect(s.find(sw.id)!.props!.on).toBe(true);
    expect(s.setProp(sw.id, 'nonsense', 3)).toBe(false); // unknown keys dropped => no change
    expect(s.setProp('missing', 'on', true)).toBe(false);
  });

  it('setProp clamps through the component spec', () => {
    const s = new Session('sandbox', blankLevel('x'), emptyBuild());
    const p = s.makeObject('plank', 0, 0);
    s.addObject(p);
    s.setProp(p.id, 'length', 5);
    expect(s.find(p.id)!.props!.length).toBe(40);
  });

  it('deleting returns parts to the bin', () => {
    const s = player();
    const c = s.makeObject('crate', 100, 100);
    s.addObject(c);
    expect(s.canPlace('crate').ok).toBe(false);
    expect(s.deleteObjects([c.id, 'bat'])).toBe(true);
    expect(s.build.objects).toEqual([]);
    expect(s.find('bat')).toBeTruthy();
    expect(s.canPlace('crate').ok).toBe(true);
    expect(s.deleteObjects(['nope'])).toBe(false);
  });

  it('clearBuild empties only the build for players', () => {
    const s = player();
    s.addObject(s.makeObject('ball', 100, 100));
    s.addConnection({ kind: 'wire', from: { obj: 'bat', port: 'out' }, to: { obj: 'motor', port: 'in' } });
    expect(s.clearBuild()).toBe(true);
    expect(s.build).toEqual(emptyBuild());
    expect(s.level.startingObjects).toHaveLength(4);
    expect(s.level.connections).toHaveLength(2);
    expect(s.clearBuild()).toBe(false);
  });
});

describe('Session: undo / redo', () => {
  it('undo and redo walk back and forth through edits', () => {
    const s = player();
    const b = s.makeObject('ball', 100, 100);
    expect(s.canUndo).toBe(false);
    expect(s.undo()).toBe(false);
    expect(s.redo()).toBe(false);
    s.addObject(b);
    s.moveObjects([b.id], 10, 0);
    s.moveObjects([b.id], 10, 0);
    expect(s.find(b.id)!.x).toBe(120);
    expect(s.undo()).toBe(true);
    expect(s.find(b.id)!.x).toBe(110);
    expect(s.undo()).toBe(true);
    expect(s.find(b.id)!.x).toBe(100);
    expect(s.undo()).toBe(true);
    expect(s.find(b.id)).toBeUndefined();
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(true);
    s.redo();
    s.redo();
    s.redo();
    expect(s.find(b.id)!.x).toBe(120);
    expect(s.canRedo).toBe(false);
  });

  it('undo/redo emit and bump version', () => {
    const s = player();
    const seen: string[] = [];
    s.onChange((r) => seen.push(r));
    s.addObject(s.makeObject('ball', 1, 1));
    s.undo();
    s.redo();
    expect(seen).toEqual(['add', 'undo', 'redo']);
    expect(s.version).toBe(3);
  });

  it('a new edit after undo discards the redo branch', () => {
    const s = player();
    const a = s.makeObject('ball', 0, 0);
    s.addObject(a);
    s.moveObjects([a.id], 50, 0);
    s.undo();
    expect(s.canRedo).toBe(true);
    s.moveObjects([a.id], 0, 7);
    expect(s.canRedo).toBe(false);
    expect(s.redo()).toBe(false);
    expect(s.find(a.id)).toMatchObject({ x: 0, y: 7 });
    s.undo();
    expect(s.find(a.id)).toMatchObject({ x: 0, y: 0 });
    s.undo();
    expect(s.find(a.id)).toBeUndefined();
  });

  it('no-op and refused edits do not create undo entries', () => {
    const s = player();
    s.addObject(s.makeObject('bowling_ball', 0, 0)); // not in bin
    s.moveObjects(['bat'], 1, 1); // locked
    expect(s.canUndo).toBe(false);
  });

  it('after many ops undo restores every intermediate state exactly', () => {
    const s = player(circuitLevel(), emptyBuild());
    const states: string[] = [JSON.stringify(s.build)];
    const g = s.makeObject('gear', 0, 0);
    s.addObject(g);
    states.push(JSON.stringify(s.build));
    for (let i = 0; i < 60; i++) {
      s.moveObjects([g.id], 1, 2);
      states.push(JSON.stringify(s.build));
    }
    for (let i = states.length - 1; i > 0; i--) {
      expect(JSON.stringify(s.build)).toBe(states[i]);
      s.undo();
    }
    expect(JSON.stringify(s.build)).toBe(states[0]);
    for (let i = 1; i < states.length; i++) {
      s.redo();
      expect(JSON.stringify(s.build)).toBe(states[i]);
    }
  });

  it('history is capped at 150 steps', () => {
    const s = player();
    const g = s.makeObject('gear', 0, 0);
    s.addObject(g);
    for (let i = 0; i < 200; i++) s.moveObjects([g.id], 1, 0);
    let n = 0;
    while (s.undo()) n++;
    expect(n).toBe(150);
    expect(s.find(g.id)!.x).toBe(50); // the oldest 51 states were dropped
  });

  it('replace loads a new document and clears history', () => {
    const s = player();
    s.addObject(s.makeObject('ball', 0, 0));
    s.undo();
    const l = blankLevel('other');
    s.replace(l, emptyBuild());
    expect(s.level.id).toBe('other');
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(false);
  });

  it('undo covers level edits in the editor too', () => {
    const s = editor();
    s.editLevel('rename', (l) => (l.name = 'Renamed'));
    s.deleteObjects(['conv']);
    expect(s.level.name).toBe('Renamed');
    expect(s.level.goals).toEqual([]);
    s.undo();
    expect(s.find('conv')).toBeTruthy();
    expect(s.level.goals).toHaveLength(1);
    expect(s.level.connections).toHaveLength(2);
    s.undo();
    expect(s.level.name).toBe('Untitled Contraption');
  });
});

describe('Session: inventory limits', () => {
  it('maxParts limits the total of placed parts (ropes count, wires do not)', () => {
    const l = circuitLevel();
    l.restrictions = { maxParts: 3 };
    const s = player(l);
    const h1 = s.makeObject('hook', 100, 100);
    const h2 = s.makeObject('hook', 200, 100);
    s.addObject(h1);
    s.addObject(h2);
    expect(s.addConnection({ kind: 'rope', from: { obj: h1.id, port: 'hook' }, to: { obj: h2.id, port: 'hook' } })).toBe(true);
    expect(partsPlaced(s.build)).toBe(3);
    const r = s.canPlace('ball');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/only 3 parts/);
    expect(s.addObject(s.makeObject('ball', 0, 0))).toBe(false);
    // wires stay free
    expect(s.addConnection({ kind: 'wire', from: { obj: 'bat', port: 'out' }, to: { obj: 'motor', port: 'in' } })).toBe(true);
    expect(partsPlaced(s.build)).toBe(3);
  });

  it('maxParts 0 forbids everything but wires', () => {
    const l = circuitLevel();
    l.restrictions = { maxParts: 0 };
    const s = player(l);
    expect(s.canPlace('ball').ok).toBe(false);
    expect(s.canPlace('wire').ok).toBe(true);
  });

  it('rope count limit applies to connections', () => {
    const s = player();
    const [a, b, c] = [s.makeObject('hook', 0, 0), s.makeObject('hook', 50, 0), s.makeObject('hook', 100, 0)];
    for (const o of [a, b, c]) s.addObject(o);
    expect(s.connectionBlockReason({ kind: 'rope', from: { obj: a.id, port: 'hook' }, to: { obj: b.id, port: 'hook' } })).toBeNull();
    expect(s.addConnection({ kind: 'rope', from: { obj: a.id, port: 'hook' }, to: { obj: b.id, port: 'hook' } })).toBe(true);
    expect(s.connectionBlockReason({ kind: 'rope', from: { obj: b.id, port: 'hook' }, to: { obj: c.id, port: 'hook' } })).toMatch(/None left/);
    expect(s.addConnection({ kind: 'rope', from: { obj: b.id, port: 'hook' }, to: { obj: c.id, port: 'hook' } })).toBe(false);
    expect(s.connectionBlockReason({ kind: 'belt', from: { obj: a.id, port: 'rotor' }, to: { obj: b.id, port: 'rotor' } })).toMatch(/parts bin/);
  });

  it('unlimited count (-1) never runs out', () => {
    const s = player();
    for (let i = 0; i < 30; i++) expect(s.addObject(s.makeObject('gear', i * 100, 0))).toBe(true);
    const row = s.inventory().find((r) => r.type === 'gear')!;
    expect(row).toEqual({ type: 'gear', total: -1, used: 30, remaining: -1 });
  });

  it('inventory rows list the bin in order with usage, plus free wires when power is present', () => {
    const s = player();
    s.addObject(s.makeObject('ball', 0, 0));
    const rows = s.inventory();
    expect(rows.map((r) => r.type)).toEqual(['ball', 'crate', 'toggle_switch', 'hook', 'rope', 'gear', 'wire']);
    expect(rows[0]).toEqual({ type: 'ball', total: 2, used: 1, remaining: 1 });
    expect(rows.at(-1)).toEqual({ type: 'wire', total: UNLIMITED, used: 0, remaining: UNLIMITED });
  });

  it('no free wire row when nothing in the level can use power', () => {
    const l = blankLevel('np');
    l.inventory = [{ type: 'ball', count: 1 }];
    expect(inventoryRows(l, emptyBuild(), false).map((r) => r.type)).toEqual(['ball']);
    l.inventory.push({ type: 'fan', count: 1 });
    expect(inventoryRows(l, emptyBuild(), false).map((r) => r.type)).toEqual(['ball', 'fan', 'wire']);
  });

  it('an explicitly listed wire row is not duplicated', () => {
    const l = circuitLevel();
    l.inventory.push({ type: 'wire', count: 2 });
    expect(inventoryRows(l, emptyBuild(), false).filter((r) => r.type === 'wire')).toHaveLength(1);
  });

  it('countUsed counts objects by type and non-wire connections by kind', () => {
    const b: BuildDef = {
      objects: [obj('ball', 0, 0), obj('ball', 0, 0), obj('hook', 0, 0)],
      connections: [
        { id: 'w', kind: 'wire', from: { obj: 'a', port: 'out' }, to: { obj: 'b', port: 'in' } },
        { id: 'r', kind: 'rope', from: { obj: 'a', port: 'hook' }, to: { obj: 'b', port: 'hook' } },
        { id: 'b', kind: 'belt', from: { obj: 'a', port: 'rotor' }, to: { obj: 'b', port: 'rotor' } },
      ],
    };
    const m = countUsed(b);
    expect(Object.fromEntries(m)).toEqual({ ball: 2, hook: 1, rope: 1, belt: 1 });
    expect(partsPlaced(b)).toBe(5);
  });

  it('remaining never goes negative even with an over-full build', () => {
    const l = circuitLevel();
    const b: BuildDef = { objects: [obj('crate', 0, 0), obj('crate', 0, 0), obj('crate', 0, 0)], connections: [] };
    expect(inventoryRows(l, b, false).find((r) => r.type === 'crate')!.remaining).toBe(0);
    expect(canPlace(l, b, 'crate', false).ok).toBe(false);
  });

  it('sandbox and editor get every palette part (never scenery-only) unlimited', () => {
    const s = new Session('sandbox', blankLevel('sb'), emptyBuild());
    const rows = s.inventory();
    expect(rows.every((r) => r.total === UNLIMITED && r.remaining === UNLIMITED)).toBe(true);
    const types = rows.map((r) => r.type);
    expect(types).toContain('ball');
    expect(types).toContain('rope');
    expect(types).toContain('belt');
    expect(types).toContain('wire');
    expect(types).not.toContain('wall');
    expect(types).not.toContain('cannonball');
    expect(s.canPlace('bowling_ball').ok).toBe(true);
    for (let i = 0; i < 20; i++) expect(s.addObject(s.makeObject('crate', 0, 0))).toBe(true);
  });

  it('unlimited ignores maxParts', () => {
    const l = blankLevel('sb');
    l.restrictions = { maxParts: 0 };
    expect(canPlace(l, emptyBuild(), 'ball', true).ok).toBe(true);
  });
});

describe('Session: copy / paste', () => {
  it('copy takes only editable objects and the connections fully inside the selection', () => {
    const s = player();
    const [h1, h2, h3] = [s.makeObject('hook', 0, 0), s.makeObject('hook', 50, 0), s.makeObject('hook', 100, 0)];
    for (const o of [h1, h2, h3]) s.addObject(o);
    s.addConnection({ kind: 'rope', from: { obj: h1.id, port: 'hook' }, to: { obj: h2.id, port: 'hook' } });
    const clip = s.copy([h1.id, h2.id, 'bat'])!;
    expect(clip.objects.map((o) => o.id)).toEqual([h1.id, h2.id]);
    expect(clip.connections).toHaveLength(1);
    expect(s.copy([h1.id, h3.id])!.connections).toHaveLength(0);
    expect(s.copy(['bat'])).toBeNull();
    expect(s.copy([])).toBeNull();
  });

  it('the clipboard is a deep copy', () => {
    const s = player();
    const b = s.makeObject('ball', 10, 10);
    s.addObject(b);
    const clip = s.copy([b.id])!;
    s.moveObjects([b.id], 100, 0);
    expect(clip.objects[0].x).toBe(10);
  });

  it('paste creates new ids, offsets positions and remaps connections', () => {
    const s = new Session('sandbox', blankLevel('sb'), emptyBuild());
    const a = s.makeObject('hook', 0, 0);
    const b = s.makeObject('hook', 50, 0);
    const p = s.makeObject('pulley', 25, -50);
    for (const o of [a, b, p]) s.addObject(o);
    s.addConnection({ kind: 'rope', from: { obj: a.id, port: 'hook' }, to: { obj: b.id, port: 'hook' }, via: [p.id] });
    const clip = s.copy([a.id, b.id, p.id])!;
    const ids = s.paste(clip, 30, 40)!;
    expect(ids).toHaveLength(3);
    for (const id of ids) expect([a.id, b.id, p.id]).not.toContain(id);
    const [na, nb, np] = ids.map((id) => s.find(id)!);
    expect(na).toMatchObject({ x: 30, y: 40, type: 'hook' });
    expect(nb).toMatchObject({ x: 80, y: 40 });
    expect(np).toMatchObject({ x: 55, y: -10, type: 'pulley' });
    expect(s.build.connections).toHaveLength(2);
    const nc = s.build.connections[1];
    expect(nc.from.obj).toBe(na.id);
    expect(nc.to.obj).toBe(nb.id);
    expect(nc.via).toEqual([np.id]);
    expect(nc.id).not.toBe(s.build.connections[0].id);
    // one undo removes the whole paste
    s.undo();
    expect(s.build.objects).toHaveLength(3);
    expect(s.build.connections).toHaveLength(1);
  });

  it('paste is refused as a whole when the bin cannot cover every object', () => {
    const s = player();
    const a = s.makeObject('ball', 0, 0);
    s.addObject(a);
    const clip = { objects: [a, { ...a, id: 'other' }], connections: [] };
    expect(s.paste(clip, 10, 10)).toBeNull(); // only one ball left, two needed
    expect(s.build.objects).toHaveLength(1);
    expect(s.paste(s.copy([a.id])!, 10, 10)).toHaveLength(1);
    expect(s.build.objects).toHaveLength(2);
  });

  it('paste skips ropes the bin cannot cover but keeps the objects', () => {
    const s = player();
    const [h1, h2] = [s.makeObject('hook', 0, 0), s.makeObject('hook', 50, 0)];
    s.addObject(h1);
    s.addObject(h2);
    s.addConnection({ kind: 'rope', from: { obj: h1.id, port: 'hook' }, to: { obj: h2.id, port: 'hook' } });
    const clip = s.copy([h1.id, h2.id])!;
    // hooks: 3 in bin, 2 used -> pasting two hooks fails as a whole
    expect(s.paste(clip, 0, 100)).toBeNull();
    s.deleteObjects([h2.id]);
    const ids = s.paste({ objects: [clip.objects[0]], connections: [] }, 0, 100);
    expect(ids).toHaveLength(1);
  });

  it('paste respects maxParts', () => {
    const l = circuitLevel();
    l.restrictions = { maxParts: 1 };
    const s = player(l);
    const a = s.makeObject('ball', 0, 0);
    s.addObject(a);
    expect(s.paste(s.copy([a.id])!, 5, 5)).toBeNull();
  });

  it('in the editor, paste puts scenery into fixedObjects', () => {
    const s = editor();
    const clip = s.copy(['shelf', 'bat'])!;
    const ids = s.paste(clip, 0, 50)!;
    expect(s.level.fixedObjects.map((o) => o.id)).toContain(ids[0]);
    expect(s.level.startingObjects.map((o) => o.id)).toContain(ids[1]);
  });
});

describe('Session: connections', () => {
  it('add and remove connections in the build, with undo', () => {
    const s = player();
    const sw = s.makeObject('toggle_switch', 600, 860);
    s.addObject(sw);
    expect(s.addConnection({ kind: 'wire', from: { obj: 'bat', port: 'out' }, to: { obj: sw.id, port: 'in' } })).toBe(true);
    expect(s.build.connections).toHaveLength(1);
    const id = s.build.connections[0].id;
    expect(id.startsWith('w')).toBe(true);
    expect(s.level.connections).toHaveLength(2);
    expect(s.removeConnection(id)).toBe(true);
    expect(s.build.connections).toEqual([]);
    expect(s.removeConnection(id)).toBe(false);
    s.undo();
    expect(s.build.connections.map((c) => c.id)).toEqual([id]);
  });

  it('players cannot remove level connections', () => {
    const s = player();
    const levelWire = s.level.connections[0].id;
    expect(s.removeConnection(levelWire)).toBe(false);
    expect(s.level.connections).toHaveLength(2);
  });

  it('setConnectionProp edits editable connections only', () => {
    const s = player();
    const [a, b] = [s.makeObject('hook', 0, 0), s.makeObject('hook', 40, 0)];
    s.addObject(a);
    s.addObject(b);
    s.addConnection({ kind: 'rope', from: { obj: a.id, port: 'hook' }, to: { obj: b.id, port: 'hook' } });
    const id = s.build.connections[0].id;
    expect(s.setConnectionProp(id, 'slack', 12)).toBe(true);
    expect(s.build.connections[0].props).toEqual({ slack: 12 });
    expect(s.setConnectionProp(s.level.connections[0].id, 'slack', 1)).toBe(false);
  });

  it('deleting an endpoint prunes its connections (both build and level wires into it)', () => {
    const s = player();
    const sw = s.makeObject('toggle_switch', 600, 860);
    s.addObject(sw);
    s.addConnection({ kind: 'wire', from: { obj: 'bat', port: 'out' }, to: { obj: sw.id, port: 'in' } });
    s.addConnection({ kind: 'wire', from: { obj: sw.id, port: 'out' }, to: { obj: 'motor', port: 'in' } });
    expect(s.build.connections).toHaveLength(2);
    s.deleteObjects([sw.id]);
    expect(s.build.connections).toEqual([]);
    expect(s.level.connections).toHaveLength(2);
    s.undo();
    expect(s.build.connections).toHaveLength(2);
  });

  it('deleting a pulley removes it from rope via lists but keeps the rope', () => {
    const s = new Session('sandbox', blankLevel('sb'), emptyBuild());
    const [a, b, p] = [s.makeObject('hook', 0, 0), s.makeObject('hook', 100, 0), s.makeObject('pulley', 50, -80)];
    for (const o of [a, b, p]) s.addObject(o);
    s.addConnection({ kind: 'rope', from: { obj: a.id, port: 'hook' }, to: { obj: b.id, port: 'hook' }, via: [p.id] });
    s.deleteObjects([p.id]);
    expect(s.build.connections).toHaveLength(1);
    expect(s.build.connections[0].via).toEqual([]);
  });

  it('the editor deleting a level object prunes level connections and goals that reference it', () => {
    const s = editor();
    s.editLevel('goals', (l) => {
      l.goals.push({ kind: 'containerCount', container: 'motor', count: 1 });
      l.goals.push({ kind: 'contact', a: { id: 'bat' }, b: { type: 'ball' } });
      l.goals.push({ kind: 'height', target: { tag: 'ball' }, maxY: 10 });
    });
    s.deleteObjects(['sw']);
    expect(s.level.connections).toEqual([]); // both wires touched the switch
    expect(s.level.goals).toHaveLength(4);
    s.deleteObjects(['motor', 'bat']);
    expect(s.level.goals.map((g) => g.kind)).toEqual(['activate', 'height']);
  });

  it('connection ids never collide with object ids', () => {
    const s = new Session('sandbox', blankLevel('sb'), emptyBuild());
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const [a, b] = [s.makeObject('hook', i * 10, 0), s.makeObject('hook', i * 10 + 5, 0)];
      s.addObject(a);
      s.addObject(b);
      s.addConnection({ kind: 'rope', from: { obj: a.id, port: 'hook' }, to: { obj: b.id, port: 'hook' } });
    }
    for (const o of s.allObjects()) ids.add(o.id);
    for (const c of s.allConnections()) ids.add(c.id);
    expect(ids.size).toBe(s.allObjects().length + s.allConnections().length);
  });
});

describe('Session: the level wire rule (connectionBlockReason)', () => {
  it('blocks a player wire into an input the level already feeds', () => {
    const s = player();
    const c = { kind: 'wire' as const, from: { obj: 'bat', port: 'out' }, to: { obj: 'conv', port: 'in' } };
    expect(s.connectionBlockReason(c)).toBe('That socket is already wired by the level.');
    expect(s.addConnection(c)).toBe(false);
    expect(s.build.connections).toEqual([]);
    expect(s.canUndo).toBe(false);
  });

  it('blocks it whichever end the player clicked first', () => {
    const s = player();
    expect(s.connectionBlockReason({ kind: 'wire', from: { obj: 'conv', port: 'in' }, to: { obj: 'bat', port: 'out' } })).not.toBeNull();
    expect(s.connectionBlockReason({ kind: 'wire', from: { obj: 'sw', port: 'in' }, to: { obj: 'bat', port: 'out' } })).not.toBeNull();
  });

  it('allows a level battery out to an unwired level device', () => {
    const s = player();
    const c = { kind: 'wire' as const, from: { obj: 'bat', port: 'out' }, to: { obj: 'motor', port: 'in' } };
    expect(s.connectionBlockReason(c)).toBeNull();
    expect(s.addConnection(c)).toBe(true);
  });

  it('allows a level battery out to a player part, and that part out to an unwired device', () => {
    const s = player();
    const sw = s.makeObject('toggle_switch', 600, 860);
    s.addObject(sw);
    expect(s.addConnection({ kind: 'wire', from: { obj: 'bat', port: 'out' }, to: { obj: sw.id, port: 'in' } })).toBe(true);
    expect(s.addConnection({ kind: 'wire', from: { obj: sw.id, port: 'out' }, to: { obj: 'motor', port: 'in' } })).toBe(true);
  });

  it('a player part out into a level-fed input is still blocked', () => {
    const s = player();
    const sw = s.makeObject('toggle_switch', 600, 860);
    s.addObject(sw);
    expect(s.connectionBlockReason({ kind: 'wire', from: { obj: sw.id, port: 'out' }, to: { obj: 'conv', port: 'in' } })).not.toBeNull();
  });

  it('level OUT sockets that already carry a level wire can still fan out', () => {
    const s = player();
    // sw.out already feeds conv.in, but outputs may drive several things
    expect(s.connectionBlockReason({ kind: 'wire', from: { obj: 'sw', port: 'out' }, to: { obj: 'motor', port: 'in' } })).toBeNull();
  });

  it('wires are free even when the bin is empty and maxParts is reached', () => {
    const l = circuitLevel();
    l.inventory = [];
    l.restrictions = { maxParts: 0 };
    const s = player(l);
    expect(s.connectionBlockReason({ kind: 'wire', from: { obj: 'bat', port: 'out' }, to: { obj: 'motor', port: 'in' } })).toBeNull();
  });

  it('the level editor is never blocked', () => {
    const s = editor();
    expect(s.connectionBlockReason({ kind: 'wire', from: { obj: 'bat', port: 'out' }, to: { obj: 'conv', port: 'in' } })).toBeNull();
    expect(s.addConnection({ kind: 'wire', from: { obj: 'bat', port: 'out' }, to: { obj: 'conv', port: 'in' } })).toBe(true);
    expect(s.level.connections).toHaveLength(3);
    expect(s.build.connections).toEqual([]);
  });

  // BUG (src/editor/Session.ts:256): the rule only looks at `w.to` of level wires. Wires are
  // stored in click order (EditorController.toolClick does not normalise), and the Simulation
  // accepts either direction. So if the level author drew the wire starting at the conveyor's IN
  // socket and finishing at the switch's OUT, the level wire is {from: conv.in, to: sw.out} and the
  // player may run the battery straight into conv.in, bypassing the switch.
  it('also protects level-fed inputs whose level wire was drawn in-to-out', () => {
    const l = circuitLevel();
    const w = l.connections[1]; // sw.out -> conv.in
    l.connections[1] = { ...w, from: w.to, to: w.from }; // conv.in -> sw.out (as drawn in the editor)
    const s = player(l);
    expect(s.connectionBlockReason({ kind: 'wire', from: { obj: 'bat', port: 'out' }, to: { obj: 'conv', port: 'in' } })).not.toBeNull();
  });
});

describe('Session: the editor edits the level itself', () => {
  it('adds parts to startingObjects and scenery to fixedObjects', () => {
    const s = editor();
    const ball = s.makeObject('ball', 0, 0);
    const wall = s.makeObject('wall', 0, 0);
    const plank = s.makeObject('plank', 0, 0);
    s.addObject(ball);
    s.addObject(wall);
    s.addObject(plank, true);
    expect(s.level.startingObjects.map((o) => o.id)).toContain(ball.id);
    expect(s.level.fixedObjects.map((o) => o.id)).toEqual(['shelf', wall.id, plank.id]);
    expect(s.build.objects).toEqual([]);
  });

  it('is not limited by the inventory', () => {
    const s = editor();
    for (let i = 0; i < 5; i++) expect(s.addObject(s.makeObject('bowling_ball', i * 50, 0))).toBe(true);
  });

  it('can move, rotate and delete level objects', () => {
    const s = editor();
    expect(s.isEditable('bat')).toBe(true);
    expect(s.isEditable('shelf')).toBe(true);
    s.moveObjects(['bat', 'shelf'], 10, 0);
    expect(s.find('bat')!.x).toBe(110);
    expect(s.find('shelf')!.x).toBe(810);
    expect(s.rotateObjects(['shelf'], Math.PI / 4)).toBe(true);
    expect(s.find('shelf')!.angle).toBeCloseTo(Math.PI / 4, 4);
    s.deleteObjects(['shelf']);
    expect(s.level.fixedObjects).toEqual([]);
  });

  it('setScenery moves objects between layers (editor only)', () => {
    const s = editor();
    expect(s.setScenery('bat', true)).toBe(true);
    expect(s.isFixed('bat')).toBe(true);
    expect(s.setScenery('bat', true)).toBe(false);
    expect(s.setScenery('bat', false)).toBe(true);
    expect(s.isFixed('bat')).toBe(false);
    expect(player().setScenery('bat', true)).toBe(false);
  });

  it('clearBuild in the editor wipes the level contents', () => {
    const s = editor();
    s.clearBuild();
    expect(s.level.fixedObjects).toEqual([]);
    expect(s.level.startingObjects).toEqual([]);
    expect(s.level.connections).toEqual([]);
    expect(s.level.goals).toHaveLength(1); // goals are kept
  });

  it('editLevel changes metadata with undo; a no-op edit records nothing', () => {
    const s = editor();
    expect(s.editLevel('noop', () => {})).toBe(false);
    expect(s.editLevel('inv', (l) => l.inventory.push({ type: 'fan', count: 2 }))).toBe(true);
    expect(s.level.inventory.at(-1)).toEqual({ type: 'fan', count: 2 });
    s.undo();
    expect(s.level.inventory.some((i) => i.type === 'fan')).toBe(false);
  });

  it('editable/all accessors reflect who edits what', () => {
    const p = player();
    const e = editor();
    expect(p.editableObjects()).toBe(p.build.objects);
    expect(p.editableConnections()).toBe(p.build.connections);
    expect(e.editableObjects().map((o) => o.id)).toEqual(['shelf', 'bat', 'sw', 'conv', 'motor']);
    expect(e.editableConnections()).toBe(e.level.connections);
    expect(p.allObjects()).toHaveLength(5);
    expect(p.allConnections()).toHaveLength(2);
  });
});

describe('Rotate and resize handles', () => {
  const plankLevel = () => {
    const l = circuitLevel();
    l.inventory.push({ type: 'plank', count: 2 }, { type: 'seesaw', count: 1 });
    return l;
  };

  it('reshapes position, angle and size in one undo step, clamped to the prop range', () => {
    const s = player(plankLevel());
    const p = s.makeObject('plank', 400, 300);
    s.addObject(p);
    expect(s.reshapeObject(p.id, { x: 420.04, y: 300, angle: 0.3, props: { length: 9999 } })).toBe(true);
    expect(s.find(p.id)).toMatchObject({ x: 420, y: 300, props: { length: 600 } });
    expect(s.find(p.id)!.angle).toBeCloseTo(0.3, 6);
    s.undo();
    expect(s.find(p.id)).toMatchObject({ x: 400, y: 300, angle: 0, props: { length: 160 } });
  });

  it('never rotates a part that is not rotatable and refuses level parts', () => {
    const s = player(plankLevel());
    const sw = s.makeObject('seesaw', 400, 300);
    s.addObject(sw);
    s.reshapeObject(sw.id, { x: 400, y: 300, angle: 1, props: { length: 300 } });
    expect(s.find(sw.id)).toMatchObject({ angle: 0, props: { length: 300 } });
    expect(s.reshapeObject('bat', { x: 0, y: 0, angle: 1 })).toBe(false);
  });

  it('resets angles to 0 in one undo step, skipping parts that cannot turn', () => {
    const s = player(plankLevel());
    const a = s.makeObject('plank', 300, 300);
    const b = s.makeObject('plank', 600, 300);
    s.addObject(a);
    s.addObject(b);
    s.rotateObjects([a.id], 0.4);
    s.rotateObjects([b.id], -0.7);
    expect(s.resetAngles([a.id, b.id])).toBe(true);
    expect(s.find(a.id)!.angle).toBe(0);
    expect(s.find(b.id)!.angle).toBe(0);
    s.undo();
    expect(s.find(a.id)!.angle).toBeCloseTo(0.4, 6);
    expect(s.find(b.id)!.angle).toBeCloseTo(-0.7, 6);
    expect(s.resetAngles(['nope'])).toBe(false);
  });

  it('only parts whose bodies are built from a size prop offer resize handles', async () => {
    const { allComponents } = await import('../src/components/registry');
    for (const def of allComponents()) {
      for (const key of Object.values(def.resize ?? {})) {
        const spec = def.props.find((q) => q.key === key);
        expect(spec?.type, `${def.type}.${key}`).toBe('number');
        // the nominal footprint follows the prop, so the handles sit on the part's real edges
        const lo = def.size({ [key]: (spec as any).min });
        const hi = def.size({ [key]: (spec as any).max });
        expect(hi.w * hi.h, `${def.type}.${key}`).toBeGreaterThan(lo.w * lo.h);
      }
    }
  });
});
