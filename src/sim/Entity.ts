import type { ComponentDef, AnchorSpec, PortSpec, RotorSpec } from '../components/registry';
import { resolveAnchors, resolvePorts, resolveRotor } from '../components/registry';
import type { ObjectDef, Props, Vec } from '../core/types';
import { localToWorld } from '../core/util';
import type { MBody, MConstraint } from './matter';

export type EntityOrigin = 'fixed' | 'start' | 'build' | 'spawned';

/**
 * Runtime instance of a component inside one Simulation. Owns Matter bodies and a small
 * JSON-able `state` bag which is what rewind snapshots capture (besides body kinematics).
 */
export class Entity {
  readonly id: string;
  readonly type: string;
  readonly def: ComponentDef;
  readonly obj: ObjectDef;
  readonly props: Props;
  readonly origin: EntityOrigin;
  readonly ports: PortSpec[];
  readonly anchors: AnchorSpec[];
  readonly rotor: RotorSpec | null;
  /** Authored position/angle (the placement reference point). */
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly flip: boolean;

  bodies: MBody[] = [];
  constraints: MConstraint[] = [];
  alive = true;
  /** Component-specific mutable runtime state. Keep it flat and JSON-able. */
  state: Record<string, any> = {};
  inputs: Record<string, boolean> = {};
  outputs: Record<string, boolean> = {};
  /** Has this entity already contributed a stage to the chain-reaction log? */
  activated = false;
  /** Solved rotation network speed (rad/tick) or null. */
  omega: number | null = null;
  jammed = false;

  constructor(def: ComponentDef, obj: ObjectDef, props: Props, origin: EntityOrigin) {
    this.def = def;
    this.obj = obj;
    this.id = obj.id;
    this.type = obj.type;
    this.props = props;
    this.origin = origin;
    this.x = obj.x;
    this.y = obj.y;
    this.angle = obj.angle || 0;
    this.flip = !!obj.flip;
    this.ports = resolvePorts(def, props);
    this.anchors = resolveAnchors(def, props);
    this.rotor = resolveRotor(def, props);
    for (const p of this.ports) {
      if (p.dir === 'in') this.inputs[p.id] = false;
      else this.outputs[p.id] = false;
    }
  }

  get body(): MBody {
    return this.bodies[0];
  }

  get locked() {
    return this.origin === 'fixed' || this.origin === 'start';
  }

  /** World position of a local point attached to body `index`. */
  bodyPoint(local: Vec, index = 0): Vec {
    const b = this.bodies[index] ?? this.bodies[0];
    if (!b) return localToWorld(local, { x: this.x, y: this.y }, this.angle, this.flip);
    // Local coordinates are relative to the authored reference frame, which equals the body's
    // frame at creation time. bodyOffset stores the authored-reference offset per body.
    const off: Vec = (b as any).__refOffset ?? { x: 0, y: 0 };
    const lx = (this.flip ? -local.x : local.x) - off.x;
    const ly = local.y - off.y;
    const c = Math.cos(b.angle - ((b as any).__refAngle ?? 0) + this.angle);
    const s = Math.sin(b.angle - ((b as any).__refAngle ?? 0) + this.angle);
    return { x: b.position.x + lx * c - ly * s, y: b.position.y + lx * s + ly * c };
  }

  anchorWorld(anchorId: string): Vec | null {
    const a = this.anchors.find((q) => q.id === anchorId);
    if (!a) return null;
    return this.bodyPoint(a, a.body ?? 0);
  }

  portWorld(portId: string): Vec | null {
    const p = this.ports.find((q) => q.id === portId);
    if (!p) return null;
    return this.bodyPoint(p, 0);
  }

  rotorWorld(): Vec | null {
    if (!this.rotor) return null;
    return this.bodyPoint(this.rotor, this.rotor.body ?? 0);
  }

  isActive(): boolean {
    return this.def.isActive ? this.def.isActive(this) : false;
  }

  num(key: string): number {
    const v = this.props[key];
    return typeof v === 'number' ? v : 0;
  }
  bool(key: string): boolean {
    return this.props[key] === true;
  }
  str(key: string): string {
    const v = this.props[key];
    return typeof v === 'string' ? v : '';
  }
}
