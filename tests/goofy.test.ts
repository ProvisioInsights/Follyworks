// The goofy parts (rubber chicken, mousetrap, toaster, teapot, bowling pins, cat, bell, hoop)
// behave reliably, chain into each other, and survive rewind.

import { describe, expect, it } from 'vitest';
import { M } from '../src/sim/matter';
import { Simulation } from '../src/sim/Simulation';
import { goalLabel, goalMarker } from '../src/sim/goals';
import { parseLevel } from '../src/core/level';
import type { ObjectDef } from '../src/core/types';
import { level, obj, run, sim, wire } from './helpers';

// helpers.level uses a 1600×900 room: the floor top is y = 900.
const FLOOR = 900;

const ent = (s: Simulation, o: ObjectDef) => s.entities.get(o.id)!;
const steps = (s: Simulation, n: number, each?: () => void) => {
  for (let i = 0; i < n; i++) {
    s.step();
    each?.();
  }
};

describe('rubber chicken', () => {
  it('squawks when it lands, makes a noise, and wakes a nearby cat but not a distant one', () => {
    const chicken = obj('rubber_chicken', 600, 700);
    const near = obj('cat', 760, FLOOR - 13);
    const far = obj('cat', 1300, FLOOR - 13);
    const s = sim([chicken, near, far]);
    let heard = 0;
    steps(s, 120, () => (heard += s.noises.filter((n) => n.source?.id === chicken.id).length));
    const c = ent(s, chicken);
    expect(c.state.squawks).toBeGreaterThanOrEqual(1);
    expect(heard).toBeGreaterThanOrEqual(1);
    expect(s.chain.some((st) => st.label === 'The rubber chicken squawked')).toBe(true);
    expect(ent(s, near).state.awake).toBe(true);
    expect(ent(s, far).state.awake).toBe(false);
    // the woken cat leapt and ran off the way it faces
    run(s, 1);
    expect(ent(s, near).body.position.x).toBeGreaterThan(800);
    expect(ent(s, far).body.position.x).toBeCloseTo(1300, 0);
  });

  it('a gentle nudge does not squawk', () => {
    const chicken = obj('rubber_chicken', 600, FLOOR - 9.5);
    const s = sim([chicken]);
    run(s, 1);
    expect(ent(s, chicken).state.squawks).toBe(0);
  });
});

describe('mousetrap', () => {
  const setup = (load: ObjectDef, extra: ObjectDef[] = []) => {
    const trap = obj('mousetrap', 400, FLOOR - 5);
    const wall = obj('wall', 560, FLOOR - 30, { w: 20, h: 60 });
    const s = sim([trap, wall, load, ...extra]);
    return { s, trap, wall };
  };

  it('flings a dropped ball up and over a 60 px wall', () => {
    const ball = obj('ball', 400, 700);
    const { s, trap } = setup(ball);
    let apex = Infinity;
    steps(s, 240, () => (apex = Math.min(apex, ent(s, ball).body.position.y)));
    expect(ent(s, trap).state.snapped).toBe(true);
    expect(s.chain.some((c) => c.key === `${trap.id}:snap`)).toBe(true);
    expect(apex).toBeLessThan(FLOOR - 180);
    expect(ent(s, ball).body.position.x).toBeGreaterThan(600);
  });

  it('flings a rubber chicken and a crate into predictable arcs, the same every time', () => {
    for (const type of ['rubber_chicken', 'crate']) {
      const landing: number[] = [];
      for (let k = 0; k < 2; k++) {
        const thing = obj(type, 400, 760, {}, { id: `thing${k}` });
        const { s } = setup(thing);
        let apex = Infinity;
        steps(s, 300, () => (apex = Math.min(apex, ent(s, thing).body.position.y)));
        expect(apex, type).toBeLessThan(FLOOR - 120);
        landing.push(ent(s, thing).body.position.x);
      }
      expect(landing[0], type).toBeGreaterThan(560);
      expect(landing[1]).toBeCloseTo(landing[0], 6);
    }
  });

  it('goes off when something just rests on it, or on a wire pulse; only once', () => {
    const ball = obj('ball', 400, FLOOR - 10 - 14);
    const { s, trap } = setup(ball);
    run(s, 0.1);
    expect(ent(s, trap).state.snapped).toBe(false);
    run(s, 0.3);
    expect(ent(s, trap).state.snapped).toBe(true);

    const bat = obj('battery', 200, FLOOR - 30);
    const sw = obj('timer', 260, 700, { delay: 0.5 });
    const trap2 = obj('mousetrap', 400, FLOOR - 5);
    const s2 = sim([bat, sw, trap2], [wire(sw, 'out', trap2, 'in')]);
    run(s2, 0.3);
    expect(ent(s2, trap2).state.snapped).toBe(false);
    run(s2, 0.5);
    expect(ent(s2, trap2).state.snapped).toBe(true);
  });
});

describe('toaster', () => {
  it('pops toast straight up after its delay when powered, and pulses its output', () => {
    const bat = obj('battery', 200, FLOOR - 30);
    const toaster = obj('toaster', 500, FLOOR - 24);
    const bulb = obj('light_bulb', 700, 600);
    const s = sim([bat, toaster, bulb], [wire(bat, 'out', toaster, 'in'), wire(toaster, 'out', bulb, 'in')]);
    run(s, 1.0);
    const t = ent(s, toaster);
    expect(t.state.fireAt).toBeGreaterThan(0);
    expect(t.state.rang).toBe(false);
    const toast = (t.state.pool as string[]).map((id) => s.entities.get(id)!);
    expect(toast).toHaveLength(2);
    expect(toast.every((q) => !q.alive)).toBe(true);
    let lit = 0;
    let top = Infinity;
    steps(s, 90, () => {
      if (ent(s, bulb).isActive()) lit++;
      for (const q of toast) if (q.alive) top = Math.min(top, q.body.position.y);
    });
    expect(t.state.rang).toBe(true);
    expect(toast.every((q) => q.alive)).toBe(true);
    expect(top).toBeLessThan(FLOOR - 44 - 80);
    expect(lit).toBeGreaterThan(20);
    expect(lit).toBeLessThan(40);
    expect(ent(s, bulb).isActive()).toBe(false);
    expect(s.chain.some((c) => c.label === 'DING! Toast popped up')).toBe(true);
  });

  it('starts when something lands on its side lever', () => {
    const toaster = obj('toaster', 500, FLOOR - 24);
    const ball = obj('ball', 535, 700);
    const s = sim([toaster, ball]);
    run(s, 1);
    const t = ent(s, toaster);
    expect(t.state.fireAt).toBeGreaterThan(0);
    run(s, 1.5);
    expect(t.state.rang).toBe(true);
    expect(t.isActive()).toBe(true);
  });
});

describe('teapot', () => {
  const rig = (lit: boolean) => {
    // a candle under a little trivet, the teapot on top, a balloon held under a ceiling in the steam
    const candle = obj('candle', 400, FLOOR - 29, { lit });
    const legL = obj('wall', 368, FLOOR - 30, { w: 8, h: 60 });
    const legR = obj('wall', 432, FLOOR - 30, { w: 8, h: 60 });
    const pot = obj('teapot', 400, FLOOR - 60 - 21);
    const ceiling = obj('wall', 560, 690, { w: 400, h: 20 });
    const balloon = obj('balloon', 540, 722);
    const s = sim([candle, legL, legR, pot, ceiling, balloon]);
    return { s, pot, balloon };
  };

  it('boils on a candle, whistles, and its steam pushes a balloon', () => {
    const hot = rig(true);
    const cold = rig(false);
    run(hot.s, 1.2);
    expect(ent(hot.s, hot.pot).state.boiled).toBe(false);
    run(hot.s, 0.6);
    const pot = ent(hot.s, hot.pot);
    expect(pot.state.boiled).toBe(true);
    expect(pot.isActive()).toBe(true);
    expect(hot.s.chain.some((c) => c.key === `${hot.pot.id}:boil`)).toBe(true);
    run(hot.s, 2);
    run(cold.s, 3.8);
    const dx = ent(hot.s, hot.balloon).body.position.x - ent(cold.s, cold.balloon).body.position.x;
    expect(dx).toBeGreaterThan(40);
  });

  it('pushes a rubber ball off a shelf in front of the spout', () => {
    const rig2 = (lit: boolean) => {
      const candle = obj('candle', 400, FLOOR - 29, { lit });
      const legL = obj('wall', 368, FLOOR - 30, { w: 8, h: 60 });
      const legR = obj('wall', 432, FLOOR - 30, { w: 8, h: 60 });
      const pot = obj('teapot', 400, FLOOR - 60 - 21);
      const shelf = obj('wall', 515, 790, { w: 90, h: 20 });
      const ball = obj('ball', 505, 766);
      return { s: sim([candle, legL, legR, pot, shelf, ball]), pot, ball };
    };
    const hot = rig2(true);
    const cold = rig2(false);
    run(hot.s, 4);
    run(cold.s, 4);
    expect(ent(hot.s, hot.pot).state.boiled).toBe(true);
    expect(ent(cold.s, cold.ball).body.position.x).toBeCloseTo(505, -1);
    expect(ent(hot.s, hot.ball).body.position.x).toBeGreaterThan(565);
  });

  it('stops steaming a while after the heat goes away', () => {
    const pot = obj('teapot', 400, FLOOR - 21, { steam: 1 });
    const s = sim([pot]);
    const e = ent(s, pot);
    for (let i = 0; i < 100; i++) {
      e.def.onHeat!(e, s);
      s.step();
    }
    expect(e.state.boiled).toBe(true);
    expect(e.isActive()).toBe(true);
    run(s, 1.2);
    expect(e.isActive()).toBe(false);
  });
});

describe('bowling pins', () => {
  it('a bowling ball rolling into six pins knocks at least five down', () => {
    const xs = [700, 738, 776, 814, 852, 890];
    const pins = xs.map((x) => obj('bowling_pin', x, FLOOR - 28));
    const ball = obj('bowling_ball', 400, FLOOR - 20);
    const s = sim([ball, ...pins], [], [{ kind: 'activate', target: { type: 'bowling_pin' }, count: 5 }]);
    M.Body.setVelocity(ent(s, ball).body, { x: 9, y: 0 });
    run(s, 4);
    const down = pins.filter((p) => ent(s, p).state.down).length;
    expect(down).toBeGreaterThanOrEqual(5);
    expect(s.goals.solved).toBe(true);
    expect(s.chain.filter((c) => c.label === 'Pin down!').length).toBe(down);
  });

  it('a standing pin stays standing', () => {
    const pin = obj('bowling_pin', 700, FLOOR - 28);
    const s = sim([pin]);
    run(s, 2);
    expect(ent(s, pin).state.down).toBe(false);
  });
});

describe('cat', () => {
  it('sleeps through nothing, wakes from a bump, a bang or heat, then runs and turns at walls', () => {
    const cat = obj('cat', 500, FLOOR - 13);
    const s = sim([cat]);
    run(s, 2);
    expect(ent(s, cat).state.awake).toBe(false);
    expect(ent(s, cat).body.position.x).toBeCloseTo(500, 0);

    const cat2 = obj('cat', 500, FLOOR - 13, {}, { flip: true });
    const ball = obj('ball', 500, 700);
    const wall = obj('wall', 300, FLOOR - 50, { w: 20, h: 100 });
    const s2 = sim([cat2, ball, wall]);
    run(s2, 1);
    const c = ent(s2, cat2);
    expect(c.state.awake).toBe(true);
    expect(c.isActive()).toBe(true);
    expect(c.body.position.x).toBeLessThan(450);
    run(s2, 3);
    // turned round at the wall and is heading right again
    expect(c.state.dir).toBe(1);
    expect(s2.chain.some((st) => st.key === `${cat2.id}:wake`)).toBe(true);

    const cat3 = obj('cat', 500, FLOOR - 13);
    const s3 = sim([cat3]);
    s3.explode(600, FLOOR - 20, 150, 10, null);
    s3.step();
    expect(ent(s3, cat3).state.awake).toBe(true);
  });

  it('a yowl wakes a second cat nearby (cats chain)', () => {
    const a = obj('cat', 500, FLOOR - 13);
    const b = obj('cat', 650, FLOOR - 13);
    const ball = obj('ball', 500, 700);
    const s = sim([a, b, ball]);
    run(s, 1);
    expect(ent(s, a).state.awake).toBe(true);
    expect(ent(s, b).state.awake).toBe(true);
  });
});

describe('bell', () => {
  it('rung by a falling ball, it dings, makes a noise and pulses a wired light bulb', () => {
    const bell = obj('bell', 800, 600);
    const bulb = obj('light_bulb', 1000, 600);
    const ball = obj('ball', 812, 400);
    const s = sim([bell, bulb, ball], [wire(bell, 'out', bulb, 'in')]);
    let lit = 0;
    let firstLit = -1;
    let noise = false;
    steps(s, 120, () => {
      if (ent(s, bulb).isActive()) {
        lit++;
        if (firstLit < 0) firstLit = s.tick;
      }
      if (s.noises.some((n) => n.source?.id === bell.id && n.r >= 300)) noise = true;
    });
    const b = ent(s, bell);
    expect(b.state.rings).toBeGreaterThanOrEqual(1);
    expect(noise).toBe(true);
    expect(firstLit).toBeGreaterThan(0);
    expect(lit).toBeGreaterThanOrEqual(25);
    expect(lit).toBeLessThanOrEqual(35 * b.state.rings);
    expect(s.chain.some((c) => c.key === bell.id)).toBe(true);
  });

  it('a ringing bell sets off a wired toaster', () => {
    const bell = obj('bell', 800, 600);
    const toaster = obj('toaster', 900, FLOOR - 24, { delay: 0.3 });
    const ball = obj('ball', 812, 400);
    const s = sim([bell, toaster, ball], [wire(bell, 'out', toaster, 'in')]);
    run(s, 2);
    expect(ent(s, toaster).state.rang).toBe(true);
  });
});

describe('basketball hoop', () => {
  const hoopAt = (extra: ObjectDef[]) => {
    const hoop = obj('basketball_hoop', 800, 500, {}, { id: 'hoop' });
    const s = sim([hoop, ...extra], [], [{ kind: 'containerCount', container: 'hoop', count: 1, filter: { type: 'basketball' } }]);
    return { s, hoop: ent(s, hoop) };
  };

  it('a ball dropped through the rim scores one swish and meets a containerCount goal', () => {
    const ball = obj('basketball', 804, 300);
    const { s, hoop } = hoopAt([ball]);
    run(s, 2);
    expect(hoop.state.swished).toEqual([ball.id]);
    expect(hoop.def.tally!(hoop)).toEqual([ball.id]);
    expect(s.goals.solved).toBe(true);
    expect(s.chain.some((c) => c.key === `hoop>${ball.id}`)).toBe(true);
    const m = goalMarker(s.level.goals[0], s, s.goals.status[0]);
    expect(m.detail).toBe('1/1 swishes');
  });

  it('a ball that bounces off the backboard and out scores nothing', () => {
    const ball = obj('basketball', 940, 470);
    const { s, hoop } = hoopAt([ball]);
    M.Body.setVelocity(ent(s, ball).body, { x: -11, y: -3 });
    let hitBoard = false;
    steps(s, 150, () => {
      if (ent(s, ball).body.velocity.x > 1 && ent(s, ball).body.position.x < 820) hitBoard = true;
    });
    expect(hitBoard).toBe(true);
    expect(hoop.state.swished).toEqual([]);
    expect(s.goals.solved).toBe(false);
  });

  it('only the filtered type counts, and each thing counts once', () => {
    const a = obj('ball', 804, 300);
    const b = obj('basketball', 804, 150);
    const { s, hoop } = hoopAt([a, b]);
    const g = s.level.goals[0];
    run(s, 1.2);
    expect(hoop.state.swished).toContain(a.id);
    run(s, 1.5);
    expect(hoop.state.swished).toEqual([a.id, b.id]);
    expect(s.goals.solved).toBe(true);
    expect(goalLabel(g, s.level)).toBe('Sink a basket');
  });
});

describe('goals for goofy machines', () => {
  it('activate with a count needs that many on at once', () => {
    const candles = [true, true, false].map((lit, i) => obj('candle', 300 + i * 100, FLOOR - 29, { lit }));
    const mk = (count: number) => {
      const lv = level(candles, [], [{ kind: 'activate', target: { type: 'candle' }, count }]);
      return new Simulation(parseLevel(JSON.parse(JSON.stringify(lv))).level, { objects: [], connections: [] });
    };
    const three = mk(3);
    run(three, 0.5);
    expect(three.goals.solved).toBe(false);
    expect(goalLabel(three.level.goals[0], three.level)).toBe('Light 3 candles');
    expect(goalMarker(three.level.goals[0], three, three.goals.status[0]).detail).toBe('2/3 candles');
    const two = mk(2);
    run(two, 0.5);
    expect(two.goals.solved).toBe(true);
  });

  it('parses activate counts and keeps old goals unchanged', () => {
    const lv = level([], [], [
      { kind: 'activate', target: { type: 'cat' } },
      { kind: 'activate', target: { type: 'bowling_pin' }, count: 6 },
      { kind: 'activate', target: { type: 'bell' }, count: 0 } as any,
    ]);
    const parsed = parseLevel(JSON.parse(JSON.stringify(lv))).level;
    expect(parsed.goals[0]).toMatchObject({ kind: 'activate' });
    expect((parsed.goals[0] as any).count).toBeUndefined();
    expect((parsed.goals[1] as any).count).toBe(6);
    expect((parsed.goals[2] as any).count).toBeUndefined();
    expect(goalLabel(parsed.goals[0], parsed)).toBe('Wake the cat');
    expect(goalLabel(parsed.goals[1], parsed)).toBe('Knock down 6 pins');
    expect(goalLabel({ kind: 'activate', target: { type: 'light_bulb' } })).toBe('Switch it on');
  });
});

describe('rewind', () => {
  it('snapshots carry every goofy state: restoring before a squawk, snap or pop undoes it, and after redoes it', () => {
    const chicken = obj('rubber_chicken', 300, 700);
    const trap = obj('mousetrap', 600, FLOOR - 5);
    const ball = obj('ball', 600, 700);
    const bat = obj('battery', 900, FLOOR - 30);
    const toaster = obj('toaster', 1000, FLOOR - 24, { delay: 0.8 });
    const hoop = obj('basketball_hoop', 1300, 500);
    const bb = obj('basketball', 1304, 300);
    const cat = obj('cat', 420, FLOOR - 13);
    const s = sim([chicken, trap, ball, bat, toaster, hoop, bb, cat], [wire(bat, 'out', toaster, 'in')]);
    const early = s.snapshot();
    run(s, 2.5);
    const late = s.snapshot();
    const lateStates = s.list.map((e) => JSON.stringify(e.state));
    expect(ent(s, chicken).state.squawks).toBeGreaterThan(0);
    expect(ent(s, trap).state.snapped).toBe(true);
    expect(ent(s, toaster).state.rang).toBe(true);
    expect(ent(s, hoop).state.swished.length).toBe(1);
    expect(ent(s, cat).state.awake).toBe(true);

    s.restore(early);
    expect(ent(s, chicken).state.squawks).toBe(0);
    expect(ent(s, trap).state.snapped).toBe(false);
    expect(ent(s, toaster).state.rang).toBe(false);
    expect((ent(s, toaster).state.pool as string[]).every((id) => !s.entities.get(id)!.alive)).toBe(true);
    expect(ent(s, hoop).state.swished).toEqual([]);
    expect(ent(s, cat).state.awake).toBe(false);
    expect(s.noises).toEqual([]);

    s.restore(late);
    expect(s.list.map((e) => JSON.stringify(e.state))).toEqual(lateStates);
    expect((ent(s, toaster).state.pool as string[]).every((id) => s.entities.get(id)!.alive)).toBe(true);

    // a fresh run replays to exactly the same states (what resync relies on)
    const again = sim([chicken, trap, ball, bat, toaster, hoop, bb, cat], [wire(bat, 'out', toaster, 'in')]);
    run(again, 2.5);
    expect(again.list.map((e) => JSON.stringify(e.state))).toEqual(lateStates);
  });
});
