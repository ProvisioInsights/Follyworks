// Chapter 8 — Electricity. Batteries, wires, switches and powered devices.
// Pure level data; `solutions` are test fixtures only (validated in tests/levels/chapters_b.test.ts).

import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const link = (id: string, kind: 'wire' | 'rope' | 'belt', from: string, fromPort: string, to: string, toPort: string, via?: string[]): ConnectionDef =>
  via ? { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort }, via } : { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort } };

const WORLD = { width: 1600, height: 900, gravity: 1 };

// ---------------------------------------------------------------- 8-1: Bolt, power and the off switch

const wakeUpCall: CampaignEntry = {
  chapter: 8,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c8-wake-up-call',
    name: 'Wake-Up Call',
    description: 'Bolt is out of juice. Power him up so he marches to his charging dock, and make sure he stays parked there for five whole seconds.',
    environment: 'basement',
    world: WORLD,
    fixedObjects: [
      o('c8a-left-wall', 'wall', 120, 760, { w: 20, h: 280, material: 'brick' }),
      o('c8a-dock-back', 'wall', 1480, 750, { w: 40, h: 300, material: 'steel' }),
      o('c8a-dock-canopy', 'wall', 1380, 610, { w: 240, h: 20, material: 'steel' }),
    ],
    startingObjects: [o('c8a-bolt', 'robot', 260, 878, { speed: 70, awake: false })],
    connections: [],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'toggle_switch', count: 1 },
      { type: 'magnet', count: 1 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'c8a-bolt' },
        region: { x: 1320, y: 800, w: 140, h: 100 },
        hold: 5,
        label: 'Keep Bolt in his charging dock for 5 seconds',
      },
    ],
    restrictions: { timeLimit: 30 },
    bonus: { elegantParts: 2, elegantTime: 25, absurdStages: 4 },
    hints: [
      'Wire a battery to Bolt’s antenna and he walks for as long as the power flows.',
      'Left powered, Bolt bumps the back of the dock, turns round and wanders off again.',
      'A toggle switch flips whenever something walks through its lever. Flip the switch over so walking right turns it OFF. Or let a strong magnet hold on to him.',
    ],
    metadata: { chapter: 8, order: 1, author: 'Follyworks', blurb: 'Power on. Power off. Good robot.' },
  },
  solutions: [
    {
      // Battery -> toggle switch (flipped, starts ON) -> Bolt. He switches himself off in the dock.
      objects: [o('s-battery', 'battery', 60, 871), o('s-switch', 'toggle_switch', 1360, 872, { on: true }, 0, true)],
      connections: [
        link('s-w1', 'wire', 's-battery', 'out', 's-switch', 'in'),
        link('s-w2', 'wire', 's-switch', 'out', 'c8a-bolt', 'in'),
      ],
    },
    {
      // Battery powers Bolt and a full-strength magnet at the back of the dock, which holds him there.
      objects: [o('s-battery', 'battery', 60, 871), o('s-magnet', 'magnet', 1430, 878, { strength: 10, reach: 260 }, 0, true)],
      connections: [
        link('s-w1', 'wire', 's-battery', 'out', 'c8a-bolt', 'in'),
        link('s-w2', 'wire', 's-battery', 'out', 's-magnet', 'in'),
      ],
    },
    // ABSURD: belt and braces: the dock switch cuts power to Bolt and a magnet grabs him too.
    {
      objects: [
        o('s-battery', 'battery', 60, 871),
        o('s-switch', 'toggle_switch', 1360, 872, { on: true }, 0, true),
        o('s-magnet', 'magnet', 1430, 878, { strength: 10, reach: 260 }, 0, true),
      ],
      connections: [
        link('s-w1', 'wire', 's-battery', 'out', 's-switch', 'in'),
        link('s-w2', 'wire', 's-switch', 'out', 'c8a-bolt', 'in'),
        link('s-w3', 'wire', 's-battery', 'out', 's-magnet', 'in'),
      ],
    },
  ],
};

// ---------------------------------------------------------------- 8-2: flip a high switch, any way you like

const flipTheSwitch: CampaignEntry = {
  chapter: 8,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c8-flip-the-switch',
    name: 'Out of Reach',
    description: 'The conveyor is wired up and ready, but its switch is up on a pillar out of reach. Flick it ON from afar and ship the crate into the loading bay.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('c8b-pillar', 'wall', 600, 710, { w: 40, h: 380, material: 'brick' }),
      o('c8b-bay-wall', 'wall', 1560, 780, { w: 40, h: 240, material: 'brick' }),
    ],
    startingObjects: [
      o('c8b-switch', 'toggle_switch', 600, 500, { on: false }),
      o('c8b-battery', 'battery', 700, 871),
      o('c8b-conveyor', 'conveyor', 1000, 700, { length: 400, speed: 120, dir: 'right' }),
      o('c8b-crate', 'crate', 860, 667),
    ],
    connections: [
      link('c8b-w1', 'wire', 'c8b-battery', 'out', 'c8b-switch', 'in'),
      link('c8b-w2', 'wire', 'c8b-switch', 'out', 'c8b-conveyor', 'in'),
    ],
    inventory: [
      { type: 'ball', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'rope', count: 1 },
      { type: 'balloon', count: 1 },
      { type: 'crate', count: 1 },
      { type: 'pulley', count: 1 },
    ],
    goals: [
      { kind: 'activate', target: { id: 'c8b-switch' }, label: 'Flick the pillar switch ON' },
      {
        kind: 'enterRegion',
        target: { id: 'c8b-crate' },
        region: { x: 1220, y: 780, w: 320, h: 120 },
        hold: 0.5,
        label: 'Ship the crate into the loading bay',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 2, elegantTime: 6, absurdStages: 6 },
    hints: [
      'The switch turns ON when something moves rightwards through its lever, or when its lever is pulled rightwards by a rope.',
      'A ball rolling down a ramp makes a fine finger.',
      'Or tie a rope to the lever and let something tug it to the right: a balloon drifting up and right, or a weight over a pulley.',
    ],
    metadata: { chapter: 8, order: 2, author: 'Follyworks', blurb: 'Remote control, the hard way.' },
  },
  solutions: [
    {
      // Ball rolls down a ramp and through the lever.
      objects: [o('s-ramp', 'plank', 440, 470, { length: 300 }, 0.15), o('s-ball', 'ball', 330, 420)],
      connections: [],
    },
    {
      // Balloon tugs the lever up and to the right.
      objects: [o('s-balloon', 'balloon', 720, 380)],
      connections: [link('s-rope', 'rope', 'c8b-switch', 'lever', 's-balloon', 'string')],
    },
    {
      // Counterweight crate over a pulley pulls the lever rightwards.
      objects: [o('s-pulley', 'pulley', 760, 470), o('s-weight', 'crate', 800, 560)],
      connections: [link('s-rope', 'rope', 'c8b-switch', 'lever', 's-weight', 'hook', ['s-pulley'])],
    },
    // ABSURD: ramp and ball as before, plus a crate in the bay roped over a pulley to a balloon.
    {
      objects: [
        o('s-ramp', 'plank', 440, 470, { length: 300 }, 0.15),
        o('s-ball', 'ball', 330, 420),
        o('s-crate', 'crate', 1380, 870),
        o('s-pulley', 'pulley', 1255, 820),
        o('s-balloon', 'balloon', 1255, 710),
      ],
      connections: [link('s-rope', 'rope', 's-crate', 'hook', 's-balloon', 'string', ['s-pulley'])],
    },
  ],
};

export const CHAPTER_8: CampaignEntry[] = [wakeUpCall, flipTheSwitch];
