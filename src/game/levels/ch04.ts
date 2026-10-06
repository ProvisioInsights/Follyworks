// Chapter 4 — Springs & Levers. Small push, big shove.

import { LEVEL_SCHEMA_VERSION, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };

const WORLD = { width: 1600, height: 900, gravity: 1 };

// ---------------------------------------------------------------- 4-1: seesaw launch

const c4a: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c4-lever-expectations',
    name: 'Lever Your Expectations',
    description: 'A rubber ball naps on the low end of a seesaw. Fling it up above the shelf line by landing something heavy on the other end.',
    environment: 'basement',
    world: WORLD,
    fixedObjects: [
      o('c4a-stop', 'wall', 530, 880, { w: 20, h: 40, material: 'wood' }),
      o('c4a-shelf', 'wall', 1250, 510, { w: 400, h: 20, material: 'wood' }),
    ],
    startingObjects: [o('c4a-seesaw', 'seesaw', 700, 860, { length: 300, tilt: -12 }), o('c4a-ball', 'ball', 574, 860)],
    connections: [],
    inventory: [
      { type: 'bowling_ball', count: 1 },
      { type: 'crate', count: 1 },
      { type: 'ball', count: 2 },
      { type: 'plank', count: 2 },
    ],
    goals: [{ kind: 'height', target: { id: 'c4a-ball' }, maxY: 500, label: 'Fling the ball above the shelf line' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 1, elegantTime: 2, absurdStages: 6 },
    hints: [
      'A seesaw turns a push down on one end into a push up on the other.',
      'The heavier the thing you drop and the higher you drop it from, the bigger the fling.',
    ],
    metadata: { chapter: 4, order: 1, author: 'Follyworks', blurb: 'Archimedes would be proud. Or alarmed.' },
  },
  solutions: [
    { objects: [o('bowl-a', 'bowling_ball', 818, 200)], connections: [] },
    // ABSURD: a teetering tower of ball, bowling ball, crate and ball collapses onto the seesaw.
    {
      objects: [
        o('ball-a', 'ball', 818, 300),
        o('bowl-a', 'bowling_ball', 818, 200),
        o('crate-a', 'crate', 818, 120),
        o('ball-b', 'ball', 818, 50),
      ],
      connections: [],
    },
  ],
};

// ---------------------------------------------------------------- 4-2: boxing gloves and chained triggers

const c4b: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c4-knock-on-knockout',
    name: 'Knock-On Knockout',
    description: 'The crate on the shelf will not budge for a mere rubber ball. Get the spring-loaded boxing glove to punch it into the bin.',
    environment: 'maintenance',
    world: WORLD,
    fixedObjects: [
      o('c4b-shelf', 'wall', 1050, 520, { w: 420, h: 24, material: 'steel' }),
      o('c4b-glove', 'boxing_glove', 990, 488, { power: 1400 }),
    ],
    startingObjects: [o('c4b-crate', 'crate', 1090, 486)],
    connections: [],
    inventory: [
      { type: 'ball', count: 2 },
      { type: 'plank', count: 3 },
      { type: 'boxing_glove', count: 1 },
      { type: 'seesaw', count: 1 },
      { type: 'bowling_ball', count: 1 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'c4b-crate' },
        region: { x: 1290, y: 600, w: 310, h: 300 },
        hold: 0.5,
        label: 'Punch the crate into the bin',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 2, elegantTime: 3, absurdStages: 5 },
    hints: [
      'The glove fires when something bonks the round plate on its back.',
      'Roll a ball into the back plate. Or punch a ball into it with a second glove, if you enjoy that sort of thing.',
    ],
    metadata: { chapter: 4, order: 2, author: 'Follyworks', blurb: 'One bonk leads to another.' },
  },
  solutions: [
    { objects: [o('plank-a', 'plank', 780, 420, { length: 260 }, 0.35), o('ball-a', 'ball', 700, 320)], connections: [] },
    // A bowling ball rolled into the back plate works just as well.
    { objects: [o('plank-a', 'plank', 780, 420, { length: 260 }, 0.35), o('bowl-a', 'bowling_ball', 700, 310)], connections: [] },
    // Glove-to-glove: a rolling ball bonks a second glove, which punches another ball into the first.
    {
      objects: [
        o('glove-a', 'boxing_glove', 888, 488),
        o('ball-a', 'ball', 933, 494),
        o('plank-a', 'plank', 718, 440, { length: 260 }, 0.35),
        o('ball-b', 'ball', 638, 330),
      ],
      connections: [],
    },
    // ABSURD: glove-to-glove, plus a bowling ball dropped on a spare seesaw for good measure.
    {
      objects: [
        o('glove-a', 'boxing_glove', 888, 488),
        o('ball-a', 'ball', 933, 494),
        o('plank-a', 'plank', 718, 440, { length: 260 }, 0.35),
        o('ball-b', 'ball', 638, 330),
        o('seesaw-a', 'seesaw', 1420, 860, { length: 220, tilt: 0 }),
        o('bowl-a', 'bowling_ball', 1490, 760),
      ],
      connections: [],
    },
  ],
};

export const CHAPTER_4: CampaignEntry[] = [c4a, c4b];
