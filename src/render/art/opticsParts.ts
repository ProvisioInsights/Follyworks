/**
 * Procedural art for the Light & Lasers parts, in the same style as art/parts.ts: world units,
 * local frame, outlined lit shapes with bevels, grime and small labels. Registered into the part
 * DEFS by spreading OPTICS_DEFS there.
 */

import {
  type Box, type Ctx, OL, Rand, rgb, shade,
  rr, poly, circ, ell, lin, rad, cylV, cylH, metal,
  lit, seam, speckle, mottle, scratches, grimeBottom, edgeChips,
  rivet, screw, hexBolt, glint, sheen, label, hazard,
} from './partHelpers';

type Params = Record<string, string | number | boolean>;
type Painter = (ctx: Ctx, p: Params, r: Rand) => void;
type Size = [number, number, number, number];
interface PartDef {
  size: (p: Params) => Size;
  paint: Painter;
}

const TAU = Math.PI * 2;
const str = (p: Params, k: string, d: string): string => (typeof p[k] === 'string' ? (p[k] as string) : d);
const centred = (w: number, h: number): Size => [w, h, w / 2, h / 2];

/** Beam colours (also used by the beam renderer). */
export const LIGHT_RGB: Record<string, number> = {
  red: 0xff3d35,
  green: 0x3dff6e,
  blue: 0x3d8cff,
  white: 0xfff4e2,
  any: 0xf3e6cc,
};
const glassTint: Record<string, number> = { red: 0xd8382e, green: 0x2fbf58, blue: 0x2f6fe0, white: 0xe8e4da, any: 0xbfc6c8 };

// ---------------------------------------------------------------------------
// Laser emitter
// ---------------------------------------------------------------------------

const paintLaser: Painter = (ctx, p, r) => {
  const col = str(p, 'color', 'red');
  const housing = 0x3c4248;
  // mounting foot and terminal
  lit(ctx, () => rr(ctx, -24, 10, 22, 6, 1.6), [-24, 10, 22, 6], cylV(ctx, 10, 16, 0x5a6268), { lw: 1.1 });
  hexBolt(ctx, -18, 14, 1.3, 0xc2a058);
  // cooling fins at the back
  for (let x = -29; x < -20; x += 3) {
    lit(ctx, () => rr(ctx, x, -14, 2.2, 28, 0.8), [x, -14, 2.2, 28], cylV(ctx, -14, 14, 0x6c757b), { lw: 0.8, bevel: 0.4 });
  }
  // main body tube
  const box: Box = [-22, -12, 40, 24];
  lit(ctx, () => rr(ctx, -22, -12, 40, 24, 5), box, cylV(ctx, -12, 12, housing, 1.1), {
    inner: () => {
      // hazard band
      ctx.save();
      ctx.beginPath();
      ctx.rect(-6, -12, 9, 24);
      ctx.clip();
      hazard(ctx, [-6, -12, 9, 24], 3.2);
      ctx.restore();
      seam(ctx, -6, -12, -6, 12, 0.7);
      seam(ctx, 3, -12, 3, 12, 0.7);
      // colour stripe
      ctx.fillStyle = cylV(ctx, -12, 12, glassTint[col] ?? 0xd8382e, 0.8);
      ctx.fillRect(6, -12, 4, 24);
      seam(ctx, 10, -12, 10, 12, 0.6);
      label(ctx, 'LZR', -14, -1, 5.2, 'rgba(236,224,196,0.85)', { weight: '900' });
      label(ctx, 'CLASS 4', -14, 5.4, 2.2, 'rgba(236,224,196,0.55)', { weight: '800' });
      scratches(ctx, r, box, 10, true, 0.25);
      edgeChips(ctx, r, box, 10, 'rgba(170,176,180,0.5)', 0.8);
      grimeBottom(ctx, box, 0.3);
    },
  });
  rivet(ctx, -18.5, -8.5, 0.8);
  rivet(ctx, 14.5, -8.5, 0.8);
  // brass nozzle
  lit(ctx, () => poly(ctx, [17, -9, 25, -6, 25, 6, 17, 9]), [17, -9, 8, 18], cylV(ctx, -9, 9, 0xc39545), { lw: 1.2 });
  lit(ctx, () => rr(ctx, 24.5, -5, 4.5, 10, 1.2), [24.5, -5, 4.5, 10], cylV(ctx, -5, 5, 0x8a6a30), { lw: 1 });
  // emitter lens
  const c = LIGHT_RGB[col] ?? LIGHT_RGB.red;
  lit(ctx, () => ell(ctx, 29.6, 0, 1.8, 3.6), [27.8, -3.6, 3.6, 7.2], rad(ctx, 29.4, -1, 0, 29.6, 0, 3.6, [[0, '#ffffff'], [0.4, rgb(c)], [1, rgb(shade(c, -0.5))]]), { lw: 0.8, form: 0, bevel: 0 });
  glint(ctx, -16, -8.6, 1.4, 0.7);
};

// ---------------------------------------------------------------------------
// Mirror, splitter
// ---------------------------------------------------------------------------

const silver = (ctx: Ctx, x0: number, x1: number, y0: number, y1: number, a = 1) =>
  lin(ctx, x0, y0, x1, y1, [
    [0, `rgba(250,252,255,${a})`],
    [0.18, `rgba(170,184,196,${a})`],
    [0.35, `rgba(236,244,250,${a})`],
    [0.55, `rgba(120,136,150,${a})`],
    [0.75, `rgba(214,226,236,${a})`],
    [1, `rgba(150,164,176,${a})`],
  ]);

const endCaps = (ctx: Ctx, halfL: number, h: number) => {
  for (const s of [-1, 1]) {
    const x = s > 0 ? halfL - 5 : -halfL;
    lit(ctx, () => rr(ctx, x, -h / 2 - 1.5, 5, h + 3, 1.4), [x, -h / 2 - 1.5, 5, h + 3], cylH(ctx, x, x + 5, 0xc39545), { lw: 1.1 });
    screw(ctx, x + 2.5, 0, 1.1, 0.4 * s);
  }
};

const paintMirror: Painter = (ctx, _p, r) => {
  const box: Box = [-36, -4, 72, 8];
  lit(ctx, () => rr(ctx, -36, -4, 72, 8, 1.2), box, silver(ctx, -30, 30, -8, 8), {
    form: 0.3,
    inner: () => {
      // a dark backing line down the middle (it is silvered both sides)
      ctx.fillStyle = 'rgba(40,46,54,0.55)';
      ctx.fillRect(-36, -0.5, 72, 1);
      speckle(ctx, r, box, 12, ['rgba(255,255,255,0.6)', 'rgba(60,70,80,0.3)'], 0.1, 0.25);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(-20, -3.2, 18, 0.8);
      ctx.fillRect(6, -3.2, 6, 0.8);
    },
  });
  endCaps(ctx, 36, 8);
  glint(ctx, -10, -3, 2.2, 0.9);
};

const paintSplitter: Painter = (ctx, _p, r) => {
  const box: Box = [-28, -3, 56, 6];
  lit(ctx, () => rr(ctx, -28, -3, 56, 6, 1), box, lin(ctx, 0, -3, 0, 3, [[0, 'rgba(200,236,250,0.85)'], [0.5, 'rgba(120,180,210,0.55)'], [1, 'rgba(190,226,244,0.85)']]), {
    form: 0.2,
    inner: () => {
      // half-silvering: fine dots of silver
      for (let x = -26; x < 26; x += 2) {
        ctx.fillStyle = (x / 2) % 2 === 0 ? 'rgba(235,242,248,0.8)' : 'rgba(130,150,170,0.55)';
        ctx.fillRect(x, -0.6, 1, 1.2);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(-18, -2.4, 14, 0.6);
      mottle(ctx, r, box, 3, 0xffffff, 0.15, 2, 4);
    },
  });
  endCaps(ctx, 30, 6);
};

// ---------------------------------------------------------------------------
// Prism
// ---------------------------------------------------------------------------

const PS = 56;
const PH = (PS * Math.sqrt(3)) / 2;

const paintPrism: Painter = (ctx) => {
  const top = (-2 * PH) / 3;
  const bot = PH / 3;
  const tri = () => poly(ctx, [0, top, PS / 2, bot, -PS / 2, bot]);
  lit(ctx, tri, [-PS / 2, top, PS, PH], lin(ctx, -PS / 2, top, PS / 2, bot, [
    [0, 'rgba(236,250,255,0.92)'],
    [0.35, 'rgba(170,214,236,0.7)'],
    [0.65, 'rgba(126,180,214,0.62)'],
    [1, 'rgba(90,140,180,0.8)'],
  ]), {
    form: 0.3,
    inner: () => {
      // rainbow caustic along the base
      const g = lin(ctx, -PS / 2, 0, PS / 2, 0, [
        [0, 'rgba(255,70,60,0.0)'],
        [0.2, 'rgba(255,70,60,0.55)'],
        [0.4, 'rgba(255,220,60,0.5)'],
        [0.6, 'rgba(60,255,110,0.5)'],
        [0.8, 'rgba(60,140,255,0.55)'],
        [1, 'rgba(60,140,255,0)'],
      ]);
      ctx.fillStyle = g;
      ctx.fillRect(-PS / 2, bot - 6, PS, 5);
      // internal facet lines
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, top + 6);
      ctx.lineTo(-PS / 2 + 9, bot - 3);
      ctx.moveTo(0, top + 6);
      ctx.lineTo(PS / 2 - 12, bot - 6);
      ctx.stroke();
      sheen(ctx, -6, -8, 7, 3, 0.55, -1.05);
    },
  });
  // brass base rail
  lit(ctx, () => rr(ctx, -PS / 2 - 1, bot - 1.2, PS + 2, 3.2, 1), [-PS / 2 - 1, bot - 1.2, PS + 2, 3.2], cylV(ctx, bot - 1.2, bot + 2, 0xc39545), { lw: 1 });
  glint(ctx, -3, top + 9, 2.4, 0.95);
};

// ---------------------------------------------------------------------------
// Colour filter, lens
// ---------------------------------------------------------------------------

const paintFilter: Painter = (ctx, p, r) => {
  const col = str(p, 'color', 'green');
  const t = glassTint[col] ?? glassTint.green;
  const box: Box = [-4, -28, 8, 56];
  lit(ctx, () => rr(ctx, -4, -28, 8, 56, 1.2), box, lin(ctx, -4, 0, 4, 0, [[0, rgb(shade(t, 0.35), 0.85)], [0.5, rgb(t, 0.75)], [1, rgb(shade(t, -0.3), 0.9)]]), {
    form: 0.3,
    inner: () => {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(-2.6, -24, 1, 30);
      mottle(ctx, r, box, 3, shade(t, 0.5), 0.2, 1, 3);
    },
  });
  for (const s of [-1, 1]) {
    const y = s > 0 ? 24 : -30;
    lit(ctx, () => rr(ctx, -5.5, y, 11, 6, 1.4), [-5.5, y, 11, 6], cylV(ctx, y, y + 6, 0x4a5056), { lw: 1 });
    rivet(ctx, 0, y + 3, 0.9);
  }
};

const paintLens: Painter = (ctx) => {
  const lens = () => {
    ctx.moveTo(0, -60);
    ctx.quadraticCurveTo(11, 0, 0, 60);
    ctx.quadraticCurveTo(-11, 0, 0, -60);
    ctx.closePath();
  };
  lit(ctx, lens, [-5.5, -60, 11, 120], rad(ctx, -2, -14, 0, 0, 0, 56, [[0, 'rgba(240,252,255,0.92)'], [0.5, 'rgba(170,214,236,0.66)'], [1, 'rgba(110,160,200,0.82)']]), {
    form: 0.25,
    inner: () => {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-1.5, -46);
      ctx.quadraticCurveTo(-4.8, -8, -2.6, 20);
      ctx.stroke();
      // faint centre mark
      ctx.fillStyle = 'rgba(40,60,80,0.35)';
      ctx.fillRect(-3, -0.5, 6, 1);
    },
  });
  // brass clamps top and bottom
  for (const y of [-63, 58]) {
    lit(ctx, () => rr(ctx, -5, y, 10, 5, 1.4), [-5, y, 10, 5], cylV(ctx, y, y + 5, 0xc39545), { lw: 1 });
  }
  glint(ctx, -2, -26, 2.2, 0.95);
};

// ---------------------------------------------------------------------------
// Light sensor
// ---------------------------------------------------------------------------

const paintLightSensor: Painter = (ctx, p, r) => {
  const col = str(p, 'color', 'any');
  // terminal post below
  lit(ctx, () => rr(ctx, -3, 16, 6, 7, 1), [-3, 16, 6, 7], cylH(ctx, -3, 3, 0x6a7276), { lw: 1 });
  const box: Box = [-17, -17, 34, 34];
  lit(ctx, () => rr(ctx, -17, -17, 34, 34, 4), box, metal(ctx, -17, -17, 17, 17, 0x2f6f6a), {
    inner: () => {
      mottle(ctx, r, box, 8, 0x14403c, 0.25, 2, 5);
      label(ctx, 'PHOTO', 0, 13.2, 2.6, 'rgba(230,240,226,0.75)', { weight: '900' });
      edgeChips(ctx, r, box, 12, 'rgba(180,200,190,0.5)', 0.8);
      scratches(ctx, r, box, 8, true, 0.2);
      grimeBottom(ctx, box, 0.3);
    },
  });
  for (const [x, y] of [[-13, -13], [13, -13], [-13, 9], [13, 9]]) screw(ctx, x, y, 1.1, 0.5);
  // colour ring + photocell
  const ring = LIGHT_RGB[col] ?? LIGHT_RGB.any;
  lit(ctx, () => { circ(ctx, 0, -2, 11.5); circ(ctx, 0, -2, 9); }, [-11.5, -13.5, 23, 23], cylV(ctx, -13.5, 9.5, col === 'any' ? 0xc39545 : ring), { rule: 'evenodd', lw: 1.1 });
  lit(ctx, () => circ(ctx, 0, -2, 9), [-9, -11, 18, 18], rad(ctx, -2.5, -5, 0, 0, -2, 9, [[0, 'rgba(255,236,190,0.95)'], [0.5, 'rgba(196,120,60,0.9)'], [1, 'rgba(70,30,20,1)']]), {
    lw: 0.8,
    form: 0,
    inner: () => {
      // the classic CdS cell zig-zag
      ctx.strokeStyle = 'rgba(60,20,10,0.8)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      for (let i = 0; i < 6; i++) {
        const y = -6 + i * 2;
        ctx.lineTo(i % 2 === 0 ? 6 : -6, y);
        ctx.lineTo(i % 2 === 0 ? 6 : -6, y + 2);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(-3, -6.5, 4, 1.8, -0.5, 0, TAU);
      ctx.fill();
    },
  });
  ctx.strokeStyle = OL;
};

export const OPTICS_DEFS: Record<string, PartDef> = {
  laser: { size: () => centred(64, 36), paint: paintLaser },
  mirror: { size: () => centred(76, 14), paint: paintMirror },
  beam_splitter: { size: () => centred(64, 12), paint: paintSplitter },
  prism: { size: () => [PS + 6, PH + 8, PS / 2 + 3, (2 * PH) / 3 + 3], paint: paintPrism },
  color_filter: { size: () => centred(14, 64), paint: paintFilter },
  lens: { size: () => centred(18, 132), paint: paintLens },
  light_sensor: { size: () => [40, 46, 20, 20], paint: paintLightSensor },
};

