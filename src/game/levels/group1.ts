// Mission group 1 — Workshop Basics. Things fall. Things hit things.
// Gravity, ramps, rolling, bouncing, dominoes and buckets, dressed up as Incredible Machine
// contraptions: each mission is a mostly built gravity machine with a few gaps, ending in
// something silly (a swish, a bell, pins, toast, a startled cat). Only falling and bumping parts
// here, plus the goofy ones that work by being hit (no wires, motors or power).
// Pure level data; `solutions` and `counterexamples` are test fixtures (tests/levels).

import { STANDARD_WORLD } from '../../core/level';
import { LEVEL_SCHEMA_VERSION, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
/** A fixed sloped board (scenery) running from (x1, y1) to (x2, y2). */
const slope = (id: string, x1: number, y1: number, x2: number, y2: number, material = 'wood', h = 12): ObjectDef =>
  o(id, 'wall', (x1 + x2) / 2, (y1 + y2) / 2, { w: Math.round(Math.hypot(x2 - x1, y2 - y1)), h, material }, Math.atan2(y2 - y1, x2 - x1));
/** A plain wall block centred at (x, y). */
const block = (id: string, x: number, y: number, w: number, h: number, material = 'wood'): ObjectDef => o(id, 'wall', x, y, { w, h, material });

const world = () => ({ ...STANDARD_WORLD });
const DEG = Math.PI / 180;
const meta = (order: number, blurb: string) => ({ chapter: 1, order, author: 'Follyworks', blurb });
/** Floor top is y = 630. Resting centre heights on the floor. */
const FLOOR = 630;

// ---------------------------------------------------------------- 1: knock the basketball into the hoop

const g1a: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-swish-machine',
    name: 'Swish Machine',
    description: 'Bump the basketball off the end of its shelf: it drops through the hoop onto the rubber chicken, and the SQUAWK wakes Whiskers.',
    environment: 'garage',
    world: world(),
    fixedObjects: [
      block('g1a-shelf', 560, 250, 220, 14),
      block('g1a-roof', 590, 186, 180, 10, 'steel'),
      block('g1a-backstop', 790, 260, 14, 150, 'brick'),
      slope('g1a-funnel-l', 690, 330, 728, 380, 'steel', 8),
      slope('g1a-funnel-r', 790, 335, 772, 380, 'steel', 8),
      block('g1a-chute-l', 726, 398, 8, 36, 'steel'),
      block('g1a-chute-r', 774, 398, 8, 36, 'steel'),
      o('g1a-hoop', 'basketball_hoop', 746, 432),
      o('g1a-bucket', 'bucket', 750, FLOOR - 22),
    ],
    startingObjects: [
      o('g1a-bball', 'basketball', 645, 227),
      o('g1a-chicken', 'rubber_chicken', 750, FLOOR - 17),
      o('g1a-cat', 'cat', 960, FLOOR - 14),
    ],
    connections: [],
    inventory: [
      { type: 'ball', count: 2 },
      { type: 'plank', count: 2 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g1a-hoop', count: 1, filter: { id: 'g1a-bball' }, label: 'Swish the basketball through the hoop' },
      { kind: 'activate', target: { id: 'g1a-cat' }, label: 'Wake up Whiskers' },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 2, elegantTime: 5, absurdStages: 8 },
    hints: [
      'A ball dropped straight onto the shelf just bounces on the spot. It has to arrive rolling.',
      'Put a plank sloping down onto the left end of the shelf, and drop a rubber ball on it.',
    ],
    metadata: meta(1, 'Cause, meet effect. Effect, meet cat.'),
  },
  solutions: [
    { objects: [o('plank-a', 'plank', 360, 200, { length: 200 }, 20 * DEG), o('ball-a', 'ball', 290, 120)], connections: [] },
    // ABSURD: a second ball dives through the hoop first and does the squawking; the basketball swishes after.
    { objects: [o('plank-a', 'plank', 360, 200, { length: 200 }, 20 * DEG), o('ball-a', 'ball', 290, 120), o('ball-b', 'ball', 745, 300)], connections: [] },
  ],
  counterexamples: [
    { why: 'a rubber ball is dropped through the hoop instead of the basketball', build: { objects: [o('ball-a', 'ball', 745, 300)], connections: [] } },
    { why: 'a ball is dropped straight onto the shelf', build: { objects: [o('ball-a', 'ball', 470, 150)], connections: [] } },
  ],
};

// ---------------------------------------------------------------- 2: dominoes ring a bell

const g1b: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-ding-dong',
    name: 'Ding Dong',
    description: 'The ball drops out of the pipe, the dominoes knock each other over, and the last one rings the bell. Except the ball misses the ramp and somebody pinched a domino.',
    environment: 'basement',
    world: world(),
    fixedObjects: [
      block('g1b-pipe-l', 104, 95, 10, 130, 'steel'),
      block('g1b-pipe-r', 156, 95, 10, 130, 'steel'),
      slope('g1b-ramp', 350, 300, 482, 362),
      block('g1b-shelf', 690, 375, 420, 14),
      block('g1b-roof', 735, 296, 170, 10, 'steel'),
      o('g1b-bell', 'bell', 780, 352),
    ],
    startingObjects: [
      o('g1b-ball', 'ball', 130, 80),
      o('g1b-dom-1', 'domino', 520, 339),
      o('g1b-dom-2', 'domino', 560, 339),
      o('g1b-dom-4', 'domino', 680, 339),
      o('g1b-dom-5', 'domino', 720, 339),
    ],
    connections: [],
    inventory: [
      { type: 'plank', count: 2 },
      { type: 'domino', count: 3 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g1b-bell' }, label: 'Ring the bell' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 2, elegantTime: 5, absurdStages: 8 },
    hints: [
      'Press RUN with nothing added and watch where the machine stops working. Each stop is a missing piece.',
      'Tilt a plank under the pipe so the ball rolls onto the ramp, and stand a domino in the gap in the row.',
    ],
    metadata: meta(2, 'Mind the gap.'),
  },
  solutions: [
    { objects: [o('plank-a', 'plank', 232, 250, { length: 240 }, 15 * DEG), o('dom-a', 'domino', 620, 339)], connections: [] },
    // ABSURD: the gap gets two dominoes and the row gets an extra one at the front.
    {
      objects: [
        o('plank-a', 'plank', 232, 250, { length: 240 }, 15 * DEG),
        o('dom-a', 'domino', 600, 339),
        o('dom-b', 'domino', 640, 339),
        o('dom-c', 'domino', 490, 339),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    { why: 'the gap in the domino row is left empty', build: { objects: [o('plank-a', 'plank', 232, 250, { length: 240 }, 15 * DEG)], connections: [] } },
    { why: 'a domino is dropped into the gap with nothing to push it', build: { objects: [o('dom-a', 'domino', 620, 150)], connections: [] } },
  ],
};

// ---------------------------------------------------------------- 3: a bowling ball, a bridge and the pins

const g1c: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-bowled-over',
    name: 'Bowled Over',
    description: 'The bowling ball is waiting on its shelf, the pins are waiting on the lane, and the gutter is waiting for both. Nudge the ball, bridge the gutter, knock down four pins.',
    environment: 'research',
    world: world(),
    fixedObjects: [
      block('g1c-shelf', 345, 260, 190, 14),
      block('g1c-roof', 390, 196, 110, 10, 'steel'),
      slope('g1c-ramp', 440, 260, 600, 340),
      block('g1c-lane', 915, 350, 330, 14),
      block('g1c-lane-leg', 760, 490, 16, 266),
      o('g1c-gutter', 'bucket', 675, FLOOR - 22),
    ],
    startingObjects: [
      o('g1c-bowl', 'bowling_ball', 434, 233),
      o('g1c-pin-1', 'bowling_pin', 900, 315),
      o('g1c-pin-2', 'bowling_pin', 940, 315),
      o('g1c-pin-3', 'bowling_pin', 980, 315),
      o('g1c-pin-4', 'bowling_pin', 1020, 315),
      o('g1c-pin-5', 'bowling_pin', 1060, 315),
    ],
    connections: [],
    inventory: [
      { type: 'ball', count: 2 },
      { type: 'plank', count: 3 },
    ],
    goals: [{ kind: 'activate', target: { type: 'bowling_pin' }, count: 4, label: 'Knock down four pins' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 3, elegantTime: 5, absurdStages: 11 },
    hints: [
      'The bowling ball only needs a nudge to roll off its shelf. Even a rubber ball can manage that, if it arrives rolling.',
      'Without a bridge the bowling ball drops straight into the gutter. Lay a plank across the gap to the lane.',
    ],
    metadata: meta(3, 'Gutter balls need not apply.'),
  },
  solutions: [
    {
      objects: [
        o('plank-a', 'plank', 170, 212, { length: 200 }, 20 * DEG),
        o('ball-a', 'ball', 100, 130),
        o('plank-b', 'plank', 676, 348, { length: 144 }),
      ],
      connections: [],
    },
    // ABSURD: the same strike, plus a spare ball dunked in the gutter bucket for luck.
    {
      objects: [
        o('plank-a', 'plank', 170, 212, { length: 200 }, 20 * DEG),
        o('ball-a', 'ball', 100, 130),
        o('plank-b', 'plank', 676, 348, { length: 144 }),
        o('ball-b', 'ball', 675, 540),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'nothing bridges the gutter',
      build: { objects: [o('plank-a', 'plank', 170, 212, { length: 200 }, 20 * DEG), o('ball-a', 'ball', 100, 130)], connections: [] },
    },
    {
      why: 'a ball is just dropped on the shelf behind the bowling ball',
      build: { objects: [o('ball-a', 'ball', 300, 130), o('plank-b', 'plank', 676, 348, { length: 144 })], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 4: dominoes press the toaster lever

const g1d: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-breakfast-in-bed',
    name: 'Breakfast in Bed',
    description: 'Whiskers wants breakfast in bed. Roll the ball onto the ramp and let the dominoes press the toaster lever: toast into the bucket, and a DING to wake the cat. The domino row is two short.',
    environment: 'greenhouse',
    world: world(),
    fixedObjects: [
      block('g1d-pipe-l', 76, 80, 10, 140, 'steel'),
      block('g1d-pipe-r', 124, 80, 10, 140, 'steel'),
      slope('g1d-ramp', 250, 290, 340, 373),
      block('g1d-shelf', 560, 380, 440, 14),
      block('g1d-dom-roof', 520, 300, 230, 10, 'steel'),
      o('g1d-toaster', 'toaster', 660, 349, { slices: 1 }, 15 * DEG, true),
      block('g1d-cubby-floor', 560, 210, 130, 12),
      block('g1d-cubby-roof', 560, 150, 130, 10),
      o('g1d-bucket', 'bucket', 818, FLOOR - 22),
    ],
    startingObjects: [
      o('g1d-ball', 'ball', 100, 60),
      o('g1d-ball-2', 'ball', 365, 359),
      o('g1d-dom-1', 'domino', 420, 344),
      o('g1d-dom-2', 'domino', 460, 344),
      o('g1d-dom-4', 'domino', 540, 344),
      o('g1d-cat', 'cat', 560, 190, {}, 0, true),
    ],
    connections: [],
    inventory: [
      { type: 'plank', count: 2 },
      { type: 'domino', count: 3 },
      { type: 'ball', count: 1 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g1d-bucket', count: 1, filter: { type: 'toast' }, label: 'Serve the toast into the bucket' },
      { kind: 'activate', target: { id: 'g1d-cat' }, label: 'Wake up Whiskers' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 3, elegantTime: 8, absurdStages: 12 },
    hints: [
      'Tilt a plank under the pipe so the ball rolls onto the ramp and into the other ball.',
      'One domino is missing from the middle of the row, and one from the end, right by the toaster lever.',
    ],
    metadata: meta(4, 'Toast, with a side of yowl.'),
  },
  solutions: [
    {
      objects: [
        o('plank-a', 'plank', 166, 260, { length: 170 }, 20 * DEG),
        o('dom-a', 'domino', 500, 344),
        o('dom-b', 'domino', 580, 344),
      ],
      connections: [],
    },
    // ABSURD: an extra domino at the front of the row, and a ball waiting in the bucket to be toasted.
    {
      objects: [
        o('plank-a', 'plank', 166, 260, { length: 170 }, 20 * DEG),
        o('dom-a', 'domino', 500, 344),
        o('dom-b', 'domino', 580, 344),
        o('dom-c', 'domino', 391, 344),
        o('ball-a', 'ball', 818, 560),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    { why: 'a ball is dropped on the toaster lever', build: { objects: [o('ball-a', 'ball', 627, 100)], connections: [] } },
    {
      why: 'the middle of the domino row is left empty',
      build: { objects: [o('plank-a', 'plank', 166, 260, { length: 170 }, 20 * DEG), o('dom-b', 'domino', 580, 344)], connections: [] },
    },
    {
      why: 'the last domino is missing',
      build: { objects: [o('plank-a', 'plank', 166, 260, { length: 170 }, 20 * DEG), o('dom-a', 'domino', 500, 344)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 5: the mousetrap alley-oop

const g1e: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-alley-oop',
    name: 'Mousetrap Alley-Oop',
    description: 'Dominoes ring the bell, the bell wakes Whiskers, and Whiskers shoves the basketball down the chute. Put a mousetrap at the bottom: SNAP, alley-oop, swish.',
    environment: 'garage',
    world: world(),
    fixedObjects: [
      block('g1e-shelf-a', 235, 250, 290, 14),
      block('g1e-dom-roof', 250, 164, 260, 10, 'steel'),
      o('g1e-bell', 'bell', 372, 222),
      block('g1e-shelf-c', 510, 400, 260, 14),
      block('g1e-cat-roof', 520, 280, 240, 10, 'steel'),
      block('g1e-chute-l', 644, 445, 8, 70, 'steel'),
      block('g1e-chute-r', 692, 405, 8, 150, 'steel'),
      o('g1e-hoop', 'basketball_hoop', 1003, 420, {}, 0, true),
      slope('g1e-guide-l', 905, 515, 941, 562, 'steel', 8),
      slope('g1e-guide-r', 1035, 505, 999, 562, 'steel', 8),
      o('g1e-bucket', 'bucket', 970, FLOOR - 22),
    ],
    startingObjects: [
      o('g1e-dom-1', 'domino', 140, 214),
      o('g1e-dom-2', 'domino', 180, 214),
      o('g1e-dom-3', 'domino', 220, 214),
      o('g1e-dom-5', 'domino', 300, 214),
      o('g1e-cat', 'cat', 420, 379),
      o('g1e-bball', 'basketball', 560, 377),
      o('g1e-chicken', 'rubber_chicken', 970, FLOOR - 17),
    ],
    connections: [],
    inventory: [
      { type: 'ball', count: 2 },
      { type: 'plank', count: 2 },
      { type: 'domino', count: 2 },
      { type: 'mousetrap', count: 1 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g1e-hoop', count: 1, filter: { id: 'g1e-bball' }, label: 'Alley-oop the basketball through the hoop' },
      { kind: 'activate', target: { id: 'g1e-chicken' }, label: 'Make the rubber chicken squawk' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 4, elegantTime: 6, absurdStages: 16 },
    hints: [
      'Start the dominoes with a ball that arrives rolling, and fill the gap in the row.',
      'A mousetrap flings whatever lands on it up and forward, the same way every time. Put one right under the chute.',
    ],
    metadata: meta(5, 'Snap, crackle, swish.'),
  },
  solutions: [
    {
      objects: [
        o('plank-a', 'plank', 60, 200, { length: 120 }, 25 * DEG),
        o('ball-a', 'ball', 35, 130),
        o('dom-a', 'domino', 260, 214),
        o('trap-a', 'mousetrap', 668, 623),
      ],
      connections: [],
    },
    // ABSURD: one more domino at the head of the row.
    {
      objects: [
        o('plank-a', 'plank', 60, 200, { length: 120 }, 25 * DEG),
        o('ball-a', 'ball', 35, 130),
        o('dom-a', 'domino', 260, 214),
        o('dom-b', 'domino', 124, 214),
        o('trap-a', 'mousetrap', 668, 623),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'there is no mousetrap under the chute',
      build: { objects: [o('plank-a', 'plank', 60, 200, { length: 120 }, 25 * DEG), o('ball-a', 'ball', 35, 130), o('dom-a', 'domino', 260, 214)], connections: [] },
    },
    { why: 'a ball is dropped on the sleeping cat', build: { objects: [o('ball-a', 'ball', 420, 200), o('trap-a', 'mousetrap', 668, 623)], connections: [] } },
    {
      why: 'the gap in the domino row is left empty',
      build: { objects: [o('plank-a', 'plank', 60, 200, { length: 120 }, 25 * DEG), o('ball-a', 'ball', 35, 130), o('trap-a', 'mousetrap', 668, 623)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 6: the cat goes bowling

const g1f: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-cat-bowling',
    name: 'Alley Cat',
    description: 'The ball rolls itself, the bell rings itself, and Whiskers wakes up and runs. Unfortunately, Whiskers runs the wrong way. Turn the cat around and let it bowl.',
    environment: 'basement',
    world: world(),
    fixedObjects: [
      slope('g1f-start', 20, 80, 230, 140),
      block('g1f-shaft-r', 300, 120, 10, 120),
      o('g1f-oops-bucket', 'bucket', 265, FLOOR - 22),
      block('g1f-pipe-l', 362, 415, 8, 290, 'steel'),
      block('g1f-pipe-r', 410, 285, 8, 250, 'steel'),
      o('g1f-dog-bowl', 'bucket', 386, FLOOR - 22),
      block('g1f-cellar-roof', 502, 410, 176, 10, 'steel'),
      block('g1f-cellar-r', 590, 520, 8, 220, 'steel'),
      o('g1f-bell', 'bell', 540, 612),
      o('g1f-laundry', 'bucket', 632, FLOOR - 22),
      block('g1f-lane-a', 740, 487, 140, 14),
      block('g1f-lane-b', 995, 487, 250, 14),
    ],
    startingObjects: [
      o('g1f-ball', 'ball', 40, 60),
      o('g1f-cat', 'cat', 770, 467, {}, 0, true),
      o('g1f-chicken', 'rubber_chicken', 840, FLOOR - 17),
      o('g1f-pin-1', 'bowling_pin', 900, 452),
      o('g1f-pin-2', 'bowling_pin', 940, 452),
      o('g1f-pin-3', 'bowling_pin', 980, 452),
      o('g1f-pin-4', 'bowling_pin', 1020, 452),
      o('g1f-pin-5', 'bowling_pin', 1060, 452),
      o('g1f-pin-6', 'bowling_pin', 1100, 452),
    ],
    connections: [],
    inventory: [
      { type: 'plank', count: 4 },
      { type: 'trampoline', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { type: 'bowling_pin' }, count: 3, label: 'Knock down three pins' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 4, elegantTime: 8, absurdStages: 10 },
    hints: [
      'The ball needs a bridge over the first hole, and something in the cellar to roll it into the bell.',
      'Whiskers runs the way it is facing and turns round at walls. A plank stood on end makes a fine wall.',
      'Cats do not jump gaps. Bridge the one in the lane.',
    ],
    metadata: meta(6, 'Strike, said the cat.'),
  },
  solutions: [
    {
      objects: [
        o('plank-a', 'plank', 288, 238, { length: 120 }, 20 * DEG),
        o('plank-b', 'plank', 425, 470, { length: 100 }, 25 * DEG),
        o('plank-c', 'plank', 685, 436, { length: 80 }, 90 * DEG),
        o('plank-d', 'plank', 840, 487, { length: 58 }),
      ],
      connections: [],
    },
    // ABSURD: a trampoline on the cellar floor gives the ball an extra boing on its way to the bell.
    {
      objects: [
        o('plank-a', 'plank', 288, 238, { length: 120 }, 20 * DEG),
        o('plank-b', 'plank', 425, 470, { length: 100 }, 25 * DEG),
        o('plank-c', 'plank', 685, 436, { length: 80 }, 90 * DEG),
        o('plank-d', 'plank', 840, 487, { length: 58 }),
        o('tramp-a', 'trampoline', 470, 604),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'the first hole is not bridged, so the ball drops into the bucket',
      build: { objects: [o('plank-b', 'plank', 425, 470, { length: 100 }, 25 * DEG), o('plank-c', 'plank', 685, 436, { length: 80 }, 90 * DEG), o('plank-d', 'plank', 840, 487, { length: 58 })], connections: [] },
    },
    {
      why: 'nothing in the cellar rolls the ball into the bell',
      build: { objects: [o('plank-a', 'plank', 288, 238, { length: 120 }, 20 * DEG), o('plank-c', 'plank', 685, 436, { length: 80 }, 90 * DEG), o('plank-d', 'plank', 840, 487, { length: 58 })], connections: [] },
    },
    {
      why: 'nothing turns the cat round, so it runs into the laundry basket',
      build: { objects: [o('plank-a', 'plank', 288, 238, { length: 120 }, 20 * DEG), o('plank-b', 'plank', 425, 470, { length: 100 }, 25 * DEG), o('plank-d', 'plank', 840, 487, { length: 58 })], connections: [] },
    },
    {
      why: 'the lane gap is not bridged, so the cat lands on the chicken',
      build: { objects: [o('plank-a', 'plank', 288, 238, { length: 120 }, 20 * DEG), o('plank-b', 'plank', 425, 470, { length: 100 }, 25 * DEG), o('plank-c', 'plank', 685, 436, { length: 80 }, 90 * DEG)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 7: trampoline alley-oop, toast, cat, dominoes

const g1g: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-bounce-house',
    name: 'Bounce House',
    description: 'Bounce the basketball off a trampoline and through the hoop, then let it fall on the toaster lever. The DING wakes Whiskers, and Whiskers has dominoes to knock over.',
    environment: 'garage',
    world: world(),
    fixedObjects: [
      block('g1g-shelf', 270, 150, 220, 14),
      block('g1g-roof', 300, 86, 180, 10, 'steel'),
      block('g1g-backstop', 500, 160, 14, 150, 'brick'),
      slope('g1g-funnel-l', 400, 230, 438, 280, 'steel', 8),
      slope('g1g-funnel-r', 500, 235, 482, 280, 'steel', 8),
      block('g1g-chute-l', 436, 298, 8, 36, 'steel'),
      block('g1g-chute-r', 484, 298, 8, 36, 'steel'),
      slope('g1g-tray-a', 680, 397, 760, 409),
      slope('g1g-tray-b', 880, 426, 975, 440),
      o('g1g-bell', 'bell', 1034, 425),
      slope('g1g-catch-l', 962, 470, 990, 515, 'steel', 8),
      slope('g1g-catch-r', 1062, 470, 1034, 515, 'steel', 8),
      block('g1g-tube-l', 988, 535, 8, 40, 'steel'),
      block('g1g-tube-r', 1036, 535, 8, 40, 'steel'),
      o('g1g-hoop', 'basketball_hoop', 1012, 574),
      block('g1g-lane-a', 695, 260, 290, 14),
      block('g1g-lane-b', 1015, 260, 210, 14),
      o('g1g-toaster', 'toaster', 645, 233, { slices: 1, power: 300 }, -15 * DEG),
      block('g1g-cat-guard', 690, 246, 6, 14, 'steel'),
      o('g1g-plate', 'bucket', 580, 231),
    ],
    startingObjects: [
      o('g1g-bball', 'basketball', 355, 127),
      o('g1g-cat', 'cat', 1060, 239, {}, 0, true),
      o('g1g-dom-1', 'domino', 700, 224),
      o('g1g-dom-2', 'domino', 730, 224),
      o('g1g-dom-3', 'domino', 760, 224),
      o('g1g-dom-4', 'domino', 790, 224),
      o('g1g-chicken', 'rubber_chicken', 580, 236),
    ],
    connections: [],
    inventory: [
      { type: 'ball', count: 1 },
      { type: 'plank', count: 3 },
      { type: 'trampoline', count: 1 },
      { type: 'domino', count: 2 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g1g-hoop', count: 1, filter: { id: 'g1g-bball' }, label: 'Bounce the basketball through the hoop' },
      { kind: 'activate', target: { id: 'g1g-toaster' }, label: 'Make the toast pop' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 5, elegantTime: 10, absurdStages: 16 },
    hints: [
      'The basketball comes straight down the chute. A trampoline tilted a notch to the right throws it up onto the long tray.',
      'The tray has a hole in it. Fill it, and the basketball rolls into the bell and drops into the hoop.',
      'The bell wakes Whiskers, who runs left. Cats do not jump gaps, but they do knock over dominoes.',
    ],
    metadata: meta(7, 'Boing, DING, swish, clatter, DING.'),
  },
  solutions: [
    {
      objects: [
        o('plank-a', 'plank', 89, 107, { length: 160 }, 20 * DEG),
        o('ball-a', 'ball', 30, 40),
        o('tramp-a', 'trampoline', 460, 560, {}, 15 * DEG),
        o('plank-b', 'plank', 820, 416, { length: 112 }, 10 * DEG),
        o('plank-c', 'plank', 875, 260, { length: 68 }),
      ],
      connections: [],
    },
    // ABSURD: two extra dominoes stretch the row, so Whiskers has more to topple.
    {
      objects: [
        o('plank-a', 'plank', 89, 107, { length: 160 }, 20 * DEG),
        o('ball-a', 'ball', 30, 40),
        o('tramp-a', 'trampoline', 460, 560, {}, 15 * DEG),
        o('plank-b', 'plank', 820, 416, { length: 112 }, 10 * DEG),
        o('plank-c', 'plank', 875, 260, { length: 68 }),
        o('dom-a', 'domino', 820, 224),
        o('dom-b', 'domino', 945, 224),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    { why: 'no trampoline: the basketball just bounces at the bottom', build: { objects: [o('plank-a', 'plank', 89, 107, { length: 160 }, 20 * DEG), o('ball-a', 'ball', 30, 40), o('plank-b', 'plank', 820, 416, { length: 112 }, 10 * DEG), o('plank-c', 'plank', 875, 260, { length: 68 })], connections: [] } },
    { why: 'the hole in the tray is left open', build: { objects: [o('plank-a', 'plank', 89, 107, { length: 160 }, 20 * DEG), o('ball-a', 'ball', 30, 40), o('tramp-a', 'trampoline', 460, 560, {}, 15 * DEG), o('plank-c', 'plank', 875, 260, { length: 68 })], connections: [] } },
    { why: 'nothing bridges the gap, so Whiskers falls off the shelf', build: { objects: [o('plank-a', 'plank', 89, 107, { length: 160 }, 20 * DEG), o('ball-a', 'ball', 30, 40), o('tramp-a', 'trampoline', 460, 560, {}, 15 * DEG), o('plank-b', 'plank', 820, 416, { length: 112 }, 10 * DEG)], connections: [] } },
    { why: 'a domino dropped on the toaster lever pops the toast, but the basketball never moves', build: { objects: [o('dom-a', 'domino', 700, 150), o('tramp-a', 'trampoline', 460, 560, {}, 15 * DEG), o('plank-b', 'plank', 820, 416, { length: 112 }, 10 * DEG)], connections: [] } },
  ],
};

// ---------------------------------------------------------------- 8: zigzag, mousetrap, bell, cat, dominoes, pins

const g1h: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-snap-ding-strike',
    name: 'Snap, Ding, Strike',
    description: 'Get the ball down the zigzag and onto a mousetrap. SNAP: it flies into the bell. DING: Whiskers wakes up, turns round (with help) and stampedes through the dominoes into the pins.',
    environment: 'basement',
    world: world(),
    fixedObjects: [
      slope('g1h-ramp-1', 20, 90, 300, 140),
      slope('g1h-ramp-2', 380, 156, 520, 182),
      block('g1h-shaft-l', 521, 400, 8, 400, 'brick'),
      slope('g1h-shaft-lip', 576, 206, 560, 232, 'brick', 8),
      block('g1h-shaft-r', 559, 366, 8, 268, 'brick'),
      block('g1h-curb', 592, 615, 8, 30, 'brick'),
      block('g1h-bell-arm', 860, 321, 50, 8, 'steel'),
      o('g1h-bell', 'bell', 860, 345),
      o('g1h-bucket', 'bucket', 880, FLOOR - 22),
      block('g1h-shelf-l', 740, 200, 260, 14),
      block('g1h-shelf-r', 995, 200, 130, 14),
      o('g1h-laundry', 'bucket', 1085, FLOOR - 22),
    ],
    startingObjects: [
      o('g1h-ball', 'ball', 40, 70),
      o('g1h-cat', 'cat', 1000, 180),
      o('g1h-dom-1', 'domino', 850, 164),
      o('g1h-dom-2', 'domino', 820, 164),
      o('g1h-dom-3', 'domino', 790, 164),
      o('g1h-dom-4', 'domino', 760, 164),
      o('g1h-dom-5', 'domino', 730, 164),
      o('g1h-pin-1', 'bowling_pin', 702, 165),
      o('g1h-pin-2', 'bowling_pin', 678, 165),
      o('g1h-pin-3', 'bowling_pin', 654, 165),
      o('g1h-pin-4', 'bowling_pin', 630, 165),
      o('g1h-chicken', 'rubber_chicken', 880, FLOOR - 17),
    ],
    connections: [],
    inventory: [
      { type: 'plank', count: 4 },
      { type: 'mousetrap', count: 2 },
    ],
    goals: [
      { kind: 'activate', target: { id: 'g1h-bell' }, label: 'Ring the bell' },
      { kind: 'activate', target: { type: 'bowling_pin' }, count: 3, label: 'Knock down three pins' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 5, elegantTime: 11, absurdStages: 17 },
    hints: [
      'Bridge the hole in the zigzag, and stop the ball flying past the shaft.',
      'A mousetrap at the bottom of the shaft throws the ball up and to the right, the same way every time.',
      'Whiskers wakes up running the wrong way. A plank stood on end turns the cat round, and cats do not jump holes.',
    ],
    metadata: meta(8, 'Snap. Ding. Yowl. Clatter.'),
  },
  solutions: [
    {
      objects: [
        o('plank-a', 'plank', 340, 149, { length: 74 }, 10 * DEG),
        o('plank-b', 'plank', 585, 170, { length: 100 }, 90 * DEG),
        o('trap-a', 'mousetrap', 538, 625),
        o('plank-c', 'plank', 900, 200, { length: 58 }),
        o('plank-d', 'plank', 1048, 160, { length: 60 }, 90 * DEG),
      ],
      connections: [],
    },
    // ABSURD: a second mousetrap catches the ball after the bell and flings it again.
    {
      objects: [
        o('plank-a', 'plank', 340, 149, { length: 74 }, 10 * DEG),
        o('plank-b', 'plank', 585, 170, { length: 100 }, 90 * DEG),
        o('trap-a', 'mousetrap', 538, 625),
        o('plank-c', 'plank', 900, 200, { length: 58 }),
        o('plank-d', 'plank', 1048, 160, { length: 60 }, 90 * DEG),
        o('trap-b', 'mousetrap', 650, 625, {}, 0, true),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    { why: 'the hole in the ramp is left open', build: { objects: [o('plank-b', 'plank', 585, 170, { length: 100 }, 90 * DEG), o('trap-a', 'mousetrap', 538, 625), o('plank-c', 'plank', 900, 200, { length: 58 }), o('plank-d', 'plank', 1048, 160, { length: 60 }, 90 * DEG)], connections: [] } },
    { why: 'nothing stops the ball, so it flies past the shaft', build: { objects: [o('plank-a', 'plank', 340, 149, { length: 74 }, 10 * DEG), o('trap-a', 'mousetrap', 538, 625), o('plank-c', 'plank', 900, 200, { length: 58 }), o('plank-d', 'plank', 1048, 160, { length: 60 }, 90 * DEG)], connections: [] } },
    { why: 'no mousetrap: the ball just lands at the bottom of the shaft', build: { objects: [o('plank-a', 'plank', 340, 149, { length: 74 }, 10 * DEG), o('plank-b', 'plank', 585, 170, { length: 100 }, 90 * DEG), o('plank-c', 'plank', 900, 200, { length: 58 }), o('plank-d', 'plank', 1048, 160, { length: 60 }, 90 * DEG)], connections: [] } },
    { why: 'nothing bridges the gap, so Whiskers falls off the shelf', build: { objects: [o('plank-a', 'plank', 340, 149, { length: 74 }, 10 * DEG), o('plank-b', 'plank', 585, 170, { length: 100 }, 90 * DEG), o('trap-a', 'mousetrap', 538, 625), o('plank-d', 'plank', 1048, 160, { length: 60 }, 90 * DEG)], connections: [] } },
    { why: 'nothing turns Whiskers round, so the cat runs off into the laundry basket', build: { objects: [o('plank-a', 'plank', 340, 149, { length: 74 }, 10 * DEG), o('plank-b', 'plank', 585, 170, { length: 100 }, 90 * DEG), o('trap-a', 'mousetrap', 538, 625), o('plank-c', 'plank', 900, 200, { length: 58 })], connections: [] } },
  ],
};

// ---------------------------------------------------------------- 9: seesaw slam dunk

const g1i: CampaignEntry = {
  chapter: 1,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g1-seesaw-slam',
    name: 'Seesaw Slam Dunk',
    description: 'Roll the bowling ball down onto the seesaw and the basketball takes off for a slam dunk. It lands on the toaster lever, the toast rings the bell, and Whiskers goes bowling.',
    environment: 'garage',
    world: world(),
    fixedObjects: [
      block('g1i-shelf', 345, 150, 190, 14),
      block('g1i-roof', 390, 86, 110, 10, 'steel'),
      slope('g1i-ramp-1', 440, 150, 560, 190),
      slope('g1i-ramp-2', 620, 205, 700, 225),
      o('g1i-seesaw', 'seesaw', 645, 594, { length: 220, tilt: -15 }),
      slope('g1i-funnel-l', 770, 430, 840, 490, 'steel', 8),
      slope('g1i-funnel-r', 960, 420, 888, 490, 'steel', 8),
      block('g1i-chute-l', 840, 503, 8, 26, 'steel'),
      block('g1i-chute-r', 888, 503, 8, 26, 'steel'),
      o('g1i-hoop', 'basketball_hoop', 864, 535),
      o('g1i-toaster', 'toaster', 1000, 606, { slices: 1, power: 900 }, 0, true),
      o('g1i-bell', 'bell', 1000, 285),
      block('g1i-lane-a', 860, 260, 130, 14),
      block('g1i-lane-b', 1045, 260, 130, 14),
      o('g1i-ball-bin', 'bucket', 60, FLOOR - 22),
      o('g1i-crumb-bin', 'bucket', 1080, FLOOR - 22),
    ],
    startingObjects: [
      o('g1i-bowl', 'bowling_ball', 434, 123),
      o('g1i-bball', 'basketball', 550, 545),
      o('g1i-cat', 'cat', 1085, 239, {}, 0, true),
      o('g1i-pin-1', 'bowling_pin', 900, 225),
      o('g1i-pin-2', 'bowling_pin', 876, 225),
      o('g1i-pin-3', 'bowling_pin', 852, 225),
      o('g1i-pin-4', 'bowling_pin', 828, 225),
      o('g1i-chicken', 'rubber_chicken', 1080, FLOOR - 17),
    ],
    connections: [],
    inventory: [
      { type: 'ball', count: 1 },
      { type: 'plank', count: 5 },
      { type: 'domino', count: 1 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g1i-hoop', count: 1, filter: { id: 'g1i-bball' }, label: 'Slam dunk the basketball' },
      { kind: 'activate', target: { type: 'bowling_pin' }, count: 3, label: 'Knock down three pins' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 6, elegantTime: 14, absurdStages: 19 },
    hints: [
      'Nudge the bowling ball with a rolling ball, bridge the hole in its ramp, and stand a plank at the bottom so it drops onto the seesaw.',
      'The basketball comes out of the net just left of the toaster. A gently sloping plank rolls it onto the lever.',
      'Whiskers runs left and does not jump holes.',
    ],
    metadata: meta(9, 'Heavy goes down, light goes up, toast goes DING.'),
  },
  solutions: [
    {
      objects: [
        o('plank-a', 'plank', 170, 102, { length: 200 }, 20 * DEG),
        o('ball-a', 'ball', 100, 20),
        o('plank-b', 'plank', 590, 199, { length: 56 }, 15 * DEG),
        o('plank-e', 'plank', 762, 215, { length: 110 }, 90 * DEG),
        o('plank-c', 'plank', 900, 600, { length: 90 }, 10 * DEG),
        o('plank-d', 'plank', 952, 260, { length: 54 }),
      ],
      connections: [],
    },
    // ABSURD: a domino dropped on the rubber chicken, just for the squawk.
    {
      objects: [
        o('plank-a', 'plank', 170, 102, { length: 200 }, 20 * DEG),
        o('ball-a', 'ball', 100, 20),
        o('plank-b', 'plank', 590, 199, { length: 56 }, 15 * DEG),
        o('plank-e', 'plank', 762, 215, { length: 110 }, 90 * DEG),
        o('plank-c', 'plank', 900, 600, { length: 90 }, 10 * DEG),
        o('plank-d', 'plank', 952, 260, { length: 54 }),
        o('dom-a', 'domino', 1080, 520),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    { why: 'the hole in the ramp is left open', build: { objects: [o('plank-a', 'plank', 170, 102, { length: 200 }, 20 * DEG), o('ball-a', 'ball', 100, 20), o('plank-e', 'plank', 762, 215, { length: 110 }, 90 * DEG), o('plank-c', 'plank', 900, 600, { length: 90 }, 10 * DEG), o('plank-d', 'plank', 952, 260, { length: 54 })], connections: [] } },
    { why: 'nothing stops the bowling ball, so it sails past the seesaw', build: { objects: [o('plank-a', 'plank', 170, 102, { length: 200 }, 20 * DEG), o('ball-a', 'ball', 100, 20), o('plank-b', 'plank', 590, 199, { length: 56 }, 15 * DEG), o('plank-c', 'plank', 900, 600, { length: 90 }, 10 * DEG), o('plank-d', 'plank', 952, 260, { length: 54 })], connections: [] } },
    { why: 'nothing rolls the basketball onto the toaster lever', build: { objects: [o('plank-a', 'plank', 170, 102, { length: 200 }, 20 * DEG), o('ball-a', 'ball', 100, 20), o('plank-b', 'plank', 590, 199, { length: 56 }, 15 * DEG), o('plank-e', 'plank', 762, 215, { length: 110 }, 90 * DEG), o('plank-d', 'plank', 952, 260, { length: 54 })], connections: [] } },
    { why: 'nothing bridges the hole in the lane', build: { objects: [o('plank-a', 'plank', 170, 102, { length: 200 }, 20 * DEG), o('ball-a', 'ball', 100, 20), o('plank-b', 'plank', 590, 199, { length: 56 }, 15 * DEG), o('plank-e', 'plank', 762, 215, { length: 110 }, 90 * DEG), o('plank-c', 'plank', 900, 600, { length: 90 }, 10 * DEG)], connections: [] } },
    { why: 'a rubber ball dropped on the seesaw is too light to launch the basketball', build: { objects: [o('ball-a', 'ball', 735, 300), o('plank-c', 'plank', 900, 600, { length: 90 }, 10 * DEG), o('plank-d', 'plank', 952, 260, { length: 54 })], connections: [] } },
  ],
};

export const GROUP_1: CampaignEntry[] = [g1a, g1b, g1c, g1d, g1e, g1f, g1g, g1h, g1i];
