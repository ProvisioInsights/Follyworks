// Goofy parts in the Incredible Machine tradition: a squawking rubber chicken, a mousetrap
// catapult, a toaster, a whistling teapot, bowling pins, Whiskers the cat, a bell, and a
// basketball hoop (with its ball). Each is built to chain: things that make a racket call
// `sim.noise` (the cat listens), and the bell and toaster send a short wire pulse.
// All runtime state lives in the flat `e.state` bag so rewind restores it exactly.

import type { Vec } from '../../core/types';
import type { Entity } from '../../sim/Entity';
import { M } from '../../sim/matter';
import type { Simulation } from '../../sim/Simulation';
import { registerComponent } from '../registry';
import { DEG, bodyDir, circle, compound, poly, rect, rose } from '../kit';

/** Seconds since a stored time (state times start at -10, "long ago"). */
const since = (sim: Simulation, t: number | undefined) => sim.time - (t ?? -10);

/** Contact normal from `e` towards the other body, and the other entity. */
const contactInfo = (e: Entity, c: { a: Entity | null; b: Entity | null; normal: Vec }) => ({
  other: c.a === e ? c.b : c.a,
  nx: c.a === e ? c.normal.x : -c.normal.x,
  ny: c.a === e ? c.normal.y : -c.normal.y,
});

const loose = (o: Entity | null): o is Entity => !!o && !!o.body && !o.body.isStatic;

// ---------------------------------------------------------------------------------- basketball

registerComponent({
  type: 'basketball',
  name: 'Basketball',
  category: 'basic',
  domain: 'gravity',
  description: 'Orange, grippy and bouncy. Born to go through hoops.',
  tags: ['ball', 'round', 'rubber'],
  dynamic: true,
  rotatable: false,
  flippable: false,
  props: [],
  size: () => ({ w: 32, h: 32 }),
  art: 'basketball',
  build(e, sim) {
    circle(sim, e, { x: 0, y: 0 }, 16, { restitution: 0.65, friction: 0.08, frictionStatic: 0.2, frictionAir: 0.001, mass: 1.2, label: 'basketball' });
  },
});

// ------------------------------------------------------------------------------ rubber chicken

const squawk = (e: Entity, sim: Simulation, speed: number) => {
  if (since(sim, e.state.squawkAt) < 0.18) return;
  e.state.squawkAt = sim.time;
  e.state.squawks = (e.state.squawks ?? 0) + 1;
  e.state.squawking = true;
  const p = e.body.position;
  // harder hits squawk higher and louder
  const pitch = Math.min(1.45, 0.82 + Math.max(0, speed - 2.5) * 0.045);
  sim.emit({ t: 'sfx', name: 'squawk', x: p.x, y: p.y, vol: Math.min(1, 0.55 + speed / 18), pitch });
  sim.emit({ t: 'fx', kind: 'feathers', x: p.x, y: p.y - 6 });
  sim.noise(p.x, p.y, 260, e);
  sim.activate(`${e.id}:squawk`, 'The rubber chicken squawked', e.def.domain);
};

registerComponent({
  type: 'rubber_chicken',
  name: 'Rubber Chicken',
  category: 'chaos',
  domain: 'chaos',
  description: 'Very bouncy. Bonk it and it SQUAWKS, loud enough to wake a cat.',
  help: 'Any knock harder than a gentle nudge makes it squawk; harder hits squawk higher. The noise carries about 2.6 m.',
  tags: ['rubber', 'chicken', 'light', 'squeaky'],
  dynamic: true,
  rotatable: true,
  flippable: true,
  rotationStep: 15 * DEG,
  props: [],
  size: () => ({ w: 52, h: 22 }),
  art: 'rubber_chicken',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 0 }, 50, 18, { mass: 0.45, restitution: 0.75, friction: 0.4, frictionStatic: 0.5, frictionAir: 0.004, chamfer: 8, label: 'chicken', realInertia: true });
    e.state.squawkAt = -10;
    e.state.squawks = 0;
    e.state.squawking = false;
  },
  onCollide(e, _other, info, sim) {
    if (info.speed > 2.5) squawk(e, sim, info.speed);
  },
  onBlast(e, sim) {
    squawk(e, sim, 8);
  },
  afterStep(e, sim) {
    e.state.squawking = since(sim, e.state.squawkAt) < 0.6;
  },
  isActive: (e) => !!e.state.squawking,
});

// ---------------------------------------------------------------------------------- mousetrap

/** Launch direction of the mousetrap: this many degrees up from the deck, toward the facing side. */
const TRAP_ANGLE = 62 * DEG;

const snapTrap = (e: Entity, sim: Simulation, label: string) => {
  if (e.state.snapped) return;
  e.state.snapped = true;
  e.state.snapAt = sim.time;
  const up = bodyDir(e, e.body, 0, -1);
  const fwd = bodyDir(e, e.body, 1, 0);
  const d = { x: fwd.x * Math.cos(TRAP_ANGLE) + up.x * Math.sin(TRAP_ANGLE), y: fwd.y * Math.cos(TRAP_ANGLE) + up.y * Math.sin(TRAP_ANGLE) };
  const power = e.num('power') / 60;
  // Fling whatever sits on (or just above) the deck. Setting the velocity, not adding to it, makes
  // the arc the same every time whatever was falling or rolling onto the trap.
  for (const t of sim.list) {
    if (!loose(t) || t === e) continue;
    const lp = sim.localOfBody(e, t.body.position);
    if (lp.x < -40 || lp.x > 40 || lp.y > 2 || lp.y < -66) continue;
    // heavier things fly slower, but not by much: a crate still clears a low wall
    const v = power / Math.pow(Math.max(1, t.body.mass), 0.25);
    M.Body.setVelocity(t.body, { x: d.x * v, y: d.y * v });
  }
  // a loose trap hops from the recoil
  if (!e.body.isStatic) M.Body.setVelocity(e.body, { x: e.body.velocity.x - fwd.x * 1.2 + up.x * 3, y: e.body.velocity.y - fwd.y * 1.2 + up.y * 3 });
  const p = e.bodyPoint({ x: 0, y: -6 });
  sim.emit({ t: 'sfx', name: 'trapSnap', x: p.x, y: p.y });
  sim.emit({ t: 'fx', kind: 'dust', x: p.x, y: p.y });
  sim.emit({ t: 'shake', amount: 0.15 });
  sim.noise(p.x, p.y, 240, e);
  sim.activate(`${e.id}:snap`, label, e.def.domain);
};

registerComponent({
  type: 'mousetrap',
  name: 'Mousetrap',
  category: 'mechanical',
  domain: 'mechanical',
  description: 'A one-shot spring catapult. Drop something on the cheese and SNAP: it flies up and forward.',
  help: 'Triggered by anything landing on it, anything resting on it for a moment, or a wire pulse. It flings what is on it toward the side the bar snaps to (flip to reverse). Untick "Nailed down" to let it hop.',
  tags: ['wood', 'spring', 'device'],
  dynamic: false,
  rotatable: true,
  flippable: true,
  rotationStep: 15 * DEG,
  props: [
    { key: 'power', label: 'Spring', type: 'number', min: 300, max: 1400, step: 50, default: 820, unit: 'cm/s' },
    { key: 'fixed', label: 'Nailed down', type: 'bool', default: true },
  ],
  ports: [{ id: 'in', dir: 'in', x: -26, y: 2, label: 'Trigger' }],
  size: () => ({ w: 64, h: 14 }),
  art: 'mousetrap',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 0 }, 64, 10, { isStatic: e.bool('fixed'), mass: 0.6, friction: 0.8, frictionStatic: 0.9, restitution: 0.05, chamfer: 2, label: 'mousetrap' });
    e.state.snapped = false;
    e.state.snapAt = -10;
    e.state.rest = 0;
  },
  step(e, sim) {
    if (rose(e, 'in')) snapTrap(e, sim, 'Mousetrap snapped (wired)');
  },
  onCollide(e, other, info, sim) {
    if (e.state.snapped || !loose(other)) return;
    const up = bodyDir(e, e.body, 0, -1);
    if (info.normal.x * up.x + info.normal.y * up.y > 0.5 && info.speed > 0.4) e.state.trip = true;
  },
  afterStep(e, sim) {
    if (e.state.snapped) return;
    const up = bodyDir(e, e.body, 0, -1);
    let load = false;
    for (const c of sim.contactsOf(e)) {
      if (c.isSensor) continue;
      const { other, nx, ny } = contactInfo(e, c);
      if (loose(other) && nx * up.x + ny * up.y > 0.5) load = true;
    }
    e.state.rest = load ? e.state.rest + sim.dt : 0;
    if (e.state.trip || e.state.rest >= 0.2) snapTrap(e, sim, 'SNAP! The mousetrap went off');
    e.state.trip = false;
  },
  isActive: (e) => !!e.state.snapped,
});

// ------------------------------------------------------------------------------ toaster + toast

registerComponent({
  type: 'toast',
  name: 'Toast',
  category: 'chaos',
  domain: 'mechanical',
  description: 'Popped by toasters. Lightly buttered.',
  tags: ['toast', 'food', 'light', 'paper'],
  internal: true,
  dynamic: true,
  rotatable: true,
  flippable: false,
  props: [],
  size: () => ({ w: 24, h: 26 }),
  art: 'toast',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 0 }, 24, 26, { mass: 0.25, restitution: 0.15, friction: 0.6, frictionAir: 0.006, chamfer: 5, label: 'toast', realInertia: true });
  },
});

/** Toaster geometry (local): body top edge and the two slot centres. */
const TOASTER_TOP = -16;
const slotX = (slices: number, i: number) => (slices <= 1 ? 0 : i === 0 ? -11 : 11);

const startToasting = (e: Entity, sim: Simulation, label: string) => {
  if (e.state.fireAt >= 0) return;
  e.state.fireAt = sim.time + e.num('delay');
  e.state.startedAt = sim.time;
  e.state.busy = true;
  sim.emit({ t: 'sfx', name: 'toasterLever', x: e.x, y: e.y });
  sim.activate(e, label);
};

const popToast = (e: Entity, sim: Simulation) => {
  e.state.rang = true;
  e.state.busy = false;
  e.state.dingAt = sim.time;
  const up = bodyDir(e, e.body, 0, -1);
  const right = bodyDir(e, e.body, 1, 0);
  const v = e.num('power') / 60;
  const pool: string[] = e.state.pool ?? [];
  pool.forEach((id, i) => {
    const t = sim.entities.get(id);
    if (!t) return;
    sim.revive(t);
    // out of the slot, just clear of the toaster's top so nothing overlaps
    const at = sim.toWorld(e, { x: slotX(pool.length, i), y: TOASTER_TOP - 14 });
    M.Body.setPosition(t.body, at, false);
    M.Body.setAngle(t.body, e.angle, false);
    const side = pool.length > 1 ? (i === 0 ? -0.35 : 0.35) : 0;
    M.Body.setVelocity(t.body, { x: up.x * v + right.x * side, y: up.y * v + right.y * side });
    M.Body.setAngularVelocity(t.body, side * 0.04);
  });
  const top = sim.toWorld(e, { x: 0, y: TOASTER_TOP });
  sim.emit({ t: 'sfx', name: 'toasterDing', x: top.x, y: top.y });
  sim.emit({ t: 'fx', kind: 'puff', x: top.x, y: top.y });
  sim.noise(top.x, top.y, 220, e);
  sim.activate(`${e.id}:pop`, 'DING! Toast popped up', 'mechanical');
};

registerComponent({
  type: 'toaster',
  name: 'Toaster',
  category: 'chaos',
  domain: 'electric',
  description: 'Press its lever (or send power) and after a moment: DING! Toast flies up.',
  help: 'Starts toasting when something lands on its side lever or power arrives at its socket. After the delay it pops its slices straight up and sends half a second of power out of its OUT socket.',
  tags: ['metal', 'static', 'device'],
  dynamic: false,
  rotatable: true,
  flippable: true,
  rotationStep: 15 * DEG,
  props: [
    { key: 'delay', label: 'Toasting time', type: 'number', min: 0.2, max: 5, step: 0.1, default: 1.2, unit: 's' },
    { key: 'slices', label: 'Slices', type: 'number', min: 1, max: 2, step: 1, default: 2 },
    { key: 'power', label: 'Pop', type: 'number', min: 200, max: 1200, step: 50, default: 560, unit: 'cm/s' },
  ],
  ports: [
    { id: 'in', dir: 'in', x: -22, y: 16, label: 'Power in' },
    { id: 'out', dir: 'out', x: 22, y: 16, label: 'Ding out' },
  ],
  size: () => ({ w: 76, h: 44 }),
  art: 'toaster',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 4 }, 60, 40, { isStatic: true, friction: 0.6, chamfer: 8, label: 'toaster' });
    rect(sim, e, { x: 35, y: -4 }, 12, 14, { isStatic: true, isSensor: true, label: 'toasterlever' });
    e.state.fireAt = -1;
    e.state.rang = false;
    const pool: string[] = [];
    for (let i = 0; i < e.num('slices'); i++) {
      const id = `${e.id}~toast${i}`;
      const toast = sim.spawnObject({ id, type: 'toast', x: e.x, y: e.y - 60, angle: 0 }, 'spawned');
      if (toast) {
        sim.kill(toast);
        pool.push(id);
      }
    }
    e.state.pool = pool;
  },
  logic(e, sim) {
    e.outputs.out = e.state.dingAt !== undefined && since(sim, e.state.dingAt) < 0.5;
  },
  step(e, sim) {
    if (rose(e, 'in')) startToasting(e, sim, 'Toaster switched on');
    if (e.state.fireAt >= 0 && !e.state.rang && sim.time >= e.state.fireAt) popToast(e, sim);
  },
  afterStep(e, sim) {
    if (e.state.fireAt >= 0) return;
    for (const c of sim.contactsOf(e)) {
      if (!c.isSensor || (c.a === e ? c.bodyA : c.bodyB) !== e.bodies[1]) continue;
      if (loose(contactInfo(e, c).other)) return startToasting(e, sim, 'Toaster lever pressed');
    }
  },
  isActive: (e) => !!e.state.rang,
});

// -------------------------------------------------------------------------------------- teapot

/** Spout tip and the direction the steam leaves it, in the teapot's local frame. */
const SPOUT = { x: 34, y: -12 };
const SPOUT_DIR = { x: Math.cos(-35 * DEG), y: Math.sin(-35 * DEG) };
const STEAM_RANGE = 260;

registerComponent({
  type: 'teapot',
  name: 'Teapot',
  category: 'force',
  domain: 'heat',
  description: 'Heat it with a flame, rocket or laser and it boils: WHISTLE, and a jet of steam from the spout.',
  help: 'About 1.5 s of heat brings it to the boil. It keeps steaming while heated and for a while after (Steam time). The steam pushes light things like a small fan.',
  tags: ['metal', 'teapot'],
  dynamic: true,
  rotatable: true,
  flippable: true,
  rotationStep: 15 * DEG,
  props: [{ key: 'steam', label: 'Steam time', type: 'number', min: 1, max: 20, step: 0.5, default: 6, unit: 's' }],
  size: () => ({ w: 70, h: 44 }),
  art: 'teapot',
  build(e, sim) {
    compound(
      sim,
      e,
      [
        { x: 0, y: 4, w: 44, h: 34 },
        { x: 26, y: -2, w: 14, h: 8 },
        { x: -26, y: 2, w: 8, h: 18 },
      ],
      { mass: 2, friction: 0.5, restitution: 0.1, chamfer: 3, label: 'teapot' },
    );
    e.state.heat = 0;
    e.state.boiled = false;
    e.state.lastHeat = -10;
    e.state.steaming = false;
  },
  onHeat(e, sim) {
    // several flames (or both heat spots of one candle) count once per tick
    if (e.state.heatTick === sim.tick) return;
    e.state.heatTick = sim.tick;
    e.state.heat += sim.dt;
    e.state.lastHeat = sim.time;
    if (!e.state.boiled && e.state.heat >= 1.5) {
      e.state.boiled = true;
      e.state.boilAt = sim.time;
      const s = e.bodyPoint(SPOUT);
      sim.emit({ t: 'sfx', name: 'kettle', x: s.x, y: s.y });
      sim.noise(s.x, s.y, 240, e);
      sim.activate(`${e.id}:boil`, 'The teapot boiled and whistled', e.def.domain);
    }
  },
  step(e, sim) {
    // cools slowly until it boils
    if (!e.state.boiled && e.state.lastHeat < sim.time - 0.05) e.state.heat = Math.max(0, e.state.heat - sim.dt * 0.25);
    const steaming = !!e.state.boiled && since(sim, e.state.lastHeat) <= e.num('steam');
    e.state.steaming = steaming;
    e.state.busy = steaming;
    if (!steaming) return;
    const origin = e.bodyPoint(SPOUT);
    const dir = bodyDir(e, e.body, SPOUT_DIR.x, SPOUT_DIR.y);
    const nrm = { x: -dir.y, y: dir.x };
    for (const t of sim.list) {
      if (!loose(t) || t === e) continue;
      const rx = t.body.position.x - origin.x;
      const ry = t.body.position.y - origin.y;
      const along = rx * dir.x + ry * dir.y;
      const side = Math.abs(rx * nrm.x + ry * nrm.y);
      if (along < -4 || along > STEAM_RANGE || side > 18 + along * 0.3) continue;
      const f = 900 * (1 - 0.5 * (along / STEAM_RANGE));
      sim.push(t.body, dir.x * f, dir.y * f);
    }
    if (sim.tick % 3 === 0) sim.emit({ t: 'fx', kind: 'steam', x: origin.x, y: origin.y, dx: dir.x, dy: dir.y });
  },
  isActive: (e) => !!e.state.steaming,
});

// --------------------------------------------------------------------------------- bowling pin

/** Pin outline as stacked boxes: a wide belly low down, a narrow neck and head on top. */
const PIN_PARTS = [
  { x: 0, y: 13, w: 18, h: 30 },
  { x: 0, y: -14, w: 10, h: 26 },
];

registerComponent({
  type: 'bowling_pin',
  name: 'Bowling Pin',
  category: 'basic',
  domain: 'gravity',
  description: 'Tall, light and wobbly. Roll something heavy into a row of them. Strike!',
  tags: ['wood', 'pin'],
  dynamic: true,
  rotatable: true,
  flippable: false,
  rotationStep: 15 * DEG,
  props: [],
  size: () => ({ w: 18, h: 56 }),
  art: 'bowling_pin',
  build(e, sim) {
    const mass = 0.7;
    const b = compound(sim, e, PIN_PARTS, { mass, friction: 0.6, frictionStatic: 0.8, restitution: 0.3, frictionAir: 0.004, label: 'pin' });
    // Real inertia about the centre of mass (Matter inflates it 4x, which makes pins refuse to tip).
    const area = PIN_PARTS.reduce((s, p) => s + p.w * p.h, 0);
    const cy = PIN_PARTS.reduce((s, p) => s + p.y * p.w * p.h, 0) / area;
    let inertia = 0;
    for (const p of PIN_PARTS) {
      const m = (mass * p.w * p.h) / area;
      inertia += (m * (p.w * p.w + p.h * p.h)) / 12 + m * (p.y - cy) * (p.y - cy);
    }
    M.Body.setInertia(b, inertia);
    e.state.down = false;
  },
  onCollide(e, other, info) {
    // Pin assist: a knock from something loose tips the pin away from it, pivoting on its base,
    // and a hard hit from something heavy sends it flying. In plain rigid-body contact a struck
    // row of pins slid along the floor as one block, or leaned on each other and stayed up.
    if (!loose(other) || info.speed < 1.2) return;
    const b = e.body;
    if (Math.abs(b.angle - ((b as any).__refAngle ?? 0)) > 1.2) return;
    const dir = b.position.x >= other.body.position.x ? 1 : -1;
    const kick = dir * Math.min(0.14, 0.03 * info.speed);
    if (other.body.mass > 3 * b.mass && info.speed > 2) {
      M.Body.setVelocity(b, { x: dir * Math.max(Math.abs(b.velocity.x), info.speed * 0.8), y: Math.min(b.velocity.y, -info.speed * 0.45) });
      M.Body.setAngularVelocity(b, kick * 1.3);
      return;
    }
    if (Math.sign(b.angularVelocity) === dir && Math.abs(b.angularVelocity) >= Math.abs(kick)) return;
    M.Body.setAngularVelocity(b, kick);
    const vx = kick * 25;
    M.Body.setVelocity(b, { x: Math.abs(b.velocity.x) > Math.abs(vx) && Math.sign(b.velocity.x) === dir ? b.velocity.x : vx, y: b.velocity.y });
  },
  afterStep(e, sim) {
    if (e.state.down) return;
    const b = e.body;
    const tilt = b.angle - ((b as any).__refAngle ?? 0);
    // Past its tipping point (about 22 degrees) a pin is committed: keep it falling, so a pin
    // leaning on a standing neighbour shoves that one over too instead of propping itself up.
    if (Math.abs(tilt) > 22 * DEG) {
      const want = Math.sign(tilt) * 0.07;
      if (Math.abs(b.angularVelocity) < 0.07 || Math.sign(b.angularVelocity) !== Math.sign(tilt)) M.Body.setAngularVelocity(b, want);
    }
    if (Math.abs(tilt) > 50 * DEG) {
      e.state.down = true;
      sim.activate(`${e.id}:down`, 'Pin down!', e.def.domain);
    }
  },
  isActive: (e) => !!e.state.down,
});

// ---------------------------------------------------------------------------------------- cat

const wakeCat = (e: Entity, sim: Simulation, why: string) => {
  if (e.state.awake) return;
  e.state.awake = true;
  e.state.wokeAt = sim.time;
  e.state.walking = true;
  const b = e.body;
  // the startled leap
  M.Body.setVelocity(b, { x: b.velocity.x + e.state.dir * 3.2, y: Math.min(b.velocity.y, 0) - 6.5 });
  sim.emit({ t: 'sfx', name: 'yowl', x: b.position.x, y: b.position.y });
  sim.emit({ t: 'fx', kind: 'puff', x: b.position.x, y: b.position.y + 12 });
  sim.noise(b.position.x, b.position.y, 200, e);
  sim.activate(`${e.id}:wake`, why, 'creature');
};

registerComponent({
  type: 'cat',
  name: 'Whiskers the Cat',
  category: 'creature',
  domain: 'creature',
  description: 'Fast asleep. A bump, a loud noise, a bang or heat wakes it: YOWL, a leap, then it runs.',
  help: 'Whiskers hears any squawk, ding, bang or snap made within earshot of that noise. Once awake it leaps the way it faces, then runs (faster than Bolt), turns round at walls and shoves light things aside. It never goes back to sleep.',
  tags: ['creature', 'cat', 'rubber'],
  dynamic: true,
  rotatable: false,
  flippable: true,
  props: [{ key: 'speed', label: 'Run speed', type: 'number', min: 60, max: 260, step: 10, default: 150, unit: 'cm/s' }],
  size: () => ({ w: 48, h: 30 }),
  art: 'cat',
  build(e, sim) {
    const b = rect(sim, e, { x: 0, y: 0 }, 44, 26, { mass: 2.5, friction: 0, frictionStatic: 0, restitution: 0.05, chamfer: 9, label: 'cat' });
    M.Body.setInertia(b, Infinity);
    e.state.dir = e.flip ? -1 : 1;
    e.state.awake = false;
    e.state.wokeAt = -10;
    e.state.blocked = 0;
    e.state.walk = 0;
    e.state.walking = false;
  },
  onCollide(e, other, info, sim) {
    if (e.state.awake) return;
    // a knock from something loose, or a real fall onto the floor
    if (loose(other) ? info.speed > 1.5 : info.speed > 4) wakeCat(e, sim, 'Whiskers the cat woke up with a YOWL');
  },
  onNoise(e, _n, sim) {
    wakeCat(e, sim, 'The noise woke Whiskers the cat');
  },
  onBlast(e, sim) {
    wakeCat(e, sim, 'The bang woke Whiskers the cat');
  },
  onHeat(e, sim) {
    wakeCat(e, sim, 'Hot paws! Whiskers the cat woke up');
  },
  step(e, sim) {
    const b = e.body;
    let grounded = false;
    let wall = false;
    let kerb = false;
    for (const c of sim.contactsOf(e)) {
      if (c.isSensor) continue;
      const { other, nx, ny } = contactInfo(e, c);
      if (ny > 0.6) grounded = true;
      if (Math.abs(nx) > 0.5 && Math.sign(nx) === e.state.dir) {
        // low things (a plank on the floor) are hopped onto; heavy or fixed things turn it round
        if (c.point.y > b.position.y + 13 - 9) kerb = true;
        else if (!loose(other) || other.body.mass > 5) wall = true;
      }
    }
    if (!e.state.awake) {
      // asleep: no friction on the paws, so hold still explicitly
      if (grounded) M.Body.setVelocity(b, { x: b.velocity.x * 0.7, y: b.velocity.y });
      return;
    }
    if (since(sim, e.state.wokeAt) < 0.3 || !(grounded || kerb)) return;
    const target = (e.state.dir * e.num('speed')) / 60;
    const vx = b.velocity.x + (target - b.velocity.x) * 0.3;
    M.Body.setVelocity(b, { x: vx, y: kerb ? Math.min(b.velocity.y, -2.4) : b.velocity.y });
    e.state.walk += Math.abs(b.velocity.x) * 0.16;
    if (wall && Math.abs(b.velocity.x) < Math.abs(target) * 0.4) e.state.blocked++;
    else e.state.blocked = Math.max(0, e.state.blocked - 1);
    if (e.state.blocked > 6) {
      e.state.dir *= -1;
      e.state.blocked = 0;
      sim.emit({ t: 'sfx', name: 'meow', x: b.position.x, y: b.position.y, vol: 0.5 });
    }
  },
  isActive: (e) => !!e.state.awake,
});

// --------------------------------------------------------------------------------------- bell

const ringBell = (e: Entity, sim: Simulation, side: number) => {
  if (since(sim, e.state.ringAt) < 0.2) return;
  e.state.ringAt = sim.time;
  e.state.swing = side >= 0 ? 1 : -1;
  e.state.rings = (e.state.rings ?? 0) + 1;
  e.state.ringing = true;
  const p = e.body.position;
  sim.emit({ t: 'sfx', name: 'bell', x: p.x, y: p.y });
  sim.noise(p.x, p.y, 320, e);
  sim.activate(e, 'Ding-dong! The bell rang');
};

registerComponent({
  type: 'bell',
  name: 'Bell',
  category: 'mechanical',
  domain: 'mechanical',
  description: 'Hangs from a bracket. Hit it and it goes DING, wakes cats, and sends a pulse out of its wire socket.',
  help: 'Anything moving into it rings it. Each ring sends half a second of power out of its socket, so a bell can trigger a toaster, glove, cannon or bulb.',
  tags: ['metal', 'static', 'bell'],
  dynamic: false,
  rotatable: false,
  flippable: false,
  props: [],
  ports: [{ id: 'out', dir: 'out', x: 14, y: -30, label: 'Ring out' }],
  size: () => ({ w: 44, h: 72 }),
  art: 'bell',
  build(e, sim) {
    poly(sim, e, [{ x: -10, y: -16 }, { x: 10, y: -16 }, { x: 21, y: 18 }, { x: -21, y: 18 }], { isStatic: true, friction: 0.3, restitution: 0.45, label: 'bell' });
    e.state.ringAt = -10;
    e.state.swing = 1;
    e.state.ringing = false;
  },
  onCollide(e, other, info, sim) {
    if (!loose(other) || info.speed <= 1) return;
    ringBell(e, sim, other.body.position.x - e.body.position.x > 0 ? -1 : 1);
  },
  logic(e, sim) {
    e.outputs.out = since(sim, e.state.ringAt) < 0.5;
  },
  afterStep(e, sim) {
    e.state.ringing = since(sim, e.state.ringAt) < 1;
  },
  isActive: (e) => !!e.state.ringing,
});

// ----------------------------------------------------------------------------- basketball hoop

/** Hoop geometry (local, facing +x): backboard, rim line and its two end posts, the net. */
const HOOP = { boardX: -32, rimY: 14, nearX: -22, farX: 30, postR: 3 };

registerComponent({
  type: 'basketball_hoop',
  name: 'Basketball Hoop',
  category: 'basic',
  domain: 'gravity',
  description: 'Backboard, rim and net. Anything that drops down through the rim scores a SWISH.',
  help: 'Balls bounce off the backboard and the rim; the net slows them gently. Each thing that falls through the rim counts once. Flip it to face the other way.',
  tags: ['metal', 'static', 'hoop'],
  dynamic: false,
  rotatable: false,
  flippable: true,
  props: [],
  size: () => ({ w: 72, h: 92 }),
  art: 'basketball_hoop',
  build(e, sim) {
    rect(sim, e, { x: HOOP.boardX, y: 0 }, 8, 84, { isStatic: true, friction: 0.4, restitution: 0.45, label: 'backboard' });
    circle(sim, e, { x: HOOP.nearX, y: HOOP.rimY }, HOOP.postR, { isStatic: true, restitution: 0.5, friction: 0.2, label: 'rim' });
    circle(sim, e, { x: HOOP.farX, y: HOOP.rimY }, HOOP.postR, { isStatic: true, restitution: 0.5, friction: 0.2, label: 'rim' });
    rect(sim, e, { x: (HOOP.nearX + HOOP.farX) / 2, y: HOOP.rimY + 17 }, HOOP.farX - HOOP.nearX - 4, 32, { isStatic: true, isSensor: true, label: 'net' });
    e.state.swished = [];
    e.state.swishAt = -10;
  },
  afterStep(e, sim) {
    const lo = HOOP.nearX + HOOP.postR;
    const hi = HOOP.farX - HOOP.postR;
    for (const t of sim.list) {
      if (!loose(t) || t === e) continue;
      const b = t.body;
      // the net: gently soaks up sideways speed
      const now = sim.toLocal(e, b.position);
      if (now.x > lo - 4 && now.x < hi + 4 && now.y > HOOP.rimY && now.y < HOOP.rimY + 34) {
        M.Body.setVelocity(b, { x: b.velocity.x * 0.86, y: b.velocity.y * 0.97 });
      }
      // a swish: the centre crossed the rim line going down, between the posts
      const pv = (b as any).__prev as { x: number; y: number } | undefined;
      if (!pv) continue;
      const was = sim.toLocal(e, pv);
      if (!(was.y < HOOP.rimY && now.y >= HOOP.rimY)) continue;
      const u = (HOOP.rimY - was.y) / (now.y - was.y || 1);
      const x = was.x + (now.x - was.x) * u;
      if (x <= lo || x >= hi) continue;
      e.state.swishAt = sim.time;
      const first = !e.state.swished.includes(t.id);
      if (first) e.state.swished.push(t.id);
      const rim = sim.toWorld(e, { x: (HOOP.nearX + HOOP.farX) / 2, y: HOOP.rimY });
      sim.emit({ t: 'sfx', name: 'swish', x: rim.x, y: rim.y });
      sim.emit({ t: 'fx', kind: 'swish', x: rim.x, y: rim.y + 10 });
      if (first) sim.activate(`${e.id}>${t.id}`, `SWISH! The ${t.def.name.toLowerCase()} went in`, 'gravity');
    }
  },
  tally: (e) => e.state.swished ?? [],
  isActive: (e) => (e.state.swished?.length ?? 0) > 0,
});
