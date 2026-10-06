// Procedural overlays drawn every frame: ropes (with pulley wraps and sag), belts, wires,
// connection sockets, goal zones, selection outlines, ghost trails and debug force arrows.

import Phaser from 'phaser';
import type { GoalDef, Vec } from '../core/types';
import type { Entity } from '../sim/Entity';
import { matches } from '../sim/goals';
import type { Simulation } from '../sim/Simulation';
import type { Rope } from '../sim/ropes';
import type { BeamSeg } from '../sim/optics';

export type ToolKind = 'rope' | 'belt' | 'wire';

export interface PendingConnection {
  kind: ToolKind;
  /** Points already fixed (start anchor/port/rotor plus pulley wheels). */
  points: Vec[];
  cursor: Vec;
  /** For wires: the direction of the starting port, so we can highlight compatible ones. */
  portDir?: 'in' | 'out';
}

export interface OverlayState {
  sim: Simulation;
  mode: 'build' | 'run';
  t: number;
  alpha: number;
  selected: Set<string>;
  hover: string | null;
  selectedConn: string | null;
  hoverConn: string | null;
  invalid: Set<string>;
  tool: ToolKind | null;
  pending: PendingConnection | null;
  /** Highlighted connection target under the cursor while a tool is active. */
  toolHover: Vec | null;
  showForces: boolean;
  trails: Vec[][];
  offsetOf: (e: Entity) => Vec;
  /** Goal statuses (run mode) for colouring zones. */
  goalMet: boolean[];
  editor: boolean;
  /** Level editor only: currently selected goal index for region handles. */
  selectedGoal: number | null;
  /** Tutorial guidance: outlines of where a part could go, and a spot to point at. */
  guide?: { ghosts: Entity[]; point: Vec | null } | null;
}

const ROPE = 0xc9a46a;
const ROPE_DARK = 0x3a2a18;
const BELT = 0x26201c;
const WIRE_DEAD = 0x4a1e1a;
const WIRE_LIVE = 0xffb54a;
const PORT_OUT = 0xff9a3c;
const PORT_IN = 0x4fdcf5;
const GOAL = 0x7cf0a0;
/** Beam colours by RGB bitmask (see sim/optics.ts). */
const BEAM_RGB: Record<number, number> = { 1: 0xff3d35, 2: 0x3dff6e, 3: 0xffe23d, 4: 0x3d8cff, 5: 0xff4fe0, 6: 0x3df4ff, 7: 0xfff4e2 };

/** Interpolated world point of a local point on body `idx`. */
export const lerpPoint = (e: Entity, local: Vec, idx: number, alpha: number): Vec => {
  const b = e.bodies[idx] ?? e.bodies[0];
  if (!b) return e.bodyPoint(local, idx);
  const pv = (b as any).__prev as { x: number; y: number; a: number } | undefined;
  let bx = b.position.x;
  let by = b.position.y;
  let ba = b.angle;
  if (pv && alpha < 1) {
    bx = pv.x + (bx - pv.x) * alpha;
    by = pv.y + (by - pv.y) * alpha;
    ba = pv.a + (ba - pv.a) * alpha;
  }
  const off: Vec = (b as any).__refOffset ?? { x: 0, y: 0 };
  const lx = (e.flip ? -local.x : local.x) - off.x;
  const ly = local.y - off.y;
  const r = ba - ((b as any).__refAngle ?? 0) + e.angle;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: bx + lx * c - ly * s, y: by + lx * s + ly * c };
};

const norm = (v: Vec): Vec => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

export class Overlays {
  readonly under: Phaser.GameObjects.Graphics;
  readonly over: Phaser.GameObjects.Graphics;
  readonly top: Phaser.GameObjects.Graphics;
  private st!: OverlayState;
  private beltTravel = new Map<string, number>();
  /** Light beams: a dark contrast underlay, then an additive glow, core and hit sparkles. */
  private beamUnder: Phaser.GameObjects.Graphics;
  private beamGlow: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, underLayer: Phaser.GameObjects.Container, overLayer: Phaser.GameObjects.Container, topLayer: Phaser.GameObjects.Container) {
    this.under = scene.add.graphics();
    this.over = scene.add.graphics();
    this.top = scene.add.graphics();
    underLayer.add(this.under);
    overLayer.add(this.over);
    topLayer.add(this.top);
    this.beamUnder = scene.add.graphics();
    this.beamGlow = scene.add.graphics();
    this.beamGlow.setBlendMode(Phaser.BlendModes.ADD);
    overLayer.add(this.beamUnder);
    overLayer.add(this.beamGlow);
  }

  private pt(e: Entity, local: Vec, idx: number): Vec {
    const p = lerpPoint(e, local, idx, this.st.alpha);
    const o = this.st.offsetOf(e);
    return { x: p.x + o.x, y: p.y + o.y };
  }
  anchorPt(e: Entity, id: string): Vec | null {
    const a = e.anchors.find((q) => q.id === id);
    return a ? this.pt(e, a, a.body ?? 0) : null;
  }
  portPt(e: Entity, id: string): Vec | null {
    const p = e.ports.find((q) => q.id === id);
    return p ? this.pt(e, p, 0) : null;
  }
  rotorPt(e: Entity): Vec | null {
    return e.rotor ? this.pt(e, e.rotor, e.rotor.body ?? 0) : null;
  }

  draw(st: OverlayState) {
    this.st = st;
    const u = this.under;
    const o = this.over;
    const tp = this.top;
    u.clear();
    o.clear();
    tp.clear();
    const sim = st.sim;

    this.drawGoals(u, sim, st);
    if (st.trails.length && st.mode === 'build') {
      for (const tr of st.trails) {
        for (let i = 0; i < tr.length; i += 1) {
          u.fillStyle(0xfff2d8, 0.16 + 0.1 * (i / tr.length));
          u.fillCircle(tr[i].x, tr[i].y, 2);
        }
      }
    }
    for (const b of sim.belts) this.drawBelt(u, b.a, b.b, b.id);
    for (const r of sim.ropes) this.drawRope(o, r);
    for (const w of sim.wires) this.drawWire(o, w.from, w.fromPort, w.to, w.toPort, w.live, w.id);
    this.drawBeams(sim.beams ?? [], st);

    // sockets: in build mode always; in run mode only for powered sockets (subtle)
    for (const e of sim.list) {
      if (!e.alive) continue;
      for (const p of e.ports) {
        const pw = this.portPt(e, p.id)!;
        const wireTool = st.tool === 'wire';
        const compatible = wireTool && (!st.pending || st.pending.portDir !== p.dir);
        if (st.mode === 'run') continue;
        const col = p.dir === 'out' ? PORT_OUT : PORT_IN;
        const r = wireTool ? (compatible ? 8 : 4.5) : 6;
        // A cream outer ring keeps sockets visible on dark machinery and busy walls alike.
        tp.fillStyle(0xfff2d8, wireTool && !compatible ? 0.3 : 0.85);
        tp.fillCircle(pw.x, pw.y, r + 3.5);
        tp.fillStyle(0x120d0a, 0.95);
        tp.fillCircle(pw.x, pw.y, r + 2);
        tp.fillStyle(col, wireTool && !compatible ? 0.35 : 1);
        tp.fillCircle(pw.x, pw.y, r);
        tp.fillStyle(0x120d0a, 0.9);
        tp.fillCircle(pw.x, pw.y, r * 0.4);
        if (compatible) {
          tp.lineStyle(1.5, col, 0.5 + 0.4 * Math.sin(st.t * 6));
          tp.strokeCircle(pw.x, pw.y, r + 5);
        }
      }
      if (st.tool === 'rope' && st.mode === 'build') {
        for (const a of e.anchors) {
          const ap = this.anchorPt(e, a.id)!;
          const wheel = a.id === 'wheel';
          if (wheel && !st.pending) continue;
          tp.lineStyle(2, wheel ? 0xffe08a : 0xfff2d8, 0.85);
          tp.strokeCircle(ap.x, ap.y, wheel ? 22 : 7 + Math.sin(st.t * 5) * 1.5);
          tp.fillStyle(0xfff2d8, 0.9);
          if (!wheel) tp.fillCircle(ap.x, ap.y, 3);
        }
      }
      if (st.tool === 'belt' && st.mode === 'build' && e.rotor) {
        const rp = this.rotorPt(e)!;
        tp.lineStyle(2, 0xffc46a, 0.6 + 0.3 * Math.sin(st.t * 5));
        tp.strokeCircle(rp.x, rp.y, e.rotor.r + 6);
      }
    }
    if (st.toolHover) {
      tp.lineStyle(3, 0xffffff, 0.9);
      tp.strokeCircle(st.toolHover.x, st.toolHover.y, 12);
    }
    if (st.pending) this.drawPending(tp, st.pending);

    // selection / hover / invalid outlines
    for (const e of sim.list) {
      if (!e.alive) continue;
      const sel = st.selected.has(e.id);
      const bad = st.invalid.has(e.id);
      const hov = st.hover === e.id && !sel;
      if (!sel && !bad && !hov) continue;
      const col = bad ? 0xff5a4a : sel ? 0x6fe3ff : 0xfff2d8;
      const a = bad ? 0.95 : sel ? 0.95 : 0.45;
      this.outline(tp, e, col, a, sel ? 2 : 1.5);
    }
    if (st.showForces) this.drawForces(tp, sim);
    if (st.guide && st.mode === 'build') this.drawGuide(tp, st.guide, st.t);
  }

  private drawBeams(beams: BeamSeg[], st: OverlayState) {
    const u = this.beamUnder;
    const g = this.beamGlow;
    u.clear();
    g.clear();
    if (!beams.length) return;
    // Build-mode previews (always-on lasers) are drawn fainter than live beams.
    const k = st.mode === 'build' ? 0.6 : 1;
    const t = st.t;
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      const col = BEAM_RGB[b.color] ?? 0xffffff;
      const s = Math.max(0.3, Math.min(1, b.intensity)) * k;
      const shimmer = 0.88 + 0.12 * Math.sin(t * 41 + i * 1.7);
      if (b.inside) {
        g.lineStyle(3, col, 0.35 * s);
        g.lineBetween(b.x1, b.y1, b.x2, b.y2);
        continue;
      }
      u.lineStyle(7, 0x0b0806, 0.4 * s);
      u.lineBetween(b.x1, b.y1, b.x2, b.y2);
      g.lineStyle(24, col, 0.1 * s * shimmer);
      g.lineBetween(b.x1, b.y1, b.x2, b.y2);
      g.lineStyle(11, col, 0.3 * s * shimmer);
      g.lineBetween(b.x1, b.y1, b.x2, b.y2);
      g.lineStyle(4.5, col, 1 * s);
      g.lineBetween(b.x1, b.y1, b.x2, b.y2);
      g.lineStyle(1.4, 0xffffff, 0.7 * s);
      g.lineBetween(b.x1, b.y1, b.x2, b.y2);
      // Travelling sparkles along the beam so the light reads as moving.
      const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
      if (st.mode === 'run' && len > 30) {
        const step = 90;
        const off = (t * 420) % step;
        for (let d = off; d < len; d += step) {
          const f = d / len;
          g.fillStyle(0xffffff, 0.55 * s);
          g.fillCircle(b.x1 + (b.x2 - b.x1) * f, b.y1 + (b.y2 - b.y1) * f, 1.8);
        }
      }
      if (b.stopped) {
        const r = 6 + 2.5 * Math.sin(t * 30 + i);
        g.fillStyle(col, 0.3 * s);
        g.fillCircle(b.x2, b.y2, r + 10);
        g.fillStyle(col, 0.5 * s);
        g.fillCircle(b.x2, b.y2, r + 4);
        g.fillStyle(0xffffff, 0.9 * s);
        g.fillCircle(b.x2, b.y2, r * 0.55);
        g.lineStyle(1.4, col, 0.8 * s);
        for (let j = 0; j < 4; j++) {
          const a = t * 7 + j * (Math.PI / 2) + i;
          const l = 7 + 4 * Math.sin(t * 23 + j * 2 + i);
          g.lineBetween(b.x2, b.y2, b.x2 + Math.cos(a) * l, b.y2 + Math.sin(a) * l);
        }
      }
    }
  }

  /** A pulsing translucent silhouette of each ghost part, plus a beacon on the pointed spot. */
  private drawGuide(g: Phaser.GameObjects.Graphics, guide: NonNullable<OverlayState['guide']>, t: number) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    const zero = { x: 0, y: 0 };
    for (const e of guide.ghosts) {
      g.fillStyle(0xfff2a8, 0.28 + 0.14 * pulse);
      for (const b of e.bodies) {
        const parts = b.parts.length > 1 ? b.parts.slice(1) : b.parts;
        for (const p of parts) {
          if (p.circleRadius) {
            g.fillCircle(p.position.x, p.position.y, p.circleRadius);
            continue;
          }
          g.beginPath();
          g.moveTo(p.vertices[0].x, p.vertices[0].y);
          for (let i = 1; i < p.vertices.length; i++) g.lineTo(p.vertices[i].x, p.vertices[i].y);
          g.closePath();
          g.fillPath();
        }
      }
      g.lineStyle(5, 0x0b0806, 0.45);
      this.bodyPaths(g, e, zero);
      g.lineStyle(2.5, 0xffe066, 0.6 + 0.4 * pulse);
      this.bodyPaths(g, e, zero);
    }
    const p = guide.point;
    if (p) {
      const r = 16 + 10 * ((t * 1.2) % 1);
      g.lineStyle(4, 0x0b0806, 0.5);
      g.strokeCircle(p.x, p.y, 15);
      g.lineStyle(3, 0xffe066, 0.95);
      g.strokeCircle(p.x, p.y, 15);
      g.lineStyle(2, 0xffe066, 1 - ((t * 1.2) % 1));
      g.strokeCircle(p.x, p.y, r);
    }
  }

  private outline(g: Phaser.GameObjects.Graphics, e: Entity, col: number, a: number, w: number) {
    const off = this.st.offsetOf(e);
    g.lineStyle(w + 3, 0x0b0806, a * 0.5);
    this.bodyPaths(g, e, off);
    g.lineStyle(w, col, a);
    this.bodyPaths(g, e, off);
  }

  private bodyPaths(g: Phaser.GameObjects.Graphics, e: Entity, off: Vec) {
    for (const b of e.bodies) {
      const parts = b.parts.length > 1 ? b.parts.slice(1) : b.parts;
      for (const p of parts) {
        if (p.circleRadius) {
          g.strokeCircle(p.position.x + off.x, p.position.y + off.y, p.circleRadius + 2);
          continue;
        }
        g.beginPath();
        const v = p.vertices;
        g.moveTo(v[0].x + off.x, v[0].y + off.y);
        for (let i = 1; i < v.length; i++) g.lineTo(v[i].x + off.x, v[i].y + off.y);
        g.closePath();
        g.strokePath();
      }
    }
  }

  // ------------------------------------------------------------------ ropes

  private ropePoints(r: Rope): { pts: Vec[]; radii: number[] } | null {
    const a = this.anchorPt(r.a.e, r.a.anchor);
    const b = this.anchorPt(r.b.e, r.b.anchor);
    if (!a || !b || !r.a.e.alive || !r.b.e.alive) return null;
    const pts: Vec[] = [a];
    const radii: number[] = [0];
    for (const p of r.via) {
      if (!p.alive) continue;
      const w = this.anchorPt(p, 'wheel');
      if (w) {
        pts.push(w);
        radii.push(18);
      }
    }
    pts.push(b);
    radii.push(0);
    return { pts, radii };
  }

  /** Stroke a rope path: straight segments that wrap over pulley wheels. Returns the polyline. */
  private ropePolyline(pts: Vec[], radii: number[], sag: number): Vec[] {
    const out: Vec[] = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const c = pts[i];
      const r = radii[i];
      const u1 = norm({ x: pts[i - 1].x - c.x, y: pts[i - 1].y - c.y });
      const u2 = norm({ x: pts[i + 1].x - c.x, y: pts[i + 1].y - c.y });
      // the rope wraps on the side opposite the bisector of the two directions
      let n = norm({ x: -(u1.x + u2.x), y: -(u1.y + u2.y) });
      if (Math.hypot(u1.x + u2.x, u1.y + u2.y) < 1e-3) n = { x: -u1.y, y: u1.x };
      const side = (u: Vec) => {
        const p1 = { x: -u.y, y: u.x };
        return p1.x * n.x + p1.y * n.y >= 0 ? p1 : { x: u.y, y: -u.x };
      };
      const t1 = side(u1);
      const t2 = side(u2);
      const a1 = Math.atan2(t1.y, t1.x);
      let a2 = Math.atan2(t2.y, t2.x);
      // walk the short way through n
      const an = Math.atan2(n.y, n.x);
      let d = a2 - a1;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const mid = a1 + d / 2;
      if (Math.cos(mid - an) < 0) d = d > 0 ? d - Math.PI * 2 : d + Math.PI * 2;
      a2 = a1 + d;
      const steps = 8;
      for (let k = 0; k <= steps; k++) {
        const a = a1 + (a2 - a1) * (k / steps);
        out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
      }
    }
    out.push(pts[pts.length - 1]);
    if (sag > 1 && out.length === 2) {
      const [p, q] = out;
      const res: Vec[] = [];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        res.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t + sag * 4 * t * (1 - t) });
      }
      return res;
    }
    return out;
  }

  private drawRope(g: Phaser.GameObjects.Graphics, r: Rope) {
    const rp = this.ropePoints(r);
    if (!rp) return;
    const { pts, radii } = rp;
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const slack = Math.max(0, r.length - len);
    const sag = Math.min(140, Math.sqrt(Math.max(0, slack) * Math.max(1, len)) * 0.45);
    const sel = this.st.selectedConn === r.id;
    const hov = this.st.hoverConn === r.id;
    if (r.broken) {
      // two dangling halves
      const a = pts[0];
      const b = pts[pts.length - 1];
      const la = Math.min(90, len * r.breakT);
      const lb = Math.min(90, len * (1 - r.breakT));
      const sw = Math.sin(this.st.t * 2.2) * 6;
      this.strokeRope(g, [a, { x: a.x + sw * 0.5, y: a.y + la * 0.6 }, { x: a.x + sw, y: a.y + la }], false, false);
      this.strokeRope(g, [b, { x: b.x - sw * 0.5, y: b.y + lb * 0.6 }, { x: b.x - sw, y: b.y + lb }], false, false);
      return;
    }
    const poly = this.ropePolyline(pts, radii, sag);
    this.strokeRope(g, poly, sel, hov, r.burn);
  }

  private strokeRope(g: Phaser.GameObjects.Graphics, poly: Vec[], sel: boolean, hov: boolean, burn = 0) {
    const path = (w: number, col: number, a: number) => {
      g.lineStyle(w, col, a);
      g.beginPath();
      g.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) g.lineTo(poly[i].x, poly[i].y);
      g.strokePath();
    };
    if (sel || hov) path(9, 0x6fe3ff, sel ? 0.6 : 0.3);
    path(5, ROPE_DARK, 0.95);
    const col = burn > 0 ? Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(ROPE), Phaser.Display.Color.ValueToColor(0x2a1a10), 100, Math.floor(burn * 100)) : null;
    path(3, col ? Phaser.Display.Color.GetColor(col.r, col.g, col.b) : ROPE, 1);
    // twist marks
    g.lineStyle(1, 0x8a6a3a, 0.7);
    let acc = 0;
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1];
      const b = poly[i];
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      const ux = (b.x - a.x) / (l || 1);
      const uy = (b.y - a.y) / (l || 1);
      for (let s = (7 - (acc % 7)) % 7; s < l; s += 7) {
        const px = a.x + ux * s;
        const py = a.y + uy * s;
        g.lineBetween(px - uy * 1.5 - ux, py + ux * 1.5 - uy, px + uy * 1.5 + ux, py - ux * 1.5 + uy);
      }
      acc += l;
    }
  }

  // ------------------------------------------------------------------ belts

  private drawBelt(g: Phaser.GameObjects.Graphics, a: Entity, b: Entity, id: string) {
    const pa = this.rotorPt(a);
    const pb = this.rotorPt(b);
    if (!pa || !pb || !a.alive || !b.alive) return;
    const ra = a.rotor!.r + 2;
    const rb = b.rotor!.r + 2;
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const d = Math.hypot(dx, dy);
    if (d < Math.abs(ra - rb) + 1) return;
    const base = Math.atan2(dy, dx);
    const phi = Math.acos((ra - rb) / d);
    const sel = this.st.selectedConn === id;
    const hov = this.st.hoverConn === id;
    const loop: Vec[] = [];
    // arc on a from base+phi around the far side to base-phi, then arc on b
    const arc = (c: Vec, r: number, s: number, e: number) => {
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const t = s + (e - s) * (i / n);
        loop.push({ x: c.x + Math.cos(t) * r, y: c.y + Math.sin(t) * r });
      }
    };
    arc(pa, ra, base + phi, base + Math.PI * 2 - phi);
    arc(pb, rb, base - phi, base + phi);
    const stroke = (w: number, col: number, al: number) => {
      g.lineStyle(w, col, al);
      g.beginPath();
      g.moveTo(loop[0].x, loop[0].y);
      for (let i = 1; i < loop.length; i++) g.lineTo(loop[i].x, loop[i].y);
      g.closePath();
      g.strokePath();
    };
    if (sel || hov) stroke(10, 0x6fe3ff, sel ? 0.55 : 0.3);
    stroke(6, 0x0c0907, 0.9);
    stroke(4, BELT, 1);
    // moving highlight dashes following rotation of a
    const travel = (this.beltTravel.get(id) ?? 0) + (this.st.mode === 'run' ? (a.omega ?? 0) * ra : 0);
    this.beltTravel.set(id, travel);
    let acc = 0;
    g.lineStyle(1.5, 0x6a5a4c, 0.9);
    for (let i = 1; i < loop.length; i++) {
      const p = loop[i - 1];
      const q = loop[i];
      const l = Math.hypot(q.x - p.x, q.y - p.y);
      const ph = (((acc - travel) % 18) + 18) % 18;
      if (ph < l) {
        const t = ph / (l || 1);
        g.fillStyle(0x6a5a4c, 0.9);
        g.fillCircle(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t, 1.2);
      }
      acc += l;
    }
  }

  // ------------------------------------------------------------------ wires

  private wireCurve(p: Vec, q: Vec): Vec[] {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    const sag = Math.min(70, 12 + d * 0.18);
    const out: Vec[] = [];
    for (let k = 0; k <= 20; k++) {
      const t = k / 20;
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t + sag * 4 * t * (1 - t) });
    }
    return out;
  }

  private drawWire(g: Phaser.GameObjects.Graphics, a: Entity, ap: string, b: Entity, bp: string, live: boolean, id: string) {
    if (!a.alive || !b.alive) return;
    const p = this.portPt(a, ap);
    const q = this.portPt(b, bp);
    if (!p || !q) return;
    const curve = this.wireCurve(p, q);
    const sel = this.st.selectedConn === id;
    const hov = this.st.hoverConn === id;
    const stroke = (w: number, col: number, al: number) => {
      g.lineStyle(w, col, al);
      g.beginPath();
      g.moveTo(curve[0].x, curve[0].y);
      for (let i = 1; i < curve.length; i++) g.lineTo(curve[i].x, curve[i].y);
      g.strokePath();
    };
    if (sel || hov) stroke(9, 0x6fe3ff, sel ? 0.55 : 0.3);
    stroke(4.5, 0x0c0907, 0.95);
    stroke(2.5, live ? 0x8a3a20 : WIRE_DEAD, 1);
    if (live) {
      stroke(6, WIRE_LIVE, 0.12);
      // travelling sparks
      const n = curve.length - 1;
      for (let s = 0; s < 3; s++) {
        const f = ((this.st.t * 1.4 + s / 3) % 1) * n;
        const i = Math.floor(f);
        const t = f - i;
        const x = curve[i].x + (curve[i + 1].x - curve[i].x) * t;
        const y = curve[i].y + (curve[i + 1].y - curve[i].y) * t;
        g.fillStyle(WIRE_LIVE, 0.35);
        g.fillCircle(x, y, 5);
        g.fillStyle(0xfff2c0, 1);
        g.fillCircle(x, y, 2);
      }
    }
  }

  private drawPending(g: Phaser.GameObjects.Graphics, p: PendingConnection) {
    const pts = [...p.points, p.cursor];
    g.lineStyle(3, p.kind === 'wire' ? WIRE_LIVE : p.kind === 'belt' ? 0xffc46a : ROPE, 0.85);
    if (p.kind === 'wire') {
      const c = this.wireCurve(pts[0], pts[pts.length - 1]);
      g.beginPath();
      g.moveTo(c[0].x, c[0].y);
      for (let i = 1; i < c.length; i++) g.lineTo(c[i].x, c[i].y);
      g.strokePath();
    } else {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const l = Math.hypot(b.x - a.x, b.y - a.y);
        for (let s = 0; s < l; s += 12) {
          const t0 = s / l;
          const t1 = Math.min(1, (s + 7) / l);
          g.lineBetween(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
        }
      }
    }
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(pts[0].x, pts[0].y, 4);
  }

  // ------------------------------------------------------------------ goals

  private drawGoals(g: Phaser.GameObjects.Graphics, sim: Simulation, st: OverlayState) {
    const t = st.t;
    sim.goals.goals.forEach((goal: GoalDef, i) => {
      const met = st.goalMet[i] ?? false;
      const status = sim.goals.status[i];
      const col = met ? 0xffe08a : GOAL;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
      const selected = st.selectedGoal === i;
      const targets = (sel: any) => (sel ? sim.list.filter((e) => e.alive && matches(e, sel)) : []);
      const ring = (e: Entity, color: number) => {
        const b = e.body;
        if (!b) return;
        const p = lerpPoint(e, { x: 0, y: 0 }, 0, st.alpha);
        const r = Math.max(b.bounds.max.x - b.bounds.min.x, b.bounds.max.y - b.bounds.min.y) / 2 + 10;
        g.lineStyle(2, color, 0.35 + 0.35 * pulse);
        this.dashedCircle(g, p.x, p.y, r, t * 0.6);
      };
      switch (goal.kind) {
        case 'enterRegion': {
          const r = goal.region;
          g.fillStyle(col, (met ? 0.18 : 0.07 + 0.04 * pulse) + (selected ? 0.08 : 0));
          g.fillRect(r.x, r.y, r.w, r.h);
          g.lineStyle(selected ? 3 : 2, col, 0.75);
          this.dashedRect(g, r.x, r.y, r.w, r.h, t * 20);
          // corner brackets
          g.lineStyle(3, col, 0.95);
          const c = 14;
          for (const [x, y, sx, sy] of [
            [r.x, r.y, 1, 1],
            [r.x + r.w, r.y, -1, 1],
            [r.x, r.y + r.h, 1, -1],
            [r.x + r.w, r.y + r.h, -1, -1],
          ]) {
            g.lineBetween(x, y, x + c * sx, y);
            g.lineBetween(x, y, x, y + c * sy);
          }
          if (status && status.progress > 0 && !met) {
            g.fillStyle(col, 0.8);
            g.fillRect(r.x, r.y + r.h + 4, r.w * status.progress, 4);
          }
          for (const e of targets(goal.target)) ring(e, col);
          break;
        }
        case 'contact':
          for (const e of [...targets(goal.a), ...targets(goal.b)]) ring(e, col);
          break;
        case 'activate':
        case 'destroyed':
          for (const e of targets(goal.target)) ring(e, goal.kind === 'destroyed' ? 0xff7062 : col);
          break;
        case 'containerCount': {
          const c = sim.entities.get(goal.container);
          if (c) ring(c, col);
          break;
        }
        case 'height': {
          g.lineStyle(2, col, 0.6);
          this.dashedLine(g, 0, goal.maxY, sim.bounds.w, goal.maxY, t * 20);
          for (const e of targets(goal.target)) ring(e, col);
          break;
        }
      }
    });
  }

  private dashedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, phase: number) {
    this.dashedLine(g, x, y, x + w, y, phase);
    this.dashedLine(g, x + w, y, x + w, y + h, phase);
    this.dashedLine(g, x + w, y + h, x, y + h, phase);
    this.dashedLine(g, x, y + h, x, y, phase);
  }

  private dashedLine(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, phase: number) {
    const l = Math.hypot(x1 - x0, y1 - y0);
    if (l < 1) return;
    const ux = (x1 - x0) / l;
    const uy = (y1 - y0) / l;
    const on = 10;
    const off = 8;
    let s = -((phase % (on + off)) + (on + off)) % (on + off);
    for (; s < l; s += on + off) {
      const a = Math.max(0, s);
      const b = Math.min(l, s + on);
      if (b > a) g.lineBetween(x0 + ux * a, y0 + uy * a, x0 + ux * b, y0 + uy * b);
    }
  }

  private dashedCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, phase: number) {
    const n = Math.max(8, Math.round((r * Math.PI * 2) / 18));
    for (let i = 0; i < n; i++) {
      const a0 = phase + (i / n) * Math.PI * 2;
      g.beginPath();
      g.arc(x, y, r, a0, a0 + (Math.PI * 2) / n / 1.8);
      g.strokePath();
    }
  }

  // ------------------------------------------------------------------ debug forces

  private drawForces(g: Phaser.GameObjects.Graphics, sim: Simulation) {
    for (const e of sim.list) {
      if (!e.alive) continue;
      for (const b of e.bodies) {
        const parts = b.parts.length > 1 ? b.parts.slice(1) : b.parts;
        g.lineStyle(1, b.isStatic ? 0x8a8a8a : b.isSensor ? 0xffe08a : 0x7cf0a0, 0.6);
        for (const p of parts) {
          g.beginPath();
          const v = p.vertices;
          g.moveTo(v[0].x, v[0].y);
          for (let i = 1; i < v.length; i++) g.lineTo(v[i].x, v[i].y);
          g.closePath();
          g.strokePath();
        }
        if (!b.isStatic) {
          const vx = b.velocity.x * 6;
          const vy = b.velocity.y * 6;
          if (Math.hypot(vx, vy) > 2) {
            g.lineStyle(2, 0xffb54a, 0.9);
            g.lineBetween(b.position.x, b.position.y, b.position.x + vx, b.position.y + vy);
            const a = Math.atan2(vy, vx);
            g.fillStyle(0xffb54a, 0.9);
            g.fillTriangle(
              b.position.x + vx,
              b.position.y + vy,
              b.position.x + vx - Math.cos(a - 0.4) * 8,
              b.position.y + vy - Math.sin(a - 0.4) * 8,
              b.position.x + vx - Math.cos(a + 0.4) * 8,
              b.position.y + vy - Math.sin(a + 0.4) * 8,
            );
          }
        }
      }
    }
    for (const c of sim.contacts) {
      if (c.isSensor) continue;
      g.fillStyle(0xff5a4a, 0.9);
      g.fillCircle(c.point.x, c.point.y, 2.5);
    }
    for (const h of sim.heat) {
      g.lineStyle(1, 0xff9a5a, 0.7);
      g.strokeCircle(h.x, h.y, h.r);
    }
  }

  /** Distance from a world point to a connection's drawn path (for picking). */
  connectionDistance(sim: Simulation, id: string, p: Vec): number {
    const rope = sim.ropes.find((r) => r.id === id);
    let poly: Vec[] | null = null;
    if (rope) {
      const rp = this.ropePoints(rope);
      if (rp) poly = this.ropePolyline(rp.pts, rp.radii, 0);
    }
    const wire = sim.wires.find((w) => w.id === id);
    if (wire) {
      const a = this.portPt(wire.from, wire.fromPort);
      const b = this.portPt(wire.to, wire.toPort);
      if (a && b) poly = this.wireCurve(a, b);
    }
    const belt = sim.belts.find((b) => b.id === id);
    if (belt) {
      const a = this.rotorPt(belt.a);
      const b = this.rotorPt(belt.b);
      if (a && b) {
        const ra = belt.a.rotor!.r;
        const rb = belt.b.rotor!.r;
        const n = norm({ x: -(b.y - a.y), y: b.x - a.x });
        const d1 = segDist(p, { x: a.x + n.x * ra, y: a.y + n.y * ra }, { x: b.x + n.x * rb, y: b.y + n.y * rb });
        const d2 = segDist(p, { x: a.x - n.x * ra, y: a.y - n.y * ra }, { x: b.x - n.x * rb, y: b.y - n.y * rb });
        return Math.min(d1, d2);
      }
    }
    if (!poly) return Infinity;
    let best = Infinity;
    for (let i = 1; i < poly.length; i++) best = Math.min(best, segDist(p, poly[i - 1], poly[i]));
    return best;
  }
}

const segDist = (p: Vec, a: Vec, b: Vec) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
};
