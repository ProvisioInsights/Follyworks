// Placement validation: does a candidate object overlap anything solid, or leave the world?
// Uses real Matter geometry from a throwaway mini-simulation so the rule is exactly "what you
// see is what collides".

import { blankLevel } from '../core/level';
import type { BuildDef, LevelDef, ObjectDef } from '../core/types';
import { M, type MBody } from '../sim/matter';
import { Simulation } from '../sim/Simulation';

const OVERLAP_DEPTH = 1.5;

const partsOf = (b: MBody): MBody[] => (b.parts.length > 1 ? b.parts.slice(1) : b.parts);

/**
 * A gear has to sit snug against a motor or other drive wheel to mesh, so its teeth may overlap
 * the housing of anything that has a rotor (both are fixed axles, nothing gets pushed).
 */
const meshAllowed = (sa: Simulation, a: MBody, sb: Simulation, b: MBody) => {
  const ea = sa.ownerOf(a);
  const eb = sb.ownerOf(b);
  if (!ea || !eb) return false;
  const gear = (e: typeof ea) => e.def.type === 'gear';
  const rotor = (e: typeof ea) => !!e.def.rotor && !e.def.dynamic;
  return (gear(ea) && rotor(eb)) || (gear(eb) && rotor(ea));
};

/**
 * Returns the ids (from `objs`) that overlap something in `host` (ignoring `ignore` ids) or
 * fall outside the world. Empty array = valid.
 */
export const invalidPlacements = (host: Simulation, objs: ObjectDef[], ignore: Set<string>): string[] => {
  if (!objs.length) return [];
  const lvl = blankLevel('probe');
  lvl.world = { ...host.level.world };
  let probe: Simulation;
  try {
    probe = new Simulation(lvl, { objects: objs, connections: [] });
  } catch {
    return objs.map((o) => o.id);
  }
  const bad = new Set<string>();
  const hostBodies = (M.Composite.allBodies(host.world) as MBody[]).filter((b) => {
    const owner = host.ownerOf(b);
    return !(owner && ignore.has(owner.id));
  });
  const { w, h } = host.bounds;
  for (const o of objs) {
    const e = probe.entities.get(o.id);
    if (!e) {
      bad.add(o.id);
      continue;
    }
    for (const body of e.bodies) {
      const bb = body.bounds;
      if (bb.min.x < -2 || bb.max.x > w + 2 || bb.max.y > h + 2 || bb.min.y < -120) bad.add(o.id);
      if (bad.has(o.id)) break;
      for (const pa of partsOf(body)) {
        if (pa.isSensor) continue;
        for (const hb of hostBodies) {
          if (hb.isSensor) continue;
          if (!M.Detector.canCollide(pa.collisionFilter, hb.collisionFilter)) continue;
          if (!M.Bounds.overlaps(pa.bounds, hb.bounds)) continue;
          for (const pb of partsOf(hb)) {
            if (pb.isSensor || !M.Bounds.overlaps(pa.bounds, pb.bounds)) continue;
            if (meshAllowed(probe, pa, host, pb)) continue;
            const col = M.Collision.collides(pa, pb);
            if (col && col.collided !== false && col.depth > OVERLAP_DEPTH) {
              bad.add(o.id);
              break;
            }
          }
          if (bad.has(o.id)) break;
        }
        if (bad.has(o.id)) break;
      }
    }
  }
  // objects placed together must not overlap each other either
  const list = objs.map((o) => probe.entities.get(o.id)).filter(Boolean);
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      outer: for (const ba of a.bodies)
        for (const pa of partsOf(ba))
          for (const bb of b.bodies)
            for (const pb of partsOf(bb)) {
              if (pa.isSensor || pb.isSensor || !M.Detector.canCollide(pa.collisionFilter, pb.collisionFilter)) continue;
              if (!M.Bounds.overlaps(pa.bounds, pb.bounds)) continue;
              if (meshAllowed(probe, pa, probe, pb)) continue;
              const col = M.Collision.collides(pa, pb);
              if (col && col.collided !== false && col.depth > OVERLAP_DEPTH) {
                bad.add(a.id);
                bad.add(b.id);
                break outer;
              }
            }
    }
  return [...bad];
};

/** Level + build with extra objects appended where the session would put them. */
export const withExtras = (level: LevelDef, build: BuildDef, extras: ObjectDef[], editsLevel: boolean, sceneryOf: (o: ObjectDef) => boolean) => {
  if (!extras.length) return { level, build };
  if (editsLevel) {
    return {
      level: {
        ...level,
        fixedObjects: [...level.fixedObjects, ...extras.filter(sceneryOf)],
        startingObjects: [...level.startingObjects, ...extras.filter((o) => !sceneryOf(o))],
      },
      build,
    };
  }
  return { level, build: { ...build, objects: [...build.objects, ...extras] } };
};
