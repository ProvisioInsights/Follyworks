// Mission group 4: Hot Air & Sparks. Fans, balloons, candles, rockets, batteries, wires, switches,
// pressure plates, light bulbs and magnets. Half the missions are about air and heat, half about
// electricity, alternating, with a mixed finale.
// Pure level data; `solutions` and `counterexamples` are test fixtures only (tests/levels).

import { STANDARD_WORLD } from '../../core/level';
import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const link = (id: string, kind: 'wire' | 'rope' | 'belt', from: string, fromPort: string, to: string, toPort: string, via?: string[]): ConnectionDef =>
  via ? { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort }, via } : { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort } };
const wire = (id: string, from: string, fromPort: string, to: string, toPort: string) => link(id, 'wire', from, fromPort, to, toPort);
const rope = (id: string, from: string, fromPort: string, to: string, toPort: string, via?: string[]) => link(id, 'rope', from, fromPort, to, toPort, via);

const WORLD = { ...STANDARD_WORLD };
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- 4-1: balloon rings the breakfast bell, the toaster wakes the cat

const M1_BUILD = {
  candle: o('s-candle', 'candle', 172, 601),
  fan: o('s-fan', 'fan', 60, 122, { strength: 5, range: 700 }),
  battery: o('s-battery', 'battery', 60, 601),
  bridge: o('s-bridge', 'plank', 940, 557, { length: 110 }),
};

const upUpAndAway: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-up-up-and-away',
    name: 'Up, Up and Away',
    description: 'Whiskers is sleeping through breakfast. Free the balloon and breeze it along the ceiling into the breakfast bell. The bell starts the toaster, nobody sleeps through a toaster DING, and Whiskers will want to cross to the mat.',
    environment: 'greenhouse',
    world: WORLD,
    fixedObjects: [
      o('g4a-ceiling', 'wall', 560, 80, { w: 1120, h: 20, material: 'steel' }),
      o('g4a-hook', 'hook', 170, 612),
      o('g4a-bell', 'bell', 720, 114),
      o('g4a-counter', 'wall', 720, 590, { w: 320, h: 80, material: 'wood' }),
      o('g4a-counter-notch', 'wall', 890, 597, { w: 20, h: 66, material: 'wood' }),
      o('g4a-toaster', 'toaster', 620, 526, { delay: 1 }),
      o('g4a-bed-l', 'wall', 666, 535, { w: 16, h: 30, material: 'wood' }),
      o('g4a-bed-r', 'wall', 734, 545, { w: 16, h: 10, material: 'wood' }),
      o('g4a-pit-cactus', 'cactus', 940, 601),
      o('g4a-landing-notch', 'wall', 990, 597, { w: 20, h: 66, material: 'wood' }),
      o('g4a-landing', 'wall', 1060, 590, { w: 120, h: 80, material: 'wood' }),
      o('g4a-mat', 'pressure_plate', 1038, 543, { minMass: 2 }),
      o('g4a-lamp', 'light_bulb', 1050, 440),
      o('g4a-lamp-battery', 'battery', 1100, 522),
    ],
    startingObjects: [o('g4a-balloon', 'balloon', 170, 400, { lift: 1, color: 'yellow' }), o('g4a-cat', 'cat', 700, 537)],
    connections: [
      rope('g4a-tether', 'g4a-hook', 'hook', 'g4a-balloon', 'string'),
      wire('g4a-w1', 'g4a-bell', 'out', 'g4a-toaster', 'in'),
      wire('g4a-w2', 'g4a-lamp-battery', 'out', 'g4a-mat', 'in'),
      wire('g4a-w3', 'g4a-mat', 'out', 'g4a-lamp', 'in'),
    ],
    inventory: [
      { type: 'candle', count: 1 },
      { type: 'fan', count: 1 },
      { type: 'battery', count: 1 },
      { type: 'plank', count: 1 },
      { type: 'magnet', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g4a-lamp' }, label: 'Get Whiskers onto the mat to light the GOOD MORNING lamp' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 4, elegantTime: 6, absurdStages: 9 },
    hints: [
      'A candle flame burns through any rope that passes right over it. Once it is free, the balloon floats up to the ceiling.',
      'A fan up by the ceiling, wired to the battery, blows the balloon along it into the bell. Cats run off the way they face once awake.',
      'Candle on the floor right under the tether, fan high on the far left, and a plank across the cactus pit, resting on both ledges, so Whiskers can trot over to the mat.',
    ],
    metadata: { chapter: 4, order: 1, author: 'Follyworks', blurb: 'Snip, float, DING, toast, yowl, trot.' },
  },
  solutions: [
    {
      objects: [M1_BUILD.candle, M1_BUILD.fan, M1_BUILD.battery, M1_BUILD.bridge],
      connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')],
    },
    // ABSURD: the same, plus an electromagnet humming away for no reason at all.
    {
      objects: [M1_BUILD.candle, M1_BUILD.fan, M1_BUILD.battery, M1_BUILD.bridge, o('s-magnet', 'magnet', 300, 560)],
      connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in'), wire('s-w2', 's-battery', 'out', 's-magnet', 'in')],
    },
  ],
  counterexamples: [
    {
      why: 'there is no bridge, so Whiskers runs straight into the cactus pit',
      build: { objects: [M1_BUILD.candle, M1_BUILD.fan, M1_BUILD.battery], connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')] },
    },
    {
      why: 'the fan has no power',
      build: { objects: [M1_BUILD.candle, M1_BUILD.fan, M1_BUILD.battery, M1_BUILD.bridge], connections: [] },
    },
    {
      why: 'the candle is put right beside the cat bed to warm Whiskers up',
      build: { objects: [o('s-candle', 'candle', 765, 521), M1_BUILD.bridge], connections: [] },
    },
    {
      why: 'the fan blows straight at the sleeping cat',
      build: { objects: [o('s-fan', 'fan', 700, 440, { strength: 10, range: 300 }, 90 * DEG), M1_BUILD.battery, M1_BUILD.bridge], connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')] },
    },
  ],
};

// ---------------------------------------------------------------- 4-2: teapot steam, bell, toaster, mousetrap: dunk the toast

const M2_BUILD = {
  candle: o('s-candle', 'candle', 150, 190),
  plankA: o('s-plank-a', 'plank', 480, 282, { length: 130 }, 22 * DEG),
  plankB: o('s-plank-b', 'plank', 717, 350, { length: 100 }, 20 * DEG),
  trap: o('s-trap', 'mousetrap', 295, 625),
};

const toastDunk: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-tea-off',
    name: 'Tea-Off',
    description: 'Put the kettle on! A boiling teapot blows the ball off its perch, down the track to the bell, and the bell starts the toaster. Mend the track and catch the toast on a mousetrap to slam-dunk it through the hoop.',
    environment: 'basement',
    world: WORLD,
    fixedObjects: [
      o('g4b-hob', 'wall', 130, 170, { w: 150, h: 14, material: 'steel' }),
      o('g4b-perch', 'wall', 232, 126, { w: 44, h: 12, material: 'wood' }),
      o('g4b-backstop', 'wall', 352, 125, { w: 12, h: 130, material: 'wood' }),
      o('g4b-track-1', 'plank', 325, 230, { length: 194 }, 12 * DEG),
      o('g4b-track-2', 'plank', 602, 324, { length: 120 }, 6 * DEG),
      o('g4b-track-3', 'plank', 826, 384, { length: 110 }, 6 * DEG),
      o('g4b-bell', 'bell', 912, 374),
      o('g4b-toaster', 'toaster', 150, 606, { delay: 0.8, slices: 1 }, 15 * DEG),
      o('g4b-sign', 'light_bulb', 60, 470),
      o('g4b-hoop', 'basketball_hoop', 572, 416, {}, 0, true),
    ],
    startingObjects: [o('g4b-teapot', 'teapot', 150, 142), o('g4b-ball', 'ball', 232, 106), o('g4b-cat', 'cat', 580, 617, {}, 0, true)],
    connections: [wire('g4b-w1', 'g4b-bell', 'out', 'g4b-toaster', 'in'), wire('g4b-w2', 'g4b-toaster', 'out', 'g4b-sign', 'in')],
    inventory: [
      { type: 'candle', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'mousetrap', count: 1 },
      { type: 'fan', count: 1 },
      { type: 'battery', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g4b-hoop', count: 1, filter: { type: 'toast' }, label: 'Slam-dunk the toast through the hoop' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 4, elegantTime: 8, absurdStages: 8 },
    hints: [
      'A teapot on a flame boils in a second or two and blows steam out of its spout. A candle under the hob will do it.',
      'The ball rolls down the track to the bell, but two pieces of track are missing. Fill each gap with a plank, sloping down a little.',
      'The bell starts the toaster, and its toast lands just to the right. Put the mousetrap right there: SNAP, and the toast flies off to the hoop.',
    ],
    metadata: { chapter: 4, order: 2, author: 'Follyworks', blurb: 'Breakfast, with a jump shot.' },
  },
  solutions: [
    {
      objects: [M2_BUILD.candle, M2_BUILD.plankA, M2_BUILD.plankB, M2_BUILD.trap],
      connections: [],
    },
    // ABSURD: the same, plus a desk fan cheering the whole thing on from the corner.
    {
      objects: [M2_BUILD.candle, M2_BUILD.plankA, M2_BUILD.plankB, M2_BUILD.trap, o('s-fan', 'fan', 1000, 560, { strength: 3, range: 120 }), o('s-battery', 'battery', 1080, 601)],
      connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')],
    },
  ],
  counterexamples: [
    {
      why: 'nothing heats the teapot',
      build: { objects: [M2_BUILD.plankA, M2_BUILD.plankB, M2_BUILD.trap], connections: [] },
    },
    {
      why: 'the second gap in the track is left open',
      build: { objects: [M2_BUILD.candle, M2_BUILD.plankA, M2_BUILD.trap], connections: [] },
    },
    {
      why: 'the toast has no mousetrap to land on',
      build: { objects: [M2_BUILD.candle, M2_BUILD.plankA, M2_BUILD.plankB], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 4-3: fan, ball, bell, toaster flicks the switch, the magnet drops Bolt into the pins

const M3_PINS = [874, 904, 934, 964].map((x, i) => o(`g4c-pin-${i + 1}`, 'bowling_pin', x, 415));

const M3_BUILD = {
  fan: o('s-fan', 'fan', 56, 118, { strength: 2, range: 160 }),
  battery: o('s-battery', 'battery', 40, 601),
  gap: o('s-gap', 'plank', 440, 272, { length: 90 }, 15 * DEG),
  bumper: o('s-bumper', 'plank', 612, 410, { length: 60 }, 90 * DEG),
  bridge: o('s-bridge', 'plank', 810, 450, { length: 58 }),
};

const strike: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-strike',
    name: 'Bolt Bowls a Strike',
    description: 'Bolt is stuck to the electromagnet, dreaming of bowling. Breeze the ball down to the bell, and the bell starts the toaster, whose toast flicks the magnet switch off. Then see that Bolt marches through the pins and onto the STRIKE plate.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('g4c-shelf', 'wall', 120, 162, { w: 180, h: 12, material: 'wood' }),
      o('g4c-track', 'plank', 300, 240, { length: 200 }, 10 * DEG),
      o('g4c-bell', 'bell', 510, 284),
      o('g4c-toaster', 'toaster', 300, 606, { delay: 0.8, slices: 1 }, 15 * DEG),
      o('g4c-switch', 'toggle_switch', 330, 505, { on: true }, 90 * DEG),
      o('g4c-battery', 'battery', 200, 601),
      o('g4c-divider', 'wall', 556, 315, { w: 12, h: 630, material: 'steel' }),
      o('g4c-beam', 'wall', 680, 80, { w: 120, h: 16, material: 'steel' }),
      o('g4c-magnet', 'magnet', 680, 116, { strength: 10, reach: 100 }, 90 * DEG),
      o('g4c-chute-l', 'wall', 658, 176, { w: 8, h: 52, material: 'steel' }),
      o('g4c-chute-r', 'wall', 702, 176, { w: 8, h: 52, material: 'steel' }),
      o('g4c-lane-l', 'wall', 690, 450, { w: 180, h: 14, material: 'wood' }),
      o('g4c-lane-r', 'wall', 912, 450, { w: 144, h: 14, material: 'wood' }),
      o('g4c-plate', 'pressure_plate', 1022, 448, { minMass: 2.9 }),
      o('g4c-sign', 'light_bulb', 1020, 300),
    ],
    startingObjects: [o('g4c-ball', 'ball', 180, 142), o('g4c-bolt', 'robot', 680, 170, { speed: 160 }, 0, true), ...M3_PINS],
    connections: [
      wire('g4c-w1', 'g4c-bell', 'out', 'g4c-toaster', 'in'),
      wire('g4c-w2', 'g4c-battery', 'out', 'g4c-switch', 'in'),
      wire('g4c-w3', 'g4c-switch', 'out', 'g4c-magnet', 'in'),
      wire('g4c-w4', 'g4c-battery', 'out', 'g4c-plate', 'in'),
      wire('g4c-w5', 'g4c-plate', 'out', 'g4c-sign', 'in'),
    ],
    inventory: [
      { type: 'fan', count: 1 },
      { type: 'battery', count: 1 },
      { type: 'plank', count: 3 },
      { type: 'candle', count: 2 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g4c-sign' }, label: 'Bowl Bolt through the pins onto the plate to light the STRIKE! sign' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 5, elegantTime: 10, absurdStages: 14 },
    hints: [
      'A fan on the shelf, wired to a battery, nudges the ball off the edge. A gentle breeze is plenty. Then the track needs one more plank down to the bell.',
      'The bell starts the toaster, and toast flying up through the switch flicks it OFF. No power, no magnet: down comes Bolt, facing the wrong way.',
      'Bolt lands facing left and turns round when he bumps into something. Stand a plank up at the left end of his lane, and lay another one flat across the gap on the right.',
    ],
    metadata: { chapter: 4, order: 3, author: 'Follyworks', blurb: 'Robot bowling. He is the ball.' },
  },
  solutions: [
    {
      objects: [M3_BUILD.fan, M3_BUILD.battery, M3_BUILD.gap, M3_BUILD.bumper, M3_BUILD.bridge],
      connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')],
    },
    // ABSURD: two candles floating in the breeze, purely so the fan can blow them out on the way.
    {
      objects: [
        o('s-fan', 'fan', 56, 118, { strength: 2, range: 360 }),
        M3_BUILD.battery,
        M3_BUILD.gap,
        M3_BUILD.bumper,
        M3_BUILD.bridge,
        o('s-candle', 'candle', 300, 100),
        o('s-candle-2', 'candle', 380, 100),
      ],
      connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')],
    },
  ],
  counterexamples: [
    {
      why: 'no plank across the gap, so Bolt marches straight into it',
      build: { objects: [M3_BUILD.fan, M3_BUILD.battery, M3_BUILD.gap, M3_BUILD.bumper], connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')] },
    },
    {
      why: 'no bumper, so Bolt marches off the left end of his lane',
      build: { objects: [M3_BUILD.fan, M3_BUILD.battery, M3_BUILD.gap, M3_BUILD.bridge], connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')] },
    },
    {
      why: 'the fan is not wired up',
      build: { objects: [M3_BUILD.fan, M3_BUILD.battery, M3_BUILD.gap, M3_BUILD.bumper, M3_BUILD.bridge], connections: [] },
    },
    {
      why: 'a fan tries to blow Bolt across the gap instead of bridging it',
      build: {
        objects: [M3_BUILD.fan, M3_BUILD.battery, M3_BUILD.gap, M3_BUILD.bumper, o('s-fan-2', 'fan', 700, 400, { strength: 10, range: 400 })],
        connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in'), wire('s-w2', 's-battery', 'out', 's-fan-2', 'in')],
      },
    },
    {
      why: 'a full-blast fan tries to blow Bolt off the magnet',
      build: {
        objects: [o('s-fan', 'fan', 600, 166, { strength: 10, range: 300 }), M3_BUILD.battery, M3_BUILD.bumper, M3_BUILD.bridge],
        connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 4-4: flick a high switch, ship the crate onto the plate

const outOfReach: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-out-of-reach',
    name: 'Out of Reach',
    description: 'Everything is wired up: switch, conveyor, bay plate and lamp. But the switch is up on a pillar and the conveyor stops short of the bay. Flick it ON from afar and light the bay lamp.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('g4d-pillar', 'wall', 380, 480, { w: 40, h: 300, material: 'brick' }),
      o('g4d-kerb', 'wall', 900, 612, { w: 12, h: 36, material: 'steel' }),
      o('g4d-bay-wall', 'wall', 1072, 540, { w: 16, h: 180, material: 'brick' }),
      o('g4d-switch', 'toggle_switch', 380, 300, { on: false }),
      o('g4d-battery', 'battery', 460, 601),
      o('g4d-conveyor', 'conveyor', 640, 420, { length: 300, speed: 70, dir: 'right' }),
      o('g4d-plate', 'pressure_plate', 985, 623, { minMass: 1.5 }),
      o('g4d-lamp', 'light_bulb', 1020, 420),
    ],
    startingObjects: [o('g4d-crate', 'crate', 540, 387)],
    connections: [
      wire('g4d-w1', 'g4d-battery', 'out', 'g4d-switch', 'in'),
      wire('g4d-w2', 'g4d-switch', 'out', 'g4d-conveyor', 'in'),
      wire('g4d-w3', 'g4d-battery', 'out', 'g4d-plate', 'in'),
      wire('g4d-w4', 'g4d-plate', 'out', 'g4d-lamp', 'in'),
    ],
    inventory: [
      { type: 'ball', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'rope', count: 1 },
      { type: 'balloon', count: 1 },
      { type: 'pulley', count: 1 },
      { type: 'crate', count: 1 },
    ],
    goals: [
      { kind: 'activate', target: { id: 'g4d-switch' }, label: 'Flick the pillar switch ON' },
      { kind: 'activate', target: { id: 'g4d-lamp' }, label: 'Light the bay lamp' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 3, elegantTime: 6, absurdStages: 7 },
    hints: [
      'The switch turns ON when something moves rightwards through its lever, or when its lever is pulled rightwards by a rope.',
      'A ball rolling down a ramp makes a fine finger. Or tie a rope to the lever and let a balloon drift up and right.',
      'The crate drops off the end of the conveyor short of the bay. A second plank, sloping down from the conveyor’s end over the kerb, slides it onto the plate.',
    ],
    metadata: { chapter: 4, order: 4, author: 'Follyworks', blurb: 'Remote control, the hard way.' },
  },
  solutions: [
    {
      // Ball rolls down a ramp and through the lever; a chute carries the crate over the kerb.
      objects: [
        o('s-ramp', 'plank', 250, 250, { length: 200 }, 12 * DEG),
        o('s-ball', 'ball', 180, 210),
        o('s-chute', 'plank', 880, 500, { length: 220 }, 30 * DEG),
      ],
      connections: [],
    },
    {
      // A balloon tugs the lever up and to the right.
      objects: [o('s-balloon', 'balloon', 470, 200), o('s-chute', 'plank', 880, 500, { length: 220 }, 30 * DEG)],
      connections: [rope('s-rope', 'g4d-switch', 'lever', 's-balloon', 'string')],
    },
    // ABSURD: ball, ramp and chute, and the ball bounces on into a balloon tethered to a spare crate.
    {
      objects: [
        o('s-ramp', 'plank', 250, 250, { length: 200 }, 12 * DEG),
        o('s-ball', 'ball', 180, 210),
        o('s-chute', 'plank', 880, 500, { length: 220 }, 30 * DEG),
        o('s-box', 'crate', 680, 608),
        o('s-balloon', 'balloon', 680, 488),
      ],
      connections: [rope('s-tie', 's-balloon', 'string', 's-box', 'hook')],
    },
  ],
  counterexamples: [
    {
      why: 'the crate is shipped without a chute',
      build: { objects: [o('s-ramp', 'plank', 250, 250, { length: 200 }, 12 * DEG), o('s-ball', 'ball', 180, 210)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 4-5: pop every balloon, three different ways

const popGoesTheParty: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-party-pooper',
    name: 'Party Pooper',
    description: 'The party is over and three balloons are left behind. Pop every last one of them. They are spread out, so one trick will not do.',
    environment: 'maintenance',
    world: WORLD,
    fixedObjects: [
      o('g4e-ceiling', 'wall', 560, 50, { w: 1120, h: 20, material: 'concrete' }),
      o('g4e-ledge', 'wall', 1010, 140, { w: 120, h: 14, material: 'steel' }),
      o('g4e-cactus', 'cactus', 1010, 105),
      o('g4e-hook-1', 'hook', 720, 610),
      o('g4e-hook-3', 'hook', 300, 610),
    ],
    startingObjects: [
      o('g4e-balloon-1', 'balloon', 720, 545, { color: 'red' }),
      o('g4e-balloon-2', 'balloon', 480, 160, { color: 'yellow' }),
      o('g4e-balloon-3', 'balloon', 300, 300, { color: 'teal' }),
    ],
    connections: [rope('g4e-tie-1', 'g4e-hook-1', 'hook', 'g4e-balloon-1', 'string'), rope('g4e-tie-3', 'g4e-hook-3', 'hook', 'g4e-balloon-3', 'string')],
    inventory: [
      { type: 'candle', count: 1 },
      { type: 'fan', count: 1 },
      { type: 'battery', count: 1 },
      { type: 'rocket', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'ball', count: 1 },
    ],
    goals: [{ kind: 'destroyed', target: { type: 'balloon' }, label: 'Pop all three balloons' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 4, elegantTime: 2, absurdStages: 6 },
    hints: [
      'Balloons pop on flames and on cacti. You only have one candle, and the red balloon hangs low enough for it.',
      'The loose yellow balloon bobs along the ceiling. A breeze could push it onto that cactus.',
      'A lit rocket’s exhaust is as hot as a candle. Park the rocket with its tail right beside the teal balloon, nose pointing away, and wire it to the battery so it fires as you press RUN.',
    ],
    metadata: { chapter: 4, order: 5, author: 'Follyworks', blurb: 'Pop, pop, and a rocket-powered pop.' },
  },
  solutions: [
    {
      objects: [
        o('s-candle', 'candle', 720, 601),
        o('s-fan', 'fan', 380, 110, { strength: 5, range: 660 }),
        o('s-battery', 'battery', 600, 601),
        o('s-rocket', 'rocket', 360, 300),
      ],
      connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in'), wire('s-w2', 's-battery', 'out', 's-rocket', 'in')],
    },
    // ABSURD: the same, and the rocket bowls a rubber ball off a little shelf on its way out.
    {
      objects: [
        o('s-candle', 'candle', 720, 601),
        o('s-fan', 'fan', 380, 110, { strength: 5, range: 660 }),
        o('s-battery', 'battery', 600, 601),
        o('s-rocket', 'rocket', 360, 300),
        o('s-shelf', 'plank', 600, 400, { length: 40 }),
        o('s-ball', 'ball', 600, 379),
      ],
      connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in'), wire('s-w2', 's-battery', 'out', 's-rocket', 'in')],
    },
  ],
  counterexamples: [
    {
      why: 'only the fan is used',
      build: {
        objects: [o('s-fan', 'fan', 380, 110, { strength: 5, range: 660 }), o('s-battery', 'battery', 600, 601)],
        connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 4-6: two iron balls, two plates in series

const heavyMetal: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-heavy-metal',
    name: 'Heavy Metal',
    description: 'The vault lamp is wired through BOTH plates on the plinth, but nothing powers the circuit yet, and the only things heavy enough for the plates are two iron balls on the far side of the gaps.',
    environment: 'underground',
    world: WORLD,
    fixedObjects: [
      o('g4f-ledge-l', 'wall', 205, 595, { w: 310, h: 70, material: 'concrete' }),
      o('g4f-notch-l', 'wall', 375, 602, { w: 30, h: 56, material: 'concrete' }),
      o('g4f-notch-pl', 'wall', 465, 602, { w: 30, h: 56, material: 'concrete' }),
      o('g4f-plinth', 'wall', 560, 595, { w: 160, h: 70, material: 'concrete' }),
      o('g4f-notch-pr', 'wall', 655, 602, { w: 30, h: 56, material: 'concrete' }),
      o('g4f-notch-r', 'wall', 745, 602, { w: 30, h: 56, material: 'concrete' }),
      o('g4f-ledge-r', 'wall', 915, 595, { w: 310, h: 70, material: 'concrete' }),
      o('g4f-plate-a', 'pressure_plate', 520, 553, { minMass: 5 }),
      o('g4f-plate-b', 'pressure_plate', 600, 553, { minMass: 5 }),
      o('g4f-lamp', 'light_bulb', 700, 380),
    ],
    startingObjects: [o('g4f-iron-a', 'bowling_ball', 220, 540), o('g4f-iron-b', 'bowling_ball', 900, 540)],
    connections: [
      wire('g4f-w2', 'g4f-plate-a', 'out', 'g4f-plate-b', 'in'),
      wire('g4f-w3', 'g4f-plate-b', 'out', 'g4f-lamp', 'in'),
    ],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'magnet', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'crate', count: 2 },
      { type: 'ball', count: 2 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g4f-lamp' }, duration: 3, label: 'Keep the vault lamp lit for 3 seconds' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 4, elegantTime: 7, absurdStages: 8 },
    hints: [
      'Wire a battery to the first plate. A plate passes power on only while something heavy enough sits on it, and these two are wired one after the other, so both must be pressed at once.',
      'Crates and rubber balls are too light. An electromagnet drags iron towards its face from a long way off, and your battery can power it too.',
      'Hang the magnet right between the two plates with its Reach turned up, and lay a plank across each gap, resting on the little ledges, so the balls can roll over.',
    ],
    metadata: { chapter: 4, order: 6, author: 'Follyworks', blurb: 'Magnetic personality required.' },
  },
  solutions: [
    {
      objects: [
        o('s-battery', 'battery', 100, 531),
        o('s-magnet', 'magnet', 560, 504, { strength: 10, reach: 420 }),
        o('s-bridge-a', 'plank', 420, 567, { length: 110 }),
        o('s-bridge-b', 'plank', 700, 567, { length: 110 }),
      ],
      connections: [wire('s-w1', 's-battery', 'out', 's-magnet', 'in'), wire('s-w2', 's-battery', 'out', 'g4f-plate-a', 'in')],
    },
    // ABSURD: the same, with a rubber ball dropped on each iron ball to send them on their way.
    {
      objects: [
        o('s-battery', 'battery', 100, 531),
        o('s-magnet', 'magnet', 560, 504, { strength: 10, reach: 420 }),
        o('s-bridge-a', 'plank', 420, 567, { length: 110 }),
        o('s-bridge-b', 'plank', 700, 567, { length: 110 }),
        o('s-ball-a', 'ball', 214, 490),
        o('s-ball-b', 'ball', 906, 490),
      ],
      connections: [wire('s-w1', 's-battery', 'out', 's-magnet', 'in'), wire('s-w2', 's-battery', 'out', 'g4f-plate-a', 'in')],
    },
  ],
  counterexamples: [
    {
      why: 'there are no bridges over the gaps',
      build: {
        objects: [o('s-battery', 'battery', 100, 531), o('s-magnet', 'magnet', 560, 504, { strength: 10, reach: 420 })],
        connections: [wire('s-w1', 's-battery', 'out', 's-magnet', 'in'), wire('s-w2', 's-battery', 'out', 'g4f-plate-a', 'in')] },
    },
    {
      why: 'crates are used as weights',
      build: {
        objects: [o('s-battery', 'battery', 100, 531), o('s-c1', 'crate', 520, 522), o('s-c2', 'crate', 600, 522)],
        connections: [wire('s-w2', 's-battery', 'out', 'g4f-plate-a', 'in')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 4-7: leaf blower: breeze three balls into the bucket

const cleanSweep: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-clean-sweep',
    name: 'Clean Sweep',
    description: 'Tidy all three rubber balls into the bucket at the end of the room. No touching: this is a job for fans.',
    environment: 'greenhouse',
    world: WORLD,
    fixedObjects: [
      o('g4j-floor', 'wall', 410, 595, { w: 700, h: 70, material: 'concrete' }),
      o('g4j-notch', 'wall', 775, 602, { w: 30, h: 56, material: 'concrete' }),
      o('g4j-shelf', 'wall', 800, 300, { w: 220, h: 16, material: 'wood' }),
      o('g4j-bucket', 'bucket', 900, 608, { anchored: true }),
      o('g4j-backboard', 'wall', 948, 420, { w: 16, h: 300, material: 'wood' }),
    ],
    startingObjects: [o('g4j-ball-a', 'ball', 420, 546), o('g4j-ball-b', 'ball', 600, 546), o('g4j-ball-c', 'ball', 760, 278)],
    connections: [],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'fan', count: 2 },
      { type: 'plank', count: 3 },
      { type: 'ball', count: 1 },
      { type: 'candle', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g4j-bucket', count: 3, filter: { type: 'ball' }, label: 'Blow all three balls into the bucket' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 4, elegantTime: 5, absurdStages: 7 },
    hints: [
      'A fan pushes rubber balls along just as happily as balloons. Its breeze is a narrow band, so one fan cannot reach both the floor and the shelf.',
      'The floor stops short of the bucket. Lay a plank across the gap, resting on the little ledge and the bucket rim, and the balls can roll straight in. The backboard catches any that fly too far.',
      'One fan on the floor behind the two low balls, a second, gentle fan beside the shelf, both wired to one battery, and a plank bridging the gap.',
    ],
    metadata: { chapter: 4, order: 7, author: 'Follyworks', blurb: 'Leaf blower, minus the leaves.' },
  },
  solutions: [
    {
      objects: [
        o('s-battery', 'battery', 100, 531),
        o('s-fan', 'fan', 300, 520, { strength: 4, range: 700 }),
        o('s-fan-2', 'fan', 660, 254, { strength: 1, range: 300 }),
        o('s-bridge', 'plank', 820, 567, { length: 100 }),
      ],
      connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in'), wire('s-w2', 's-battery', 'out', 's-fan-2', 'in')],
    },
    // ABSURD: a spare ball on the shelf gets shoved off first and goes along for the ride.
    {
      objects: [
        o('s-battery', 'battery', 100, 531),
        o('s-fan', 'fan', 300, 520, { strength: 4, range: 700 }),
        o('s-fan-2', 'fan', 660, 254, { strength: 1, range: 300 }),
        o('s-bridge', 'plank', 820, 567, { length: 100 }),
        o('s-ball', 'ball', 840, 278),
      ],
      connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in'), wire('s-w2', 's-battery', 'out', 's-fan-2', 'in')],
    },
  ],
  counterexamples: [
    {
      why: 'without a bridge the floor balls drop into the gap in front of the bucket',
      build: {
        objects: [
          o('s-battery', 'battery', 100, 531),
          o('s-fan', 'fan', 300, 520, { strength: 4, range: 700 }),
          o('s-fan-2', 'fan', 660, 254, { strength: 1, range: 300 }),
        ],
        connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in'), wire('s-w2', 's-battery', 'out', 's-fan-2', 'in')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 4-8: magnet lift: hoist Bolt out of the pit

const goingUp: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-going-up',
    name: 'Going Up',
    description: 'Bolt has wandered into the pit and robots cannot climb. Hoist him up onto the ledge and set him down so he can march into the lift.',
    environment: 'research',
    world: WORLD,
    fixedObjects: [
      o('g4i-ledge', 'wall', 890, 550, { w: 380, h: 160, material: 'concrete' }),
      o('g4i-lift-wall', 'wall', 1076, 400, { w: 8, h: 140, material: 'steel' }),
      o('g4i-call-plate', 'pressure_plate', 1020, 463, { minMass: 2.5 }),
      o('g4i-lift-lamp', 'light_bulb', 1020, 330),
      o('g4i-lift-battery', 'battery', 950, 330),
    ],
    startingObjects: [o('g4i-bolt', 'robot', 300, 606, { speed: 60 })],
    connections: [wire('g4i-w1', 'g4i-lift-battery', 'out', 'g4i-call-plate', 'in'), wire('g4i-w2', 'g4i-call-plate', 'out', 'g4i-lift-lamp', 'in')],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'magnet', count: 1 },
      { type: 'toggle_switch', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'ball', count: 2 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g4i-lift-lamp' }, label: 'Get Bolt onto the lift button' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 3, absurdStages: 8 },
    hints: [
      'An electromagnet can lift Bolt: he is small, and very much made of metal. Hang it above the edge of the ledge, facing down, with its Strength up.',
      'Trouble is, a magnet never lets go. Power it through a toggle switch, so something can cut the current at the right moment.',
      'Flip the switch so that moving RIGHT turns it OFF, and put it just under the magnet where Bolt swings across. He drops onto the ledge and marches on.',
    ],
    metadata: { chapter: 4, order: 8, author: 'Follyworks', blurb: 'Hoist, swing, drop, march.' },
  },
  solutions: [
    {
      objects: [
        o('s-battery', 'battery', 120, 601),
        o('s-magnet', 'magnet', 740, 375, { strength: 10, reach: 420 }, 90 * DEG),
        o('s-switch', 'toggle_switch', 735, 440, { on: true }, 0, true),
      ],
      connections: [wire('s-w1', 's-battery', 'out', 's-switch', 'in'), wire('s-w2', 's-switch', 'out', 's-magnet', 'in')],
    },
    // ABSURD: meanwhile, up on a shelf, a rubber ball rolls down a ramp into another one. For no reason at all.
    {
      objects: [
        o('s-battery', 'battery', 120, 601),
        o('s-magnet', 'magnet', 740, 375, { strength: 10, reach: 420 }, 90 * DEG),
        o('s-switch', 'toggle_switch', 735, 440, { on: true }, 0, true),
        o('s-ramp', 'plank', 250, 300, { length: 300 }, -10 * DEG),
        o('s-stop', 'plank', 90, 310, { length: 60 }, 90 * DEG),
        o('s-ball-a', 'ball', 370, 256),
        o('s-ball-b', 'ball', 125, 300),
      ],
      connections: [wire('s-w1', 's-battery', 'out', 's-switch', 'in'), wire('s-w2', 's-switch', 'out', 's-magnet', 'in')],
    },
  ],
  counterexamples: [
    {
      why: 'a magnet wired straight to the battery never lets go of Bolt',
      build: {
        objects: [o('s-battery', 'battery', 120, 601), o('s-magnet', 'magnet', 740, 375, { strength: 10, reach: 420 }, 90 * DEG)],
        connections: [wire('s-w1', 's-battery', 'out', 's-magnet', 'in')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 4-9: free the lunch pail and fly it up to the mezzanine

const specialDelivery: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-special-delivery',
    name: 'Special Delivery',
    description: 'Fly the lunch pail up to the mezzanine. It is tied to the floor, and someone left a candle burning on the high shelf, right where a balloon would want to go.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('g4g-ceiling', 'wall', 560, 50, { w: 1120, h: 20, material: 'concrete' }),
      o('g4g-mezzanine', 'wall', 885, 300, { w: 370, h: 20, material: 'wood' }),
      o('g4g-shelf', 'wall', 450, 175, { w: 60, h: 12, material: 'wood' }),
      o('g4g-hazard', 'candle', 450, 140),
      o('g4g-vent', 'fan', 1010, 100, { strength: 10, range: 700 }, 0, true),
      o('g4g-vent-battery', 'battery', 1050, 262),
      o('g4g-stand', 'wall', 300, 580, { w: 80, h: 100, material: 'wood' }),
      o('g4g-hook', 'hook', 200, 610),
    ],
    startingObjects: [o('g4g-pail', 'bucket', 300, 508, { anchored: false })],
    connections: [rope('g4g-tether', 'g4g-hook', 'hook', 'g4g-pail', 'handle'), wire('g4g-vent-wire', 'g4g-vent-battery', 'out', 'g4g-vent', 'in')],
    inventory: [
      { type: 'balloon', count: 2 },
      { type: 'rope', count: 2 },
      { type: 'candle', count: 1 },
      { type: 'fan', count: 1 },
      { type: 'battery', count: 1 },
      { type: 'plank', count: 2 },
    ],
    goals: [{ kind: 'enterRegion', target: { id: 'g4g-pail' }, region: { x: 710, y: 170, w: 350, h: 120 }, hold: 1, label: 'Land the lunch pail on the mezzanine' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 6, elegantTime: 9, absurdStages: 6 },
    hints: [
      'A balloon at full Lift can carry the empty pail. Tie it to the handle, then burn through the floor tether with a candle.',
      'Once it reaches the ceiling, a fan can push it right, and the same breeze can snuff the candle on the shelf before the balloon gets there. Aim the fan low enough to catch both.',
      'The vent fan on the mezzanine blows back at you. Solid things block a breeze: stand a plank up on the mezzanine in front of it, and it will stop the pail over the landing too.',
    ],
    metadata: { chapter: 4, order: 9, author: 'Follyworks', blurb: 'Air mail, with complications.' },
  },
  solutions: [
    {
      objects: [
        o('s-balloon', 'balloon', 300, 351, { lift: 2.5 }),
        o('s-candle', 'candle', 229, 601),
        o('s-fan', 'fan', 120, 120, { strength: 6, range: 700 }),
        o('s-battery', 'battery', 60, 601),
        o('s-windbreak', 'plank', 930, 178, { length: 220 }, 90 * DEG),
      ],
      connections: [rope('s-rope', 's-balloon', 'string', 'g4g-pail', 'handle'), wire('s-w1', 's-battery', 'out', 's-fan', 'in')],
    },
    // ABSURD: a loose spare balloon goes first and gets jostled all the way to the windbreak.
    {
      objects: [
        o('s-balloon', 'balloon', 300, 351, { lift: 2.5 }),
        o('s-balloon-2', 'balloon', 200, 250, { lift: 1 }),
        o('s-candle', 'candle', 229, 601),
        o('s-fan', 'fan', 120, 120, { strength: 6, range: 700 }),
        o('s-battery', 'battery', 60, 601),
        o('s-windbreak', 'plank', 930, 178, { length: 220 }, 90 * DEG),
      ],
      connections: [
        rope('s-rope', 's-balloon', 'string', 'g4g-pail', 'handle'),
        wire('s-w1', 's-battery', 'out', 's-fan', 'in'),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'nothing blocks the vent fan’s headwind',
      build: {
        objects: [
          o('s-balloon', 'balloon', 300, 351, { lift: 2.5 }),
          o('s-candle', 'candle', 229, 601),
          o('s-fan', 'fan', 120, 120, { strength: 10, range: 700 }),
          o('s-battery', 'battery', 60, 601),
        ],
        connections: [rope('s-rope', 's-balloon', 'string', 'g4g-pail', 'handle'), wire('s-w1', 's-battery', 'out', 's-fan', 'in')],
      },
    },
    {
      why: 'the fan blows above the shelf candle and the balloon flies into its flame',
      build: {
        objects: [
          o('s-balloon', 'balloon', 300, 351, { lift: 2.5 }),
          o('s-candle', 'candle', 229, 601),
          o('s-fan', 'fan', 120, 98, { strength: 6, range: 700 }),
          o('s-battery', 'battery', 60, 601),
          o('s-windbreak', 'plank', 930, 178, { length: 220 }, 90 * DEG),
        ],
        connections: [rope('s-rope', 's-balloon', 'string', 'g4g-pail', 'handle'), wire('s-w1', 's-battery', 'out', 's-fan', 'in')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 4-10: grand opening: three jobs, one battery

const grandOpening: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-grand-opening',
    name: 'Grand Opening',
    description: 'Opening night! Pop the party balloon on the cactus, tidy both rubber balls into the bucket, and light the marquee. The marquee is wired through a switch up by the ceiling, so it stays dark until something flicks it on.',
    environment: 'basement',
    world: WORLD,
    fixedObjects: [
      o('g4k-ceiling', 'wall', 560, 50, { w: 1120, h: 20, material: 'concrete' }),
      o('g4k-cactus-shelf', 'wall', 300, 140, { w: 60, h: 10, material: 'steel' }),
      o('g4k-cactus', 'cactus', 300, 107),
      o('g4k-switch', 'toggle_switch', 640, 74, {}, Math.PI),
      o('g4k-hook', 'hook', 900, 610),
      o('g4k-ledge-l', 'wall', 115, 595, { w: 110, h: 70, material: 'concrete' }),
      o('g4k-notch-1l', 'wall', 185, 602, { w: 30, h: 56, material: 'concrete' }),
      o('g4k-notch-1r', 'wall', 265, 602, { w: 30, h: 56, material: 'concrete' }),
      o('g4k-mid', 'wall', 290, 595, { w: 20, h: 70, material: 'concrete' }),
      o('g4k-notch-2l', 'wall', 315, 602, { w: 30, h: 56, material: 'concrete' }),
      o('g4k-notch-2r', 'wall', 395, 602, { w: 30, h: 56, material: 'concrete' }),
      o('g4k-plinth', 'wall', 475, 595, { w: 130, h: 70, material: 'concrete' }),
      o('g4k-plate', 'pressure_plate', 460, 553, { minMass: 5 }),
      o('g4k-marquee', 'light_bulb', 380, 420),
      o('g4k-battery', 'battery', 100, 470),
      o('g4k-shelf', 'wall', 620, 330, { w: 200, h: 14, material: 'wood' }),
      o('g4k-bucket', 'bucket', 845, 608, { anchored: true }),
    ],
    startingObjects: [
      o('g4k-balloon', 'balloon', 900, 420, { lift: 1, color: 'yellow' }),
      o('g4k-iron', 'bowling_ball', 110, 540),
      o('g4k-ball-a', 'ball', 571, 309),
      o('g4k-ball-b', 'ball', 600, 309),
    ],
    connections: [
      rope('g4k-tether', 'g4k-hook', 'hook', 'g4k-balloon', 'string'),
      wire('g4k-w1', 'g4k-battery', 'out', 'g4k-switch', 'in'),
      wire('g4k-w2', 'g4k-switch', 'out', 'g4k-plate', 'in'),
      wire('g4k-w3', 'g4k-plate', 'out', 'g4k-marquee', 'in'),
    ],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'fan', count: 2 },
      { type: 'candle', count: 1 },
      { type: 'magnet', count: 1 },
      { type: 'plank', count: 3 },
      { type: 'balloon', count: 1 },
      { type: 'rope', count: 1 },
      { type: 'ball', count: 1 },
    ],
    goals: [
      { kind: 'destroyed', target: { id: 'g4k-balloon' }, label: 'Pop the party balloon on the cactus' },
      { kind: 'containerCount', container: 'g4k-bucket', count: 2, filter: { type: 'ball' }, label: 'Tidy both rubber balls into the bucket' },
      { kind: 'activate', target: { id: 'g4k-marquee' }, duration: 2, label: 'Keep the marquee lit for 2 seconds' },
    ],
    restrictions: { timeLimit: 30 },
    bonus: { elegantParts: 7, elegantTime: 7, absurdStages: 14 },
    hints: [
      'Three jobs, one battery: wires are free, so a single battery can run every fan and magnet you place.',
      'The balloon needs its tether burned, then a breeze along the ceiling towards the cactus. On the way it brushes the marquee switch. The rubber balls only need a gentle puff off the shelf.',
      'The iron ball is far too heavy for a fan. Bridge BOTH gaps with planks resting on the little ledges, and put a magnet at the far end of the plinth, facing back towards the ball.',
    ],
    metadata: { chapter: 4, order: 10, author: 'Follyworks', blurb: 'Everything, everywhere, all on one battery.' },
  },
  solutions: [
    {
      objects: [
        o('s-battery', 'battery', 1000, 601),
        o('s-candle', 'candle', 902, 601),
        o('s-fan', 'fan', 1010, 90, { strength: 5, range: 700 }, 0, true),
        o('s-fan-2', 'fan', 470, 304, { strength: 1, range: 300 }),
        o('s-magnet', 'magnet', 530, 535, { strength: 10, reach: 420 }, 0, true),
        o('s-bridge', 'plank', 225, 567, { length: 110 }),
        o('s-bridge-2', 'plank', 355, 567, { length: 110 }),
      ],
      connections: [
        wire('s-w1', 's-battery', 'out', 's-fan', 'in'),
        wire('s-w2', 's-battery', 'out', 's-fan-2', 'in'),
        wire('s-w3', 's-battery', 'out', 's-magnet', 'in'),
      ],
    },
    // ABSURD: a decoy balloon leads the parade into the cactus, and a third ball joins the bucket queue.
    {
      objects: [
        o('s-battery', 'battery', 1000, 601),
        o('s-candle', 'candle', 902, 601),
        o('s-fan', 'fan', 1010, 90, { strength: 5, range: 700 }, 0, true),
        o('s-fan-2', 'fan', 470, 304, { strength: 1, range: 300 }),
        o('s-magnet', 'magnet', 530, 535, { strength: 10, reach: 420 }, 0, true),
        o('s-bridge', 'plank', 225, 567, { length: 110 }),
        o('s-bridge-2', 'plank', 355, 567, { length: 110 }),
        o('s-decoy', 'balloon', 760, 160, { lift: 1 }),
        o('s-ball', 'ball', 629, 309),
      ],
      connections: [
        wire('s-w1', 's-battery', 'out', 's-fan', 'in'),
        wire('s-w2', 's-battery', 'out', 's-fan-2', 'in'),
        wire('s-w3', 's-battery', 'out', 's-magnet', 'in'),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'one bridge is not enough: the iron ball drops into the second gap',
      build: {
        objects: [
          o('s-battery', 'battery', 1000, 601),
          o('s-candle', 'candle', 902, 601),
          o('s-fan', 'fan', 1010, 90, { strength: 5, range: 700 }, 0, true),
          o('s-fan-2', 'fan', 470, 304, { strength: 1, range: 300 }),
          o('s-magnet', 'magnet', 530, 535, { strength: 10, reach: 420 }, 0, true),
          o('s-bridge', 'plank', 225, 567, { length: 110 }),
        ],
        connections: [
          wire('s-w1', 's-battery', 'out', 's-fan', 'in'),
          wire('s-w2', 's-battery', 'out', 's-fan-2', 'in'),
          wire('s-w3', 's-battery', 'out', 's-magnet', 'in'),
        ],
      },
    },
  ],
};

export const GROUP_4: CampaignEntry[] = [upUpAndAway, toastDunk, strike, outOfReach, popGoesTheParty, heavyMetal, cleanSweep, goingUp, specialDelivery, grandOpening];
