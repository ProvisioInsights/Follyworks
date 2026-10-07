import type { Entity } from '../../sim/Entity';
import { M } from '../../sim/matter';
import type { Simulation } from '../../sim/Simulation';
import { registerComponent } from '../registry';
import { DEG, bodyDir, circle, dirWorld, rect, rose } from '../kit';

const ignite = (e: Entity, sim: Simulation, label: string) => {
  if (e.state.lit || e.state.done) return;
  e.state.lit = true;
  e.state.litAt = sim.time;
  sim.emit({ t: 'sfx', name: 'fuse', x: e.body.position.x, y: e.body.position.y, vol: 0.6 });
  sim.activate(e, label);
};

registerComponent({
  type: 'dynamite',
  name: 'Dynamite',
  category: 'chaos',
  domain: 'chaos',
  description: 'Light the fuse with fire, a detonator wire or another explosion. Then: boom.',
  tags: ['flammable', 'paper'],
  dynamic: true,
  rotatable: true,
  flippable: false,
  rotationStep: 15 * DEG,
  props: [
    { key: 'fuse', label: 'Fuse', type: 'number', min: 0.2, max: 6, step: 0.1, default: 1.5, unit: 's' },
    { key: 'power', label: 'Bang', type: 'number', min: 1, max: 10, step: 1, default: 5 },
  ],
  ports: [{ id: 'in', dir: 'in', x: 0, y: 12, label: 'Detonator' }],
  size: () => ({ w: 36, h: 26 }),
  art: 'dynamite',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 0 }, 34, 22, { mass: 1.2, friction: 0.6, restitution: 0.05, chamfer: 4, label: 'dynamite' });
    e.state.lit = false;
    e.state.done = false;
  },
  step(e, sim) {
    if (rose(e, 'in')) {
      e.state.fuseOverride = 0.05;
      ignite(e, sim, 'Detonator triggered the dynamite');
    }
    if (e.state.lit && !e.state.done) {
      const fuse = e.state.fuseOverride ?? e.num('fuse');
      if (sim.time - e.state.litAt >= fuse) {
        e.state.done = true;
        const p = { ...e.body.position };
        sim.kill(e);
        sim.activate(`${e.id}:boom`, 'KABOOM', 'chaos');
        sim.explode(p.x, p.y, 120 + e.num('power') * 22, 260 + e.num('power') * 130, e);
      }
    }
  },
  onHeat(e, sim) {
    ignite(e, sim, 'Dynamite fuse sizzling');
  },
  onBlast(e, sim) {
    if (!e.state.lit) {
      e.state.fuseOverride = 0.12;
      ignite(e, sim, 'Sympathetic detonation!');
    }
  },
  isActive: (e) => !!e.state.lit,
});

registerComponent({
  type: 'rocket',
  name: 'Toy Rocket',
  category: 'chaos',
  domain: 'chaos',
  description: 'Light it (fire, wire or blast) and it shoots nose-first. Its exhaust lights things too.',
  tags: ['flammable', 'metal'],
  dynamic: true,
  rotatable: true,
  flippable: true,
  rotationStep: 15 * DEG,
  props: [
    { key: 'thrust', label: 'Thrust', type: 'number', min: 1, max: 10, step: 1, default: 5 },
    { key: 'burn', label: 'Burn time', type: 'number', min: 0.3, max: 5, step: 0.1, default: 1.8, unit: 's' },
  ],
  ports: [{ id: 'in', dir: 'in', x: -10, y: 10, label: 'Igniter' }],
  anchors: [
    { id: 'nose', x: 26, y: 0, label: 'Nose' },
    { id: 'tail', x: -26, y: 0, label: 'Tail' },
  ],
  size: () => ({ w: 60, h: 22 }),
  art: 'rocket',
  build(e, sim) {
    rect(sim, e, { x: 0, y: 0 }, 54, 16, { mass: 1.2, friction: 0.3, frictionAir: 0.012, restitution: 0.2, chamfer: 6, label: 'rocket' });
    e.state.lit = false;
    e.state.done = false;
  },
  step(e, sim) {
    if (rose(e, 'in')) ignite(e, sim, 'Rocket ignited');
    if (!e.state.lit || e.state.done) return;
    if (sim.time - e.state.litAt > e.num('burn')) {
      e.state.done = true;
      return;
    }
    const d = bodyDir(e, e.body, 1, 0);
    const f = e.num('thrust') * 640;
    sim.push(e.body, d.x * f, d.y * f);
    M.Body.setAngularVelocity(e.body, e.body.angularVelocity * 0.82);
    const tail = e.bodyPoint({ x: -34, y: 0 });
    sim.addHeat(tail.x, tail.y, 16, e);
    if (sim.tick % 3 === 0) sim.emit({ t: 'fx', kind: 'exhaust', x: tail.x, y: tail.y, dx: -d.x, dy: -d.y });
  },
  onHeat(e, sim) {
    ignite(e, sim, 'Rocket lit by a flame');
  },
  onBlast(e, sim) {
    ignite(e, sim, 'Rocket lit by the blast');
  },
  isActive: (e) => !!e.state.lit && !e.state.done,
});

registerComponent({
  type: 'cannonball',
  name: 'Cannonball',
  category: 'chaos',
  domain: 'chaos',
  description: 'Fired by cannons.',
  tags: ['metal', 'round', 'heavy', 'ball'],
  internal: true,
  dynamic: true,
  rotatable: false,
  flippable: false,
  props: [],
  size: () => ({ w: 24, h: 24 }),
  art: 'cannonball',
  build(e, sim) {
    circle(sim, e, { x: 0, y: 0 }, 12, { mass: 4, restitution: 0.2, friction: 0.08, frictionAir: 0.002, label: 'cannonball' });
  },
});

registerComponent({
  type: 'cannon',
  name: 'Cannon',
  category: 'chaos',
  domain: 'chaos',
  description: 'Fires an iron ball when triggered by a wire, or when fire touches its fuse.',
  help: 'Rotate to aim. Each trigger fires one shot until it runs out of balls.',
  tags: ['metal', 'static', 'device'],
  dynamic: false,
  rotatable: true,
  flippable: true,
  rotationStep: 5 * DEG,
  props: [
    { key: 'power', label: 'Muzzle speed', type: 'number', min: 300, max: 1600, step: 50, default: 850, unit: 'cm/s' },
    { key: 'shots', label: 'Balls loaded', type: 'number', min: 1, max: 5, step: 1, default: 3 },
  ],
  ports: [{ id: 'in', dir: 'in', x: -26, y: 14, label: 'Trigger' }],
  size: () => ({ w: 76, h: 46 }),
  art: 'cannon',
  build(e, sim) {
    rect(sim, e, { x: -4, y: 6 }, 56, 30, { isStatic: true, friction: 0.6, label: 'cannon' });
    rect(sim, e, { x: 30, y: -2 }, 16, 6, { isStatic: true, isSensor: true, label: 'muzzle' });
    e.state.fired = 0;
    e.state.lastShot = -10;
    const shots = e.num('shots');
    const pool: string[] = [];
    for (let i = 0; i < shots; i++) {
      const id = `${e.id}~shot${i}`;
      const ball = sim.spawnObject({ id, type: 'cannonball', x: e.x, y: e.y, angle: 0 }, 'spawned');
      if (ball) {
        sim.kill(ball);
        pool.push(id);
      }
    }
    e.state.pool = pool;
  },
  step(e, sim) {
    if (rose(e, 'in')) fire(e, sim);
  },
  onHeat(e, sim) {
    fire(e, sim);
  },
  isActive: (e) => e.state.fired > 0,
});

const fire = (e: Entity, sim: Simulation) => {
  if (sim.time - e.state.lastShot < 0.7) return;
  const pool: string[] = e.state.pool ?? [];
  if (e.state.fired >= pool.length) return;
  const ball = sim.entities.get(pool[e.state.fired]);
  if (!ball) return;
  e.state.fired++;
  e.state.lastShot = sim.time;
  const muzzle = sim.toWorld(e, { x: 40, y: -2 });
  const d = dirWorld(e, 1, 0);
  sim.revive(ball);
  M.Body.setPosition(ball.body, muzzle, false);
  M.Body.setAngle(ball.body, 0, false);
  const v = e.num('power') / 60;
  M.Body.setVelocity(ball.body, { x: d.x * v, y: d.y * v });
  M.Body.setAngularVelocity(ball.body, 0);
  sim.emit({ t: 'fx', kind: 'muzzle', x: muzzle.x, y: muzzle.y, dx: d.x, dy: d.y });
  sim.emit({ t: 'sfx', name: 'cannon', x: muzzle.x, y: muzzle.y });
  sim.noise(muzzle.x, muzzle.y, 360, e);
  sim.emit({ t: 'shake', amount: 0.35 });
  sim.activate(e, 'Cannon fired');
};

registerComponent({
  type: 'boxing_glove',
  name: 'Spring Boxing Glove',
  category: 'chaos',
  domain: 'chaos',
  description: 'When triggered, punches whatever is in front of it. Wire it, or bonk its back plate.',
  tags: ['metal', 'static', 'device'],
  dynamic: false,
  rotatable: true,
  flippable: true,
  rotationStep: 15 * DEG,
  props: [{ key: 'power', label: 'Punch', type: 'number', min: 200, max: 1600, step: 50, default: 750, unit: 'cm/s' }],
  ports: [{ id: 'in', dir: 'in', x: -20, y: 16, label: 'Trigger' }],
  size: () => ({ w: 66, h: 40 }),
  art: 'boxing_glove',
  build(e, sim) {
    rect(sim, e, { x: -4, y: 0 }, 50, 34, { isStatic: true, label: 'glovebox' });
    rect(sim, e, { x: -32, y: 0 }, 8, 30, { isStatic: true, isSensor: true, label: 'gloveplate' });
    e.state.punchAt = -10;
  },
  step(e, sim) {
    if (rose(e, 'in')) punch(e, sim, 'Boxing glove punched');
  },
  onCollide(e, other, info, sim) {
    if (info.bodyIndex === 1 && other && !other.body.isStatic && info.speed > 1.5) punch(e, sim, 'Boxing glove bonked into action');
  },
  isActive: (e) => e.state.punchAt > -5,
});

const punch = (e: Entity, sim: Simulation, label: string) => {
  if (sim.time - e.state.punchAt < 0.6) return;
  e.state.punchAt = sim.time;
  const d = dirWorld(e, 1, 0);
  const n = { x: -d.y, y: d.x };
  const origin = sim.toWorld(e, { x: 22, y: 0 });
  const power = e.num('power');
  for (const t of sim.list) {
    if (!t.alive || t === e || !t.body || t.body.isStatic) continue;
    const rx = t.body.position.x - origin.x;
    const ry = t.body.position.y - origin.y;
    const along = rx * d.x + ry * d.y;
    const side = Math.abs(rx * n.x + ry * n.y);
    if (along < -6 || along > 110 || side > 30) continue;
    const dv = power / Math.sqrt(Math.max(0.5, t.body.mass));
    M.Body.setVelocity(t.body, { x: d.x * (dv / 60), y: d.y * (dv / 60) - 1.2 });
  }
  sim.emit({ t: 'sfx', name: 'punch', x: origin.x, y: origin.y });
  sim.emit({ t: 'fx', kind: 'dust', x: origin.x + d.x * 70, y: origin.y + d.y * 70 });
  sim.activate(e, label);
};
