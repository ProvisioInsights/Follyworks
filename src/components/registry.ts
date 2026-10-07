// Central, data-driven component registry keyed by stable type identifiers.
// Every component (ball, motor, fan, robot...) is one ComponentDef. The level format
// refers to components only through `type`, never through scene code.

import type { ObjectDef, Props, PropValue, Vec } from '../core/types';
import type { Entity } from '../sim/Entity';
import type { Noise, Simulation } from '../sim/Simulation';

export type Category = 'basic' | 'mechanical' | 'force' | 'chaos' | 'control' | 'creature' | 'optics' | 'scenery';

export const CATEGORY_LABELS: Record<Category, string> = {
  basic: 'Basics',
  mechanical: 'Mechanical',
  force: 'Air & Heat',
  chaos: 'Chaos',
  control: 'Electric & Logic',
  creature: 'Creatures',
  optics: 'Light & Lasers',
  scenery: 'Scenery',
};

/** Domains are used for chain-reaction legibility and the ABSURD score. */
export type Domain = 'gravity' | 'mechanical' | 'air' | 'heat' | 'electric' | 'logic' | 'chaos' | 'creature' | 'light';

export type PropSpec =
  | { key: string; label: string; type: 'number'; min: number; max: number; step: number; default: number; unit?: string }
  | { key: string; label: string; type: 'bool'; default: boolean }
  | { key: string; label: string; type: 'enum'; options: { value: string; label: string }[]; default: string };

export interface PortSpec {
  id: string;
  /** 'in' consumes power/signal, 'out' provides it. */
  dir: 'in' | 'out';
  x: number;
  y: number;
  label: string;
}

export interface AnchorSpec {
  id: string;
  x: number;
  y: number;
  /** Index into entity.bodies (default 0). */
  body?: number;
  label?: string;
}

export interface RotorSpec {
  x: number;
  y: number;
  /** Effective radius for gear ratios and belts. */
  r: number;
  /** Toothed rotors mesh with neighbouring toothed rotors automatically. */
  teeth: boolean;
  body?: number;
}

export interface ComponentDef {
  type: string;
  name: string;
  category: Category;
  domain: Domain;
  /** One-line tooltip. */
  description: string;
  /** Longer help shown in the properties panel. */
  help?: string;
  tags: string[];
  /** Hidden from the parts bin (internal spawned objects such as cannonballs). */
  internal?: boolean;
  /** Only available as level scenery in the editor (walls). */
  sceneryOnly?: boolean;
  dynamic: boolean;
  rotatable: boolean;
  flippable: boolean;
  /** Snap rotation increments in radians when snapping is on. */
  rotationStep?: number;
  /**
   * Which number props are the part's width and height, so the editor can show drag handles to
   * resize it. Only parts whose physics is built from these props get handles: the body is
   * rebuilt at the new size, so nothing is scaled after the fact.
   */
  resize?: { w?: string; h?: string };
  props: PropSpec[];
  ports?: PortSpec[] | ((props: Props) => PortSpec[]);
  anchors?: AnchorSpec[] | ((props: Props) => AnchorSpec[]);
  rotor?: RotorSpec | ((props: Props) => RotorSpec);
  /** Nominal footprint in world units, used for icons, palette ghosts and editor bounds. */
  size: (props: Props) => { w: number; h: number };
  /** Art key consumed by the renderer. Gameplay never depends on art. */
  art: string;

  // ---- runtime behaviour ----
  /** Create bodies/constraints and initial state. Must be deterministic. */
  build: (e: Entity, sim: Simulation) => void;
  /** Pass-through logic (outputs as a pure function of inputs + state). Called several times per tick. */
  logic?: (e: Entity, sim: Simulation) => void;
  /** Per-tick behaviour before the physics step (forces, timers, edge detection). */
  step?: (e: Entity, sim: Simulation) => void;
  /** Per-tick behaviour after the physics step (sensing). */
  afterStep?: (e: Entity, sim: Simulation) => void;
  /** Rotation network: angular speed this rotor drives, in rad/tick, or null if not a source. */
  rotorSource?: (e: Entity, sim: Simulation) => number | null;
  /** Rotation network: receives solved angular speed (rad/tick) or null when undriven. */
  onRotor?: (e: Entity, omega: number | null, jammed: boolean, sim: Simulation) => void;
  /** Touched by flame/heat. */
  onHeat?: (e: Entity, sim: Simulation) => void;
  /** Hit by an explosion. */
  onBlast?: (e: Entity, sim: Simulation, from: Vec, strength: number) => void;
  /** Collision began with another entity (or world wall when other is null). */
  onCollide?: (e: Entity, other: Entity | null, info: CollideInfo, sim: Simulation) => void;
  /** Heard a noise (squawk, bell, bang) made within the noise's radius this tick. */
  onNoise?: (e: Entity, noise: Noise, sim: Simulation) => void;
  /** A rope attached at `anchor` pulled with impulse magnitude in direction dir (world). */
  onRopePull?: (e: Entity, anchor: string, impulse: number, dir: Vec, sim: Simulation) => void;
  /** Container interior in local coordinates (for containerCount goals). */
  interior?: (props: Props) => { x: number; y: number; w: number; h: number };
  /**
   * Ids of the entities that have scored in this part (a hoop's swishes). When defined,
   * containerCount goals count these instead of what is inside `interior`, with no hold time.
   */
  tally?: (e: Entity) => string[];
  /** Whether the entity currently counts as "active" for activate goals and visuals. */
  isActive?: (e: Entity) => boolean;
}

export interface CollideInfo {
  /** Normal pointing from this entity towards the other. */
  normal: Vec;
  /** Relative speed along the normal (px/tick, positive = approaching). */
  speed: number;
  point: Vec;
  /** Index of this entity's body involved. */
  bodyIndex: number;
}

const registry = new Map<string, ComponentDef>();

export const registerComponent = (def: ComponentDef) => {
  if (registry.has(def.type)) throw new Error(`Duplicate component type ${def.type}`);
  registry.set(def.type, def);
  return def;
};

export const getComponent = (type: string): ComponentDef | undefined => registry.get(type);
export const allComponents = (): ComponentDef[] => [...registry.values()];
export const paletteComponents = (): ComponentDef[] => allComponents().filter((d) => !d.internal);

export const resolvePorts = (def: ComponentDef, props: Props): PortSpec[] =>
  typeof def.ports === 'function' ? def.ports(props) : def.ports ?? [];
export const resolveAnchors = (def: ComponentDef, props: Props): AnchorSpec[] =>
  typeof def.anchors === 'function' ? def.anchors(props) : def.anchors ?? [];
export const resolveRotor = (def: ComponentDef, props: Props): RotorSpec | null =>
  (typeof def.rotor === 'function' ? def.rotor(props) : def.rotor) ?? null;

/** Fill in defaults and clamp values to the spec. Unknown keys are dropped. */
export const normalizeProps = (def: ComponentDef, props: Props | undefined): Props => {
  const out: Props = {};
  for (const spec of def.props) {
    const raw: PropValue | undefined = props?.[spec.key];
    if (spec.type === 'number') {
      const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : spec.default;
      out[spec.key] = Math.min(spec.max, Math.max(spec.min, n));
    } else if (spec.type === 'bool') {
      out[spec.key] = typeof raw === 'boolean' ? raw : spec.default;
    } else {
      out[spec.key] = typeof raw === 'string' && spec.options.some((o) => o.value === raw) ? raw : spec.default;
    }
  }
  return out;
};

export const defaultObject = (type: string, x: number, y: number, id: string): ObjectDef => {
  const def = getComponent(type);
  return { id, type, x, y, angle: 0, props: def ? normalizeProps(def, {}) : {} };
};
