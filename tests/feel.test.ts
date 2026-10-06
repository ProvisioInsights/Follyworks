// Guards for the physics "feel" tuning (see DECISIONS.md): things that must keep working
// for contraptions to read the way players expect.
import { describe, expect, it } from 'vitest';
import { M } from '../src/sim/matter';
import { obj, sim, wire } from './helpers';
import '../src/components';
import { parseLevel } from '../src/core/level';
import { CAMPAIGN } from '../src/game/campaign';
import { Simulation } from '../src/sim/Simulation';

describe('physics feel', () => {
  it('a row of dominoes falls all the way down', () => {
    for (const gap of [30, 40, 50]) {
      const ds = Array.from({ length: 10 }, (_, i) => obj('domino', 300 + i * gap, 871));
      const s = sim(ds);
      const first = s.entities.get(ds[0].id)!.body;
      M.Body.setAngularVelocity(first, 0.03);
      M.Body.setVelocity(first, { x: 0.87, y: 0 });
      for (let i = 0; i < 600; i++) s.step();
      for (const d of ds) expect(Math.abs(s.entities.get(d.id)!.body.angle), `gap ${gap}`).toBeGreaterThan(0.8);
    }
  });

  it('a rolling ball keeps most of its speed', () => {
    const ball = obj('ball', 200, 885);
    const s = sim([ball]);
    const b = s.entities.get(ball.id)!.body;
    M.Body.setVelocity(b, { x: 8, y: 0 });
    for (let i = 0; i < 60; i++) s.step();
    expect(b.velocity.x).toBeGreaterThan(3); // it used to be ~1.5: spin ate the speed
  });

  it('a bowling ball dropped from the ceiling does not tunnel through a tilted seesaw', () => {
    const saw = obj('seesaw', 700, 860, { length: 300, tilt: -12 });
    const heavy = obj('bowling_ball', 806, 200);
    const s = sim([saw, heavy]);
    let maxA = -9;
    for (let i = 0; i < 150; i++) {
      s.step();
      maxA = Math.max(maxA, s.entities.get(saw.id)!.body.angle);
    }
    expect(maxA).toBeGreaterThan(0.2);
  });

  it('a ball parked on a seesaw is launched, not rolled off', () => {
    const saw = obj('seesaw', 800, 850, { length: 260, tilt: 0 });
    const ball = obj('ball', 690, 820);
    const heavy = obj('bowling_ball', 910, 400);
    const s = sim([saw, ball, heavy]);
    let minY = 9999;
    for (let i = 0; i < 120; i++) {
      s.step();
      minY = Math.min(minY, s.entities.get(ball.id)!.body.position.y);
    }
    expect(minY).toBeLessThan(700);
  });

  it('a bouncy ball dropped into a bucket stays in it', () => {
    const bucket = obj('bucket', 800, 868);
    const ball = obj('ball', 800, 300);
    const s = sim([bucket, ball]);
    for (let i = 0; i < 240; i++) s.step();
    expect(s.countInside(s.entities.get(bucket.id)!)).toBe(1);
  });

  it('the robot steps over a plank lying on the floor and walks up a gentle ramp', () => {
    for (const a of [0, 0.15]) {
      const r = obj('robot', 300, 870);
      const p = obj('plank', 600, 893 - 150 * Math.sin(a), { length: 300 }, { angle: -a });
      const s = sim([r, p]);
      const b = s.entities.get(r.id)!.body;
      let maxX = 0;
      for (let i = 0; i < 600; i++) {
        s.step();
        maxX = Math.max(maxX, b.position.x);
      }
      expect(maxX, `ramp ${a}`).toBeGreaterThan(700);
    }
  });

  it('the robot still turns around at a real wall', () => {
    const r = obj('robot', 300, 870);
    const w = obj('wall', 600, 800, { w: 40, h: 200 });
    const s = sim([r, w]);
    const b = s.entities.get(r.id)!.body;
    let maxX = 0;
    for (let i = 0; i < 600; i++) {
      s.step();
      maxX = Math.max(maxX, b.position.x);
    }
    expect(maxX).toBeLessThan(590);
    expect(b.position.y).toBeGreaterThan(860);
  });

  it('the robot stops promptly when its power is cut', () => {
    const bat = obj('battery', 100, 870);
    const t = obj('timer', 150, 700, { delay: 0, hold: 1 });
    const r = obj('robot', 300, 870);
    const s = sim([bat, t, r], [wire(bat, 'out', t, 'in'), wire(t, 'out', r, 'in')]);
    const b = s.entities.get(r.id)!.body;
    for (let i = 0; i < 90; i++) s.step();
    const x = b.position.x;
    for (let i = 0; i < 90; i++) s.step();
    expect(Math.abs(b.position.x - x)).toBeLessThan(10);
  });

  it('a trampoline always notices a fast ball, even one that touches and leaves within a tick', () => {
    // Bounce House with the trampoline at spots where the contact used to start and end between
    // two substeps: the trampoline must still launch the ball every time.
    const entry = CAMPAIGN.find((c) => c.level.id === 'c3-bounce-house')!;
    for (const [y, angle] of [[830, 0.3], [835, 0.3], [840, 0.3], [840, 0.4], [826, 0.35]]) {
      const lv = parseLevel(JSON.parse(JSON.stringify(entry.level))).level;
      const s = new Simulation(lv, { objects: [{ id: 't', type: 'trampoline', x: 200, y, angle, props: { power: 2 } }], connections: [] }, { lenient: true });
      let fired = false;
      for (let i = 0; i < 400 && !fired; i++) {
        s.step();
        fired = s.entities.get('t')!.activated;
      }
      expect(fired, `trampoline at y=${y} angle=${angle}`).toBe(true);
    }
  });
});

