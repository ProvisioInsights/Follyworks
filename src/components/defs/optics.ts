// Light & Lasers: a laser emitter, mirrors, beam splitters, prisms, colour filters, lenses and a
// light sensor. The parts are ordinary static bodies tagged with `plugin.optic`; the beams
// themselves are traced every tick by sim/optics.ts, which reads that tag.

import type { Entity } from '../../sim/Entity';
import type { MBody } from '../../sim/matter';
import { laserFiring } from '../../sim/optics';
import { registerComponent, type PropSpec } from '../registry';
import { DEG, poly, rect } from '../kit';

const tag = (b: MBody, optic: string) => {
  b.plugin = { ...(b.plugin ?? {}), optic };
  return b;
};

const COLOR_PROP = (def: string, any = false): PropSpec => ({
  key: 'color',
  label: 'Colour',
  type: 'enum',
  options: [
    ...(any ? [{ value: 'any', label: 'Any' }] : []),
    { value: 'red', label: 'Red' },
    { value: 'green', label: 'Green' },
    { value: 'blue', label: 'Blue' },
    ...(any || def === 'white' ? [{ value: 'white', label: 'White' }] : []),
  ],
  default: def,
});

registerComponent({
  type: 'laser',
  name: 'Laser Emitter',
  category: 'optics',
  domain: 'light',
  description: 'Needs power (or set it to always on). Fires a beam that bounces off mirrors and slowly heats whatever it rests on.',
  help: 'The beam lights candles and fuses, pops balloons and burns through ropes after resting on them for a moment. Anything solid blocks it.',
  tags: ['metal', 'static', 'device', 'light'],
  dynamic: false,
  rotatable: true,
  flippable: true,
  rotationStep: 15 * DEG,
  props: [
    { key: 'alwaysOn', label: 'Always on', type: 'bool', default: false },
    {
      key: 'color',
      label: 'Colour',
      type: 'enum',
      options: [
        { value: 'red', label: 'Red' },
        { value: 'green', label: 'Green' },
        { value: 'blue', label: 'Blue' },
        { value: 'white', label: 'White' },
      ],
      default: 'red',
    },
  ],
  ports: [{ id: 'in', dir: 'in', x: -18, y: 14, label: 'Power in' }],
  size: () => ({ w: 62, h: 34 }),
  art: 'laser',
  build(e, sim) {
    tag(rect(sim, e, { x: 0, y: 0 }, 56, 24, { isStatic: true, label: 'laser' }), 'laser');
    e.state.firing = false;
  },
  isActive: (e) => laserFiring(e),
});

registerComponent({
  type: 'mirror',
  name: 'Mirror',
  category: 'optics',
  domain: 'light',
  description: 'Silvered on both faces. Beams bounce off at the angle they came in. Turn it 45° to bend a beam round a corner.',
  help: 'Both long faces reflect; the brass end caps stop the beam. Hold Shift while rotating for fine angles.',
  tags: ['glass', 'static', 'optic'],
  dynamic: false,
  rotatable: true,
  flippable: false,
  rotationStep: 15 * DEG,
  props: [],
  size: () => ({ w: 72, h: 12 }),
  art: 'mirror',
  build(e, sim) {
    tag(rect(sim, e, { x: 0, y: 0 }, 72, 8, { isStatic: true, friction: 0.2, label: 'mirror' }), 'mirror');
  },
  isActive: (e) => !!e.activated,
});

registerComponent({
  type: 'beam_splitter',
  name: 'Beam Splitter',
  category: 'optics',
  domain: 'light',
  description: 'Half-silvered glass: half the beam passes straight through, half bounces off like a mirror.',
  tags: ['glass', 'static', 'optic'],
  dynamic: false,
  rotatable: true,
  flippable: false,
  rotationStep: 15 * DEG,
  props: [],
  size: () => ({ w: 60, h: 10 }),
  art: 'beam_splitter',
  build(e, sim) {
    tag(rect(sim, e, { x: 0, y: 0 }, 56, 6, { isStatic: true, friction: 0.2, label: 'splitter' }), 'splitter');
  },
  isActive: (e) => !!e.activated,
});

/** Equilateral prism, apex up at angle 0, side PRISM_SIDE. Centre = centroid. */
export const PRISM_SIDE = 56;
const PH = (PRISM_SIDE * Math.sqrt(3)) / 2;

registerComponent({
  type: 'prism',
  name: 'Prism',
  category: 'optics',
  domain: 'light',
  description: 'Splits white light into red, green and blue beams fanning toward its base. Coloured beams just bend.',
  help: 'Red bends least (14°), green more (22°), blue most (30°), always toward the flat base.',
  tags: ['glass', 'static', 'optic'],
  dynamic: false,
  rotatable: true,
  flippable: false,
  rotationStep: 15 * DEG,
  props: [],
  size: () => ({ w: PRISM_SIDE + 4, h: PH + 4 }),
  art: 'prism',
  build(e, sim) {
    const h = PH;
    tag(
      poly(sim, e, [{ x: 0, y: (-2 * h) / 3 }, { x: PRISM_SIDE / 2, y: h / 3 }, { x: -PRISM_SIDE / 2, y: h / 3 }], { isStatic: true, friction: 0.3, label: 'prism' }),
      'prism',
    );
  },
  isActive: (e) => !!e.activated,
});

registerComponent({
  type: 'color_filter',
  name: 'Colour Filter',
  category: 'optics',
  domain: 'light',
  description: 'Coloured glass. Lets only its own colour through: white light comes out tinted, other colours are stopped.',
  tags: ['glass', 'static', 'optic'],
  dynamic: false,
  rotatable: true,
  flippable: false,
  rotationStep: 15 * DEG,
  props: [COLOR_PROP('green')],
  size: () => ({ w: 12, h: 60 }),
  art: 'color_filter',
  build(e, sim) {
    tag(rect(sim, e, { x: 0, y: 0 }, 8, 56, { isStatic: true, friction: 0.3, label: 'filter' }), 'filter');
  },
  isActive: (e) => !!e.activated,
});

registerComponent({
  type: 'lens',
  name: 'Lens',
  category: 'optics',
  domain: 'light',
  description: 'A converging lens. Parallel beams bend toward its focal point; a beam through the middle goes straight on.',
  help: 'Focal length is the distance from the lens centre to where parallel beams meet.',
  tags: ['glass', 'static', 'optic'],
  dynamic: false,
  rotatable: true,
  flippable: false,
  rotationStep: 15 * DEG,
  props: [{ key: 'focal', label: 'Focal length', type: 'number', min: 60, max: 400, step: 10, default: 160, unit: 'cm' }],
  size: () => ({ w: 16, h: 72 }),
  art: 'lens',
  build(e, sim) {
    tag(rect(sim, e, { x: 0, y: 0 }, 10, 68, { isStatic: true, friction: 0.3, label: 'lens' }), 'lens');
  },
  isActive: (e) => !!e.activated,
});

registerComponent({
  type: 'light_sensor',
  name: 'Light Sensor',
  category: 'optics',
  domain: 'light',
  description: 'A photocell. Its power OUT socket is live while a beam shines on it. Set a colour to make it fussy.',
  help: 'With a colour set, only a beam of exactly that colour counts (white is not red).',
  tags: ['metal', 'static', 'sensor', 'source'],
  dynamic: false,
  rotatable: true,
  flippable: false,
  rotationStep: 90 * DEG,
  props: [COLOR_PROP('any', true)],
  ports: [{ id: 'out', dir: 'out', x: 0, y: 22, label: 'Power out' }],
  size: () => ({ w: 38, h: 50 }),
  art: 'light_sensor',
  build(e, sim) {
    tag(rect(sim, e, { x: 0, y: 0 }, 34, 34, { isStatic: true, label: 'lightsensor' }), 'sensor');
    e.state.lit = false;
  },
  logic(e) {
    e.outputs.out = !!e.state.lit;
  },
  isActive: (e) => !!e.state.lit,
});

export const isOptic = (e: Entity) => e.def.category === 'optics';
