// Orientation: six short tutorial missions, each one idea bigger than the last, with optional
// step-by-step guidance (see GuideStep in core/types.ts). Each should take well under a minute.
// Pure level data; `solutions` are test fixtures only (validated in tests/levels/campaign.test.ts).

import { STANDARD_WORLD } from '../../core/level';
import { LEVEL_SCHEMA_VERSION, type ConnectionDef, type ObjectDef, type Props } from '../../core/types';
import type { CampaignEntry } from './types';

const o = (id: string, type: string, x: number, y: number, props: Props = {}, angle = 0, flip = false): ObjectDef =>
  flip ? { id, type, x, y, angle, flip, props } : { id, type, x, y, angle, props };
const wire = (id: string, from: string, fromPort: string, to: string, toPort: string): ConnectionDef => ({
  id,
  kind: 'wire',
  from: { obj: from, port: fromPort },
  to: { obj: to, port: toPort },
});

const WORLD = { ...STANDARD_WORLD };
/** One rotate-button press with snap on. */
const NOTCH = Math.PI / 12;
const meta = (order: number, blurb: string) => ({ chapter: 0, order, tutorial: true, author: 'Follyworks', blurb });

// ---------------------------------------------------------------- T1: place one thing, press RUN

const t1: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't1-first-drop',
    name: 'First Drop',
    description: 'Every great machine starts with something falling. Put the rubber ball above the toy box and press RUN.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t1-box-l', 'wall', 500, 575, { w: 16, h: 110, material: 'wood' }),
      o('t1-box-r', 'wall', 660, 575, { w: 16, h: 110, material: 'wood' }),
    ],
    startingObjects: [],
    connections: [],
    inventory: [{ type: 'ball', count: 1 }],
    goals: [{ kind: 'enterRegion', target: { type: 'ball' }, region: { x: 508, y: 520, w: 144, h: 110 }, hold: 1, label: 'Get the ball into the toy box' }],
    restrictions: { timeLimit: 10 },
    bonus: { elegantParts: 1, elegantTime: 3, absurdStages: 0 },
    hints: ['Things fall straight down. Put the ball right above the toy box, then press RUN.'],
    guide: [
      {
        text: 'Drag the Rubber Ball out of the parts bin and drop it on the glowing outline.',
        point: { bin: 'ball' },
        ghost: { type: 'ball', x: 580, y: 300 },
        until: { kind: 'place', type: 'ball', at: { x: 580, y: 300 }, radius: 90 },
      },
      { text: 'Press RUN to start time. (Press it again, or Space, to reset and try again.)', point: { hud: 'run' }, until: { kind: 'run' } },
    ],
    metadata: meta(1, 'Place one thing. Press RUN. Feel powerful.'),
  },
  solutions: [{ objects: [o('ball-a', 'ball', 580, 300)], connections: [] }],
};

// ---------------------------------------------------------------- T2: rotate a part

const t2: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't2-ramp-it-up',
    name: 'Ramp It Up',
    description: 'The ball drops straight out of the chute and goes nowhere. Tilt a plank under it so it rolls all the way across to the loading bay.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t2-chute-l', 'wall', 164, 90, { w: 12, h: 150, material: 'steel' }),
      o('t2-chute-r', 'wall', 216, 90, { w: 12, h: 150, material: 'steel' }),
      o('t2-bay-wall', 'wall', 1060, 555, { w: 20, h: 150, material: 'brick' }),
    ],
    startingObjects: [o('t2-ball', 'ball', 190, 120)],
    connections: [],
    inventory: [{ type: 'plank', count: 2 }],
    goals: [{ kind: 'enterRegion', target: { id: 't2-ball' }, region: { x: 820, y: 520, w: 230, h: 110 }, label: 'Roll the ball into the loading bay' }],
    restrictions: { timeLimit: 12 },
    bonus: { elegantParts: 1, elegantTime: 4, absurdStages: 0 },
    hints: ['A plank does not have to be flat. Rotate it to make a slope.', 'Put a plank under the chute, sloping down to the right.'],
    guide: [
      {
        text: 'Drag a Plank out of the parts bin onto the outline under the chute.',
        point: { bin: 'plank' },
        ghost: { type: 'plank', x: 290, y: 330, angle: NOTCH, props: { length: 300 } },
        until: { kind: 'place', type: 'plank', at: { x: 290, y: 330 }, radius: 90 },
      },
      {
        text: 'Planks start flat. With your plank selected, press the rotate button (or E) to tilt it like the outline.',
        point: { hud: 'rotate' },
        ghost: { type: 'plank', x: 290, y: 330, angle: NOTCH, props: { length: 300 } },
        until: { kind: 'place', type: 'plank', at: { x: 290, y: 330 }, radius: 110, angle: NOTCH, angleTol: 0.14 },
      },
      { text: 'Press RUN and watch it roll.', point: { hud: 'run' }, until: { kind: 'run' } },
    ],
    metadata: meta(2, 'Planks: the original redirect.'),
  },
  solutions: [
    { objects: [o('plank-a', 'plank', 290, 330, { length: 300 }, NOTCH)], connections: [] },
  ],
};

// ---------------------------------------------------------------- T3: start a chain reaction

const t3: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't3-knock-on',
    name: 'Knock-On Effect',
    description: 'You may not touch the red ball, but you can certainly hit it with something. Send a ball rolling along the shelf to knock it into the bucket.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t3-shelf', 'wall', 640, 400, { w: 440, h: 14, material: 'wood' }),
      o('t3-post', 'wall', 500, 518, { w: 16, h: 222, material: 'wood' }),
      o('t3-bucket', 'bucket', 930, 608),
    ],
    startingObjects: [o('t3-target', 'ball', 820, 379)],
    connections: [],
    inventory: [
      { type: 'ball', count: 1 },
      { type: 'plank', count: 2 },
    ],
    goals: [{ kind: 'containerCount', container: 't3-bucket', count: 1, filter: { id: 't3-target' }, label: 'Knock the red ball into the bucket' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 2, elegantTime: 4, absurdStages: 0 },
    hints: ['A ball dropped onto a sloped plank arrives rolling, and passes its speed on to whatever it hits.', 'Put a plank sloping down onto the left end of the shelf, and drop the ball onto the plank.'],
    guide: [
      {
        text: 'Place a Plank as a ramp leading down onto the shelf, and tilt it to match the outline.',
        point: { bin: 'plank' },
        ghost: { type: 'plank', x: 330, y: 340, angle: NOTCH, props: { length: 240 } },
        until: { kind: 'place', type: 'plank', at: { x: 330, y: 340 }, radius: 90, angle: NOTCH, angleTol: 0.3 },
      },
      {
        text: 'Now drop the Rubber Ball on the top of the ramp.',
        point: { bin: 'ball' },
        ghost: { type: 'ball', x: 240, y: 260 },
        until: { kind: 'place', type: 'ball' },
      },
      { text: 'RUN it. If it misses, reset, nudge a part and go again: that is the whole game.', point: { hud: 'run' }, until: { kind: 'run' } },
    ],
    metadata: meta(3, 'Cause, meet effect.'),
  },
  solutions: [
    { objects: [o('plank-a', 'plank', 330, 340, { length: 240 }, NOTCH), o('ball-a', 'ball', 240, 260)], connections: [] },
  ],
};

// ---------------------------------------------------------------- T4: things can switch things on

const t4: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't4-lights-on',
    name: 'Lights On',
    description: 'The battery is already wired to the bulb through a switch. Switches flip ON when something rolls through them left to right. Light the bulb.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t4-battery', 'battery', 760, 601),
      o('t4-switch', 'toggle_switch', 560, 602),
      o('t4-bulb', 'light_bulb', 900, 330),
      o('t4-shelf', 'wall', 900, 375, { w: 100, h: 14, material: 'wood' }),
    ],
    startingObjects: [],
    connections: [wire('t4-w1', 't4-battery', 'out', 't4-switch', 'in'), wire('t4-w2', 't4-switch', 'out', 't4-bulb', 'in')],
    inventory: [
      { type: 'ball', count: 1 },
      { type: 'plank', count: 1 },
      { type: 'trampoline', count: 1 },
    ],
    goals: [{ kind: 'activate', target: { id: 't4-bulb' }, label: 'Light the bulb' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 2, elegantTime: 3, absurdStages: 0 },
    hints: ['A ball dropped onto the floor just bounces in place. It needs to be moving right when it reaches the switch.', 'Drop the ball onto a plank that slopes down to the floor, left of the switch.'],
    guide: [
      {
        text: 'The switch only cares about things moving right. Build a ramp that ends on the floor left of the switch.',
        point: { bin: 'plank' },
        ghost: { type: 'plank', x: 330, y: 560, angle: NOTCH, props: { length: 300 } },
        until: { kind: 'place', type: 'plank', at: { x: 330, y: 560 }, radius: 110, angle: NOTCH, angleTol: 0.3 },
      },
      { text: 'Add the ball at the top of your ramp.', point: { bin: 'ball' }, ghost: { type: 'ball', x: 220, y: 440 }, until: { kind: 'place', type: 'ball' } },
      { text: 'RUN, and watch the wires light up as power flows.', point: { hud: 'run' }, until: { kind: 'run' } },
    ],
    metadata: meta(4, 'Power flows when the switch says so.'),
  },
  solutions: [
    { objects: [o('plank-a', 'plank', 330, 560, { length: 300 }, NOTCH), o('ball-a', 'ball', 220, 440)], connections: [] },
    { objects: [o('plank-a', 'plank', 380, 580, { length: 200 }, NOTCH), o('ball-a', 'ball', 320, 300)], connections: [] },
  ],
};

// ---------------------------------------------------------------- T5: draw a wire

const t5: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't5-wire-it-up',
    name: 'Wire It Up',
    description: 'The ball will flip the switch on its own, but the fan is not connected to anything. Wire the switch to the fan so it blows the beach ball into the corner.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t5-ramp', 'plank', 250, 572, { length: 320 }, NOTCH),
      o('t5-battery', 'battery', 540, 601),
      o('t5-switch', 'toggle_switch', 455, 602),
      o('t5-fan', 'fan', 620, 462, { strength: 4, range: 300 }),
      o('t5-shelf', 'wall', 720, 505, { w: 260, h: 14, material: 'wood' }),
      o('t5-backstop', 'wall', 1060, 555, { w: 20, h: 150, material: 'brick' }),
    ],
    startingObjects: [o('t5-ball', 'ball', 130, 480), o('t5-target', 'ball', 740, 484)],
    connections: [wire('t5-w1', 't5-battery', 'out', 't5-switch', 'in')],
    inventory: [{ type: 'wire', count: -1 }],
    goals: [{ kind: 'enterRegion', target: { id: 't5-target' }, region: { x: 900, y: 520, w: 150, h: 110 }, label: 'Blow the beach ball into the corner' }],
    restrictions: { timeLimit: 15 },
    bonus: { elegantParts: 0, elegantTime: 4, absurdStages: 0 },
    hints: ['Power flows out of orange OUT sockets and into cyan IN sockets. Wires are free.', 'Pick the wire, click the switch’s orange OUT socket, then click the fan’s cyan IN socket.'],
    guide: [
      {
        text: 'Pick the Wire, click the switch’s orange OUT socket, then click the fan’s cyan IN socket. Wires are free.',
        point: { bin: 'wire' },
        until: { kind: 'connect', connection: 'wire' },
      },
      { text: 'Now RUN. When the ball flips the switch, power flows down your wire into the fan.', point: { hud: 'run' }, until: { kind: 'run' } },
    ],
    metadata: meta(5, 'Orange out, cyan in.'),
  },
  solutions: [{ objects: [], connections: [wire('wire-a', 't5-switch', 'out', 't5-fan', 'in')] }],
};

// ---------------------------------------------------------------- T6: a tiny real machine

const t6: CampaignEntry = {
  chapter: 0,
  level: {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: 't6-tiny-machine',
    name: 'The Tiny Machine',
    description: 'Your first real contraption, no hand-holding: roll a ball through the switch, wire the switch to the fan, and blow the little ball off the shelf into the bin.',
    environment: 'garage',
    world: WORLD,
    fixedObjects: [
      o('t6-battery', 'battery', 120, 601),
      o('t6-switch', 'toggle_switch', 320, 389, {}, NOTCH),
      o('t6-shelf', 'wall', 700, 400, { w: 240, h: 14, material: 'wood' }),
      o('t6-fan', 'fan', 610, 357, { strength: 3, range: 300 }),
      o('t6-bin-l', 'wall', 900, 575, { w: 14, h: 110, material: 'wood' }),
      o('t6-bin-r', 'wall', 1040, 575, { w: 14, h: 110, material: 'wood' }),
    ],
    startingObjects: [o('t6-ball', 'ball', 700, 379)],
    connections: [wire('t6-w1', 't6-battery', 'out', 't6-switch', 'in')],
    inventory: [
      { type: 'ball', count: 1 },
      { type: 'plank', count: 2 },
      { type: 'wire', count: -1 },
    ],
    goals: [{ kind: 'enterRegion', target: { id: 't6-ball' }, region: { x: 907, y: 520, w: 126, h: 110 }, hold: 0.5, label: 'Blow the shelf ball into the bin' }],
    restrictions: { timeLimit: 20 },
    bonus: { elegantParts: 2, elegantTime: 4, absurdStages: 0 },
    hints: [
      'The fan only blows while it has power, and nothing is wired to it yet.',
      'Wire the switch’s OUT to the fan’s IN, then build a ramp down to the switch and drop a ball on it.',
    ],
    guide: [
      {
        text: 'Last one: no outlines this time. Make the fan blow the little ball into the bin. The light bulb button in the top bar has hints.',
        point: { hud: 'hint' },
        until: { kind: 'ack' },
      },
    ],
    metadata: meta(6, 'Ball, switch, fan, bin. A real machine!'),
  },
  solutions: [
    {
      objects: [o('plank-a', 'plank', 220, 360, { length: 300 }, NOTCH), o('ball-a', 'ball', 110, 250)],
      connections: [wire('wire-a', 't6-switch', 'out', 't6-fan', 'in')],
    },
  ],
};

export const TUTORIAL: CampaignEntry[] = [t1, t2, t3, t4, t5, t6];
