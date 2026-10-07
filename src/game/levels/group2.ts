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

// ---------------------------------------------------------------- 2-2: seesaw, chicken, cat, strike

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

// ---------------------------------------------------------------- 2-7: dumbwaiter rings the attic bell

const dumbwaiter: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-dumbwaiter',
    name: 'Dumbwaiter',
    description:
      'Whiskers is napping in the attic next to his bowling pins. Send the dumbwaiter up the shaft to ring the bell: the falling bowling ball makes a fine counterweight.',
    environment: 'basement',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2g-beam', 'wall', 640, 30, { w: 760, h: 20, material: 'steel' }),
      o('g2g-chute', 'wall', 110, 100, { w: 220, h: 14, material: 'wood' }, 0.32),
      o('g2g-ledge', 'wall', 270, 160, { w: 70, h: 16, material: 'wood' }),
      o('g2g-ramp', 'plank', 310, 280, { length: 150 }, 0.28),
      o('g2g-ramp-2', 'plank', 500, 311, { length: 80 }, 0.28),
      o('g2g-shaft-l', 'wall', 762, 470, { w: 14, h: 320, material: 'brick' }),
      o('g2g-shaft-r', 'wall', 868, 525, { w: 14, h: 210, material: 'brick' }),
      o('g2g-shaft-top', 'wall', 787, 324, { w: 64, h: 16, material: 'brick' }),
      o('g2g-bell', 'bell', 792, 368),
      o('g2g-attic', 'wall', 993, 428, { w: 236, h: 16, material: 'wood' }),
      o('g2g-attic-roof', 'plank', 993, 353, { length: 236 }),
    ],
    startingObjects: [
      o('g2g-ball', 'ball', 30, 58),
      o('g2g-bowl', 'bowling_ball', 299, 132),
      o('g2g-car', 'bucket', 820, 608, { anchored: false }),
      o('g2g-chicken', 'rubber_chicken', 820, 611),
      o('g2g-cat', 'cat', 920, 407),
      o('g2g-pin-1', 'bowling_pin', 1000, 392),
      o('g2g-pin-2', 'bowling_pin', 1030, 392),
      o('g2g-pin-3', 'bowling_pin', 1060, 392),
      o('g2g-pin-4', 'bowling_pin', 1090, 392),
    ],
    connections: [],
    inventory: [
      { type: 'pulley', count: 2 },
      { type: 'rope', count: 1 },
      { type: 'bucket', count: 2 },
      { type: 'plank', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { type: 'bowling_pin' }, count: 3, label: 'Knock down 3 bowling pins' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 5, elegantTime: 7, absurdStages: 17 },
    hints: [
      'A dumbwaiter is a lift with a counterweight: when the heavy side goes down, the car goes up.',
      'Hang an unbolted bucket where the bowling ball drops off the lower ramp, and rope it over two pulleys on the beam to the dumbwaiter’s handle. Don’t forget the gap between the ramps.',
      'Bridge the gap between the two ramps, put pulleys on the beam above the dumbwaiter and above the end of the lower ramp, hang an unbolted bucket under the second one, and rope it over both to the dumbwaiter’s handle.',
    ],
    metadata: { chapter: 2, order: 7, author: 'Follyworks', blurb: 'Going up: kitchenware, cats.' },
  },
  solutions: [
    {
      objects: [
        o('s-bridge', 'plank', 422, 300, { length: 74 }),
        o('s-pulley', 'pulley', 820, 60),
        o('s-pulley-2', 'pulley', 585, 60),
        o('s-bucket', 'bucket', 585, 395, { anchored: false }),
      ],
      connections: [rope('s-rope', 'g2g-car', 'handle', 's-bucket', 'handle', ['s-pulley', 's-pulley-2'])],
    },
    // ABSURD: a second bucket on the floor catches the rubber ball as it chases the bowling ball down.
    {
      objects: [
        o('s-bridge', 'plank', 422, 300, { length: 74 }),
        o('s-pulley', 'pulley', 820, 60),
        o('s-pulley-2', 'pulley', 585, 60),
        o('s-bucket', 'bucket', 585, 395, { anchored: false }),
        o('s-catcher', 'bucket', 722, 608),
      ],
      connections: [rope('s-rope', 'g2g-car', 'handle', 's-bucket', 'handle', ['s-pulley', 's-pulley-2'])],
    },
  ],
  counterexamples: [
    {
      why: 'with no bridge the bowling ball never reaches the counterweight',
      build: {
        objects: [o('s-pulley', 'pulley', 820, 60), o('s-pulley-2', 'pulley', 585, 60), o('s-bucket', 'bucket', 585, 395, { anchored: false })],
        connections: [rope('s-rope', 'g2g-car', 'handle', 's-bucket', 'handle', ['s-pulley', 's-pulley-2'])],
      },
    },
    {
      why: 'a bolted-down counterweight bucket never falls',
      build: {
        objects: [o('s-bridge', 'plank', 422, 300, { length: 74 }), o('s-pulley', 'pulley', 820, 60), o('s-pulley-2', 'pulley', 585, 60), o('s-bucket', 'bucket', 585, 395)],
        connections: [rope('s-rope', 'g2g-car', 'handle', 's-bucket', 'handle', ['s-pulley', 's-pulley-2'])],
      },
    },
    {
      why: 'a bucket dropped down the shaft is too wide to reach the bell',
      build: { objects: [o('s-bucket', 'bucket', 850, 200, { anchored: false })], connections: [] },
    },
    {
      why: 'a bucket dropped on the attic roof cannot reach Whiskers or the pins',
      build: { objects: [o('s-bucket', 'bucket', 960, 250, { anchored: false })], connections: [] },
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
      'Ring the bell AND bowl a strike with one falling bowling ball. On the way down it hoists the crate into the bell; when it lands, the seesaw sends the rubber chicken squawking to wake Whiskers.',
    environment: 'garage',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2h-beam', 'wall', 560, 30, { w: 1080, h: 20, material: 'steel' }),
      o('g2h-shelf', 'plank', 110, 230, { length: 160 }),
      o('g2h-walk', 'plank', 660, 487, { length: 200 }),
      o('g2h-walk-2', 'plank', 895, 487, { length: 130 }),
      o('g2h-bell', 'bell', 1020, 180),
      o('g2h-toybox', 'wall', 580, 590, { w: 30, h: 80, material: 'wood' }),
      o('g2h-shelf-2', 'plank', 497, 430, { length: 115 }),
    ],
    startingObjects: [
      o('g2h-trap', 'mousetrap', 110, 218),
      o('g2h-bowl', 'bowling_ball', 110, 193),
      o('g2h-seesaw', 'seesaw', 420, 594, { length: 260, tilt: 12 }),
      o('g2h-chicken', 'rubber_chicken', 544, 593),
      o('g2h-cat', 'cat', 640, 467, {}, 0, true),
      o('g2h-pin-1', 'bowling_pin', 870, 452),
      o('g2h-pin-2', 'bowling_pin', 895, 452),
      o('g2h-pin-3', 'bowling_pin', 920, 452),
      o('g2h-pin-4', 'bowling_pin', 945, 452),
      o('g2h-crate', 'crate', 1000, 608),
    ],
    connections: [],
    inventory: [
      { type: 'pulley', count: 2 },
      { type: 'rope', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'ball', count: 1 },
    ],
    goals: [
      { kind: 'contact', a: { id: 'g2h-crate' }, b: { id: 'g2h-bell' }, label: 'Lift the crate up into the bell' },
      { kind: 'activate', target: { type: 'bowling_pin' }, count: 3, label: 'Knock down 3 bowling pins' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 6, elegantTime: 7, absurdStages: 18 },
    hints: [
      'A counterweight works twice: once while it falls, and again when it lands.',
      'Catch the bowling ball in an unbolted bucket roped over two pulleys to the crate, and let the bucket come down on the seesaw’s high end. Whiskers runs the wrong way first, and has a gap to cross.',
      'Pulleys go on the beam above the crate and where the bowling ball lands; the bucket hangs over the seesaw’s high end. Stand a plank upright left of Whiskers and bridge the gap in his walkway.',
    ],
    metadata: { chapter: 2, order: 8, author: 'Follyworks', blurb: 'Waste not, want not.' },
  },
  solutions: [
    {
      objects: [
        o('s-pulley', 'pulley', 1000, 60),
        o('s-pulley-2', 'pulley', 250, 60),
        o('s-bucket', 'bucket', 250, 175, { anchored: false }),
        o('s-wall', 'plank', 585, 430, { length: 100 }, Math.PI / 2),
        o('s-bridge', 'plank', 795, 487, { length: 66 }),
      ],
      connections: [rope('s-rope', 's-bucket', 'handle', 'g2h-crate', 'hook', ['s-pulley-2', 's-pulley'])],
    },
    // ABSURD: Whiskers bulldozes a rubber ball into the pins ahead of him.
    {
      objects: [
        o('s-pulley', 'pulley', 1000, 60),
        o('s-pulley-2', 'pulley', 250, 60),
        o('s-bucket', 'bucket', 250, 175, { anchored: false }),
        o('s-wall', 'plank', 585, 430, { length: 100 }, Math.PI / 2),
        o('s-bridge', 'plank', 795, 487, { length: 66 }),
        o('s-ball', 'ball', 845, 466),
      ],
      connections: [rope('s-rope', 's-bucket', 'handle', 'g2h-crate', 'hook', ['s-pulley-2', 's-pulley'])],
    },
  ],
  counterexamples: [
    {
      why: 'with nothing to turn him round, Whiskers runs off the wrong end',
      build: {
        objects: [o('s-pulley', 'pulley', 1000, 60), o('s-pulley-2', 'pulley', 250, 60), o('s-bucket', 'bucket', 250, 175, { anchored: false }), o('s-bridge', 'plank', 795, 487, { length: 66 })],
        connections: [rope('s-rope', 's-bucket', 'handle', 'g2h-crate', 'hook', ['s-pulley-2', 's-pulley'])],
      },
    },
    {
      why: 'with no bridge Whiskers drops through the gap before the pins',
      build: {
        objects: [o('s-pulley', 'pulley', 1000, 60), o('s-pulley-2', 'pulley', 250, 60), o('s-bucket', 'bucket', 250, 175, { anchored: false }), o('s-wall', 'plank', 585, 430, { length: 100 }, Math.PI / 2)],
        connections: [rope('s-rope', 's-bucket', 'handle', 'g2h-crate', 'hook', ['s-pulley-2', 's-pulley'])],
      },
    },
    {
      why: 'without a pulley over the crate it is dragged sideways instead of up',
      build: {
        objects: [o('s-pulley-2', 'pulley', 250, 60), o('s-bucket', 'bucket', 250, 175, { anchored: false }), o('s-wall', 'plank', 585, 430, { length: 100 }, Math.PI / 2), o('s-bridge', 'plank', 795, 487, { length: 66 })],
        connections: [rope('s-rope', 's-bucket', 'handle', 'g2h-crate', 'hook', ['s-pulley-2'])],
      },
    },
    {
      why: 'a bucket dropped on the seesaw wakes Whiskers but nothing lifts the crate',
      build: {
        objects: [o('s-bucket', 'bucket', 320, 300, { anchored: false }), o('s-wall', 'plank', 585, 430, { length: 100 }, Math.PI / 2), o('s-bridge', 'plank', 795, 487, { length: 66 })],
        connections: [],
      },
    },
  ],
};

// ---------------------------------------------------------------- 2-9: spring, bounce, swing, toast

const toastOfTheTown: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-toast-of-the-town',
    name: 'Toast of the Town',
    description:
      'Sink a slice of toast through the hoop, then get Whiskers to ring the bell. The mousetrap throws the bowling ball short of the shelf, and the crate up there makes a fine pendulum.',
    environment: 'garage',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2i-beam', 'wall', 560, 30, { w: 1080, h: 20, material: 'steel' }),
      o('g2i-ramp', 'plank', 130, 150, { length: 220 }, 0.3),
      o('g2i-perch', 'wall', 275, 215, { w: 80, h: 14, material: 'wood' }),
      o('g2i-pit', 'plank', 390, 400, { length: 150 }),
      o('g2i-shelf', 'plank', 550, 186, { length: 150 }, 0.18),
      o('g2i-shelf-2', 'plank', 665, 200, { length: 90 }),
      o('g2i-pit-wall', 'wall', 474, 303, { w: 10, h: 194, material: 'wood' }),
      o('g2i-lane', 'plank', 865, 293, { length: 170 }),
      o('g2i-partition', 'wall', 795, 127, { w: 12, h: 176, material: 'wood' }),
      o('g2i-hoop', 'basketball_hoop', 976, 136),
      o('g2i-walk', 'plank', 920, 400, { length: 240 }),
      o('g2i-walk-2', 'plank', 700, 400, { length: 80 }),
      o('g2i-walk-3', 'plank', 560, 400, { length: 80 }),
      o('g2i-bell', 'bell', 540, 374),
    ],
    startingObjects: [
      o('g2i-ball', 'bowling_ball', 40, 95),
      o('g2i-trap', 'mousetrap', 270, 203, { power: 600 }),
      o('g2i-crate', 'crate', 704, 172),
      o('g2i-rubber', 'ball', 885, 273),
      o('g2i-toaster', 'toaster', 980, 277, { slices: 1 }, 0, true),
      o('g2i-catcher', 'bucket', 725, 330),
      o('g2i-cat', 'cat', 850, 380),
    ],
    connections: [],
    inventory: [
      { type: 'trampoline', count: 2 },
      { type: 'hook', count: 1 },
      { type: 'rope', count: 1 },
      { type: 'plank', count: 3 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g2i-hoop', count: 1, filter: { type: 'toast' }, label: 'Sink the toast through the hoop' },
      { kind: 'activate', target: { id: 'g2i-bell' }, label: 'Get Whiskers to ring the bell' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 6, elegantTime: 11, absurdStages: 11 },
    hints: [
      'Bounce the bowling ball up onto the shelf so it shoves the crate off the edge. Tie the crate up first, so it swings instead of dropping.',
      'The swinging crate knocks the rubber ball into the toaster lever. The DING wakes Whiskers, who always runs the wrong way first, and his walkway has two gaps.',
      'Trampoline in the pit where the bowling ball lands; hook under the beam just left of the rubber ball, roped to the crate; a plank stood upright right of Whiskers, and one across each gap.',
    ],
    metadata: { chapter: 2, order: 9, author: 'Follyworks', blurb: 'Sprung, bounced, swung and lightly toasted.' },
  },
  solutions: [
    {
      objects: [
        o('s-tramp', 'trampoline', 410, 320, { power: 1.8 }),
        o('s-hook', 'hook', 853, 52),
        o('s-wall', 'plank', 900, 348, { length: 90 }, Math.PI / 2),
        o('s-bridge', 'plank', 770, 400, { length: 56 }),
        o('s-bridge-2', 'plank', 630, 400, { length: 56 }),
      ],
      connections: [rope('s-rope', 's-hook', 'hook', 'g2i-crate', 'hook')],
    },
    // ABSURD: the bowling ball takes a second bounce on the way up.
    {
      objects: [
        o('s-tramp', 'trampoline', 410, 320, { power: 1.8 }),
        o('s-tramp-2', 'trampoline', 390, 250, { power: 1.2 }, Math.PI / 12),
        o('s-hook', 'hook', 853, 52),
        o('s-wall', 'plank', 900, 348, { length: 90 }, Math.PI / 2),
        o('s-bridge', 'plank', 770, 400, { length: 56 }),
        o('s-bridge-2', 'plank', 630, 400, { length: 56 }),
      ],
      connections: [rope('s-rope', 's-hook', 'hook', 'g2i-crate', 'hook')],
    },
  ],
  counterexamples: [
    {
      why: 'with nothing to turn him round, Whiskers runs off the end of his walkway',
      build: {
        objects: [o('s-tramp', 'trampoline', 410, 320, { power: 1.8 }), o('s-hook', 'hook', 853, 52), o('s-bridge', 'plank', 770, 400, { length: 56 }), o('s-bridge-2', 'plank', 630, 400, { length: 56 })],
        connections: [rope('s-rope', 's-hook', 'hook', 'g2i-crate', 'hook')],
      },
    },
    {
      why: 'without the rope the crate just drops into the bucket',
      build: {
        objects: [o('s-tramp', 'trampoline', 410, 320, { power: 1.8 }), o('s-wall', 'plank', 900, 348, { length: 90 }, Math.PI / 2), o('s-bridge', 'plank', 770, 400, { length: 56 }), o('s-bridge-2', 'plank', 630, 400, { length: 56 })],
        connections: [],
      },
    },
    {
      why: 'a plank ramp up to the shelf is too steep for the bowling ball to climb',
      build: {
        objects: [o('s-ramp', 'plank', 395, 230, { length: 170 }, -0.2), o('s-hook', 'hook', 853, 52), o('s-wall', 'plank', 900, 348, { length: 90 }, Math.PI / 2), o('s-bridge', 'plank', 770, 400, { length: 56 }), o('s-bridge-2', 'plank', 630, 400, { length: 56 })],
        connections: [rope('s-rope', 's-hook', 'hook', 'g2i-crate', 'hook')],
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

export const GROUP_2: CampaignEntry[] = [counterCulture, leverExpectations, springFever, pullTheOtherOne, wreckingSwing, pullTheCord, dumbwaiter, twoBirds, toastOfTheTown, grandOpening];
