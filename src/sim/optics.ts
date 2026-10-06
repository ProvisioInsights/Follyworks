// Light beams: a deterministic per-tick raycast from every firing laser through mirrors, beam
// splitters, prisms, colour filters and lenses. Pure geometry on the Matter bodies' current
// vertices; no Phaser. Beams are a pure function of body poses plus entity inputs/state, so rewind
// simply recomputes them after restoring a snapshot (see Simulation.restore).
//
// Side effects (only when `live`): optical parts and lasers log their first chain-reaction stage,
// light sensors latch `state.lit`, anything with an onHeat hook warms up while a beam rests on it
// (and is heated once it has had enough), and ropes the beam crosses smoulder and snap.

import type { Vec } from '../core/types';
import type { Entity } from './Entity';
import { M, type MBody } from './matter';
import type { Simulation } from './Simulation';

/** Colour as an RGB bitmask: red 1, green 2, blue 4, white 7. */
export type BeamColor = number;
export const COLOR_BITS: Record<string, BeamColor> = { red: 1, green: 2, blue: 4, white: 7 };
export const colorBits = (name: string): BeamColor => COLOR_BITS[name] ?? 7;
export const colorName = (c: BeamColor): string =>
  c === 1 ? 'red' : c === 2 ? 'green' : c === 4 ? 'blue' : c === 7 ? 'white' : c === 3 ? 'yellow' : c === 5 ? 'magenta' : c === 6 ? 'cyan' : 'white';

export type OpticKind = 'laser' | 'mirror' | 'splitter' | 'prism' | 'filter' | 'lens' | 'sensor';

export interface BeamSeg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: BeamColor;
  /** 1 = straight from a laser; halves at a splitter, divides at a prism. */
  intensity: number;
  /** Ends on a surface that stopped it (draw a hit sparkle there). */
  stopped: boolean;
  /** Travelling inside glass (prism interior). */
  inside?: boolean;
}

/** Prism deviation per colour, radians, always bent toward the prism's base. */
export const PRISM_BEND: Record<number, number> = { 1: (15 * Math.PI) / 180, 2: (22.5 * Math.PI) / 180, 4: (30 * Math.PI) / 180 };
/** Seconds a full-strength beam must rest on something before it counts as heated (weaker beams take longer). */
export const HEAT_TIME = 0.25;
/** Hard caps so a hall of mirrors (or two splitters facing each other) stays cheap and finite. */
export const MAX_SEGMENTS = 160;
export const MAX_DEPTH = 32;
const MIN_INTENSITY = 0.04;
const REACH = 4000;
const EPS = 1e-6;

interface Ray {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: BeamColor;
  intensity: number;
  depth: number;
  ignore: MBody | null;
  laser: Entity;
}

interface Hit {
  t: number;
  x: number;
  y: number;
  /** Unit surface normal facing the incoming ray. */
  nx: number;
  ny: number;
  body: MBody;
}

/** Can this body interact with light? Mounted (back-wall) parts and sensor volumes are see-through. */
const opticOf = (b: MBody): OpticKind | null => (b.plugin?.optic as OpticKind | undefined) ?? null;
const blocksLight = (b: MBody) => !!opticOf(b) || (!b.isSensor && b.collisionFilter.mask !== 0);

/** Ray vs convex polygon (Matter vertices). Returns nearest entry with t > tMin. */
const rayPoly = (r: Ray, verts: { x: number; y: number }[], tMin: number): { t: number; nx: number; ny: number } | null => {
  let best: { t: number; nx: number; ny: number } | null = null;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const den = r.dx * ey - r.dy * ex;
    if (Math.abs(den) < EPS) continue;
    const qx = a.x - r.x;
    const qy = a.y - r.y;
    const t = (qx * ey - qy * ex) / den;
    const s = (qx * r.dy - qy * r.dx) / den;
    if (t <= tMin || s < -EPS || s > 1 + EPS) continue;
    if (best && t >= best.t) continue;
    const l = Math.hypot(ex, ey) || 1;
    let nx = -ey / l;
    let ny = ex / l;
    if (nx * r.dx + ny * r.dy > 0) {
      nx = -nx;
      ny = -ny;
    }
    best = { t, nx, ny };
  }
  return best;
};

/** Slab test so most bodies are rejected before the edge loop. */
const rayBox = (r: Ray, b: { min: Vec; max: Vec }, tMax: number): boolean => {
  let t0 = 0;
  let t1 = tMax;
  for (const [o, d, lo, hi] of [
    [r.x, r.dx, b.min.x, b.max.x],
    [r.y, r.dy, b.min.y, b.max.y],
  ] as const) {
    if (Math.abs(d) < EPS) {
      if (o < lo || o > hi) return false;
      continue;
    }
    let ta = (lo - o) / d;
    let tb = (hi - o) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
};

const castRay = (r: Ray, bodies: MBody[], tMax: number): Hit | null => {
  let best: Hit | null = null;
  for (const body of bodies) {
    if (body === r.ignore) continue;
    const limit = best ? best.t : tMax;
    if (!rayBox(r, body.bounds, limit)) continue;
    const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
    for (const p of parts) {
      const h = rayPoly(r, p.vertices, 1e-4);
      if (h && h.t < (best ? best.t : tMax)) best = { t: h.t, x: r.x + r.dx * h.t, y: r.y + r.dy * h.t, nx: h.nx, ny: h.ny, body };
    }
  }
  return best;
};

/** Distance along the ray to the edge of the world (the room has no ceiling, so beams leave the top). */
const worldExit = (sim: Simulation, r: Ray): number => {
  const pad = 40;
  const { w, h } = sim.bounds;
  let t = REACH;
  if (r.dx > EPS) t = Math.min(t, (w + pad - r.x) / r.dx);
  if (r.dx < -EPS) t = Math.min(t, (-pad - r.x) / r.dx);
  if (r.dy > EPS) t = Math.min(t, (h + pad - r.y) / r.dy);
  if (r.dy < -EPS) t = Math.min(t, (-pad - r.y) / r.dy);
  return Math.max(0, t);
};

const rot = (x: number, y: number, a: number): Vec => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
};

/** Body-local unit axes (the authored frame, which for static optics never changes). */
const axis = (e: Entity, b: MBody, lx: number, ly: number): Vec => rot(e.flip ? -lx : lx, ly, b.angle - ((b as any).__refAngle ?? 0) + e.angle);

/** Is the hit on one of the part's broad faces (rather than a thin end cap)? */
const onFace = (h: Hit, faceAxis: Vec): boolean => Math.abs(h.nx * faceAxis.x + h.ny * faceAxis.y) > 0.8;

/** Does this laser fire this tick? */
export const laserFiring = (e: Entity) => e.alive && (e.props.alwaysOn === true || !!e.inputs.in);

/**
 * Trace every beam. With `live` false this is a pure query (rewind display, build-mode preview);
 * with `live` true it also applies the beams' effects to the world for this tick.
 */
export const traceBeams = (sim: Simulation, live: boolean, primeSensors = false): BeamSeg[] => {
  const beams: BeamSeg[] = [];
  const lasers = sim.list.filter((e) => e.type === 'laser' && e.alive);
  const sensorsLit = new Map<Entity, BeamColor[]>();
  const heated = new Map<Entity, number>();
  const struck = new Set<Entity>();
  if (lasers.length) {
    const bodies = (M.Composite.allBodies(sim.world) as MBody[]).filter(blocksLight);
    const queue: Ray[] = [];
    for (const L of lasers) {
      const firing = laserFiring(L);
      if (live) {
        if (firing && !L.state.firing) {
          sim.emit({ t: 'sfx', name: 'zap', x: L.x, y: L.y, vol: 0.45 });
          sim.activate(L, 'Laser fired');
        }
        L.state.firing = firing;
      }
      if (!firing) continue;
      const o = L.bodyPoint({ x: 31, y: 0 });
      const d = axis(L, L.body, 1, 0);
      queue.push({ x: o.x, y: o.y, dx: d.x, dy: d.y, color: colorBits(L.str('color')), intensity: 1, depth: 0, ignore: L.body, laser: L });
    }
    while (queue.length && beams.length < MAX_SEGMENTS) {
      const r = queue.shift()!;
      const tMax = worldExit(sim, r);
      const hit = castRay(r, bodies, tMax);
      if (!hit) {
        beams.push({ x1: r.x, y1: r.y, x2: r.x + r.dx * tMax, y2: r.y + r.dy * tMax, color: r.color, intensity: r.intensity, stopped: false });
        continue;
      }
      const seg: BeamSeg = { x1: r.x, y1: r.y, x2: hit.x, y2: hit.y, color: r.color, intensity: r.intensity, stopped: true };
      beams.push(seg);
      const e = sim.ownerOf(hit.body);
      const kind = opticOf(hit.body);
      const next = (dx: number, dy: number, color: BeamColor, intensity: number, from: Vec = hit): void => {
        if (r.depth + 1 > MAX_DEPTH || intensity < MIN_INTENSITY || !color) return;
        const l = Math.hypot(dx, dy) || 1;
        queue.push({ x: from.x, y: from.y, dx: dx / l, dy: dy / l, color, intensity, depth: r.depth + 1, ignore: hit.body, laser: r.laser });
      };
      if (e && kind && kind !== 'sensor' && kind !== 'laser') struck.add(e);
      switch (e ? kind : null) {
        case 'mirror': {
          if (!onFace(hit, axis(e!, hit.body, 0, 1))) break;
          seg.stopped = false;
          const k = 2 * (r.dx * hit.nx + r.dy * hit.ny);
          next(r.dx - k * hit.nx, r.dy - k * hit.ny, r.color, r.intensity * 0.96);
          continue;
        }
        case 'splitter': {
          if (!onFace(hit, axis(e!, hit.body, 0, 1))) break;
          seg.stopped = false;
          const k = 2 * (r.dx * hit.nx + r.dy * hit.ny);
          next(r.dx, r.dy, r.color, r.intensity * 0.5);
          next(r.dx - k * hit.nx, r.dy - k * hit.ny, r.color, r.intensity * 0.5);
          continue;
        }
        case 'filter': {
          if (!onFace(hit, axis(e!, hit.body, 1, 0))) break;
          const pass = r.color & colorBits(e!.str('color'));
          if (!pass) break;
          seg.stopped = false;
          next(r.dx, r.dy, pass, r.intensity * 0.9);
          continue;
        }
        case 'lens': {
          const ax = axis(e!, hit.body, 1, 0);
          if (!onFace(hit, ax)) break;
          seg.stopped = false;
          // Ideal thin lens: every ray through the lens meets the ray through the centre on the
          // focal plane, F' = C + f·d/(d·n), with n the optical axis on the outgoing side.
          const dn = r.dx * ax.x + r.dy * ax.y;
          const sgn = dn >= 0 ? 1 : -1;
          const nx = ax.x * sgn;
          const ny = ax.y * sgn;
          const cos = r.dx * nx + r.dy * ny;
          const c = hit.body.position;
          if (cos < 0.05) {
            next(r.dx, r.dy, r.color, r.intensity);
            continue;
          }
          const f = e!.num('focal');
          const fx = c.x + (f * r.dx) / cos;
          const fy = c.y + (f * r.dy) / cos;
          // leave from the far face, on the lens plane's other side
          const half = 5;
          const ox = hit.x + nx * half * 2;
          const oy = hit.y + ny * half * 2;
          next(fx - ox, fy - oy, r.color, r.intensity * 0.95, { x: ox, y: oy });
          continue;
        }
        case 'prism': {
          // Walk through the glass to the far side, then fan out each colour, bent toward the base.
          const parts = hit.body.parts.length > 1 ? hit.body.parts.slice(1) : [hit.body];
          let exit: Vec | null = null;
          for (const p of parts) {
            const inner = { ...r, x: hit.x, y: hit.y };
            let far = 0;
            const vs = p.vertices;
            for (let i = 0; i < vs.length; i++) {
              const a = vs[i];
              const b = vs[(i + 1) % vs.length];
              const ex = b.x - a.x;
              const ey = b.y - a.y;
              const den = inner.dx * ey - inner.dy * ex;
              if (Math.abs(den) < EPS) continue;
              const qx = a.x - inner.x;
              const qy = a.y - inner.y;
              const t = (qx * ey - qy * ex) / den;
              const s = (qx * inner.dy - qy * inner.dx) / den;
              if (s >= -EPS && s <= 1 + EPS && t > far) far = t;
            }
            if (far > 0.5) exit = { x: hit.x + r.dx * far, y: hit.y + r.dy * far };
          }
          if (!exit) break;
          seg.stopped = false;
          beams.push({ x1: hit.x, y1: hit.y, x2: exit.x, y2: exit.y, color: r.color, intensity: r.intensity, stopped: false, inside: true });
          const base = axis(e!, hit.body, 0, 1);
          const cross = r.dx * base.y - r.dy * base.x;
          const sgn = cross >= 0 ? 1 : -1;
          const bits = [1, 2, 4].filter((b) => r.color & b);
          for (const b of bits) {
            const d = rot(r.dx, r.dy, sgn * PRISM_BEND[b]);
            next(d.x, d.y, b, (r.intensity * 0.95) / bits.length, exit);
          }
          continue;
        }
        case 'sensor': {
          const list = sensorsLit.get(e!) ?? [];
          list.push(r.color);
          sensorsLit.set(e!, list);
          break;
        }
        default:
          break;
      }
      // Stopped by an opaque thing: it warms up.
      if (e && e.def.onHeat) {
        heated.set(e, (heated.get(e) ?? 0) + r.intensity);
        if (live && sim.tick % 8 === 0) sim.emit({ t: 'fx', kind: 'sparks', x: hit.x, y: hit.y, dx: hit.nx, dy: hit.ny, scale: 0.5 });
      }
    }
  }
  if (primeSensors) {
    // Before the first tick: a sensor already in an always-on beam starts lit, so a NOT gate
    // behind it does not fire a spurious pulse at RUN.
    for (const e of sim.list) {
      if (e.type !== 'light_sensor') continue;
      const want = e.str('color');
      e.state.lit = (sensorsLit.get(e) ?? []).some((c) => want === 'any' || c === colorBits(want));
    }
  }
  if (!live) return beams;

  // ---- effects (live ticks only) ----
  for (const e of struck) {
    if (!e.activated) sim.activate(e, OPTIC_LABEL[e.type] ?? 'Beam bent', 'light');
  }
  for (const e of sim.list) {
    if (e.type === 'light_sensor') {
      const want = e.str('color');
      const seen = (sensorsLit.get(e) ?? []).some((c) => want === 'any' || c === colorBits(want));
      if (seen && !e.state.lit) sim.emit({ t: 'sfx', name: 'zap', x: e.x, y: e.y, vol: 0.4 });
      // A sensor that starts in the beam still counts as a stage the first tick it is lit.
      if (seen && !e.activated) sim.activate(e, 'Light sensor saw the beam');
      e.state.lit = seen;
    }
    const warm = heated.get(e);
    if (warm !== undefined && e.alive) {
      e.state.laserHeat = Math.min(HEAT_TIME * 2, (e.state.laserHeat ?? 0) + sim.dt * Math.min(1, warm));
      if (e.state.laserHeat >= HEAT_TIME) e.def.onHeat!(e, sim);
    } else if (e.state.laserHeat) {
      e.state.laserHeat = Math.max(0, e.state.laserHeat - sim.dt * 2);
    }
  }
  // Ropes the beam crosses smoulder (same 0.6 s as a candle flame) and snap.
  for (const rope of sim.ropes) {
    if (rope.broken) continue;
    const pts = rope.path();
    if (!pts) continue;
    let crossT: number | null = null;
    let total = 0;
    const lens: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      lens.push(l);
      total += l;
    }
    let along = 0;
    outer: for (let i = 1; i < pts.length; i++) {
      for (const s of beams) {
        const u = segCross(pts[i - 1], pts[i], s);
        if (u !== null) {
          crossT = total > 0 ? (along + lens[i - 1] * u) / total : 0;
          break outer;
        }
      }
      along += lens[i - 1];
    }
    if (crossT === null) continue;
    rope.burn += sim.dt / 0.6;
    if (sim.tick % 8 === 0) {
      const p = pointOnPath(pts, crossT);
      sim.emit({ t: 'fx', kind: 'smoke', x: p.x, y: p.y, scale: 0.5 });
    }
    if (rope.burn >= 1) sim.breakRope(rope, crossT, 'Laser cut the rope');
  }
  return beams;
};

const pointOnPath = (pts: Vec[], t: number): Vec => {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let left = total * t;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (left <= l || i === pts.length - 1) {
      const u = l > 0 ? Math.min(1, left / l) : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u };
    }
    left -= l;
  }
  return pts[0];
};

/** Parameter u along a→b where it crosses beam segment s, or null. */
const segCross = (a: Vec, b: Vec, s: BeamSeg): number | null => {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = s.x2 - s.x1;
  const sy = s.y2 - s.y1;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < EPS) return null;
  const qx = s.x1 - a.x;
  const qy = s.y1 - a.y;
  const u = (qx * sy - qy * sx) / den;
  const v = (qx * ry - qy * rx) / den;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? u : null;
};

const OPTIC_LABEL: Record<string, string> = {
  mirror: 'Beam bounced off the mirror',
  beam_splitter: 'Beam split in two',
  prism: 'Prism made a rainbow',
  color_filter: 'Filter tinted the beam',
  lens: 'Lens focused the beam',
};
