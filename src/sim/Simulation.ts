// The Simulation instantiates a level + player build into a Matter world and advances it
// at a fixed timestep. It knows nothing about rendering. The authored LevelDef/BuildDef are
// never mutated: RUN builds a fresh Simulation, RESET throws it away.

import { getComponent, normalizeProps, type CollideInfo } from '../components/registry';
import type { BuildDef, ConnectionDef, LevelDef, ObjectDef, Selector, Vec } from '../core/types';
import { localToWorld, pointInRect, worldToLocal } from '../core/util';
import { Entity, type EntityOrigin } from './Entity';
import { GoalTracker, matches } from './goals';
import { CAT, M, STEP_MS, type MBody, type MConstraint } from './matter';
import { propagatePower, type Wire } from './power';
import { Rope, ropeHit, solveRopes } from './ropes';
import { solveRotation, type Belt } from './rotation';

export type FxKind =
  | 'explosion'
  | 'pop'
  | 'sparks'
  | 'smoke'
  | 'puff'
  | 'burn'
  | 'muzzle'
  | 'confetti'
  | 'zap'
  | 'dust'
  | 'exhaust'
  | 'bounce';

export type SimEvent =
  | { t: 'impact'; x: number; y: number; speed: number; matA: string; matB: string }
  | { t: 'activate'; key: string; label: string; domain: string; x: number; y: number }
  | { t: 'sfx'; name: string; x: number; y: number; vol?: number }
  | { t: 'fx'; kind: FxKind; x: number; y: number; dx?: number; dy?: number; scale?: number }
  | { t: 'goal'; index: number }
  | { t: 'solved' }
  | { t: 'shake'; amount: number };

export interface Contact {
  id: string;
  a: Entity | null;
  b: Entity | null;
  bodyA: MBody;
  bodyB: MBody;
  /** Normal pointing from a towards b. */
  normal: Vec;
  depth: number;
  point: Vec;
  isSensor: boolean;
}

export interface ChainEntry {
  key: string;
  label: string;
  domain: string;
  time: number;
}

export interface HeatSource {
  x: number;
  y: number;
  r: number;
  owner: Entity | null;
}

export interface SimOptions {
  /** Skip connections/objects that fail to resolve instead of throwing. Always true in game. */
  lenient?: boolean;
}

const MATERIALS = ['metal', 'wood', 'rubber', 'glass', 'paper', 'robot', 'stone'];
const materialOf = (e: Entity | null) => (e ? e.def.tags.find((t) => MATERIALS.includes(t)) ?? 'wood' : 'stone');

const SUBSTEPS = 2;

export class Simulation {
  readonly level: LevelDef;
  readonly build: BuildDef;
  readonly engine: any;
  readonly world: any;
  readonly entities = new Map<string, Entity>();
  /** Entities in deterministic creation order. */
  readonly list: Entity[] = [];
  readonly wires: Wire[] = [];
  readonly ropes: Rope[] = [];
  readonly belts: Belt[] = [];
  readonly goals: GoalTracker;
  readonly bounds: { x: number; y: number; w: number; h: number };
  readonly warnings: string[] = [];

  tick = 0;
  time = 0;
  readonly dt = 1 / 60;
  events: SimEvent[] = [];
  chain: ChainEntry[] = [];
  contacts: Contact[] = [];
  private contactsByEntity = new Map<Entity, Contact[]>();
  private prevContactIds = new Set<string>();
  heat: HeatSource[] = [];
  /** Body id -> owning entity (parents and parts). */
  private owners = new Map<number, Entity>();
  /** Bodies whose kinematics are captured by snapshots (non-static + moving statics). */
  readonly tracked: MBody[] = [];
  private wallBodies: MBody[] = [];
  /** Number of parts the player placed (for scoring). */
  readonly placedParts: number;

  constructor(level: LevelDef, build: BuildDef, _opts: SimOptions = {}) {
    this.level = level;
    this.build = build;
    this.bounds = { x: 0, y: 0, w: level.world.width, h: level.world.height };
    this.engine = M.Engine.create({
      enableSleeping: false,
      positionIterations: 10,
      velocityIterations: 8,
      constraintIterations: 4,
    });
    this.engine.gravity.x = 0;
    this.engine.gravity.y = level.world.gravity ?? 1;
    this.world = this.engine.world;
    this.goals = new GoalTracker(level.goals ?? []);

    this.addWalls();
    for (const o of level.fixedObjects ?? []) this.spawnObject(o, 'fixed');
    for (const o of level.startingObjects ?? []) this.spawnObject(o, 'start');
    for (const o of build.objects ?? []) this.spawnObject(o, 'build');
    for (const c of level.connections ?? []) this.addConnection(c);
    for (const c of build.connections ?? []) this.addConnection(c);
    this.placedParts =
      (build.objects?.length ?? 0) + (build.connections ?? []).filter((c) => c.kind !== 'wire').length;
    this.updateContacts();
  }

  // ------------------------------------------------------------------ construction

  private addWalls() {
    const { w, h } = this.bounds;
    const t = 200;
    const opts = { isStatic: true, friction: 0.6, restitution: 0.1, label: 'wall' };
    const floor = M.Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, opts);
    const left = M.Bodies.rectangle(-t / 2, h / 2 - h, t, h * 3, opts);
    const right = M.Bodies.rectangle(w + t / 2, h / 2 - h, t, h * 3, opts);
    for (const b of [floor, left, right]) {
      b.collisionFilter.category = CAT.WALL;
      this.wallBodies.push(b);
    }
    M.Composite.add(this.world, this.wallBodies);
  }

  spawnObject(o: ObjectDef, origin: EntityOrigin): Entity | null {
    const def = getComponent(o.type);
    if (!def) {
      this.warnings.push(`Unknown component type "${o.type}" (${o.id}) skipped`);
      return null;
    }
    if (this.entities.has(o.id)) {
      this.warnings.push(`Duplicate object id "${o.id}" skipped`);
      return null;
    }
    const props = normalizeProps(def, o.props);
    const e = new Entity(def, o, props, origin);
    try {
      def.build(e, this);
    } catch (err) {
      this.warnings.push(`Failed to build ${o.type} (${o.id}): ${(err as Error).message}`);
      for (const b of e.bodies) M.Composite.remove(this.world, b);
      for (const c of e.constraints) M.Composite.remove(this.world, c);
      return null;
    }
    this.entities.set(e.id, e);
    this.list.push(e);
    return e;
  }

  /** Called by component build(): registers a body for an entity. `local` is the body centre in the authored local frame. */
  addBody(e: Entity, body: MBody, local: Vec = { x: 0, y: 0 }, inWorld = true): MBody {
    (body as any).__refOffset = { x: e.flip ? -local.x : local.x, y: local.y };
    (body as any).__refAngle = body.angle;
    body.plugin = body.plugin ?? {};
    body.plugin.entity = e;
    e.bodies.push(body);
    this.owners.set(body.id, e);
    for (const p of body.parts) this.owners.set(p.id, e);
    if (!body.isStatic || body.plugin.kinematic) this.tracked.push(body);
    if (inWorld) M.Composite.add(this.world, body);
    return body;
  }

  addConstraint(e: Entity, c: MConstraint, inWorld = true) {
    e.constraints.push(c);
    if (inWorld) M.Composite.add(this.world, c);
  }

  /** World coordinates of a local point in the entity's authored frame. */
  toWorld(e: Entity, local: Vec): Vec {
    return localToWorld(local, { x: e.x, y: e.y }, e.angle, e.flip);
  }
  toLocal(e: Entity, world: Vec): Vec {
    return worldToLocal(world, { x: e.x, y: e.y }, e.angle, e.flip);
  }
  /** World-space angle of a local direction angle, respecting flip. */
  worldAngle(e: Entity, localAngle = 0): number {
    return e.flip ? e.angle + Math.PI - localAngle : e.angle + localAngle;
  }

  addConnection(c: ConnectionDef) {
    const a = this.entities.get(c.from.obj);
    const b = this.entities.get(c.to.obj);
    if (!a || !b) {
      this.warnings.push(`Connection ${c.id} references a missing object`);
      return;
    }
    if (c.kind === 'wire') {
      // Normalise so power flows out -> in.
      const pa = a.ports.find((p) => p.id === c.from.port);
      const pb = b.ports.find((p) => p.id === c.to.port);
      if (!pa || !pb || pa.dir === pb.dir) {
        this.warnings.push(`Wire ${c.id} has incompatible ports`);
        return;
      }
      const [src, sp, dst, dp] = pa.dir === 'out' ? [a, pa, b, pb] : [b, pb, a, pa];
      this.wires.push({ id: c.id, from: src, fromPort: sp.id, to: dst, toPort: dp.id, live: false });
    } else if (c.kind === 'rope') {
      if (!a.anchors.some((q) => q.id === c.from.port) || !b.anchors.some((q) => q.id === c.to.port)) {
        this.warnings.push(`Rope ${c.id} has a missing anchor`);
        return;
      }
      const via = (c.via ?? []).map((id) => this.entities.get(id)).filter((v): v is Entity => !!v && v.anchors.some((q) => q.id === 'wheel'));
      const rope = new Rope(c.id, { e: a, anchor: c.from.port }, { e: b, anchor: c.to.port }, via, 0);
      const pts = rope.path();
      const slack = typeof c.props?.slack === 'number' ? (c.props.slack as number) : 0;
      const len = typeof c.props?.length === 'number' ? (c.props.length as number) : pts ? rope.pathLength(pts) + slack : 100;
      rope.length = Math.max(10, len);
      (rope as any).restLength = rope.length;
      this.ropes.push(rope);
    } else if (c.kind === 'belt') {
      if (!a.rotor || !b.rotor || a === b) {
        this.warnings.push(`Belt ${c.id} needs two rotors`);
        return;
      }
      this.belts.push({ id: c.id, a, b });
    }
  }

  // ------------------------------------------------------------------ queries

  ownerOf(body: MBody | null | undefined): Entity | null {
    if (!body) return null;
    return this.owners.get(body.id) ?? (body.parent ? this.owners.get(body.parent.id) ?? null : null);
  }

  select(sel: Selector): Entity[] {
    return this.list.filter((e) => e.alive && matches(e, sel));
  }

  contactsOf(e: Entity): Contact[] {
    return this.contactsByEntity.get(e) ?? [];
  }

  /** Alive dynamic entities (with a non-static primary body). */
  *dynamicEntities(): Generator<Entity> {
    for (const e of this.list) if (e.alive && e.body && !e.body.isStatic) yield e;
  }

  countInside(container: Entity, filter?: Selector): number {
    const r = container.def.interior!(container.props);
    let n = 0;
    for (const e of this.dynamicEntities()) {
      if (e === container) continue;
      if (filter && !matches(e, filter)) continue;
      const lp = this.localOfBody(container, e.body.position);
      if (pointInRect(lp, r)) n++;
    }
    return n;
  }

  /** Local coordinates relative to the entity's primary body (follows it if it moves). */
  localOfBody(e: Entity, world: Vec): Vec {
    const b = e.body;
    const off: Vec = (b as any).__refOffset ?? { x: 0, y: 0 };
    const rot = b.angle - ((b as any).__refAngle ?? 0) + e.angle;
    const dx = world.x - b.position.x;
    const dy = world.y - b.position.y;
    const c = Math.cos(-rot);
    const s = Math.sin(-rot);
    const lx = dx * c - dy * s + off.x;
    const ly = dx * s + dy * c + off.y;
    return { x: e.flip ? -lx : lx, y: ly };
  }

  emit(ev: SimEvent) {
    this.events.push(ev);
    if (this.events.length > 2000) this.events.splice(0, 1000);
  }

  /** Record a chain-reaction stage. Each key counts once. Returns true if it was new. */
  activate(e: Entity | string, label: string, domain?: string): boolean {
    const key = typeof e === 'string' ? e : e.id;
    if (typeof e !== 'string') {
      if (e.activated) return false;
      e.activated = true;
    } else if (this.chain.some((c) => c.key === key)) return false;
    const dom = domain ?? (typeof e === 'string' ? 'mechanical' : e.def.domain);
    this.chain.push({ key, label, domain: dom, time: this.time });
    const pos = typeof e === 'string' ? { x: 0, y: 0 } : e.body?.position ?? { x: e.x, y: e.y };
    this.emit({ t: 'activate', key, label, domain: dom, x: pos.x, y: pos.y });
    return true;
  }

  // ------------------------------------------------------------------ actions used by components

  setMass(body: MBody, mass: number) {
    M.Body.setMass(body, mass);
  }

  /** Apply an acceleration in px/s^2 to a body. */
  accelerate(body: MBody, ax: number, ay: number) {
    const m = body.mass;
    M.Body.applyForce(body, body.position, { x: m * ax * 1e-6, y: m * ay * 1e-6 });
  }

  /** Apply a force (mass-independent push) expressed as acceleration on a 1kg body, px/s^2. */
  push(body: MBody, fx: number, fy: number, at?: Vec) {
    M.Body.applyForce(body, at ?? body.position, { x: fx * 1e-6, y: fy * 1e-6 });
  }

  /** Instant velocity change in px/s. */
  kick(body: MBody, dvx: number, dvy: number) {
    M.Body.setVelocity(body, { x: body.velocity.x + dvx / 60, y: body.velocity.y + dvy / 60 });
  }

  addHeat(x: number, y: number, r: number, owner: Entity | null) {
    this.heat.push({ x, y, r, owner });
  }

  kill(e: Entity) {
    if (!e.alive) return;
    e.alive = false;
    for (const b of e.bodies) M.Composite.remove(this.world, b);
    for (const c of e.constraints) M.Composite.remove(this.world, c);
  }

  revive(e: Entity) {
    if (e.alive) return;
    e.alive = true;
    for (const b of e.bodies) M.Composite.add(this.world, b);
    for (const c of e.constraints) M.Composite.add(this.world, c);
  }

  /** Radial blast. Pushes dynamic bodies, breaks nearby ropes, notifies onBlast. */
  explode(x: number, y: number, radius: number, strength: number, source: Entity | null) {
    this.emit({ t: 'fx', kind: 'explosion', x, y, scale: radius / 160 });
    this.emit({ t: 'sfx', name: 'boom', x, y, vol: Math.min(1, strength / 900) });
    this.emit({ t: 'shake', amount: Math.min(1, strength / 1000) });
    for (const e of [...this.list]) {
      if (!e.alive || e === source) continue;
      const b = e.body;
      if (!b) continue;
      const dx = b.position.x - x;
      const dy = b.position.y - y;
      const d = Math.hypot(dx, dy);
      if (d > radius) continue;
      const falloff = 1 - d / radius;
      if (!b.isStatic) {
        const nx = d > 1 ? dx / d : 0;
        const ny = d > 1 ? dy / d : -1;
        const dv = (strength * falloff) / Math.sqrt(Math.max(0.3, b.mass));
        this.kick(b, nx * dv, ny * dv - dv * 0.25);
        M.Body.setAngularVelocity(b, b.angularVelocity + (nx >= 0 ? 1 : -1) * 0.08 * falloff);
      }
      e.def.onBlast?.(e, this, { x, y }, strength * falloff);
    }
    for (const rope of this.ropes) {
      if (rope.broken) continue;
      const t = ropeHit(rope, { x, y }, radius * 0.45);
      if (t !== null) this.breakRope(rope, t, 'Rope blown apart');
    }
  }

  breakRope(rope: Rope, t: number, label: string) {
    if (rope.broken) return;
    rope.broken = true;
    rope.breakT = t;
    const pts = rope.path();
    if (pts) {
      const p = pointAlong(pts, t);
      this.emit({ t: 'fx', kind: 'burn', x: p.x, y: p.y });
      this.emit({ t: 'sfx', name: 'snap', x: p.x, y: p.y });
    }
    this.activate(`rope:${rope.id}`, label, 'heat');
  }

  // ------------------------------------------------------------------ stepping

  /** Store pre-step pose on every tracked body so views can interpolate between ticks. */
  capturePrev() {
    for (const b of this.tracked) {
      const pv = (b as any).__prev ?? ((b as any).__prev = { x: 0, y: 0, a: 0, vx: 0, vy: 0 });
      pv.x = b.position.x;
      pv.y = b.position.y;
      pv.a = b.angle;
      pv.vx = b.velocity.x;
      pv.vy = b.velocity.y;
    }
  }

  step() {
    this.capturePrev();
    this.heat.length = 0;
    for (const r of this.ropes) r.tension = 0;

    propagatePower(this);
    solveRotation(this);
    for (const e of this.list) if (e.alive && e.def.step) e.def.step(e, this);

    // Two Matter substeps per tick: a bowling ball dropped from the ceiling moves ~18px a tick,
    // more than a plank is thick, and would tunnel straight through with a single step. Matter
    // clears forces after each update, so component forces are re-applied for the second half.
    const forced: [MBody, number, number, number][] = [];
    for (const b of this.tracked) if (b.force.x || b.force.y || b.torque) forced.push([b, b.force.x, b.force.y, b.torque]);
    M.Engine.update(this.engine, STEP_MS / SUBSTEPS);
    for (let k = 1; k < SUBSTEPS; k++) {
      this.noteBriefContacts();
      for (const [b, fx, fy, t] of forced) {
        b.force.x = fx;
        b.force.y = fy;
        b.torque = t;
      }
      M.Engine.update(this.engine, STEP_MS / SUBSTEPS);
    }

    for (let i = 0; i < 4; i++) solveRopes(this.ropes, i);
    this.applyRopePulls();

    this.updateContacts();
    for (const e of this.list) if (e.alive && e.def.afterStep) e.def.afterStep(e, this);
    this.applyHeat();
    this.cullOutOfBounds();

    this.tick++;
    this.time = this.tick * this.dt;
    this.goals.evaluate(this, this.dt);
  }

  /**
   * True when nothing in the machine is moving or about to: every body at rest, no driven
   * rotors, nothing burning, no timer counting down and no goal part-way through its hold time. Read-only; used to tell the player
   * early that a run has stalled instead of making them wait out the time limit.
   */
  isStill(): boolean {
    // a hold-style goal that is filling up is progress, even when nothing moves
    if (this.goals.status.some((st) => !st.met && st.held > 0)) return false;
    for (const b of this.tracked) {
      if (b.isStatic || b.isSensor) continue;
      if (Math.abs(b.velocity.x) > 0.06 || Math.abs(b.velocity.y) > 0.06 || Math.abs(b.angularVelocity) > 0.004) return false;
    }
    for (const e of this.list) {
      if (!e.alive) continue;
      if (e.omega) return false;
      const st = e.state;
      if (st.lit && !st.done) return false;
      if (st.fireAt >= 0 && !st.rang) return false;
      if (st.walking) return false;
    }
    return true;
  }

  private applyRopePulls() {
    for (const rope of this.ropes) {
      if (rope.broken || rope.tension <= 0.01) continue;
      const pts = rope.path();
      if (!pts) continue;
      for (const [end, toward] of [
        [rope.a, pts[1]],
        [rope.b, pts[pts.length - 2]],
      ] as const) {
        if (!end.e.def.onRopePull) continue;
        const p = pts[end === rope.a ? 0 : pts.length - 1];
        const dx = toward.x - p.x;
        const dy = toward.y - p.y;
        const l = Math.hypot(dx, dy) || 1;
        end.e.def.onRopePull(end.e, end.anchor, rope.tension, { x: dx / l, y: dy / l }, this);
      }
    }
  }

  /** Build a Contact from an active Matter pair, or null for a body touching itself. */
  private contactOf(pair: any): { c: Contact; ba: MBody; bb: MBody } | null {
    const col = pair.collision;
    const ba: MBody = col.parentA ?? col.bodyA;
    const bb: MBody = col.parentB ?? col.bodyB;
    const ea = this.ownerOf(col.bodyA) ?? this.ownerOf(ba);
    const eb = this.ownerOf(col.bodyB) ?? this.ownerOf(bb);
    if (ea && eb && ea === eb) return null;
    const sup = col.supports && col.supports[0] ? col.supports[0] : ba.position;
    const c: Contact = {
      id: pair.id,
      a: ea,
      b: eb,
      bodyA: col.bodyA,
      bodyB: col.bodyB,
      normal: { x: -col.normal.x, y: -col.normal.y },
      depth: col.depth,
      point: { x: sup.x, y: sup.y },
      isSensor: pair.isSensor,
    };
    return { c, ba, bb };
  }

  /**
   * Contacts that begin after the first substep. A fast ball can touch a trampoline and leave it
   * again before the tick ends; without this the contact never shows up in updateContacts and
   * the trampoline (or switch, or fragile part) never hears about it.
   */
  private briefContacts: { c: Contact; ba: MBody; bb: MBody }[] = [];
  private noteBriefContacts() {
    this.briefContacts.length = 0;
    if (this.tick === 0) return;
    for (const pair of this.engine.pairs.list as any[]) {
      if (!pair.isActive || this.prevContactIds.has(pair.id)) continue;
      const r = this.contactOf(pair);
      if (r) this.briefContacts.push(r);
    }
  }

  private updateContacts() {
    const list: Contact[] = [];
    const byEnt = new Map<Entity, Contact[]>();
    const ids = new Set<string>();
    const pairs = this.engine.pairs.list as any[];
    for (const pair of pairs) {
      if (!pair.isActive) continue;
      const r = this.contactOf(pair);
      if (!r) continue;
      const { c, ba, bb } = r;
      const ea = c.a;
      const eb = c.b;
      list.push(c);
      ids.add(pair.id);
      if (ea) (byEnt.get(ea) ?? byEnt.set(ea, []).get(ea)!).push(c);
      if (eb) (byEnt.get(eb) ?? byEnt.set(eb, []).get(eb)!).push(c);
      if (!this.prevContactIds.has(pair.id) && this.tick > 0) this.onContactStart(c, ba, bb);
    }
    // contacts that started and ended inside this tick still count as having started
    for (const r of this.briefContacts) if (!ids.has(r.c.id)) this.onContactStart(r.c, r.ba, r.bb);
    this.briefContacts.length = 0;
    this.contacts = list;
    this.contactsByEntity = byEnt;
    this.prevContactIds = ids;
  }

  private onContactStart(c: Contact, ba: MBody, bb: MBody) {
    // Use pre-step velocities: by now the solver has already resolved the bounce.
    const va = (ba as any).__prev && !ba.isStatic ? { x: (ba as any).__prev.vx, y: (ba as any).__prev.vy } : ba.velocity;
    const vb = (bb as any).__prev && !bb.isStatic ? { x: (bb as any).__prev.vx, y: (bb as any).__prev.vy } : bb.velocity;
    const rvx = vb.x - va.x;
    const rvy = vb.y - va.y;
    // approaching speed of b towards a along normal (a->b): negative dot means approaching
    const approach = -(rvx * c.normal.x + rvy * c.normal.y);
    if (!c.isSensor && approach > 1.2) {
      this.emit({ t: 'impact', x: c.point.x, y: c.point.y, speed: approach, matA: materialOf(c.a), matB: materialOf(c.b) });
    }
    // Two loose things knocking into each other is a stage of the chain reaction ("Ball hit the crate").
    if (!c.isSensor && approach > 1.5 && c.a && c.b && !ba.isStatic && !bb.isStatic) {
      for (const [e, o] of [
        [c.a, c.b],
        [c.b, c.a],
      ] as const) {
        if (!e.activated && e.def.dynamic) this.activate(e, `${e.def.name} hit the ${o.def.name.toLowerCase()}`);
      }
    }
    if (c.a?.def.onCollide) {
      const info: CollideInfo = { normal: c.normal, speed: approach, point: c.point, bodyIndex: bodyIndexOf(c.a, c.bodyA) };
      c.a.def.onCollide(c.a, c.b, info, this);
    }
    if (c.b?.def.onCollide) {
      const info: CollideInfo = {
        normal: { x: -c.normal.x, y: -c.normal.y },
        speed: approach,
        point: c.point,
        bodyIndex: bodyIndexOf(c.b, c.bodyB),
      };
      c.b.def.onCollide(c.b, c.a, info, this);
    }
  }

  private applyHeat() {
    if (!this.heat.length) return;
    const burned = new Set<Rope>();
    for (const h of this.heat) {
      for (const e of this.list) {
        if (!e.alive || e === h.owner || !e.def.onHeat || !e.body) continue;
        const bb = e.body.bounds;
        const cx = Math.max(bb.min.x, Math.min(h.x, bb.max.x));
        const cy = Math.max(bb.min.y, Math.min(h.y, bb.max.y));
        if (Math.hypot(cx - h.x, cy - h.y) <= h.r) e.def.onHeat(e, this);
      }
      for (const rope of this.ropes) {
        if (rope.broken || burned.has(rope)) continue;
        const t = ropeHit(rope, h, h.r);
        if (t !== null) {
          burned.add(rope);
          rope.burn += this.dt / 0.6;
          if (rope.burn >= 1) this.breakRope(rope, t, 'Rope burned through');
        }
      }
    }
  }

  private cullOutOfBounds() {
    const { w, h } = this.bounds;
    for (const e of this.list) {
      if (!e.alive || !e.body || e.body.isStatic) continue;
      const p = e.body.position;
      if (p.y > h + 600 || p.x < -600 || p.x > w + 600 || p.y < -3000) this.kill(e);
    }
  }

  /** Run until solved or time limit; used by tests and validation. */
  runUntil(seconds: number, stopWhenSolved = true): boolean {
    const ticks = Math.round(seconds * 60);
    for (let i = 0; i < ticks; i++) {
      this.step();
      if (stopWhenSolved && this.goals.solved) return true;
      if (this.events.length > 500) this.events.length = 0;
    }
    return this.goals.solved;
  }

  // ------------------------------------------------------------------ snapshots (rewind)

  snapshot(): SimSnapshot {
    const n = this.tracked.length;
    const kin = new Float64Array(n * 6);
    for (let i = 0; i < n; i++) {
      const b = this.tracked[i];
      const o = i * 6;
      kin[o] = b.position.x;
      kin[o + 1] = b.position.y;
      kin[o + 2] = b.angle;
      kin[o + 3] = b.velocity.x;
      kin[o + 4] = b.velocity.y;
      kin[o + 5] = b.angularVelocity;
    }
    return {
      tick: this.tick,
      kin,
      ents: this.list.map((e) => ({
        alive: e.alive,
        activated: e.activated,
        state: shallowCopy(e.state),
        inputs: { ...e.inputs },
        outputs: { ...e.outputs },
        omega: e.omega,
        jammed: e.jammed,
      })),
      ropes: this.ropes.map((r) => r.serialize()),
      goals: this.goals.serialize(),
      solvedAt: this.goals.solvedAt,
      chainLen: this.chain.length,
    };
  }

  restore(s: SimSnapshot) {
    this.tick = s.tick;
    this.time = s.tick * this.dt;
    this.list.forEach((e, i) => {
      const es = s.ents[i];
      if (!es) return;
      if (es.alive && !e.alive) this.revive(e);
      else if (!es.alive && e.alive) this.kill(e);
      e.activated = es.activated;
      e.state = shallowCopy(es.state);
      e.inputs = { ...es.inputs };
      e.outputs = { ...es.outputs };
      e.omega = es.omega;
      e.jammed = es.jammed;
    });
    for (let i = 0; i < this.tracked.length; i++) {
      const b = this.tracked[i];
      const o = i * 6;
      M.Body.setPosition(b, { x: s.kin[o], y: s.kin[o + 1] }, false);
      M.Body.setAngle(b, s.kin[o + 2], false);
      M.Body.setVelocity(b, { x: s.kin[o + 3], y: s.kin[o + 4] });
      M.Body.setAngularVelocity(b, s.kin[o + 5]);
    }
    this.ropes.forEach((r, i) => s.ropes[i] && r.deserialize(s.ropes[i]));
    this.goals.deserialize(s.goals, s.solvedAt);
    this.chain.length = Math.min(this.chain.length, s.chainLen);
    M.Pairs.clear(this.engine.pairs);
    this.prevContactIds.clear();
    this.contacts = [];
    this.contactsByEntity.clear();
  }
}

export interface SimSnapshot {
  tick: number;
  kin: Float64Array;
  ents: {
    alive: boolean;
    activated: boolean;
    state: Record<string, any>;
    inputs: Record<string, boolean>;
    outputs: Record<string, boolean>;
    omega: number | null;
    jammed: boolean;
  }[];
  ropes: number[][];
  goals: ReturnType<GoalTracker['serialize']>;
  solvedAt: number | null;
  chainLen: number;
}

const shallowCopy = (o: Record<string, any>) => {
  const r: Record<string, any> = {};
  for (const k in o) {
    const v = o[k];
    r[k] = Array.isArray(v) ? v.slice() : v && typeof v === 'object' ? { ...v } : v;
  }
  return r;
};

const bodyIndexOf = (e: Entity, body: MBody) => {
  const i = e.bodies.findIndex((b) => b === body || b === body.parent || b.parts.includes(body));
  return i < 0 ? 0 : i;
};

export const pointAlong = (pts: Vec[], t: number): Vec => {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let target = total * t;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (target <= seg || i === pts.length - 1) {
      const u = seg > 0 ? Math.min(1, target / seg) : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u };
    }
    target -= seg;
  }
  return pts[0];
};
