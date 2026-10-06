// Light & Lasers: beam geometry (reflection, splitting, dispersion, filtering, focusing), sensors
// driving circuits, beams heating things, blocking, determinism and rewind exactness.

import { describe, expect, it } from 'vitest';
import type { BeamSeg } from '../src/sim/optics';
import { History } from '../src/sim/history';
import { Simulation } from '../src/sim/Simulation';
import { level, obj, rope, run, sim, wire } from './helpers';

const DEG = Math.PI / 180;
const dir = (s: BeamSeg) => {
  const l = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  return { x: (s.x2 - s.x1) / l, y: (s.y2 - s.y1) / l };
};
const laser = (x: number, y: number, props: Record<string, any> = {}, angle = 0) => obj('laser', x, y, { alwaysOn: true, ...props }, { angle });
/** Beam segments that start at (x, y) within tol. */
const from = (beams: BeamSeg[], x: number, y: number, tol = 3) => beams.filter((b) => Math.hypot(b.x1 - x, b.y1 - y) < tol);

describe('laser beams', () => {
  it('an always-on laser shows its beam before RUN, and a straight beam runs to the wall', () => {
    const s = sim([laser(200, 400)]);
    expect(s.beams.length).toBe(1);
    expect(s.beams[0].y1).toBeCloseTo(400, 3);
    expect(s.beams[0].x2).toBeGreaterThan(1599);
    // an unpowered, not-always-on laser is dark
    expect(sim([laser(200, 400, { alwaysOn: false })]).beams.length).toBe(0);
  });

  it('reflects off a mirror at the angle it came in', () => {
    for (const a of [45, 30, 60, 15]) {
      const s = sim([laser(200, 400), obj('mirror', 600, 400, {}, { angle: a * DEG })]);
      expect(s.beams.length, `${a}°`).toBe(2);
      const din = dir(s.beams[0]);
      const dout = dir(s.beams[1]);
      // mirror face normal
      const n = { x: -Math.sin(a * DEG), y: Math.cos(a * DEG) };
      const inN = din.x * n.x + din.y * n.y;
      const outN = dout.x * n.x + dout.y * n.y;
      const t = { x: n.y, y: -n.x };
      expect(outN, `${a}° normal component flips`).toBeCloseTo(-inN, 6);
      expect(dout.x * t.x + dout.y * t.y, `${a}° tangential component kept`).toBeCloseTo(din.x * t.x + din.y * t.y, 6);
    }
    // 45° turns a rightward beam straight down
    const s = sim([laser(200, 400), obj('mirror', 600, 400, {}, { angle: 45 * DEG })]);
    const d = dir(s.beams[1]);
    expect(d.x).toBeCloseTo(0, 6);
    expect(d.y).toBeCloseTo(1, 6);
  });

  it('a beam splitter sends half on and half sideways', () => {
    const s = sim([laser(200, 400), obj('beam_splitter', 600, 400, {}, { angle: -45 * DEG })]);
    expect(s.beams.length).toBe(3);
    const out = s.beams.slice(1);
    expect(out.map((b) => b.intensity)).toEqual([0.5, 0.5]);
    const dirs = out.map(dir);
    expect(dirs.some((d) => d.x > 0.999)).toBe(true); // straight through
    expect(dirs.some((d) => d.y < -0.999)).toBe(true); // up
  });

  it('a prism fans white light into red, green and blue, bending toward its base', () => {
    const s = sim([laser(200, 400, { color: 'white' }), obj('prism', 600, 400)]);
    const fan = s.beams.filter((b) => !b.inside && b.x1 > 560);
    expect(fan.map((b) => b.color).sort()).toEqual([1, 2, 4]);
    const ang = (c: number) => Math.atan2(dir(fan.find((b) => b.color === c)!).y, dir(fan.find((b) => b.color === c)!).x);
    // base is down (apex up), so all bend downward: red least, blue most
    expect(ang(1)).toBeCloseTo(15 * DEG, 6);
    expect(ang(2)).toBeCloseTo(22.5 * DEG, 6);
    expect(ang(4)).toBeCloseTo(30 * DEG, 6);
    expect(s.beams.some((b) => b.inside)).toBe(true);
    // a coloured beam just bends
    const r = sim([laser(200, 400, { color: 'red' }), obj('prism', 600, 400)]);
    const out = r.beams.filter((b) => !b.inside && b.x1 > 560);
    expect(out.length).toBe(1);
    expect(out[0].color).toBe(1);
  });

  it('a colour filter tints white light and stops other colours', () => {
    const s = sim([laser(200, 400, { color: 'white' }), obj('color_filter', 600, 400, { color: 'green' })]);
    expect(s.beams.length).toBe(2);
    expect(s.beams[1].color).toBe(2);
    const blocked = sim([laser(200, 400, { color: 'red' }), obj('color_filter', 600, 400, { color: 'green' })]);
    expect(blocked.beams.length).toBe(1);
    expect(blocked.beams[0].stopped).toBe(true);
    expect(blocked.beams[0].x2).toBeLessThan(600);
  });

  it('a lens brings parallel beams together at its focal point', () => {
    const f = 200;
    const lasers = [-24, 0, 24].map((dy) => laser(200, 400 + dy));
    const s = sim([...lasers, obj('lens', 600, 400, { focal: f })]);
    const out = s.beams.filter((b) => b.x1 > 590);
    expect(out.length).toBe(3);
    for (const b of out) {
      const d = dir(b);
      const t = (600 + f - b.x1) / d.x;
      expect(b.y1 + d.y * t).toBeCloseTo(400, 6);
    }
    // the middle beam is undeviated
    expect(dir(out.find((b) => Math.abs(b.y1 - 400) < 1)!).y).toBeCloseTo(0, 9);
  });

  it('a solid crate blocks the beam; mounted wall parts do not', () => {
    const s = sim([laser(200, 400), obj('crate', 500, 400), obj('light_sensor', 800, 400)]);
    expect(s.beams.length).toBe(1);
    expect(s.beams[0].x2).toBeLessThan(500);
    run(s, 0.2);
    expect(s.entities.get(s.list[2].id)!.state.lit).toBe(false);
    const t = sim([laser(200, 400), obj('timer', 500, 400), obj('light_sensor', 800, 400)]);
    expect(t.beams[0].x2).toBeGreaterThan(780);
  });

  it('caps the number of segments in a hall of mirrors', () => {
    const s = sim([
      laser(300, 450, {}, 3 * DEG),
      obj('mirror', 200, 450, {}, { angle: 90 * DEG }),
      obj('mirror', 1400, 450, {}, { angle: 90 * DEG }),
      obj('beam_splitter', 800, 300, {}, { angle: 90 * DEG }),
      obj('beam_splitter', 800, 600, {}, { angle: 90 * DEG }),
    ]);
    expect(s.beams.length).toBeLessThanOrEqual(160);
    run(s, 0.1);
  });
});

describe('beams in machines', () => {
  it('a light sensor drives a circuit while lit', () => {
    const l = laser(200, 400);
    const sensor = obj('light_sensor', 700, 400, {}, { angle: 0 });
    const bulb = obj('light_bulb', 900, 600);
    const s = sim([l, sensor, bulb], [wire(sensor, 'out', bulb, 'in')], [{ kind: 'activate', target: { id: bulb.id } }]);
    expect(s.runUntil(0.5)).toBe(true);
  });

  it('a laser wired through a switch only fires when powered, and a colour-fussy sensor ignores other colours', () => {
    const bat = obj('battery', 100, 860);
    const l = laser(200, 400, { alwaysOn: false, color: 'green' });
    const red = obj('light_sensor', 700, 400, { color: 'red' });
    const s = sim([bat, l, red], [wire(bat, 'out', l, 'in')]);
    run(s, 0.3);
    expect(s.entities.get(l.id)!.state.firing).toBe(true);
    expect(s.entities.get(red.id)!.state.lit).toBe(false);
    const g = obj('light_sensor', 700, 400, { color: 'green' });
    const s2 = sim([bat, l, g], [wire(bat, 'out', l, 'in')]);
    run(s2, 0.3);
    expect(s2.entities.get(g.id)!.state.lit).toBe(true);
  });

  it('a beam lights a candle and ignites dynamite after resting on them', () => {
    const c = obj('candle', 700, 420, { lit: false });
    const s = sim([laser(200, 420), c]);
    run(s, 0.1);
    expect(s.entities.get(c.id)!.state.lit).toBe(false);
    run(s, 0.4);
    expect(s.entities.get(c.id)!.state.lit).toBe(true);
    const shelf = obj('wall', 700, 440, { w: 120, h: 20 });
    const d = obj('dynamite', 700, 418, { fuse: 3 });
    const s2 = sim([laser(200, 418), shelf, d]);
    run(s2, 0.6);
    expect(s2.entities.get(d.id)!.state.lit).toBe(true);
  });

  it('a beam pops a balloon that then stops blocking it', () => {
    const anchor = obj('hook', 700, 700);
    const b = obj('balloon', 700, 400);
    const sensor = obj('light_sensor', 1000, 400);
    // pointed a little upward to meet the rising balloon on its way
    const s = sim([laser(200, 400), anchor, b, sensor], [rope(b, 'string', anchor, 'hook', [], { length: 290 })]);
    run(s, 1.5);
    expect(s.entities.get(b.id)!.alive).toBe(false);
    expect(s.chain.some((c) => c.label.includes('Balloon popped'))).toBe(true);
    expect(s.entities.get(sensor.id)!.state.lit).toBe(true);
  });

  it('a beam burns through a rope it crosses', () => {
    const hook = obj('hook', 800, 100);
    const crate = obj('crate', 800, 600);
    const s = sim([hook, crate, laser(200, 300)], [rope(hook, 'hook', crate, 'hook')]);
    expect(s.ropes.length).toBe(1);
    run(s, 1.2);
    expect(s.ropes[0].broken).toBe(true);
    expect(s.chain.some((c) => c.label === 'Laser cut the rope')).toBe(true);
  });

  it('a ball rolling into the beam cuts the sensor off', () => {
    const ramp = obj('plank', 500, 380, { length: 240 }, { angle: 20 * DEG });
    const ball = obj('bowling_ball', 420, 300);
    const sensor = obj('light_sensor', 1100, 846);
    const s = sim([laser(200, 846), ramp, ball, sensor]);
    run(s, 0.2);
    expect(s.entities.get(sensor.id)!.state.lit).toBe(true);
    let cut = false;
    for (let i = 0; i < 240 && !cut; i++) {
      s.step();
      cut = !s.entities.get(sensor.id)!.state.lit;
    }
    expect(cut).toBe(true);
  });
});

describe('optics determinism and rewind', () => {
  const machine = () => {
    const ramp = obj('plank', 500, 380, { length: 240 }, { angle: 20 * DEG });
    const ball = obj('bowling_ball', 420, 300);
    return level([
      laser(200, 846, { color: 'white' }),
      ramp,
      ball,
      obj('prism', 1000, 830, {}, { angle: 180 * DEG }),
      obj('mirror', 700, 700, {}, { angle: 30 * DEG }),
      obj('candle', 1300, 600, { lit: false }),
    ]);
  };

  it('two runs of the same machine trace identical beams every tick', () => {
    const a = new Simulation(machine(), { objects: [], connections: [] });
    const b = new Simulation(machine(), { objects: [], connections: [] });
    for (let i = 0; i < 240; i++) {
      a.step();
      b.step();
      expect(JSON.stringify(a.beams)).toBe(JSON.stringify(b.beams));
    }
  });

  it('restoring a snapshot reproduces that tick\'s beams exactly', () => {
    const s = new Simulation(machine(), { objects: [], connections: [] });
    const h = new History(2, 2700);
    const seen = new Map<number, string>();
    for (let i = 0; i < 240; i++) {
      s.step();
      h.record(s);
      seen.set(s.tick, JSON.stringify(s.beams));
    }
    for (const i of [3, 20, 47, 80, 119]) {
      const snap = h.at(i);
      s.restore(snap);
      expect(JSON.stringify(s.beams), `tick ${snap.tick}`).toBe(seen.get(snap.tick));
    }
  });
});
