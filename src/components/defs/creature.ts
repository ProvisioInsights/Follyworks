import { M } from '../../sim/matter';
import { registerComponent } from '../registry';
import { DEG, rect, wiredIn } from '../kit';

registerComponent({
  type: 'robot',
  name: 'Bolt the Walkbot',
  category: 'creature',
  domain: 'creature',
  description: 'A tiny wind-up robot that marches forward, turns at walls and is very magnetic.',
  help: 'Bolt walks the way it faces and turns around when it bumps into something solid. Wire its antenna and it only walks while powered. Tie a rope to its back and it will drag things along.',
  tags: ['robot', 'metal', 'creature'],
  dynamic: true,
  rotatable: false,
  flippable: true,
  props: [
    { key: 'speed', label: 'Walk speed', type: 'number', min: 30, max: 160, step: 5, default: 70, unit: 'cm/s' },
    { key: 'awake', label: 'Starts awake', type: 'bool', default: true },
  ],
  ports: [{ id: 'in', dir: 'in', x: 0, y: -30, label: 'Antenna' }],
  anchors: [{ id: 'back', x: -12, y: -6, label: 'Back hook' }],
  size: () => ({ w: 34, h: 48 }),
  art: 'robot',
  build(e, sim) {
    const b = rect(sim, e, { x: 0, y: 0 }, 30, 44, { mass: 3, friction: 0, frictionStatic: 0, restitution: 0.05, chamfer: 6, label: 'robot' });
    M.Body.setInertia(b, Infinity);
    e.state.dir = e.flip ? -1 : 1;
    e.state.blocked = 0;
    e.state.walk = 0;
    e.state.walking = false;
  },
  step(e, sim) {
    const b = e.body;
    const powered = wiredIn(sim, e, 'in') ? !!e.inputs.in : e.bool('awake');
    // Grounded if something below pushes up on us.
    let grounded = false;
    let wall = false;
    let step = false;
    for (const c of sim.contactsOf(e)) {
      if (c.isSensor) continue;
      const other = c.a === e ? c.b : c.a;
      // normal from robot to other
      const nx = c.a === e ? c.normal.x : -c.normal.x;
      const ny = c.a === e ? c.normal.y : -c.normal.y;
      if (ny > 0.6) grounded = true;
      const heavy = !other || !other.body || other.body.isStatic || other.body.mass > 6;
      if (Math.abs(nx) > 0.5 && Math.sign(nx) === e.state.dir) {
        // A kerb no taller than his ankles (a plank lying on the floor, a ramp's end) is a step, not a wall.
        const ob = (c.a === e ? c.bodyB : c.bodyA).parent;
        const probe = { x: b.position.x + e.state.dir * 19, y: b.position.y + 22 - 16 };
        const clear = !ob.parts.some((pt: any, i: number) => (i > 0 || ob.parts.length === 1) && M.Vertices.contains(pt.vertices, probe));
        if (c.point.y > b.position.y + 22 - 15 && clear) step = true;
        else if (heavy && Math.abs(nx) > 0.75) wall = true;
      }
    }
    if (!powered) {
      e.state.walking = false;
      // no friction on his feet, so brake explicitly rather than skating on for a metre
      if (grounded) M.Body.setVelocity(b, { x: b.velocity.x * 0.75, y: b.velocity.y });
      return;
    }
    if (!e.state.walking) {
      e.state.walking = true;
      sim.activate(e, 'Bolt the robot started marching', 'creature');
      sim.emit({ t: 'sfx', name: 'robotBeep', x: b.position.x, y: b.position.y });
    }
    if (grounded || step) {
      const target = (e.state.dir * e.num('speed')) / 60;
      const vx = b.velocity.x + (target - b.velocity.x) * 0.35;
      M.Body.setVelocity(b, { x: vx, y: step ? Math.min(b.velocity.y, -2.2) : b.velocity.y });
      e.state.walk += Math.abs(b.velocity.x) * 0.12;
      if (Math.floor(e.state.walk / Math.PI) !== Math.floor((e.state.walk - Math.abs(b.velocity.x) * 0.12) / Math.PI)) {
        sim.emit({ t: 'sfx', name: 'robotStep', x: b.position.x, y: b.position.y, vol: 0.25 });
      }
      if (wall && Math.abs(b.velocity.x) < Math.abs(target) * 0.4) e.state.blocked++;
      else e.state.blocked = Math.max(0, e.state.blocked - 1);
      if (e.state.blocked > 8) {
        e.state.dir *= -1;
        e.state.blocked = 0;
        sim.emit({ t: 'sfx', name: 'robotBeep', x: b.position.x, y: b.position.y, vol: 0.5 });
      }
    }
  },
  isActive: (e) => !!e.state.walking,
});

registerComponent({
  type: 'cactus',
  name: 'Potted Cactus',
  category: 'creature',
  domain: 'creature',
  description: 'Prickly houseplant. Balloons fear it. Bolt just walks around it.',
  tags: ['sharp', 'plant', 'static'],
  dynamic: false,
  rotatable: false,
  flippable: true,
  props: [],
  size: () => ({ w: 34, h: 58 }),
  art: 'cactus',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 16 }, 30, 24, { isStatic: true, label: 'pot' });
    rect(sim, e, { x: 0, y: -12 }, 18, 34, { isStatic: true, chamfer: 8, label: 'cactus' });
  },
});

registerComponent({
  type: 'wall',
  name: 'Wall Block',
  category: 'scenery',
  domain: 'gravity',
  description: 'Solid scenery: brick, concrete, wood or steel. Level builders only.',
  tags: ['static', 'stone'],
  sceneryOnly: true,
  dynamic: false,
  rotatable: true,
  flippable: false,
  rotationStep: 5 * DEG,
  resize: { w: 'w', h: 'h' },
  props: [
    { key: 'w', label: 'Width', type: 'number', min: 6, max: 1600, step: 10, default: 200, unit: 'cm' },
    { key: 'h', label: 'Height', type: 'number', min: 6, max: 1200, step: 10, default: 40, unit: 'cm' },
    {
      key: 'material',
      label: 'Material',
      type: 'enum',
      options: [
        { value: 'concrete', label: 'Concrete' },
        { value: 'brick', label: 'Brick' },
        { value: 'wood', label: 'Wood' },
        { value: 'steel', label: 'Steel' },
      ],
      default: 'concrete',
    },
  ],
  size: (p) => ({ w: Number(p.w ?? 200), h: Number(p.h ?? 40) }),
  art: 'wall',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 0 }, e.num('w'), e.num('h'), { isStatic: true, friction: 0.5, restitution: 0.1, label: 'wall' });
  },
});
