import { registerComponent } from '../registry';
import { DEG, poly, rect, rose, wiredIn } from '../kit';

registerComponent({
  type: 'battery',
  name: 'Battery',
  category: 'control',
  domain: 'electric',
  description: 'Power source. Wire its terminal to switches and devices.',
  tags: ['metal', 'static', 'source'],
  dynamic: false,
  rotatable: false,
  flippable: false,
  props: [{ key: 'on', label: 'Charged', type: 'bool', default: true }],
  ports: [{ id: 'out', dir: 'out', x: 0, y: -30, label: 'Power out' }],
  size: () => ({ w: 38, h: 58 }),
  art: 'battery',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 2 }, 34, 52, { isStatic: true, label: 'battery' });
  },
  logic(e) {
    e.outputs.out = e.bool('on');
  },
  isActive: (e) => e.bool('on'),
});

registerComponent({
  type: 'toggle_switch',
  name: 'Toggle Switch',
  category: 'control',
  domain: 'electric',
  description: 'Wall-mounted. Lets power through when ON. Anything passing rightwards (or a rope pull) flips it on.',
  help: 'Anything moving right through the lever turns it ON, moving left turns it OFF. Flip the part to reverse that.',
  tags: ['metal', 'static', 'switch'],
  dynamic: false,
  rotatable: true,
  flippable: true,
  rotationStep: 90 * DEG,
  props: [{ key: 'on', label: 'Starts on', type: 'bool', default: false }],
  ports: [
    { id: 'in', dir: 'in', x: -18, y: 10, label: 'Power in' },
    { id: 'out', dir: 'out', x: 18, y: 10, label: 'Power out' },
  ],
  anchors: [{ id: 'lever', x: 0, y: -30, label: 'Lever tip' }],
  size: () => ({ w: 46, h: 56 }),
  art: 'toggle_switch',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 8 }, 44, 20, { isStatic: true, mounted: true, label: 'switchbase' });
    rect(sim, e, { x: 0, y: -6 }, 44, 52, { isStatic: true, isSensor: true, label: 'switchlever' });
    e.state.on = e.bool('on');
    e.state.flipAt = -10;
  },
  logic(e) {
    e.outputs.out = !!e.inputs.in && !!e.state.on;
  },
  afterStep(e, sim) {
    const lx = { x: Math.cos(e.angle) * (e.flip ? -1 : 1), y: Math.sin(e.angle) * (e.flip ? -1 : 1) };
    for (const c of sim.contactsOf(e)) {
      if (!c.isSensor) continue;
      const other = c.a === e ? c.b : c.a;
      if (!other || !other.body || other.body.isStatic) continue;
      const v = other.body.velocity;
      const vl = v.x * lx.x + v.y * lx.y;
      if (vl > 0.6 && !e.state.on) setSwitch(e, sim, true);
      else if (vl < -0.6 && e.state.on) setSwitch(e, sim, false);
    }
  },
  onRopePull(e, _anchor, impulse, dir, sim) {
    if (impulse < 0.05) return;
    const lx = Math.cos(e.angle) * (e.flip ? -1 : 1) * dir.x + Math.sin(e.angle) * (e.flip ? -1 : 1) * dir.y;
    if (lx > 0.3 && !e.state.on) setSwitch(e, sim, true);
    else if (lx < -0.3 && e.state.on) setSwitch(e, sim, false);
  },
  isActive: (e) => !!e.state.on,
});

const setSwitch = (e: any, sim: any, on: boolean) => {
  if (sim.time - e.state.flipAt < 0.15) return;
  e.state.on = on;
  e.state.flipAt = sim.time;
  sim.emit({ t: 'sfx', name: 'switch', x: e.x, y: e.y });
  sim.activate(e, on ? 'Switch flicked ON' : 'Switch flicked OFF');
};

registerComponent({
  type: 'pressure_plate',
  name: 'Pressure Plate',
  category: 'control',
  domain: 'electric',
  description: 'Lets power through while something heavy enough sits on it.',
  tags: ['metal', 'static', 'sensor'],
  dynamic: false,
  rotatable: true,
  flippable: false,
  rotationStep: 90 * DEG,
  props: [{ key: 'minMass', label: 'Needs at least', type: 'number', min: 0.2, max: 10, step: 0.1, default: 0.5, unit: 'kg' }],
  ports: [
    { id: 'in', dir: 'in', x: -30, y: 4, label: 'Power in' },
    { id: 'out', dir: 'out', x: 30, y: 4, label: 'Power out' },
  ],
  size: () => ({ w: 76, h: 18 }),
  art: 'pressure_plate',
  build(e, sim) {
    poly(sim, e, [{ x: -38, y: 7 }, { x: 38, y: 7 }, { x: 30, y: -5 }, { x: -30, y: -5 }], { isStatic: true, friction: 0.7, label: 'plate' });
    e.state.pressed = false;
  },
  logic(e) {
    e.outputs.out = !!e.inputs.in && !!e.state.pressed;
  },
  afterStep(e, sim) {
    const ux = Math.sin(e.angle);
    const uy = -Math.cos(e.angle);
    let load = 0;
    for (const c of sim.contactsOf(e)) {
      if (c.isSensor) continue;
      const other = c.a === e ? c.b : c.a;
      if (!other || !other.body || other.body.isStatic) continue;
      const nx = c.a === e ? c.normal.x : -c.normal.x;
      const ny = c.a === e ? c.normal.y : -c.normal.y;
      if (nx * ux + ny * uy < 0.45) continue;
      load += other.body.mass;
    }
    // Short release delay so bouncing objects read as one press, not a flicker.
    if (load >= e.num('minMass')) e.state.lastLoad = sim.time;
    const pressed = e.state.lastLoad !== undefined && sim.time - e.state.lastLoad < 0.15;
    if (pressed && !e.state.pressed) {
      sim.emit({ t: 'sfx', name: 'plate', x: e.x, y: e.y });
      sim.activate(e, 'Pressure plate pressed');
    }
    e.state.pressed = pressed;
  },
  isActive: (e) => !!e.state.pressed,
});

registerComponent({
  type: 'timer',
  name: 'Kitchen Timer',
  category: 'control',
  domain: 'logic',
  description: 'When its input switches on, waits, then sends power out. Unwired, it starts when you hit RUN.',
  help: 'Delay: how long it waits. Hold: how long the output stays on (0 = forever).',
  tags: ['plastic', 'static', 'logic'],
  dynamic: false,
  rotatable: false,
  flippable: false,
  props: [
    { key: 'delay', label: 'Delay', type: 'number', min: 0, max: 15, step: 0.1, default: 2, unit: 's' },
    { key: 'hold', label: 'Hold', type: 'number', min: 0, max: 15, step: 0.1, default: 0, unit: 's' },
  ],
  ports: [
    { id: 'in', dir: 'in', x: -26, y: 6, label: 'Start' },
    { id: 'out', dir: 'out', x: 26, y: 6, label: 'Signal out' },
  ],
  size: () => ({ w: 54, h: 48 }),
  art: 'timer',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 2 }, 48, 42, { isStatic: true, mounted: true, label: 'timer' });
    e.state.fireAt = -1;
  },
  logic(e, sim) {
    const f = e.state.fireAt;
    const hold = e.num('hold');
    e.outputs.out = f >= 0 && sim.time >= f && (hold <= 0 || sim.time < f + hold);
  },
  step(e, sim) {
    const wired = wiredIn(sim, e, 'in');
    const start = wired ? rose(e, 'in') : sim.tick === 0;
    if (start && (e.state.fireAt < 0 || sim.time > e.state.fireAt + Math.max(0.1, e.num('hold')))) {
      e.state.fireAt = sim.time + e.num('delay');
      e.state.startedAt = sim.time;
    }
    if (e.state.fireAt >= 0 && !e.state.rang && sim.time >= e.state.fireAt) {
      e.state.rang = true;
      sim.emit({ t: 'sfx', name: 'ding', x: e.x, y: e.y });
      sim.activate(e, 'Timer went DING');
    }
  },
  isActive: (e) => !!e.outputs.out,
});

registerComponent({
  type: 'logic_gate',
  name: 'Logic Box',
  category: 'control',
  domain: 'logic',
  description: 'Combines signals: AND, OR, NOT, XOR, or TOGGLE (each pulse on A flips it).',
  help: 'Logic boxes have their own little cell: the output is powered whenever the rule is true.',
  tags: ['plastic', 'static', 'logic'],
  dynamic: false,
  rotatable: false,
  flippable: false,
  props: [
    {
      key: 'mode',
      label: 'Rule',
      type: 'enum',
      options: [
        { value: 'and', label: 'AND' },
        { value: 'or', label: 'OR' },
        { value: 'not', label: 'NOT (A)' },
        { value: 'xor', label: 'XOR' },
        { value: 'toggle', label: 'TOGGLE (A)' },
      ],
      default: 'and',
    },
  ],
  ports: [
    { id: 'a', dir: 'in', x: -26, y: -8, label: 'Input A' },
    { id: 'b', dir: 'in', x: -26, y: 10, label: 'Input B' },
    { id: 'out', dir: 'out', x: 26, y: 1, label: 'Output' },
  ],
  size: () => ({ w: 54, h: 46 }),
  art: 'logic_gate',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 1 }, 48, 40, { isStatic: true, mounted: true, label: 'logic' });
    e.state.q = false;
  },
  logic(e) {
    const a = !!e.inputs.a;
    const b = !!e.inputs.b;
    switch (e.str('mode')) {
      case 'and':
        e.outputs.out = a && b;
        break;
      case 'or':
        e.outputs.out = a || b;
        break;
      case 'not':
        e.outputs.out = !a;
        break;
      case 'xor':
        e.outputs.out = a !== b;
        break;
      case 'toggle':
        e.outputs.out = !!e.state.q;
        break;
    }
  },
  step(e, sim) {
    if (e.str('mode') === 'toggle' && rose(e, 'a')) e.state.q = !e.state.q;
    if (e.outputs.out && !e.activated && sim.tick > 0) sim.activate(e, 'Logic box tripped');
  },
  isActive: (e) => !!e.outputs.out,
});

registerComponent({
  type: 'light_bulb',
  name: 'Light Bulb',
  category: 'control',
  domain: 'electric',
  description: 'Glows when powered. Frequently the whole point of the machine.',
  tags: ['glass', 'static', 'device'],
  dynamic: false,
  rotatable: false,
  flippable: false,
  props: [],
  ports: [{ id: 'in', dir: 'in', x: 0, y: 28, label: 'Power in' }],
  size: () => ({ w: 36, h: 58 }),
  art: 'light_bulb',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 2 }, 30, 50, { isStatic: true, mounted: true, label: 'bulb' });
  },
  step(e, sim) {
    if (rose(e, 'in')) {
      sim.emit({ t: 'sfx', name: 'zap', x: e.x, y: e.y, vol: 0.5 });
      sim.activate(e, 'Light bulb lit up');
    }
  },
  isActive: (e) => !!e.inputs.in,
});
