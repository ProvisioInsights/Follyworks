// Mission group 2 — Levers & Lines. Seesaws, springs, ropes, pulleys, hooks and counterweights.
// Pure level data; `solutions` and `counterexamples` are test fixtures only (tests/levels).

import { STANDARD_WORLD } from '../../core/level';
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

const wire = (id: string, from: string, fromPort: string, to: string, toPort: string): ConnectionDef => ({
  id,
  kind: 'wire',
  from: { obj: from, port: fromPort },
  to: { obj: to, port: toPort },
});

// ---------------------------------------------------------------- 2-1: counterweight bell-ringer

const counterCulture: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-counter-culture',
    name: 'Counter Culture',
    description:
      'The bowling ball is about to bowl down the shelf and drop off the end. Catch it in a hanging bucket tied over the pulleys to the crate, so the crate shoots up and rings the bell.',
    environment: 'garage',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2a-ramp', 'plank', 160, 105, { length: 290 }, 0.31),
      o('g2a-ledge', 'wall', 360, 173, { w: 120, h: 16, material: 'wood' }),
      o('g2a-chute', 'plank', 560, 215, { length: 290 }, 0.26),
      o('g2a-stop', 'wall', 800, 215, { w: 16, h: 130, material: 'brick' }),
      o('g2a-beam', 'wall', 820, 30, { w: 560, h: 20, material: 'steel' }),
      o('g2a-pulley', 'pulley', 960, 70),
      o('g2a-bell', 'bell', 992, 300),
    ],
    startingObjects: [
      o('g2a-ball', 'ball', 40, 32),
      o('g2a-bowl', 'bowling_ball', 412, 145),
      o('g2a-crate', 'crate', 960, 608),
    ],
    connections: [],
    inventory: [
      { type: 'pulley', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'rope', count: 1 },
      { type: 'ball', count: 1 },
      { type: 'plank', count: 1 },
    ],
    goals: [{ kind: 'contact', a: { id: 'g2a-crate' }, b: { id: 'g2a-bell' }, label: 'Lift the crate up into the bell' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 3, elegantTime: 6, absurdStages: 5 },
    hints: [
      'A rope over a pulley is a seesaw made of string: when one end goes down, the other comes up.',
      'An empty bucket is lighter than the crate, so it just hangs there. Something heavy has to land in it.',
      'Put a pulley on the beam right above where the bowling ball drops, hang an unbolted bucket high up under it, and rope the crate over both pulleys to the bucket.',
    ],
    metadata: { chapter: 2, order: 1, author: 'Follyworks', blurb: 'Heavy goes down so light can go up.' },
  },
  solutions: [
    {
      objects: [o('s-pulley', 'pulley', 760, 70), o('s-bucket', 'bucket', 760, 330, { anchored: false })],
      connections: [rope('s-rope', 'g2a-crate', 'hook', 's-bucket', 'handle', ['g2a-pulley', 's-pulley'])],
    },
    // ABSURD: a rubber ball races the bowling ball down the chute and into the bucket.
    {
      objects: [o('s-pulley', 'pulley', 760, 70), o('s-bucket', 'bucket', 760, 330, { anchored: false }), o('s-ball', 'ball', 600, 200)],
      connections: [rope('s-rope', 'g2a-crate', 'hook', 's-bucket', 'handle', ['g2a-pulley', 's-pulley'])],
    },
  ],
  counterexamples: [
    {
      why: 'the bucket hangs where the bowling ball misses it',
      build: {
        objects: [o('s-pulley', 'pulley', 600, 70), o('s-bucket', 'bucket', 600, 380, { anchored: false })],
        connections: [rope('s-rope', 'g2a-crate', 'hook', 's-bucket', 'handle', ['g2a-pulley', 's-pulley'])],
      },
    },
    {
      why: 'the bucket only has a rubber ball in it',
      build: {
        objects: [o('s-pulley', 'pulley', 600, 70), o('s-bucket', 'bucket', 600, 380, { anchored: false }), o('s-ball', 'ball', 600, 370)],
        connections: [rope('s-rope', 'g2a-crate', 'hook', 's-bucket', 'handle', ['g2a-pulley', 's-pulley'])],
      },
    },
  ],
};

// ---------------------------------------------------------------- 2-2: seesaw fling into the hoop

const leverExpectations: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-lever-expectations',
    name: 'Lever Your Expectations',
    description:
      'Whiskers is napping by the bowling pins. Get the bowling ball onto the high end of the seesaw: the rubber chicken goes flying, squawks him awake, and he bowls a strike.',
    environment: 'basement',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2b-ramp', 'wall', 110, 100, { w: 220, h: 14, material: 'wood' }, 0.32),
      o('g2b-ledge', 'wall', 270, 160, { w: 70, h: 16, material: 'wood' }),
      o('g2b-track', 'wall', 340, 215, { w: 140, h: 14, material: 'wood' }, 0.3),
      o('g2b-track-2', 'wall', 520, 320, { w: 160, h: 14, material: 'wood' }, 0.3),
      o('g2b-chute', 'wall', 662, 335, { w: 14, h: 170, material: 'wood' }),
      o('g2b-alley', 'wall', 955, 490, { w: 330, h: 16, material: 'wood' }),
      o('g2b-roof', 'wall', 1000, 402, { w: 240, h: 16, material: 'wood' }),
      o('g2b-toybox', 'wall', 1040, 585, { w: 50, h: 90, material: 'wood' }),
    ],
    startingObjects: [
      o('g2b-ball', 'ball', 30, 58),
      o('g2b-bowl', 'bowling_ball', 299, 132),
      o('g2b-seesaw', 'seesaw', 860, 594, { length: 260, tilt: 12 }),
      o('g2b-chicken', 'rubber_chicken', 960, 604),
      o('g2b-cat', 'cat', 818, 469),
      o('g2b-pin-1', 'bowling_pin', 1000, 454),
      o('g2b-pin-2', 'bowling_pin', 1030, 454),
      o('g2b-pin-3', 'bowling_pin', 1060, 454),
      o('g2b-pin-4', 'bowling_pin', 1090, 454),
    ],
    connections: [],
    inventory: [
      { type: 'plank', count: 2 },
      { type: 'trampoline', count: 2 },
    ],
    goals: [{ kind: 'activate', target: { type: 'bowling_pin' }, count: 3, label: 'Knock down 3 bowling pins' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 3, elegantTime: 8, absurdStages: 16 },
    hints: [
      'Follow the bowling ball: it needs a bridge over the gap, then a way out of the pit at the bottom of the chute.',
      'A trampoline turns a fall into a jump. Tilt it one notch to the right, and stand a plank on end as a wall so the bowling ball drops onto the seesaw’s high end.',
      'Bridge the gap with a plank, put a trampoline turned 15° right on the floor under the chute, and stand the other plank upright just left of the cat’s shelf.',
    ],
    metadata: { chapter: 2, order: 2, author: 'Follyworks', blurb: 'Archimedes would be proud. Or alarmed.' },
  },
  solutions: [
    {
      objects: [
        o('s-bridge', 'plank', 440, 268, { length: 90 }, 0.3),
        o('s-tramp', 'trampoline', 625, 600, {}, Math.PI / 12),
        o('s-stop', 'plank', 795, 385, { length: 120 }, Math.PI / 2),
      ],
      connections: [],
    },
    // ABSURD: the rubber ball follows the bowling ball down and boings about on a spare trampoline.
    {
      objects: [
        o('s-bridge', 'plank', 440, 268, { length: 90 }, 0.3),
        o('s-tramp', 'trampoline', 625, 600, {}, Math.PI / 12),
        o('s-stop', 'plank', 795, 385, { length: 120 }, Math.PI / 2),
        o('s-tramp-2', 'trampoline', 330, 612),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'the trampoline throws the bowling ball clean over the seesaw with no wall to stop it',
      build: { objects: [o('s-bridge', 'plank', 440, 268, { length: 90 }, 0.3), o('s-tramp', 'trampoline', 625, 600, {}, Math.PI / 12)], connections: [] },
    },
    {
      why: 'there is no trampoline to get the bowling ball out of the pit',
      build: { objects: [o('s-bridge', 'plank', 440, 268, { length: 90 }, 0.3), o('s-stop', 'plank', 795, 385, { length: 120 }, Math.PI / 2)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 2-3: mousetrap relay into the hoop

const springFever: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-spring-fever',
    name: 'Spring Fever',
    description:
      'Score a basket with the basketball on the top shelf. Mousetraps make great springs: anything that lands on one goes flying up and forward.',
    environment: 'greenhouse',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2c-ramp', 'plank', 130, 150, { length: 220 }, 0.25),
      o('g2c-stool', 'plank', 430, 500, { length: 160 }),
      o('g2c-shelf', 'plank', 690, 300, { length: 200 }),
      o('g2c-shelf-2', 'plank', 955, 280, { length: 170 }),
      o('g2c-chute-l', 'plank', 1031, 405, { length: 150 }, Math.PI / 2),
      o('g2c-chute-r', 'plank', 1093, 380, { length: 300 }, Math.PI / 2),
      o('g2c-hoop', 'basketball_hoop', 630, 507),
    ],
    startingObjects: [o('g2c-ball', 'ball', 40, 104), o('g2c-hoopball', 'basketball', 1020, 257), o('g2c-chicken', 'rubber_chicken', 640, 620)],
    connections: [],
    inventory: [
      { type: 'mousetrap', count: 2 },
      { type: 'plank', count: 2 },
      { type: 'trampoline', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g2c-hoop', count: 1, filter: { type: 'basketball' }, label: 'Swish the basketball through the hoop' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 3, elegantTime: 7, absurdStages: 6 },
    hints: [
      'A mousetrap throws whatever lands on it the same way every time: up and forward. Flip it to throw the other way.',
      'Catch the rubber ball with a mousetrap on the stool to throw it up to the shelf, and bridge the gap so it can roll into the basketball.',
      'Put a mousetrap on the stool, lay a plank across the gap in the shelf, and set a flipped mousetrap on the floor under the chute.',
    ],
    metadata: { chapter: 2, order: 3, author: 'Follyworks', blurb: 'Boing, with intent.' },
  },
  solutions: [
    {
      objects: [
        o('s-trap', 'mousetrap', 400, 488),
        o('s-bridge', 'plank', 830, 287, { length: 76 }, -0.245),
        o('s-trap-2', 'mousetrap', 1062, 620, {}, 0, true),
      ],
      connections: [],
    },
    // ABSURD: the rubber ball boings off a trampoline on the stool before it lands on the mousetrap.
    {
      objects: [
        o('s-trap', 'mousetrap', 400, 488),
        o('s-tramp', 'trampoline', 745, 278, { power: 0.5 }),
        o('s-bridge', 'plank', 830, 287, { length: 76 }, -0.245),
        o('s-trap-2', 'mousetrap', 1062, 620, {}, 0, true),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'with no bridge the rubber ball drops through the gap in the shelf',
      build: { objects: [o('s-trap', 'mousetrap', 400, 488), o('s-trap-2', 'mousetrap', 1062, 620, {}, 0, true)], connections: [] },
    },
    {
      why: 'the basketball just lands on the floor without a mousetrap under the chute',
      build: { objects: [o('s-trap', 'mousetrap', 400, 488), o('s-bridge', 'plank', 830, 287, { length: 76 }, -0.245)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 2-4: sideways drag over two pulleys

const pullTheOtherOne: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-pull-the-other-one',
    name: 'Pull the Other One',
    description:
      'Make toast! The mousetrap is about to throw the bowling ball. Catch it in a bucket roped to the steel crate, so the crate gets dragged along the shelf and shoves everything onto the toaster lever.',
    environment: 'maintenance',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2d-shelf', 'plank', 110, 230, { length: 160 }),
      o('g2d-ledge', 'plank', 800, 340, { length: 480 }),
      o('g2d-cupboard', 'wall', 915, 225, { w: 150, h: 50, material: 'wood' }),
      o('g2d-toaster', 'toaster', 1010, 309, {}, 0, true),
    ],
    startingObjects: [
      o('g2d-trap', 'mousetrap', 110, 218),
      o('g2d-bowl', 'bowling_ball', 110, 193),
      o('g2d-crate', 'crate', 640, 311, { material: 'steel' }),
      o('g2d-ball', 'ball', 880, 319),
      o('g2d-chicken', 'rubber_chicken', 780, 324),
    ],
    connections: [],
    inventory: [
      { type: 'pulley', count: 2 },
      { type: 'bucket', count: 1 },
      { type: 'rope', count: 1 },
      { type: 'plank', count: 1 },
      { type: 'rubber_chicken', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g2d-toaster' }, label: 'Pop the toast' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 4, elegantTime: 5, absurdStages: 10 },
    hints: [
      'A rope over two pulleys turns a fall into a sideways pull.',
      'Hang a pulley high up where the bowling ball lands, with an unbolted bucket under it. The second pulley goes past the toaster, level with the crate’s hook.',
      'Put a pulley near the top above the bowling ball’s landing spot and another just right of the toaster, hang an unbolted bucket under the first, and rope the bucket over both pulleys to the crate.',
    ],
    metadata: { chapter: 2, order: 4, author: 'Follyworks', blurb: 'Falling sideways, technically.' },
  },
  solutions: [
    {
      objects: [o('s-pulley', 'pulley', 340, 60), o('s-pulley-2', 'pulley', 1090, 284), o('s-bucket', 'bucket', 340, 360, { anchored: false })],
      connections: [rope('s-rope', 's-bucket', 'handle', 'g2d-crate', 'hook', ['s-pulley', 's-pulley-2'])],
    },
    // ABSURD: a second rubber chicken waits in the bucket and gets squashed by the bowling ball.
    {
      objects: [
        o('s-pulley', 'pulley', 340, 60),
        o('s-pulley-2', 'pulley', 1090, 284),
        o('s-bucket', 'bucket', 340, 360, { anchored: false }),
        o('s-chicken', 'rubber_chicken', 340, 362),
      ],
      connections: [rope('s-rope', 's-bucket', 'handle', 'g2d-crate', 'hook', ['s-pulley', 's-pulley-2'])],
    },
  ],
  counterexamples: [
    {
      why: 'a rubber chicken dropped on the other chicken just bounces',
      build: { objects: [o('s-chicken', 'rubber_chicken', 815, 200)], connections: [] },
    },
    {
      why: 'a rubber chicken dropped on the toaster bounces off the top',
      build: { objects: [o('s-chicken', 'rubber_chicken', 1015, 150)], connections: [] },
    },
    {
      why: 'a rubber chicken thrown down a plank does not shove the others far enough',
      build: { objects: [o('s-ramp', 'plank', 700, 250, { length: 160 }, 0.5), o('s-chicken', 'rubber_chicken', 650, 200, {}, 0.5)], connections: [] },
    },
    {
      why: 'over one pulley the rope lifts the crate up and back instead of dragging it along',
      build: {
        objects: [o('s-pulley', 'pulley', 340, 60), o('s-bucket', 'bucket', 340, 360, { anchored: false })],
        connections: [rope('s-rope', 's-bucket', 'handle', 'g2d-crate', 'hook', ['s-pulley'])],
      },
    },
    {
      why: 'the bowling ball misses a bucket hung from the toaster-side pulley alone',
      build: {
        objects: [o('s-pulley-2', 'pulley', 1090, 284), o('s-bucket', 'bucket', 1090, 520, { anchored: false })],
        connections: [rope('s-rope', 's-bucket', 'handle', 'g2d-crate', 'hook', ['s-pulley-2'])],
      },
    },
    {
      why: 'a bucket dropped on the shelf does not shove the chicken far enough',
      build: { objects: [o('s-bucket', 'bucket', 795, 200, { anchored: false })], connections: [] },
    },
    {
      why: 'a bucket dropped on the toaster just sits on top of it',
      build: { objects: [o('s-bucket', 'bucket', 1025, 200, { anchored: false })], connections: [] },
    },
    {
      why: 'a bucket sliding down a plank does not shove the chicken far enough',
      build: { objects: [o('s-ramp', 'plank', 820, 250, { length: 160 }, 0.5), o('s-bucket', 'bucket', 775, 190, { anchored: false })], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 2-5: pendulum strike

const wreckingSwing: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-wrecking-swing',
    name: 'Wrecking Swing',
    description:
      'Bowl a strike with a crate! The rubber ball will knock the crate off the shelf. Tie it to a hook so it swings down through the pins like a wrecking ball.',
    environment: 'research',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2e-ramp', 'plank', 190, 200, { length: 300 }, 0.3),
      o('g2e-shelf', 'plank', 565, 290, { length: 270 }),
      o('g2e-beam', 'wall', 880, 120, { w: 360, h: 20, material: 'steel' }),
      o('g2e-alley', 'plank', 935, 417, { length: 350 }),
    ],
    startingObjects: [
      o('g2e-ball', 'ball', 60, 137),
      o('g2e-crate', 'crate', 698, 261),
      o('g2e-pin-1', 'bowling_pin', 860, 382),
      o('g2e-pin-2', 'bowling_pin', 890, 382),
      o('g2e-pin-3', 'bowling_pin', 920, 382),
      o('g2e-pin-4', 'bowling_pin', 950, 382),
      o('g2e-chicken', 'rubber_chicken', 1080, 401),
    ],
    connections: [],
    inventory: [
      { type: 'hook', count: 1 },
      { type: 'rope', count: 1 },
      { type: 'plank', count: 1 },
      { type: 'trampoline', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { type: 'bowling_pin' }, count: 4, label: 'Knock down all 4 pins' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 3, elegantTime: 6, absurdStages: 11 },
    hints: [
      'A weight on a rope swings like a pendulum, and it is fastest at the very bottom of its swing.',
      'The rubber ball needs a way over the gap after the ramp. Then hang a hook under the steel beam, up and to the right of the crate, and tie the crate to it.',
      'Lay a plank over the gap after the ramp, put the hook under the beam just left of the pins, and rope it to the crate.',
    ],
    metadata: { chapter: 2, order: 5, author: 'Follyworks', blurb: 'Tick, tock, bonk.' },
  },
  solutions: [
    {
      objects: [o('s-hook', 'hook', 870, 142), o('s-bridge', 'plank', 382, 270, { length: 100 }, 0.4)],
      connections: [rope('s-rope', 's-hook', 'hook', 'g2e-crate', 'hook')],
    },
    // ABSURD: a soft trampoline instead of the bridge: the rubber ball boings onto the shelf.
    {
      objects: [o('s-hook', 'hook', 870, 142), o('s-tramp', 'trampoline', 370, 290, { power: 0.6 })],
      connections: [rope('s-rope', 's-hook', 'hook', 'g2e-crate', 'hook')],
    },
  ],
  counterexamples: [
    {
      why: 'with no hook the crate just drops to the floor',
      build: { objects: [o('s-bridge', 'plank', 382, 270, { length: 100 }, 0.4)], connections: [] },
    },
    {
      why: 'with no bridge the rubber ball never reaches the crate',
      build: { objects: [o('s-hook', 'hook', 870, 142)], connections: [rope('s-rope', 's-hook', 'hook', 'g2e-crate', 'hook')] },
    },
    {
      why: 'a trampoline under the falling crate bounces it nowhere useful',
      build: { objects: [o('s-bridge', 'plank', 382, 270, { length: 100 }, 0.4), o('s-tramp', 'trampoline', 715, 615, {}, 0.2618)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 2-6: pull-cord switch, toaster alarm clock

const pullTheCord: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-pull-the-cord',
    name: 'Pull the Cord',
    description:
      'Put Whiskers to bed in his basket. Tie the falling crate to the switch so it pulls the cord, the toaster DINGs, and Whiskers wakes up and runs. He always runs the wrong way first.',
    environment: 'basement',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2f-ramp', 'wall', 110, 100, { w: 220, h: 14, material: 'wood' }, 0.32),
      o('g2f-ledge', 'wall', 270, 160, { w: 70, h: 16, material: 'wood' }),
      o('g2f-track', 'wall', 460, 200, { w: 320, h: 14, material: 'wood' }, 0.15),
      o('g2f-track-2', 'wall', 810, 268, { w: 140, h: 14, material: 'wood' }, 0.15),
      o('g2f-shelf', 'plank', 935, 292, { length: 110 }),
      o('g2f-walk', 'plank', 500, 500, { length: 300 }),
      o('g2f-roof', 'plank', 445, 432, { length: 230 }),
    ],
    startingObjects: [
      o('g2f-ball', 'ball', 30, 58),
      o('g2f-bowl', 'bowling_ball', 299, 132),
      o('g2f-crate', 'crate', 975, 263),
      o('g2f-switch', 'toggle_switch', 1080, 330, {}, -Math.PI / 2),
      o('g2f-battery', 'battery', 280, 601),
      o('g2f-toaster', 'toaster', 580, 606),
      o('g2f-cat', 'cat', 450, 480, {}, 0, true),
      o('g2f-basket', 'bucket', 720, 598),
    ],
    connections: [wire('g2f-w1', 'g2f-battery', 'out', 'g2f-switch', 'in'), wire('g2f-w2', 'g2f-switch', 'out', 'g2f-toaster', 'in')],
    inventory: [
      { type: 'pulley', count: 1 },
      { type: 'rope', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'bucket', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g2f-basket', count: 1, filter: { type: 'cat' }, label: 'Get Whiskers into his basket' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 4, elegantTime: 12, absurdStages: 9 },
    hints: [
      'The switch turns ON when its lever is pulled to the right. A rope over a pulley can turn the crate’s fall into that pull.',
      'Whiskers runs the way he faces until he bumps into a wall. Stand a plank on end to turn him round.',
      'Bridge the gap in the track, put a pulley right of the switch level with its lever, rope the lever over it to the crate, and stand a plank upright left of Whiskers.',
    ],
    metadata: { chapter: 2, order: 6, author: 'Follyworks', blurb: 'One small tug for a crate.' },
  },
  solutions: [
    {
      objects: [
        o('s-bridge', 'plank', 680, 244, { length: 124 }, 0.24),
        o('s-pulley', 'pulley', 1050, 200),
        o('s-wall', 'plank', 370, 465, { length: 50 }, Math.PI / 2),
      ],
      connections: [rope('s-rope', 'g2f-switch', 'lever', 'g2f-crate', 'hook', ['s-pulley'])],
    },
    // ABSURD: the bowling ball bulldozes a bucket into the crate.
    {
      objects: [
        o('s-bridge', 'plank', 680, 244, { length: 124 }, 0.24),
        o('s-pulley', 'pulley', 1050, 200),
        o('s-wall', 'plank', 370, 465, { length: 50 }, Math.PI / 2),
        o('s-bucket', 'bucket', 917, 253, { anchored: false }),
      ],
      connections: [rope('s-rope', 'g2f-switch', 'lever', 'g2f-crate', 'hook', ['s-pulley'])],
    },
  ],
  counterexamples: [
    {
      why: 'a bucket dropped on the roof cannot reach Whiskers',
      build: { objects: [o('s-wall', 'plank', 370, 465, { length: 50 }, Math.PI / 2), o('s-bucket', 'bucket', 450, 350, { anchored: false })], connections: [] },
    },
    {
      why: 'a bucket sliding down a plank is too tall to get under the roof',
      build: {
        objects: [o('s-wall', 'plank', 370, 465, { length: 50 }, Math.PI / 2), o('s-ramp', 'plank', 640, 440, { length: 120 }, -0.5), o('s-bucket', 'bucket', 680, 380, { anchored: false })],
        connections: [],
      },
    },
    {
      why: 'roped straight to the crate, the lever is pulled down, not up',
      build: {
        objects: [o('s-bridge', 'plank', 680, 244, { length: 124 }, 0.24), o('s-wall', 'plank', 370, 465, { length: 50 }, Math.PI / 2)],
        connections: [rope('s-rope', 'g2f-switch', 'lever', 'g2f-crate', 'hook')],
      },
    },
    {
      why: 'with nothing to turn him round, Whiskers runs off the wrong end',
      build: {
        objects: [o('s-bridge', 'plank', 680, 244, { length: 124 }, 0.24), o('s-pulley', 'pulley', 1050, 200)],
        connections: [rope('s-rope', 'g2f-switch', 'lever', 'g2f-crate', 'hook', ['s-pulley'])],
      },
    },
    {
      why: 'with no bridge the bowling ball never reaches the crate',
      build: {
        objects: [o('s-pulley', 'pulley', 1050, 200), o('s-wall', 'plank', 370, 465, { length: 50 }, Math.PI / 2)],
        connections: [rope('s-rope', 'g2f-switch', 'lever', 'g2f-crate', 'hook', ['s-pulley'])],
      },
    },
  ],
};

// ---------------------------------------------------------------- 2-7: dumbwaiter around a trampoline

const dumbwaiter: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-dumbwaiter',
    name: 'Dumbwaiter',
    description:
      'Send the bucket of balls up the shaft to the kitchen without spilling them. Mind the trampoline somebody left on the workbench next to the shaft.',
    environment: 'basement',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2g-beam', 'wall', 420, 52, { w: 460, h: 20, material: 'steel' }),
      o('g2g-shaft-l', 'wall', 236, 400, { w: 14, h: 300, material: 'brick' }),
      o('g2g-kitchen', 'wall', 130, 250, { w: 200, h: 16, material: 'wood' }),
      o('g2g-bench', 'wall', 470, 525, { w: 90, h: 210, material: 'brick' }),
    ],
    startingObjects: [
      o('g2g-car', 'bucket', 300, 612, { anchored: false }),
      o('g2g-ball-a', 'ball', 286, 608),
      o('g2g-ball-b', 'ball', 314, 608),
      o('g2g-pulley', 'pulley', 300, 96),
      o('g2g-tramp', 'trampoline', 470, 404),
      o('g2g-hook', 'hook', 560, 76),
    ],
    connections: [],
    inventory: [
      { type: 'rope', count: 1 },
      { type: 'pulley', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'bowling_ball', count: 1 },
      { type: 'ball', count: 2 },
    ],
    goals: [
      { kind: 'height', target: { id: 'g2g-car' }, maxY: 250, label: 'Raise the bucket to kitchen level' },
      { kind: 'containerCount', container: 'g2g-car', count: 2, filter: { type: 'ball' }, label: 'Keep both balls in the bucket' },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 4, elegantTime: 3, absurdStages: 5 },
    hints: [
      'The bucket and its balls weigh 4 kg, so the counterweight has to be heavier than that.',
      'Both ends of a rope hang from the middle of a pulley wheel, so one pulley would bring the counterweight crashing into the bucket. And if the counterweight lands on the trampoline, it bounces straight back up.',
      'Add a second pulley further along the beam so the counterweight hangs well clear of the trampoline: an unbolted bucket with the bowling ball in it.',
    ],
    metadata: { chapter: 2, order: 7, author: 'Follyworks', blurb: 'Room service, the hard way.' },
  },
  solutions: [
    {
      objects: [o('s-pulley', 'pulley', 700, 96), o('s-bucket', 'bucket', 700, 260, { anchored: false }), o('s-bowl', 'bowling_ball', 700, 250)],
      connections: [rope('s-rope', 'g2g-car', 'handle', 's-bucket', 'handle', ['g2g-pulley', 's-pulley'])],
    },
    // ABSURD: a rubber ball rides the counterweight, another boings off the workbench trampoline.
    {
      objects: [
        o('s-pulley', 'pulley', 700, 96),
        o('s-bucket', 'bucket', 700, 260, { anchored: false }),
        o('s-bowl', 'bowling_ball', 700, 250),
        o('s-ball-a', 'ball', 700, 180),
        o('s-ball-b', 'ball', 470, 300),
      ],
      connections: [rope('s-rope', 'g2g-car', 'handle', 's-bucket', 'handle', ['g2g-pulley', 's-pulley'])],
    },
  ],
  counterexamples: [
    {
      why: 'the counterweight drops onto the trampoline',
      build: {
        objects: [o('s-pulley', 'pulley', 470, 96), o('s-bucket', 'bucket', 470, 230, { anchored: false }), o('s-bowl', 'bowling_ball', 470, 220)],
        connections: [rope('s-rope', 'g2g-car', 'handle', 's-bucket', 'handle', ['g2g-pulley', 's-pulley'])],
      },
    },
  ],
};

// ---------------------------------------------------------------- 2-8: one weight, two jobs

const twoBirds: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-two-birds',
    name: 'Two Birds, One Bucket',
    description:
      'Hoist the crate up to the loft AND fling the rubber ball above the line, using a single falling weight that does both jobs.',
    environment: 'garage',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2h-beam', 'wall', 620, 60, { w: 360, h: 20, material: 'steel' }),
      o('g2h-loft', 'wall', 230, 380, { w: 300, h: 20, material: 'wood' }),
      o('g2h-loft-leg', 'wall', 100, 505, { w: 16, h: 230, material: 'wood' }),
      o('g2h-stop', 'wall', 1000, 610, { w: 20, h: 40, material: 'wood' }),
    ],
    startingObjects: [
      o('g2h-crate', 'crate', 520, 608),
      o('g2h-pulley', 'pulley', 520, 104),
      o('g2h-seesaw', 'seesaw', 820, 590, { length: 300, tilt: 12 }),
      o('g2h-ball', 'ball', 946, 590),
      o('g2h-hook', 'hook', 800, 76),
      o('g2h-tramp', 'trampoline', 1060, 600, {}, -0.3),
    ],
    connections: [],
    inventory: [
      { type: 'rope', count: 1 },
      { type: 'pulley', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'bowling_ball', count: 1 },
      { type: 'ball', count: 2 },
      { type: 'plank', count: 1 },
    ],
    goals: [
      { kind: 'height', target: { id: 'g2h-crate' }, maxY: 400, label: 'Hoist the crate up to the loft' },
      { kind: 'height', target: { id: 'g2h-ball' }, maxY: 500, label: 'Fling the ball above the line' },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 4, elegantTime: 3, absurdStages: 6 },
    hints: [
      'A counterweight does work twice: once while it falls, and once more when it lands.',
      'Hang the counterweight right above the seesaw’s high end. A second pulley lets the rope come straight down there.',
      'Rope the crate over the pulley, over your own pulley above the seesaw’s left end, and down to an unbolted bucket with the bowling ball in it.',
    ],
    metadata: { chapter: 2, order: 8, author: 'Follyworks', blurb: 'Waste not, want not.' },
  },
  solutions: [
    {
      objects: [o('s-pulley', 'pulley', 700, 104), o('s-bucket', 'bucket', 700, 300, { anchored: false }), o('s-bowl', 'bowling_ball', 700, 290)],
      connections: [rope('s-rope', 'g2h-crate', 'hook', 's-bucket', 'handle', ['g2h-pulley', 's-pulley'])],
    },
    // ABSURD: a ball rides the counterweight down, another sits on the crate’s way up.
    {
      objects: [
        o('s-pulley', 'pulley', 700, 104),
        o('s-bucket', 'bucket', 700, 300, { anchored: false }),
        o('s-bowl', 'bowling_ball', 700, 290),
        o('s-ball-a', 'ball', 700, 220),
        o('s-ball-b', 'ball', 520, 400),
      ],
      connections: [rope('s-rope', 'g2h-crate', 'hook', 's-bucket', 'handle', ['g2h-pulley', 's-pulley'])],
    },
  ],
  counterexamples: [
    {
      why: 'the bowling ball is just dropped on the seesaw',
      build: { objects: [o('s-bowl', 'bowling_ball', 690, 200)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 2-9: falling weight hits the switch, mind the bounce

const switchHitter: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-switch-hitter',
    name: 'Switch Hitter',
    description:
      'Hoist the crate to the loft and turn the lamp on. This switch is mounted sideways: it flicks ON when something drops down past its lever.',
    environment: 'research',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2i-beam', 'wall', 560, 52, { w: 620, h: 20, material: 'steel' }),
      o('g2i-loft', 'wall', 190, 300, { w: 260, h: 20, material: 'wood' }),
      o('g2i-loft-leg', 'wall', 70, 460, { w: 16, h: 300, material: 'wood' }),
      o('g2i-pillar', 'wall', 712, 470, { w: 40, h: 320, material: 'brick' }),
    ],
    startingObjects: [
      o('g2i-crate', 'crate', 380, 608),
      o('g2i-pulley', 'pulley', 380, 96),
      o('g2i-battery', 'battery', 600, 601),
      o('g2i-switch', 'toggle_switch', 752, 380, {}, Math.PI / 2),
      o('g2i-lamp', 'light_bulb', 560, 150),
      o('g2i-tramp', 'trampoline', 1010, 600, {}, -0.3),
      o('g2i-hook', 'hook', 900, 74),
    ],
    connections: [wire('g2i-w1', 'g2i-battery', 'out', 'g2i-switch', 'in'), wire('g2i-w2', 'g2i-switch', 'out', 'g2i-lamp', 'in')],
    inventory: [
      { type: 'rope', count: 1 },
      { type: 'pulley', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'bowling_ball', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'ball', count: 2 },
    ],
    goals: [
      { kind: 'height', target: { id: 'g2i-crate' }, maxY: 330, label: 'Hoist the crate up to the loft' },
      { kind: 'activate', target: { id: 'g2i-lamp' }, duration: 2, label: 'Keep the lamp lit for two seconds' },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 5, elegantTime: 4, absurdStages: 6 },
    hints: [
      'One counterweight can do both jobs: lift the crate on the way down, and swat the switch as it passes.',
      'Hang the counterweight from a pulley right above the switch so it drops through the lever.',
      'Rope the crate over its pulley, over your pulley above the switch lever, and down to an unbolted bucket with the bowling ball in it.',
    ],
    metadata: { chapter: 2, order: 9, author: 'Follyworks', blurb: 'Down is on. Mind your head.' },
  },
  solutions: [
    {
      objects: [
        o('s-pulley', 'pulley', 800, 96),
        o('s-bucket', 'bucket', 800, 240, { anchored: false }),
        o('s-bowl', 'bowling_ball', 800, 230),
      ],
      connections: [rope('s-rope', 'g2i-crate', 'hook', 's-bucket', 'handle', ['g2i-pulley', 's-pulley'])],
    },
    // ABSURD: a ball rides the counterweight down, and the rising crate headbutts another one.
    {
      objects: [
        o('s-pulley', 'pulley', 800, 96),
        o('s-bucket', 'bucket', 800, 240, { anchored: false }),
        o('s-bowl', 'bowling_ball', 800, 230),
        o('s-ball-a', 'ball', 800, 170),
        o('s-ball-b', 'ball', 380, 420),
      ],
      connections: [rope('s-rope', 'g2i-crate', 'hook', 's-bucket', 'handle', ['g2i-pulley', 's-pulley'])],
    },
  ],
  counterexamples: [
    {
      why: 'the counterweight drops down beside the switch instead of through its lever',
      build: {
        objects: [o('s-pulley', 'pulley', 900, 96), o('s-bucket', 'bucket', 900, 240, { anchored: false }), o('s-bowl', 'bowling_ball', 900, 230)],
        connections: [rope('s-rope', 'g2i-crate', 'hook', 's-bucket', 'handle', ['g2i-pulley', 's-pulley'])],
      },
    },
  ],
};

// ---------------------------------------------------------------- 2-10: three jobs, share the parts

const grandOpening: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-grand-opening',
    name: 'Grand Opening',
    description:
      'Opening night, and three things have to happen: the crate goes up to the loft, the lamp comes on, and the rubber ball takes a bow above the line. Share out the parts wisely.',
    environment: 'underground',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2j-beam', 'wall', 420, 52, { w: 560, h: 20, material: 'steel' }),
      o('g2j-loft', 'wall', 110, 380, { w: 120, h: 20, material: 'wood' }),
      o('g2j-stop', 'wall', 920, 610, { w: 20, h: 40, material: 'wood' }),
    ],
    startingObjects: [
      o('g2j-crate', 'crate', 230, 608),
      o('g2j-pulley', 'pulley', 230, 96),
      o('g2j-switch', 'toggle_switch', 510, 330, {}, -Math.PI / 2),
      o('g2j-pulley-s', 'pulley', 480, 180),
      o('g2j-battery', 'battery', 1010, 601),
      o('g2j-lamp', 'light_bulb', 640, 150),
      o('g2j-seesaw', 'seesaw', 760, 590, { length: 300, tilt: 12 }),
      o('g2j-ball', 'ball', 886, 590),
    ],
    connections: [wire('g2j-w1', 'g2j-battery', 'out', 'g2j-switch', 'in'), wire('g2j-w2', 'g2j-switch', 'out', 'g2j-lamp', 'in')],
    inventory: [
      { type: 'rope', count: 2 },
      { type: 'bucket', count: 1 },
      { type: 'crate', count: 1 },
      { type: 'bowling_ball', count: 1 },
      { type: 'ball', count: 2 },
      { type: 'plank', count: 2 },
    ],
    goals: [
      { kind: 'height', target: { id: 'g2j-crate' }, maxY: 400, label: 'Hoist the crate up to the loft' },
      { kind: 'activate', target: { id: 'g2j-lamp' }, duration: 1, label: 'Light the lamp' },
      { kind: 'height', target: { id: 'g2j-ball' }, maxY: 420, label: 'Fling the ball above the line' },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 5, elegantTime: 3, absurdStages: 9 },
    hints: [
      'Three jobs, three weights: something heavy to hoist the crate, something to tug the switch lever up, and something heavy to land on the seesaw.',
      'The lamp switch flicks ON when its lever is tugged upwards: rope it over the pulley above it, down to anything hanging.',
      'There is only one bowling ball. A steel crate is heavy enough for the hoist, and an empty bucket is plenty for the switch.',
    ],
    metadata: { chapter: 2, order: 10, author: 'Follyworks', blurb: 'Everything, all at once, once.' },
  },
  solutions: [
    {
      objects: [
        o('s-steel', 'crate', 340, 240, { material: 'steel' }),
        o('s-bucket', 'bucket', 400, 300, { anchored: false }),
        o('s-bowl', 'bowling_ball', 654, 90),
      ],
      connections: [
        rope('s-rope-a', 'g2j-crate', 'hook', 's-steel', 'hook', ['g2j-pulley']),
        rope('s-rope-b', 'g2j-switch', 'lever', 's-bucket', 'handle', ['g2j-pulley-s']),
      ],
    },
    // ABSURD: one rubber ball drops into the switch bucket, another warms up the seesaw before the bowling ball lands.
    {
      objects: [
        o('s-steel', 'crate', 340, 240, { material: 'steel' }),
        o('s-bucket', 'bucket', 400, 300, { anchored: false }),
        o('s-bowl', 'bowling_ball', 654, 90),
        o('s-ball-a', 'ball', 400, 200),
        o('s-ball-b', 'ball', 760, 300),
      ],
      connections: [
        rope('s-rope-a', 'g2j-crate', 'hook', 's-steel', 'hook', ['g2j-pulley']),
        rope('s-rope-b', 'g2j-switch', 'lever', 's-bucket', 'handle', ['g2j-pulley-s']),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'the switch is roped to the bowling-ball counterweight and the crate is left on the floor',
      build: {
        objects: [o('s-bucket', 'bucket', 400, 300, { anchored: false }), o('s-bowl', 'bowling_ball', 400, 290)],
        connections: [rope('s-rope-b', 'g2j-switch', 'lever', 's-bucket', 'handle', ['g2j-pulley-s'])],
      },
    },
  ],
};

export const GROUP_2: CampaignEntry[] = [counterCulture, leverExpectations, springFever, pullTheOtherOne, wreckingSwing, pullTheCord, dumbwaiter, twoBirds, switchHitter, grandOpening];
