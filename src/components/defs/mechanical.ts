import { M } from '../../sim/matter';
import { registerComponent } from '../registry';
import { CAT, DEG, circle, rect, rose } from '../kit';

/** Angular speed for an rpm value, in rad/tick. */
export const rpmToOmega = (rpm: number) => (rpm * Math.PI * 2) / 60 / 60;

registerComponent({
  type: 'hook',
  name: 'Ceiling Hook',
  category: 'mechanical',
  domain: 'mechanical',
  description: 'A fixed point to tie ropes to. Hang things from it.',
  tags: ['metal', 'static'],
  dynamic: false,
  rotatable: false,
  flippable: false,
  props: [],
  anchors: [{ id: 'hook', x: 0, y: 6, label: 'Hook' }],
  size: () => ({ w: 24, h: 30 }),
  art: 'hook',
  build(e, sim) {
    rect(sim, e, { x: 0, y: -6 }, 20, 12, { isStatic: true, mounted: true, label: 'hook' });
  },
});

registerComponent({
  type: 'pulley',
  name: 'Pulley',
  category: 'mechanical',
  domain: 'mechanical',
  description: 'Route a rope over it to redirect a pull. Belt it to a motor and it becomes a winch.',
  help: 'While placing a rope, click pulleys to route the rope over them. A rope tied directly to a driven pulley gets wound in (clockwise) or let out (anticlockwise).',
  tags: ['metal', 'static'],
  dynamic: false,
  rotatable: false,
  flippable: false,
  props: [],
  anchors: [
    { id: 'wheel', x: 0, y: 0, label: 'Route over' },
    { id: 'drum', x: 0, y: 0, label: 'Winch drum' },
  ],
  rotor: { x: 0, y: 0, r: 18, teeth: false },
  size: () => ({ w: 44, h: 44 }),
  art: 'pulley',
  build(e, sim) {
    circle(sim, e, { x: 0, y: 0 }, 14, { isStatic: true, kinematic: true, friction: 0.2, label: 'pulley' });
  },
  onRotor(e, omega, _jam, sim) {
    if (omega === null || omega === 0) return;
    M.Body.setAngle(e.body, e.body.angle + omega, true);
    for (const rope of sim.ropes) {
      if (rope.broken) continue;
      const atA = rope.a.e === e && rope.a.anchor === 'drum';
      const atB = rope.b.e === e && rope.b.anchor === 'drum';
      if (!atA && !atB) continue;
      rope.length = Math.max(24, Math.min(rope.restLength * 3, rope.length - omega * 18));
      if (!e.activated) sim.activate(e, 'Winch started reeling');
    }
  },
});

registerComponent({
  type: 'gear',
  name: 'Gear',
  category: 'mechanical',
  domain: 'mechanical',
  description: 'Meshes with neighbouring gears and motors. Opposite direction, size sets the ratio.',
  help: 'Drop a gear next to a motor or another gear until the ring glows green. Gears only turn when something drives them. A rope tied to the rim makes a crank.',
  tags: ['metal', 'static'],
  dynamic: false,
  rotatable: false,
  flippable: false,
  props: [
    {
      key: 'size',
      label: 'Size',
      type: 'enum',
      options: [
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' },
      ],
      default: 'medium',
    },
  ],
  rotor: (p) => ({ x: 0, y: 0, r: gearRadius(String(p.size ?? 'medium')), teeth: true }),
  anchors: (p) => [{ id: 'rim', x: gearRadius(String(p.size ?? 'medium')) - 8, y: 0, label: 'Crank pin' }],
  size: (p) => {
    const r = gearRadius(String(p.size ?? 'medium')) + 6;
    return { w: r * 2, h: r * 2 };
  },
  art: 'gear',
  build(e, sim) {
    const r = gearRadius(e.str('size'));
    circle(sim, e, { x: 0, y: 0 }, r + 3, {
      isStatic: true,
      kinematic: true,
      friction: 0.9,
      frictionStatic: 1,
      category: CAT.GEAR,
      mask: CAT.DEFAULT,
      label: 'gear',
    });
  },
  onRotor(e, omega, _jam, sim) {
    if (omega === null || omega === 0) {
      M.Body.setAngularVelocity(e.body, 0);
      return;
    }
    M.Body.setAngle(e.body, e.body.angle + omega, true);
    if (!e.activated) sim.activate(e, 'Gears started turning');
  },
  isActive: (e) => !!e.omega,
});

export function gearRadius(size: string) {
  return size === 'small' ? 22 : size === 'large' ? 52 : 34;
}

registerComponent({
  type: 'motor',
  name: 'Electric Motor',
  category: 'mechanical',
  domain: 'electric',
  description: 'Needs power. Spins its little gear, which drives meshed gears and belts.',
  help: 'Wire it to a battery (through switches if you like). Its pinion meshes with gears placed right next to it, or connect a belt.',
  tags: ['metal', 'static', 'device'],
  dynamic: false,
  rotatable: false,
  flippable: true,
  props: [
    { key: 'rpm', label: 'Speed', type: 'number', min: 10, max: 120, step: 5, default: 50, unit: 'rpm' },
    {
      key: 'dir',
      label: 'Direction',
      type: 'enum',
      options: [
        { value: 'cw', label: 'Clockwise' },
        { value: 'ccw', label: 'Anticlockwise' },
      ],
      default: 'cw',
    },
  ],
  ports: [{ id: 'in', dir: 'in', x: -22, y: 16, label: 'Power in' }],
  rotor: { x: 0, y: -2, r: 12, teeth: true },
  size: () => ({ w: 60, h: 48 }),
  art: 'motor',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 4 }, 56, 40, { isStatic: true, friction: 0.5, label: 'motor' });
    e.state.spin = 0;
  },
  rotorSource(e) {
    if (!e.inputs.in) return null;
    const w = rpmToOmega(e.num('rpm'));
    return e.str('dir') === 'ccw' ? -w : w;
  },
  step(e, sim) {
    if (rose(e, 'in')) {
      sim.emit({ t: 'sfx', name: 'zap', x: e.x, y: e.y, vol: 0.4 });
      sim.activate(e, 'Motor whirred to life');
    }
    if (e.inputs.in) e.state.spin = (e.state.spin + (e.omega ?? 0)) % (Math.PI * 2);
  },
  isActive: (e) => !!e.inputs.in,
});

registerComponent({
  type: 'conveyor',
  name: 'Conveyor Belt',
  category: 'mechanical',
  domain: 'mechanical',
  description: 'Carries whatever sits on it. Power it, or drive its end wheel with a belt.',
  tags: ['rubber', 'static', 'device'],
  dynamic: false,
  rotatable: true,
  flippable: false,
  rotationStep: 5 * DEG,
  resize: { w: 'length' },
  props: [
    { key: 'length', label: 'Length', type: 'number', min: 100, max: 600, step: 10, default: 220, unit: 'cm' },
    { key: 'speed', label: 'Speed', type: 'number', min: 20, max: 300, step: 10, default: 110, unit: 'cm/s' },
    {
      key: 'dir',
      label: 'Direction',
      type: 'enum',
      options: [
        { value: 'right', label: 'Right' },
        { value: 'left', label: 'Left' },
      ],
      default: 'right',
    },
  ],
  ports: (p) => [{ id: 'in', dir: 'in', x: -Number(p.length ?? 220) / 2 + 30, y: 14, label: 'Power in' }],
  rotor: (p) => ({ x: -Number(p.length ?? 220) / 2 + 12, y: 0, r: 11, teeth: false }),
  size: (p) => ({ w: Number(p.length ?? 220), h: 26 }),
  art: 'conveyor',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 0 }, e.num('length'), 22, { isStatic: true, friction: 0.9, frictionStatic: 1, restitution: 0, label: 'conveyor', chamfer: 10 });
    e.state.surf = 0; // surface speed px/tick
    e.state.travel = 0;
  },
  onRotor(e, omega) {
    // Belt-driven: surface speed follows the drive wheel (clockwise = rightwards on top).
    e.state.driven = omega !== null ? omega * 11 : null;
  },
  step(e, sim) {
    const dir = e.str('dir') === 'left' ? -1 : 1;
    let surf = 0;
    if (e.inputs.in) surf = (dir * e.num('speed')) / 60;
    else if (typeof e.state.driven === 'number') surf = e.state.driven;
    e.state.surf = surf;
    e.state.travel = (e.state.travel + surf) % 1000;
    const tx = Math.cos(e.angle);
    const ty = Math.sin(e.angle);
    // A static body with a velocity acts as a moving surface for Matter's friction solver.
    M.Body.setVelocity(e.body, { x: tx * surf, y: ty * surf });
    if (surf === 0) return;
    if (!e.activated) sim.activate(e, 'Conveyor started rolling');
    const ux = Math.sin(e.angle);
    const uy = -Math.cos(e.angle);
    for (const c of sim.contactsOf(e)) {
      const other = c.a === e ? c.b : c.a;
      if (!other || !other.body || other.body.isStatic || c.isSensor) continue;
      // normal from conveyor to other
      const nx = c.a === e ? c.normal.x : -c.normal.x;
      const ny = c.a === e ? c.normal.y : -c.normal.y;
      if (nx * ux + ny * uy < 0.5) continue;
      const b = other.body;
      const vt = b.velocity.x * tx + b.velocity.y * ty;
      const dv = (surf - vt) * 0.08;
      M.Body.setVelocity(b, { x: b.velocity.x + tx * dv, y: b.velocity.y + ty * dv });
    }
  },
  isActive: (e) => Math.abs(e.state.surf ?? 0) > 0,
});
