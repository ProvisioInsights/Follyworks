// Generic goal primitives. The engine checks whether things happened; it never knows an
// "intended solution".

import type { GoalDef, Selector } from '../core/types';
import { pointInRect } from '../core/util';
import type { Entity } from './Entity';
import type { Simulation } from './Simulation';

export interface GoalStatus {
  met: boolean;
  /** 0..1 progress for hold-style goals (for HUD feedback). */
  progress: number;
  /** Seconds the condition has been continuously true. */
  held: number;
  metAt: number | null;
}

export const matches = (e: Entity, sel: Selector): boolean => {
  if ('id' in sel) return e.id === sel.id;
  if ('type' in sel) return e.type === sel.type;
  return e.def.tags.includes(sel.tag);
};

export const describeSelector = (sel: Selector, sim?: Simulation): string => {
  if ('id' in sel) {
    const e = sim?.entities.get(sel.id);
    if (!e) return 'the marked object';
    // creatures have names ("Bolt the Walkbot" is just Bolt)
    return e.def.category === 'creature' ? e.def.name.split(' ')[0] : `the ${e.def.name.toLowerCase()}`;
  }
  if ('type' in sel) return `a ${sel.type.replace(/_/g, ' ')}`;
  return `anything ${sel.tag}`;
};

export const goalLabel = (g: GoalDef): string => {
  if (g.label) return g.label;
  switch (g.kind) {
    case 'enterRegion':
      return 'Get it into the goal zone';
    case 'contact':
      return 'Make them touch';
    case 'activate':
      return g.duration ? `Keep it running for ${g.duration}s` : 'Switch it on';
    case 'containerCount':
      return `Put ${g.count} in the container`;
    case 'height':
      return 'Lift it high enough';
    case 'destroyed':
      return 'Get rid of it';
  }
};

export class GoalTracker {
  readonly goals: GoalDef[];
  status: GoalStatus[];
  solvedAt: number | null = null;

  constructor(goals: GoalDef[]) {
    this.goals = goals;
    this.status = goals.map(() => ({ met: false, progress: 0, held: 0, metAt: null }));
  }

  get solved() {
    return this.goals.length > 0 && this.status.every((s) => s.met);
  }

  evaluate(sim: Simulation, dt: number) {
    this.goals.forEach((g, i) => {
      const st = this.status[i];
      if (st.met) return;
      const { ok, hold } = this.check(g, sim);
      if (ok) {
        st.held += dt;
        st.progress = hold > 0 ? Math.min(1, st.held / hold) : 1;
        if (st.held >= hold - 1e-9) {
          st.met = true;
          st.metAt = sim.time;
          sim.emit({ t: 'goal', index: i });
        }
      } else {
        st.held = 0;
        st.progress = 0;
      }
    });
    if (this.solvedAt === null && this.solved) {
      this.solvedAt = sim.time;
      sim.emit({ t: 'solved' });
    }
  }

  private check(g: GoalDef, sim: Simulation): { ok: boolean; hold: number } {
    switch (g.kind) {
      case 'enterRegion': {
        const ok = sim.select(g.target).some((e) => e.body && pointInRect(e.body.position, g.region));
        return { ok, hold: g.hold ?? 0.25 };
      }
      case 'contact': {
        const ok = sim.contacts.some(
          (c) =>
            c.a &&
            c.b &&
            ((matches(c.a, g.a) && matches(c.b, g.b)) || (matches(c.a, g.b) && matches(c.b, g.a))),
        );
        return { ok, hold: 0 };
      }
      case 'activate': {
        const ok = sim.select(g.target).some((e) => e.isActive());
        return { ok, hold: g.duration ?? 0 };
      }
      case 'containerCount': {
        const c = sim.entities.get(g.container);
        if (!c || !c.alive || !c.def.interior) return { ok: false, hold: 0.5 };
        const n = sim.countInside(c, g.filter);
        return { ok: n >= g.count, hold: 0.5 };
      }
      case 'height': {
        const ok = sim.select(g.target).some((e) => e.body && e.body.position.y <= g.maxY);
        return { ok, hold: 0.25 };
      }
      case 'destroyed': {
        const all = [...sim.entities.values()].filter((e) => matches(e, g.target));
        return { ok: all.length > 0 && all.every((e) => !e.alive), hold: 0 };
      }
    }
  }

  serialize() {
    return this.status.map((s) => ({ ...s }));
  }
  deserialize(s: GoalStatus[], solvedAt: number | null) {
    this.status = s.map((x) => ({ ...x }));
    this.solvedAt = solvedAt;
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * One plain sentence about the first goal that is not met, for the stalled / time-up banner:
 * "The rubber ball came to rest just short of the goal zone." Null when every goal is met.
 */
export const describeMiss = (sim: Simulation): string | null => {
  const goals = sim.level.goals;
  const status = sim.goals.status;
  const i = goals.findIndex((_, k) => !status[k]?.met);
  if (i < 0) return null;
  const g = goals[i];
  const st = status[i];
  switch (g.kind) {
    case 'enterRegion': {
      const name = describeSelector(g.target, sim);
      const ents = sim.select(g.target).filter((e) => e.body);
      if (!ents.length) return 'id' in g.target ? `${cap(name)} didn’t survive the trip.` : `Nothing reached the goal zone.`;
      const r = g.region;
      const dist = Math.min(
        ...ents.map((e) => {
          const p = e.body!.position;
          return Math.hypot(Math.max(r.x - p.x, 0, p.x - (r.x + r.w)), Math.max(r.y - p.y, 0, p.y - (r.y + r.h)));
        }),
      );
      if (dist <= 0) return st.held > 0 ? `${cap(name)} reached the goal zone but didn’t stay long enough.` : `${cap(name)} is in the goal zone but didn’t settle there.`;
      if (dist < 60) return `${cap(name)} ended up just short of the goal zone.`;
      if (dist < 250) return `${cap(name)} ended up short of the goal zone.`;
      return `${cap(name)} ended up a long way from the goal zone.`;
    }
    case 'height': {
      const ents = sim.select(g.target).filter((e) => e.body);
      if (!ents.length) return `${cap(describeSelector(g.target, sim))} didn’t survive the trip.`;
      const best = Math.min(...ents.map((e) => e.body!.position.y));
      const short = best - g.maxY;
      return short < 60 ? `${cap(describeSelector(g.target, sim))} nearly got high enough.` : `${cap(describeSelector(g.target, sim))} didn’t get high enough.`;
    }
    case 'activate':
      return st.held > 0
        ? `${cap(describeSelector(g.target, sim))} switched on but didn’t stay on long enough.`
        : `${cap(describeSelector(g.target, sim))} never switched on.`;
    case 'contact':
      return `${cap(describeSelector(g.a, sim))} never touched ${describeSelector(g.b, sim)}.`;
    case 'containerCount': {
      const c = sim.entities.get(g.container);
      if (!c || !c.alive || !c.def.interior) return 'The container didn’t make it.';
      const n = sim.countInside(c, g.filter);
      return `The ${c.def.name.toLowerCase()} holds ${n} of the ${g.count} needed.`;
    }
    case 'destroyed': {
      const left = sim.select(g.target).length;
      return `${left} ${left === 1 ? 'target is' : 'targets are'} still standing.`;
    }
  }
};
