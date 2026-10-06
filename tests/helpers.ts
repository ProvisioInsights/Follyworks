import '../src/components';
import { blankLevel } from '../src/core/level';
import type { BuildDef, ConnectionDef, GoalDef, LevelDef, ObjectDef } from '../src/core/types';
import { Simulation } from '../src/sim/Simulation';

let n = 0;
export const obj = (type: string, x: number, y: number, props: Record<string, any> = {}, extra: Partial<ObjectDef> = {}): ObjectDef => ({
  id: extra.id ?? `${type}${++n}`,
  type,
  x,
  y,
  angle: extra.angle ?? 0,
  flip: extra.flip,
  props,
});

export const wire = (from: ObjectDef, fromPort: string, to: ObjectDef, toPort: string): ConnectionDef => ({
  id: `w${++n}`,
  kind: 'wire',
  from: { obj: from.id, port: fromPort },
  to: { obj: to.id, port: toPort },
});
export const rope = (from: ObjectDef, fromPort: string, to: ObjectDef, toPort: string, via: ObjectDef[] = [], props = {}): ConnectionDef => ({
  id: `r${++n}`,
  kind: 'rope',
  from: { obj: from.id, port: fromPort },
  to: { obj: to.id, port: toPort },
  via: via.map((v) => v.id),
  props,
});
export const belt = (a: ObjectDef, b: ObjectDef): ConnectionDef => ({
  id: `b${++n}`,
  kind: 'belt',
  from: { obj: a.id, port: 'rotor' },
  to: { obj: b.id, port: 'rotor' },
});

export const level = (objects: ObjectDef[], connections: ConnectionDef[] = [], goals: GoalDef[] = []): LevelDef => {
  const l = blankLevel('test');
  l.startingObjects = objects;
  l.connections = connections;
  l.goals = goals;
  return l;
};

export const sim = (objects: ObjectDef[], connections: ConnectionDef[] = [], goals: GoalDef[] = [], build?: BuildDef) =>
  new Simulation(level(objects, connections, goals), build ?? { objects: [], connections: [] });

export const run = (s: Simulation, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) s.step();
  return s;
};
