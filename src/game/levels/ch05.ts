// Chapter 5 — Ropes & Pulleys. Pulling, suspended loads, redirected force, counterbalance.
// Pure level data; `solutions` are test fixtures only (validated in tests/levels/chapters_b.test.ts).

import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const rope = (id: string, from: string, fromPort: string, to: string, toPort: string, via: string[] = []): ConnectionDef => ({
  id,
  kind: 'rope',
  from: { obj: from, port: fromPort },
  to: { obj: to, port: toPort },
  via,
});

const WORLD = { width: 1600, height: 900, gravity: 1 };

// ---------------------------------------------------------------- 5-1: counterweight lift

const counterCulture: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c5-counter-culture',
    name: 'Counter Culture',
    description: 'The crate wants to live in the loft. Hang something heavier on the other end of a rope and let gravity do the lifting.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('c5a-beam', 'wall', 800, 110, { w: 360, h: 24, material: 'steel' }),
      o('c5a-post', 'wall', 800, 61, { w: 20, h: 74, material: 'steel' }),
      o('c5a-pulley', 'pulley', 800, 160),
      o('c5a-loft', 'wall', 170, 380, { w: 340, h: 24, material: 'wood' }),
      o('c5a-loft-leg', 'wall', 330, 640, { w: 20, h: 496, material: 'wood' }),
    ],
    startingObjects: [o('c5a-crate', 'crate', 640, 878)],
    connections: [],
    inventory: [
      { type: 'rope', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'bowling_ball', count: 2 },
      { type: 'crate', count: 1 },
    ],
    goals: [{ kind: 'height', target: { id: 'c5a-crate' }, maxY: 400, label: 'Hoist the crate up to loft level' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 2, elegantTime: 3, absurdStages: 5 },
    hints: [
      'Ropes can be routed over a pulley: tie one end, click the pulley, then tie the other end.',
      'Whatever hangs on the other side has to outweigh a 3 kg crate. An empty bucket weighs only 2 kg.',
      'Unbolt the bucket in its properties so it can hang, then fill it with something heavy. A steel crate works too.',
    ],
    metadata: { chapter: 5, order: 1, author: 'Follyworks', blurb: 'Heavy goes down so light can go up.' },
  },
  solutions: [
    {
      // Bucket of bowling ball as a counterweight.
      objects: [o('s-bucket', 'bucket', 980, 300, { anchored: false }), o('s-iron', 'bowling_ball', 980, 290)],
      connections: [rope('s-rope', 'c5a-crate', 'hook', 's-bucket', 'handle', ['c5a-pulley'])],
    },
    {
      // A steel crate is heavy enough on its own.
      objects: [o('s-steel', 'crate', 990, 300, { material: 'steel' })],
      connections: [rope('s-rope', 'c5a-crate', 'hook', 's-steel', 'hook', ['c5a-pulley'])],
    },
    // ABSURD: the bucket counterweight gets a second bowling ball dropped in, and the rising crate bumps a spare crate on the way.
    {
      objects: [
        o('s-bucket', 'bucket', 980, 300, { anchored: false }),
        o('s-iron', 'bowling_ball', 980, 290),
        o('s-crate', 'crate', 640, 780),
        o('s-iron2', 'bowling_ball', 975, 215),
      ],
      connections: [rope('s-rope', 'c5a-crate', 'hook', 's-bucket', 'handle', ['c5a-pulley'])],
    },
  ],
};

// ---------------------------------------------------------------- 5-2: redirected pull

const pullTheOtherOne: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'c5-pull-the-other-one',
    name: 'Pull the Other One',
    description: 'Drag the crate along the ledge onto the loading dock. Nobody is going to push it, but something could fall down the shaft.',
    environment: 'underground',
    world: WORLD,
    fixedObjects: [
      o('c5b-ledge', 'wall', 550, 650, { w: 1100, h: 500, material: 'concrete' }),
      o('c5b-pulley', 'pulley', 1120, 376),
      o('c5b-bracket', 'wall', 1120, 345, { w: 20, h: 30, material: 'steel' }),
      o('c5b-dock-sign', 'wall', 930, 250, { w: 180, h: 20, material: 'wood' }),
    ],
    startingObjects: [o('c5b-crate', 'crate', 420, 378)],
    connections: [],
    inventory: [
      { type: 'rope', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'bowling_ball', count: 1 },
      { type: 'ball', count: 2 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'c5b-crate' },
        region: { x: 780, y: 300, w: 300, h: 100 },
        hold: 0.5,
        label: 'Park the crate on the loading dock',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 3, elegantTime: 4, absurdStages: 5 },
    hints: [
      'A pulley turns a downward pull into a sideways one.',
      'Run a rope from the crate over the pulley at the edge, and hang a weight down the shaft.',
      'Rubber balls are too light to drag a crate. Bowling balls are not.',
    ],
    metadata: { chapter: 5, order: 2, author: 'Follyworks', blurb: 'Falling sideways, technically.' },
  },
  solutions: [
    {
      objects: [o('s-bucket', 'bucket', 1200, 470, { anchored: false }), o('s-iron', 'bowling_ball', 1200, 460)],
      connections: [rope('s-rope', 'c5b-crate', 'hook', 's-bucket', 'handle', ['c5b-pulley'])],
    },
    // ABSURD: bucket counterweight topped with a rubber ball; the rising crate shoves a ball off the ledge.
    {
      objects: [
        o('s-bucket', 'bucket', 1200, 470, { anchored: false }),
        o('s-iron', 'bowling_ball', 1200, 460),
        o('s-ball-a', 'ball', 560, 386),
        o('s-ball-b', 'ball', 1200, 410),
      ],
      connections: [rope('s-rope', 'c5b-crate', 'hook', 's-bucket', 'handle', ['c5b-pulley'])],
    },
  ],
};

export const CHAPTER_5: CampaignEntry[] = [counterCulture, pullTheOtherOne];
