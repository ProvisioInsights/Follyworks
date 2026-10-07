// Core data types shared by the simulation, editor, campaign and persistence.
// Everything in here is plain JSON-serializable data. No Phaser, no Matter.

export const LEVEL_SCHEMA_VERSION = 1;

export type Vec = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type PropValue = number | boolean | string;
export type Props = Record<string, PropValue>;

/** One placed component instance, authored (before RUN). */
export interface ObjectDef {
  id: string;
  type: string;
  x: number;
  y: number;
  /** Radians. */
  angle: number;
  /** Mirror horizontally (used by directional parts such as fans, cannons, robots). */
  flip?: boolean;
  props?: Props;
}

export type ConnectionKind = 'wire' | 'rope' | 'belt';

/** A reference to a port, rope anchor or rotor on an object. */
export interface PortRef {
  obj: string;
  port: string;
}

export interface ConnectionDef {
  id: string;
  kind: ConnectionKind;
  from: PortRef;
  to: PortRef;
  /** Rope only: pulley object ids the rope passes over, in order. */
  via?: string[];
  props?: Props;
}

/** Selects runtime objects for goals. */
export type Selector =
  | { id: string }
  | { type: string }
  | { tag: string };

export type GoalDef =
  | { kind: 'enterRegion'; target: Selector; region: Rect; hold?: number; label?: string }
  | { kind: 'contact'; a: Selector; b: Selector; label?: string }
  /** `count`: that many distinct matching things active at the same time (default 1). */
  | { kind: 'activate'; target: Selector; duration?: number; count?: number; label?: string }
  /** Counts what is inside the container, or what has scored in it when the part keeps a tally (hoop swishes). */
  | { kind: 'containerCount'; container: string; count: number; filter?: Selector; label?: string }
  | { kind: 'height'; target: Selector; maxY: number; label?: string }
  | { kind: 'destroyed'; target: Selector; label?: string };

export interface InventoryItem {
  type: string;
  /** -1 means unlimited. */
  count: number;
}

export interface Restrictions {
  /** Maximum number of parts the player may place (all types). */
  maxParts?: number;
  /** Simulated seconds before the attempt is considered over. */
  timeLimit?: number;
}

export interface BonusDef {
  /** ELEGANT when placed part count is at most this. */
  elegantParts?: number;
  /** ABSURD when the chain reaction reaches at least this many distinct stages. */
  /** Chain stages needed for ABSURD (default 7); 0 means this level offers no ABSURD bonus. */
  absurdStages?: number;
  /** ELEGANT alternatively when solved within this many simulated seconds. */
  elegantTime?: number;
}

export interface LevelMeta {
  author?: string;
  chapter?: number;
  order?: number;
  created?: string;
  updated?: string;
  tutorial?: boolean;
  /** Short note shown on the level card. */
  blurb?: string;
}

/** What moves a tutorial guidance step on. */
export type GuideTrigger =
  /** A part of `type` is in the player's build (near `at` within `radius`, and within `angleTol` of `angle`, when given). */
  | { kind: 'place'; type: string; at?: Vec; radius?: number; angle?: number; angleTol?: number }
  /** The player has made a connection of this kind. */
  | { kind: 'connect'; connection: ConnectionKind }
  /** The player pressed RUN. */
  | { kind: 'run' }
  /** The player pressed "Got it" on the card. */
  | { kind: 'ack' };

/** Where a guidance step points: a spot in the room, a parts-bin entry, or a HUD control. */
export type GuidePointer =
  | { world: Vec }
  | { bin: string }
  | { hud: 'run' | 'rotate' | 'flip' | 'hint' | 'reset' | 'connect' };

/**
 * One step of optional on-screen guidance (tutorial levels mostly). Steps run in order; a step
 * whose trigger is already satisfied is skipped. Guidance never restricts what the player does.
 */
export interface GuideStep {
  text: string;
  point?: GuidePointer;
  /** A translucent outline of a part showing one good place for it. */
  ghost?: { type: string; x: number; y: number; angle?: number; flip?: boolean; props?: Props };
  until: GuideTrigger;
}

export interface WorldDef {
  width: number;
  height: number;
  /** Multiplier on standard gravity. */
  gravity?: number;
}

export interface LevelDef {
  schemaVersion: number;
  id: string;
  name: string;
  description: string;
  environment: string;
  world: WorldDef;
  /** Immovable scenery (walls, shelves, fixed planks). Locked for the player. */
  fixedObjects: ObjectDef[];
  /** Pre-placed parts in their starting state. Locked for the player. */
  startingObjects: ObjectDef[];
  /** Pre-made connections between authored objects. */
  connections: ConnectionDef[];
  inventory: InventoryItem[];
  goals: GoalDef[];
  restrictions?: Restrictions;
  bonus?: BonusDef;
  hints?: string[];
  /** Optional step-by-step on-screen guidance. */
  guide?: GuideStep[];
  metadata?: LevelMeta;
}

/** The player's contribution on top of a level. */
export interface BuildDef {
  objects: ObjectDef[];
  connections: ConnectionDef[];
  /** Campaign autosaves only: fingerprint of the level layout the build was made for. */
  layout?: string;
}

export const emptyBuild = (): BuildDef => ({ objects: [], connections: [] });
