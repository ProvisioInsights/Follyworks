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
    environment: 'research',
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

// ---------------------------------------------------------------- 4-4: toast, trap, bell, cat, plate, fan: blow every balloon onto the cactus

const M4_BALLOONS = [
  o('g4d-balloon-1', 'balloon', 450, 118, { lift: 1, color: 'red' }),
  o('g4d-balloon-2', 'balloon', 510, 118, { lift: 1, color: 'yellow' }),
  o('g4d-balloon-3', 'balloon', 570, 118, { lift: 1, color: 'teal' }),
  o('g4d-balloon-4', 'balloon', 630, 118, { lift: 1, color: 'red' }),
];

const M4_BUILD = {
  battery: o('s-battery', 'battery', 40, 601),
  trap: o('s-trap', 'mousetrap', 245, 625),
  bumper: o('s-bumper', 'plank', 652, 520, { length: 80 }, 90 * DEG),
  bridgeA: o('s-bridge-a', 'plank', 850, 567, { length: 58 }),
  bridgeB: o('s-bridge-b', 'plank', 990, 567, { length: 58 }),
};

const partyPooper: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-party-pooper',
    name: 'Party Pooper',
    description: 'Whiskers hates balloons, and his favourite mat starts the party fan. Get the toast popping, ring the bell to wake him, and see him safely to the mat: the fan does the rest.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('g4d-ceiling', 'wall', 560, 80, { w: 1120, h: 20, material: 'steel' }),
      o('g4d-fan', 'fan', 360, 122, { strength: 6, range: 700 }),
      o('g4d-cactus-shelf', 'wall', 1085, 168, { w: 50, h: 10, material: 'wood' }),
      o('g4d-cactus-top', 'cactus', 1085, 134),
      o('g4d-toaster', 'toaster', 100, 606, { delay: 0.8, slices: 1 }, 15 * DEG),
      o('g4d-bell', 'bell', 522, 416),
      o('g4d-counter', 'wall', 730, 595, { w: 180, h: 70, material: 'wood' }),
      o('g4d-pit-cactus', 'cactus', 850, 603),
      o('g4d-mid', 'wall', 920, 595, { w: 80, h: 70, material: 'wood' }),
      o('g4d-mat', 'pressure_plate', 1060, 565, { minMass: 2 }),
      o('g4d-landing', 'wall', 1109, 595, { w: 22, h: 70, material: 'wood' }),
      o('g4d-battery', 'battery', 1090, 480),
      o('g4d-timer', 'timer', 1000, 470, { delay: 0.3, hold: 0 }),
      o('g4d-sign', 'light_bulb', 980, 300),
    ],
    startingObjects: [...M4_BALLOONS, o('g4d-cat', 'cat', 760, 547, {}, 0, true)],
    connections: [
      wire('g4d-w1', 'g4d-battery', 'out', 'g4d-mat', 'in'),
      wire('g4d-w2', 'g4d-mat', 'out', 'g4d-timer', 'in'),
      wire('g4d-w3', 'g4d-timer', 'out', 'g4d-fan', 'in'),
      wire('g4d-w4', 'g4d-timer', 'out', 'g4d-sign', 'in'),
    ],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'mousetrap', count: 1 },
      { type: 'plank', count: 3 },
      { type: 'magnet', count: 1 },
    ],
    goals: [{ kind: 'destroyed', target: { type: 'balloon' }, label: 'Pop every balloon' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 5, elegantTime: 10, absurdStages: 14 },
    hints: [
      'The toaster needs power: wire a battery to it. Its toast lands just to the right, so catch it on the mousetrap and SNAP, off it flies toward the bell.',
      'The DING wakes Whiskers, who bolts left. Stand a plank up at the end of his counter so he turns round instead of falling off.',
      'Bridge both gaps with flat planks so he can trot onto the mat. The mat switches on the fan, and the fan herds the balloons onto the cactus.',
    ],
    metadata: { chapter: 4, order: 4, author: 'Follyworks', blurb: 'Pop, pop, pop, pop. Happy birthday, Whiskers.' },
  },
  solutions: [
    {
      objects: [M4_BUILD.battery, M4_BUILD.trap, M4_BUILD.bumper, M4_BUILD.bridgeA, M4_BUILD.bridgeB],
      connections: [wire('s-w1', 's-battery', 'out', 'g4d-toaster', 'in')],
    },
    // ABSURD: the same, plus an electromagnet humming on the counter, purely for the drama.
    {
      objects: [M4_BUILD.battery, M4_BUILD.trap, M4_BUILD.bumper, M4_BUILD.bridgeA, M4_BUILD.bridgeB, o('s-magnet', 'magnet', 300, 300)],
      connections: [wire('s-w1', 's-battery', 'out', 'g4d-toaster', 'in'), wire('s-w2', 's-battery', 'out', 's-magnet', 'in')],
    },
  ],
  counterexamples: [
    {
      why: 'the toaster has no power',
      build: { objects: [M4_BUILD.battery, M4_BUILD.trap, M4_BUILD.bumper, M4_BUILD.bridgeA, M4_BUILD.bridgeB], connections: [] },
    },
    {
      why: 'there is no mousetrap, so the toast just lands on the floor',
      build: { objects: [M4_BUILD.battery, M4_BUILD.bumper, M4_BUILD.bridgeA, M4_BUILD.bridgeB], connections: [wire('s-w1', 's-battery', 'out', 'g4d-toaster', 'in')] },
    },
    {
      why: 'nothing turns Whiskers round, so he leaps straight off the counter',
      build: { objects: [M4_BUILD.battery, M4_BUILD.trap, M4_BUILD.bridgeA, M4_BUILD.bridgeB], connections: [wire('s-w1', 's-battery', 'out', 'g4d-toaster', 'in')] },
    },
    {
      why: 'the second gap is left open',
      build: { objects: [M4_BUILD.battery, M4_BUILD.trap, M4_BUILD.bumper, M4_BUILD.bridgeA], connections: [wire('s-w1', 's-battery', 'out', 'g4d-toaster', 'in')] },
    },
  ],
};

// ---------------------------------------------------------------- 4-5: Bolt, ball, plate, toaster, trap, bell, rocket: light the birthday cake

const M5_BUILD = {
  battery: o('s-battery', 'battery', 40, 601),
  bridgeA: o('s-bridge-a', 'plank', 140, 177, { length: 58 }),
  bridgeB: o('s-bridge-b', 'plank', 250, 177, { length: 58 }),
  gapA: o('s-gap-a', 'plank', 505, 270, { length: 70 }, 10 * DEG),
  gapB: o('s-gap-b', 'plank', 735, 330, { length: 70 }, 10 * DEG),
  trap: o('s-trap', 'mousetrap', 265, 625),
};

const birthdaySurprise: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-birthday-surprise',
    name: 'Birthday Surprise',
    description: 'It is Bolt’s birthday, and nobody trusts him with matches. Set him marching: his ball should end up starting the toaster, and the toast should ring the bell that fires the rocket past the cake.',
    environment: 'maintenance',
    world: WORLD,
    fixedObjects: [
      o('g4e-shelf-a', 'wall', 55, 177, { w: 110, h: 14, material: 'wood' }),
      o('g4e-shelf-m', 'wall', 195, 177, { w: 50, h: 14, material: 'wood' }),
      o('g4e-shelf-b', 'wall', 305, 177, { w: 50, h: 14, material: 'wood' }),
      o('g4e-track-1', 'plank', 400, 240, { length: 140 }, 10 * DEG),
      o('g4e-track-2', 'plank', 620, 300, { length: 120 }, 10 * DEG),
      o('g4e-ledge', 'wall', 850, 380, { w: 120, h: 14, material: 'wood' }),
      o('g4e-ledge-stop', 'wall', 904, 350, { w: 12, h: 46, material: 'wood' }),
      o('g4e-plate', 'pressure_plate', 845, 366, { minMass: 0.8 }),
      o('g4e-battery', 'battery', 860, 320),
      o('g4e-toaster', 'toaster', 120, 606, { delay: 0.5, slices: 1 }, 15 * DEG),
      o('g4e-bell', 'bell', 542, 416),
      o('g4e-cake', 'wall', 1040, 600, { w: 140, h: 60, material: 'wood' }),
      o('g4e-cake-2', 'wall', 1051, 560, { w: 118, h: 20, material: 'wood' }),
      o('g4e-cake-3', 'wall', 1062, 540, { w: 96, h: 20, material: 'wood' }),
      o('g4e-candle-1', 'candle', 982, 541, { lit: false }),
      o('g4e-candle-2', 'candle', 1004, 521, { lit: false }),
      o('g4e-candle-3', 'candle', 1026, 501, { lit: false }),
      o('g4e-banner', 'light_bulb', 1060, 360),
      o('g4e-canopy', 'wall', 960, 60, { w: 140, h: 16, material: 'wood' }),
    ],
    startingObjects: [
      o('g4e-bolt', 'robot', 60, 148, { awake: false }),
      o('g4e-ball', 'ball', 305, 156),
      o('g4e-rocket', 'rocket', 960, 595, { thrust: 3, burn: 1.8 }, -90 * DEG),
      o('g4e-balloon-1', 'balloon', 940, 95, { lift: 1, color: 'red' }),
      o('g4e-balloon-2', 'balloon', 982, 95, { lift: 1, color: 'teal' }),
    ],
    connections: [
      wire('g4e-w1', 'g4e-battery', 'out', 'g4e-plate', 'in'),
      wire('g4e-w2', 'g4e-plate', 'out', 'g4e-toaster', 'in'),
      wire('g4e-w3', 'g4e-bell', 'out', 'g4e-rocket', 'in'),
      wire('g4e-w4', 'g4e-plate', 'out', 'g4e-banner', 'in'),
    ],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'plank', count: 4 },
      { type: 'mousetrap', count: 1 },
      { type: 'magnet', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { type: 'candle' }, count: 3, label: 'Light all three birthday candles' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 6, elegantTime: 10, absurdStages: 12 },
    hints: [
      'Wire a battery to Bolt’s antenna and he marches right, as long as there are planks across the gaps in his shelf. He shoves the ball off the end.',
      'The ball’s track has two missing pieces. Once it lands on the plate, the toaster starts.',
      'Toast lands just right of the toaster: a mousetrap there flings it at the bell, and the bell fires the rocket right past the candles.',
    ],
    metadata: { chapter: 4, order: 5, author: 'Follyworks', blurb: 'Make a wish. Stand well back.' },
  },
  solutions: [
    {
      objects: [M5_BUILD.battery, M5_BUILD.bridgeA, M5_BUILD.bridgeB, M5_BUILD.gapA, M5_BUILD.gapB, M5_BUILD.trap],
      connections: [wire('s-w1', 's-battery', 'out', 'g4e-bolt', 'in')],
    },
    // ABSURD: the same, plus an electromagnet buzzing over the cake for atmosphere.
    {
      objects: [M5_BUILD.battery, M5_BUILD.bridgeA, M5_BUILD.bridgeB, M5_BUILD.gapA, M5_BUILD.gapB, M5_BUILD.trap, o('s-magnet', 'magnet', 700, 120)],
      connections: [wire('s-w1', 's-battery', 'out', 'g4e-bolt', 'in'), wire('s-w2', 's-battery', 'out', 's-magnet', 'in')],
    },
  ],
  counterexamples: [
    {
      why: 'Bolt is not wired up, so he never moves',
      build: { objects: [M5_BUILD.battery, M5_BUILD.bridgeA, M5_BUILD.bridgeB, M5_BUILD.gapA, M5_BUILD.gapB, M5_BUILD.trap], connections: [] },
    },
    {
      why: 'one gap in Bolt’s shelf is left open',
      build: { objects: [M5_BUILD.battery, M5_BUILD.bridgeA, M5_BUILD.gapA, M5_BUILD.gapB, M5_BUILD.trap], connections: [wire('s-w1', 's-battery', 'out', 'g4e-bolt', 'in')] },
    },
    {
      why: 'the ball’s track is missing a piece',
      build: { objects: [M5_BUILD.battery, M5_BUILD.bridgeA, M5_BUILD.bridgeB, M5_BUILD.gapA, M5_BUILD.trap], connections: [wire('s-w1', 's-battery', 'out', 'g4e-bolt', 'in')] },
    },
    {
      why: 'there is no mousetrap to fling the toast',
      build: { objects: [M5_BUILD.battery, M5_BUILD.bridgeA, M5_BUILD.bridgeB, M5_BUILD.gapA, M5_BUILD.gapB], connections: [wire('s-w1', 's-battery', 'out', 'g4e-bolt', 'in')] },
    },
    {
      why: 'an electromagnet tries to haul the unlit rocket up past the candles',
      build: { objects: [M5_BUILD.battery, o('s-magnet', 'magnet', 960, 300, { strength: 10, reach: 420 }, 90 * DEG)], connections: [wire('s-w2', 's-battery', 'out', 's-magnet', 'in')] },
    },
  ],
};

// ---------------------------------------------------------------- 4-6: teapot steam sends one ball through three switches and onto a plate: four lamps

const M6_BUILD = {
  candle: o('s-candle', 'candle', 150, 190),
  plankA: o('s-plank-a', 'plank', 480, 282, { length: 130 }, 22 * DEG),
  plankB: o('s-plank-b', 'plank', 717, 350, { length: 100 }, 20 * DEG),
  gap: o('s-gap', 'plank', 920, 400, { length: 70 }, 8 * DEG),
  stop: o('s-stop', 'plank', 1064, 374, { length: 70 }, 90 * DEG),
  battery: o('s-battery', 'battery', 40, 601),
};

const vaultLights: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-vault-lights',
    name: 'Switched On',
    description: 'The vault has four lamps and one very busy ball. Boil the kettle so its steam sends the ball down the line, flicking every switch on the way, and park it on the plate at the end of the line.',
    environment: 'underground',
    world: WORLD,
    fixedObjects: [
      o('g4f-hob', 'wall', 130, 170, { w: 150, h: 14, material: 'steel' }),
      o('g4f-perch', 'wall', 232, 126, { w: 44, h: 12, material: 'wood' }),
      o('g4f-backstop', 'wall', 352, 125, { w: 12, h: 130, material: 'wood' }),
      o('g4f-track-1', 'plank', 325, 230, { length: 194 }, 12 * DEG),
      o('g4f-track-2', 'plank', 602, 324, { length: 120 }, 6 * DEG),
      o('g4f-track-3', 'plank', 826, 384, { length: 110 }, 6 * DEG),
      o('g4f-track-4', 'plank', 976, 415, { length: 36 }, 4 * DEG),
      o('g4f-switch-1', 'toggle_switch', 602, 309),
      o('g4f-switch-2', 'toggle_switch', 826, 369),
      o('g4f-switch-3', 'toggle_switch', 930, 384),
      o('g4f-plate', 'pressure_plate', 1036, 420, { minMass: 0.8 }),
      o('g4f-lamp-1', 'light_bulb', 640, 160),
      o('g4f-lamp-2', 'light_bulb', 720, 160),
      o('g4f-lamp-3', 'light_bulb', 800, 160),
      o('g4f-lamp-4', 'light_bulb', 880, 160),
      o('g4f-battery', 'battery', 1080, 250),
    ],
    startingObjects: [o('g4f-teapot', 'teapot', 150, 142), o('g4f-ball', 'ball', 232, 106)],
    connections: [
      wire('g4f-w1', 'g4f-battery', 'out', 'g4f-switch-1', 'in'),
      wire('g4f-w2', 'g4f-battery', 'out', 'g4f-switch-2', 'in'),
      wire('g4f-w3', 'g4f-switch-1', 'out', 'g4f-lamp-1', 'in'),
      wire('g4f-w4', 'g4f-switch-2', 'out', 'g4f-lamp-2', 'in'),
      wire('g4f-w5', 'g4f-switch-3', 'out', 'g4f-lamp-3', 'in'),
      wire('g4f-w6', 'g4f-battery', 'out', 'g4f-plate', 'in'),
      wire('g4f-w7', 'g4f-plate', 'out', 'g4f-lamp-4', 'in'),
    ],
    inventory: [
      { type: 'candle', count: 1 },
      { type: 'plank', count: 4 },
      { type: 'battery', count: 1 },
      { type: 'fan', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { type: 'light_bulb' }, count: 4, duration: 1, label: 'Keep all four vault lamps lit for a second' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 6, elegantTime: 12, absurdStages: 10 },
    hints: [
      'A candle under the hob boils the teapot, and its steam blows the ball off the perch. The top track is missing two pieces.',
      'Anything rolling right through a switch flicks it ON. The track has two more gaps further along: one after the second switch, and nothing at all to stop the ball once it reaches the plate.',
      'The third switch has no power of its own: wire it to a battery, or its lamp stays dark however hard the ball flicks it.',
    ],
    metadata: { chapter: 4, order: 6, author: 'Follyworks', blurb: 'One ball, four lamps, zero electricians.' },
  },
  solutions: [
    {
      objects: [M6_BUILD.candle, M6_BUILD.plankA, M6_BUILD.plankB, M6_BUILD.gap, M6_BUILD.stop, M6_BUILD.battery],
      connections: [wire('s-w1', 's-battery', 'out', 'g4f-switch-3', 'in')],
    },
    // ABSURD: the same, plus a fan on the battery, cooling the cellar for no reason at all.
    {
      objects: [M6_BUILD.candle, M6_BUILD.plankA, M6_BUILD.plankB, M6_BUILD.gap, M6_BUILD.stop, M6_BUILD.battery, o('s-fan', 'fan', 60, 400, { strength: 3, range: 200 }, -90 * DEG)],
      connections: [wire('s-w1', 's-battery', 'out', 'g4f-switch-3', 'in'), wire('s-w2', 's-battery', 'out', 's-fan', 'in')],
    },
  ],
  counterexamples: [
    {
      why: 'there is no flame under the teapot',
      build: { objects: [M6_BUILD.plankA, M6_BUILD.plankB, M6_BUILD.gap, M6_BUILD.stop, M6_BUILD.battery], connections: [wire('s-w1', 's-battery', 'out', 'g4f-switch-3', 'in')] },
    },
    {
      why: 'the third switch has no power',
      build: { objects: [M6_BUILD.candle, M6_BUILD.plankA, M6_BUILD.plankB, M6_BUILD.gap, M6_BUILD.stop, M6_BUILD.battery], connections: [] },
    },
    {
      why: 'nothing stops the ball, so it rolls straight over the plate and off the end',
      build: { objects: [M6_BUILD.candle, M6_BUILD.plankA, M6_BUILD.plankB, M6_BUILD.gap, M6_BUILD.battery], connections: [wire('s-w1', 's-battery', 'out', 'g4f-switch-3', 'in')] },
    },
    {
      why: 'the gap after the second switch is left open',
      build: { objects: [M6_BUILD.candle, M6_BUILD.plankA, M6_BUILD.plankB, M6_BUILD.stop, M6_BUILD.battery], connections: [wire('s-w1', 's-battery', 'out', 'g4f-switch-3', 'in')] },
    },
  ],
};

// ---------------------------------------------------------------- 4-7: balloon yanks the switch, conveyor feeds the air tube, three balls into the hoop

const M7_BUILD = {
  candle: o('s-candle', 'candle', 52, 601),
  fan: o('s-fan', 'fan', 715, 590, { strength: 6, range: 500 }, -90 * DEG),
  battery: o('s-battery', 'battery', 640, 601),
  gapA: o('s-gap-a', 'plank', 532, 487, { length: 60 }, 25 * DEG),
  gapB: o('s-gap-b', 'plank', 658, 540, { length: 50 }, 15 * DEG),
  cap: o('s-cap', 'plank', 740, 156, { length: 110 }, -30 * DEG),
  backstop: o('s-backstop', 'plank', 887, 148, { length: 220 }, 115 * DEG),
};

const threePointer: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-three-pointer',
    name: 'Air Ball',
    description: 'The greenhouse has a basketball hoop and a brand-new air tube. Free the balloon so it yanks the switch, the conveyor feeds the balls down to the tube, and a fan blasts each one up and over into the hoop.',
    environment: 'greenhouse',
    world: WORLD,
    fixedObjects: [
      o('g4g-hook', 'hook', 50, 612),
      o('g4g-switch', 'toggle_switch', 80, 380, {}, -90 * DEG),
      o('g4g-battery', 'battery', 150, 601),
      o('g4g-conveyor', 'conveyor', 270, 420, { length: 260, speed: 90 }),
      o('g4g-ramp-1', 'plank', 450, 450, { length: 110 }, 25 * DEG),
      o('g4g-ramp-2', 'plank', 600, 515, { length: 70 }, 20 * DEG),
      o('g4g-tube-l', 'wall', 690, 345, { w: 12, h: 310, material: 'steel' }),
      o('g4g-tube-r', 'wall', 740, 400, { w: 12, h: 320, material: 'steel' }),
      o('g4g-game-on', 'light_bulb', 200, 300),
      o('g4g-scoreboard', 'light_bulb', 1000, 330),
      o('g4g-cactus-1', 'cactus', 980, 601),
      o('g4g-cactus-2', 'cactus', 1060, 601),
      o('g4g-hoop', 'basketball_hoop', 800, 300, {}, 0, true),
    ],
    startingObjects: [
      o('g4g-balloon', 'balloon', 50, 300, { lift: 1, color: 'yellow' }),
      o('g4g-ball-1', 'ball', 180, 395),
      o('g4g-ball-2', 'ball', 250, 395),
      o('g4g-ball-3', 'ball', 320, 395),
    ],
    connections: [
      rope('g4g-tether', 'g4g-hook', 'hook', 'g4g-balloon', 'string'),
      { ...rope('g4g-yank', 'g4g-switch', 'lever', 'g4g-balloon', 'string'), props: { slack: 40 } },
      wire('g4g-w1', 'g4g-battery', 'out', 'g4g-switch', 'in'),
      wire('g4g-w2', 'g4g-switch', 'out', 'g4g-conveyor', 'in'),
      wire('g4g-w3', 'g4g-switch', 'out', 'g4g-game-on', 'in'),
      wire('g4g-w4', 'g4g-switch', 'out', 'g4g-scoreboard', 'in'),
    ],
    inventory: [
      { type: 'candle', count: 1 },
      { type: 'fan', count: 1 },
      { type: 'battery', count: 1 },
      { type: 'plank', count: 4 },
      { type: 'magnet', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g4g-hoop', count: 3, filter: { type: 'ball' }, label: 'Sink all three balls through the hoop' }],
    restrictions: { timeLimit: 30 },
    bonus: { elegantParts: 7, elegantTime: 14, absurdStages: 13 },
    hints: [
      'A candle under the tether frees the balloon, and the balloon yanks the switch that starts the conveyor.',
      'The balls need a path from the end of the conveyor down to the opening at the bottom of the tube.',
      'A fan under the tube, pointing up and wired to a battery, blasts each ball up the tube. A plank slanted over the top sends it across to the hoop, and a tall plank past the hoop stops it overshooting.',
    ],
    metadata: { chapter: 4, order: 7, author: 'Follyworks', blurb: 'Nothing but net. And air.' },
  },
  solutions: [
    {
      objects: [M7_BUILD.candle, M7_BUILD.fan, M7_BUILD.battery, M7_BUILD.gapA, M7_BUILD.gapB, M7_BUILD.cap, M7_BUILD.backstop],
      connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')],
    },
    // ABSURD: the same, plus an electromagnet humming over the cacti, because why not.
    {
      objects: [M7_BUILD.candle, M7_BUILD.fan, M7_BUILD.battery, M7_BUILD.gapA, M7_BUILD.gapB, M7_BUILD.cap, M7_BUILD.backstop, o('s-magnet', 'magnet', 1000, 200)],
      connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in'), wire('s-w2', 's-battery', 'out', 's-magnet', 'in')],
    },
  ],
  counterexamples: [
    {
      why: 'no flame under the tether, so the balloon never yanks the switch',
      build: { objects: [M7_BUILD.fan, M7_BUILD.battery, M7_BUILD.gapA, M7_BUILD.gapB, M7_BUILD.cap, M7_BUILD.backstop], connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')] },
    },
    {
      why: 'the fan is not wired up',
      build: { objects: [M7_BUILD.candle, M7_BUILD.fan, M7_BUILD.battery, M7_BUILD.gapA, M7_BUILD.gapB, M7_BUILD.cap, M7_BUILD.backstop], connections: [] },
    },
    {
      why: 'the lower gap is left open, so the balls fall short of the tube',
      build: { objects: [M7_BUILD.candle, M7_BUILD.fan, M7_BUILD.battery, M7_BUILD.gapA, M7_BUILD.cap, M7_BUILD.backstop], connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')] },
    },
    {
      why: 'nothing over the top of the tube, so the balls shoot straight up and drop back in',
      build: { objects: [M7_BUILD.candle, M7_BUILD.fan, M7_BUILD.battery, M7_BUILD.gapA, M7_BUILD.gapB, M7_BUILD.backstop], connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')] },
    },
  ],
};

// ---------------------------------------------------------------- 4-8: fan, ball, arming switch, toaster wakes the cat, cat on the mat, rocket pops the balloons

const M8_BUILD = {
  fan: o('s-fan', 'fan', 150, 104, { strength: 2, range: 160 }),
  plankA: o('s-plank-a', 'plank', 480, 282, { length: 130 }, 22 * DEG),
  battery: o('s-battery', 'battery', 40, 601),
  bumper: o('s-bumper', 'plank', 632, 520, { length: 80 }, 90 * DEG),
  bridgeA: o('s-bridge-a', 'plank', 770, 567, { length: 58 }),
  bridgeB: o('s-bridge-b', 'plank', 890, 567, { length: 58 }),
  bridgeC: o('s-bridge-c', 'plank', 995, 567, { length: 88 }),
};

const launchDay: CampaignEntry = {
  chapter: 4,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g4-launch-day',
    name: 'Ground Control to Whiskers',
    description: 'The lab rocket only launches when Whiskers sits on the launch mat, and the mat only works once the arming switch is on. Breeze the ball down to the switch, let the toaster wake him, and see him safely to the launch pad.',
    environment: 'research',
    world: WORLD,
    fixedObjects: [
      o('g4h-perch', 'wall', 232, 126, { w: 44, h: 12, material: 'wood' }),
      o('g4h-track-1', 'plank', 325, 230, { length: 194 }, 12 * DEG),
      o('g4h-track-2', 'plank', 602, 324, { length: 120 }, 6 * DEG),
      o('g4h-switch', 'toggle_switch', 602, 309),
      o('g4h-toaster', 'toaster', 560, 606, { delay: 0.5, slices: 1 }),
      o('g4h-bucket', 'bucket', 960, 480),
      o('g4h-counter', 'wall', 680, 595, { w: 120, h: 70, material: 'wood' }),
      o('g4h-mid-1', 'wall', 830, 595, { w: 60, h: 70, material: 'wood' }),
      o('g4h-mid-2', 'wall', 935, 595, { w: 30, h: 70, material: 'wood' }),
      o('g4h-mat', 'pressure_plate', 1078, 565, { minMass: 2 }),
      o('g4h-shelf', 'wall', 1060, 440, { w: 60, h: 14, material: 'steel' }),
      o('g4h-cage-1', 'wall', 1098, 312, { w: 50, h: 8, material: 'wood' }),
      o('g4h-cage-2', 'wall', 1022, 232, { w: 50, h: 8, material: 'wood' }),
      o('g4h-cage-2-lip', 'wall', 1000, 252, { w: 6, h: 40, material: 'wood' }),
      o('g4h-cage-3', 'wall', 1098, 152, { w: 50, h: 8, material: 'wood' }),
      o('g4h-armed', 'light_bulb', 760, 200),
      o('g4h-count-3', 'light_bulb', 880, 140),
      o('g4h-count-2', 'light_bulb', 930, 140),
      o('g4h-count-1', 'light_bulb', 980, 140),
      o('g4h-liftoff', 'light_bulb', 930, 80),
      o('g4h-desk-lamp', 'light_bulb', 420, 420),
    ],
    startingObjects: [
      o('g4h-ball', 'ball', 232, 106),
      o('g4h-cat', 'cat', 700, 547, {}, 0, true),
      o('g4h-rocket', 'rocket', 1060, 406, { thrust: 3, burn: 1.8 }, -90 * DEG),
      o('g4h-balloon-1', 'balloon', 1093, 338, { lift: 1, color: 'red' }),
      o('g4h-balloon-2', 'balloon', 1027, 258, { lift: 1, color: 'yellow' }),
      o('g4h-balloon-3', 'balloon', 1093, 178, { lift: 1, color: 'teal' }),
    ],
    connections: [
      wire('g4h-w1', 'g4h-switch', 'out', 'g4h-mat', 'in'),
      wire('g4h-w2', 'g4h-mat', 'out', 'g4h-rocket', 'in'),
      wire('g4h-w3', 'g4h-switch', 'out', 'g4h-armed', 'in'),
      wire('g4h-w4', 'g4h-mat', 'out', 'g4h-count-3', 'in'),
      wire('g4h-w5', 'g4h-mat', 'out', 'g4h-count-2', 'in'),
      wire('g4h-w6', 'g4h-mat', 'out', 'g4h-count-1', 'in'),
      wire('g4h-w7', 'g4h-mat', 'out', 'g4h-liftoff', 'in'),
      wire('g4h-w8', 'g4h-switch', 'out', 'g4h-desk-lamp', 'in'),
      wire('g4h-w9', 'g4h-switch', 'out', 'g4h-toaster', 'in'),
    ],
    inventory: [
      { type: 'fan', count: 1 },
      { type: 'battery', count: 1 },
      { type: 'plank', count: 5 },
      { type: 'magnet', count: 1 },
    ],
    goals: [{ kind: 'destroyed', target: { type: 'balloon' }, label: 'Pop all three balloons with the rocket' }],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 6, elegantTime: 12, absurdStages: 18 },
    hints: [
      'A gentle fan, wired to a battery, blows the ball off its perch, so fast it needs a plank standing up to stop it over the track. The track has a gap further on, and the arming switch needs power from the same battery.',
      'The ball flicks the switch on. The switch also starts the toaster, and the POP wakes Whiskers, who bolts left. Stand a plank up at the end of his counter so he turns round.',
      'Bridge all three gaps to the launch mat; the last one is wide. Once he sits down, the countdown lights up and the rocket exhaust singes every balloon on the way up.',
    ],
    metadata: { chapter: 4, order: 8, author: 'Follyworks', blurb: 'Three, two, one, meow.' },
  },
  solutions: [
    {
      objects: [M8_BUILD.fan, M8_BUILD.plankA, M8_BUILD.battery, M8_BUILD.bumper, M8_BUILD.bridgeA, M8_BUILD.bridgeB, M8_BUILD.bridgeC],
      connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in'), wire('s-w2', 's-battery', 'out', 'g4h-switch', 'in')],
    },
    // ABSURD: the same, plus an electromagnet humming on the battery while everybody waits for lift-off.
    {
      objects: [M8_BUILD.fan, M8_BUILD.plankA, M8_BUILD.battery, M8_BUILD.bumper, M8_BUILD.bridgeA, M8_BUILD.bridgeB, M8_BUILD.bridgeC, o('s-magnet', 'magnet', 300, 450)],
      connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in'), wire('s-w2', 's-battery', 'out', 'g4h-switch', 'in'), wire('s-w3', 's-battery', 'out', 's-magnet', 'in')],
    },
  ],
  counterexamples: [
    {
      why: 'the arming switch has no power, so the mat never fires the rocket',
      build: { objects: [M8_BUILD.fan, M8_BUILD.plankA, M8_BUILD.battery, M8_BUILD.bumper, M8_BUILD.bridgeA, M8_BUILD.bridgeB, M8_BUILD.bridgeC], connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in')] },
    },
    {
      why: 'the fan is not wired up, so the ball never leaves its perch',
      build: { objects: [M8_BUILD.fan, M8_BUILD.plankA, M8_BUILD.battery, M8_BUILD.bumper, M8_BUILD.bridgeA, M8_BUILD.bridgeB, M8_BUILD.bridgeC], connections: [wire('s-w2', 's-battery', 'out', 'g4h-switch', 'in')] },
    },
    {
      why: 'nothing turns Whiskers round, so he leaps off the left end of the counter',
      build: { objects: [M8_BUILD.fan, M8_BUILD.plankA, M8_BUILD.battery, M8_BUILD.bridgeA, M8_BUILD.bridgeB, M8_BUILD.bridgeC], connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in'), wire('s-w2', 's-battery', 'out', 'g4h-switch', 'in')] },
    },
    {
      why: 'the last gap is left open',
      build: { objects: [M8_BUILD.fan, M8_BUILD.plankA, M8_BUILD.battery, M8_BUILD.bumper, M8_BUILD.bridgeA, M8_BUILD.bridgeB], connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in'), wire('s-w2', 's-battery', 'out', 'g4h-switch', 'in')] },
    },
    {
      why: 'a full-blast fan tries to blow Whiskers straight onto the mat',
      build: {
        objects: [o('s-fan', 'fan', 560, 530, { strength: 10, range: 600 }), M8_BUILD.battery, M8_BUILD.bridgeA, M8_BUILD.bridgeB, M8_BUILD.bridgeC],
        connections: [wire('s-w1', 's-battery', 'out', 's-fan', 'in'), wire('s-w2', 's-battery', 'out', 'g4h-switch', 'in')],
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

export const GROUP_4: CampaignEntry[] = [upUpAndAway, toastDunk, strike, partyPooper, birthdaySurprise, vaultLights, threePointer, launchDay, specialDelivery, grandOpening];
