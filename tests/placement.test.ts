// Placement validation (src/game/placement.ts).

import { describe, expect, it } from 'vitest';
import '../src/components';
import { gearRadius } from '../src/components/defs/mechanical';
import { blankLevel } from '../src/core/level';
import type { ObjectDef } from '../src/core/types';
import { invalidPlacements, withExtras } from '../src/game/placement';
import { CAMPAIGN } from '../src/game/campaign';
import { meshes } from '../src/sim/rotation';
import { Simulation } from '../src/sim/Simulation';
import { obj, sim } from './helpers';

// World is 1600 x 900. A 200x40 wall block centred at (800, 500): x 700..900, y 480..520.
const wall = () => obj('wall', 800, 500, { w: 200, h: 40 }, { id: 'wall' });
const host = (extra: ObjectDef[] = []) => sim([wall(), ...extra]);
const none = new Set<string>();

describe('invalidPlacements: overlaps', () => {
  it('nothing to place is trivially valid', () => {
    expect(invalidPlacements(host(), [], none)).toEqual([]);
  });

  it('a ball in open space is fine', () => {
    expect(invalidPlacements(host(), [obj('ball', 300, 300, {}, { id: 'b' })], none)).toEqual([]);
  });

  it('a ball inside the wall is rejected', () => {
    expect(invalidPlacements(host(), [obj('ball', 800, 500, {}, { id: 'b' })], none)).toEqual(['b']);
  });

  it('a ball resting exactly on the wall (touching, depth 0) is allowed', () => {
    // ball radius 14: centre at 480 - 14 = 466 touches the top face
    expect(invalidPlacements(host(), [obj('ball', 800, 466, {}, { id: 'b' })], none)).toEqual([]);
  });

  it('depth threshold: <= 1.5px sinks are tolerated, deeper ones are not', () => {
    expect(invalidPlacements(host(), [obj('ball', 800, 467.2, {}, { id: 'b' })], none)).toEqual([]); // ~1.2px
    expect(invalidPlacements(host(), [obj('ball', 800, 468.5, {}, { id: 'b' })], none)).toEqual(['b']); // ~2.5px
  });

  it('ignored host objects (the thing being dragged) do not block', () => {
    const b = obj('ball', 800, 500, {}, { id: 'b' });
    expect(invalidPlacements(host(), [b], new Set(['wall']))).toEqual([]);
  });

  it('moving an object over its own old position is fine when it is ignored', () => {
    const crate = obj('crate', 300, 300, {}, { id: 'c' });
    const h = host([crate]);
    const moved = { ...crate, x: 305 };
    expect(invalidPlacements(h, [moved], none)).toEqual(['c']);
    expect(invalidPlacements(h, [moved], new Set(['c']))).toEqual([]);
  });

  it('objects placed together must not overlap each other; only the offenders are reported', () => {
    const a = obj('crate', 300, 300, {}, { id: 'a' });
    const b = obj('crate', 310, 300, {}, { id: 'b' });
    const c = obj('crate', 600, 300, {}, { id: 'c' });
    expect(invalidPlacements(host(), [a, b, c], none).sort()).toEqual(['a', 'b']);
  });

  it('sensors never block (a toggle switch lever over a ball is fine)', () => {
    // the switch has a static base 44x20 at y+8 and a sensor lever 44x52 at y-6
    const sw = obj('toggle_switch', 300, 300, {}, { id: 'sw' });
    const ballOverSensorOnly = obj('ball', 300, 268, {}, { id: 'b' }); // inside lever area, above the base
    expect(invalidPlacements(host([sw]), [ballOverSensorOnly], none)).toEqual([]);
  });

  it('an unknown part type is reported as invalid', () => {
    expect(invalidPlacements(host(), [{ id: 'z', type: 'nope', x: 10, y: 10, angle: 0 }], none)).toEqual(['z']);
  });
});

describe('invalidPlacements: gears', () => {
  it('two gears may mesh (overlapping rims)', () => {
    const r = gearRadius('medium');
    const g1 = obj('gear', 400, 300, {}, { id: 'g1' });
    const g2 = obj('gear', 400 + 2 * r, 300, {}, { id: 'g2' }); // rims overlap by ~6px (r + 3 bodies)
    expect(invalidPlacements(host([g1]), [g2], none)).toEqual([]);
    expect(invalidPlacements(host(), [g1, g2], none)).toEqual([]);
  });

  it('a gear can be placed meshing with a motor pinion (just clear of the housing)', () => {
    const m = obj('motor', 400, 300, {}, { id: 'm' });
    const g = obj('gear', 400, 300 - 52, {}, { id: 'g' }); // pinion centre at y-2, r 12; gear r 34
    expect(invalidPlacements(host([m]), [g], none)).toEqual([]);
    const s = host([m, g]);
    expect(meshes(s.entities.get('m')!, s.entities.get('g')!)).toBe(true);
  });

  // BUG (src/game/placement.ts:13 + gear/motor bodies): the gear's collision circle is r+3 and the
  // motor housing is a 56x40 DEFAULT-category body, so a medium gear at the *nominal* mesh distance
  // above a motor pinion (2 + 12 + 34 = 48px) sinks ~5px into the housing and is rejected. Only the
  // 51..57px band (inside MESH_TOLERANCE) is accepted. Consequence: the reference solution of
  // c6-belt-up (gear at (1340, 828) over motor at (1340, 876)) cannot be placed by a player.
  it('a gear at the nominal mesh distance above a motor is placeable', () => {
    const m = obj('motor', 400, 300, {}, { id: 'm' });
    const g = obj('gear', 400, 300 - 48, {}, { id: 'g' });
    expect(invalidPlacements(host([m]), [g], none)).toEqual([]);
  });

  it('every campaign reference solution passes placement validation', () => {
    const rejected: string[] = [];
    for (const e of CAMPAIGN) {
      const h = new Simulation(e.level, { objects: [], connections: [] });
      for (const s of e.solutions) for (const id of invalidPlacements(h, s.objects, none)) rejected.push(`${e.level.id}/${id}`);
    }
    expect(rejected).toEqual([]);
  });

  it('a gear still cannot be buried in a wall', () => {
    expect(invalidPlacements(host(), [obj('gear', 800, 500, {}, { id: 'g' })], none)).toEqual(['g']);
  });
});

describe('invalidPlacements: world bounds', () => {
  const ball = (x: number, y: number) => obj('ball', x, y, {}, { id: 'b' });

  it('inside the world (allowing 2px slack) is fine', () => {
    expect(invalidPlacements(host(), [ball(14, 300)], none)).toEqual([]);
    expect(invalidPlacements(host(), [ball(1600 - 14, 300)], none)).toEqual([]);
    expect(invalidPlacements(host(), [ball(300, 900 - 14)], none)).toEqual([]);
    expect(invalidPlacements(host(), [ball(13, 300)], none)).toEqual([]); // 1px past the edge
  });

  it('past the left, right or floor edge is rejected', () => {
    expect(invalidPlacements(host(), [ball(10, 300)], none)).toEqual(['b']);
    expect(invalidPlacements(host(), [ball(1600 - 10, 300)], none)).toEqual(['b']);
    expect(invalidPlacements(host(), [ball(300, 900 - 10)], none)).toEqual(['b']);
    expect(invalidPlacements(host(), [ball(-200, 300)], none)).toEqual(['b']);
  });

  it('up to 120px above the top is allowed (things can be dropped in), beyond is not', () => {
    expect(invalidPlacements(host(), [ball(300, -100)], none)).toEqual([]);
    expect(invalidPlacements(host(), [ball(300, -110)], none)).toEqual(['b']);
  });

  it('uses the host world size, not the default', () => {
    const l = blankLevel('wide');
    l.world = { width: 3000, height: 1500, gravity: 1 };
    const big = new Simulation(l, { objects: [], connections: [] });
    expect(invalidPlacements(big, [ball(2500, 1400)], none)).toEqual([]);
    expect(invalidPlacements(host(), [ball(2500, 800)], none)).toEqual(['b']);
  });

  it('a rotated plank is checked by its rotated bounds', () => {
    const flat = obj('plank', 100, 300, { length: 160 }, { id: 'p' });
    expect(invalidPlacements(host(), [flat], none)).toEqual([]);
    const upright = obj('plank', 100, 830, { length: 160 }, { id: 'p', angle: Math.PI / 2 });
    expect(invalidPlacements(host(), [upright], none)).toEqual(['p']); // 80px half-length pokes through the floor
  });
});

describe('withExtras', () => {
  const lvl = () => {
    const l = blankLevel('w');
    l.fixedObjects = [obj('wall', 0, 0, {}, { id: 'f' })];
    l.startingObjects = [obj('ball', 0, 0, {}, { id: 's' })];
    return l;
  };
  const build = () => ({ objects: [obj('crate', 0, 0, {}, { id: 'b' })], connections: [] });
  const scenery = (o: ObjectDef) => o.type === 'wall';

  it('returns the same objects when there is nothing extra', () => {
    const l = lvl();
    const b = build();
    const r = withExtras(l, b, [], true, scenery);
    expect(r.level).toBe(l);
    expect(r.build).toBe(b);
  });

  it('players get extras appended to the build', () => {
    const l = lvl();
    const b = build();
    const x = obj('ball', 1, 1, {}, { id: 'x' });
    const r = withExtras(l, b, [x], false, scenery);
    expect(r.level).toBe(l);
    expect(r.build.objects.map((o) => o.id)).toEqual(['b', 'x']);
    expect(b.objects.map((o) => o.id)).toEqual(['b']); // input untouched
  });

  it('the editor splits extras into scenery and starting objects', () => {
    const l = lvl();
    const b = build();
    const r = withExtras(l, b, [obj('wall', 1, 1, {}, { id: 'w2' }), obj('ball', 1, 1, {}, { id: 'b2' })], true, scenery);
    expect(r.level.fixedObjects.map((o) => o.id)).toEqual(['f', 'w2']);
    expect(r.level.startingObjects.map((o) => o.id)).toEqual(['s', 'b2']);
    expect(r.build).toBe(b);
    expect(l.fixedObjects).toHaveLength(1); // input untouched
    expect(l.startingObjects).toHaveLength(1);
  });

  it('the result builds into a Simulation containing everything', () => {
    const r = withExtras(lvl(), build(), [obj('ball', 200, 200, {}, { id: 'x' })], false, scenery);
    const s = new Simulation(r.level, r.build);
    for (const id of ['f', 's', 'b', 'x']) expect(s.entities.has(id)).toBe(true);
  });
});
