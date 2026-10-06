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
        o('s-m1', 'mirror', 300, 61, {}, UP),
        o('s-m2', 'mirror', 1050, 480, {}, UP),
        o('s-m3', 'mirror', 1050, 61, {}, DOWN),
      ],
      connections: [],
    },
    // ABSURD: spare mirrors catch both beams once the balloons are gone.
    {
      objects: [
        o('s-split', 'beam_splitter', 300, 480, {}, UP),
        o('s-m1', 'mirror', 300, 61, {}, UP),
        o('s-m2', 'mirror', 1050, 480, {}, UP),
        o('s-m3', 'mirror', 1050, 61, {}, DOWN),
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

export const GROUP_6: CampaignEntry[] = [cornerShot, cutTheCord, rainbowLock, payload, pinhole];
