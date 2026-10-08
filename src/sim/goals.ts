// Generic goal primitives. The engine checks whether things happened; it never knows an
// "intended solution".

import type { GoalDef, LevelDef, Selector, Vec } from '../core/types';
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

/** The part type a selector names, when it can be told from the selector (and the level). */
const selectorType = (sel: Selector, level?: LevelDef): string | null => {
  if ('type' in sel) return sel.type;
  if ('id' in sel) return [...(level?.fixedObjects ?? []), ...(level?.startingObjects ?? [])].find((o) => o.id === sel.id)?.type ?? null;
  return null;
};

/**
 * Plain wording for "make it active" goals on parts where "switch it on" would be odd:
 * [one, many] where many takes the count ("Knock down 6 pins").
 */
const ACTIVATE_WORDS: Record<string, [string, (n: number) => string]> = {
  bowling_pin: ['Knock down the pin', (n) => `Knock down ${n} pins`],
  candle: ['Light the candle', (n) => `Light ${n} candles`],
  cat: ['Wake the cat', (n) => `Wake ${n} cats`],
  bell: ['Ring the bell', (n) => `Ring ${n} bells`],
  rubber_chicken: ['Make the chicken squawk', (n) => `Make ${n} chickens squawk`],
  teapot: ['Boil the teapot', (n) => `Boil ${n} teapots`],
  toaster: ['Pop the toast', (n) => `Pop ${n} toasters`],
  mousetrap: ['Spring the mousetrap', (n) => `Spring ${n} mousetraps`],
};

/** Plural noun for a live "2/3 …" count on goal tags and chips. */
const COUNT_NOUN: Record<string, string> = {
  bowling_pin: 'pins',
  candle: 'candles',
  cat: 'cats',
  bell: 'bells',
  light_bulb: 'bulbs',
  rubber_chicken: 'chickens',
  teapot: 'teapots',
  toaster: 'toasters',
  mousetrap: 'traps',
};

/** What "it happened" reads as for a part, in a miss sentence ("The bell never rang"). */
const DID: Record<string, [never: string, did: string]> = {
  bowling_pin: ['never went down', 'went down'],
  candle: ['never lit', 'lit'],
  cat: ['never woke up', 'woke up'],
  bell: ['never rang', 'rang'],
  light_bulb: ['never lit up', 'lit up'],
  rubber_chicken: ['never squawked', 'squawked'],
  teapot: ['never boiled', 'boiled'],
  toaster: ['never popped', 'popped'],
  mousetrap: ['never snapped', 'snapped'],
};

/** What a container counts: hoops count swishes, everything else what is inside. */
const containerNoun = (type: string | null) => (type === 'basketball_hoop' ? 'swishes' : null);

export const goalLabel = (g: GoalDef, level?: LevelDef): string => {
  if (g.label) return g.label;
  switch (g.kind) {
    case 'enterRegion':
      return 'Get it into the goal zone';
    case 'contact':
      return 'Make them touch';
    case 'activate': {
      const n = g.count ?? 1;
      const words = ACTIVATE_WORDS[selectorType(g.target, level) ?? ''];
      if (g.duration) return `Keep ${n > 1 ? `${n} of them` : 'it'} running for ${g.duration}s`;
      if (words) return n > 1 ? words[1](n) : words[0];
      return n > 1 ? `Switch on ${n} at once` : 'Switch it on';
    }
    case 'containerCount': {
      const type = level ? [...level.fixedObjects, ...level.startingObjects].find((o) => o.id === g.container)?.type ?? null : null;
      if (containerNoun(type)) return g.count > 1 ? `Sink ${g.count} baskets` : 'Sink a basket';
      return `Put ${g.count} in the container`;
    }
    case 'height':
      return 'Lift it high enough';
    case 'destroyed':
      return 'Get rid of it';
  }
};

/** How many things count for a containerCount goal right now (tally or contents), or null if `c` is no container. */
export const containerTotal = (sim: Simulation, c: Entity | undefined, filter?: Selector): number | null => {
  if (!c) return null;
  if (c.def.tally) {
    const ids = new Set(c.def.tally(c));
    let n = 0;
    for (const id of ids) {
      const e = sim.entities.get(id);
      if (e && (!filter || matches(e, filter))) n++;
    }
    return n;
  }
  if (!c.alive || !c.def.interior) return null;
  return sim.countInside(c, filter);
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
        const need = g.count ?? 1;
        const ok = need <= 1 ? sim.select(g.target).some((e) => e.isActive()) : sim.select(g.target).filter((e) => e.isActive()).length >= need;
        return { ok, hold: g.duration ?? 0 };
      }
      case 'containerCount': {
        const c = sim.entities.get(g.container);
        const n = containerTotal(sim, c, g.filter);
        // a tally (swishes scored) never goes down again, so it needs no settling time
        return { ok: n !== null && n >= g.count, hold: c?.def.tally ? 0 : 0.5 };
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
    case 'activate': {
      const need = g.count ?? 1;
      if (need > 1) {
        const on = sim.select(g.target).filter((e) => e.isActive()).length;
        const type = (('id' in g.target ? sim.entities.get(g.target.id)?.type : null) ?? selectorType(g.target, sim.level));
        const noun = COUNT_NOUN[type ?? ''] ?? 'targets';
        const did = DID[type ?? '']?.[1];
        if (did && !g.duration) return on === 0 ? `None of the ${need} ${noun} ${did}.` : `Only ${on} of the ${need} ${noun} ${did}.`;
        return `Only ${on} of the ${need} ${noun} ${on === 1 ? 'was' : 'were'} on at the same time.`;
      }
      const type = sim.select(g.target)[0]?.type ?? selectorType(g.target, sim.level) ?? '';
      return st.held > 0
        ? `${cap(describeSelector(g.target, sim))} switched on but didn’t stay on long enough.`
        : `${cap(describeSelector(g.target, sim))} ${DID[type]?.[0] ?? 'never switched on'}.`;
    }
    case 'contact':
      return `${cap(describeSelector(g.a, sim))} never touched ${describeSelector(g.b, sim)}.`;
    case 'containerCount': {
      const c = sim.entities.get(g.container);
      const n = containerTotal(sim, c, g.filter);
      if (!c || n === null) return 'The container didn’t make it.';
      if (c.def.tally) return n === 0 ? 'Nothing went through the hoop.' : `Only ${n} of the ${g.count} baskets went in.`;
      if (n === 0) return `The ${c.def.name.toLowerCase()} is still empty.`;
      return `The ${c.def.name.toLowerCase()} holds ${n} of the ${g.count} needed.`;
    }
    case 'destroyed': {
      const left = sim.select(g.target).length;
      return `${left} ${left === 1 ? 'target is' : 'targets are'} still standing.`;
    }
  }
};

/** A short in-room tag for one goal: where to draw it and what it says right now. */
export interface GoalMarker {
  /** World point the tag sits on (its bottom centre), or null when the target is gone. */
  at: Vec | null;
  text: string;
  /** Live progress, e.g. "2/3" for a container or "1.4/3s" for a hold, when it applies. */
  detail?: string;
}

const topOf = (e: Entity | undefined): Vec | null => {
  if (!e?.alive || !e.body) return null;
  let minY = Infinity;
  for (const b of e.bodies) minY = Math.min(minY, b.bounds.min.y);
  return { x: e.body.position.x, y: minY - 6 };
};

const secs = (held: number, need: number) => `${Math.min(held, need).toFixed(1)}/${need}s`;

/** Authored goal labels short enough to sit on an in-room tag are used as they are. */
const TAG_LABEL_MAX = 34;

export const goalMarker = (g: GoalDef, sim: Simulation, st?: GoalStatus): GoalMarker => {
  const m = rawMarker(g, sim, st);
  return g.label && g.label.length <= TAG_LABEL_MAX ? { ...m, text: g.label } : m;
};

const rawMarker = (g: GoalDef, sim: Simulation, st?: GoalStatus): GoalMarker => {
  const first = (sel: Selector) => sim.select(sel).find((e) => e.alive && e.body);
  switch (g.kind) {
    case 'enterRegion': {
      const hold = g.hold ?? 0.25;
      return {
        at: { x: g.region.x + g.region.w / 2, y: g.region.y - 4 },
        text: `${cap(describeSelector(g.target, sim))} here`,
        detail: hold >= 1 && st ? secs(st.held, hold) : undefined,
      };
    }
    case 'containerCount': {
      const c = sim.entities.get(g.container);
      const n = containerTotal(sim, c, g.filter) ?? 0;
      const shown = `${st?.met ? g.count : Math.min(n, g.count)}/${g.count}`;
      const noun = containerNoun(c?.type ?? null);
      if (noun) return { at: topOf(c), text: g.filter ? `Sink ${describeSelector(g.filter, sim).replace(/^an? /, '')}${'type' in g.filter && g.count > 1 ? 's' : ''}` : 'Sink it here', detail: `${shown} ${noun}` };
      return { at: topOf(c), text: g.filter ? `Fill with ${describeSelector(g.filter, sim).replace(/^an? /, '')}${'type' in g.filter && g.count > 1 ? 's' : ''}` : 'Fill this', detail: shown };
    }
    case 'height': {
      const e = first(g.target);
      const x = e?.body ? Math.min(sim.bounds.w - 80, Math.max(80, e.body.position.x)) : sim.bounds.w / 2;
      return { at: { x, y: g.maxY - 4 }, text: `Lift ${describeSelector(g.target, sim)} above this line` };
    }
    case 'activate': {
      const need = g.count ?? 1;
      const type = (('id' in g.target ? sim.entities.get(g.target.id)?.type : null) ?? selectorType(g.target, sim.level));
      const words = ACTIVATE_WORDS[type ?? ''];
      if (need > 1) {
        const all = sim.select(g.target).filter((e) => e.body);
        const on = all.filter((e) => e.isActive()).length;
        const tops = all.map(topOf).filter((p): p is Vec => !!p);
        const at = tops.length ? { x: tops.reduce((a, p) => a + p.x, 0) / tops.length, y: Math.min(...tops.map((p) => p.y)) } : null;
        return {
          at,
          text: g.duration ? `Keep ${need} on` : words ? words[1](need) : `Switch ${need} on`,
          detail: g.duration && st && st.held > 0 ? secs(st.held, g.duration) : `${st?.met ? need : Math.min(on, need)}/${need}${COUNT_NOUN[type ?? ''] ? ` ${COUNT_NOUN[type ?? '']}` : ''}`,
        };
      }
      const e = first(g.target);
      return {
        at: topOf(e),
        text: g.duration ? `Keep ${describeSelector(g.target, sim)} on` : words ? words[0] : `Switch ${describeSelector(g.target, sim)} on`,
        detail: g.duration && st ? secs(st.held, g.duration) : undefined,
      };
    }
    case 'destroyed':
      return { at: topOf(first(g.target)), text: `Get rid of ${describeSelector(g.target, sim)}` };
    case 'contact': {
      const a = topOf(first(g.a));
      const b = topOf(first(g.b));
      return { at: a && b ? { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) } : a ?? b, text: 'Make these touch' };
    }
  }
};
