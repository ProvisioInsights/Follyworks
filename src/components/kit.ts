// Shared helpers for component definitions.
import type { Vec } from '../core/types';
import { rotate } from '../core/util';
import type { Entity } from '../sim/Entity';
import { CAT, M, type MBody } from '../sim/matter';
import type { Simulation } from '../sim/Simulation';

export const DEG = Math.PI / 180;

export interface BodyOpts {
  isStatic?: boolean;
  isSensor?: boolean;
  friction?: number;
  frictionStatic?: number;
  frictionAir?: number;
  restitution?: number;
  mass?: number;
  density?: number;
  chamfer?: number;
  label?: string;
  category?: number;
  mask?: number;
  group?: number;
  kinematic?: boolean;
  slop?: number;
  /** Use the true moment of inertia instead of Matter's 4x-inflated one (things that must topple or spin freely). */
  realInertia?: boolean;
  /** Wall-mounted: lives on the back wall, collides with nothing (sensors still sense). */
  mounted?: boolean;
}

const applyOpts = (sim: Simulation, b: MBody, o: BodyOpts) => {
  if (o.mounted) {
    b.collisionFilter.category = CAT.GHOST;
    b.collisionFilter.mask = 0;
  }
  if (o.category !== undefined) b.collisionFilter.category = o.category;
  if (o.mask !== undefined) b.collisionFilter.mask = o.mask;
  if (o.group !== undefined) b.collisionFilter.group = o.group;
  if (o.mass !== undefined && !b.isStatic) sim.setMass(b, o.mass);
  if (o.kinematic) b.plugin = { ...(b.plugin ?? {}), kinematic: true };
};

const matterOpts = (o: BodyOpts, angle: number) => ({
  isStatic: !!o.isStatic,
  isSensor: !!o.isSensor,
  friction: o.friction ?? 0.3,
  frictionStatic: o.frictionStatic ?? 0.6,
  frictionAir: o.frictionAir ?? 0.01,
  restitution: o.restitution ?? 0.1,
  density: o.density ?? 0.001,
  angle,
  label: o.label ?? 'part',
  slop: o.slop ?? 0.04,
  chamfer: o.chamfer ? { radius: o.chamfer } : undefined,
});

/** Rectangle centred at a local point of the entity frame. */
export const rect = (sim: Simulation, e: Entity, local: Vec, w: number, h: number, o: BodyOpts = {}, inWorld = true): MBody => {
  const p = sim.toWorld(e, local);
  const b = M.Bodies.rectangle(p.x, p.y, w, h, matterOpts(o, e.angle));
  applyOpts(sim, b, o);
  if (o.realInertia && !b.isStatic) M.Body.setInertia(b, (b.mass * (w * w + h * h)) / 12);
  return sim.addBody(e, b, local, inWorld);
};

export const circle = (sim: Simulation, e: Entity, local: Vec, r: number, o: BodyOpts = {}, inWorld = true): MBody => {
  const p = sim.toWorld(e, local);
  // Matter caps circle sides at the radius in px (a 14px ball becomes a 14-gon that thumps along and
  // loses most of its speed); build the polygon ourselves with enough sides to roll smoothly.
  const sides = Math.max(32, Math.min(48, Math.round(r * 2.4)));
  const b = M.Bodies.polygon(p.x, p.y, sides, r, { ...matterOpts(o, e.angle), circleRadius: r } as any);
  applyOpts(sim, b, o);
  // Matter inflates inertia 4x for stability; on a round body that means a thrown ball converts two
  // thirds of its speed into spin the moment it touches the floor. Use a real disc's inertia.
  if (!b.isStatic) M.Body.setInertia(b, 0.5 * b.mass * r * r);
  return sim.addBody(e, b, local, inWorld);
};

/** Convex polygon from local vertices (centroid becomes body centre). */
export const poly = (sim: Simulation, e: Entity, localVerts: Vec[], o: BodyOpts = {}): MBody => {
  const world = localVerts.map((v) => sim.toWorld(e, v));
  const cx = world.reduce((s, v) => s + v.x, 0) / world.length;
  const cy = world.reduce((s, v) => s + v.y, 0) / world.length;
  const b = M.Bodies.fromVertices(cx, cy, [world], matterOpts(o, 0));
  // fromVertices recentres on the true centroid; compute that centre in local space
  const local = sim.toLocal(e, b.position);
  applyOpts(sim, b, o);
  // Built from world-space vertices, so the body starts at angle 0; addBody records that as the
  // reference angle and bodyPoint() maps local points correctly.
  return sim.addBody(e, b, local);
};

/** Compound body from several local rectangles. */
export const compound = (
  sim: Simulation,
  e: Entity,
  parts: { x: number; y: number; w: number; h: number }[],
  o: BodyOpts = {},
): MBody => {
  const bodies = parts.map((p) => {
    const wp = sim.toWorld(e, p);
    return M.Bodies.rectangle(wp.x, wp.y, p.w, p.h, matterOpts({ ...o }, e.angle));
  });
  const body = M.Body.create({ parts: bodies, ...matterOpts(o, 0) });
  // The compound's position is its centre of mass, at angle 0 in world. Express it in local space.
  const local = sim.toLocal(e, body.position);
  applyOpts(sim, body, o);
  return sim.addBody(e, body, local);
};

/** Pin a body to a fixed world point (hinge). */
export const pinToWorld = (sim: Simulation, e: Entity, body: MBody, worldPoint: Vec, stiffness = 1) => {
  const c = M.Constraint.create({
    bodyA: body,
    pointA: { x: worldPoint.x - body.position.x, y: worldPoint.y - body.position.y },
    pointB: { x: worldPoint.x, y: worldPoint.y },
    length: 0,
    stiffness,
    damping: 0.1,
  });
  sim.addConstraint(e, c);
  return c;
};

/** Direction of a local vector in world space (flip aware). */
export const dirWorld = (e: Entity, lx: number, ly: number): Vec => rotate({ x: e.flip ? -lx : lx, y: ly }, e.angle);

/** World direction of a body-local axis that follows the body's rotation. */
export const bodyDir = (e: Entity, body: MBody, lx: number, ly: number): Vec => {
  const rot = body.angle - ((body as any).__refAngle ?? 0) + e.angle;
  return rotate({ x: e.flip ? -lx : lx, y: ly }, rot);
};

export const speedOf = (b: MBody) => Math.hypot(b.velocity.x, b.velocity.y);

/** Unique negative collision group per entity so its own parts never collide with each other. */
let groupCounter = 0;
export const ownGroup = () => -(++groupCounter % 100000) - 1;

export const GEAR_MASK = CAT.DEFAULT;
export { CAT };

/** Rising-edge helper on an input port. Call once per tick in step(). */
export const rose = (e: Entity, port: string): boolean => {
  const key = `__last_${port}`;
  const now = !!e.inputs[port];
  const was = !!e.state[key];
  e.state[key] = now;
  return now && !was;
};

/** True if any wire is connected into the given input port. */
export const wiredIn = (sim: Simulation, e: Entity, port: string) => sim.wires.some((w) => w.to === e && w.toPort === port);
