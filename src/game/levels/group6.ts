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
      o('g6a-ramp', 'plank', 150, 120, { length: 200 }, -16 * DEG),
      o('g6a-shelf', 'plank', 300, 300, { length: 160 }),
      o('g6a-cup', 'bucket', 412, 345),
      o('g6a-wall', 'wall', 545, 400, { w: 30, h: 460, material: 'brick' }),
      o('g6a-roof', 'wall', 980, 372, { w: 280, h: 16, material: 'steel' }),
      o('g6a-hook', 'hook', 960, 392),
    ],
    startingObjects: [
      o('g6a-ball', 'ball', 200, 81),
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
        o('s-plank', 'plank', 110, 240, { length: 200 }, 15 * DEG),
        o('s-m1', 'mirror', 480, 560, {}, UP),
        o('s-m2', 'mirror', 470, 100, {}, UP),
        o('s-m3', 'mirror', 760, 100, {}, DOWN),
        o('s-m4', 'mirror', 750, 440, {}, DOWN),
      ],
      connections: [],
    },
    // ABSURD: a splitter on the floor sends half the beam up into a spare mirror and off into the brickwork.
    {
      objects: [
        o('s-plank', 'plank', 110, 240, { length: 200 }, 15 * DEG),
        o('s-split', 'beam_splitter', 300, 560, {}, UP),
        o('s-m5', 'mirror', 300, 450, {}, UP),
        o('s-m1', 'mirror', 480, 560, {}, UP),
        o('s-m2', 'mirror', 470, 100, {}, UP),
        o('s-m3', 'mirror', 760, 100, {}, DOWN),
        o('s-m4', 'mirror', 750, 440, {}, DOWN),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'the ball misses the switch shelf without a plank, so the laser never comes on',
      build: {
        objects: [o('s-m1', 'mirror', 480, 560, {}, UP), o('s-m2', 'mirror', 470, 100, {}, UP), o('s-m3', 'mirror', 760, 100, {}, DOWN), o('s-m4', 'mirror', 750, 440, {}, DOWN)],
        connections: [],
      },
    },
    {
      why: 'a beam sent straight down onto the rope is stopped by the roof',
      build: {
        objects: [o('s-plank', 'plank', 110, 240, { length: 200 }, 15 * DEG), o('s-m1', 'mirror', 480, 560, {}, UP), o('s-m2', 'mirror', 470, 100, {}, UP), o('s-m3', 'mirror', 960, 100, {}, DOWN)],
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
      o('g6b-wall', 'wall', 500, 430, { w: 30, h: 400, material: 'brick' }),
      o('g6b-hood', 'wall', 700, 222, { w: 130, h: 12, material: 'steel' }),
      o('g6b-shelf', 'wall', 700, 300, { w: 120, h: 14, material: 'steel' }),
      o('g6b-ledge', 'wall', 810, 252, { w: 70, h: 12, material: 'steel' }),
    ],
    startingObjects: [
      o('g6b-bowl', 'bowling_ball', 40, 262),
      o('g6b-d1', 'domino', 176, 344),
      o('g6b-d2', 'domino', 210, 344),
      o('g6b-d3', 'domino', 240, 344),
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
        o('s-d4', 'domino', 270, 344),
        o('s-d5', 'domino', 300, 344),
        o('s-m1', 'mirror', 430, 560, {}, UP),
        o('s-m2', 'mirror', 420, 150, {}, UP),
        o('s-m3', 'mirror', 590, 150, {}, DOWN),
        o('s-m4', 'mirror', 580, 270, {}, DOWN),
      ],
      connections: [],
    },
    // ABSURD: a splitter peels half the beam off into a spare mirror, which fires it into the wall.
    {
      objects: [
        o('s-d4', 'domino', 270, 344),
        o('s-d5', 'domino', 300, 344),
        o('s-split', 'beam_splitter', 300, 560, {}, UP),
        o('s-m5', 'mirror', 300, 470, {}, UP),
        o('s-m1', 'mirror', 430, 560, {}, UP),
        o('s-m2', 'mirror', 420, 150, {}, UP),
        o('s-m3', 'mirror', 590, 150, {}, DOWN),
        o('s-m4', 'mirror', 580, 270, {}, DOWN),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'with the gap in the dominoes the toaster never dings, so the laser stays off',
      build: {
        objects: [o('s-m1', 'mirror', 430, 560, {}, UP), o('s-m2', 'mirror', 420, 150, {}, UP), o('s-m3', 'mirror', 590, 150, {}, DOWN), o('s-m4', 'mirror', 580, 270, {}, DOWN)],
        connections: [],
      },
    },
    {
      why: 'a beam dropped straight down onto the teapot hits its lid',
      build: {
        objects: [o('s-d4', 'domino', 270, 344), o('s-d5', 'domino', 300, 344), o('s-m1', 'mirror', 430, 560, {}, UP), o('s-m2', 'mirror', 420, 150, {}, UP), o('s-m3', 'mirror', 700, 150, {}, DOWN)],
        connections: [],
      },
    },
  ],
};

// ---------------------------------------------------------------- 6-4: rainbow breakfast

const breakfastBuild = (extra: ObjectDef[] = []): ObjectDef[] => [
  o('s-p1', 'plank', 210, 160, { length: 80 }),
  o('s-p2', 'plank', 410, 160, { length: 80 }),
  o('s-prism', 'prism', 300, 420),
  o('s-r1', 'mirror', 690, 520, {}, -30 * DEG),
  o('s-r2', 'mirror', 770, 190, {}, -30 * DEG),
  o('s-b1', 'mirror', 480, 510, {}, -30 * DEG),
  o('s-b2', 'mirror', 470, 250, {}, UP),
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
      o('g6d-shelf-1', 'plank', 90, 160, { length: 140 }),
      o('g6d-shelf-2', 'plank', 310, 160, { length: 100 }),
      o('g6d-shelf-3', 'plank', 500, 160, { length: 80 }),
      // a trough under each gap: a plank dropped in roughly still lands level enough for Bolt
      o('g6d-trough-1', 'wall', 210, 186, { w: 100, h: 12, material: 'steel' }),
      o('g6d-trough-2', 'wall', 410, 186, { w: 100, h: 12, material: 'steel' }),
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
      o('g6d-red', 'light_sensor', 1050, 265, { color: 'red' }, 45 * DEG),
      o('g6d-blue', 'light_sensor', 700, 252, { color: 'blue' }, 45 * DEG),
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
      'Catch the red beam with a mirror and send it up and over to the red sensor; catch the blue one lower down, bounce it straight up, then across to the blue sensor. Hold Shift for fine angles.',
    ],
    metadata: { chapter: 6, order: 4, author: 'Follyworks', blurb: 'Every colour has its place.' },
  },
  solutions: [
    { objects: breakfastBuild(), connections: [] },
    // ABSURD: a red filter on the already red beam, and a spare mirror bouncing the stray green beam down to the floor.
    {
      objects: breakfastBuild([o('s-red', 'color_filter', 900, 242, { color: 'red' }), o('s-green', 'mirror', 520, 280)]),
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
      o('g6c-wall', 'wall', 505, 480, { w: 30, h: 300, material: 'brick' }),
    ],
    startingObjects: [
      o('g6c-ball', 'ball', 40, 90),
      o('g6c-trap', 'mousetrap', 268, 309),
      o('g6c-bell', 'bell', 330, 170),
      o('g6c-flipflop', 'logic_gate', 160, 400, { mode: 'toggle' }),
      o('g6c-laser', 'laser', 90, 470, { alwaysOn: false, color: 'red' }),
      o('g6c-sensor-a', 'light_sensor', 560, 120, {}, 45 * DEG),
      o('g6c-sensor-b', 'light_sensor', 1090, 520, {}, 45 * DEG),
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
        o('s-split', 'beam_splitter', 390, 470, {}, UP),
        o('s-a1', 'mirror', 380, 120, {}, UP),
        o('s-b1', 'mirror', 450, 470, {}, UP),
        o('s-b2', 'mirror', 440, 200, {}, UP),
        o('s-b3', 'mirror', 820, 200, {}, DOWN),
        o('s-b4', 'mirror', 810, 520, {}, DOWN),
      ],
      connections: [],
    },
    // ABSURD: a second splitter skims the rising beam off to the left, into a spare mirror and up into a shelf.
    {
      objects: [
        o('s-split', 'beam_splitter', 390, 470, {}, UP),
        o('s-a1', 'mirror', 380, 120, {}, UP),
        o('s-b1', 'mirror', 450, 470, {}, UP),
        o('s-split-2', 'beam_splitter', 440, 380, {}, DOWN),
        o('s-spare', 'mirror', 300, 380, {}, DOWN),
        o('s-b2', 'mirror', 440, 200, {}, UP),
        o('s-b3', 'mirror', 820, 200, {}, DOWN),
        o('s-b4', 'mirror', 810, 520, {}, DOWN),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'a mirror where the splitter goes lights only one sensor, and the glove wants both',
      build: {
        objects: [
          o('s-split', 'mirror', 390, 470, {}, UP),
          o('s-a1', 'mirror', 380, 120, {}, UP),
          o('s-b1', 'mirror', 450, 470, {}, UP),
          o('s-b2', 'mirror', 440, 200, {}, UP),
          o('s-b3', 'mirror', 820, 200, {}, DOWN),
          o('s-b4', 'mirror', 810, 520, {}, DOWN),
        ],
        connections: [],
      },
    },
  ],
};

// ---------------------------------------------------------------- 6-5: party poppers

const partyBuild = (extra: ObjectDef[] = []): ObjectDef[] => [
  o('s-bat', 'battery', 260, 600),
  o('s-m1', 'mirror', 400, 560, {}, UP),
  ...extra,
  o('s-split-1', 'beam_splitter', 390, 110, {}, UP),
  o('s-m2', 'mirror', 390, 40, {}, UP),
  o('s-m3', 'mirror', 700, 40, {}, DOWN),
  o('s-split-2', 'beam_splitter', 700, 280, {}, DOWN),
  o('s-m4', 'mirror', 690, 430, {}, DOWN),
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
      // the sills reach just past each balloon's knot, so a beam anywhere across the balloon still pops it
      o('g6e-sill-1', 'wall', 976, 146, { w: 8, h: 28, material: 'wood' }),
      o('g6e-sill-2', 'wall', 976, 306.5, { w: 8, h: 27, material: 'wood' }),
      o('g6e-sill-3', 'wall', 976, 466, { w: 8, h: 28, material: 'wood' }),
      o('g6e-hook-1', 'hook', 1000, 149),
      o('g6e-hook-2', 'hook', 1000, 310),
      o('g6e-hook-3', 'hook', 1000, 469),
    ],
    startingObjects: [
      o('g6e-timer', 'timer', 60, 150, { delay: 0.5 }),
      o('g6e-glove', 'boxing_glove', 92, 226, { power: 550 }),
      o('g6e-chicken', 'rubber_chicken', 150, 234),
      o('g6e-plate', 'pressure_plate', 490, 621, { minMass: 0.3 }),
      o('g6e-laser', 'laser', 90, 559, { alwaysOn: false, color: 'red' }),
      o('g6e-balloon-1', 'balloon', 1000, 109, { lift: 1.5, color: 'red' }),
      o('g6e-balloon-2', 'balloon', 1000, 270, { lift: 1.5, color: 'yellow' }),
      o('g6e-balloon-3', 'balloon', 1000, 429, { lift: 1.5, color: 'teal' }),
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
  o('s-chicken', 'rubber_chicken', 240, 602),
  o('s-ramp', 'plank', 420, 560, { length: 130 }, -30 * DEG),
  o('s-bat', 'battery', 40, 600),
  o('s-m1', 'mirror', 110, 190, {}, UP),
  o('s-m2', 'mirror', 170, 150, {}, UP),
  o('s-m3', 'mirror', 230, 110, {}, UP),
  ...extra,
  o('s-lens', 'lens', 390, 160, { focal: 290 }),
];
const wishWires = [wire('s-w1', 's-bat', 'g6f-switch')];
const wish: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-make-a-wish',
    name: 'Make A Wish',
    description: 'Wake Whiskers so he scampers over the switch, and three lasers come on. Squeeze all three beams through the pinhole with a lens to light the birthday candles, and one of them boils the kettle for tea.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6f-ramp', 'plank', 90, 420, { length: 140 }, 20 * DEG),
      o('g6f-laser-shelf', 'wall', 195, 330, { w: 220, h: 12, material: 'steel' }),
      o('g6f-switch-shelf', 'wall', 520, 580, { w: 160, h: 12, material: 'steel' }),
      o('g6f-pen', 'wall', 604, 608, { w: 8, h: 44, material: 'steel' }),
      o('g6f-wall-top', 'wall', 680, 70, { w: 20, h: 140, material: 'brick' }),
      o('g6f-wall-bottom', 'wall', 680, 405, { w: 20, h: 450, material: 'brick' }),
      // the lens slides along this rail, so it always stands at the height of the pinhole
      o('g6f-lens-rail', 'wall', 390, 226, { w: 140, h: 10, material: 'steel' }),
      // Past the pinhole the beams fan out, and each candle fills the whole slice of the fan its
      // own beam can land in (a mirror a grid step or two off, or the lens hung a notch low),
      // stopping just short of its neighbours' slices. They step down and back so no flame
      // warms another candle; the kettle sits over the top one.
      o('g6f-tier', 'wall', 1010, 229.05, { w: 40, h: 6, material: 'wood' }),
      o('g6f-grill', 'wall', 960, 95.2, { w: 80, h: 6, material: 'steel' }),
    ],
    startingObjects: [
      o('g6f-ball', 'ball', 40, 385),
      o('g6f-catch', 'bucket', 240, 598),
      o('g6f-cat', 'cat', 300, 617),
      o('g6f-switch', 'toggle_switch', 520, 555),
      ...[110.66, 170.66, 230.66].map((x, k) => o(`g6f-laser-${k + 1}`, 'laser', x, 296, { alwaysOn: false, color: 'red' }, -90 * DEG)),
      o('g6f-candle-1', 'candle', 950, 112.2, { lit: false }),
      o('g6f-candle-2', 'candle', 980, 151.4, { lit: false }),
      o('g6f-candle-3', 'candle', 1010, 197.05, { lit: false }),
      o('g6f-teapot', 'teapot', 956, 71.2),
    ],
    connections: [0, 1, 2].map((k) => wire(`g6f-w${k + 1}`, 'g6f-switch', `g6f-laser-${k + 1}`, 'in', 'out')),
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'rubber_chicken', count: 1 },
      { type: 'plank', count: 1 },
      { type: 'mirror', count: 5 },
      { type: 'lens', count: 1 },
      { type: 'beam_splitter', count: 1 },
    ],
    goals: [
      { kind: 'activate', target: { type: 'candle' }, count: 3, label: 'Light all three birthday candles' },
      { kind: 'activate', target: { id: 'g6f-teapot' }, label: 'Boil the kettle for birthday tea' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 7, elegantTime: 4.5, absurdStages: 19 },
    hints: [
      'A squawk wakes a cat. Put the rubber chicken where the rolling ball will land on it, and give Whiskers a plank up to the switch shelf.',
      'The switch is wired to all three lasers but has no power of its own: it needs a battery. Then turn each beam right with a mirror so the three run side by side.',
      'A lens bends parallel beams so they all cross at its focal point. Put that point in the pinhole: the focal length is how far the point is from the lens.',
    ],
    metadata: { chapter: 6, order: 6, author: 'Follyworks', blurb: 'Make a wish. Then make it three times.' },
  },
  solutions: [
    { objects: wishBuild(), connections: wishWires },
    // ABSURD: a splitter skims half of one beam off underneath the lens, into a spare mirror and down onto the plank.
    { objects: wishBuild([o('s-split', 'beam_splitter', 120, 240, {}, UP), o('s-m5', 'mirror', 400, 270, {}, DOWN)]), connections: wishWires },
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
  o('s-r2', 'mirror', 490, 60, {}, UP),
  o('s-green', 'color_filter', 300, 420, { color: 'green' }, 90 * DEG),
  o('s-g1', 'mirror', 290, 520, {}, DOWN),
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
      // both photocells stand on a corner, so a beam a little high, low or wide still finds the cell
      o('g6g-red', 'light_sensor', 720, 61.3, { color: 'red' }, 45 * DEG),
      o('g6g-green', 'light_sensor', 634.6, 600, { color: 'green' }, 45 * DEG),
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
  o('s-a2', 'mirror', 410, 60, {}, UP),
  o('s-a3', 'mirror', 700, 60, {}, DOWN),
  o('s-green', 'color_filter', 720, 330, { color: 'green' }),
  o('s-b1', 'mirror', 840, 330, {}, DOWN),
  o('s-b2', 'mirror', 830, 470, {}, DOWN),
  o('s-c1', 'mirror', 980, 380, {}, DOWN),
  o('s-c2', 'mirror', 990, 100, {}, DOWN),
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
      o('g6h-sensor-1', 'light_sensor', 696, 250, {}, 45 * DEG),
      o('g6h-laser-b', 'laser', 640, 330, { alwaysOn: false, color: 'white' }),
      o('g6h-sensor-2', 'light_sensor', 930, 469, { color: 'green' }, 45 * DEG),
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
  o('s-plank', 'plank', 290, 220, { length: 80 }),
  o('s-bat', 'battery', 250, 601),
  o('s-t1', 'mirror', 200, 560, {}, UP),
  o('s-t2', 'mirror', 190, 420, {}, UP),
  o('s-green', 'color_filter', 270, 421, { color: 'green' }),
  o('s-l1', 'mirror', 800, 450, {}, UP),
  o('s-split', 'beam_splitter', 800, 300, {}, UP),
  o('s-l2', 'mirror', 790, 80, {}, UP),
  o('s-l3', 'mirror', 1090, 310, {}, UP),
  o('s-l4', 'mirror', 1090, 80, {}, DOWN),
  o('s-chicken', 'rubber_chicken', 900, 619),
  ...extra,
];
const tripWires = [wire('s-w1', 's-bat', 'g6i-laser-t')];
const tripwire: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-tripwire',
    name: 'Tripwire Toast',
    description: 'Bridge the shelf and stretch a green tripwire under the hoop. Once the sensor sees green the alarm arms, and when the dunked ball breaks the beam the toaster starts. Its DING fires a laser at two ropes: one crate for the bucket, one for a rubber chicken beside the sleeping cat.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6i-shelf', 'plank', 130, 200, { length: 220 }),
      // the ledge sits a step below the shelf, so a bridging plank anywhere in between carries the ball down
      o('g6i-ledge', 'plank', 390, 240, { length: 120 }),
      o('g6i-wall', 'wall', 620, 395, { w: 30, h: 470, material: 'brick' }),
      o('g6i-toast-shelf', 'wall', 700, 172, { w: 110, h: 12, material: 'steel' }),
      o('g6i-toast-lip', 'wall', 752, 154, { w: 6, h: 24, material: 'steel' }),
      o('g6i-divider', 'wall', 970, 125, { w: 16, h: 250, material: 'steel' }),
    ],
    startingObjects: [
      o('g6i-timer', 'timer', 40, 120, { delay: 0.5 }),
      o('g6i-glove', 'boxing_glove', 50, 176, { power: 450 }),
      o('g6i-ball', 'basketball', 110, 177),
      o('g6i-laser-t', 'laser', 40, 560, { alwaysOn: false, color: 'white' }),
      o('g6i-sensor', 'light_sensor', 580, 421, { color: 'green' }, 45 * DEG),
      o('g6i-not', 'logic_gate', 300, 290, { mode: 'not' }),
      o('g6i-arm', 'timer', 300, 360, { delay: 0 }),
      o('g6i-and', 'logic_gate', 390, 320, { mode: 'and' }),
      o('g6i-hoop', 'basketball_hoop', 530, 320, {}, 0, true),
      o('g6i-toaster', 'toaster', 690, 142, { delay: 0.6, power: 300 }),
      o('g6i-latch', 'timer', 720, 250, { delay: 0 }),
      o('g6i-laser-2', 'laser', 690, 447, { alwaysOn: false, color: 'red' }),
      o('g6i-hook-1', 'hook', 900, 20),
      o('g6i-crate-1', 'crate', 900, 200),
      o('g6i-hook-2', 'hook', 1030, 20),
      o('g6i-crate-2', 'crate', 1030, 200),
      o('g6i-bucket', 'bucket', 1030, 590),
      o('g6i-cat', 'cat', 790, 617, {}, 0, true),
    ],
    connections: [
      wire('g6i-w1', 'g6i-timer', 'g6i-glove'),
      wire('g6i-w2', 'g6i-sensor', 'g6i-not', 'a'),
      wire('g6i-w3', 'g6i-not', 'g6i-and', 'a'),
      wire('g6i-w8', 'g6i-sensor', 'g6i-arm'),
      wire('g6i-w6', 'g6i-arm', 'g6i-and', 'b'),
      wire('g6i-w7', 'g6i-and', 'g6i-toaster'),
      wire('g6i-w4', 'g6i-toaster', 'g6i-latch'),
      wire('g6i-w5', 'g6i-latch', 'g6i-laser-2'),
      rope('g6i-r1', 'g6i-hook-1', 'hook', 'g6i-crate-1', 'hook'),
      rope('g6i-r2', 'g6i-hook-2', 'hook', 'g6i-crate-2', 'hook'),
    ],
    inventory: [
      { type: 'plank', count: 1 },
      { type: 'battery', count: 1 },
      { type: 'rubber_chicken', count: 1 },
      { type: 'mirror', count: 8 },
      { type: 'color_filter', count: 2 },
      { type: 'beam_splitter', count: 2 },
      { type: 'lens', count: 1 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g6i-hoop', count: 1, label: 'Dunk the basketball' },
      { kind: 'containerCount', container: 'g6i-bucket', count: 1, filter: { type: 'crate' }, label: 'Drop a crate in the bucket' },
      { kind: 'activate', target: { id: 'g6i-cat' }, label: 'Wake up Whiskers' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 11, elegantTime: 7, absurdStages: 29 },
    hints: [
      'Bridge the gap so the ball reaches the hoop. The tripwire laser needs a battery, and the sensor only counts green.',
      'Two mirrors lift the beam under the shelves and a green filter colours it; lay it across the gap under the hoop so the falling ball breaks it.',
      'The toaster\'s laser needs a splitter: one half climbs to the first rope, the other goes round the divider to the second. The rubber chicken goes where crate one lands.',
    ],
    metadata: { chapter: 6, order: 9, author: 'Follyworks', blurb: 'Break the beam, butter the toast.' },
  },
  solutions: [
    { objects: tripBuild(), connections: tripWires },
    // ABSURD: the red laser goes through a red filter, and half the tripwire is peeled off into the shelf
    { objects: tripBuild([o('s-red', 'color_filter', 760, 450, { color: 'red' }), o('s-split-2', 'beam_splitter', 130, 560, {}, UP)]), connections: tripWires },
  ],
  counterexamples: [
    {
      why: 'a white tripwire never lights the green sensor, so the alarm never arms and the toaster stays cold',
      build: { objects: tripBuild().filter((x) => x.id !== 's-green'), connections: tripWires },
    },
    {
      why: 'without the splitter only one rope burns, so a crate stays hanging',
      build: { objects: tripBuild().filter((x) => x.id !== 's-split').concat([o('s-split', 'mirror', 800, 300, {}, UP)]), connections: tripWires },
    },
    {
      why: 'a falling crate on bare floor makes no squawk, so Whiskers sleeps on',
      build: { objects: tripBuild().filter((x) => x.id !== 's-chicken'), connections: tripWires },
    },
  ],
};

// ---------------------------------------------------------------- 6-10: the light show (finale)

const showBuild = (extra: ObjectDef[] = []): ObjectDef[] => [
  o('s-split-1', 'beam_splitter', 200, 300, {}, DOWN),
  o('s-red', 'color_filter', 260, 300, { color: 'red' }),
  o('s-r1', 'mirror', 520, 300, {}, UP),
  o('s-r2', 'mirror', 510, 40, {}, UP),
  o('s-split-2', 'beam_splitter', 200, 430, {}, DOWN),
  o('s-green', 'color_filter', 260, 420, { color: 'green' }),
  o('s-g1', 'mirror', 600, 420, {}, UP),
  o('s-g2', 'mirror', 590, 90, {}, UP),
  o('s-g3', 'mirror', 900, 90, {}, DOWN),
  o('s-w1', 'mirror', 190, 570, {}, DOWN),
  o('s-w2', 'mirror', 780, 570, {}, UP),
  o('s-w3', 'mirror', 770, 470, {}, UP),
  ...extra,
];
const lightShow: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-light-show',
    name: 'The Light Show',
    description: 'The grand finale. The dominoes ring the bell and the bell lights one white laser. Split it three ways: red for the glove and the basketball, green for the mousetrap beside one sleeping cat, and plain white through the hole to light the candle under the kettle, whose whistle wakes the other cat.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6j-ramp', 'plank', 80, 100, { length: 140 }, 20 * DEG),
      o('g6j-platform', 'plank', 250, 157, { length: 300 }),
      o('g6j-kerb', 'wall', 196, 138, { w: 8, h: 24, material: 'steel' }),
      o('g6j-wall-top', 'wall', 700, 334, { w: 30, h: 428, material: 'brick' }),
      o('g6j-wall-bottom', 'wall', 700, 611, { w: 30, h: 38, material: 'brick' }),
      o('g6j-shelf', 'plank', 850, 330, { length: 260 }),
      o('g6j-tier', 'wall', 880, 500, { w: 40, h: 6, material: 'wood' }),
      o('g6j-grill', 'wall', 890, 451, { w: 80, h: 6, material: 'steel' }),
    ],
    startingObjects: [
      o('g6j-bowl', 'bowling_ball', 35, 62),
      ...[176, 210, 240, 270, 300].map((x, k) => o(`g6j-d${k + 1}`, 'domino', x, 121)),
      o('g6j-bell', 'bell', 362, 112),
      o('g6j-latch', 'timer', 420, 200, { delay: 0 }),
      o('g6j-laser', 'laser', 60, 300, { alwaysOn: false, color: 'white' }),
      // both sensors stand on a corner so a beam can land anywhere across a 48px face
      o('g6j-red', 'light_sensor', 800, 41, { color: 'red' }, 45 * DEG),
      o('g6j-green', 'light_sensor', 897, 190, { color: 'green' }, 45 * DEG),
      o('g6j-glove', 'boxing_glove', 755, 306, { power: 300 }),
      o('g6j-ball', 'basketball', 810, 307),
      o('g6j-hoop', 'basketball_hoop', 1080, 480, {}, 0, true),
      o('g6j-trap', 'mousetrap', 350, 625),
      o('g6j-cat-1', 'cat', 480, 617),
      o('g6j-candle', 'candle', 880, 468, { lit: false }),
      o('g6j-teapot', 'teapot', 886, 427, {}, 0, true),
      o('g6j-cat-2', 'cat', 880, 617, {}, 0, true),
      o('g6j-lamp-red', 'light_bulb', 1000, 60),
      o('g6j-lamp-green', 'light_bulb', 1060, 60),
    ],
    connections: [
      wire('g6j-w1', 'g6j-bell', 'g6j-latch'),
      wire('g6j-w2', 'g6j-latch', 'g6j-laser'),
      wire('g6j-w3', 'g6j-red', 'g6j-glove'),
      wire('g6j-w4', 'g6j-green', 'g6j-trap'),
      wire('g6j-w5', 'g6j-red', 'g6j-lamp-red'),
      wire('g6j-w6', 'g6j-green', 'g6j-lamp-green'),
    ],
    inventory: [
      { type: 'beam_splitter', count: 3 },
      { type: 'color_filter', count: 3 },
      { type: 'mirror', count: 9 },
      { type: 'prism', count: 1 },
      { type: 'lens', count: 1 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g6j-hoop', count: 1, label: 'Dunk the basketball' },
      { kind: 'activate', target: { id: 'g6j-candle' }, label: 'Light the candle' },
      { kind: 'activate', target: { id: 'g6j-teapot' }, label: 'Boil the kettle' },
      { kind: 'activate', target: { type: 'cat' }, count: 2, label: 'Wake both cats' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 12, elegantTime: 7, absurdStages: 33 },
    hints: [
      'Two beam splitters turn one beam into three. Give one to each sensor and keep the last one white for the candle.',
      'Filter the top branch red and lift it over the wall to the red sensor. Filter the middle branch green and take it up, over and down onto the green sensor.',
      'The bottom branch squeezes through the hole in the wall. Two mirrors on the far side lift it to candle height, and the candle warms the kettle on the grill.',
    ],
    metadata: { chapter: 6, order: 10, author: 'Follyworks', blurb: 'Every trick in the lab at once.' },
  },
  solutions: [
    { objects: showBuild(), connections: [] },
    // ABSURD: the red beam is tinted red twice and the green beam gets a pointless extra splitter
    { objects: showBuild([o('s-red-2', 'color_filter', 400, 300, { color: 'red' }), o('s-split-3', 'beam_splitter', 750, 101, {}, UP)]), connections: [] },
  ],
  counterexamples: [
    {
      why: 'without filters the white beams count as neither red nor green, so the glove and the trap never go',
      build: { objects: showBuild().filter((x) => x.type !== 'color_filter'), connections: [] },
    },
    {
      why: 'a mirror in place of the second splitter sends everything one way, so the candle stays dark',
      build: { objects: showBuild().map((x) => (x.id === 's-split-2' ? { ...x, type: 'mirror' } : x)), connections: [] },
    },
    {
      why: 'the white beam slips through the hole but sails under the candle without the last two mirrors',
      build: { objects: showBuild().filter((x) => x.id !== 's-w2' && x.id !== 's-w3'), connections: [] },
    },
  ],
};

export const GROUP_6: CampaignEntry[] = [dingDong, teaTime, strike, breakfast, party, wish, colourCoded, relay, tripwire, lightShow];
