import type { Entity } from '../../sim/Entity';
import { M, type MBody } from '../../sim/matter';
import type { Simulation } from '../../sim/Simulation';
import { registerComponent } from '../registry';
import { DEG, circle, dirWorld, rect, rose } from '../kit';

export const isMetal = (e: Entity) => e.def.tags.includes('metal') || e.state.metal === true;

/** Is the straight line from `from` to the body blocked by something solid (static or heavy)? */
const occluded = (sim: Simulation, from: { x: number; y: number }, target: MBody, self: Entity): boolean => {
  const bodies: MBody[] = [];
  for (const e of sim.list) {
    if (!e.alive || e === self) continue;
    for (const b of e.bodies) {
      if (b === target || b.isSensor) continue;
      if (b.isStatic ? b.label === 'gear' || b.label === 'pulley' : b.mass < 2.5) continue;
      bodies.push(b);
    }
  }
  if (!bodies.length) return false;
  const hits = M.Query.ray(bodies, from, target.position, 2);
  return hits.length > 0;
};

registerComponent({
  type: 'fan',
  name: 'Desk Fan',
  category: 'force',
  domain: 'air',
  description: 'Needs power. Blows light things around, snuffs candles. Solid stuff blocks the breeze.',
  tags: ['metal', 'static', 'device'],
  dynamic: false,
  rotatable: true,
  flippable: true,
  rotationStep: 15 * DEG,
  props: [
    { key: 'strength', label: 'Strength', type: 'number', min: 1, max: 10, step: 1, default: 5 },
    { key: 'range', label: 'Reach', type: 'number', min: 120, max: 700, step: 20, default: 360, unit: 'cm' },
  ],
  ports: [{ id: 'in', dir: 'in', x: -14, y: 30, label: 'Power in' }],
  size: () => ({ w: 56, h: 72 }),
  art: 'fan',
  build(e, sim) {
    rect(sim, e, { x: -6, y: 6 }, 40, 64, { isStatic: true, label: 'fan' });
    e.state.blade = 0;
  },
  step(e, sim) {
    if (rose(e, 'in')) {
      sim.activate(e, 'Fan started blowing');
      sim.emit({ t: 'sfx', name: 'whoosh', x: e.x, y: e.y, vol: 0.5 });
    }
    const on = !!e.inputs.in;
    e.state.blade = (e.state.blade + (on ? 0.55 : 0)) % (Math.PI * 2);
    if (!on) return;
    const range = e.num('range');
    const strength = e.num('strength');
    const dir = dirWorld(e, 1, 0);
    const nrm = { x: -dir.y, y: dir.x };
    const origin = sim.toWorld(e, { x: 20, y: -2 });
    for (const t of sim.list) {
      if (!t.alive || t === e || !t.body) continue;
      const b = t.body;
      const rx = b.position.x - origin.x;
      const ry = b.position.y - origin.y;
      const along = rx * dir.x + ry * dir.y;
      const side = Math.abs(rx * nrm.x + ry * nrm.y);
      if (along < 0 || along > range || side > 40) continue;
      if (t.def.tags.includes('flame')) {
        t.def.onBlast?.(t, sim, origin, 0);
        continue;
      }
      if (b.isStatic) continue;
      if (occluded(sim, origin, b, e)) continue;
      const f = strength * 260 * (1 - 0.45 * (along / range));
      sim.push(b, dir.x * f, dir.y * f);
      if (t.def.tags.includes('light') && !t.state.fanned) {
        t.state.fanned = true;
      }
    }
  },
  isActive: (e) => !!e.inputs.in,
});

registerComponent({
  type: 'balloon',
  name: 'Balloon',
  category: 'force',
  domain: 'air',
  description: 'Floats up and tugs on whatever it is tied to. Pops on flames, cacti and explosions.',
  tags: ['light', 'rubber', 'balloon', 'poppable'],
  dynamic: true,
  rotatable: false,
  flippable: false,
  props: [
    { key: 'lift', label: 'Lift', type: 'number', min: 0.5, max: 2.5, step: 0.1, default: 1 },
    {
      key: 'color',
      label: 'Colour',
      type: 'enum',
      options: [
        { value: 'red', label: 'Red' },
        { value: 'yellow', label: 'Yellow' },
        { value: 'teal', label: 'Teal' },
      ],
      default: 'red',
    },
  ],
  anchors: [{ id: 'string', x: 0, y: 26, label: 'String knot' }],
  size: () => ({ w: 44, h: 60 }),
  art: 'balloon',
  build(e, sim) {
    circle(sim, e, { x: 0, y: 0 }, 21, { mass: 0.25, frictionAir: 0.11, restitution: 0.45, friction: 0.1, label: 'balloon' });
  },
  step(e, sim) {
    // Fixed buoyant force (mass-units * px/s^2) so balloons can lift light loads.
    const g = 1000 * sim.gravity;
    sim.push(e.body, 0, -(g * 0.25 + 900 * e.num('lift')));
    // Gentle upright wobble damping.
    M.Body.setAngularVelocity(e.body, e.body.angularVelocity * 0.9);
  },
  onHeat(e, sim) {
    popBalloon(e, sim, 'Balloon popped (too hot)');
  },
  onBlast(e, sim) {
    popBalloon(e, sim, 'Balloon popped by the blast');
  },
  onCollide(e, other, info, sim) {
    if (other?.def.tags.includes('sharp')) popBalloon(e, sim, 'Balloon met a cactus');
    else if (info.speed > 16) popBalloon(e, sim, 'Balloon popped on impact');
  },
});

export const popBalloon = (e: Entity, sim: Simulation, label: string) => {
  if (!e.alive) return;
  const p = e.body.position;
  sim.kill(e);
  sim.emit({ t: 'fx', kind: 'pop', x: p.x, y: p.y });
  sim.emit({ t: 'fx', kind: 'confetti', x: p.x, y: p.y });
  sim.emit({ t: 'sfx', name: 'pop', x: p.x, y: p.y });
  sim.noise(p.x, p.y, 220, e);
  e.activated = false;
  sim.activate(e, label, 'air');
};

registerComponent({
  type: 'magnet',
  name: 'Electromagnet',
  category: 'force',
  domain: 'electric',
  description: 'Needs power. Yanks metal things (iron balls, steel crates, robots) toward its face.',
  tags: ['metal', 'static', 'device'],
  dynamic: false,
  rotatable: true,
  flippable: true,
  rotationStep: 15 * DEG,
  props: [
    { key: 'strength', label: 'Strength', type: 'number', min: 1, max: 10, step: 1, default: 6 },
    { key: 'reach', label: 'Reach', type: 'number', min: 100, max: 420, step: 20, default: 260, unit: 'cm' },
  ],
  ports: [{ id: 'in', dir: 'in', x: -24, y: 16, label: 'Power in' }],
  size: () => ({ w: 60, h: 48 }),
  art: 'magnet',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 0 }, 56, 44, { isStatic: true, friction: 0.9, label: 'magnet' });
  },
  step(e, sim) {
    if (rose(e, 'in')) {
      sim.activate(e, 'Electromagnet energised');
      sim.emit({ t: 'sfx', name: 'zap', x: e.x, y: e.y, vol: 0.6 });
    }
    if (!e.inputs.in) return;
    const face = sim.toWorld(e, { x: 30, y: 0 });
    const R = e.num('reach');
    const s = e.num('strength');
    for (const t of sim.list) {
      if (!t.alive || t === e || !t.body || t.body.isStatic || !isMetal(t)) continue;
      const b = t.body;
      const dx = face.x - b.position.x;
      const dy = face.y - b.position.y;
      const d = Math.hypot(dx, dy);
      if (d > R || d < 1) continue;
      const f = s * 520 * (0.35 + 0.65 * (1 - d / R)) * Math.min(1, b.mass / 2 + 0.4);
      sim.push(b, (dx / d) * f, (dy / d) * f);
      if (!t.state.magnetised) {
        t.state.magnetised = true;
        sim.activate(`${e.id}>${t.id}`, `Magnet grabbed the ${t.def.name.toLowerCase()}`, 'electric');
      }
    }
  },
  isActive: (e) => !!e.inputs.in,
});

registerComponent({
  type: 'candle',
  name: 'Candle',
  category: 'force',
  domain: 'heat',
  description: 'A small, patient flame. Burns ropes, lights fuses, pops balloons. Fans blow it out.',
  tags: ['flame', 'static', 'wax'],
  dynamic: false,
  rotatable: false,
  flippable: false,
  props: [{ key: 'lit', label: 'Lit', type: 'bool', default: true }],
  size: () => ({ w: 22, h: 62 }),
  art: 'candle',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 8 }, 18, 42, { isStatic: true, label: 'candle' });
    e.state.lit = e.bool('lit');
  },
  step(e, sim) {
    if (!e.state.lit) return;
    const f = sim.toWorld(e, { x: 0, y: -30 });
    sim.addHeat(f.x, f.y, 14, e);
    sim.addHeat(f.x, f.y - 26, 12, e);
  },
  onHeat(e, sim) {
    if (e.state.lit) return;
    e.state.lit = true;
    sim.emit({ t: 'sfx', name: 'ignite', x: e.x, y: e.y - 30, vol: 0.5 });
    sim.activate(e, 'Candle caught light');
  },
  onBlast(e, sim, _from, strength) {
    // A fan (strength 0) or a blast snuffs it.
    if (!e.state.lit) return;
    e.state.lit = false;
    const f = sim.toWorld(e, { x: 0, y: -30 });
    sim.emit({ t: 'fx', kind: 'smoke', x: f.x, y: f.y });
    sim.emit({ t: 'sfx', name: 'whoosh', x: f.x, y: f.y, vol: 0.3 });
    e.activated = false;
    sim.activate(e, strength > 0 ? 'Candle blown out by the blast' : 'Candle snuffed by the fan', 'air');
  },
  isActive: (e) => !!e.state.lit,
});
