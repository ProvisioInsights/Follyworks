// Chapter 6 — Mechanical Power. Motors, gears, belts, conveyors, continuous motion.
// Pure level data; `solutions` are test fixtures only (validated in tests/levels/chapters_b.test.ts).

import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const link = (id: string, kind: 'wire' | 'rope' | 'belt', from: string, fromPort: string, to: string, toPort: string, via?: string[]): ConnectionDef =>
  via ? { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort }, via } : { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort } };

const WORLD = { width: 1600, height: 900, gravity: 1 };

// ---------------------------------------------------------------- 6-1: belts keep direction, gears flip it

const beltUp: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c6-belt-up',
    name: 'Zig and Zag',
    description: 'One motor, two conveyors, one zig-zagging crate. Drive both belts so the crate rides right, drops, rides left and lands in the shipping bay.',
    environment: 'maintenance',
    world: WORLD,
    fixedObjects: [
      o('c6a-upper-leg', 'wall', 330, 640, { w: 20, h: 260, material: 'steel' }),
      o('c6a-lower-leg', 'wall', 1180, 830, { w: 20, h: 120, material: 'steel' }),
      o('c6a-backstop', 'wall', 1210, 640, { w: 20, h: 240, material: 'steel' }),
      o('c6a-bay-wall', 'wall', 250, 820, { w: 20, h: 160, material: 'brick' }),
    ],
    startingObjects: [
      o('c6a-top', 'conveyor', 520, 500, { length: 400, speed: 110, dir: 'right' }),
      o('c6a-bottom', 'conveyor', 930, 760, { length: 520, speed: 110, dir: 'right' }),
      o('c6a-crate', 'crate', 400, 467),
      o('c6a-battery', 'battery', 1480, 871),
      o('c6a-motor', 'motor', 1340, 876, { rpm: 80, dir: 'cw' }),
    ],
    connections: [link('c6a-w1', 'wire', 'c6a-battery', 'out', 'c6a-motor', 'in')],
    inventory: [
      { type: 'belt', count: 2 },
      { type: 'gear', count: 2 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'c6a-crate' },
        region: { x: 270, y: 800, w: 450, h: 100 },
        hold: 0.5,
        label: 'Deliver the crate to the shipping bay',
      },
    ],
    restrictions: { timeLimit: 30 },
    bonus: { elegantParts: 3, elegantTime: 12, absurdStages: 5 },
    hints: [
      'A belt links two wheels and both turn the same way. The motor turns clockwise, which rolls a conveyor to the right.',
      'Gears that mesh turn in opposite directions.',
      'Mesh a gear against the motor, then belt that gear to the lower conveyor.',
    ],
    metadata: { chapter: 6, order: 1, author: 'Follyworks', blurb: 'Clockwise, anticlockwise, shipped.' },
  },
  solutions: [
    {
      objects: [o('s-gear', 'gear', 1340, 828, { size: 'medium' })],
      connections: [
        link('s-b1', 'belt', 'c6a-motor', 'rotor', 'c6a-top', 'rotor'),
        link('s-b2', 'belt', 's-gear', 'rotor', 'c6a-bottom', 'rotor'),
      ],
    },
    // ABSURD: two meshed gears relay the motor, each belted to one of the drums.
    {
      objects: [
        o('s-gear', 'gear', 1340, 828, { size: 'medium' }),
        o('s-gear2', 'gear', 1340, 772, { size: 'small' }),
      ],
      connections: [link('s-b1', 'belt', 's-gear2', 'rotor', 'c6a-top', 'rotor'), link('s-b2', 'belt', 's-gear', 'rotor', 'c6a-bottom', 'rotor')],
    },
  ],
};

// ---------------------------------------------------------------- 6-2: winch vs counterweight

const winchWayUp: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c6-winch-way-up',
    name: 'Winch Way Up',
    description: 'This steel crate weighs as much as a small regret. Lift it above the yellow line, by motor or by sheer counterweight.',
    environment: 'research',
    world: WORLD,
    fixedObjects: [
      o('c6b-gantry', 'wall', 900, 90, { w: 700, h: 28, material: 'steel' }),
      o('c6b-pillar-l', 'wall', 560, 250, { w: 24, h: 300, material: 'steel' }),
      o('c6b-pillar-r', 'wall', 1240, 250, { w: 24, h: 300, material: 'steel' }),
    ],
    startingObjects: [
      o('c6b-crate', 'crate', 860, 878, { material: 'steel' }),
      o('c6b-battery', 'battery', 120, 871),
      o('c6b-motor', 'motor', 260, 876, { rpm: 60, dir: 'cw' }),
    ],
    connections: [link('c6b-w1', 'wire', 'c6b-battery', 'out', 'c6b-motor', 'in')],
    inventory: [
      { type: 'pulley', count: 2 },
      { type: 'rope', count: 2 },
      { type: 'belt', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'bowling_ball', count: 1 },
    ],
    goals: [{ kind: 'height', target: { id: 'c6b-crate' }, maxY: 380, label: 'Lift the steel crate above the line' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 3, elegantTime: 5, absurdStages: 5 },
    hints: [
      'A pulley belted to a running motor becomes a winch. A rope tied straight to the pulley gets reeled in.',
      'Or skip the electricity: an 8 kg crate loses a tug-of-war against a bucket holding a bowling ball.',
    ],
    metadata: { chapter: 6, order: 2, author: 'Follyworks', blurb: 'Two ways up. Pick one.' },
  },
  solutions: [
    {
      // Motor-driven winch.
      objects: [o('s-winch', 'pulley', 860, 150)],
      connections: [
        link('s-rope', 'rope', 'c6b-crate', 'hook', 's-winch', 'drum'),
        link('s-belt', 'belt', 'c6b-motor', 'rotor', 's-winch', 'rotor'),
      ],
    },
    {
      // Counterweight over a pulley.
      objects: [
        o('s-pulley', 'pulley', 960, 150),
        o('s-bucket', 'bucket', 1080, 260, { anchored: false }),
        o('s-iron', 'bowling_ball', 1080, 250),
      ],
      connections: [link('s-rope', 'rope', 'c6b-crate', 'hook', 's-bucket', 'handle', ['s-pulley'])],
    },
    // ABSURD: belt and braces: the motor winch and a bucket counterweight haul on the crate together.
    {
      objects: [
        o('s-winch', 'pulley', 860, 150),
        o('s-pulley', 'pulley', 960, 150),
        o('s-bucket', 'bucket', 1080, 260, { anchored: false }),
        o('s-iron', 'bowling_ball', 1080, 250),
      ],
      connections: [link('s-rope', 'rope', 'c6b-crate', 'hook', 's-winch', 'drum'), link('s-belt', 'belt', 'c6b-motor', 'rotor', 's-winch', 'rotor'), link('s-rope2', 'rope', 'c6b-crate', 'hook', 's-bucket', 'handle', ['s-pulley'])],
    },
  ],
};

export const CHAPTER_6: CampaignEntry[] = [beltUp, winchWayUp];
