// Forgiving rope + pulley solver.
// A rope is a one-sided length constraint along a path A -> pulley... -> B. It only pulls,
// never pushes, and pulleys redirect the pull. Solved as velocity impulses plus a gentle
// positional correction each tick, which is far more stable than chains of tiny bodies.

import type { Vec } from '../core/types';
import type { Entity } from './Entity';
import { M, type MBody } from './matter';

export interface RopeEnd {
  e: Entity;
  anchor: string;
}

export class Rope {
  readonly id: string;
  a: RopeEnd;
  b: RopeEnd;
  via: Entity[];
  length: number;
  readonly restLength: number;
  broken = false;
  /** 0..1 burn progress when held in a flame. */
  burn = 0;
  /** Sum of impulses this tick (for pull sensing and visuals). */
  tension = 0;
  /** Where it broke, for drawing two dangling halves. */
  breakT = 0.5;

  constructor(id: string, a: RopeEnd, b: RopeEnd, via: Entity[], length: number) {
    this.id = id;
    this.a = a;
    this.b = b;
    this.via = via;
    this.length = length;
    this.restLength = length;
  }

  endWorld(end: RopeEnd): Vec | null {
    if (!end.e.alive) return null;
    return end.e.anchorWorld(end.anchor);
  }

  /** Full world path, including pulley wheel centres. */
  path(): Vec[] | null {
    const pa = this.endWorld(this.a);
    const pb = this.endWorld(this.b);
    if (!pa || !pb) return null;
    const pts: Vec[] = [pa];
    for (const p of this.via) {
      if (!p.alive) continue;
      const w = p.anchorWorld('wheel');
      if (w) pts.push(w);
    }
    pts.push(pb);
    return pts;
  }

  pathLength(pts: Vec[]): number {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return L;
  }

  serialize() {
    return [this.length, this.broken ? 1 : 0, this.burn, this.breakT];
  }
  deserialize(s: number[]) {
    this.length = s[0];
    this.broken = s[1] === 1;
    this.burn = s[2];
    this.breakT = s[3];
  }
}

const cross = (r: Vec, v: Vec) => r.x * v.y - r.y * v.x;

interface EndSolve {
  body: MBody | null;
  r: Vec;
  u: Vec;
  k: number;
}

const endBody = (end: RopeEnd): MBody | null => {
  const anchor = end.e.anchors.find((a) => a.id === end.anchor);
  let b = end.e.bodies[anchor?.body ?? 0];
  if (!b) return null;
  b = b.parent ?? b;
  if (b.isStatic) return null;
  return b;
};

const prepare = (body: MBody | null, p: Vec, toward: Vec): EndSolve => {
  let ux = p.x - toward.x;
  let uy = p.y - toward.y;
  const l = Math.hypot(ux, uy) || 1;
  ux /= l;
  uy /= l;
  const u = { x: ux, y: uy };
  if (!body) return { body: null, r: { x: 0, y: 0 }, u, k: 0 };
  const r = { x: p.x - body.position.x, y: p.y - body.position.y };
  const rc = cross(r, u);
  return { body, r, u, k: body.inverseMass + body.inverseInertia * rc * rc };
};

const pointVel = (s: EndSolve): Vec => {
  if (!s.body) return { x: 0, y: 0 };
  const w = s.body.angularVelocity;
  return { x: s.body.velocity.x - w * s.r.y, y: s.body.velocity.y + w * s.r.x };
};

const applyImpulse = (s: EndSolve, jx: number, jy: number) => {
  if (!s.body) return;
  const b = s.body;
  M.Body.setVelocity(b, { x: b.velocity.x + jx * b.inverseMass, y: b.velocity.y + jy * b.inverseMass });
  M.Body.setAngularVelocity(b, b.angularVelocity + cross(s.r, { x: jx, y: jy }) * b.inverseInertia);
};

const applyCorrection = (s: EndSolve, lambda: number) => {
  if (!s.body) return;
  const b = s.body;
  const dx = -s.u.x * lambda * b.inverseMass;
  const dy = -s.u.y * lambda * b.inverseMass;
  M.Body.setPosition(b, { x: b.position.x + dx, y: b.position.y + dy }, false);
  const dθ = -cross(s.r, s.u) * lambda * b.inverseInertia;
  if (dθ !== 0) M.Body.setAngle(b, b.angle + dθ, false);
};

/** Solve every rope once. Call a few times per tick. Returns nothing; updates rope.tension. */
export const solveRopes = (ropes: Rope[], iteration: number) => {
  for (const rope of ropes) {
    if (rope.broken) continue;
    const pts = rope.path();
    if (!pts) continue;
    const total = rope.pathLength(pts);
    const C = total - rope.length;
    if (C <= 0) continue;
    const pa = pts[0];
    const pb = pts[pts.length - 1];
    const sa = prepare(endBody(rope.a), pa, pts[1]);
    const sb = prepare(endBody(rope.b), pb, pts[pts.length - 2]);
    const k = sa.k + sb.k;
    if (k <= 1e-9) continue;
    // Velocity: remove separating speed along the rope.
    const va = pointVel(sa);
    const vb = pointVel(sb);
    const cdot = va.x * sa.u.x + va.y * sa.u.y + vb.x * sb.u.x + vb.y * sb.u.y;
    if (cdot > 0) {
      const lambda = -cdot / k;
      applyImpulse(sa, lambda * sa.u.x, lambda * sa.u.y);
      applyImpulse(sb, lambda * sb.u.x, lambda * sb.u.y);
      if (iteration === 0) rope.tension += -lambda;
      else rope.tension += -lambda * 0.25;
    }
    // Position: soft correction of the overshoot, capped so big errors heal over several ticks.
    const corr = Math.min(C, 6) * 0.35;
    const lp = corr / k;
    applyCorrection(sa, lp);
    applyCorrection(sb, lp);
  }
};

/** Distance from a point to the rope path (for flame/blast hit tests). */
export const ropeHit = (rope: Rope, p: Vec, radius: number): number | null => {
  const pts = rope.path();
  if (!pts || rope.broken) return null;
  let acc = 0;
  const total = rope.pathLength(pts);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    const segLen = Math.sqrt(l2);
    if (d <= radius) return total > 0 ? (acc + t * segLen) / total : 0.5;
    acc += segLen;
  }
  return null;
};
