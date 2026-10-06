// Chapter 0 — Orientation. Five tutorial puzzles that walk through the whole loop:
// place, run, redirect, trigger, connect, and finally a tiny real machine.
// Pure level data; `solutions` are test fixtures only (validated in tests/levels/chapters_a.test.ts).

import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const wire = (id: string, from: string, fromPort: string, to: string, toPort: string): ConnectionDef => ({
  id,
  kind: 'wire',
  from: { obj: from, port: fromPort },
  to: { obj: to, port: toPort },
});

const WORLD = { width: 1600, height: 900, gravity: 1 };

// ---------------------------------------------------------------- T1: place one object and run

const t1: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't1-first-drop',
    name: 'First Drop',
    description: 'Every great machine starts with something falling. Put the rubber ball anywhere above the toy box and press RUN.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t1-box-l', 'wall', 880, 830, { w: 24, h: 140, material: 'wood' }),
      o('t1-box-r', 'wall', 1120, 830, { w: 24, h: 140, material: 'wood' }),
    ],
    startingObjects: [],
    connections: [],
    inventory: [{ type: 'ball', count: 1 }],
    goals: [
      {
        kind: 'enterRegion',
        target: { type: 'ball' },
        region: { x: 892, y: 760, w: 216, h: 140 },
        hold: 1,
        label: 'Get the ball into the toy box',
      },
    ],
    restrictions: { timeLimit: 10 },
    bonus: { elegantParts: 1, elegantTime: 3, absurdStages: 0 },
    hints: [
      'Drag the ball out of the parts bin and let go anywhere in the room.',
      'Things fall straight down. Put the ball directly above the toy box, then press RUN.',
    ],
    metadata: { chapter: 0, order: 1, tutorial: true, author: 'Follyworks', blurb: 'Place one thing. Press RUN. Feel powerful.' },
  },
  solutions: [{ objects: [o('ball-a', 'ball', 1000, 300)], connections: [] }],
};

// ---------------------------------------------------------------- T2: redirect with a ramp

const t2: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't2-ramp-it-up',
    name: 'Ramp It Up',
    description: 'The ball drops straight down the chute and goes nowhere. Use a plank as a ramp to roll it over to the garage door.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t2-chute-l', 'wall', 224, 110, { w: 14, h: 220, material: 'steel' }),
      o('t2-chute-r', 'wall', 296, 110, { w: 14, h: 220, material: 'steel' }),
      o('t2-door-frame', 'wall', 990, 470, { w: 24, h: 140, material: 'brick' }),
    ],
    startingObjects: [o('t2-ball', 'ball', 260, 150)],
    connections: [],
    inventory: [{ type: 'plank', count: 2 }],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 't2-ball' },
        region: { x: 1010, y: 700, w: 590, h: 200 },
        label: 'Roll the ball out through the garage door',
      },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 1, elegantTime: 2.5, absurdStages: 0 },
    hints: [
      'A plank does not have to be flat. Rotate it to make a slope.',
      'Put a tilted plank right under the chute, sloping down to the right.',
    ],
    metadata: { chapter: 0, order: 2, tutorial: true, author: 'Follyworks', blurb: 'Planks: the original redirect.' },
  },
  solutions: [
    { objects: [o('plank-a', 'plank', 380, 480, { length: 300 }, 0.3)], connections: [] },
    // A steep deflector under the chute plus a long gentle slope also works.
    {
      objects: [o('plank-a', 'plank', 300, 420, { length: 200 }, 0.6), o('plank-b', 'plank', 600, 760, { length: 400 }, 0.15)],
      connections: [],
    },
  ],
};

// ---------------------------------------------------------------- T3: use a switch

const t3: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't3-flip-the-switch',
    name: 'Flip the Switch',
    description: 'Switches flip when something rolls through them left to right. Light the bulb by sending a ball through the switch.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t3-ramp', 'plank', 330, 790, { length: 520 }, 0.2),
      o('t3-battery', 'battery', 1080, 870),
      o('t3-switch', 'toggle_switch', 680, 872),
      o('t3-bulb', 'light_bulb', 1300, 420),
      o('t3-shelf', 'wall', 1300, 470, { w: 120, h: 16, material: 'wood' }),
    ],
    startingObjects: [],
    connections: [wire('t3-w1', 't3-battery', 'out', 't3-switch', 'in'), wire('t3-w2', 't3-switch', 'out', 't3-bulb', 'in')],
    inventory: [
      { type: 'ball', count: 1 },
      { type: 'plank', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { id: 't3-bulb' }, label: 'Light the bulb' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 1, elegantTime: 2, absurdStages: 0 },
    hints: [
      'A ball dropped onto the floor just bounces in place. It needs to be moving right.',
      'Drop the ball onto a sloped plank so it rolls along the floor through the switch.',
    ],
    metadata: { chapter: 0, order: 3, tutorial: true, author: 'Follyworks', blurb: 'Power flows when the switch says so.' },
  },
  solutions: [
    { objects: [o('ball-a', 'ball', 180, 560)], connections: [] },
    // Or build your own ramp further right.
    { objects: [o('plank-a', 'plank', 480, 760, { length: 200 }, 0.25), o('ball-a', 'ball', 430, 640)], connections: [] },
  ],
};

// ---------------------------------------------------------------- T4: a mechanical connection (belt)

const t4: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't4-belt-up',
    name: 'Belt Up',
    description: 'The motor is humming but the conveyor is not. Link them with a drive belt to deliver the crate to the loading bay.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t4-battery', 'battery', 180, 870),
      o('t4-motor', 'motor', 330, 876, { rpm: 120, dir: 'cw' }),
      o('t4-conveyor', 'conveyor', 760, 560, { length: 560, speed: 150, dir: 'right' }),
      o('t4-leg-l', 'wall', 520, 735, { w: 20, h: 330, material: 'steel' }),
      o('t4-leg-r', 'wall', 1000, 735, { w: 20, h: 330, material: 'steel' }),
    ],
    startingObjects: [o('t4-crate', 'crate', 560, 527)],
    connections: [wire('t4-w1', 't4-battery', 'out', 't4-motor', 'in')],
    inventory: [{ type: 'belt', count: 1 }],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 't4-crate' },
        region: { x: 1080, y: 640, w: 520, h: 260 },
        label: 'Deliver the crate to the loading bay',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 1, absurdStages: 0 },
    hints: [
      'Pick the drive belt, click the motor, then click the conveyor’s end wheel.',
      'Belted wheels turn the same way. A clockwise motor rolls the conveyor top to the right.',
    ],
    metadata: { chapter: 0, order: 4, tutorial: true, author: 'Follyworks', blurb: 'Belts share the spin.' },
  },
  solutions: [
    {
      objects: [],
      connections: [{ id: 'belt-a', kind: 'belt', from: { obj: 't4-motor', port: 'rotor' }, to: { obj: 't4-conveyor', port: 'rotor' } }],
    },
  ],
};

// ---------------------------------------------------------------- T5: a tiny real machine

const t5: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't5-tiny-machine',
    name: 'The Tiny Machine',
    description:
      'Your first real contraption: roll a ball through the switch, wire the switch to the fan, and let the breeze blow the little ball into the bin.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t5-ramp', 'plank', 300, 520, { length: 440 }, 0.3),
      o('t5-battery', 'battery', 330, 870),
      o('t5-switch', 'toggle_switch', 424, 550, {}, 0.3),
      o('t5-shelf', 'wall', 1040, 540, { w: 300, h: 20, material: 'wood' }),
      o('t5-fan', 'fan', 920, 492, { strength: 5, range: 360 }),
      o('t5-bin-wall', 'wall', 1392, 830, { w: 24, h: 140, material: 'wood' }),
    ],
    startingObjects: [o('t5-ball', 'ball', 990, 516)],
    connections: [wire('t5-w1', 't5-battery', 'out', 't5-switch', 'in')],
    inventory: [
      { type: 'ball', count: 1 },
      { type: 'plank', count: 2 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 't5-ball' },
        region: { x: 1404, y: 640, w: 196, h: 260 },
        hold: 0.5,
        label: 'Blow the shelf ball into the bin',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 1, elegantTime: 3, absurdStages: 0 },
    hints: [
      'The fan only blows while it has power. Draw a wire from the switch’s orange OUT socket to the fan’s cyan IN socket. Wires are free.',
      'Something has to roll through the switch. The ramp on the left is a great place to drop a ball.',
    ],
    metadata: { chapter: 0, order: 5, tutorial: true, author: 'Follyworks', blurb: 'Ball, switch, fan, bin. A real machine!' },
  },
  solutions: [
    {
      objects: [o('ball-a', 'ball', 160, 380)],
      connections: [wire('wire-a', 't5-switch', 'out', 't5-fan', 'in')],
    },
  ],
};

export const CHAPTER_0: CampaignEntry[] = [t1, t2, t3, t4, t5];
