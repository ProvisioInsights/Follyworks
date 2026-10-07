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

// ---------------------------------------------------------------- 2-3: trampolines as springs

const springFever: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-spring-fever',
    name: 'Spring Fever',
    description:
      'Two rubber balls are about to drop down the chute, and the bolted-down trampoline will only bounce them into the corner. Bounce them over the wall into the planter instead.',
    environment: 'greenhouse',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2c-slope', 'wall', 130, 180, { w: 150, h: 12, material: 'wood' }, 0.2),
      o('g2c-chute-r', 'wall', 258, 270, { w: 12, h: 220, material: 'wood' }),
      o('g2c-chute-l', 'wall', 212, 300, { w: 12, h: 160, material: 'wood' }),
      o('g2c-wall', 'wall', 480, 550, { w: 20, h: 160, material: 'brick' }),
      o('g2c-planter', 'wall', 770, 590, { w: 16, h: 80, material: 'wood' }),
    ],
    startingObjects: [o('g2c-ball-a', 'ball', 80, 150), o('g2c-ball-b', 'ball', 130, 160), o('g2c-tramp', 'trampoline', 236, 600, {}, -0.35)],
    connections: [],
    inventory: [
      { type: 'trampoline', count: 2 },
      { type: 'plank', count: 2 },
      { type: 'ball', count: 1 },
    ],
    goals: [
      { kind: 'enterRegion', target: { id: 'g2c-ball-a' }, region: { x: 780, y: 500, w: 290, h: 130 }, hold: 0.5, label: 'Land the first ball in the planter' },
      { kind: 'enterRegion', target: { id: 'g2c-ball-b' }, region: { x: 780, y: 500, w: 290, h: 130 }, hold: 0.5, label: 'Land the second ball in the planter' },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 1, elegantTime: 5, absurdStages: 4 },
    hints: [
      'A trampoline is a spring: whatever lands on it is thrown back out along the direction the mat faces.',
      'You cannot turn the bolted-down trampoline, but you can catch the balls before they reach it.',
      'Put your own trampoline under the chute, above the old one, and tilt it a little to the right.',
    ],
    metadata: { chapter: 2, order: 3, author: 'Follyworks', blurb: 'Boing, with intent.' },
  },
  solutions: [
    { objects: [o('s-tramp', 'trampoline', 236, 520, {}, 0.3)], connections: [] },
    { objects: [o('s-tramp', 'trampoline', 236, 480, {}, 0.5)], connections: [] },
    // ABSURD: a third ball joins the queue and everyone bumps into everyone on the way over.
    { objects: [o('s-tramp', 'trampoline', 236, 480, {}, 0.3), o('s-ball', 'ball', 236, 100)], connections: [] },
  ],
};

// ---------------------------------------------------------------- 2-4: redirected pull

const pullTheOtherOne: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-pull-the-other-one',
    name: 'Pull the Other One',
    description:
      'Drag the steel crate along the ledge to the loading dock. Nobody is going to push it, but something could fall down the shaft.',
    environment: 'underground',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2d-ledge', 'wall', 380, 445, { w: 760, h: 370, material: 'concrete' }),
      o('g2d-pulley', 'pulley', 784, 240),
      o('g2d-bracket', 'wall', 784, 210, { w: 14, h: 30, material: 'steel' }),
      o('g2d-bracket-arm', 'wall', 770, 196, { w: 40, h: 10, material: 'steel' }),
      o('g2d-dock-sign', 'wall', 620, 120, { w: 200, h: 16, material: 'wood' }),
    ],
    startingObjects: [o('g2d-crate', 'crate', 260, 238, { material: 'steel' }), o('g2d-ball', 'ball', 420, 246), o('g2d-hook', 'hook', 420, 70)],
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
        target: { id: 'g2d-crate' },
        region: { x: 520, y: 180, w: 200, h: 80 },
        hold: 0.5,
        label: 'Park the crate on the loading dock',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 3, elegantTime: 4, absurdStages: 5 },
    hints: [
      'A pulley turns a downward pull into a sideways one.',
      'Run a rope from the crate over the pulley at the edge, and hang a weight down the shaft. When the weight hits the floor, the crate stops.',
      'An empty bucket is far too light to drag a steel crate. Unbolt it, hang it on the rope and drop the bowling ball in.',
    ],
    metadata: { chapter: 2, order: 4, author: 'Follyworks', blurb: 'Falling sideways, technically.' },
  },
  solutions: [
    {
      objects: [o('s-bucket', 'bucket', 850, 330, { anchored: false }), o('s-bowl', 'bowling_ball', 850, 320)],
      connections: [rope('s-rope', 'g2d-crate', 'hook', 's-bucket', 'handle', ['g2d-pulley'])],
    },
    // ABSURD: a rubber ball rides down in the bucket and another gets bulldozed off the ledge ahead of the crate.
    {
      objects: [
        o('s-bucket', 'bucket', 850, 330, { anchored: false }),
        o('s-bowl', 'bowling_ball', 850, 320),
        o('s-ball-a', 'ball', 340, 246),
        o('s-ball-b', 'ball', 850, 250),
      ],
      connections: [rope('s-rope', 'g2d-crate', 'hook', 's-bucket', 'handle', ['g2d-pulley'])],
    },
  ],
  counterexamples: [
    {
      why: 'the bucket only holds rubber balls',
      build: {
        objects: [o('s-bucket', 'bucket', 850, 330, { anchored: false }), o('s-ball-a', 'ball', 850, 320), o('s-ball-b', 'ball', 850, 280)],
        connections: [rope('s-rope', 'g2d-crate', 'hook', 's-bucket', 'handle', ['g2d-pulley'])],
      },
    },
  ],
};

// ---------------------------------------------------------------- 2-5: pendulum

const wreckingSwing: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-wrecking-swing',
    name: 'Wrecking Swing',
    description:
      'The bowling ball on the shelf belongs in the bin on the right. Nothing in here can reach it, unless something swings.',
    environment: 'research',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2e-beam', 'wall', 480, 52, { w: 420, h: 20, material: 'steel' }),
      o('g2e-shelf', 'wall', 440, 430, { w: 260, h: 20, material: 'steel' }),
      o('g2e-shelf-leg', 'wall', 320, 530, { w: 16, h: 180, material: 'steel' }),
      o('g2e-kerb', 'wall', 562, 416, { w: 8, h: 8, material: 'steel' }),
      o('g2e-backboard', 'wall', 700, 470, { w: 16, h: 300, material: 'steel' }),
    ],
    startingObjects: [
      o('g2e-bowl', 'bowling_ball', 526, 400),
      o('g2e-bin', 'bucket', 640, 598),
      o('g2e-old-crate', 'crate', 150, 608),
      o('g2e-pulley', 'pulley', 640, 90),
    ],
    connections: [],
    inventory: [
      { type: 'hook', count: 1 },
      { type: 'rope', count: 1 },
      { type: 'crate', count: 1 },
      { type: 'ball', count: 2 },
      { type: 'plank', count: 2 },
    ],
    goals: [{ kind: 'containerCount', container: 'g2e-bin', count: 1, filter: { type: 'bowling_ball' }, label: 'Knock the bowling ball into the bin' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 3, elegantTime: 4, absurdStages: 5 },
    hints: [
      'A weight on a rope swings like a pendulum, and it is fastest at the very bottom of the swing.',
      'Put a hook on the beam straight above the bowling ball, tie a crate to it, and hold the crate out to the side before you press RUN.',
      'A steel crate hits much harder than a wooden one.',
    ],
    metadata: { chapter: 2, order: 5, author: 'Follyworks', blurb: 'Tick, tock, bonk.' },
  },
  solutions: [
    {
      objects: [o('s-hook', 'hook', 490, 74), o('s-crate', 'crate', 204, 112, { material: 'steel' })],
      connections: [rope('s-rope', 's-hook', 'hook', 's-crate', 'hook')],
    },
    // ABSURD: a rubber ball bonks the bowling ball first, another waits in the bin to be squashed.
    {
      objects: [
        o('s-hook', 'hook', 490, 74),
        o('s-crate', 'crate', 204, 112, { material: 'steel' }),
        o('s-ball-a', 'ball', 526, 150),
        o('s-ball-b', 'ball', 640, 300),
      ],
      connections: [rope('s-rope', 's-hook', 'hook', 's-crate', 'hook')],
    },
  ],
  counterexamples: [
    {
      why: 'the pendulum is a wooden crate',
      build: {
        objects: [o('s-hook', 'hook', 490, 74), o('s-crate', 'crate', 204, 112)],
        connections: [rope('s-rope', 's-hook', 'hook', 's-crate', 'hook')],
      },
    },
    {
      why: 'a rubber ball is rolled into the bowling ball',
      build: { objects: [o('s-ramp', 'plank', 380, 330, { length: 200 }, 0.4), o('s-ball', 'ball', 300, 270)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 2-6: pull-cord light switch

const pullTheCord: CampaignEntry = {
  chapter: 2,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g2-pull-the-cord',
    name: 'Pull the Cord',
    description:
      'The lamp is wired up and ready; somebody just has to tug the switch lever upwards. Nobody is around, so rig a cord that does the tugging.',
    environment: 'maintenance',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g2f-pillar', 'wall', 360, 470, { w: 60, h: 320, material: 'brick' }),
      o('g2f-shelf', 'wall', 820, 300, { w: 300, h: 20, material: 'steel' }),
      o('g2f-beam', 'wall', 300, 52, { w: 260, h: 20, material: 'steel' }),
    ],
    startingObjects: [
      o('g2f-battery', 'battery', 120, 601),
      o('g2f-switch', 'toggle_switch', 302, 420, {}, -Math.PI / 2),
      o('g2f-lamp', 'light_bulb', 560, 140),
      o('g2f-hook', 'hook', 300, 74),
      o('g2f-crate', 'crate', 860, 268),
    ],
    connections: [wire('g2f-w1', 'g2f-battery', 'out', 'g2f-switch', 'in'), wire('g2f-w2', 'g2f-switch', 'out', 'g2f-lamp', 'in')],
    inventory: [
      { type: 'rope', count: 1 },
      { type: 'pulley', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'ball', count: 2 },
      { type: 'plank', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g2f-lamp' }, duration: 1, label: 'Keep the lamp lit for a second' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 3, elegantTime: 2, absurdStages: 4 },
    hints: [
      'A rope only pulls when something pulls on its other end. Tying the switch to the ceiling hook just holds it still.',
      'The switch flips ON when its lever is tugged upwards. Falling weights only pull down, so turn the pull around with a pulley above the lever.',
      'Put a pulley above the switch lever, then rope the lever up over it and down to a hanging, unbolted bucket.',
    ],
    metadata: { chapter: 2, order: 6, author: 'Follyworks', blurb: 'One small tug for a bucket.' },
  },
  solutions: [
    {
      objects: [o('s-pulley', 'pulley', 270, 220), o('s-bucket', 'bucket', 160, 330, { anchored: false })],
      connections: [rope('s-rope', 'g2f-switch', 'lever', 's-bucket', 'handle', ['s-pulley'])],
    },
    // ABSURD: two rubber balls chase the falling bucket down and pelt it.
    {
      objects: [
        o('s-pulley', 'pulley', 270, 220),
        o('s-bucket', 'bucket', 160, 330, { anchored: false }),
        o('s-ball-a', 'ball', 160, 200),
        o('s-ball-b', 'ball', 160, 120),
      ],
      connections: [rope('s-rope', 'g2f-switch', 'lever', 's-bucket', 'handle', ['s-pulley'])],
    },
  ],
  counterexamples: [
    {
      why: 'the bucket hangs straight from the lever without a pulley',
      build: {
        objects: [o('s-bucket', 'bucket', 160, 470, { anchored: false })],
        connections: [rope('s-rope', 'g2f-switch', 'lever', 's-bucket', 'handle')],
      },
    },
    {
      why: 'the switch is only tied to the ceiling hook',
      build: { objects: [], connections: [rope('s-rope', 'g2f-switch', 'lever', 'g2f-hook', 'hook')] },
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
