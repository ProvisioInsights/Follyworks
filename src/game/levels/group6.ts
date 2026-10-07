// Mission group 6: Lasers & Light. Laser emitters, mirrors, beam splitters, prisms, colour
// filters, lenses and light sensors, mixed with the ropes, balloons, candles, dynamite, motors and
// logic from the earlier groups. Beams heat what they rest on, cut ropes and trip sensors.
// Pure level data; `solutions` and `counterexamples` are test fixtures only (tests/levels).

import { STANDARD_WORLD } from '../../core/level';
import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const link = (id: string, kind: 'wire' | 'rope' | 'belt', from: string, fromPort: string, to: string, toPort: string, via?: string[]): ConnectionDef =>
  via ? { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort }, via } : { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort } };
const wire = (id: string, from: string, to: string, toPort = 'in', fromPort = 'out'): ConnectionDef => link(id, 'wire', from, fromPort, to, toPort);
const rope = (id: string, from: string, fromPort: string, to: string, toPort: string): ConnectionDef => link(id, 'rope', from, fromPort, to, toPort);

const WORLD = () => ({ ...STANDARD_WORLD });
const DEG = Math.PI / 180;
/** Mirror angles: "/" turns a rightward beam up (and an upward one right); "\" turns a rightward beam down. */
const UP = -45 * DEG;
const DOWN = 45 * DEG;

// ---------------------------------------------------------------- 6-1: wake-up call

const dingDong: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-wake-up-call',
    name: 'Wake-Up Call',
    description: 'Whiskers is napping under the bell. Get the rolling ball to flick the switch, then bounce the laser round the wall to burn the rope, so the crate rings the bell right over his ears.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6a-ramp', 'plank', 150, 120, { length: 200 }, -12 * DEG),
      o('g6a-shelf', 'plank', 300, 300, { length: 160 }),
      o('g6a-cup', 'bucket', 412, 345),
      o('g6a-wall', 'wall', 520, 400, { w: 30, h: 460, material: 'brick' }),
      o('g6a-roof', 'wall', 980, 372, { w: 280, h: 16, material: 'steel' }),
      o('g6a-hook', 'hook', 960, 392),
    ],
    startingObjects: [
      o('g6a-ball', 'ball', 225, 80),
      o('g6a-switch', 'toggle_switch', 300, 268),
      o('g6a-battery', 'battery', 100, 600),
      o('g6a-laser', 'laser', 100, 560, { alwaysOn: false, color: 'red' }),
      o('g6a-crate', 'crate', 960, 495),
      o('g6a-bell', 'bell', 960, 560),
      o('g6a-cat', 'cat', 1060, 617, {}, 0, true),
    ],
    connections: [
      wire('g6a-w1', 'g6a-battery', 'g6a-switch'),
      wire('g6a-w2', 'g6a-switch', 'g6a-laser'),
      rope('g6a-r1', 'g6a-hook', 'hook', 'g6a-crate', 'hook'),
    ],
    inventory: [
      { type: 'plank', count: 2 },
      { type: 'mirror', count: 5 },
      { type: 'beam_splitter', count: 1 },
    ],
    goals: [
      { kind: 'activate', target: { id: 'g6a-bell' }, label: 'Ring the bell' },
      { kind: 'activate', target: { id: 'g6a-cat' }, label: 'Wake up Whiskers' },
    ],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 5, elegantTime: 3.5, absurdStages: 11 },
    hints: [
      'The ball falls off the end of its ramp. A plank can catch it and roll it onto the shelf with the switch.',
      'A mirror turned 45° bends the beam through a right angle. The rope hangs under a roof, so the beam has to come in from the side.',
      'Up beside the wall, right over the top, down past it, then right again under the roof: four mirrors.',
    ],
    metadata: { chapter: 6, order: 1, author: 'Follyworks', blurb: 'Light goes where it is told.' },
  },
  solutions: [
    {
      objects: [
        o('s-plank', 'plank', 110, 235, { length: 200 }, 15 * DEG),
        o('s-m1', 'mirror', 470, 560, {}, UP),
        o('s-m2', 'mirror', 470, 100, {}, UP),
        o('s-m3', 'mirror', 760, 100, {}, DOWN),
        o('s-m4', 'mirror', 760, 435, {}, DOWN),
      ],
      connections: [],
    },
    // ABSURD: a splitter on the floor sends half the beam up into a spare mirror and off into the brickwork.
    {
      objects: [
        o('s-plank', 'plank', 110, 235, { length: 200 }, 15 * DEG),
        o('s-split', 'beam_splitter', 300, 560, {}, UP),
        o('s-m5', 'mirror', 300, 450, {}, UP),
        o('s-m1', 'mirror', 470, 560, {}, UP),
        o('s-m2', 'mirror', 470, 100, {}, UP),
        o('s-m3', 'mirror', 760, 100, {}, DOWN),
        o('s-m4', 'mirror', 760, 435, {}, DOWN),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'the ball misses the switch shelf without a plank, so the laser never comes on',
      build: {
        objects: [o('s-m1', 'mirror', 470, 560, {}, UP), o('s-m2', 'mirror', 470, 100, {}, UP), o('s-m3', 'mirror', 760, 100, {}, DOWN), o('s-m4', 'mirror', 760, 435, {}, DOWN)],
        connections: [],
      },
    },
    {
      why: 'a beam sent straight down onto the rope is stopped by the roof',
      build: {
        objects: [o('s-plank', 'plank', 110, 235, { length: 200 }, 15 * DEG), o('s-m1', 'mirror', 470, 560, {}, UP), o('s-m2', 'mirror', 470, 100, {}, UP), o('s-m3', 'mirror', 960, 100, {}, DOWN)],
        connections: [],
      },
    },
  ],
};

// ---------------------------------------------------------------- 6-2: tea-time tip-off

const teaTime: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-tea-time',
    name: 'Tea-Time Tip-Off',
    description: 'Dominoes, toast, a laser and a teapot, all to sink one basketball. Fill the gap in the dominoes, then steer the beam onto the teapot so its steam puffs the ball into the hoop.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6b-ramp', 'plank', 80, 320, { length: 130 }, 25 * DEG),
      o('g6b-platform', 'plank', 220, 380, { length: 360 }),
      o('g6b-kerb', 'wall', 196, 361, { w: 8, h: 24, material: 'steel' }),
      o('g6b-wall', 'wall', 480, 430, { w: 30, h: 400, material: 'brick' }),
      o('g6b-hood', 'wall', 700, 222, { w: 130, h: 12, material: 'steel' }),
      o('g6b-shelf', 'wall', 700, 300, { w: 120, h: 14, material: 'steel' }),
      o('g6b-ledge', 'wall', 810, 252, { w: 70, h: 12, material: 'steel' }),
    ],
    startingObjects: [
      o('g6b-bowl', 'bowling_ball', 40, 262),
      o('g6b-d1', 'domino', 176, 344),
      o('g6b-d4', 'domino', 270, 344),
      o('g6b-d5', 'domino', 300, 344),
      o('g6b-toaster', 'toaster', 362, 349, {}, 0, true),
      o('g6b-flipflop', 'logic_gate', 250, 470, { mode: 'toggle' }),
      o('g6b-laser', 'laser', 90, 560, { alwaysOn: false, color: 'red' }),
      o('g6b-teapot', 'teapot', 700, 272),
      o('g6b-ball', 'basketball', 800, 230),
      o('g6b-hoop', 'basketball_hoop', 1010, 480, {}, 0, true),
    ],
    connections: [wire('g6b-w1', 'g6b-toaster', 'g6b-flipflop', 'a'), wire('g6b-w2', 'g6b-flipflop', 'g6b-laser')],
    inventory: [
      { type: 'domino', count: 3 },
      { type: 'mirror', count: 5 },
      { type: 'beam_splitter', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g6b-hoop', count: 1, label: 'Sink the basketball' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 6, elegantTime: 6, absurdStages: 19 },
    hints: [
      "Two dominoes are missing from the row. The last domino has to tip onto the toaster's lever.",
      'When the toaster dings, its pulse flips the logic box on and the laser fires. A hot teapot whistles and puffs out steam.',
      'The teapot has a lid over it, so bring the beam in from the side: up, over the wall, down, then right.',
    ],
    metadata: { chapter: 6, order: 2, author: 'Follyworks', blurb: 'One lump or two pointers?' },
  },
  solutions: [
    {
      objects: [
        o('s-d2', 'domino', 210, 344),
        o('s-d3', 'domino', 240, 344),
        o('s-m1', 'mirror', 420, 560, {}, UP),
        o('s-m2', 'mirror', 420, 150, {}, UP),
        o('s-m3', 'mirror', 590, 150, {}, DOWN),
        o('s-m4', 'mirror', 590, 274, {}, DOWN),
      ],
      connections: [],
    },
    // ABSURD: a splitter peels half the beam off into a spare mirror, which fires it into the wall.
    {
      objects: [
        o('s-d2', 'domino', 210, 344),
        o('s-d3', 'domino', 240, 344),
        o('s-split', 'beam_splitter', 300, 560, {}, UP),
        o('s-m5', 'mirror', 300, 470, {}, UP),
        o('s-m1', 'mirror', 420, 560, {}, UP),
        o('s-m2', 'mirror', 420, 150, {}, UP),
        o('s-m3', 'mirror', 590, 150, {}, DOWN),
        o('s-m4', 'mirror', 590, 274, {}, DOWN),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'with the gap in the dominoes the toaster never dings, so the laser stays off',
      build: {
        objects: [o('s-m1', 'mirror', 420, 560, {}, UP), o('s-m2', 'mirror', 420, 150, {}, UP), o('s-m3', 'mirror', 590, 150, {}, DOWN), o('s-m4', 'mirror', 590, 274, {}, DOWN)],
        connections: [],
      },
    },
    {
      why: 'a beam dropped straight down onto the teapot hits its lid',
      build: {
        objects: [o('s-d2', 'domino', 210, 344), o('s-d3', 'domino', 240, 344), o('s-m1', 'mirror', 420, 560, {}, UP), o('s-m2', 'mirror', 420, 150, {}, UP), o('s-m3', 'mirror', 700, 150, {}, DOWN)],
        connections: [],
      },
    },
  ],
};

// ---------------------------------------------------------------- 6-4: rainbow breakfast

const breakfastBuild = (extra: ObjectDef[] = []): ObjectDef[] => [
  o('s-p1', 'plank', 220, 160, { length: 78 }),
  o('s-p2', 'plank', 400, 160, { length: 78 }),
  o('s-prism', 'prism', 300, 420),
  o('s-r1', 'mirror', 700, 522, {}, -30 * DEG),
  o('s-r2', 'mirror', 786, 200, {}, -30 * DEG),
  o('s-b1', 'mirror', 500, 524),
  o('s-b2', 'mirror', 620, 446, {}, -15 * DEG),
  ...extra,
];
const breakfast: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-rainbow-breakfast',
    name: 'Rainbow Breakfast',
    description: 'Bolt marches to the pressure plate, which powers a white laser. The toaster only starts when the red sensor sees red AND the blue sensor sees blue. Bridge Bolt\'s path, then unmix the light and serve both slices into the basket.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6d-shelf-1', 'plank', 100, 160, { length: 160 }),
      o('g6d-shelf-2', 'plank', 310, 160, { length: 100 }),
      o('g6d-shelf-3', 'plank', 490, 160, { length: 100 }),
      o('g6d-pit-l', 'wall', 556, 318, { w: 8, h: 50, material: 'steel' }),
      o('g6d-pit-r', 'wall', 644, 318, { w: 8, h: 50, material: 'steel' }),
      o('g6d-pit-floor', 'wall', 600, 349, { w: 96, h: 12, material: 'steel' }),
      o('g6d-toast-shelf', 'wall', 860, 470, { w: 120, h: 14, material: 'steel' }),
      o('g6d-funnel-l', 'plank', 978, 500, { length: 90 }, 55 * DEG),
      o('g6d-funnel-r', 'plank', 1078, 500, { length: 90 }, -55 * DEG),
    ],
    startingObjects: [
      o('g6d-bolt', 'robot', 50, 131, { speed: 140 }),
      o('g6d-battery', 'battery', 560, 600),
      o('g6d-plate', 'pressure_plate', 600, 334),
      o('g6d-laser', 'laser', 90, 420, { alwaysOn: false, color: 'white' }),
      o('g6d-red', 'light_sensor', 1050, 271, { color: 'red' }),
      o('g6d-blue', 'light_sensor', 760, 446, { color: 'blue' }),
      o('g6d-and', 'logic_gate', 900, 300, { mode: 'and' }),
      o('g6d-toaster', 'toaster', 860, 441, { delay: 0.8, power: 500 }, 20 * DEG),
      o('g6d-basket', 'bucket', 1028, 598),
    ],
    connections: [
      wire('g6d-w1', 'g6d-battery', 'g6d-plate'),
      wire('g6d-w2', 'g6d-plate', 'g6d-laser'),
      wire('g6d-w3', 'g6d-red', 'g6d-and', 'a'),
      wire('g6d-w4', 'g6d-blue', 'g6d-and', 'b'),
      wire('g6d-w5', 'g6d-and', 'g6d-toaster'),
    ],
    inventory: [
      { type: 'plank', count: 2 },
      { type: 'prism', count: 1 },
      { type: 'mirror', count: 5 },
      { type: 'color_filter', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g6d-basket', count: 2, filter: { type: 'toast' }, label: 'Serve both slices of toast into the basket' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 7, elegantTime: 6.5, absurdStages: 18 },
    hints: [
      'Bolt cannot cross the gaps in his shelf. Lay a plank in each one.',
      'A prism fans white light into red, green and blue, each bent down toward its base: red least, blue most.',
      'Catch the red beam with a mirror and send it up and over to the red sensor; catch the blue one lower down and bounce it across to the blue sensor. Hold Shift for fine angles.',
    ],
    metadata: { chapter: 6, order: 4, author: 'Follyworks', blurb: 'Every colour has its place.' },
  },
  solutions: [
    { objects: breakfastBuild(), connections: [] },
    // ABSURD: a red filter on the already red beam, and a spare mirror bouncing the green beam into the funnel.
    {
      objects: breakfastBuild([o('s-red', 'color_filter', 900, 242, { color: 'red' }), o('s-green', 'mirror', 760, 603)]),
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'without the prism the white beam is neither red nor blue, so the toaster never starts',
      build: { objects: breakfastBuild().filter((x) => x.id !== 's-prism'), connections: [] },
    },
    {
      why: 'without the planks Bolt drops off his shelf long before the pressure plate',
      build: { objects: breakfastBuild().filter((x) => x.type !== 'plank'), connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 6-3: strike!

const strike: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-strike',
    name: 'Laser Bowling',
    description: 'The ball snaps the mousetrap, the trap rings the bell and the bell switches on the laser. The boxing glove only punches while both light sensors are lit. Share out the beam and bowl a strike.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6c-ramp', 'plank', 90, 140, { length: 160 }, 20 * DEG),
      o('g6c-trap-shelf', 'wall', 270, 320, { w: 120, h: 14, material: 'steel' }),
      o('g6c-shelf', 'wall', 640, 280, { w: 200, h: 14, material: 'steel' }),
      o('g6c-wall', 'wall', 480, 480, { w: 30, h: 300, material: 'brick' }),
    ],
    startingObjects: [
      o('g6c-ball', 'ball', 40, 90),
      o('g6c-trap', 'mousetrap', 268, 309),
      o('g6c-bell', 'bell', 330, 170),
      o('g6c-flipflop', 'logic_gate', 160, 400, { mode: 'toggle' }),
      o('g6c-laser', 'laser', 90, 470, { alwaysOn: false, color: 'red' }),
      o('g6c-sensor-a', 'light_sensor', 560, 120),
      o('g6c-sensor-b', 'light_sensor', 1090, 520, {}, -90 * DEG),
      o('g6c-and', 'logic_gate', 660, 400, { mode: 'and' }),
      o('g6c-glove', 'boxing_glove', 570, 256, { power: 1200 }),
      o('g6c-bowl', 'bowling_ball', 620, 253),
      ...[0, 1, 2, 3, 4, 5].map((k) => o(`g6c-pin-${k + 1}`, 'bowling_pin', 900 + 38 * k, 602)),
    ],
    connections: [
      wire('g6c-w1', 'g6c-bell', 'g6c-flipflop', 'a'),
      wire('g6c-w2', 'g6c-flipflop', 'g6c-laser'),
      wire('g6c-w3', 'g6c-sensor-a', 'g6c-and', 'a'),
      wire('g6c-w4', 'g6c-sensor-b', 'g6c-and', 'b'),
      wire('g6c-w5', 'g6c-and', 'g6c-glove'),
    ],
    inventory: [
      { type: 'mirror', count: 6 },
      { type: 'beam_splitter', count: 2 },
    ],
    goals: [{ kind: 'activate', target: { type: 'bowling_pin' }, count: 5, label: 'Knock down 5 pins' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 6, elegantTime: 3, absurdStages: 28 },
    hints: [
      'A beam splitter makes two beams out of one: half goes straight on, half turns like a mirror would.',
      'Put the splitter in the beam before the brick wall. Send one half up to the high sensor and take the other half up, over and down to the sensor on the far wall.',
    ],
    metadata: { chapter: 6, order: 3, author: 'Follyworks', blurb: 'Light up the lanes.' },
  },
  solutions: [
    {
      objects: [
        o('s-split', 'beam_splitter', 370, 470, {}, UP),
        o('s-a1', 'mirror', 370, 120, {}, UP),
        o('s-b1', 'mirror', 432, 470, {}, UP),
        o('s-b2', 'mirror', 432, 200, {}, UP),
        o('s-b3', 'mirror', 820, 200, {}, DOWN),
        o('s-b4', 'mirror', 820, 520, {}, DOWN),
      ],
      connections: [],
    },
    // ABSURD: a second splitter skims the rising beam off to the left, into a spare mirror and up into a shelf.
    {
      objects: [
        o('s-split', 'beam_splitter', 370, 470, {}, UP),
        o('s-a1', 'mirror', 370, 120, {}, UP),
        o('s-b1', 'mirror', 432, 470, {}, UP),
        o('s-split-2', 'beam_splitter', 432, 380, {}, DOWN),
        o('s-spare', 'mirror', 300, 380, {}, DOWN),
        o('s-b2', 'mirror', 432, 200, {}, UP),
        o('s-b3', 'mirror', 820, 200, {}, DOWN),
        o('s-b4', 'mirror', 820, 520, {}, DOWN),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'a mirror where the splitter goes lights only one sensor, and the glove wants both',
      build: {
        objects: [
          o('s-split', 'mirror', 370, 470, {}, UP),
          o('s-a1', 'mirror', 370, 120, {}, UP),
          o('s-b1', 'mirror', 432, 470, {}, UP),
          o('s-b2', 'mirror', 432, 200, {}, UP),
          o('s-b3', 'mirror', 820, 200, {}, DOWN),
          o('s-b4', 'mirror', 820, 520, {}, DOWN),
        ],
        connections: [],
      },
    },
  ],
};

// ---------------------------------------------------------------- 6-5: party poppers

const partyBuild = (extra: ObjectDef[] = []): ObjectDef[] => [
  o('s-bat', 'battery', 300, 600),
  o('s-m1', 'mirror', 400, 560, {}, UP),
  ...extra,
  o('s-split-1', 'beam_splitter', 400, 114, {}, UP),
  o('s-m2', 'mirror', 400, 60, {}, UP),
  o('s-m3', 'mirror', 700, 60, {}, DOWN),
  o('s-split-2', 'beam_splitter', 700, 274, {}, DOWN),
  o('s-m4', 'mirror', 700, 434, {}, DOWN),
];
const party: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-party-poppers',
    name: 'Party Poppers',
    description: 'The timer sets off the glove, the glove bops the rubber chicken, and the chicken belongs on the pressure plate. Power the plate, then split the laser three ways and pop a balloon on every shelf. Whiskers is asleep in the basement.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6e-shelf', 'plank', 190, 250, { length: 260 }),
      o('g6e-cup-l', 'wall', 446, 610, { w: 8, h: 40, material: 'steel' }),
      o('g6e-cup-r', 'wall', 534, 610, { w: 8, h: 40, material: 'steel' }),
      o('g6e-wall', 'wall', 620, 400, { w: 30, h: 460, material: 'brick' }),
      o('g6e-ceiling', 'wall', 970, 20, { w: 300, h: 40, material: 'concrete' }),
      o('g6e-floor-1', 'wall', 970, 166, { w: 300, h: 12, material: 'steel' }),
      o('g6e-floor-2', 'wall', 970, 326, { w: 300, h: 12, material: 'steel' }),
      o('g6e-floor-3', 'wall', 970, 486, { w: 300, h: 12, material: 'steel' }),
      o('g6e-basement', 'wall', 826, 561, { w: 12, h: 138, material: 'brick' }),
      o('g6e-sill-1', 'wall', 976, 145, { w: 8, h: 30, material: 'wood' }),
      o('g6e-sill-2', 'wall', 976, 305, { w: 8, h: 30, material: 'wood' }),
      o('g6e-sill-3', 'wall', 976, 465, { w: 8, h: 30, material: 'wood' }),
      o('g6e-hook-1', 'hook', 1000, 154),
      o('g6e-hook-2', 'hook', 1000, 314),
      o('g6e-hook-3', 'hook', 1000, 474),
    ],
    startingObjects: [
      o('g6e-timer', 'timer', 60, 150, { delay: 0.5 }),
      o('g6e-glove', 'boxing_glove', 92, 226, { power: 550 }),
      o('g6e-chicken', 'rubber_chicken', 150, 234),
      o('g6e-plate', 'pressure_plate', 490, 621, { minMass: 0.3 }),
      o('g6e-laser', 'laser', 90, 560, { alwaysOn: false, color: 'red' }),
      o('g6e-balloon-1', 'balloon', 1000, 114, { lift: 1.5, color: 'red' }),
      o('g6e-balloon-2', 'balloon', 1000, 274, { lift: 1.5, color: 'yellow' }),
      o('g6e-balloon-3', 'balloon', 1000, 434, { lift: 1.5, color: 'teal' }),
      o('g6e-cat', 'cat', 1000, 617, {}, 0, true),
    ],
    connections: [
      wire('g6e-w1', 'g6e-timer', 'g6e-glove'),
      wire('g6e-w2', 'g6e-plate', 'g6e-laser'),
      rope('g6e-r1', 'g6e-hook-1', 'hook', 'g6e-balloon-1', 'string'),
      rope('g6e-r2', 'g6e-hook-2', 'hook', 'g6e-balloon-2', 'string'),
      rope('g6e-r3', 'g6e-hook-3', 'hook', 'g6e-balloon-3', 'string'),
    ],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'mirror', count: 6 },
      { type: 'beam_splitter', count: 3 },
    ],
    goals: [
      { kind: 'destroyed', target: { type: 'balloon' }, label: 'Pop all three balloons' },
      { kind: 'activate', target: { id: 'g6e-cat' }, label: 'Wake up Whiskers' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 7, elegantTime: 3.5, absurdStages: 17 },
    hints: [
      'The pressure plate passes power on but makes none of its own: it needs a battery.',
      'A beam pops a balloon it rests on, but the wooden sills shield the strings. Each shelf needs its own beam at balloon height.',
      'Two beam splitters turn one beam into three. Go up past the brick wall and drop a splitter or mirror in front of each shelf.',
    ],
    metadata: { chapter: 6, order: 5, author: 'Follyworks', blurb: 'Pop, pop, POP. Yowl.' },
  },
  solutions: [
    { objects: partyBuild(), connections: [wire('s-w1', 's-bat', 'g6e-plate')] },
    // ABSURD: a third splitter on the way up throws a spare beam straight up through the room.
    {
      objects: partyBuild([o('s-split-3', 'beam_splitter', 400, 470, {}, UP), o('s-m5', 'mirror', 480, 470, {}, UP)]),
      connections: [wire('s-w1', 's-bat', 'g6e-plate')],
    },
  ],
  counterexamples: [
    {
      why: 'mirrors instead of splitters send the whole beam to one shelf',
      build: {
        objects: partyBuild().map((x) => (x.type === 'beam_splitter' ? { ...x, type: 'mirror' } : x)),
        connections: [wire('s-w1', 's-bat', 'g6e-plate')],
      },
    },
    {
      why: 'with no battery the chicken sits on a dead plate and the laser stays off',
      build: { objects: partyBuild().filter((x) => x.type !== 'battery'), connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 6-6: make a wish

const wishBuild = (extra: ObjectDef[] = []): ObjectDef[] => [
  o('s-chicken', 'rubber_chicken', 235, 602),
  o('s-ramp', 'plank', 384, 599, { length: 110 }, -25 * DEG),
  o('s-bat', 'battery', 40, 600),
  o('s-m1', 'mirror', 120, 193, {}, UP),
  o('s-m2', 'mirror', 170, 161, {}, UP),
  o('s-m3', 'mirror', 220, 129, {}, UP),
  o('s-m4', 'mirror', 270, 97, {}, UP),
  ...extra,
  o('s-lens', 'lens', 480, 151, { focal: 200 }),
];
const wishWires = [wire('s-w1', 's-bat', 'g6f-switch')];
const wish: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-make-a-wish',
    name: 'Make A Wish',
    description: 'Wake Whiskers so he scampers over the switch, and four lasers come on. Squeeze all four beams through the pinhole with a lens to light the birthday candles, and one of them boils the kettle for tea.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6f-ramp', 'plank', 90, 420, { length: 140 }, 20 * DEG),
      o('g6f-laser-shelf', 'wall', 195, 330, { w: 220, h: 12, material: 'steel' }),
      o('g6f-switch-shelf', 'wall', 520, 580, { w: 160, h: 12, material: 'steel' }),
      o('g6f-pen', 'wall', 604, 608, { w: 8, h: 44, material: 'steel' }),
      o('g6f-wall-top', 'wall', 680, 65, { w: 20, h: 130, material: 'brick' }),
      o('g6f-wall-bottom', 'wall', 680, 395, { w: 20, h: 470, material: 'brick' }),
      o('g6f-tier-1', 'wall', 1000, 98, { w: 40, h: 6, material: 'wood' }),
      o('g6f-tier-2', 'wall', 900, 157, { w: 40, h: 6, material: 'wood' }),
      o('g6f-tier-3', 'wall', 960, 197, { w: 40, h: 6, material: 'wood' }),
      o('g6f-tier-4', 'wall', 1040, 261, { w: 40, h: 6, material: 'wood' }),
      o('g6f-grill', 'wall', 1050, 212, { w: 80, h: 6, material: 'steel' }),
    ],
    startingObjects: [
      o('g6f-ball', 'ball', 40, 385),
      o('g6f-catch', 'bucket', 235, 598),
      o('g6f-cat', 'cat', 300, 617),
      o('g6f-switch', 'toggle_switch', 520, 555),
      ...[0, 1, 2, 3].map((k) => o(`g6f-laser-${k + 1}`, 'laser', 120 + 50 * k, 296, { alwaysOn: false, color: 'red' }, -90 * DEG)),
      o('g6f-candle-1', 'candle', 1000, 66, { lit: false }),
      o('g6f-candle-2', 'candle', 900, 125, { lit: false }),
      o('g6f-candle-3', 'candle', 960, 165, { lit: false }),
      o('g6f-candle-4', 'candle', 1040, 229, { lit: false }),
      o('g6f-teapot', 'teapot', 1046, 188),
    ],
    connections: [0, 1, 2, 3].map((k) => wire(`g6f-w${k + 1}`, 'g6f-switch', `g6f-laser-${k + 1}`, 'in', 'out')),
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'rubber_chicken', count: 1 },
      { type: 'plank', count: 1 },
      { type: 'mirror', count: 5 },
      { type: 'lens', count: 1 },
      { type: 'beam_splitter', count: 1 },
    ],
    goals: [
      { kind: 'activate', target: { type: 'candle' }, count: 4, label: 'Light all four birthday candles' },
      { kind: 'activate', target: { id: 'g6f-teapot' }, label: 'Boil the kettle for birthday tea' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 8, elegantTime: 4.5, absurdStages: 22 },
    hints: [
      'A squawk wakes a cat. Put the rubber chicken where the rolling ball will land on it, and give Whiskers a plank up to the switch shelf.',
      'The switch is wired to all four lasers but has no power of its own: it needs a battery. Then turn each beam right with a mirror so the four run side by side.',
      'A lens bends parallel beams so they all cross at its focal point. Put that point in the pinhole: the focal length is how far the point is from the lens.',
    ],
    metadata: { chapter: 6, order: 6, author: 'Follyworks', blurb: 'Make a wish. Then make it four times.' },
  },
  solutions: [
    { objects: wishBuild(), connections: wishWires },
    // ABSURD: a splitter skims half of one beam off underneath the lens, into a spare mirror and down onto the plank.
    { objects: wishBuild([o('s-split', 'beam_splitter', 120, 235, {}, UP), o('s-m5', 'mirror', 400, 235, {}, DOWN)]), connections: wishWires },
  ],
  counterexamples: [
    {
      why: 'without the lens only the beam that happens to line up with the pinhole gets through',
      build: { objects: wishBuild().filter((x) => x.type !== 'lens'), connections: wishWires },
    },
    {
      why: 'with no rubber chicken in the bucket the ball lands silently and Whiskers sleeps on',
      build: { objects: wishBuild().filter((x) => x.type !== 'rubber_chicken'), connections: wishWires },
    },
    {
      why: 'without a ramp Whiskers runs under the switch shelf and never flicks it',
      build: { objects: wishBuild().filter((x) => x.type !== 'plank'), connections: wishWires },
    },
  ],
};

// ---------------------------------------------------------------- 6-7: colour-coded conveyor

const dunkBuild = (extra: ObjectDef[] = []): ObjectDef[] => [
  o('s-d2', 'domino', 210, 121),
  o('s-d3', 'domino', 240, 121),
  o('s-split', 'beam_splitter', 300, 300, {}, DOWN),
  o('s-red', 'color_filter', 400, 300, { color: 'red' }),
  o('s-r1', 'mirror', 500, 300, {}, UP),
  o('s-r2', 'mirror', 500, 60, {}, UP),
  o('s-green', 'color_filter', 300, 420, { color: 'green' }, 90 * DEG),
  o('s-g1', 'mirror', 300, 520, {}, DOWN),
  o('s-g2', 'mirror', 640, 520, {}, DOWN),
  ...extra,
];
const colourCoded: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-colour-coded',
    name: 'Colour Coded',
    description: 'Finish the dominoes so they ring the bell and the bell switches on a white laser. The conveyor only rolls while the red sensor sees red AND the green sensor sees green. Share out the beam, colour each half and dunk the basketball onto the rubber chicken under the net.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6g-ramp', 'plank', 80, 100, { length: 140 }, 20 * DEG),
      o('g6g-platform', 'plank', 250, 157, { length: 300 }),
      o('g6g-kerb', 'wall', 196, 138, { w: 8, h: 24, material: 'steel' }),
    ],
    startingObjects: [
      o('g6g-bowl', 'bowling_ball', 35, 62),
      o('g6g-d1', 'domino', 176, 121),
      o('g6g-d4', 'domino', 270, 121),
      o('g6g-d5', 'domino', 300, 121),
      o('g6g-bell', 'bell', 362, 112),
      o('g6g-latch', 'timer', 420, 200, { delay: 0 }),
      o('g6g-laser', 'laser', 90, 300, { alwaysOn: false, color: 'white' }),
      o('g6g-red', 'light_sensor', 720, 60, { color: 'red' }, 90 * DEG),
      o('g6g-green', 'light_sensor', 626, 610, { color: 'green' }),
      o('g6g-and', 'logic_gate', 800, 200, { mode: 'and' }),
      o('g6g-conveyor', 'conveyor', 850, 330, { length: 300, speed: 120, dir: 'right' }),
      o('g6g-ball', 'basketball', 760, 303),
      o('g6g-hoop', 'basketball_hoop', 1080, 456, {}, 0, true),
      o('g6g-chicken', 'rubber_chicken', 1078, 619),
      o('g6g-cat', 'cat', 900, 617, {}, 0, true),
    ],
    connections: [
      wire('g6g-w1', 'g6g-bell', 'g6g-latch'),
      wire('g6g-w2', 'g6g-latch', 'g6g-laser'),
      wire('g6g-w3', 'g6g-red', 'g6g-and', 'a'),
      wire('g6g-w4', 'g6g-green', 'g6g-and', 'b'),
      wire('g6g-w5', 'g6g-and', 'g6g-conveyor'),
    ],
    inventory: [
      { type: 'domino', count: 3 },
      { type: 'beam_splitter', count: 2 },
      { type: 'color_filter', count: 3 },
      { type: 'mirror', count: 6 },
      { type: 'prism', count: 1 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g6g-hoop', count: 1, label: 'Dunk the basketball' },
      { kind: 'activate', target: { id: 'g6g-cat' }, label: 'Wake up Whiskers' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 9, elegantTime: 6, absurdStages: 26 },
    hints: [
      'Two dominoes fill the gap. One beam has to become two, and each half needs its own colour.',
      'Put a beam splitter where the white beam meets the first column. Run one half through a red filter and up to the red sensor, and the other half through a green filter and round the floor to the green sensor.',
    ],
    metadata: { chapter: 6, order: 7, author: 'Follyworks', blurb: 'Red and green means go.' },
  },
  solutions: [
    { objects: dunkBuild(), connections: [] },
    // ABSURD: tint the red twice and skim a spare beam off the riser
    { objects: dunkBuild([o('s-red2', 'color_filter', 450, 300, { color: 'red' }), o('s-split2', 'beam_splitter', 494, 200, {}, UP)]), connections: [] },
  ],
  counterexamples: [
    {
      why: 'white light is neither red nor green, so without filters the fussy sensors never wake the conveyor',
      build: { objects: dunkBuild().filter((x) => x.type !== 'color_filter'), connections: [] },
    },
    {
      why: 'a plain mirror sends all the light one way, so only one sensor ever lights',
      build: { objects: dunkBuild().map((x) => (x.id === 's-split' ? { ...x, type: 'mirror' } : x)), connections: [] },
    },
    {
      why: 'with the gap in the dominoes the bell never rings and the laser stays dark',
      build: { objects: dunkBuild().filter((x) => x.type !== 'domino'), connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 6-8: pass it on (three-laser relay)

const relayBuild = (extra: ObjectDef[] = []): ObjectDef[] => [
  o('s-bat', 'battery', 470, 600),
  o('s-a1', 'mirror', 420, 300, {}, UP),
  o('s-a2', 'mirror', 420, 60, {}, UP),
  o('s-a3', 'mirror', 700, 60, {}, DOWN),
  o('s-green', 'color_filter', 720, 330, { color: 'green' }),
  o('s-b1', 'mirror', 840, 330, {}, DOWN),
  o('s-b2', 'mirror', 840, 470, {}, DOWN),
  o('s-c1', 'mirror', 980, 380, {}, DOWN),
  o('s-c2', 'mirror', 980, 100, {}, DOWN),
  o('s-bell', 'bell', 760, 594),
  ...extra,
];
const relayWires = [wire('s-w1', 's-bat', 'g6h-switch'), wire('s-w2', 's-bell', 'g6h-glove')];
const relay: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-relay',
    name: 'Pass It On',
    description: 'The mousetrap alarm wakes Whiskers, who runs over the switch. From there three lasers pass the job along: each one lights a sensor that switches on the next, and the last burns the rope. Put the bell where the crate lands and wire it to the boxing glove for a strike.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6h-shelf', 'plank', 150, 200, { length: 300 }),
      o('g6h-pen', 'wall', 360, 600, { w: 14, h: 60, material: 'steel' }),
      o('g6h-wall', 'wall', 560, 375, { w: 30, h: 510, material: 'brick' }),
    ],
    startingObjects: [
      o('g6h-timer', 'timer', 40, 120, { delay: 0.5 }),
      o('g6h-trap', 'mousetrap', 40, 188),
      o('g6h-cat-1', 'cat', 110, 180),
      o('g6h-switch', 'toggle_switch', 250, 167),
      o('g6h-laser-a', 'laser', 50, 300, { alwaysOn: false, color: 'red' }),
      o('g6h-sensor-1', 'light_sensor', 700, 250),
      o('g6h-laser-b', 'laser', 640, 330, { alwaysOn: false, color: 'white' }),
      o('g6h-sensor-2', 'light_sensor', 930, 470, { color: 'green' }, 90 * DEG),
      o('g6h-laser-c', 'laser', 1060, 380, { alwaysOn: false, color: 'red' }, 0, true),
      o('g6h-hook', 'hook', 760, 30),
      o('g6h-crate', 'crate', 760, 200),
      o('g6h-glove', 'boxing_glove', 840, 613, { power: 1200 }),
      o('g6h-bowl', 'bowling_ball', 890, 610),
      ...[0, 1, 2, 3, 4].map((k) => o(`g6h-pin-${k + 1}`, 'bowling_pin', 950 + 38 * k, 602)),
    ],
    connections: [
      wire('g6h-w1', 'g6h-timer', 'g6h-trap'),
      wire('g6h-w2', 'g6h-switch', 'g6h-laser-a'),
      wire('g6h-w3', 'g6h-sensor-1', 'g6h-laser-b'),
      wire('g6h-w4', 'g6h-sensor-2', 'g6h-laser-c'),
      rope('g6h-r1', 'g6h-hook', 'hook', 'g6h-crate', 'hook'),
    ],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'bell', count: 1 },
      { type: 'mirror', count: 8 },
      { type: 'color_filter', count: 2 },
      { type: 'beam_splitter', count: 1 },
      { type: 'prism', count: 1 },
    ],
    goals: [
      { kind: 'activate', target: { type: 'bell' }, label: 'Ring the bell' },
      { kind: 'activate', target: { type: 'bowling_pin' }, count: 4, label: 'Knock down 4 pins' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 10, elegantTime: 4, absurdStages: 32 },
    hints: [
      'Do one laser at a time. The switch needs a battery, and the first beam has to climb over the brick wall to reach sensor 1.',
      'Laser two shines white, and sensor 2 only counts green: put a green filter in front of it, then two mirrors bring the beam down and across.',
      'Two mirrors walk the third beam up and back across the rope. The crate drops straight down, so the bell goes right under it, wired to the glove.',
    ],
    metadata: { chapter: 6, order: 8, author: 'Follyworks', blurb: 'Pass it on.' },
  },
  solutions: [
    { objects: relayBuild(), connections: relayWires },
    // ABSURD: tint the red laser red again and skim half of the last beam off sideways
    { objects: relayBuild([o('s-red', 'color_filter', 300, 300, { color: 'red' }), o('s-split', 'beam_splitter', 980, 240, {}, DOWN)]), connections: relayWires },
  ],
  counterexamples: [
    {
      why: 'white light does not count as green, so the third laser never comes on',
      build: { objects: relayBuild().filter((x) => x.id !== 's-green'), connections: relayWires },
    },
    {
      why: 'without a battery the switch has nothing to pass on, so the cat runs over it for nothing',
      build: { objects: relayBuild().filter((x) => x.id !== 's-bat'), connections: relayWires.filter((w) => w.id !== 's-w1') },
    },
    {
      why: 'a bell that is not wired to the glove just rings, and the pins stay standing',
      build: { objects: relayBuild(), connections: relayWires.filter((w) => w.id !== 's-w2') },
    },
  ],
};

// ---------------------------------------------------------------- 6-9: tripwire

const tripBuild = (extra: ObjectDef[] = []): ObjectDef[] => [
  o('s-bat', 'battery', 40, 598),
  o('s-a1', 'mirror', 200, 400, {}, UP),
  o('s-a2', 'mirror', 200, 150, {}, UP),
  o('s-filter', 'color_filter', 1060, 520, { color: 'green' }, 90 * DEG),
  o('s-b1', 'mirror', 1060, 450, {}, DOWN),
  o('s-b2', 'mirror', 764, 450, {}, UP),
  ...extra,
];
const tripwire: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-tripwire',
    name: 'Tripwire',
    description: 'Burn the rope and the crate drops on the plate, which starts the conveyor. Stretch a green beam across the ball\'s fall: the moment the ball breaks it, the NOT box fires the boxing glove and knocks the crate into the bucket.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6i-stop', 'wall', 560, 150, { w: 20, h: 60, material: 'steel' }),
      o('g6i-ledge', 'wall', 480, 487, { w: 160, h: 14, material: 'steel' }),
    ],
    startingObjects: [
      o('g6i-laser-a', 'laser', 90, 400, { alwaysOn: false, color: 'red' }),
      o('g6i-hook', 'hook', 470, 40),
      o('g6i-crate-1', 'crate', 470, 240),
      o('g6i-battery', 'battery', 230, 598),
      o('g6i-plate', 'pressure_plate', 470, 471),
      o('g6i-conveyor', 'conveyor', 800, 300, { length: 300, speed: 110, dir: 'right' }),
      o('g6i-ball', 'ball', 670, 275),
      o('g6i-laser-b', 'laser', 1060, 600, { alwaysOn: true, color: 'white' }, -90 * DEG),
      o('g6i-sensor', 'light_sensor', 764, 596, { color: 'green' }),
      o('g6i-not', 'logic_gate', 640, 200, { mode: 'not' }),
      o('g6i-glove', 'boxing_glove', 400, 446, { power: 750 }),
      o('g6i-bucket', 'bucket', 700, 590),
    ],
    connections: [
      rope('g6i-r1', 'g6i-hook', 'hook', 'g6i-crate-1', 'hook'),
      wire('g6i-w1', 'g6i-battery', 'g6i-plate'),
      wire('g6i-w2', 'g6i-plate', 'g6i-conveyor'),
      wire('g6i-w3', 'g6i-sensor', 'g6i-not', 'a'),
      wire('g6i-w4', 'g6i-not', 'g6i-glove'),
    ],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'mirror', count: 6 },
      { type: 'color_filter', count: 2 },
      { type: 'beam_splitter', count: 2 },
      { type: 'lens', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g6i-bucket', count: 1, filter: { type: 'crate' }, label: 'Punch the crate into the bucket' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 6, elegantTime: 7, absurdStages: 17 },
    hints: [
      'The red laser needs a battery. Then two mirrors take its beam over to the rope.',
      'The green sensor must be lit before RUN or the NOT box fires the glove straight away. The second laser shines white: filter it green and steer it down onto the sensor.',
      'Lay the green beam across the gap where the ball drops off the end of the conveyor.',
    ],
    metadata: { chapter: 6, order: 9, author: 'Follyworks', blurb: 'Break the beam, ring the bell.' },
  },
  solutions: [
    { objects: tripBuild(), connections: [wire('s-w1', 's-bat', 'g6i-laser-a')] },
    // ABSURD: the red beam also runs through a lens and a red filter, and a splitter peels half the green beam off into the conveyor.
    {
      objects: tripBuild([
        o('s-lens', 'lens', 330, 150, { focal: 400 }),
        o('s-red', 'color_filter', 400, 150, { color: 'red' }),
        o('s-split', 'beam_splitter', 900, 450, {}, DOWN),
        o('s-split2', 'beam_splitter', 150, 400, {}, UP),
      ]),
      connections: [wire('s-w1', 's-bat', 'g6i-laser-a')],
    },
  ],
  counterexamples: [
    {
      why: 'without the green filter the sensor never lights, so the glove punches at the start while the crate still hangs on its rope',
      build: { objects: tripBuild().filter((x) => x.id !== 's-filter'), connections: [wire('s-w1', 's-bat', 'g6i-laser-a')] },
    },
  ],
};

// ---------------------------------------------------------------- 6-10: the light show (finale)

const showBuild = (extra: ObjectDef[] = []): ObjectDef[] => [
  o('s-split-1', 'beam_splitter', 220, 560, {}, UP),
  o('s-green', 'color_filter', 220, 420, { color: 'green' }, 90 * DEG),
  o('s-m1', 'mirror', 220, 100, {}, UP),
  o('s-split-2', 'beam_splitter', 480, 560, {}, UP),
  o('s-m2', 'mirror', 480, 200, {}, UP),
  o('s-red', 'color_filter', 560, 560, { color: 'red' }),
  o('s-m3', 'mirror', 620, 560, {}, UP),
  o('s-m4', 'mirror', 620, 430, {}, UP),
  o('s-m5', 'mirror', 880, 430, {}, DOWN),
  o('s-m6', 'mirror', 1066, 60, {}, DOWN),
  ...extra,
];
const lightShow: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-light-show',
    name: 'The Light Show',
    description: 'One white laser, three jobs. Show the green sensor green so it fires the blue laser at the candle, show the red sensor red over the wall to light the lamp, and burn the rope to drop the crate in the bucket.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [o('g6j-wall', 'wall', 700, 560, { w: 30, h: 140, material: 'brick' })],
    startingObjects: [
      o('g6j-laser', 'laser', 90, 560, { alwaysOn: true, color: 'white' }),
      o('g6j-sensor-g', 'light_sensor', 560, 100, { color: 'green' }),
      o('g6j-laser-blue', 'laser', 960, 60, { alwaysOn: false, color: 'blue' }),
      o('g6j-candle', 'candle', 1060, 600, { lit: false }),
      o('g6j-hook', 'hook', 760, 40),
      o('g6j-crate', 'crate', 760, 300),
      o('g6j-bucket', 'bucket', 760, 590),
      o('g6j-sensor-r', 'light_sensor', 880, 596, { color: 'red' }),
      o('g6j-lamp', 'light_bulb', 980, 480),
    ],
    connections: [
      wire('g6j-w1', 'g6j-sensor-g', 'g6j-laser-blue'),
      wire('g6j-w2', 'g6j-sensor-r', 'g6j-lamp'),
      rope('g6j-r1', 'g6j-hook', 'hook', 'g6j-crate', 'hook'),
    ],
    inventory: [
      { type: 'mirror', count: 8 },
      { type: 'beam_splitter', count: 2 },
      { type: 'color_filter', count: 3 },
      { type: 'prism', count: 1 },
      { type: 'lens', count: 1 },
    ],
    goals: [
      { kind: 'activate', target: { id: 'g6j-candle' }, label: 'Light the candle with the blue laser' },
      { kind: 'activate', target: { id: 'g6j-lamp' }, label: 'Light the lamp' },
      { kind: 'containerCount', container: 'g6j-bucket', count: 1, filter: { type: 'crate' }, label: 'Drop the crate in the bucket' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 10, elegantTime: 4, absurdStages: 19 },
    hints: [
      'Two beam splitters make three beams out of one. Give one to each job.',
      'The sensors are fussy: white is not green and white is not red. A filter on each branch fixes that.',
      'The red branch must go up, over the wall and back down onto its sensor. The blue laser only needs one mirror to reach the candle.',
    ],
    metadata: { chapter: 6, order: 10, author: 'Follyworks', blurb: 'Every trick in the lab at once.' },
  },
  solutions: [
    { objects: showBuild(), connections: [] },
    // ABSURD: the rope beam goes through a lens on its way, and the red beam through a second red filter.
    {
      objects: showBuild([o('s-lens', 'lens', 600, 200, { focal: 400 }), o('s-red-2', 'color_filter', 660, 430, { color: 'red' })]),
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'without the filters the white beams count as neither green nor red',
      build: { objects: showBuild().filter((x) => x.id !== 's-green' && x.id !== 's-red'), connections: [] },
    },
    {
      why: 'with the red branch sent straight at the sensor the wall blocks it',
      build: {
        objects: showBuild().filter((x) => !['s-m3', 's-m4', 's-m5'].includes(x.id)).concat([o('s-m3', 'mirror', 880, 560, {}, DOWN)]),
        connections: [],
      },
    },
  ],
};

export const GROUP_6: CampaignEntry[] = [dingDong, teaTime, strike, breakfast, party, wish, colourCoded, relay, tripwire, lightShow];
