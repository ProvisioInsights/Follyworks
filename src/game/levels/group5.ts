// Mission group 5: Ridiculous Machines. Timers, logic boxes, sensors, cannons, dynamite, the
// boxing glove and the cactus, then big chains that mix everything from groups 1-4.
// Pure level data; `solutions` and `counterexamples` are test fixtures only (tests/levels).

import { STANDARD_WORLD } from '../../core/level';
import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const link = (id: string, kind: 'wire' | 'rope' | 'belt', from: string, fromPort: string, to: string, toPort: string, via?: string[]): ConnectionDef =>
  via ? { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort }, via } : { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort } };
const wire = (id: string, from: string, to: string, toPort = 'in', fromPort = 'out'): ConnectionDef => link(id, 'wire', from, fromPort, to, toPort);

const WORLD = () => ({ ...STANDARD_WORLD });
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- 5-1: wait for the bucket

const waitForIt: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-wait-for-it',
    name: 'Wait For It',
    description: 'Punch a ball off the shelf and down the chute into the bucket. The catch: the bucket is still riding the conveyor, so the punch has to wait until it arrives.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g5a-shelf', 'plank', 700, 327, { length: 240 }),
      o('g5a-chute-l', 'wall', 860, 478, { w: 8, h: 124, material: 'steel' }),
      o('g5a-backboard', 'wall', 928, 452, { w: 8, h: 296, material: 'steel' }),
    ],
    startingObjects: [
      o('g5a-battery', 'battery', 1010, 600),
      o('g5a-conveyor-1', 'conveyor', 300, 617, { length: 400, speed: 60, dir: 'right' }),
      o('g5a-conveyor-2', 'conveyor', 700, 617, { length: 400, speed: 60, dir: 'right' }),
      o('g5a-bucket', 'bucket', 170, 584, { anchored: false }),
    ],
    connections: [wire('g5a-w1', 'g5a-battery', 'g5a-conveyor-1'), wire('g5a-w2', 'g5a-battery', 'g5a-conveyor-2')],
    inventory: [
      { type: 'bowling_ball', count: 1 },
      { type: 'ball', count: 2 },
      { type: 'boxing_glove', count: 1 },
      { type: 'timer', count: 1 },
      { type: 'toggle_switch', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g5a-bucket', count: 1, filter: { tag: 'ball' }, label: 'Land a ball in the bucket' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 3, elegantTime: 8, absurdStages: 7 },
    hints: [
      'A boxing glove punches whatever sits right in front of it the moment power reaches it. Put a ball in front of it.',
      'A kitchen timer counts down from RUN and then sends power on its own. How long does the bucket take to reach the chute?',
      'Set a ball at the end of the shelf, the glove just behind it, and a timer of about 8 seconds wired to the glove. Or let the passing bucket flick a toggle switch.',
    ],
    metadata: { chapter: 5, order: 1, author: 'Follyworks', blurb: 'Patience, measured in seconds.' },
  },
  solutions: [
    {
      objects: [o('s-iron', 'bowling_ball', 800, 300), o('s-glove', 'boxing_glove', 748, 300), o('s-timer', 'timer', 640, 240, { delay: 8, hold: 0 })],
      connections: [wire('s-w1', 's-timer', 's-glove')],
    },
    {
      // The bucket reports its own arrival by flicking a toggle switch on the way past.
      objects: [o('s-iron', 'bowling_ball', 800, 300), o('s-glove', 'boxing_glove', 748, 300), o('s-switch', 'toggle_switch', 840, 572)],
      connections: [wire('s-w1', 'g5a-battery', 's-switch'), wire('s-w2', 's-switch', 's-glove')],
    },
    // ABSURD: the bucket flicks a switch that starts a timer that fires the glove, while a rubber ball rides along.
    {
      objects: [
        o('s-iron', 'bowling_ball', 800, 300),
        o('s-ball', 'ball', 760, 306),
        o('s-glove', 'boxing_glove', 706, 300),
        o('s-switch', 'toggle_switch', 560, 572),
        o('s-timer', 'timer', 640, 240, { delay: 4, hold: 0 }),
      ],
      connections: [wire('s-w1', 'g5a-battery', 's-switch'), wire('s-w2', 's-switch', 's-timer'), wire('s-w3', 's-timer', 's-glove')],
    },
  ],
  counterexamples: [
    {
      why: 'the glove is wired straight to the battery and punches before the bucket arrives',
      build: {
        objects: [o('s-iron', 'bowling_ball', 800, 300), o('s-glove', 'boxing_glove', 748, 300)],
        connections: [wire('s-w1', 'g5a-battery', 's-glove')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-2: blow, but not too much

const puffPiece: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-puff-piece',
    name: 'Puff Piece',
    description: 'Breeze the balloon along the ceiling into the drying rack and let it rest there for 3 seconds. Blow too long and it meets the cactus. Nobody wants that.',
    environment: 'maintenance',
    world: WORLD(),
    fixedObjects: [
      o('g5b-ceiling', 'wall', 560, 60, { w: 1120, h: 40, material: 'concrete' }),
      o('g5b-rack-l', 'plank', 500, 170, { length: 60 }, Math.PI / 2),
      o('g5b-rack-r', 'plank', 720, 170, { length: 60 }, Math.PI / 2),
      o('g5b-rack-bar', 'plank', 610, 206, { length: 250 }),
      o('g5b-cactus-shelf', 'plank', 860, 176, { length: 100 }),
    ],
    startingObjects: [
      o('g5b-fan', 'fan', 150, 112, { strength: 4, range: 700 }),
      o('g5b-balloon', 'balloon', 230, 101, { lift: 1, color: 'teal' }),
      o('g5b-cactus', 'cactus', 860, 141),
    ],
    connections: [],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'toggle_switch', count: 1 },
      { type: 'pressure_plate', count: 1 },
      { type: 'logic_gate', count: 1 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'g5b-balloon' },
        region: { x: 510, y: 70, w: 200, h: 90 },
        hold: 3,
        label: 'Rest the balloon in the drying rack for 3 seconds',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 2, elegantTime: 6, absurdStages: 4 },
    hints: [
      'Wired straight to a battery, the fan never stops. Something has to cut its power at the right moment.',
      'A toggle switch turns OFF when something passes it the other way. Flip the switch (F) and a balloon drifting right switches it off.',
      'Or put a pressure plate upside down on the ceiling inside the rack: the balloon presses it from below. A NOT logic box turns "pressed" into "stop".',
    ],
    metadata: { chapter: 5, order: 2, author: 'Follyworks', blurb: 'Know when to stop blowing.' },
  },
  solutions: [
    {
      // Tripwire: the balloon flicks a flipped switch OFF as it drifts into the rack.
      objects: [o('s-battery', 'battery', 300, 560), o('s-switch', 'toggle_switch', 560, 120, { on: true }, 0, true)],
      connections: [wire('s-w1', 's-battery', 's-switch'), wire('s-w2', 's-switch', 'g5b-fan')],
    },
    {
      // Upside-down pressure plate on the ceiling + NOT box: the fan runs until the balloon presses the plate.
      objects: [o('s-battery', 'battery', 300, 560), o('s-plate', 'pressure_plate', 610, 89, { minMass: 0.2 }, Math.PI), o('s-not', 'logic_gate', 400, 300, { mode: 'not' })],
      connections: [wire('s-w1', 's-battery', 's-plate'), wire('s-w2', 's-plate', 's-not', 'a'), wire('s-w3', 's-not', 'g5b-fan')],
    },
    // ABSURD: switch, ceiling plate and a NOT box all in the loop.
    {
      objects: [
        o('s-battery', 'battery', 300, 560),
        o('s-switch', 'toggle_switch', 400, 120, { on: false }),
        o('s-plate', 'pressure_plate', 650, 89, { minMass: 0.2 }, Math.PI),
        o('s-not', 'logic_gate', 400, 300, { mode: 'not' }),
      ],
      connections: [wire('s-w1', 's-battery', 's-switch'), wire('s-w2', 's-switch', 's-plate'), wire('s-w3', 's-plate', 's-not', 'a'), wire('s-w4', 's-not', 'g5b-fan')],
    },
  ],
  counterexamples: [
    {
      why: 'the fan is wired straight to the battery and blows the balloon onto the cactus',
      build: { objects: [o('s-battery', 'battery', 300, 560)], connections: [wire('s-w1', 's-battery', 'g5b-fan')] },
    },
  ],
};

// ---------------------------------------------------------------- 5-3: pop every balloon in the place

const partyPooper: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-party-pooper',
    name: 'Party Pooper',
    description: 'Three balloons, three hiding places, one small parts bin. Pop every last one of them, as tidily or as explosively as you like.',
    environment: 'greenhouse',
    world: WORLD(),
    fixedObjects: [
      // Left: a balloon tied down under a hanging cactus.
      o('g5c-chain', 'wall', 200, 75, { w: 6, h: 70, material: 'steel' }),
      o('g5c-hook-a', 'hook', 200, 612),
      // Middle: a brick bunker.
      o('g5c-bunker-l', 'wall', 480, 530, { w: 16, h: 200, material: 'brick' }),
      o('g5c-bunker-r', 'wall', 640, 530, { w: 16, h: 200, material: 'brick' }),
      o('g5c-bunker-roof', 'wall', 560, 422, { w: 176, h: 16, material: 'brick' }),
      o('g5c-hook-b', 'hook', 560, 612),
      // Right: a high shelf.
      o('g5c-shelf', 'wall', 880, 300, { w: 200, h: 20, material: 'wood' }),
      o('g5c-shelf-strut', 'wall', 970, 470, { w: 16, h: 320, material: 'wood' }),
      o('g5c-hook-c', 'hook', 880, 284),
    ],
    startingObjects: [
      o('g5c-cactus', 'cactus', 200, 140),
      o('g5c-balloon-a', 'balloon', 200, 420, { lift: 1, color: 'red' }),
      o('g5c-balloon-b', 'balloon', 560, 530, { lift: 1, color: 'yellow' }),
      o('g5c-balloon-c', 'balloon', 880, 150, { lift: 1, color: 'teal' }),
    ],
    connections: [
      link('g5c-tether-a', 'rope', 'g5c-hook-a', 'hook', 'g5c-balloon-a', 'string'),
      link('g5c-tether-b', 'rope', 'g5c-hook-b', 'hook', 'g5c-balloon-b', 'string'),
      link('g5c-tether-c', 'rope', 'g5c-hook-c', 'hook', 'g5c-balloon-c', 'string'),
    ],
    inventory: [
      { type: 'candle', count: 2 },
      { type: 'dynamite', count: 2 },
      { type: 'battery', count: 1 },
      { type: 'plank', count: 1 },
      { type: 'rocket', count: 1 },
    ],
    goals: [
      { kind: 'destroyed', target: { id: 'g5c-balloon-a' }, label: 'Pop the balloon under the cactus' },
      { kind: 'destroyed', target: { id: 'g5c-balloon-b' }, label: 'Pop the balloon in the bunker' },
      { kind: 'destroyed', target: { id: 'g5c-balloon-c' }, label: 'Pop the balloon over the high shelf' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 4, absurdStages: 10 },
    hints: [
      'The left balloon only needs setting free. The cactus will do the rest.',
      'Explosions reach straight through brick, and a battery wired to dynamite is a detonator. Turn up the Bang for a bigger blast.',
      'No battery needed, even: a candle lights a fuse, and a blast sets off any dynamite close by. Fire, boom, boom.',
    ],
    metadata: { chapter: 5, order: 3, author: 'Follyworks', blurb: 'Nobody invited the cactus.' },
  },
  solutions: [
    {
      // Snip the left tether with a candle, then detonate one charge per balloon.
      objects: [
        o('s-candle', 'candle', 204, 601),
        o('s-battery', 'battery', 760, 601),
        o('s-tnt-b', 'dynamite', 560, 401, { fuse: 1.5, power: 5 }),
        o('s-tnt-c', 'dynamite', 820, 279, { fuse: 1.5, power: 5 }),
      ],
      connections: [wire('s-w1', 's-battery', 's-tnt-b'), wire('s-w2', 's-battery', 's-tnt-c')],
    },
    {
      // No electricity: a candle lights the first charge, whose blast sets off the second.
      objects: [
        o('s-candle-a', 'candle', 204, 601),
        o('s-candle-b', 'candle', 520, 385),
        o('s-tnt-b', 'dynamite', 520, 361, { fuse: 1.5, power: 8 }),
        o('s-tnt-c', 'dynamite', 795, 279, { fuse: 1.5, power: 8 }),
      ],
      connections: [],
    },
    // ABSURD: the candle chain, plus a battery-fired rocket and a big bang on a plank.
    {
      objects: [
        o('s-candle-a', 'candle', 204, 601),
        o('s-candle-b', 'candle', 520, 385),
        o('s-tnt-b', 'dynamite', 520, 361, { fuse: 1.5, power: 8 }),
        o('s-tnt-c', 'dynamite', 795, 279, { fuse: 1.5, power: 8 }),
        o('s-battery', 'battery', 760, 601),
        o('s-rocket', 'rocket', 380, 560, { thrust: 3 }, -Math.PI / 2),
      ],
      connections: [wire('s-w1', 's-battery', 's-rocket')],
    },
  ],
};

// ---------------------------------------------------------------- 5-4: a sensor that remembers

const latchOn: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-latch-on',
    name: 'Latch On',
    description: 'Once the ball has dropped into the bucket, Bolt has to shove the bucket all the way into the shipping bay. Wake him too early and he pushes an empty bucket.',
    environment: 'underground',
    world: WORLD(),
    fixedObjects: [
      o('g5d-ramp', 'plank', 250, 140, { length: 320 }, 0.25),
      o('g5d-ledge-l', 'plank', 435, 187, { length: 92 }),
      o('g5d-ledge-r', 'plank', 605, 195, { length: 92 }),
      o('g5d-backboard', 'plank', 750, 330, { length: 280 }, Math.PI / 2),
      o('g5d-funnel-l', 'plank', 662, 525, { length: 62 }, 0.96),
      o('g5d-funnel-r', 'plank', 752, 525, { length: 62 }, -0.96),
      o('g5d-dock', 'wall', 181, 555, { w: 200, h: 150, material: 'concrete' }),
      o('g5d-bay-wall', 'plank', 1066, 570, { length: 120 }, Math.PI / 2),
    ],
    startingObjects: [
      o('g5d-ball', 'bowling_ball', 110, 74),
      o('g5d-bucket', 'bucket', 700, 608, { anchored: false }),
      o('g5d-bolt', 'robot', 300, 607, { speed: 160, awake: false }),
      o('g5d-cactus', 'cactus', 141, 451),
    ],
    connections: [],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'pressure_plate', count: 1 },
      { type: 'logic_gate', count: 2 },
      { type: 'toggle_switch', count: 1 },
      { type: 'plank', count: 2 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g5d-bucket', count: 1, filter: { id: 'g5d-ball' }, label: 'Catch the ball in the bucket' },
      { kind: 'enterRegion', target: { id: 'g5d-bucket' }, region: { x: 900, y: 540, w: 160, h: 90 }, hold: 1, label: 'Push the bucket into the shipping bay' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 3, elegantTime: 10, absurdStages: 7 },
    hints: [
      'Wire Bolt’s antenna and he walks only while it has power. Power him from the start and he shoves an empty bucket away.',
      'The gap in the ledge is exactly one pressure plate wide. It feels the ball roll over, but only for a moment: wired straight to Bolt, he barely takes a step.',
      'Run the plate into a logic box set to TOGGLE: the first press flips it on and it stays on. Battery → plate → TOGGLE → Bolt.',
    ],
    metadata: { chapter: 5, order: 4, author: 'Follyworks', blurb: 'A sensor with a memory.' },
  },
  solutions: [
    {
      objects: [o('s-battery', 'battery', 250, 452), o('s-plate', 'pressure_plate', 520, 189, { minMass: 0.5 }), o('s-latch', 'logic_gate', 880, 420, { mode: 'toggle' })],
      connections: [wire('s-w1', 's-battery', 's-plate'), wire('s-w2', 's-plate', 's-latch', 'a'), wire('s-w3', 's-latch', 'g5d-bolt')],
    },
    {
      // A toggle switch is a memory too: the falling ball flicks it on and it stays on.
      objects: [o('s-battery', 'battery', 250, 452), o('s-plate', 'plank', 520, 191, { length: 70 }), o('s-switch', 'toggle_switch', 700, 450, {}, Math.PI / 2)],
      connections: [wire('s-w1', 's-battery', 's-switch'), wire('s-w2', 's-switch', 'g5d-bolt')],
    },
    // ABSURD: plate -> TOGGLE -> OR -> Bolt, with the toggle switch on the backboard also feeding the OR.
    {
      objects: [
        o('s-battery', 'battery', 250, 452),
        o('s-plate', 'pressure_plate', 520, 189, { minMass: 0.5 }),
        o('s-latch', 'logic_gate', 880, 420, { mode: 'toggle' }),
        o('s-or', 'logic_gate', 960, 420, { mode: 'or' }),
        o('s-switch', 'toggle_switch', 700, 450, {}, Math.PI / 2),
      ],
      connections: [
        wire('s-w1', 's-battery', 's-plate'),
        wire('s-w2', 's-plate', 's-latch', 'a'),
        wire('s-w3', 's-latch', 's-or', 'a'),
        wire('s-w4', 's-battery', 's-switch'),
        wire('s-w5', 's-switch', 's-or', 'b'),
        wire('s-w6', 's-or', 'g5d-bolt'),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'Bolt is wired straight to the plate and stops as soon as the ball has rolled past',
      build: {
        objects: [o('s-battery', 'battery', 250, 452), o('s-plate', 'pressure_plate', 520, 189, { minMass: 0.5 })],
        connections: [wire('s-w1', 's-battery', 's-plate'), wire('s-w2', 's-plate', 'g5d-bolt')],
      },
    },
    {
      why: 'Bolt is wired straight to the battery and pushes the bucket away before the ball arrives',
      build: {
        objects: [o('s-battery', 'battery', 250, 452), o('s-plate', 'pressure_plate', 520, 189, { minMass: 0.5 })],
        connections: [wire('s-w1', 's-battery', 'g5d-bolt')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-5: three cannons, three buckets

const shootingGallery: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-shooting-gallery',
    name: 'Shooting Gallery',
    description: 'Three buckets: one behind the wall, one on the middle shelf, one way up top. Land a cannonball in every one of them. Each cannon fires the same shot every time, so you will need to aim more than one.',
    environment: 'garage',
    world: WORLD(),
    fixedObjects: [
      o('g5e-wall', 'wall', 330, 570, { w: 20, h: 120, material: 'brick' }),
      o('g5e-mid-shelf', 'plank', 700, 407, { length: 160 }),
      o('g5e-mid-leg', 'wall', 700, 522, { w: 16, h: 216, material: 'steel' }),
      o('g5e-top-shelf', 'plank', 960, 237, { length: 180 }),
      o('g5e-top-leg', 'wall', 1040, 437, { w: 16, h: 386, material: 'steel' }),
    ],
    startingObjects: [
      o('g5e-bucket-a', 'bucket', 450, 608, { anchored: true }),
      o('g5e-bucket-b', 'bucket', 700, 378, { anchored: true }),
      o('g5e-bucket-c', 'bucket', 960, 208, { anchored: true }),
      o('g5e-cactus', 'cactus', 640, 371),
      o('g5e-trampoline', 'trampoline', 560, 615, { power: 1.6 }),
    ],
    connections: [],
    inventory: [
      { type: 'cannon', count: 3 },
      { type: 'battery', count: 1 },
      { type: 'candle', count: 2 },
      { type: 'timer', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'ball', count: 2 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g5e-bucket-a', count: 1, filter: { type: 'cannonball' }, label: 'Cannonball in the bucket behind the wall' },
      { kind: 'containerCount', container: 'g5e-bucket-b', count: 1, filter: { type: 'cannonball' }, label: 'Cannonball in the middle bucket' },
      { kind: 'containerCount', container: 'g5e-bucket-c', count: 1, filter: { type: 'cannonball' }, label: 'Cannonball in the top bucket' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 4, elegantTime: 4, absurdStages: 8 },
    hints: [
      'A cannon fires when power reaches its trigger, or when a flame touches its fuse. Rotate it to aim, and set Muzzle speed in its properties.',
      'High and slow drops into a bucket; low and fast bounces off the rim. Lob your shots.',
      'Three cannons, one battery wired to all three. Try about 60° up for the near buckets and a faster, flatter shot for the top shelf.',
    ],
    metadata: { chapter: 5, order: 5, author: 'Follyworks', blurb: 'Step right up. Three shots, three buckets.' },
  },
  solutions: [
    {
      objects: [
        o('s-battery', 'battery', 70, 601),
        o('s-cannon-a', 'cannon', 140, 590, { power: 525, shots: 1 }, -50 * DEG),
        o('s-cannon-b', 'cannon', 220, 590, { power: 975, shots: 1 }, -70 * DEG),
        o('s-cannon-c', 'cannon', 140, 520, { power: 1600, shots: 1 }, -50 * DEG),
      ],
      connections: [wire('s-w1', 's-battery', 's-cannon-a'), wire('s-w2', 's-battery', 's-cannon-b'), wire('s-w3', 's-battery', 's-cannon-c')],
    },
    {
      // A timer holds the long shot back a second so the three balls never share the sky.
      objects: [
        o('s-battery', 'battery', 70, 601),
        o('s-timer', 'timer', 100, 420, { delay: 1, hold: 0 }),
        o('s-cannon-a', 'cannon', 140, 590, { power: 525, shots: 1 }, -50 * DEG),
        o('s-cannon-b', 'cannon', 220, 590, { power: 975, shots: 1 }, -70 * DEG),
        o('s-cannon-c', 'cannon', 140, 520, { power: 1600, shots: 1 }, -50 * DEG),
      ],
      connections: [wire('s-w1', 's-battery', 's-cannon-a'), wire('s-w2', 's-battery', 's-cannon-b'), wire('s-w3', 's-battery', 's-timer'), wire('s-w4', 's-timer', 's-cannon-c')],
    },
    // ABSURD: a timer staggers the first shot while a rubber ball boings away on the trampoline.
    {
      objects: [
        o('s-battery', 'battery', 70, 601),
        o('s-timer', 'timer', 100, 420, { delay: 0.8, hold: 0 }),
        o('s-cannon-a', 'cannon', 140, 590, { power: 525, shots: 1 }, -50 * DEG),
        o('s-cannon-b', 'cannon', 220, 590, { power: 975, shots: 1 }, -70 * DEG),
        o('s-cannon-c', 'cannon', 140, 520, { power: 1600, shots: 1 }, -50 * DEG),
        o('s-ball', 'ball', 560, 520),
      ],
      connections: [wire('s-w1', 's-battery', 's-timer'), wire('s-w2', 's-timer', 's-cannon-a'), wire('s-w3', 's-battery', 's-cannon-c'), wire('s-w4', 's-battery', 's-cannon-b')],
    },
  ],
  counterexamples: [
    {
      why: 'one cannon fires all its shots along the same path',
      build: {
        objects: [o('s-battery', 'battery', 70, 601), o('s-cannon-a', 'cannon', 140, 590, { power: 525, shots: 3 }, -50 * DEG), o('s-timer', 'timer', 100, 420, { delay: 1, hold: 0.5 })],
        connections: [wire('s-w1', 's-battery', 's-cannon-a'), wire('s-w2', 's-timer', 's-cannon-a')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-6: three keys, one lock

const threeKeys: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-three-key-lock',
    name: 'Three-Key Lock',
    description: 'The vault lamp is wired through two AND boxes: it lights only while all three pressure plates are pressed at once. Get the balloon, the steel crate and Bolt onto their plates and keep them there for 2 seconds.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g5f-ceiling', 'wall', 560, 60, { w: 1120, h: 40, material: 'concrete' }),
      o('g5f-stopper', 'wall', 975, 120, { w: 12, h: 80, material: 'steel' }),
      o('g5f-crate-shelf', 'wall', 640, 300, { w: 160, h: 20, material: 'wood' }),
      o('g5f-bolt-shelf', 'wall', 980, 430, { w: 200, h: 20, material: 'steel' }),
      o('g5f-bolt-stop', 'wall', 1074, 385, { w: 12, h: 70, material: 'steel' }),
      o('g5f-hook', 'hook', 300, 612),
    ],
    startingObjects: [
      o('g5f-battery', 'battery', 560, 601),
      o('g5f-plate-a', 'pressure_plate', 910, 87, { minMass: 0.2 }, Math.PI),
      o('g5f-plate-b', 'pressure_plate', 505, 621, { minMass: 3 }),
      o('g5f-plate-c', 'pressure_plate', 1030, 413, { minMass: 1 }),
      o('g5f-and-1', 'logic_gate', 760, 520, { mode: 'and' }),
      o('g5f-and-2', 'logic_gate', 840, 520, { mode: 'and' }),
      o('g5f-lamp', 'light_bulb', 920, 520),
      o('g5f-balloon', 'balloon', 300, 470, { lift: 1, color: 'yellow' }),
      o('g5f-crate', 'crate', 590, 268, { material: 'steel' }),
      o('g5f-bolt', 'robot', 905, 396, { speed: 60, awake: true }),
    ],
    connections: [
      link('g5f-tether', 'rope', 'g5f-hook', 'hook', 'g5f-balloon', 'string'),
      wire('g5f-w1', 'g5f-battery', 'g5f-plate-a'),
      wire('g5f-w2', 'g5f-battery', 'g5f-plate-b'),
      wire('g5f-w3', 'g5f-battery', 'g5f-plate-c'),
      wire('g5f-w4', 'g5f-plate-a', 'g5f-and-1', 'a'),
      wire('g5f-w5', 'g5f-plate-b', 'g5f-and-1', 'b'),
      wire('g5f-w6', 'g5f-and-1', 'g5f-and-2', 'a'),
      wire('g5f-w7', 'g5f-plate-c', 'g5f-and-2', 'b'),
      wire('g5f-w8', 'g5f-and-2', 'g5f-lamp'),
    ],
    inventory: [
      { type: 'candle', count: 1 },
      { type: 'fan', count: 1 },
      { type: 'boxing_glove', count: 1 },
      { type: 'logic_gate', count: 2 },
      { type: 'timer', count: 1 },
      { type: 'plank', count: 2 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g5f-lamp' }, duration: 2, label: 'Keep the vault lamp lit for 2 seconds' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 4, elegantTime: 8, absurdStages: 12 },
    hints: [
      'Three keys: the ceiling plate wants the balloon pressing up on it, the floor plate wants something heavy (the steel crate), and the shelf plate wants Bolt standing still on it.',
      'Free the balloon with a flame on its string, then blow it along the ceiling. Punch the crate off its shelf with the glove; you can wire the glove and fan to the level’s battery.',
      'Bolt never stops walking, so he walks off his plate. Wire his plate’s output through a NOT box into his antenna: he walks until he is standing on it, then stops.',
    ],
    metadata: { chapter: 5, order: 6, author: 'Follyworks', blurb: 'All three keys, all at once.' },
  },
  solutions: [
    {
      objects: [
        o('s-candle', 'candle', 304, 601),
        o('s-fan', 'fan', 200, 112, { strength: 5, range: 700 }),
        o('s-glove', 'boxing_glove', 640, 268, { power: 750 }, 0, true),
        o('s-not', 'logic_gate', 1000, 520, { mode: 'not' }),
      ],
      connections: [
        wire('s-w1', 'g5f-battery', 's-fan'),
        wire('s-w2', 'g5f-battery', 's-glove'),
        wire('s-w3', 'g5f-plate-c', 's-not', 'a'),
        wire('s-w4', 's-not', 'g5f-bolt'),
      ],
    },
    {
      // The balloon arriving at the ceiling fires the glove.
      objects: [
        o('s-candle', 'candle', 304, 601),
        o('s-fan', 'fan', 200, 112, { strength: 5, range: 700 }),
        o('s-glove', 'boxing_glove', 640, 268, { power: 750 }, 0, true),
        o('s-not', 'logic_gate', 1000, 520, { mode: 'not' }),
      ],
      connections: [
        wire('s-w1', 'g5f-battery', 's-fan'),
        wire('s-w2', 'g5f-plate-a', 's-glove'),
        wire('s-w3', 'g5f-plate-c', 's-not', 'a'),
        wire('s-w4', 's-not', 'g5f-bolt'),
      ],
    },
    {
      // ABSURD: battery -> timer -> glove, and Bolt's brake runs through a second box.
      objects: [
        o('s-candle', 'candle', 304, 601),
        o('s-fan', 'fan', 200, 112, { strength: 5, range: 700 }),
        o('s-timer', 'timer', 560, 520, { delay: 1, hold: 0 }),
        o('s-glove', 'boxing_glove', 640, 268, { power: 750 }, 0, true),
        o('s-or', 'logic_gate', 1000, 470, { mode: 'or' }),
        o('s-not', 'logic_gate', 1000, 520, { mode: 'not' }),
      ],
      connections: [
        wire('s-w1', 'g5f-battery', 's-fan'),
        wire('s-w2', 'g5f-battery', 's-timer'),
        wire('s-w3', 's-timer', 's-glove'),
        wire('s-w4', 'g5f-plate-c', 's-or', 'a'),
        wire('s-w5', 'g5f-plate-a', 's-or', 'b'),
        wire('s-w6', 's-or', 's-not', 'a'),
        wire('s-w7', 's-not', 'g5f-bolt'),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'Bolt is never told to stop, so he strolls straight over his plate',
      build: {
        objects: [o('s-candle', 'candle', 304, 601), o('s-fan', 'fan', 200, 112, { strength: 5, range: 700 }), o('s-glove', 'boxing_glove', 640, 268, { power: 750 }, 0, true)],
        connections: [wire('s-w1', 'g5f-battery', 's-fan'), wire('s-w2', 'g5f-battery', 's-glove')],
      },
    },
    {
      why: 'without a fan the freed balloon floats straight up and never reaches the ceiling plate',
      build: {
        objects: [o('s-candle', 'candle', 304, 601), o('s-glove', 'boxing_glove', 640, 268, { power: 750 }, 0, true), o('s-not', 'logic_gate', 1000, 520, { mode: 'not' })],
        connections: [wire('s-w2', 'g5f-battery', 's-glove'), wire('s-w3', 'g5f-plate-c', 's-not', 'a'), wire('s-w4', 's-not', 'g5f-bolt')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-7: hoist the sleeping robot, then wake him

const goingUp: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-going-up',
    name: 'Going Up',
    description: 'Bolt is fast asleep in the basement and the party is upstairs. He only wakes when the wall switch is flipped, and he cannot climb. Hoist him up to the party floor, then flip the switch so he strolls over to the dance lights.',
    environment: 'basement',
    world: WORLD(),
    fixedObjects: [
      o('g5g-party-floor', 'wall', 885, 480, { w: 370, h: 300, material: 'brick' }),
      o('g5g-switch-post', 'wall', 300, 590, { w: 96, h: 80, material: 'wood' }),
      o('g5g-end-wall', 'wall', 1074, 285, { w: 12, h: 90, material: 'brick' }),
      o('g5g-pipe', 'plank', 330, 70, { length: 420 }),
    ],
    startingObjects: [
      o('g5g-battery', 'battery', 520, 601),
      o('g5g-switch', 'toggle_switch', 300, 536, {}, Math.PI / 2),
      o('g5g-bolt', 'robot', 660, 607, { speed: 70, awake: false }),
      o('g5g-lamp-1', 'light_bulb', 960, 300),
      o('g5g-lamp-2', 'light_bulb', 1030, 300),
      o('g5g-crate-1', 'crate', 120, 608, { material: 'wood' }),
      o('g5g-crate-2', 'crate', 120, 563, { material: 'wood' }),
      o('g5g-crate-3', 'crate', 172, 608, { material: 'wood' }),
    ],
    connections: [
      wire('g5g-w1', 'g5g-battery', 'g5g-switch'),
      wire('g5g-w2', 'g5g-switch', 'g5g-bolt'),
      wire('g5g-w3', 'g5g-switch', 'g5g-lamp-1'),
      wire('g5g-w4', 'g5g-switch', 'g5g-lamp-2'),
    ],
    inventory: [
      { type: 'pulley', count: 3 },
      { type: 'rope', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'bowling_ball', count: 1 },
      { type: 'ball', count: 2 },
      { type: 'plank', count: 2 },
    ],
    goals: [
      { kind: 'enterRegion', target: { id: 'g5g-bolt' }, region: { x: 930, y: 230, w: 140, h: 100 }, hold: 1, label: 'Get Bolt to the dance floor' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 5, elegantTime: 8, absurdStages: 8 },
    hints: [
      'Bolt is asleep until the wall switch is flipped. Flip it too early and he walks into the brick wall; flip it while he is up on the party floor and he walks to the lights.',
      'A rope tied to Bolt’s back hook, over a pulley above the party floor and down to a heavy bucket makes a counterweight lift.',
      'Let the falling counterweight brush past the switch on its way down: the switch flips just as Bolt arrives upstairs.',
    ],
    metadata: { chapter: 5, order: 7, author: 'Follyworks', blurb: 'Upward mobility, sleepwalking edition.' },
  },
  solutions: [
    {
      objects: [
        o('s-p1', 'pulley', 880, 150),
        o('s-p2', 'pulley', 300, 100),
        o('s-bucket', 'bucket', 300, 208, { anchored: false }),
        o('s-iron', 'bowling_ball', 300, 208 - 8),
      ],
      connections: [link('s-rope', 'rope', 'g5g-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2'])],
    },
    {
      // The counterweight falls clear of the switch; a dropped ball flips it instead.
      objects: [
        o('s-p1', 'pulley', 880, 150),
        o('s-p2', 'pulley', 440, 100),
        o('s-bucket', 'bucket', 440, 265, { anchored: false }),
        o('s-iron', 'bowling_ball', 440, 265 - 8),
        o('s-ball', 'ball', 300, 160),
      ],
      connections: [link('s-rope', 'rope', 'g5g-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2'])],
    },
    {
      // ABSURD
      objects: [
        o('s-p1', 'pulley', 880, 150),
        o('s-p2', 'pulley', 300, 100),
        o('s-bucket', 'bucket', 300, 208, { anchored: false }),
        o('s-iron', 'bowling_ball', 300, 208 - 8),
        o('s-ball', 'ball', 300 + 10, 208 - 40),
        o('s-ball-2', 'ball', 215, 300),
        o('s-ramp', 'plank', 190, 470, { length: 120 }, -0.5),
      ],
      connections: [link('s-rope', 'rope', 'g5g-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2'])],
    },
  ],
  counterexamples: [
    {
      why: 'the counterweight falls clear of the switch, so Bolt is hoisted upstairs but sleeps at the top',
      build: {
        objects: [o('s-p1', 'pulley', 880, 150), o('s-p2', 'pulley', 440, 100), o('s-bucket', 'bucket', 440, 208, { anchored: false }), o('s-iron', 'bowling_ball', 440, 208 - 8)],
        connections: [link('s-rope', 'rope', 'g5g-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2'])],
      },
    },
    {
      why: 'an empty bucket is too light to lift a robot',
      build: {
        objects: [o('s-p1', 'pulley', 880, 150), o('s-p2', 'pulley', 300, 100), o('s-bucket', 'bucket', 300, 208, { anchored: false })],
        connections: [link('s-rope', 'rope', 'g5g-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2'])],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-8: one flame, a relay of blasts, a cannon on a tripwire

const fireInTheHole: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-fire-in-the-hole',
    name: 'Fire in the Hole',
    description: 'Blasting day in the mine. Pop the balloon sealed in the steel bunker, and land a cannonball in the bucket on the far shelf. There is no battery in your kit: the only power is the mine’s own, and it runs through the pressure plate on the floor.',
    environment: 'underground',
    world: WORLD(),
    fixedObjects: [
      o('g5h-shelf', 'plank', 960, 330, { length: 130 }),
      o('g5h-shelf-post', 'wall', 960, 482, { w: 20, h: 290, material: 'concrete' }),
      o('g5h-bunker-top', 'wall', 170, 66, { w: 132, h: 12, material: 'steel' }),
      o('g5h-bunker-l', 'wall', 170 - 60, 124, { w: 12, h: 104, material: 'steel' }),
      o('g5h-bunker-r', 'wall', 170 + 60, 124, { w: 12, h: 104, material: 'steel' }),
      o('g5h-bunker-floor', 'wall', 170, 182, { w: 132, h: 12, material: 'steel' }),
      o('g5h-hook', 'hook', 170, 168),
      o('g5h-crane-hook', 'hook', 680, 60),
    ],
    startingObjects: [
      o('g5h-battery', 'battery', 1040, 601),
      o('g5h-plate', 'pressure_plate', 680, 621, { minMass: 2 }),
      o('g5h-lamp', 'light_bulb', 860, 591),
      o('g5h-crate', 'crate', 680, 300, { material: 'steel' }),
      o('g5h-bucket', 'bucket', 960, 301, { anchored: true }),
      o('g5h-balloon', 'balloon', 170, 110, { lift: 1, color: 'teal' }),
      o('g5h-rubble-1', 'crate', 110, 608, { material: 'wood' }),
      o('g5h-rubble-2', 'crate', 156, 608, { material: 'wood' }),
      o('g5h-rubble-3', 'crate', 133, 563, { material: 'wood' }),
    ],
    connections: [
      link('g5h-tether', 'rope', 'g5h-hook', 'hook', 'g5h-balloon', 'string'),
      link('g5h-hang', 'rope', 'g5h-crane-hook', 'hook', 'g5h-crate', 'hook'),
      wire('g5h-w1', 'g5h-battery', 'g5h-plate'),
      wire('g5h-w2', 'g5h-plate', 'g5h-lamp'),
    ],
    inventory: [
      { type: 'candle', count: 1 },
      { type: 'dynamite', count: 3 },
      { type: 'cannon', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'timer', count: 1 },
      { type: 'ball', count: 2 },
    ],
    goals: [
      { kind: 'destroyed', target: { id: 'g5h-balloon' }, label: 'Pop the balloon in the bunker' },
      { kind: 'containerCount', container: 'g5h-bucket', count: 1, filter: { type: 'cannonball' }, label: 'Cannonball in the far bucket' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 5, elegantTime: 5, absurdStages: 13 },
    hints: [
      'The pressure plate is the only power you get. Something has to land on it, and its output can fire a cannon.',
      'A blast shoves the ore crate off its ledge. Steel walls stop things, not shock waves: a blast close enough pops the balloon through them.',
      'One candle, three sticks: light one stick, and a second stick within its blast goes off a moment later. Relay the bang over to the bunker.',
    ],
    metadata: { chapter: 5, order: 8, author: 'Follyworks', blurb: 'One match, two jobs, zero batteries.' },
  },
  solutions: [
    {
      // One flame does everything: it burns the crane rope and lights the first stick; the second stick relays the bang to the bunker.
      objects: [
        o('s-candle-shelf', 'plank', 680, 200 + 36, { length: 70 }),
        o('s-candle', 'candle', 680, 200),
        o('s-tnt-1', 'dynamite', 680, 200 - 24, { power: 7 }),
        o('s-shelf', 'plank', 420, 150 + 18, { length: 70 }),
        o('s-tnt-2', 'dynamite', 420, 150, { power: 7 }),
        o('s-cannon', 'cannon', 560, 590, { power: 1400, shots: 1 }, -55 * DEG),
      ],
      connections: [wire('s-w1', 'g5h-plate', 's-cannon')],
    },
    {
      // The candle only burns the rope; the crate landing on the plate fires the cannon and detonates a stick by the bunker.
      objects: [
        o('s-candle-shelf', 'plank', 680, 200 + 36, { length: 70 }),
        o('s-candle', 'candle', 680, 200),
        o('s-shelf', 'plank', 330, 188, { length: 70 }),
        o('s-tnt', 'dynamite', 330, 170, { power: 5 }),
        o('s-cannon', 'cannon', 560, 590, { power: 1400, shots: 1 }, -55 * DEG),
      ],
      connections: [wire('s-w1', 'g5h-plate', 's-cannon'), wire('s-w2', 'g5h-plate', 's-tnt')],
    },
    {
      // ABSURD: the relay as before, a timer counts the cannon in, and a ball drops onto the rubble for good measure.
      objects: [
        o('s-candle-shelf', 'plank', 680, 200 + 36, { length: 70 }),
        o('s-candle', 'candle', 680, 200),
        o('s-tnt-1', 'dynamite', 680, 200 - 24, { power: 7 }),
        o('s-shelf', 'plank', 420, 150 + 18, { length: 70 }),
        o('s-tnt-2', 'dynamite', 420, 150, { power: 7 }),
        o('s-timer', 'timer', 620, 470, { delay: 0.5, hold: 0 }),
        o('s-cannon', 'cannon', 560, 590, { power: 1400, shots: 1 }, -55 * DEG),
        o('s-ball', 'ball', 133, 420),
      ],
      connections: [wire('s-w1', 'g5h-plate', 's-timer'), wire('s-w2', 's-timer', 's-cannon')],
    },
  ],
  counterexamples: [
    {
      why: 'the candle burns the rope and the cannon fires, but nothing ever goes bang near the bunker',
      build: {
        objects: [o('s-candle-shelf', 'plank', 680, 200 + 36, { length: 70 }), o('s-candle', 'candle', 680, 200), o('s-cannon', 'cannon', 560, 590, { power: 1400, shots: 1 }, -55 * DEG)],
        connections: [wire('s-w1', 'g5h-plate', 's-cannon')],
      },
    },
    {
      why: 'one stick by the crane is too far from the bunker to pop the balloon on its own',
      build: {
        objects: [
          o('s-candle-shelf', 'plank', 680, 200 + 36, { length: 70 }),
          o('s-candle', 'candle', 680, 200),
          o('s-tnt-1', 'dynamite', 680, 200 - 24, { power: 10 }),
          o('s-cannon', 'cannon', 560, 590, { power: 1400, shots: 1 }, -55 * DEG),
        ],
        connections: [wire('s-w1', 'g5h-plate', 's-cannon')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-9: get the belt rolling, then sort iron from rubber in mid-air

const scrapSorter: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-scrap-sorter',
    name: 'Scrap Sorter',
    description: 'The scrap belt is stopped, its switch is up on the shelf, and the iron and rubber are all mixed up. Get the belt moving, then sort the load: every bowling ball into the iron skip, and at least two rubber balls into the little rubber bin.',
    environment: 'garage',
    world: WORLD(),
    fixedObjects: [
      o('g5i-belt-stop', 'wall', 104, 160, { w: 12, h: 60, material: 'steel' }),
      o('g5i-backstop', 'wall', 1000, 470, { w: 16, h: 300, material: 'brick' }),
      o('g5i-shelf', 'plank', 980, 290, { length: 120 }),
      o('g5i-skip-l', 'wall', 380, 600, { w: 12, h: 60, material: 'steel' }),
      o('g5i-skip-r', 'wall', 500, 600, { w: 12, h: 60, material: 'steel' }),
    ],
    startingObjects: [
      o('g5i-belt', 'conveyor', 300, 200, { length: 380, speed: 90 }),
      o('g5i-iron-1', 'bowling_ball', 140, 169),
      o('g5i-rubber-1', 'ball', 200, 175),
      o('g5i-iron-2', 'bowling_ball', 260, 169),
      o('g5i-rubber-2', 'ball', 320, 175),
      o('g5i-iron-3', 'bowling_ball', 380, 169),
      o('g5i-rubber-3', 'ball', 440, 175),
      o('g5i-rubber-bin', 'bucket', 700, 608),
      o('g5i-battery', 'battery', 940, 601),
      o('g5i-switch', 'toggle_switch', 920, 250),
      o('g5i-crate-1', 'crate', 1050, 608, { material: 'wood' }),
      o('g5i-crate-2', 'crate', 1050, 563, { material: 'wood' }),
    ],
    connections: [wire('g5i-w1', 'g5i-battery', 'g5i-switch'), wire('g5i-w2', 'g5i-switch', 'g5i-belt')],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'motor', count: 1 },
      { type: 'belt', count: 1 },
      { type: 'fan', count: 1 },
      { type: 'magnet', count: 1 },
      { type: 'timer', count: 1 },
      { type: 'ball', count: 1 },
      { type: 'plank', count: 3 },
    ],
    goals: [
      { kind: 'enterRegion', target: { id: 'g5i-iron-1' }, region: { x: 380 + 6, y: 540, w: 500 - 380 - 12, h: 90 }, hold: 1, label: 'Bowling ball #1 in the iron skip' },
      { kind: 'enterRegion', target: { id: 'g5i-iron-2' }, region: { x: 380 + 6, y: 540, w: 500 - 380 - 12, h: 90 }, hold: 1, label: 'Bowling ball #2 in the iron skip' },
      { kind: 'enterRegion', target: { id: 'g5i-iron-3' }, region: { x: 380 + 6, y: 540, w: 500 - 380 - 12, h: 90 }, hold: 1, label: 'Bowling ball #3 in the iron skip' },
      { kind: 'containerCount', container: 'g5i-rubber-bin', count: 2, filter: { type: 'ball' }, label: 'Two rubber balls in the rubber bin' },
    ],
    restrictions: { timeLimit: 30 },
    bonus: { elegantParts: 6, elegantTime: 12, absurdStages: 12 },
    hints: [
      'The belt’s end wheel can be driven without its switch: a powered motor and a belt from the motor to that wheel.',
      'Everything drops off the end of the belt in the same place. A fan pushes every ball equally hard, but a rubber ball is ten times lighter than a bowling ball.',
      'Blow sideways across the drop: the rubber flies off towards the far wall, the iron barely swerves. Planks can catch what the fan throws.',
    ],
    metadata: { chapter: 5, order: 9, author: 'Follyworks', blurb: 'Same push, very different results.' },
  },
  solutions: [
    {
      objects: [
        o('s-battery', 'battery', 200, 601),
        o('s-motor', 'motor', 160, 330, { rpm: 60 }),
        o('s-fan', 'fan', 430, 285, { strength: 10, range: 600 }),
        o('s-ramp', 'plank', 585, 505, { length: 190 }, -0.43),
        o('s-backboard', 'plank', 748, 510, { length: 120 }, Math.PI / 2),
      ],
      connections: [
        wire('s-w1', 's-battery', 's-motor'),
        link('s-belt', 'belt', 's-motor', 'rotor', 'g5i-belt', 'rotor'),
        wire('s-w2', 's-battery', 's-fan'),
      ],
    },
    {
      // Roll the spare ball through the shelf switch so the belt runs on its own power.
      objects: [
        o('s-battery', 'battery', 200, 601),
        o('s-chute', 'plank', 865, 240, { length: 90 }, 0.26),
        o('s-ball', 'ball', 840, 210),
        o('s-fan', 'fan', 430, 285, { strength: 10, range: 600 }),
        o('s-ramp', 'plank', 585, 505, { length: 190 }, -0.43),
        o('s-backboard', 'plank', 748, 510, { length: 120 }, Math.PI / 2),
      ],
      connections: [wire('s-w2', 's-battery', 's-fan')],
    },
    {
      // ABSURD: belt driven twice over, the fan on a timer, and a magnet in the skip to hug the iron.
      objects: [
        o('s-battery', 'battery', 200, 601),
        o('s-motor', 'motor', 160, 330, { rpm: 60 }),
        o('s-chute', 'plank', 865, 240, { length: 90 }, 0.26),
        o('s-ball', 'ball', 840, 210),
        o('s-timer', 'timer', 300, 420, { delay: 0.4, hold: 0 }),
        o('s-fan', 'fan', 430, 285, { strength: 10, range: 600 }),
        o('s-ramp', 'plank', 585, 505, { length: 190 }, -0.43),
        o('s-backboard', 'plank', 748, 510, { length: 120 }, Math.PI / 2),
        o('s-magnet', 'magnet', 320, 560, { strength: 4, reach: 200 }),
      ],
      connections: [
        wire('s-w1', 's-battery', 's-motor'),
        link('s-belt', 'belt', 's-motor', 'rotor', 'g5i-belt', 'rotor'),
        wire('s-w2', 's-battery', 's-timer'),
        wire('s-w3', 's-timer', 's-fan'),
        wire('s-w4', 's-battery', 's-magnet'),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'with no fan the rubber falls with the iron, straight into the skip',
      build: {
        objects: [o('s-battery', 'battery', 200, 601), o('s-motor', 'motor', 160, 330, { rpm: 60 }), o('s-ramp', 'plank', 585, 505, { length: 190 }, -0.43), o('s-backboard', 'plank', 748, 510, { length: 120 }, Math.PI / 2)],
        connections: [wire('s-w1', 's-battery', 's-motor'), link('s-belt', 'belt', 's-motor', 'rotor', 'g5i-belt', 'rotor')],
      },
    },
    {
      why: 'a perfect sorter is no use if the belt never moves',
      build: {
        objects: [o('s-battery', 'battery', 200, 601), o('s-fan', 'fan', 430, 285, { strength: 10, range: 600 }), o('s-ramp', 'plank', 585, 505, { length: 190 }, -0.43), o('s-backboard', 'plank', 748, 510, { length: 120 }, Math.PI / 2)],
        connections: [wire('s-w2', 's-battery', 's-fan')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 5-10: the whole shebang

const grandFinale: CampaignEntry = {
  chapter: 5,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g5-grand-finale',
    name: 'The Whole Shebang',
    description: 'Closing night at the lab. Bolt is asleep on the ground floor and has to be up on the stage, parked on the spotlight plate long enough to light the EXIT sign. When the counterweight lands, fire the cannon into the trophy bucket. And when Bolt hits his mark, pop the balloon in the bunker. One machine, every trick you know.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g5j-stage', 'wall', 885, 480, { w: 370, h: 300, material: 'brick' }),
      o('g5j-stage-stop', 'wall', 1074, 300, { w: 12, h: 60, material: 'brick' }),
      o('g5j-pedestal', 'wall', 300, 590, { w: 96, h: 80, material: 'wood' }),
      o('g5j-trophy-shelf', 'plank', 560, 250, { length: 110 }),
      o('g5j-bunker-roof', 'wall', 150, 186, { w: 132, h: 12, material: 'steel' }),
      o('g5j-bunker-l', 'wall', 90, 244, { w: 12, h: 104, material: 'steel' }),
      o('g5j-bunker-r', 'wall', 210, 244, { w: 12, h: 104, material: 'steel' }),
      o('g5j-bunker-floor', 'wall', 150, 302, { w: 132, h: 12, material: 'steel' }),
      o('g5j-hook', 'hook', 150, 288),
    ],
    startingObjects: [
      o('g5j-battery', 'battery', 520, 601),
      o('g5j-plate-drop', 'pressure_plate', 300, 543, { minMass: 1.5 }),
      o('g5j-plate-spot', 'pressure_plate', 1000, 323, { minMass: 1 }),
      o('g5j-exit', 'light_bulb', 1030, 140),
      o('g5j-house-1', 'light_bulb', 760, 140),
      o('g5j-house-2', 'light_bulb', 840, 140),
      o('g5j-bolt', 'robot', 660, 607, { speed: 60, awake: false }),
      o('g5j-trophy', 'bucket', 560, 250 - 29, { anchored: true }),
      o('g5j-balloon', 'balloon', 150, 230, { lift: 1, color: 'red' }),
      o('g5j-crate-1', 'crate', 80, 608, { material: 'wood' }),
      o('g5j-crate-2', 'crate', 126, 608, { material: 'wood' }),
      o('g5j-crate-3', 'crate', 103, 563, { material: 'wood' }),
    ],
    connections: [
      link('g5j-tether', 'rope', 'g5j-hook', 'hook', 'g5j-balloon', 'string'),
      wire('g5j-w1', 'g5j-battery', 'g5j-plate-drop'),
      wire('g5j-w2', 'g5j-battery', 'g5j-plate-spot'),
      wire('g5j-w3', 'g5j-plate-spot', 'g5j-exit'),
      wire('g5j-w4', 'g5j-plate-drop', 'g5j-house-1'),
      wire('g5j-w5', 'g5j-plate-drop', 'g5j-house-2'),
    ],
    inventory: [
      { type: 'pulley', count: 3 },
      { type: 'rope', count: 1 },
      { type: 'bucket', count: 1 },
      { type: 'bowling_ball', count: 1 },
      { type: 'cannon', count: 1 },
      { type: 'logic_gate', count: 3 },
      { type: 'dynamite', count: 2 },
      { type: 'timer', count: 1 },
      { type: 'candle', count: 1 },
      { type: 'ball', count: 2 },
      { type: 'plank', count: 2 },
    ],
    goals: [
      { kind: 'activate', target: { id: 'g5j-exit' }, duration: 2, label: 'Bolt on the spotlight: EXIT sign lit for 2 seconds' },
      { kind: 'containerCount', container: 'g5j-trophy', count: 1, filter: { type: 'cannonball' }, label: 'Cannonball in the trophy bucket' },
      { kind: 'destroyed', target: { id: 'g5j-balloon' }, label: 'Pop the balloon in the bunker' },
    ],
    restrictions: { timeLimit: 30 },
    bonus: { elegantParts: 8, elegantTime: 10, absurdStages: 18 },
    hints: [
      'Start with Bolt: a rope from his back hook, over pulleys, down to a weighted bucket that lands on the drop plate. That plate’s output is yours to use.',
      'Bolt should wake when the counterweight lands and stop on the spotlight plate: drop plate AND (NOT spotlight plate) into his antenna. The drop plate can fire the cannon too.',
      'The spotlight plate can detonate dynamite as well. Sit a stick on the bunker roof and wire it up: the shock wave goes straight through steel.',
    ],
    metadata: { chapter: 5, order: 10, author: 'Follyworks', blurb: 'Every trick in the book, all at once.' },
  },
  solutions: [
    {
      objects: [
        o('s-p1', 'pulley', 880, 150),
        o('s-p2', 'pulley', 300, 100),
        o('s-bucket', 'bucket', 300, 191, { anchored: false }),
        o('s-iron', 'bowling_ball', 300, 191 - 8),
        o('s-cannon', 'cannon', 420, 590, { power: 1100, shots: 1 }, -85 * DEG, false),
        o('s-and', 'logic_gate', 560, 470, { mode: 'and' }),
        o('s-not', 'logic_gate', 560, 400, { mode: 'not' }),
        o('s-tnt', 'dynamite', 150, 169, { power: 4 }),
      ],
      connections: [
        link('s-rope', 'rope', 'g5j-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']),
        wire('s-w1', 'g5j-plate-drop', 's-cannon'),
        wire('s-w2', 'g5j-plate-drop', 's-and', 'a'),
        wire('s-w3', 'g5j-plate-spot', 's-not', 'a'),
        wire('s-w4', 's-not', 's-and', 'b'),
        wire('s-w5', 's-and', 'g5j-bolt'),
        wire('s-w6', 'g5j-plate-spot', 's-tnt'),
      ],
    },
    {
      // Same lift and brain, but the bunker waits for a timer: a dramatic pause after Bolt hits his mark.
      objects: [
        o('s-p1', 'pulley', 880, 150),
        o('s-p2', 'pulley', 300, 100),
        o('s-bucket', 'bucket', 300, 191, { anchored: false }),
        o('s-iron', 'bowling_ball', 300, 191 - 8),
        o('s-cannon', 'cannon', 420, 590, { power: 1100, shots: 1 }, -85 * DEG, false),
        o('s-and', 'logic_gate', 560, 470, { mode: 'and' }),
        o('s-not', 'logic_gate', 560, 400, { mode: 'not' }),
        o('s-timer', 'timer', 640, 400, { delay: 0.5, hold: 0 }),
        o('s-tnt', 'dynamite', 150, 169, { power: 4 }),
      ],
      connections: [
        link('s-rope', 'rope', 'g5j-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']),
        wire('s-w1', 'g5j-plate-drop', 's-cannon'),
        wire('s-w2', 'g5j-plate-drop', 's-and', 'a'),
        wire('s-w3', 'g5j-plate-spot', 's-not', 'a'),
        wire('s-w4', 's-not', 's-and', 'b'),
        wire('s-w5', 's-and', 'g5j-bolt'),
        wire('s-w6', 'g5j-plate-spot', 's-timer'),
        wire('s-w7', 's-timer', 's-tnt'),
      ],
    },
    {
      // ABSURD: everything above, plus a timer counting the cannon in, a spare logic box, and balls bombing the crate pile.
      objects: [
        o('s-p1', 'pulley', 880, 150),
        o('s-p2', 'pulley', 300, 100),
        o('s-bucket', 'bucket', 300, 191, { anchored: false }),
        o('s-iron', 'bowling_ball', 300, 191 - 8),
        o('s-timer', 'timer', 480, 470, { delay: 0.3, hold: 0 }),
        o('s-cannon', 'cannon', 420, 590, { power: 1100, shots: 1 }, -85 * DEG, false),
        o('s-and', 'logic_gate', 560, 470, { mode: 'and' }),
        o('s-not', 'logic_gate', 560, 400, { mode: 'not' }),
        o('s-or', 'logic_gate', 640, 400, { mode: 'or' }),
        o('s-tnt', 'dynamite', 150, 169, { power: 4 }),
        o('s-ball-1', 'ball', 103, 420),
        o('s-ball-2', 'ball', 60, 480),
      ],
      connections: [
        link('s-rope', 'rope', 'g5j-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']),
        wire('s-w1', 'g5j-plate-drop', 's-timer'),
        wire('s-w2', 's-timer', 's-cannon'),
        wire('s-w3', 'g5j-plate-drop', 's-and', 'a'),
        wire('s-w4', 'g5j-plate-spot', 's-not', 'a'),
        wire('s-w5', 's-not', 's-and', 'b'),
        wire('s-w6', 's-and', 'g5j-bolt'),
        wire('s-w7', 'g5j-plate-spot', 's-or', 'a'),
        wire('s-w8', 's-or', 's-tnt'),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'Bolt woken straight off the drop plate never stops: he marches over the spotlight into the wall and back',
      build: {
        objects: [
          o('s-p1', 'pulley', 880, 150),
          o('s-p2', 'pulley', 300, 100),
          o('s-bucket', 'bucket', 300, 191, { anchored: false }),
          o('s-iron', 'bowling_ball', 300, 191 - 8),
          o('s-cannon', 'cannon', 420, 590, { power: 1100, shots: 1 }, -85 * DEG, false),
          o('s-tnt', 'dynamite', 150, 169, { power: 4 }),
        ],
        connections: [
          link('s-rope', 'rope', 'g5j-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']),
          wire('s-w1', 'g5j-plate-drop', 's-cannon'),
          wire('s-w2', 'g5j-plate-drop', 'g5j-bolt'),
          wire('s-w6', 'g5j-plate-spot', 's-tnt'),
        ],
      },
    },
    {
      why: 'the counterweight drops beside the plate, so nothing downstream ever gets power',
      build: {
        objects: [
          o('s-p1', 'pulley', 880, 150),
          o('s-p2', 'pulley', 420, 100),
          o('s-bucket', 'bucket', 420, 191, { anchored: false }),
          o('s-iron', 'bowling_ball', 420, 191 - 8),
          o('s-cannon', 'cannon', 420 - 60, 590, { power: 1100, shots: 1 }, -85 * DEG, false),
          o('s-and', 'logic_gate', 560, 470, { mode: 'and' }),
          o('s-not', 'logic_gate', 560, 400, { mode: 'not' }),
          o('s-tnt', 'dynamite', 150, 169, { power: 4 }),
        ],
        connections: [
          link('s-rope', 'rope', 'g5j-bolt', 'back', 's-bucket', 'handle', ['s-p1', 's-p2']),
          wire('s-w1', 'g5j-plate-drop', 's-cannon'),
          wire('s-w2', 'g5j-plate-drop', 's-and', 'a'),
          wire('s-w3', 'g5j-plate-spot', 's-not', 'a'),
          wire('s-w4', 's-not', 's-and', 'b'),
          wire('s-w5', 's-and', 'g5j-bolt'),
          wire('s-w6', 'g5j-plate-spot', 's-tnt'),
        ],
      },
    },
  ],
};

export const GROUP_5: CampaignEntry[] = [waitForIt, puffPiece, partyPooper, latchOn, shootingGallery, threeKeys, goingUp, fireInTheHole, scrapSorter, grandFinale];
