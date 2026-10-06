// Kinematic rotation network. Motors (and anything else with rotorSource) drive their rotor;
// toothed rotors mesh with neighbours automatically (opposite direction, ratio r1/r2) and belts
// link any two rotors (same direction). No CAD-precise meshing: close enough is close enough.
// Conflicting drives jam the whole connected group, which is readable and a little funny.

import type { Entity } from './Entity';
import type { Simulation } from './Simulation';

export interface Belt {
  id: string;
  a: Entity;
  b: Entity;
}

/** Centre distance tolerance for meshing, in world units. */
export const MESH_TOLERANCE = 9;

interface Edge {
  to: Entity;
  ratio: number; // omega_to = omega_from * ratio
}

export const meshes = (a: Entity, b: Entity): boolean => {
  if (!a.rotor || !b.rotor || !a.rotor.teeth || !b.rotor.teeth) return false;
  const pa = a.rotorWorld();
  const pb = b.rotorWorld();
  if (!pa || !pb) return false;
  const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
  return Math.abs(d - (a.rotor.r + b.rotor.r)) <= MESH_TOLERANCE;
};

export const buildRotorGraph = (sim: Simulation): Map<Entity, Edge[]> => {
  const rotors = sim.list.filter((e) => e.alive && e.rotor);
  const graph = new Map<Entity, Edge[]>();
  for (const r of rotors) graph.set(r, []);
  for (let i = 0; i < rotors.length; i++) {
    for (let j = i + 1; j < rotors.length; j++) {
      const a = rotors[i];
      const b = rotors[j];
      if (meshes(a, b)) {
        graph.get(a)!.push({ to: b, ratio: -a.rotor!.r / b.rotor!.r });
        graph.get(b)!.push({ to: a, ratio: -b.rotor!.r / a.rotor!.r });
      }
    }
  }
  for (const belt of sim.belts) {
    if (!belt.a.alive || !belt.b.alive || !belt.a.rotor || !belt.b.rotor) continue;
    graph.get(belt.a)?.push({ to: belt.b, ratio: belt.a.rotor.r / belt.b.rotor.r });
    graph.get(belt.b)?.push({ to: belt.a, ratio: belt.b.rotor.r / belt.a.rotor.r });
  }
  return graph;
};

export const solveRotation = (sim: Simulation) => {
  const graph = buildRotorGraph(sim);
  const omega = new Map<Entity, number>();
  const jammedGroups = new Set<Entity>();
  const sources: [Entity, number][] = [];
  for (const e of graph.keys()) {
    const src = e.def.rotorSource?.(e, sim);
    if (src !== null && src !== undefined) sources.push([e, src]);
  }
  for (const [src, w0] of sources) {
    const existing = omega.get(src);
    if (existing !== undefined && Math.abs(existing - w0) > 1e-4 + Math.abs(w0) * 0.05) {
      markGroup(src, graph, jammedGroups);
      continue;
    }
    // BFS
    const queue: Entity[] = [src];
    omega.set(src, w0);
    while (queue.length) {
      const cur = queue.shift()!;
      const wc = omega.get(cur)!;
      for (const edge of graph.get(cur) ?? []) {
        const want = wc * edge.ratio;
        const have = omega.get(edge.to);
        if (have === undefined) {
          omega.set(edge.to, want);
          queue.push(edge.to);
        } else if (Math.abs(have - want) > 1e-4 + Math.abs(want) * 0.05) {
          markGroup(cur, graph, jammedGroups);
        }
      }
    }
  }
  for (const e of graph.keys()) {
    const jam = jammedGroups.has(e);
    const w = jam ? 0 : omega.get(e);
    const prevJam = e.jammed;
    e.jammed = jam;
    e.omega = w === undefined ? null : w;
    if (jam && !prevJam) sim.emit({ t: 'fx', kind: 'sparks', x: e.rotorWorld()!.x, y: e.rotorWorld()!.y });
    e.def.onRotor?.(e, e.omega, jam, sim);
  }
};

const markGroup = (start: Entity, graph: Map<Entity, Edge[]>, out: Set<Entity>) => {
  const stack = [start];
  while (stack.length) {
    const e = stack.pop()!;
    if (out.has(e)) continue;
    out.add(e);
    for (const ed of graph.get(e) ?? []) stack.push(ed.to);
  }
};
