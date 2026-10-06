// Mission group 3 — Moving Parts. Motors, gears, drive belts, conveyors, winches and Bolt the
// walking robot, plus the timing of things that keep moving. See CHAPTERS in types.ts.
// Pure level data; `solutions` and `counterexamples` are test fixtures only (tests/levels).

import { STANDARD_WORLD } from '../../core/level';
import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const link = (id: string, kind: 'wire' | 'rope' | 'belt', from: string, fromPort: string, to: string, toPort: string, via?: string[]): ConnectionDef =>
  via ? { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort }, via } : { id, kind, from: { obj: from, port: fromPort }, to: { obj: to, port: toPort } };
const wire = (id: string, from: string, to: string, fromPort = 'out', toPort = 'in') => link(id, 'wire', from, fromPort, to, toPort);
const belt = (id: string, a: string, b: string) => link(id, 'belt', a, 'rotor', b, 'rotor');

// Resting heights on the floor (y = 630) for common parts.
const FLOOR = STANDARD_WORLD.height;
const BATTERY_Y = FLOOR - 28;
const MOTOR_Y = FLOOR - 24;
const BOX_Y = FLOOR - 22; // crate, Bolt, bucket

// ---------------------------------------------------------------- 3-1: gears mesh and pass the turn on

const stoppedClock: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-stopped-clock',
    name: 'The Stopped Clock',
    description: 'The motor hums, but the big clock gear on the wall is out of its reach. Bridge the gap with gears and get the clock ticking again.',
    environment: 'garage',
    world: { ...STANDARD_WORLD },
    fixedObjects: [],
    startingObjects: [
      o('g3a-battery', 'battery', 150, BATTERY_Y),
      o('g3a-motor', 'motor', 250, MOTOR_Y, { rpm: 40, dir: 'cw' }),
      o('g3a-clock', 'gear', 420, 430, { size: 'large' }),
    ],
    connections: [wire('g3a-w1', 'g3a-battery', 'g3a-motor')],
    inventory: [
      { type: 'gear', count: 3 },
      { type: 'plank', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { id: 'g3a-clock' }, duration: 1, label: 'Keep the clock gear turning for 1 second' }],
    restrictions: { timeLimit: 10 },
    bonus: { elegantParts: 2, elegantTime: 2, absurdStages: 5 },
    hints: [
      'Gears turn when their teeth touch a turning neighbour. The ring glows green when they mesh.',
      'One gear cannot reach that far. Chain two together: motor, gear, gear, clock.',
      'Stack a large gear right on top of the motor, then a second large gear between it and the clock.',
    ],
    metadata: { chapter: 3, order: 1, author: 'Follyworks', blurb: 'Teeth to teeth to teeth.' },
  },
  solutions: [
    {
      objects: [o('s-g1', 'gear', 250, 536, { size: 'large' }), o('s-g2', 'gear', 320, 459, { size: 'large' })],
      connections: [],
    },
    // ABSURD: three medium gears zig-zag up to the clock.
    {
      objects: [
        o('s-m1', 'gear', 250, 554, { size: 'medium' }),
        o('s-m2', 'gear', 314, 532, { size: 'medium' }),
        o('s-m3', 'gear', 344, 471, { size: 'medium' }),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    { why: 'a single large gear on the motor cannot reach the clock', build: { objects: [o('s-g1', 'gear', 250, 536, { size: 'large' })], connections: [] } },
  ],
};

// ---------------------------------------------------------------- 3-2: Bolt walks, steps onto low things, turns at walls

const SLAB = 560; // walking surface of the raised greenhouse floor
const aboutTurn: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-about-turn',
    name: 'About Turn, Bolt',
    description: 'Meet Bolt. He marches straight ahead until something solid turns him round, and he steps over anything no taller than his ankles. Right now he is marching the wrong way. Get him home to his charging dock.',
    environment: 'greenhouse',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3b-end', 'wall', 45, 580, { w: 90, h: 100, material: 'concrete' }),
      o('g3b-dock-floor', 'wall', 145, 610, { w: 110, h: 40, material: 'steel' }),
      o('g3b-slab-a', 'wall', 225, 595, { w: 50, h: 70, material: 'concrete' }),
      o('g3b-seat-a', 'wall', 265, 600, { w: 30, h: 60, material: 'concrete' }),
      o('g3b-seat-b', 'wall', 415, 600, { w: 30, h: 60, material: 'concrete' }),
      o('g3b-slab-b', 'wall', 665, 595, { w: 470, h: 70, material: 'concrete' }),
      o('g3b-slab-c', 'wall', 1070, 595, { w: 100, h: 70, material: 'concrete' }),
    ],
    startingObjects: [
      o('g3b-bolt', 'robot', 600, SLAB - 22, { speed: 80, awake: true }),
      o('g3b-cactus', 'cactus', 1070, SLAB - 28),
    ],
    connections: [],
    inventory: [
      { type: 'plank', count: 3 },
      { type: 'domino', count: 4 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'g3b-bolt' },
        region: { x: 90, y: 500, w: 110, h: 90 },
        hold: 2,
        label: 'Park Bolt in his charging dock for 2 seconds',
      },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 2, elegantTime: 13, absurdStages: 3 },
    hints: [
      'Bolt only turns round when he walks into something solid. The cactus would do it, but he falls in the pit first.',
      'Stand a plank on its end in his path and he will about-turn. A plank lying flat is just a step to him.',
      'Turn him round before the right-hand pit, then lay a second plank flat across the left-hand gap. The notches on either side hold it level.',
    ],
    metadata: { chapter: 3, order: 2, author: 'Follyworks', blurb: 'Left, right, left. Home.' },
  },
  solutions: [
    {
      objects: [o('s-post', 'plank', 820, SLAB - 40, { length: 80 }, Math.PI / 2), o('s-bridge', 'plank', 340, SLAB + 3, { length: 160 })],
      connections: [],
    },
    // ABSURD: Bolt bulldozes a row of dominoes on his way to the turning post.
    {
      objects: [
        o('s-d1', 'domino', 680, SLAB - 29),
        o('s-d2', 'domino', 720, SLAB - 29),
        o('s-d3', 'domino', 760, SLAB - 29),
        o('s-post', 'plank', 840, SLAB - 40, { length: 80 }, Math.PI / 2),
        o('s-bridge', 'plank', 340, SLAB + 3, { length: 160 }),
      ],
      connections: [],
    },
  ],
  counterexamples: [
    { why: 'Bolt gets a bridge but nothing turns him round', build: { objects: [o('s-bridge', 'plank', 340, SLAB + 3, { length: 160 })], connections: [] } },
    { why: 'Bolt is turned round but the gap is not bridged', build: { objects: [o('s-post', 'plank', 820, SLAB - 40, { length: 80 }, Math.PI / 2)], connections: [] } },
  ],
};

// ---------------------------------------------------------------- 3-3: a belted pulley is a winch

const winch: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-winch',
    name: 'Winch Way Up',
    description: 'This steel crate weighs as much as a small regret. Hoist it above the yellow line using the motor and the pulley on the gantry.',
    environment: 'research',
    world: { ...STANDARD_WORLD },
    fixedObjects: [o('g3c-gantry', 'wall', 640, 110, { w: 360, h: 20, material: 'steel' })],
    startingObjects: [
      o('g3c-battery', 'battery', 110, BATTERY_Y),
      o('g3c-motor', 'motor', 210, MOTOR_Y, { rpm: 60, dir: 'cw' }),
      o('g3c-pulley', 'pulley', 640, 150),
      o('g3c-crate', 'crate', 640, BOX_Y, { material: 'steel' }),
    ],
    connections: [wire('g3c-w1', 'g3c-battery', 'g3c-motor')],
    inventory: [
      { type: 'belt', count: 1 },
      { type: 'rope', count: 2 },
      { type: 'bucket', count: 1 },
      { type: 'ball', count: 2 },
      { type: 'gear', count: 2 },
    ],
    goals: [{ kind: 'height', target: { id: 'g3c-crate' }, maxY: 300, label: 'Lift the steel crate above the line' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 2, elegantTime: 5, absurdStages: 4 },
    hints: [
      'A drive belt joins two wheels so they turn together. Belt the motor to the pulley and the pulley spins.',
      'A rope tied straight to a spinning pulley’s winch drum gets wound in.',
      'Belt: motor to pulley. Rope: crate hook to the pulley’s winch drum.',
    ],
    guide: [
      { text: 'Pick the Belt in the parts bin, then click the motor and then the pulley. Belted wheels turn together.', point: { bin: 'belt' }, until: { kind: 'connect', connection: 'belt' } },
      { text: 'Now pick the Rope and tie the crate’s hook to the pulley’s winch drum.', point: { bin: 'rope' }, until: { kind: 'connect', connection: 'rope' } },
      { text: 'Press RUN and watch the winch reel the crate in.', point: { hud: 'run' }, until: { kind: 'run' } },
    ],
    metadata: { chapter: 3, order: 3, author: 'Follyworks', blurb: 'Belt, rope, up.' },
  },
  solutions: [
    {
      objects: [],
      connections: [belt('s-belt', 'g3c-motor', 'g3c-pulley'), link('s-rope', 'rope', 'g3c-crate', 'hook', 'g3c-pulley', 'drum')],
    },
    // ABSURD: the motor's turn is relayed up a two-gear tower before the belt takes it to the winch.
    {
      objects: [o('s-g1', 'gear', 210, 536, { size: 'large' }), o('s-g2', 'gear', 210, 432, { size: 'large' })],
      connections: [belt('s-belt', 's-g2', 'g3c-pulley'), link('s-rope', 'rope', 'g3c-crate', 'hook', 'g3c-pulley', 'drum')],
    },
  ],
  counterexamples: [
    {
      why: 'a bucket of rubber balls is too light to counterweight the steel crate',
      build: {
        objects: [o('s-bucket', 'bucket', 820, 400, { anchored: false }), o('s-b1', 'ball', 805, 395), o('s-b2', 'ball', 835, 395)],
        connections: [link('s-rope', 'rope', 'g3c-crate', 'hook', 's-bucket', 'handle', ['g3c-pulley'])],
      },
    },
  ],
};

// ---------------------------------------------------------------- 3-5: belts keep the direction, gears flip it

const zigZag: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-zig-zag',
    name: 'Zig and Zag',
    description: 'Both conveyors have their direction levers jammed the wrong way, so wiring them to the battery only runs them backwards. Drive them from the motor instead so the crate rides right, drops, rides left and lands in the shipping bay.',
    environment: 'maintenance',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3d-bay-wall', 'wall', 190, 570, { w: 12, h: 120, material: 'brick' }),
      o('g3d-backstop', 'wall', 900, 420, { w: 14, h: 120, material: 'steel' }),
      o('g3d-top-stop', 'wall', 206, 300, { w: 12, h: 60, material: 'steel' }),
    ],
    startingObjects: [
      o('g3d-top', 'conveyor', 400, 330, { length: 360, speed: 110, dir: 'left' }),
      o('g3d-bottom', 'conveyor', 650, 470, { length: 440, speed: 110, dir: 'right' }),
      o('g3d-crate', 'crate', 270, 297),
      o('g3d-battery', 'battery', 1050, BATTERY_Y),
      o('g3d-motor', 'motor', 950, MOTOR_Y, { rpm: 70, dir: 'cw' }),
    ],
    connections: [wire('g3d-w1', 'g3d-battery', 'g3d-motor')],
    inventory: [
      { type: 'belt', count: 2 },
      { type: 'gear', count: 2 },
      { type: 'plank', count: 1 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'g3d-crate' },
        region: { x: 200, y: 540, w: 230, h: 90 },
        hold: 0.5,
        label: 'Deliver the crate to the shipping bay',
      },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 3, elegantTime: 6, absurdStages: 5 },
    hints: [
      'A belt makes two wheels turn the same way. The motor turns clockwise, and a clockwise wheel rolls a conveyor to the right.',
      'Meshed gears turn opposite ways. A gear on the motor turns anticlockwise.',
      'Belt the motor to the top conveyor. Mesh a gear on top of the motor and belt that gear to the bottom conveyor.',
    ],
    metadata: { chapter: 3, order: 5, author: 'Follyworks', blurb: 'Clockwise, anticlockwise, shipped.' },
  },
  solutions: [
    {
      objects: [o('s-gear', 'gear', 950, 554, { size: 'medium' })],
      connections: [belt('s-b1', 'g3d-motor', 'g3d-top'), belt('s-b2', 's-gear', 'g3d-bottom')],
    },
    // ABSURD: two stacked gears relay the motor, each belted to one conveyor.
    {
      objects: [o('s-gear', 'gear', 950, 554, { size: 'medium' }), o('s-gear2', 'gear', 950, 492, { size: 'small' })],
      connections: [belt('s-b1', 's-gear2', 'g3d-top'), belt('s-b2', 's-gear', 'g3d-bottom')],
    },
  ],
  counterexamples: [
    {
      why: 'both conveyors are wired straight to the battery and run the way their jammed levers point',
      build: { objects: [], connections: [wire('s-w1', 'g3d-battery', 'g3d-top'), wire('s-w2', 'g3d-battery', 'g3d-bottom')] },
    },
    { why: 'both conveyors are belted straight to the motor and turn the same way', build: { objects: [], connections: [belt('s-b1', 'g3d-motor', 'g3d-top'), belt('s-b2', 'g3d-motor', 'g3d-bottom')] } },
  ],
};

// ---------------------------------------------------------------- 3-4: Bolt is a motor too

const robotPower: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-robot-power',
    name: 'Robot Power',
    description: 'No battery, no motor, no problem: Bolt is a walking engine. Tie him to the crate so that his march to the cactus hoists it above the line.',
    environment: 'underground',
    world: { ...STANDARD_WORLD },
    fixedObjects: [o('g3e-beam', 'wall', 760, 60, { w: 300, h: 24, material: 'steel' })],
    startingObjects: [
      o('g3e-bolt', 'robot', 200, BOX_Y, { speed: 140, awake: true }),
      o('g3e-cactus', 'cactus', 620, FLOOR - 28),
      o('g3e-crate', 'crate', 840, BOX_Y),
    ],
    connections: [],
    inventory: [
      { type: 'pulley', count: 3 },
      { type: 'rope', count: 2 },
      { type: 'ball', count: 1 },
      { type: 'domino', count: 4 },
    ],
    goals: [{ kind: 'height', target: { id: 'g3e-crate' }, maxY: 300, label: 'Hoist the crate above the line' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 3, elegantTime: 4.5, absurdStages: 3 },
    hints: [
      'Tie a rope to Bolt’s back hook and he drags it along as he walks. Pulleys turn that drag into a lift.',
      'Bolt walks right, so the rope has to leave his back towards the left. Route it round a low pulley behind him, then up over a high pulley above the crate.',
      'Low pulley on the floor to the left of Bolt, high pulley right above the crate, one rope from Bolt’s back over both to the crate’s hook.',
    ],
    metadata: { chapter: 3, order: 4, author: 'Follyworks', blurb: 'One robot-power. Approximately.' },
  },
  solutions: [
    {
      objects: [o('s-low', 'pulley', 90, 590), o('s-high', 'pulley', 840, 110)],
      connections: [link('s-rope', 'rope', 'g3e-bolt', 'back', 'g3e-crate', 'hook', ['s-low', 's-high'])],
    },
    // ABSURD: on the way Bolt bowls a ball into a pair of dominoes.
    {
      objects: [
        o('s-low', 'pulley', 90, 590),
        o('s-high', 'pulley', 840, 110),
        o('s-ball', 'ball', 236, FLOOR - 14),
        o('s-d1', 'domino', 470, FLOOR - 29),
        o('s-d2', 'domino', 510, FLOOR - 29),
      ],
      connections: [link('s-rope', 'rope', 'g3e-bolt', 'back', 'g3e-crate', 'hook', ['s-low', 's-high'])],
    },
  ],
  counterexamples: [
    {
      why: 'the rope runs straight from Bolt up over the crate pulley, so his walk slackens it',
      build: { objects: [o('s-high', 'pulley', 840, 110)], connections: [link('s-rope', 'rope', 'g3e-bolt', 'back', 'g3e-crate', 'hook', ['s-high'])] },
    },
  ],
};

// ---------------------------------------------------------------- 3-6: a winch turned backwards lets out rope

const gentleDescent: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-gentle-descent',
    name: 'Gentle Descent',
    description: 'A crate dangles from the winch over the cactus pit, and the motor only turns one way: the wrong one. Let the crate down gently and steer it onto the loading dock.',
    environment: 'basement',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3f-gantry', 'wall', 420, 70, { w: 260, h: 20, material: 'steel' }),
      o('g3f-pit-wall', 'wall', 320, 560, { w: 20, h: 140, material: 'brick' }),
      o('g3f-dock', 'wall', 805, 560, { w: 630, h: 140, material: 'brick' }),
    ],
    startingObjects: [
      o('g3f-battery', 'battery', 100, BATTERY_Y),
      o('g3f-motor', 'motor', 200, MOTOR_Y, { rpm: 60, dir: 'cw' }),
      o('g3f-winch', 'pulley', 420, 110),
      o('g3f-crate', 'crate', 420, 360),
      o('g3f-cactus', 'cactus', 420, FLOOR - 28),
    ],
    connections: [wire('g3f-w1', 'g3f-battery', 'g3f-motor'), link('g3f-rope', 'rope', 'g3f-crate', 'hook', 'g3f-winch', 'drum')],
    inventory: [
      { type: 'belt', count: 2 },
      { type: 'gear', count: 2 },
      { type: 'plank', count: 2 },
    ],
    goals: [
      {
        kind: 'enterRegion',
        target: { id: 'g3f-crate' },
        region: { x: 520, y: 400, w: 280, h: 90 },
        hold: 1,
        label: 'Set the crate down on the loading dock',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 3, elegantTime: 3.5, absurdStages: 4 },
    hints: [
      'A winch turning clockwise reels rope in. Turning anticlockwise, it lets rope out.',
      'A gear meshed with the motor turns the other way. Belt that gear to the winch.',
      'Lower the crate onto a plank sloping down towards the dock (about 25 degrees) and it slides across as the rope pays out.',
    ],
    metadata: { chapter: 3, order: 6, author: 'Follyworks', blurb: 'Reverse gear, slowly.' },
  },
  solutions: [
    {
      objects: [o('s-gear', 'gear', 200, 554, { size: 'medium' }), o('s-slide', 'plank', 495, 440, { length: 200 }, 0.44)],
      connections: [belt('s-belt', 's-gear', 'g3f-winch')],
    },
    // ABSURD: a spare gear spins along on top for the spectacle.
    {
      objects: [
        o('s-gear', 'gear', 200, 554, { size: 'medium' }),
        o('s-gear2', 'gear', 200, 498, { size: 'small' }),
        o('s-slide', 'plank', 495, 440, { length: 200 }, 0.44),
      ],
      connections: [belt('s-belt', 's-gear', 'g3f-winch')],
    },
  ],
  counterexamples: [
    {
      why: 'the winch is belted straight to the clockwise motor and reels the crate up instead',
      build: { objects: [o('s-slide', 'plank', 495, 440, { length: 200 }, 0.44)], connections: [belt('s-belt', 'g3f-motor', 'g3f-winch')] },
    },
  ],
};

// ---------------------------------------------------------------- 3-7: one motor, two jobs

const doubleShift: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-double-shift',
    name: 'Double Shift',
    description: 'One motor, two jobs. Hoist the left crate above the line with the winch, and run the conveyor (its own battery is flat) so the right crate rides left into the bay.',
    environment: 'garage',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3g-gantry', 'wall', 360, 80, { w: 200, h: 20, material: 'steel' }),
      o('g3g-bay-l', 'wall', 452, 575, { w: 12, h: 110, material: 'brick' }),
      o('g3g-bay-r', 'wall', 700, 575, { w: 12, h: 110, material: 'brick' }),
      o('g3g-stop', 'wall', 948, 370, { w: 12, h: 60, material: 'steel' }),
    ],
    startingObjects: [
      o('g3g-battery', 'battery', 80, BATTERY_Y),
      o('g3g-motor', 'motor', 180, MOTOR_Y, { rpm: 60, dir: 'cw' }),
      o('g3g-winch', 'pulley', 360, 120),
      o('g3g-crate-b', 'crate', 360, BOX_Y),
      o('g3g-conveyor', 'conveyor', 760, 400, { length: 360, speed: 110, dir: 'right' }),
      o('g3g-flat', 'battery', 1040, BATTERY_Y, { on: false }),
      o('g3g-crate-a', 'crate', 900, 367),
    ],
    connections: [wire('g3g-w1', 'g3g-battery', 'g3g-motor'), wire('g3g-w2', 'g3g-flat', 'g3g-conveyor')],
    inventory: [
      { type: 'belt', count: 3 },
      { type: 'gear', count: 2 },
      { type: 'rope', count: 1 },
      { type: 'plank', count: 1 },
    ],
    goals: [
      { kind: 'height', target: { id: 'g3g-crate-b' }, maxY: 320, label: 'Hoist the left crate above the line' },
      {
        kind: 'enterRegion',
        target: { id: 'g3g-crate-a' },
        region: { x: 458, y: 520, w: 236, h: 110 },
        hold: 0.5,
        label: 'Bring the right crate into the bay',
      },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 4, elegantTime: 5, absurdStages: 5 },
    hints: [
      'One motor can drive several belts at once, and a belt can come off a gear just as well as off the motor.',
      'The winch must turn clockwise to reel in. The conveyor must turn anticlockwise to roll left.',
      'Belt the motor to the winch and rope the left crate to its drum. Mesh a gear on the motor and belt it to the conveyor.',
    ],
    metadata: { chapter: 3, order: 7, author: 'Follyworks', blurb: 'Clockwise for one, anticlockwise for the other.' },
  },
  solutions: [
    {
      objects: [o('s-gear', 'gear', 180, 554, { size: 'medium' })],
      connections: [
        belt('s-b1', 'g3g-motor', 'g3g-winch'),
        link('s-rope', 'rope', 'g3g-crate-b', 'hook', 'g3g-winch', 'drum'),
        belt('s-b2', 's-gear', 'g3g-conveyor'),
      ],
    },
    // ABSURD: a tower of gears sorts out who turns which way.
    {
      objects: [o('s-gear', 'gear', 180, 554, { size: 'medium' }), o('s-gear2', 'gear', 180, 498, { size: 'small' })],
      connections: [
        belt('s-b1', 's-gear2', 'g3g-winch'),
        link('s-rope', 'rope', 'g3g-crate-b', 'hook', 'g3g-winch', 'drum'),
        belt('s-b2', 's-gear', 'g3g-conveyor'),
      ],
    },
  ],
  counterexamples: [
    {
      why: 'both belts come straight off the motor, so the conveyor rolls the crate the wrong way',
      build: {
        objects: [],
        connections: [belt('s-b1', 'g3g-motor', 'g3g-winch'), link('s-rope', 'rope', 'g3g-crate-b', 'hook', 'g3g-winch', 'drum'), belt('s-b2', 'g3g-motor', 'g3g-conveyor')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 3-8: timing: hit a moving bucket

const movingTarget: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-moving-target',
    name: 'Moving Target',
    description: 'Bolt is about to stroll off the wrong end of his shelf. Turn him round so he nudges the ball over the edge, get the dead conveyor running, and land the ball in the bucket before it disappears through the hatch.',
    environment: 'underground',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3h-shelf', 'wall', 290, 215, { w: 300, h: 30, material: 'wood' }),
      o('g3h-bar', 'wall', 434, 150, { w: 12, h: 30, material: 'steel' }),
      o('g3h-tunnel', 'wall', 900, 400, { w: 300, h: 280, material: 'brick' }),
    ],
    startingObjects: [
      o('g3h-bolt', 'robot', 240, 178, { speed: 80, awake: true }, 0, true),
      o('g3h-ball', 'ball', 380, 186),
      o('g3h-battery', 'battery', 70, BATTERY_Y),
      o('g3h-motor', 'motor', 180, MOTOR_Y, { rpm: 20, dir: 'ccw' }),
      o('g3h-flat', 'battery', 1080, BATTERY_Y, { on: false }),
      o('g3h-conveyor', 'conveyor', 600, 617, { length: 600, speed: 110, dir: 'left' }),
      o('g3h-bucket', 'bucket', 340, 582, { anchored: false }),
    ],
    connections: [wire('g3h-w1', 'g3h-battery', 'g3h-motor'), wire('g3h-w2', 'g3h-flat', 'g3h-conveyor')],
    inventory: [
      { type: 'plank', count: 3 },
      { type: 'belt', count: 2 },
      { type: 'gear', count: 2 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g3h-bucket', count: 1, filter: { id: 'g3h-ball' }, label: 'Land the ball in the bucket' },
      { kind: 'enterRegion', target: { id: 'g3h-bucket' }, region: { x: 760, y: 540, w: 280, h: 90 }, hold: 0.5, label: 'Send the bucket through the hatch' },
    ],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 4, elegantTime: 10, absurdStages: 7 },
    hints: [
      'Three jobs: an upright plank turns Bolt round, the conveyor needs a belt (its battery is flat), and the ball needs a ramp.',
      'The motor turns anticlockwise, which would roll the bucket the wrong way. Turn it round with a gear first.',
      'The ball drops just behind the moving bucket. A short ramp under the shelf edge, sloping down to the right, flicks it forward into the bucket.',
    ],
    metadata: { chapter: 3, order: 8, author: 'Follyworks', blurb: 'Lead the target.' },
  },
  solutions: [
    {
      objects: [
        o('s-post', 'plank', 150, 160, { length: 80 }, Math.PI / 2),
        o('s-gear', 'gear', 180, 554, { size: 'medium' }),
        o('s-ramp', 'plank', 530, 320, { length: 220 }, 0.3),
      ],
      connections: [belt('s-b', 's-gear', 'g3h-conveyor')],
    },
    // ABSURD: a spare gear spins along on top of the reversing gear.
    {
      objects: [
        o('s-post', 'plank', 150, 160, { length: 80 }, Math.PI / 2),
        o('s-gear', 'gear', 180, 554, { size: 'medium' }),
        o('s-gear2', 'gear', 180, 498, { size: 'small' }),
        o('s-ramp', 'plank', 530, 320, { length: 220 }, 0.3),
      ],
      connections: [belt('s-b', 's-gear', 'g3h-conveyor')],
    },
  ],
  counterexamples: [
    {
      why: 'the conveyor stays dead, so the bucket never leaves',
      build: { objects: [o('s-post', 'plank', 150, 160, { length: 80 }, Math.PI / 2), o('s-ramp', 'plank', 530, 320, { length: 220 }, 0.3)], connections: [] },
    },
    {
      why: 'no ramp, so the ball lands behind the bucket',
      build: { objects: [o('s-post', 'plank', 150, 160, { length: 80 }, Math.PI / 2), o('s-gear', 'gear', 180, 554, { size: 'medium' })], connections: [belt('s-b', 's-gear', 'g3h-conveyor')] },
    },
  ],
};

// ---------------------------------------------------------------- 3-9: three jobs around a running machine

const rushHour: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-rush-hour',
    name: 'Rush Hour',
    description: 'The workshop is already busy. Without jamming anything: catch both balls from the conveyor in the bucket, get the wall clock turning, and get Bolt up to his office on the top floor.',
    environment: 'research',
    world: { ...STANDARD_WORLD },
    fixedObjects: [o('g3i-upper', 'wall', 940, 465, { w: 360, h: 330, material: 'concrete' })],
    startingObjects: [
      o('g3i-battery', 'battery', 90, BATTERY_Y),
      o('g3i-motor', 'motor', 200, MOTOR_Y, { rpm: 40, dir: 'cw' }),
      o('g3i-conveyor', 'conveyor', 460, 380, { length: 360, speed: 110, dir: 'right' }),
      o('g3i-ball-a', 'ball', 330, 355),
      o('g3i-ball-b', 'ball', 400, 355),
      o('g3i-bucket', 'bucket', 520, BOX_Y),
      o('g3i-clock', 'gear', 140, 330, { size: 'large' }),
      o('g3i-bolt', 'robot', 640, BOX_Y, { speed: 70, awake: true }),
      o('g3i-cactus', 'cactus', 1050, 272),
    ],
    connections: [wire('g3i-w1', 'g3i-battery', 'g3i-motor'), belt('g3i-b1', 'g3i-motor', 'g3i-conveyor')],
    inventory: [
      { type: 'gear', count: 3 },
      { type: 'plank', count: 2 },
      { type: 'pulley', count: 2 },
      { type: 'belt', count: 1 },
      { type: 'rope', count: 1 },
    ],
    goals: [
      { kind: 'containerCount', container: 'g3i-bucket', count: 2, label: 'Catch both balls in the bucket' },
      { kind: 'activate', target: { id: 'g3i-clock' }, duration: 1, label: 'Keep the wall clock turning' },
      { kind: 'enterRegion', target: { id: 'g3i-bolt' }, region: { x: 770, y: 180, w: 330, h: 120 }, hold: 1, label: 'Get Bolt up to the top floor' },
    ],
    restrictions: { timeLimit: 25 },
    bonus: { elegantParts: 6, elegantTime: 9, absurdStages: 11 },
    hints: [
      'Three separate little jobs. The balls need a chute back to the bucket, the clock needs a gear chain, and Bolt needs a lift.',
      'Your only belt is precious: gears can reach the clock, but only a belt can turn a pulley into a winch.',
      'Two large gears stack from the motor up to the clock. A pulley just above the top floor’s edge, belted to the motor with Bolt roped to its drum, drags him up the wall.',
    ],
    metadata: { chapter: 3, order: 9, author: 'Follyworks', blurb: 'Everything, everywhere, all at once.' },
  },
  solutions: [
    {
      objects: [
        o('s-chute', 'plank', 650, 475, { length: 160 }, -0.7),
        o('s-g1', 'gear', 200, 536, { size: 'large' }),
        o('s-g2', 'gear', 170, 433, { size: 'large' }),
        o('s-winch', 'pulley', 800, 250),
      ],
      connections: [belt('s-belt', 'g3i-motor', 's-winch'), link('s-rope', 'rope', 'g3i-bolt', 'back', 's-winch', 'drum')],
    },
    // ABSURD: a spare gear spins off the side of the clock train for good measure.
    {
      objects: [
        o('s-chute', 'plank', 650, 475, { length: 160 }, -0.7),
        o('s-g1', 'gear', 200, 536, { size: 'large' }),
        o('s-g2', 'gear', 170, 433, { size: 'large' }),
        o('s-g3', 'gear', 274, 536, { size: 'small' }),
        o('s-winch', 'pulley', 800, 250),
      ],
      connections: [belt('s-belt', 'g3i-motor', 's-winch'), link('s-rope', 'rope', 'g3i-bolt', 'back', 's-winch', 'drum')],
    },
  ],
  counterexamples: [
    {
      why: 'the only belt is spent on the clock, so the winch never turns',
      build: {
        objects: [o('s-chute', 'plank', 650, 475, { length: 160 }, -0.7), o('s-winch', 'pulley', 800, 250)],
        connections: [belt('s-belt', 'g3i-motor', 'g3i-clock'), link('s-rope', 'rope', 'g3i-bolt', 'back', 's-winch', 'drum')],
      },
    },
  ],
};

// ---------------------------------------------------------------- 3-10: the whole works, start to finish

const POST = o('s-post', 'plank', 115, 120, { length: 80 }, Math.PI / 2);
const RAMP = o('s-ramp', 'plank', 430, 320, { length: 160 }, 0.2);
const GEAR = o('s-gear', 'gear', 200, 554, { size: 'medium' });
const theWorks: CampaignEntry = {
  chapter: 3,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 'g3-the-works',
    name: 'The Whole Works',
    description: 'One ball, one long trip: Bolt nudges it off his shelf, two dead conveyors carry it across the room, and it drops into the bucket, if somebody has lifted the steel plug out first. Build every bit of it.',
    environment: 'greenhouse',
    world: { ...STANDARD_WORLD },
    fixedObjects: [
      o('g3j-shelf', 'wall', 250, 175, { w: 300, h: 30, material: 'wood' }),
      o('g3j-bar', 'wall', 394, 117, { w: 12, h: 22, material: 'steel' }),
      o('g3j-deflector', 'wall', 880, 330, { w: 12, h: 190, material: 'steel' }, -0.45),
      o('g3j-backstop', 'wall', 1056, 505, { w: 12, h: 130, material: 'steel' }),
    ],
    startingObjects: [
      o('g3j-bolt', 'robot', 300, 138, { speed: 80, awake: true }, 0, true),
      o('g3j-ball', 'ball', 345, 146),
      o('g3j-battery', 'battery', 90, BATTERY_Y),
      o('g3j-motor', 'motor', 200, MOTOR_Y, { rpm: 70, dir: 'ccw' }),
      o('g3j-flat', 'battery', 600, BATTERY_Y, { on: false }),
      o('g3j-upper', 'conveyor', 620, 330, { length: 300, speed: 110, dir: 'left' }, -0.2),
      o('g3j-lower', 'conveyor', 830, 470, { length: 260, speed: 110, dir: 'left' }),
      o('g3j-winch', 'pulley', 1010, 300),
      o('g3j-plug', 'crate', 1010, 566, { material: 'steel' }),
      o('g3j-bucket', 'bucket', 1010, BOX_Y),
    ],
    connections: [
      wire('g3j-w1', 'g3j-battery', 'g3j-motor'),
      wire('g3j-w2', 'g3j-flat', 'g3j-upper'),
      wire('g3j-w3', 'g3j-flat', 'g3j-lower'),
      link('g3j-rope', 'rope', 'g3j-plug', 'hook', 'g3j-winch', 'drum'),
    ],
    inventory: [
      { type: 'plank', count: 3 },
      { type: 'gear', count: 3 },
      { type: 'belt', count: 4 },
    ],
    goals: [{ kind: 'containerCount', container: 'g3j-bucket', count: 1, filter: { id: 'g3j-ball' }, label: 'Deliver the ball into the bucket' }],
    restrictions: { timeLimit: 30 },
    bonus: { elegantParts: 6, elegantTime: 15, absurdStages: 8 },
    hints: [
      'Follow the ball’s trip: turn Bolt round, ramp the ball onto the upper conveyor, run both conveyors to the right, and reel the plug up out of the bucket.',
      'Every job here needs a clockwise turn, but the motor runs anticlockwise. Mesh one gear on the motor and take every belt from that gear.',
      'An upright plank at the left end of the shelf, a ramp under the right end down onto the upper conveyor, a gear on the motor, and three belts from the gear: upper conveyor, lower conveyor, winch.',
    ],
    metadata: { chapter: 3, order: 10, author: 'Follyworks', blurb: 'Everything you know, in a row.' },
  },
  solutions: [
    {
      objects: [POST, GEAR, RAMP],
      connections: [belt('s-b1', 's-gear', 'g3j-upper'), belt('s-b2', 's-gear', 'g3j-lower'), belt('s-b3', 's-gear', 'g3j-winch')],
    },
    // ABSURD: two spare gears whirl along beside the motor for the show.
    {
      objects: [POST, GEAR, RAMP, o('s-spare1', 'gear', 200, 498, { size: 'small' }), o('s-spare2', 'gear', 256, 554, { size: 'small' })],
      connections: [belt('s-b1', 's-gear', 'g3j-upper'), belt('s-b2', 's-gear', 'g3j-lower'), belt('s-b3', 's-gear', 'g3j-winch')],
    },
  ],
  counterexamples: [
    {
      why: 'there is no ramp and the ball drops straight off the shelf',
      build: { objects: [POST, GEAR], connections: [belt('s-b1', 's-gear', 'g3j-upper'), belt('s-b2', 's-gear', 'g3j-lower'), belt('s-b3', 's-gear', 'g3j-winch')] },
    },
    {
      why: 'the upper conveyor is left dead',
      build: { objects: [POST, GEAR, RAMP], connections: [belt('s-b2', 's-gear', 'g3j-lower'), belt('s-b3', 's-gear', 'g3j-winch')] },
    },
    {
      why: 'the lower conveyor is left dead',
      build: { objects: [POST, GEAR, RAMP], connections: [belt('s-b1', 's-gear', 'g3j-upper'), belt('s-b3', 's-gear', 'g3j-winch')] },
    },
    {
      why: 'the plug is never lifted',
      build: { objects: [POST, GEAR, RAMP], connections: [belt('s-b1', 's-gear', 'g3j-upper'), belt('s-b2', 's-gear', 'g3j-lower')] },
    },
    {
      why: 'every belt comes straight off the anticlockwise motor',
      build: { objects: [POST, RAMP], connections: [belt('s-b1', 'g3j-motor', 'g3j-upper'), belt('s-b2', 'g3j-motor', 'g3j-lower'), belt('s-b3', 'g3j-motor', 'g3j-winch')] },
    },
  ],
};

export const GROUP_3: CampaignEntry[] = [stoppedClock, aboutTurn, winch, robotPower, zigZag, gentleDescent, doubleShift, movingTarget, rushHour, theWorks];
