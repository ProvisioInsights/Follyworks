// Chapter 1 — Cause & Effect. Things fall. Things hit things. Switches notice.

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

// ---------------------------------------------------------------- 1-1: one ball hits another

const c1a: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c1-corner-pocket',
    name: 'Corner Pocket',
    description: 'Sink the red ball in the pocket at the end of the table. You may not touch it, but you may certainly hit it with something.',
    environment: 'maintenance',
    world: WORLD,
    fixedObjects: [
      o('c1a-table', 'wall', 950, 612, { w: 500, h: 24, material: 'wood' }),
      o('c1a-leg', 'wall', 760, 756, { w: 24, h: 264, material: 'wood' }),
      o('c1a-pocket-wall', 'wall', 1194, 756, { w: 12, h: 288, material: 'wood' }),
      o('c1a-cushion', 'wall', 1300, 680, { w: 20, h: 440, material: 'brick' }),
    ],
    startingObjects: [o('c1a-target', 'ball', 1166, 586)],
    connections: [],
    inventory: [
      { type: 'ball', count: 1 },
      { type: 'bowling_ball', count: 1 },
      { type: 'plank', count: 2 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'c1a-target' },
        region: { x: 1200, y: 680, w: 90, h: 220 },
        hold: 0.5,
        label: 'Sink the red ball in the pocket',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 1, elegantTime: 4, absurdStages: 3 },
    hints: [
      'A ball rolling along the table will happily pass its speed on to the red ball.',
      'Drop a ball onto a sloped plank at the left end of the table so it arrives rolling.',
    ],
    metadata: { chapter: 1, order: 1, author: 'Follyworks', blurb: 'Cause, meet effect.' },
  },
  solutions: [
    { objects: [o('plank-a', 'plank', 560, 510, { length: 320 }, 0.5), o('ball-a', 'ball', 470, 380)], connections: [] },
    // A bowling ball rolled the same way hits much harder.
    { objects: [o('plank-a', 'plank', 560, 510, { length: 320 }, 0.5), o('bowl-a', 'bowling_ball', 470, 120)], connections: [] },
    // ABSURD: bowling ball down the ramp bonks a parked ball, which knocks the target into the pocket.
    {
      objects: [
        o('plank-a', 'plank', 560, 510, { length: 320 }, 0.5),
        o('bowl-a', 'bowling_ball', 470, 300),
        o('ball-a', 'ball', 1100, 585),
      ],
      connections: [],
    },
  ],
};

// ---------------------------------------------------------------- 1-2: two switches in series

const c1b: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c1-double-trouble',
    name: 'Double Trouble',
    description: 'Two switches stand between the battery and the bulb, one above the other. Both must be ON at the same time.',
    environment: 'underground',
    world: WORLD,
    fixedObjects: [
      o('c1b-shelf-low', 'wall', 850, 640, { w: 400, h: 20, material: 'concrete' }),
      o('c1b-shelf-high', 'wall', 1150, 380, { w: 360, h: 20, material: 'concrete' }),
      o('c1b-switch-a', 'toggle_switch', 900, 630),
      o('c1b-switch-b', 'toggle_switch', 1200, 370),
      o('c1b-battery', 'battery', 1460, 870),
      o('c1b-bulb', 'light_bulb', 1480, 200),
    ],
    startingObjects: [],
    connections: [
      wire('c1b-w1', 'c1b-battery', 'out', 'c1b-switch-a', 'in'),
      wire('c1b-w2', 'c1b-switch-a', 'out', 'c1b-switch-b', 'in'),
      wire('c1b-w3', 'c1b-switch-b', 'out', 'c1b-bulb', 'in'),
    ],
    inventory: [
      { type: 'ball', count: 2 },
      { type: 'plank', count: 4 },
    ],
    goals: [{ kind: 'activate', target: { id: 'c1b-bulb' }, label: 'Light the bulb' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 4, elegantTime: 2.5, absurdStages: 5 },
    hints: [
      'Power has to pass through BOTH switches, so both need flipping.',
      'A ball sitting still on a shelf does nothing. Give each ball a ramp so it arrives rolling.',
    ],
    metadata: { chapter: 1, order: 2, author: 'Follyworks', blurb: 'Series circuits: twice the switches, twice the fun.' },
  },
  solutions: [
    {
      objects: [
        o('plank-a', 'plank', 560, 570, { length: 220 }, 0.3),
        o('ball-a', 'ball', 490, 460),
        o('plank-b', 'plank', 870, 310, { length: 220 }, 0.3),
        o('ball-b', 'ball', 800, 200),
      ],
      connections: [],
    },
    // ABSURD: one ball drops on another on the high shelf; the struck ball flips switch B while the dropper rolls back along a long ramp, off a backstop and down to switch A.
    {
      objects: [
        o('plank-a', 'plank', 521, 582, { length: 293 }, Math.atan2(78, 282)),
        o('ball-a', 'ball', 1100, 356),
        o('ball-b', 'ball', 1086, 180),
        o('plank-c', 'plank', 720, 456, { length: 488 }, Math.atan2(-88, 480)),
        o('plank-d', 'plank', 400, 470, { length: 140 }, 1.5708),
      ],
      connections: [],
    },
  ],
};

export const CHAPTER_1: CampaignEntry[] = [c1a, c1b];
