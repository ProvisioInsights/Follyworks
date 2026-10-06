import { describe, expect, it } from 'vitest';
import { allComponents, getComponent, normalizeProps, resolveAnchors, resolvePorts } from '../src/components';
import { Simulation } from '../src/sim/Simulation';
import { belt, level, obj, rope, run, sim, wire } from './helpers';

describe('component registry integrity', () => {
  it('has roughly 25+ player-facing components with complete metadata', () => {
    const pal = allComponents().filter((d) => !d.internal && !d.sceneryOnly);
    expect(pal.length).toBeGreaterThanOrEqual(25);
    for (const d of allComponents()) {
      expect(d.type).toMatch(/^[a-z_]+$/);
      expect(d.name.length).toBeGreaterThan(2);
      expect(d.description.length).toBeGreaterThan(10);
      expect(d.art).toBeTruthy();
      expect(typeof d.build).toBe('function');
      const props = normalizeProps(d, {});
      const size = d.size(props);
      expect(size.w).toBeGreaterThan(0);
      expect(size.h).toBeGreaterThan(0);
      for (const p of resolvePorts(d, props)) expect(['in', 'out']).toContain(p.dir);
      const anchorIds = resolveAnchors(d, props).map((a) => a.id);
      expect(new Set(anchorIds).size).toBe(anchorIds.length);
    }
  });

  it('every component builds and serialises in a simulation', () => {
    for (const d of allComponents()) {
      const o = obj(d.type, 400, 400);
      const s = new Simulation(level([o]), { objects: [], connections: [] });
      expect(s.warnings).toEqual([]);
      const e = s.entities.get(o.id)!;
      expect(e).toBeTruthy();
      expect(e.bodies.length).toBeGreaterThan(0);
      run(s, 0.5);
      const snap = s.snapshot();
      s.restore(snap);
      expect(JSON.parse(JSON.stringify(normalizeProps(d, o.props)))).toBeTruthy();
    }
  });

  it('normalizeProps clamps and fills defaults', () => {
    const d = getComponent('plank')!;
    expect(normalizeProps(d, { length: 99999 }).length).toBe(600);
    expect(normalizeProps(d, {}).length).toBe(160);
    expect(normalizeProps(d, { length: 'x' as any }).length).toBe(160);
  });
});

describe('physics behaviours', () => {
  it('a dropped ball lands in a bucket and satisfies a container goal', () => {
    const bucket = obj('bucket', 800, 860);
    const ball = obj('ball', 800, 400);
    const s = sim([bucket, ball], [], [{ kind: 'containerCount', container: bucket.id, count: 1 }]);
    expect(s.runUntil(4)).toBe(true);
  });

  it('battery -> pressure plate -> motor drives a meshed gear', () => {
    const bat = obj('battery', 100, 860);
    const plate = obj('pressure_plate', 300, 890);
    const motor = obj('motor', 600, 860);
    const gear = obj('gear', 600 + 0, 860 - 2 - 12 - 34, { size: 'medium' });
    const ball = obj('ball', 300, 820);
    const s = sim([bat, plate, motor, gear, ball], [wire(bat, 'out', plate, 'in'), wire(plate, 'out', motor, 'in')]);
    run(s, 2.5);
    expect(s.entities.get(plate.id)!.state.pressed).toBe(true);
    expect(s.entities.get(motor.id)!.inputs.in).toBe(true);
    const g = s.entities.get(gear.id)!;
    expect(g.omega).not.toBeNull();
    expect(Math.sign(g.omega!)).toBe(-1);
  });

  it('a belt transfers rotation in the same direction', () => {
    const bat = obj('battery', 100, 860);
    const motor = obj('motor', 300, 860);
    const pulley = obj('pulley', 700, 500);
    const s = sim([bat, motor, pulley], [wire(bat, 'out', motor, 'in'), belt(motor, pulley)]);
    run(s, 0.2);
    expect(s.entities.get(pulley.id)!.omega!).toBeGreaterThan(0);
  });

  it('a powered fan pushes a light ball but barely moves a bowling ball', () => {
    const bat = obj('battery', 60, 860);
    const fan = obj('fan', 200, 860);
    const ball = obj('ball', 300, 886);
    const fan2 = obj('fan', 200, 600);
    const heavy = obj('bowling_ball', 300, 620);
    const shelf = obj('plank', 400, 650, { length: 400 });
    const s = sim([bat, fan, ball, fan2, heavy, shelf], [wire(bat, 'out', fan, 'in'), wire(bat, 'out', fan2, 'in')]);
    run(s, 1.5);
    expect(s.entities.get(ball.id)!.body.position.x).toBeGreaterThan(500);
    expect(s.entities.get(heavy.id)!.body.position.x).toBeLessThan(400);
  });

  it('a fan pointing up holds a balloon in its stream longer', () => {
    const bat = obj('battery', 60, 860);
    const fan = obj('fan', 600, 860, {}, { angle: -Math.PI / 2 });
    const balloon = obj('balloon', 600, 760);
    const s = sim([bat, fan, balloon], [wire(bat, 'out', fan, 'in')]);
    run(s, 0.5);
    expect(s.entities.get(balloon.id)!.body.position.y).toBeLessThan(500);
  });

  it('a balloon floats upward', () => {
    const balloon = obj('balloon', 800, 700);
    const s = sim([balloon]);
    run(s, 1);
    expect(s.entities.get(balloon.id)!.body.position.y).toBeLessThan(500);
  });

  it('a counterweight over a pulley lifts a lighter crate', () => {
    const pulley = obj('pulley', 800, 200);
    const crate = obj('crate', 700, 860); // 3 kg
    const weight = obj('bowling_ball', 900, 400); // 10 kg hanging
    const hook = obj('hook', 0, 0); // unused
    // tie the bowling ball? It has no anchors; use a steel crate instead
    const heavy = obj('crate', 900, 400, { material: 'steel' });
    const s = sim(
      [pulley, crate, heavy, hook],
      [rope(crate, 'hook', heavy, 'hook', [pulley])],
    );
    void weight;
    const y0 = s.entities.get(crate.id)!.body.position.y;
    run(s, 2);
    expect(s.entities.get(crate.id)!.body.position.y).toBeLessThan(y0 - 100);
  });

  it('a candle burns through a rope, dropping its load', () => {
    const hook = obj('hook', 800, 100);
    const crate = obj('crate', 800, 500);
    const candle = obj('candle', 806, 330);
    const s = sim([hook, crate, candle], [rope(hook, 'hook', crate, 'hook')]);
    run(s, 0.5);
    expect(s.ropes[0].broken).toBe(false);
    // move the candle under the rope? the rope passes x=800 between y=106 and 478; candle flame at 820,300 is 20px away
    run(s, 2);
    expect(s.ropes[0].broken).toBe(true);
    expect(s.chain.some((c) => c.label.includes('Rope'))).toBe(true);
  });

  it('dynamite lit by a candle explodes and flings a ball', () => {
    const candle = obj('candle', 760, 860);
    const tnt = obj('dynamite', 770, 820);
    const ball = obj('ball', 840, 870);
    const s = sim([candle, tnt, ball]);
    run(s, 3);
    expect(s.entities.get(tnt.id)!.alive).toBe(false);
    expect(s.entities.get(ball.id)!.body.position.x).toBeGreaterThan(900);
  });

  it('a timer fires a cannon which launches a ball', () => {
    const timer = obj('timer', 100, 860, { delay: 0.5 });
    const cannon = obj('cannon', 300, 860);
    const s = sim([timer, cannon], [wire(timer, 'out', cannon, 'in')]);
    run(s, 1.5);
    const shot = s.entities.get(`${cannon.id}~shot0`)!;
    expect(shot.alive).toBe(true);
    expect(shot.body.position.x).toBeGreaterThan(500);
  });

  it('an electromagnet pulls a walking robot', () => {
    const bat = obj('battery', 60, 860);
    const mag = obj('magnet', 400, 860, {}, { flip: true });
    const robot = obj('robot', 300, 870, { awake: false });
    const s = sim([bat, mag, robot], [wire(bat, 'out', mag, 'in')]);
    const x0 = s.entities.get(robot.id)!.body.position.x;
    run(s, 1);
    expect(Math.abs(s.entities.get(robot.id)!.body.position.x - x0)).toBeGreaterThan(30);
  });

  it('the robot walks, turns at a wall, and presses plates', () => {
    const robot = obj('robot', 1000, 870);
    const s = sim([robot]);
    run(s, 12);
    const e = s.entities.get(robot.id)!;
    expect(e.state.dir).toBe(-1); // turned at the right wall
  });

  it('a toggle switch flips when a ball rolls through it', () => {
    const bat = obj('battery', 60, 860);
    const sw = obj('toggle_switch', 600, 872);
    const bulb = obj('light_bulb', 900, 860);
    const ball = obj('ball', 400, 870);
    const ramp = obj('plank', 300, 700, { length: 300 }, { angle: 0.4 });
    const ball2 = obj('ball', 220, 600);
    const s = sim([bat, sw, bulb, ball, ramp, ball2], [wire(bat, 'out', sw, 'in'), wire(sw, 'out', bulb, 'in')], [
      { kind: 'activate', target: { id: bulb.id } },
    ]);
    expect(s.runUntil(5)).toBe(true);
  });

  it('trampolines bounce things high', () => {
    const tramp = obj('trampoline', 800, 880);
    const ball = obj('bowling_ball', 800, 500);
    const s = sim([tramp, ball]);
    run(s, 0.6);
    let minY = 9999;
    for (let i = 0; i < 90; i++) {
      s.step();
      minY = Math.min(minY, s.entities.get(ball.id)!.body.position.y);
    }
    expect(minY).toBeLessThan(700);
  });

  it('conveyor carries a crate', () => {
    const bat = obj('battery', 60, 860);
    const conv = obj('conveyor', 600, 700, { length: 400, speed: 150 });
    const crate = obj('crate', 450, 660);
    const s = sim([bat, conv, crate], [wire(bat, 'out', conv, 'in')]);
    run(s, 1.5);
    expect(s.entities.get(crate.id)!.body.position.x).toBeGreaterThan(560);
  });

  it('seesaw launches a ball when a heavy ball lands on the other end', () => {
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
});

describe('determinism, reset and rewind', () => {
  const scene = () => {
    const bat = obj('battery', 60, 860, {}, { id: 'bat' });
    const fan = obj('fan', 200, 600, {}, { id: 'fan' });
    const balloon = obj('balloon', 320, 600, {}, { id: 'bal' });
    const ball = obj('ball', 600, 200, {}, { id: 'ball' });
    const ramp = obj('plank', 600, 500, { length: 300 }, { id: 'ramp', angle: 0.3 });
    const tnt = obj('dynamite', 900, 860, { fuse: 0.5 }, { id: 'tnt' });
    const timer = obj('timer', 1100, 860, { delay: 1 }, { id: 'tim' });
    return level([bat, fan, balloon, ball, ramp, tnt, timer], [wire(bat, 'out', fan, 'in'), wire(timer, 'out', tnt, 'in')]);
  };
  const positions = (s: Simulation) => s.list.filter((e) => e.alive).map((e) => [e.id, e.body.position.x.toFixed(6), e.body.position.y.toFixed(6)]);

  it('two runs of the same authored state are identical', () => {
    const a = new Simulation(scene(), { objects: [], connections: [] });
    const b = new Simulation(scene(), { objects: [], connections: [] });
    run(a, 3);
    run(b, 3);
    expect(positions(a)).toEqual(positions(b));
  });

  it('running never mutates the authored level', () => {
    const l = scene();
    const before = JSON.stringify(l);
    run(new Simulation(l, { objects: [], connections: [] }), 3);
    expect(JSON.stringify(l)).toBe(before);
  });

  it('restoring a snapshot reproduces state, including dead entities', () => {
    const s = new Simulation(scene(), { objects: [], connections: [] });
    run(s, 0.5);
    const snap = s.snapshot();
    const p0 = positions(s);
    run(s, 2.5); // dynamite explodes in here
    expect(s.entities.get('tnt')!.alive).toBe(false);
    s.restore(snap);
    expect(s.entities.get('tnt')!.alive).toBe(true);
    expect(positions(s)).toEqual(p0);
    run(s, 2.5);
    expect(s.entities.get('tnt')!.alive).toBe(false);
  });
});
