// The physics engine is the Matter.js build that ships inside Phaser 4 (Phaser's own fork,
// Matter 0.20). Importing it directly from Phaser's source lets the exact same physics code run
// in the browser game and in headless Node tests, without the Phaser renderer.
import MatterNS from 'follyworks-matter';

export const M: any = MatterNS;

// Contact tuning, applied once to the shared Matter build:
// - gentle contacts (resting, rolling) never bounce, so balls roll instead of chattering along on
//   their facets and stacks settle;
// - a body flagged `plugin.absorb` (bucket, net) deadens whatever lands in it instead of Matter's
//   default of using the bouncier of the two materials.
if (!M.Pair.__follyworks) {
  const update = M.Pair.update;
  M.Pair.update = function (pair: any, collision: any, timestamp: number) {
    update.call(this, pair, collision, timestamp);
    const a = collision.parentA;
    const b = collision.parentB;
    if (a.plugin?.absorb || b.plugin?.absorb) pair.restitution = Math.min(a.restitution, b.restitution);
    const n = collision.normal;
    const rv = (b.velocity.x - a.velocity.x) * n.x + (b.velocity.y - a.velocity.y) * n.y;
    if (rv * rv < 1.2 * 1.2) pair.restitution = 0;
  };
  M.Pair.__follyworks = true;
}

export interface MVec {
  x: number;
  y: number;
}

/** Minimal structural typing for the Matter body fields Follyworks touches. */
export interface MBody {
  id: number;
  label: string;
  position: MVec;
  velocity: MVec;
  angle: number;
  angularVelocity: number;
  mass: number;
  inverseMass: number;
  inertia: number;
  inverseInertia: number;
  isStatic: boolean;
  isSensor: boolean;
  parent: MBody;
  parts: MBody[];
  vertices: MVec[];
  bounds: { min: MVec; max: MVec };
  friction: number;
  frictionAir: number;
  restitution: number;
  collisionFilter: { group: number; category: number; mask: number };
  plugin: any;
  [key: string]: any;
}

export interface MConstraint {
  id: number;
  bodyA: MBody | null;
  bodyB: MBody | null;
  pointA: MVec;
  pointB: MVec;
  length: number;
  stiffness: number;
  [key: string]: any;
}

/** Collision categories. */
export const CAT = {
  DEFAULT: 0x0001,
  GEAR: 0x0002,
  WALL: 0x0004,
  SENSOR: 0x0008,
  /** Parts that are purely visual/sensing and should only touch sensors. */
  GHOST: 0x0010,
};

/** Fixed simulation step. Never varies, so runs are repeatable. */
export const STEP_MS = 1000 / 60;
export const STEPS_PER_SECOND = 60;
