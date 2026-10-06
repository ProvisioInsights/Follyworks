import type { Vec } from '../../core/types';
import { M } from '../../sim/matter';
import { registerComponent } from '../registry';
import { DEG, compound, circle, ownGroup, pinToWorld, poly, rect, speedOf } from '../kit';

registerComponent({
  type: 'ball',
  name: 'Rubber Ball',
  category: 'basic',
  domain: 'gravity',
  description: 'Light, bouncy and eager to roll somewhere it should not.',
  tags: ['light', 'round', 'rubber', 'ball'],
  dynamic: true,
  rotatable: false,
  flippable: false,
  props: [],
  size: () => ({ w: 28, h: 28 }),
  art: 'ball',
  build(e, sim) {
    circle(sim, e, { x: 0, y: 0 }, 14, { restitution: 0.72, friction: 0.03, frictionStatic: 0.1, frictionAir: 0.0008, mass: 1, label: 'ball' });
  },
});

registerComponent({
  type: 'bowling_ball',
  name: 'Cast-Iron Bowling Ball',
  category: 'basic',
  domain: 'gravity',
  description: 'Heavy, determined, magnetic. Flattens light things.',
  tags: ['heavy', 'round', 'metal', 'ball'],
  dynamic: true,
  rotatable: false,
  flippable: false,
  props: [],
  size: () => ({ w: 40, h: 40 }),
  art: 'bowling_ball',
  build(e, sim) {
    circle(sim, e, { x: 0, y: 0 }, 20, { restitution: 0.12, friction: 0.06, frictionStatic: 0.2, frictionAir: 0.002, mass: 10, label: 'bowling' });
  },
});

registerComponent({
  type: 'crate',
  name: 'Crate',
  category: 'basic',
  domain: 'gravity',
  description: 'A sturdy box. Wooden, or steel if you want the magnet to care.',
  tags: ['box', 'wood'],
  dynamic: true,
  rotatable: true,
  flippable: false,
  rotationStep: 15 * DEG,
  props: [
    {
      key: 'material',
      label: 'Material',
      type: 'enum',
      options: [
        { value: 'wood', label: 'Wood' },
        { value: 'steel', label: 'Steel' },
      ],
      default: 'wood',
    },
  ],
  anchors: [{ id: 'hook', x: 0, y: -22, label: 'Top hook' }],
  size: () => ({ w: 44, h: 44 }),
  art: 'crate',
  build(e, sim) {
    const steel = e.str('material') === 'steel';
    rect(sim, e, { x: 0, y: 0 }, 44, 44, {
      restitution: 0.05,
      friction: 0.5,
      frictionStatic: 0.7,
      mass: steel ? 8 : 3,
      chamfer: 3,
      label: 'crate',
    });
    if (steel) {
      // Steel crates count as metal for magnets and impacts.
      e.state.metal = true;
    }
  },
});

registerComponent({
  type: 'domino',
  name: 'Domino',
  category: 'basic',
  domain: 'gravity',
  description: 'Stand a row of them up. You know what happens next.',
  tags: ['wood', 'domino'],
  dynamic: true,
  rotatable: true,
  flippable: false,
  rotationStep: 15 * DEG,
  props: [],
  size: () => ({ w: 12, h: 58 }),
  art: 'domino',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 0 }, 12, 58, { restitution: 0.02, friction: 0.3, frictionStatic: 0.5, frictionAir: 0.002, mass: 0.6, label: 'domino', realInertia: true });
  },
  afterStep(e, sim) {
    const tilt = e.body.angle - e.angle;
    if (!e.activated && Math.abs(tilt) > 0.5) sim.activate(e, 'Domino toppled');
    // Domino assist: a toppling domino hands its spin on to the standing neighbour it leans into.
    // Plain rigid-body contact (near-zero restitution, positional correction) shoves the neighbour
    // sideways instead of tipping it, and chains stall leaning on each other.
    const w = e.body.angularVelocity;
    if (Math.abs(tilt) < 0.2 || Math.abs(tilt) > 1.3) return;
    const dir = Math.sign(tilt);
    for (const c of sim.contactsOf(e)) {
      const o = c.a === e ? c.b : c.a;
      if (!o || o.def.type !== 'domino' || !o.body) continue;
      const ob = o.body;
      if (Math.abs(ob.angle - o.angle) > 0.4) continue;
      if (Math.sign(ob.position.x - e.body.position.x) !== dir) continue;
      const target = dir * Math.max(Math.abs(w) * 0.9, 0.035);
      if (Math.abs(ob.angularVelocity) < Math.abs(target)) {
        M.Body.setAngularVelocity(ob, target);
        // pivot about the bottom corner rather than skating along the floor
        M.Body.setVelocity(ob, { x: target * 29 * Math.cos(ob.angle), y: ob.velocity.y });
      }
    }
  },
});

registerComponent({
  type: 'plank',
  name: 'Plank',
  category: 'basic',
  domain: 'gravity',
  description: 'Fixed board. Ramp, shelf, or wall. Resize and tilt it.',
  tags: ['wood', 'static'],
  dynamic: false,
  rotatable: true,
  flippable: false,
  rotationStep: 5 * DEG,
  props: [{ key: 'length', label: 'Length', type: 'number', min: 40, max: 600, step: 10, default: 160, unit: 'cm' }],
  size: (p) => ({ w: Number(p.length ?? 160), h: 14 }),
  art: 'plank',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 0 }, e.num('length'), 14, { isStatic: true, friction: 0.35, restitution: 0.15, label: 'plank' });
  },
});

registerComponent({
  type: 'seesaw',
  name: 'Seesaw',
  category: 'basic',
  domain: 'mechanical',
  description: 'A plank on a pivot. Drop something heavy on one end, launch the other.',
  help: 'The plank pivots freely around the fulcrum. Tie ropes to either end to make a lever.',
  tags: ['wood', 'lever'],
  dynamic: true,
  rotatable: false,
  flippable: false,
  props: [
    { key: 'length', label: 'Length', type: 'number', min: 120, max: 400, step: 10, default: 220, unit: 'cm' },
    { key: 'tilt', label: 'Starting tilt', type: 'number', min: -25, max: 25, step: 1, default: 0, unit: '°' },
  ],
  anchors: (p) => {
    const L = Number(p.length ?? 220);
    return [
      { id: 'left', x: -L / 2 + 10, y: -7, body: 0, label: 'Left end' },
      { id: 'right', x: L / 2 - 10, y: -7, body: 0, label: 'Right end' },
    ];
  },
  size: (p) => ({ w: Number(p.length ?? 220), h: 50 }),
  art: 'seesaw',
  build(e, sim) {
    const L = e.num('length');
    const group = ownGroup();
    // Plank with a small lip at each end, so a ball parked on the low end waits to be launched
    // instead of rolling straight off.
    const plank = compound(
      sim,
      e,
      [
        { x: 0, y: 0, w: L, h: 12 },
        { x: -L / 2 + 3, y: -11, w: 6, h: 10 },
        { x: L / 2 - 3, y: -11, w: 6, h: 10 },
      ],
      { friction: 0.5, frictionStatic: 0.8, mass: Math.max(1.5, L / 120), group, label: 'seesaw' },
    );
    // Fulcrum: triangle under the pivot.
    poly(sim, e, [{ x: 0, y: 2 }, { x: 22, y: 36 }, { x: -22, y: 36 }], { isStatic: true, group, friction: 0.5, label: 'fulcrum' });
    const pivot = sim.toWorld(e, { x: 0, y: 0 });
    pinToWorld(sim, e, plank, pivot, 1);
    const tilt = e.num('tilt') * DEG;
    if (tilt) M.Body.setAngle(plank, plank.angle + tilt);
    e.state.a0 = plank.angle;
  },
  afterStep(e, sim) {
    if (!e.activated && Math.abs(e.body.angle - e.state.a0) > 0.18) sim.activate(e, 'Seesaw tipped');
  },
});

registerComponent({
  type: 'trampoline',
  name: 'Trampoline',
  category: 'basic',
  domain: 'mechanical',
  description: 'Springy mat. Anything landing on top bounces back up, enthusiastically.',
  tags: ['bouncy', 'static', 'rubber'],
  dynamic: false,
  rotatable: true,
  flippable: false,
  rotationStep: 15 * DEG,
  props: [{ key: 'power', label: 'Springiness', type: 'number', min: 0.5, max: 3, step: 0.1, default: 1.6 }],
  size: () => ({ w: 96, h: 30 }),
  art: 'trampoline',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 4 }, 96, 22, { isStatic: true, restitution: 0, friction: 0.6, label: 'trampoline' });
    e.state.squish = -10;
  },
  onCollide(e, other, info, sim) {
    if (!other || !other.body || other.body.isStatic) return;
    const up: Vec = { x: Math.sin(e.angle), y: -Math.cos(e.angle) };
    // info.normal points from trampoline to other: must be roughly "up" for a top hit.
    if (info.normal.x * up.x + info.normal.y * up.y < 0.55) return;
    const b = other.body;
    const vin = Math.max(info.speed, 0);
    const out = Math.max(vin * 0.9, 7.5 * e.num('power'));
    const vu = b.velocity.x * up.x + b.velocity.y * up.y;
    const add = out - vu;
    M.Body.setVelocity(b, { x: b.velocity.x + up.x * add, y: b.velocity.y + up.y * add });
    e.state.squish = sim.time;
    sim.emit({ t: 'sfx', name: 'boing', x: info.point.x, y: info.point.y, vol: Math.min(1, 0.4 + vin / 20) });
    sim.activate(e, 'Trampoline boinged');
  },
});

registerComponent({
  type: 'bucket',
  name: 'Bucket',
  category: 'basic',
  domain: 'gravity',
  description: 'Holds things. Bolt it down, or hang it from a rope as a counterweight.',
  tags: ['container', 'metal'],
  dynamic: true,
  rotatable: false,
  flippable: false,
  props: [{ key: 'anchored', label: 'Bolted down', type: 'bool', default: true }],
  anchors: [{ id: 'handle', x: 0, y: -46, label: 'Handle' }],
  size: () => ({ w: 70, h: 64 }),
  art: 'bucket',
  interior: () => ({ x: -28, y: -40, w: 56, h: 52 }),
  build(e, sim) {
    const anchored = e.bool('anchored');
    const body = compound(
      sim,
      e,
      [
        { x: 0, y: 18, w: 66, h: 8 },
        { x: -31, y: -6, w: 6, h: 56 },
        { x: 31, y: -6, w: 6, h: 56 },
      ],
      { isStatic: anchored, mass: 2, friction: 0.6, restitution: 0.05, label: 'bucket' },
    );
    // the bucket deadens bouncy things that land in it instead of flinging them back out
    body.plugin.absorb = true;
  },
  afterStep(e, sim) {
    if (e.activated) return;
    if (sim.countInside(e) > 0) sim.activate(e, 'Something landed in the bucket');
  },
});

export const _basicLoaded = speedOf;
