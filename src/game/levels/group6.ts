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

// ---------------------------------------------------------------- 6-1: round the corner

const cornerShot: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-corner-shot',
    name: 'Corner Shot',
    description: 'The laser is on, the light sensor is waiting and the bulb is wired up. There is just a wall in the way. Bounce the beam over it and down onto the sensor.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [o('g6a-divider', 'wall', 560, 440, { w: 30, h: 380, material: 'brick' })],
    startingObjects: [
      o('g6a-laser', 'laser', 100, 560, { alwaysOn: true, color: 'red' }),
      o('g6a-sensor', 'light_sensor', 800, 596),
      o('g6a-bulb', 'light_bulb', 990, 420),
    ],
    connections: [wire('g6a-w1', 'g6a-sensor', 'g6a-bulb')],
    inventory: [
      { type: 'mirror', count: 4 },
      { type: 'beam_splitter', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g6a-bulb' }, label: 'Light the bulb' }],
    restrictions: { timeLimit: 10 },
    bonus: { elegantParts: 3, elegantTime: 1, absurdStages: 7 },
    hints: [
      'A mirror turned 45° bends the beam through a right angle. Rotate parts with Q and E.',
      'Send the beam straight up before the wall, then right above it, then down onto the sensor: three mirrors.',
    ],
    metadata: { chapter: 6, order: 1, author: 'Follyworks', blurb: 'Light goes where it is told.' },
  },
  solutions: [
    {
      objects: [o('s-m1', 'mirror', 300, 560, {}, UP), o('s-m2', 'mirror', 300, 150, {}, UP), o('s-m3', 'mirror', 800, 150, {}, DOWN)],
      connections: [],
    },
    // ABSURD: a splitter on the way up sends half the light off on a pointless detour.
    {
      objects: [
        o('s-m1', 'mirror', 300, 560, {}, UP),
        o('s-split', 'beam_splitter', 300, 380, {}, UP),
        o('s-m4', 'mirror', 470, 380, {}, UP),
        o('s-m2', 'mirror', 300, 150, {}, UP),
        o('s-m3', 'mirror', 800, 150, {}, DOWN),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'two mirrors send the beam over the wall but straight past the sensor',
      build: { objects: [o('s-m1', 'mirror', 300, 560, {}, UP), o('s-m2', 'mirror', 300, 150, {}, UP)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 6-2: cut the cord

const cutTheCord: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-cut-the-cord',
    name: 'Cut The Cord',
    description: 'A laser beam is hot enough to burn through rope. Power the laser and steer its beam across the cord, and the crate drops into the bucket.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [o('g6b-wall', 'wall', 430, 465, { w: 30, h: 330, material: 'brick' })],
    startingObjects: [
      o('g6b-laser', 'laser', 100, 590, { alwaysOn: false, color: 'red' }),
      o('g6b-hook', 'hook', 820, 40),
      o('g6b-crate', 'crate', 820, 300),
      o('g6b-bucket', 'bucket', 820, 590),
    ],
    connections: [rope('g6b-r1', 'g6b-hook', 'hook', 'g6b-crate', 'hook')],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'mirror', count: 3 },
      { type: 'beam_splitter', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g6b-bucket', count: 1, label: 'Drop the crate in the bucket' }],
    restrictions: { timeLimit: 12 },
    bonus: { elegantParts: 3, elegantTime: 2, absurdStages: 6 },
    hints: [
      'This laser is not always on: wire a battery to its power socket.',
      'Rest the beam on the rope for a moment and it burns through. Two mirrors get the beam up over the wall and across the rope.',
    ],
    metadata: { chapter: 6, order: 2, author: 'Follyworks', blurb: 'Hot light, cold cut.' },
  },
  solutions: [
    {
      objects: [o('s-bat', 'battery', 30, 598), o('s-m1', 'mirror', 260, 590, {}, UP), o('s-m2', 'mirror', 260, 180, {}, UP)],
      connections: [wire('s-w1', 's-bat', 'g6b-laser')],
    },
    // ABSURD: split the beam on the way up and bounce the spare half around the room.
    {
      objects: [
        o('s-bat', 'battery', 30, 598),
        o('s-m1', 'mirror', 260, 590, {}, UP),
        o('s-split', 'beam_splitter', 260, 420, {}, UP),
        o('s-m3', 'mirror', 380, 420, {}, UP),
        o('s-m2', 'mirror', 260, 180, {}, UP),
      ],
      connections: [wire('s-w1', 's-bat', 'g6b-laser')],
    },
  ],
  counterexamples: [
    {
      why: 'the mirrors are set but the laser has no power',
      build: { objects: [o('s-m1', 'mirror', 260, 590, {}, UP), o('s-m2', 'mirror', 260, 180, {}, UP)], connections: [] },
    },
    {
      why: 'one mirror aims the beam diagonally, but the wall is too tall to shoot over',
      build: {
        objects: [o('s-bat', 'battery', 30, 598), o('s-m1', 'mirror', 380, 590, {}, -30 * DEG)],
        connections: [wire('s-w1', 's-bat', 'g6b-laser')],
      },
    },
  ],
};


// ---------------------------------------------------------------- 6-4: two balloons, one beam

const payload: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-payload',
    name: 'Special Delivery',
    description: 'Two balloons hold the bucket up against the ceiling, and either one alone could manage it. Pop both with one laser and bring the bucket down to the floor.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6c-ceiling', 'wall', 560, 20, { w: 1120, h: 40, material: 'concrete' }),
      o('g6c-divider', 'wall', 750, 95, { w: 20, h: 110, material: 'steel' }),
      o('g6c-shelf-l', 'wall', 535, 200, { w: 310, h: 16, material: 'steel' }),
      o('g6c-shelf-r', 'wall', 900, 200, { w: 180, h: 16, material: 'steel' }),
    ],
    startingObjects: [
      o('g6c-laser', 'laser', 90, 480, { alwaysOn: true, color: 'red' }),
      o('g6c-balloon-1', 'balloon', 600, 61, { lift: 2.5, color: 'red' }),
      o('g6c-balloon-2', 'balloon', 900, 61, { lift: 2.5, color: 'yellow' }),
      o('g6c-bucket', 'bucket', 750, 300, { anchored: false }),
    ],
    connections: [rope('g6c-r1', 'g6c-balloon-1', 'string', 'g6c-bucket', 'handle'), rope('g6c-r2', 'g6c-balloon-2', 'string', 'g6c-bucket', 'handle')],
    inventory: [
      { type: 'mirror', count: 5 },
      { type: 'beam_splitter', count: 1 },
    ],
    goals: [{ kind: 'enterRegion', target: { id: 'g6c-bucket' }, region: { x: 620, y: 470, w: 260, h: 160 }, label: 'Bring the bucket down to the floor' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 4, elegantTime: 4, absurdStages: 9 },
    hints: [
      'A beam resting on a balloon pops it. The shelves stop you shooting up from below, and the divider stops one beam reaching both.',
      'A beam splitter makes two beams out of one: half goes straight on, half bounces off.',
      'Split the beam low down. Take one half up the left side and across to the first balloon, the other half up the right side and back to the second.',
    ],
    metadata: { chapter: 6, order: 4, author: 'Follyworks', blurb: 'Pop, pop, plop.' },
  },
  solutions: [
    {
      objects: [
        o('s-split', 'beam_splitter', 300, 480, {}, UP),
        o('s-m1', 'mirror', 300, 70, {}, UP),
        o('s-m2', 'mirror', 1050, 480, {}, UP),
        o('s-m3', 'mirror', 1050, 70, {}, DOWN),
      ],
      connections: [],
    },
    // ABSURD: spare mirrors catch both beams once the balloons are gone.
    {
      objects: [
        o('s-split', 'beam_splitter', 300, 480, {}, UP),
        o('s-m1', 'mirror', 300, 70, {}, UP),
        o('s-m2', 'mirror', 1050, 480, {}, UP),
        o('s-m3', 'mirror', 1050, 70, {}, DOWN),
        o('s-m4', 'mirror', 705, 75, {}, DOWN),
        o('s-m5', 'mirror', 800, 75, {}, UP),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'one beam pops one balloon and the other keeps the bucket aloft',
      build: { objects: [o('s-m1', 'mirror', 300, 480, {}, UP), o('s-m2', 'mirror', 300, 61, {}, UP)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 6-3: rainbow lock

const rainbowLock: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-rainbow-lock',
    name: 'Rainbow Lock',
    description: 'The lamp only lights when the red sensor AND the blue sensor see their own colour. The laser shines white. Something has to unmix it.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [],
    startingObjects: [
      o('g6d-laser', 'laser', 90, 160, { alwaysOn: false, color: 'white' }),
      o('g6d-red', 'light_sensor', 1090, 360, { color: 'red' }, 90 * DEG),
      o('g6d-blue', 'light_sensor', 600, 80, { color: 'blue' }),
      o('g6d-logic', 'logic_gate', 900, 120, { mode: 'and' }),
      o('g6d-bulb', 'light_bulb', 1000, 110),
    ],
    connections: [wire('g6d-w1', 'g6d-red', 'g6d-logic', 'a'), wire('g6d-w2', 'g6d-blue', 'g6d-logic', 'b'), wire('g6d-w3', 'g6d-logic', 'g6d-bulb')],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'prism', count: 1 },
      { type: 'mirror', count: 4 },
      { type: 'color_filter', count: 2 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g6d-bulb' }, label: 'Light the lamp' }],
    restrictions: { timeLimit: 10 },
    bonus: { elegantParts: 4, elegantTime: 1, absurdStages: 9 },
    hints: [
      'This laser needs a battery. A prism fans white light out into red, green and blue, each bent toward the prism\'s base.',
      'Red bends least and blue most. The red beam can find its sensor on its own; one mirror can turn the blue beam up to the other.',
    ],
    metadata: { chapter: 6, order: 3, author: 'Follyworks', blurb: 'Every colour has its place.' },
  },
  solutions: [
    {
      objects: [o('s-bat', 'battery', 40, 598), o('s-prism', 'prism', 280, 160), o('s-m1', 'mirror', 600, 330, {}, -30 * DEG)],
      connections: [wire('s-w1', 's-bat', 'g6d-laser')],
    },
    // ABSURD: belt and braces, a filter of the right colour in front of each sensor.
    {
      objects: [
        o('s-bat', 'battery', 40, 598),
        o('s-prism', 'prism', 280, 160),
        o('s-m1', 'mirror', 600, 330, {}, -30 * DEG),
        o('s-fr', 'color_filter', 800, 294, { color: 'red' }),
        o('s-fb', 'color_filter', 593, 200, { color: 'blue' }, 90 * DEG),
      ],
      connections: [wire('s-w1', 's-bat', 'g6d-laser')],
    },
  ],
  counterexamples: [
    {
      why: 'white light is not blue, so a mirror alone cannot fool the blue sensor',
      build: {
        objects: [o('s-bat', 'battery', 40, 598), o('s-m1', 'mirror', 600, 160, {}, UP)],
        connections: [wire('s-w1', 's-bat', 'g6d-laser')],
      },
    },
    {
      why: 'a red filter feeds the red sensor, but nothing reaches the blue one',
      build: {
        objects: [o('s-bat', 'battery', 40, 598), o('s-fr', 'color_filter', 280, 160, { color: 'red' }), o('s-m1', 'mirror', 1090, 160, {}, DOWN)],
        connections: [wire('s-w1', 's-bat', 'g6d-laser')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 6-5: through the pinhole

const L = (id: string, x: number) => o(id, 'laser', x, 600, { alwaysOn: false, color: 'red' }, -90 * DEG);
const pinhole: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-pinhole',
    name: 'Through The Pinhole',
    description: 'Three lasers, three candles, and a wall with one tiny hole in it. Line the beams up, then let a lens squeeze all three through the hole at once.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6e-wall-top', 'wall', 760, 150, { w: 20, h: 300, material: 'brick' }),
      o('g6e-wall-bottom', 'wall', 760, 475, { w: 20, h: 310, material: 'brick' }),
      o('g6e-shelf-1', 'wall', 900, 375, { w: 40, h: 16, material: 'steel' }),
      o('g6e-shelf-2', 'wall', 1000, 281, { w: 40, h: 16, material: 'steel' }),
      o('g6e-shelf-3', 'wall', 1070, 337, { w: 40, h: 16, material: 'steel' }),
    ],
    startingObjects: [
      L('g6e-laser-1', 100),
      L('g6e-laser-2', 170),
      L('g6e-laser-3', 240),
      o('g6e-candle-1', 'candle', 900, 338, { lit: false }),
      o('g6e-candle-2', 'candle', 1000, 244, { lit: false }),
      o('g6e-candle-3', 'candle', 1070, 300, { lit: false }),
    ],
    connections: [],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'mirror', count: 4 },
      { type: 'lens', count: 1 },
      { type: 'beam_splitter', count: 1 },
    ],
    goals: [
      { kind: 'activate', target: { id: 'g6e-candle-1' }, label: 'Light the low candle' },
      { kind: 'activate', target: { id: 'g6e-candle-2' }, label: 'Light the high candle' },
      { kind: 'activate', target: { id: 'g6e-candle-3' }, label: 'Light the far candle' },
    ],
    restrictions: { timeLimit: 10 },
    bonus: { elegantParts: 5, elegantTime: 1, absurdStages: 11 },
    hints: [
      'One battery can power all three lasers: wire it to each of them.',
      "Turn each beam to the right with a mirror so they run side by side, all within the lens's height.",
      'A lens bends parallel beams so they cross at its focal point. Put that point in the hole: the focal length is how far it is from the lens.',
    ],
    metadata: { chapter: 6, order: 5, author: 'Follyworks', blurb: 'Where all beams meet.' },
  },
  solutions: [
    {
      objects: [
        o('s-bat', 'battery', 40, 598),
        o('s-m1', 'mirror', 100, 260, {}, UP),
        o('s-m2', 'mirror', 170, 310, {}, UP),
        o('s-m3', 'mirror', 240, 360, {}, UP),
        o('s-lens', 'lens', 560, 310, { focal: 200 }),
      ],
      connections: [wire('s-w1', 's-bat', 'g6e-laser-1'), wire('s-w2', 's-bat', 'g6e-laser-2'), wire('s-w3', 's-bat', 'g6e-laser-3')],
    },
    // ABSURD: a splitter skims half the middle beam off into the brickwork on the way up.
    {
      objects: [
        o('s-bat', 'battery', 40, 598),
        o('s-m1', 'mirror', 100, 260, {}, UP),
        o('s-split', 'beam_splitter', 170, 470, {}, UP),
        o('s-m4', 'mirror', 620, 470, {}, UP),
        o('s-m2', 'mirror', 170, 310, {}, UP),
        o('s-m3', 'mirror', 240, 360, {}, UP),
        o('s-lens', 'lens', 560, 310, { focal: 200 }),
      ],
      connections: [wire('s-w1', 's-bat', 'g6e-laser-1'), wire('s-w2', 's-bat', 'g6e-laser-2'), wire('s-w3', 's-bat', 'g6e-laser-3')],
    },
  ],
  counterexamples: [
    {
      why: 'without the lens only the middle beam threads the hole',
      build: {
        objects: [
          o('s-bat', 'battery', 40, 598),
          o('s-m1', 'mirror', 100, 260, {}, UP),
          o('s-m2', 'mirror', 170, 310, {}, UP),
          o('s-m3', 'mirror', 240, 360, {}, UP),
        ],
        connections: [wire('s-w1', 's-bat', 'g6e-laser-1'), wire('s-w2', 's-bat', 'g6e-laser-2'), wire('s-w3', 's-bat', 'g6e-laser-3')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 6-6: one beam, four candles

const cakeMirrors = (extra: ObjectDef[] = []): ObjectDef[] => [
  o('s-bat', 'battery', 40, 598),
  ...extra,
  o('s-sp1', 'beam_splitter', 344, 140, {}, DOWN),
  o('s-sp2', 'beam_splitter', 484, 140, {}, DOWN),
  o('s-sp3', 'beam_splitter', 624, 140, {}, DOWN),
  o('s-m1', 'mirror', 764, 140, {}, DOWN),
];
const birthday: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-birthday',
    name: 'Many Happy Returns',
    description: 'Four candles on the cake and one laser to light them all. A beam stops at the first candle it meets, so it will have to be shared out.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [o('g6f-leg-l', 'wall', 330, 597, { w: 20, h: 66, material: 'steel' }), o('g6f-leg-r', 'wall', 770, 597, { w: 20, h: 66, material: 'steel' })],
    startingObjects: [
      o('g6f-laser', 'laser', 90, 140, { alwaysOn: false, color: 'red' }),
      o('g6f-table', 'plank', 550, 557, { length: 520 }),
      o('g6f-candle-1', 'candle', 340, 521, { lit: false }),
      o('g6f-candle-2', 'candle', 480, 521, { lit: false }),
      o('g6f-candle-3', 'candle', 620, 521, { lit: false }),
      o('g6f-candle-4', 'candle', 760, 521, { lit: false }),
    ],
    connections: [],
    inventory: [
      { type: 'battery', count: 1 },
      { type: 'beam_splitter', count: 3 },
      { type: 'mirror', count: 2 },
      { type: 'color_filter', count: 1 },
    ],
    goals: [
      { kind: 'activate', target: { id: 'g6f-candle-1' }, label: 'Light candle 1' },
      { kind: 'activate', target: { id: 'g6f-candle-2' }, label: 'Light candle 2' },
      { kind: 'activate', target: { id: 'g6f-candle-3' }, label: 'Light candle 3' },
      { kind: 'activate', target: { id: 'g6f-candle-4' }, label: 'Light candle 4' },
    ],
    restrictions: { timeLimit: 12 },
    bonus: { elegantParts: 5, elegantTime: 3, absurdStages: 10 },
    hints: [
      'A mirror sends all of the beam one way. A beam splitter sends half on and half off to the side.',
      'Hang splitters along the beam above the candles, each turned to drop half its light straight down. Use a mirror over the last candle.',
      'Each split leaves a weaker beam, and a weaker beam takes longer to light a wick. Give it a couple of seconds.',
    ],
    metadata: { chapter: 6, order: 6, author: 'Follyworks', blurb: 'Make a wish. Then make it four times.' },
  },
  solutions: [
    { objects: cakeMirrors(), connections: [wire('s-w1', 's-bat', 'g6f-laser')] },
    // ABSURD: tint the beam red. It already was.
    {
      objects: cakeMirrors([o('s-filter', 'color_filter', 180, 140, { color: 'red' })]),
      connections: [wire('s-w1', 's-bat', 'g6f-laser')],
    },
  ],
  counterexamples: [
    {
      why: 'a mirror takes the whole beam, so only one candle gets any',
      build: {
        objects: [o('s-bat', 'battery', 40, 598), o('s-m1', 'mirror', 344, 140, {}, DOWN), o('s-m2', 'mirror', 484, 140, {}, DOWN)],
        connections: [wire('s-w1', 's-bat', 'g6f-laser')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 6-7: colour-coded conveyor

const colourWires = [
  wire('g6g-w1', 'g6g-red', 'g6g-logic', 'a'),
  wire('g6g-w2', 'g6g-green', 'g6g-logic', 'b'),
  wire('g6g-w3', 'g6g-logic', 'g6g-conveyor'),
];
const colourCoded: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-colour-coded',
    name: 'Colour Coded',
    description: 'The conveyor only runs while the red sensor sees red AND the green sensor sees green. Share out the white beam, colour each half, and ship the crate into the bucket. Mind the balloon.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [o('g6g-pillar', 'wall', 480, 520, { w: 60, h: 220, material: 'brick' })],
    startingObjects: [
      o('g6g-laser', 'laser', 90, 100, { alwaysOn: true, color: 'white' }),
      o('g6g-hook', 'hook', 980, 260),
      o('g6g-balloon', 'balloon', 980, 100, { lift: 1, color: 'teal' }),
      o('g6g-red', 'light_sensor', 1090, 100, { color: 'red' }, 90 * DEG),
      o('g6g-green', 'light_sensor', 560, 596, { color: 'green' }),
      o('g6g-logic', 'logic_gate', 620, 200, { mode: 'and' }),
      o('g6g-conveyor', 'conveyor', 760, 330, { length: 300, speed: 110, dir: 'right' }),
      o('g6g-crate', 'crate', 650, 297),
      o('g6g-bucket', 'bucket', 1010, 590),
    ],
    connections: [rope('g6g-r1', 'g6g-balloon', 'string', 'g6g-hook', 'hook'), ...colourWires],
    inventory: [
      { type: 'beam_splitter', count: 1 },
      { type: 'color_filter', count: 2 },
      { type: 'mirror', count: 4 },
      { type: 'prism', count: 1 },
      { type: 'lens', count: 2 },
    ],
    goals: [{ kind: 'containerCount', container: 'g6g-bucket', count: 1, label: 'Ship the crate into the bucket' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 3, elegantTime: 5, absurdStages: 13 },
    hints: [
      'A colour filter lets only its own colour through, so white light comes out red, green or blue.',
      'Split the beam: let one half run on through a red filter to the red sensor, and drop the other half through a green filter.',
      'The balloon is in the way, but a laser beam is hot. It will not be in the way for long.',
    ],
    metadata: { chapter: 6, order: 7, author: 'Follyworks', blurb: 'Red and green means go.' },
  },
  solutions: [
    {
      objects: [
        o('s-split', 'beam_splitter', 250, 100, {}, DOWN),
        o('s-fr', 'color_filter', 400, 100, { color: 'red' }),
        o('s-fg', 'color_filter', 250, 220, { color: 'green' }, 90 * DEG),
        o('s-m1', 'mirror', 250, 340, {}, DOWN),
        o('s-m2', 'mirror', 564, 340, {}, DOWN),
      ],
      connections: [],
    },
    // ABSURD: run both coloured beams through lenses, dead centre, for no reason at all.
    {
      objects: [
        o('s-split', 'beam_splitter', 250, 100, {}, DOWN),
        o('s-fr', 'color_filter', 400, 100, { color: 'red' }),
        o('s-fg', 'color_filter', 250, 220, { color: 'green' }, 90 * DEG),
        o('s-m1', 'mirror', 250, 340, {}, DOWN),
        o('s-m2', 'mirror', 564, 340, {}, DOWN),
        o('s-lens-1', 'lens', 700, 100, { focal: 400 }),
        o('s-lens-2', 'lens', 400, 330, { focal: 400 }),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'white light reaches the red sensor, but white is not red',
      build: { objects: [o('s-split', 'beam_splitter', 250, 100, {}, DOWN), o('s-fg', 'color_filter', 250, 220, { color: 'green' }, 90 * DEG), o('s-m1', 'mirror', 250, 340, {}, DOWN), o('s-m2', 'mirror', 564, 340, {}, DOWN)], connections: [] },
    },
  ],
};

// ---------------------------------------------------------------- 6-8: three-laser relay

const relayBuild = (extra: ObjectDef[] = []): ObjectDef[] => [
  o('s-a1', 'mirror', 200, 590, {}, UP),
  o('s-a2', 'mirror', 200, 300, {}, UP),
  o('s-b1', 'mirror', 360, 590, {}, DOWN),
  o('s-b2', 'mirror', 360, 100, {}, DOWN),
  o('s-filter', 'color_filter', 250, 100, { color: 'green' }),
  o('s-c1', 'mirror', 740, 590, {}, UP),
  o('s-c2', 'mirror', 740, 150, {}, UP),
  ...extra,
];
const relay: CampaignEntry = {
  chapter: 6,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g6-relay',
    name: 'Light Relay',
    description: 'Three lasers pass the job along. The first must reach sensor 1, which switches on the second; the second must show sensor 2 some green, which switches on the third; the third burns through the rope.',
    environment: 'research',
    world: WORLD(),
    fixedObjects: [
      o('g6h-wall', 'wall', 300, 505, { w: 20, h: 250, material: 'brick' }),
      o('g6h-pillar', 'wall', 500, 473, { w: 30, h: 314, material: 'brick' }),
    ],
    startingObjects: [
      o('g6h-laser-a', 'laser', 90, 590, { alwaysOn: true, color: 'red' }),
      o('g6h-sensor-1', 'light_sensor', 500, 299),
      o('g6h-laser-b', 'laser', 440, 590, { alwaysOn: false, color: 'white' }, 0, true),
      o('g6h-sensor-2', 'light_sensor', 30, 100, { color: 'green' }, -90 * DEG),
      o('g6h-laser-c', 'laser', 650, 590, { alwaysOn: false, color: 'red' }),
      o('g6h-hook', 'hook', 860, 40),
      o('g6h-crate', 'crate', 860, 260),
      o('g6h-bucket', 'bucket', 860, 590),
    ],
    connections: [
      wire('g6h-w1', 'g6h-sensor-1', 'g6h-laser-b'),
      wire('g6h-w2', 'g6h-sensor-2', 'g6h-laser-c'),
      rope('g6h-r1', 'g6h-hook', 'hook', 'g6h-crate', 'hook'),
    ],
    inventory: [
      { type: 'mirror', count: 8 },
      { type: 'color_filter', count: 1 },
      { type: 'beam_splitter', count: 1 },
      { type: 'prism', count: 1 },
    ],
    goals: [{ kind: 'containerCount', container: 'g6h-bucket', count: 1, label: 'Drop the crate in the bucket' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 6, elegantTime: 2, absurdStages: 15 },
    hints: [
      'Do one laser at a time. The first one is already on: get its beam over the brick wall and onto sensor 1.',
      'The second laser shines white, and sensor 2 only counts green. A green filter, or a prism, takes care of that.',
      'The third laser comes on once sensor 2 is happy. Send its beam across the rope above the crate.',
    ],
    metadata: { chapter: 6, order: 8, author: 'Follyworks', blurb: 'Pass it on.' },
  },
  solutions: [
    { objects: relayBuild(), connections: [] },
    // ABSURD: the first beam is split, and the spare half pointlessly lights a lens and a prism.
    {
      objects: relayBuild([
        o('s-split', 'beam_splitter', 200, 450, {}, UP),
        o('s-prism', 'prism', 255, 450),
      ]),
      connections: [],
    },
  ],
  counterexamples: [
    {
      why: 'white light does not count as green',
      build: { objects: relayBuild().filter((x) => x.id !== 's-filter'), connections: [] },
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

export const GROUP_6: CampaignEntry[] = [cornerShot, cutTheCord, rainbowLock, payload, pinhole, birthday, colourCoded, relay, tripwire, lightShow];
