// Chapter 9 — Sensors & Logic. Pressure plates, timers, logic boxes, delayed and conditional machinery.
// Pure level data; `solutions` are test fixtures only (validated in tests/levels/chapters_b.test.ts).

import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const link = (id: string, kind: 'wire' | 'rope' | 'belt', from: string, fromPort: string, to: string, toPort: string, via?: string[]): ConnectionDef =>
  via ? { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort }, via } : { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort } };

const WORLD = { width: 1600, height: 900, gravity: 1 };

// ---------------------------------------------------------------- 9-1: wait for the bucket

const waitForIt: CampaignEntry = {
  chapter: 9,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c9-wait-for-it',
    name: 'Wait For It',
    description: 'The boxing glove will knock the ball down the chute, but the bucket is still riding the conveyor. Trigger the punch only once the bucket has arrived.',
    environment: 'research',
    world: WORLD,
    fixedObjects: [
      o('c9a-shelf', 'wall', 834, 432, { w: 300, h: 24, material: 'steel' }),
      o('c9a-shelf-leg', 'wall', 714, 560, { w: 20, h: 232, material: 'steel' }),
      o('c9a-funnel', 'plank', 1016, 470, { length: 78 }, 0.9),
      o('c9a-chute-l', 'wall', 1034, 640, { w: 12, h: 280, material: 'steel' }),
      o('c9a-chute-r', 'wall', 1088, 585, { w: 12, h: 370, material: 'steel' }),
      o('c9a-backstop', 'wall', 1112, 805, { w: 24, h: 70, material: 'steel' }),
    ],
    startingObjects: [
      o('c9a-battery', 'battery', 100, 871),
      o('c9a-conveyor-1', 'conveyor', 425, 860, { length: 450, speed: 100, dir: 'right' }),
      o('c9a-conveyor-2', 'conveyor', 875, 860, { length: 450, speed: 100, dir: 'right' }),
      o('c9a-bucket', 'bucket', 260, 827, { anchored: false }),
      o('c9a-glove', 'boxing_glove', 894, 400, { power: 200 }),
      o('c9a-ball', 'ball', 954, 406),
    ],
    connections: [
      link('c9a-w1', 'wire', 'c9a-battery', 'out', 'c9a-conveyor-1', 'in'),
      link('c9a-w2', 'wire', 'c9a-battery', 'out', 'c9a-conveyor-2', 'in'),
    ],
    inventory: [
      { type: 'timer', count: 1 },
      { type: 'toggle_switch', count: 1 },
      { type: 'pressure_plate', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'c9a-bucket', count: 1, filter: { id: 'c9a-ball' }, label: 'Drop the ball into the travelling bucket' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 1, elegantTime: 10, absurdStages: 8 },
    hints: [
      'Wire anything that sends power into the glove and it punches the moment the power arrives.',
      'A kitchen timer counts down from RUN, then sends power. How long does the bucket take to arrive?',
      'Or let the bucket report its own arrival: it can trip a toggle switch on the way past, or bump a pressure plate turned on its side.',
    ],
    metadata: { chapter: 9, order: 1, author: 'Follyworks', blurb: 'Patience, measured in seconds.' },
  },
  solutions: [
    {
      // Delay: timer counts down, then punches.
      objects: [o('s-timer', 'timer', 900, 300, { delay: 9.5, hold: 0 })],
      connections: [link('s-w1', 'wire', 's-timer', 'out', 'c9a-glove', 'in')],
    },
    {
      // Condition: the bucket trips a switch near the end of the line.
      objects: [o('s-switch', 'toggle_switch', 980, 820, { on: false })],
      connections: [
        link('s-w1', 'wire', 'c9a-battery', 'out', 's-switch', 'in'),
        link('s-w2', 'wire', 's-switch', 'out', 'c9a-glove', 'in'),
      ],
    },
    {
      // Condition: a pressure plate turned on its side acts as a bump sensor at the end of the line.
      objects: [o('s-plate', 'pressure_plate', 1093, 810, { minMass: 0.5 }, -Math.PI / 2)],
      connections: [
        link('s-w1', 'wire', 'c9a-battery', 'out', 's-plate', 'in'),
        link('s-w2', 'wire', 's-plate', 'out', 'c9a-glove', 'in'),
      ],
    },
    // ABSURD: the bucket trips a switch that starts a timer that fires the glove, with a sideways pressure plate along for the ride.
    {
      objects: [
        o('s-switch', 'toggle_switch', 600, 820, { on: false }),
        o('s-timer', 'timer', 900, 300, { delay: 2.5, hold: 0 }),
        o('s-plate', 'pressure_plate', 1093, 810, { minMass: 0.5 }, -Math.PI / 2),
      ],
      connections: [
        link('s-w1', 'wire', 'c9a-battery', 'out', 's-switch', 'in'),
        link('s-w2', 'wire', 's-switch', 'out', 's-timer', 'in'),
        link('s-w3', 'wire', 's-timer', 'out', 'c9a-glove', 'in'),
        link('s-w4', 'wire', 'c9a-battery', 'out', 's-plate', 'in'),
      ],
    },
  ],
};

// ---------------------------------------------------------------- 9-2: blow, but not too much

const puffPiece: CampaignEntry = {
  chapter: 9,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c9-puff-piece',
    name: 'Puff Piece',
    description: 'Breeze the balloon along the ceiling into the drying rack and let it rest there. Blow too long and it meets the cactus. Nobody wants that.',
    environment: 'maintenance',
    world: WORLD,
    fixedObjects: [
      o('c9b-ceiling', 'wall', 800, 60, { w: 1600, h: 40, material: 'concrete' }),
      o('c9b-cactus-shelf', 'wall', 1440, 178, { w: 120, h: 20, material: 'steel' }),
      o('c9b-rack-l', 'wall', 980, 170, { w: 12, h: 60, material: 'wood' }),
      o('c9b-rack-r', 'wall', 1260, 170, { w: 12, h: 60, material: 'wood' }),
      o('c9b-rack-bar', 'wall', 1120, 206, { w: 292, h: 12, material: 'wood' }),
    ],
    startingObjects: [
      o('c9b-battery', 'battery', 640, 871),
      o('c9b-fan', 'fan', 700, 112, { strength: 4, range: 700 }),
      o('c9b-balloon', 'balloon', 780, 101, { lift: 1, color: 'teal' }),
      o('c9b-cactus', 'cactus', 1432, 140),
    ],
    connections: [],
    inventory: [
      { type: 'timer', count: 1 },
      { type: 'toggle_switch', count: 1 },
      { type: 'pressure_plate', count: 1 },
      { type: 'logic_gate', count: 1 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'c9b-balloon' },
        region: { x: 990, y: 70, w: 264, h: 90 },
        hold: 3,
        label: 'Rest the balloon in the drying rack for 3 seconds',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 1, elegantTime: 5, absurdStages: 5 },
    hints: [
      'Wired straight to the battery, the fan never stops. Something has to cut its power at the right moment.',
      'A kitchen timer\u2019s Hold setting keeps its output on for only that many seconds.',
      'Sensors can go anywhere, even upside down: a balloon pressing up on a pressure plate is still pressing it. A NOT logic box turns "pressed" into "stop".',
    ],
    metadata: { chapter: 9, order: 2, author: 'Follyworks', blurb: 'Know when to stop blowing.' },
  },
  solutions: [
    {
      // Timer holds the fan on for under two seconds.
      objects: [o('s-timer', 'timer', 560, 300, { delay: 0, hold: 1.7 })],
      connections: [link('s-w1', 'wire', 's-timer', 'out', 'c9b-fan', 'in')],
    },
    {
      // Tripwire: the balloon flicks a flipped switch OFF as it passes into the rack.
      objects: [o('s-switch', 'toggle_switch', 1090, 120, { on: true }, 0, true)],
      connections: [
        link('s-w1', 'wire', 'c9b-battery', 'out', 's-switch', 'in'),
        link('s-w2', 'wire', 's-switch', 'out', 'c9b-fan', 'in'),
      ],
    },
    {
      // Upside-down pressure plate on the ceiling + NOT box: fan runs until the balloon presses up on it.
      objects: [
        o('s-plate', 'pressure_plate', 1120, 87, { minMass: 0.2 }, Math.PI),
        o('s-not', 'logic_gate', 560, 300, { mode: 'not' }),
      ],
      connections: [
        link('s-w1', 'wire', 'c9b-battery', 'out', 's-plate', 'in'),
        link('s-w2', 'wire', 's-plate', 'out', 's-not', 'a'),
        link('s-w3', 'wire', 's-not', 'out', 'c9b-fan', 'in'),
      ],
    },
    // ABSURD: timer, switch and ceiling plate in series through a NOT box: the fan runs until the balloon presses the plate.
    {
      objects: [
        o('s-timer', 'timer', 560, 300, { delay: 0.2, hold: 0 }),
        o('s-switch', 'toggle_switch', 1050, 120, { on: false }),
        o('s-plate', 'pressure_plate', 1160, 87, { minMass: 0.2 }, Math.PI),
        o('s-not', 'logic_gate', 640, 300, { mode: 'not' }),
      ],
      connections: [
        link('s-w1', 'wire', 'c9b-battery', 'out', 's-timer', 'in'),
        link('s-w2', 'wire', 's-timer', 'out', 's-switch', 'in'),
        link('s-w3', 'wire', 's-switch', 'out', 's-plate', 'in'),
        link('s-w4', 'wire', 's-plate', 'out', 's-not', 'a'),
        link('s-w5', 'wire', 's-not', 'out', 'c9b-fan', 'in'),
      ],
    },
  ],
};

export const CHAPTER_9: CampaignEntry[] = [waitForIt, puffPiece];
