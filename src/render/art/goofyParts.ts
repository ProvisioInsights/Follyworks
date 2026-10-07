/**
 * Procedural art for the goofy parts (rubber chicken, mousetrap, toaster, teapot, bowling pin,
 * Whiskers the cat, bell, basketball and hoop), in the same style as art/parts.ts: world units,
 * local frame facing +x, outlined lit shapes, warm key light from the upper left. Registered into
 * the part DEFS by spreading GOOFY_DEFS there. Geometry notes match components/defs/goofy.ts.
 */

import {
  type Box, type Ctx, OL, Rand, rgb, shade,
  rr, poly, circ, ell, lin, rad, cylV, cylH, metal,
  lit, seam, speckle, mottle, scratches, grimeBottom, edgeChips,
  screw, hexBolt, glint, sheen, label, woodGrain, coilSpring, outline,
} from './partHelpers';

type Params = Record<string, string | number | boolean>;
type Painter = (ctx: Ctx, p: Params, r: Rand) => void;
type Size = [number, number, number, number];
interface PartDef {
  size: (p: Params) => Size;
  paint: Painter;
}

const TAU = Math.PI * 2;
const centred = (w: number, h: number): Size => [w, h, w / 2, h / 2];

/** A stroked line in the outline colour with a coloured core (wire, legs, whiskers). */
const stick = (ctx: Ctx, pts: number[], w: number, col: number) => {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  };
  path();
  ctx.strokeStyle = OL;
  ctx.lineWidth = w + 1.4;
  ctx.stroke();
  path();
  ctx.strokeStyle = rgb(col);
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.restore();
};

/** A cartoon eye: white, pupil looking toward (lx, ly), outline. */
const eye = (ctx: Ctx, x: number, y: number, rx: number, ry: number, lx = 0.3, ly = 0) => {
  lit(ctx, () => ell(ctx, x, y, rx, ry), [x - rx, y - ry, rx * 2, ry * 2], rgb(0xfbf6ea), { form: 0.4, bevel: 0, lw: 0.9 });
  ctx.fillStyle = rgb(0x1d1612);
  ctx.beginPath();
  ctx.arc(x + lx * rx * 0.45, y + ly * ry * 0.45, Math.min(rx, ry) * 0.55, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(x + lx * rx * 0.45 - rx * 0.18, y + ly * ry * 0.45 - ry * 0.22, Math.min(rx, ry) * 0.18, 0, TAU);
  ctx.fill();
};

// ---------------------------------------------------------------------------
// Basketball (circle r = 16)
// ---------------------------------------------------------------------------

const paintBasketball: Painter = (ctx, _p, r) => {
  const R = 16;
  const box: Box = [-R, -R, R * 2, R * 2];
  lit(ctx, () => circ(ctx, 0, 0, R), box, rad(ctx, -4, -5, 1, 0, 0, R, [[0, rgb(0xf3934a)], [0.65, rgb(0xd9662a)], [1, rgb(0xa8461a)]]), {
    bevel: 0.5,
    inner: () => {
      speckle(ctx, r, box, 90, ['rgba(120,40,10,0.35)', 'rgba(255,190,140,0.25)'], 0.2, 0.45);
      ctx.strokeStyle = 'rgba(34,18,10,0.92)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-R, 0);
      ctx.quadraticCurveTo(0, 2.5, R, 0);
      ctx.moveTo(0, -R);
      ctx.lineTo(0, R);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-R * 1.08, 0, R * 0.6, R * 1.02, 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(R * 1.08, 0, R * 0.6, R * 1.02, 0, Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
    },
  });
};

// ---------------------------------------------------------------------------
// Rubber chicken (body 50 × 18, chamfer 8; facing +x, head on the right)
// ---------------------------------------------------------------------------

const CHICK = 0xf1c33a;

const chickenPainter = (squawk: boolean): Painter => (ctx, _p, r) => {
  // dangly orange legs first, behind the body
  for (const [x, k] of [[-6, 0], [2, 1]]) {
    stick(ctx, [x, 6, x - 3 - k, 12, x - 6, 13], 1.6, 0xe0782a);
    stick(ctx, [x - 6, 13, x - 10, 13.4], 1.1, 0xe0782a);
    stick(ctx, [x - 6, 13, x - 8, 15.5], 1.1, 0xe0782a);
  }
  // plucked body and tail tuft
  const body = () => {
    ctx.moveTo(-25, -2);
    ctx.bezierCurveTo(-25, -9, -14, -10, -4, -8);
    ctx.bezierCurveTo(4, -7, 10, -8, 13, -6);
    ctx.lineTo(16, -2);
    ctx.bezierCurveTo(14, 6, 4, 9, -8, 9);
    ctx.bezierCurveTo(-20, 9, -25, 5, -25, -2);
    ctx.closePath();
  };
  const box: Box = [-25, -10, 41, 19];
  lit(ctx, body, box, cylV(ctx, -10, 9, CHICK, 0.8), {
    inner: () => {
      // goose-bump dimples
      speckle(ctx, r, box, 40, ['rgba(170,110,20,0.4)'], 0.25, 0.5);
      mottle(ctx, r, box, 5, 0xd88a1a, 0.25, 3, 6);
      // a little wing
      ctx.strokeStyle = 'rgba(140,90,20,0.7)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-14, -3);
      ctx.quadraticCurveTo(-6, -1, -3, 4);
      ctx.quadraticCurveTo(-10, 4, -15, 1);
      ctx.stroke();
    },
  });
  lit(ctx, () => poly(ctx, [-24, -5, -30, -9, -27, -3, -31, 0, -25, 1]), [-31, -9, 7, 10], rgb(shade(CHICK, 0.05)), { lw: 1.1, bevel: 0 });
  // the long floppy neck curling up to the head
  ctx.save();
  ctx.lineCap = 'round';
  const neck = () => {
    ctx.beginPath();
    ctx.moveTo(10, -4);
    ctx.quadraticCurveTo(19, -2, 20, -8);
  };
  neck();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 7.4;
  ctx.stroke();
  neck();
  ctx.strokeStyle = rgb(shade(CHICK, 0.08));
  ctx.lineWidth = 5.6;
  ctx.stroke();
  ctx.restore();
  // head
  const hx = 21, hy = -10;
  // comb
  lit(ctx, () => {
    ctx.moveTo(hx - 5, hy - 3);
    ctx.quadraticCurveTo(hx - 6, hy - 8, hx - 3, hy - 7);
    ctx.quadraticCurveTo(hx - 2, hy - 11, hx + 1, hy - 8);
    ctx.quadraticCurveTo(hx + 3, hy - 11, hx + 4, hy - 6);
    ctx.lineTo(hx + 3, hy - 3);
    ctx.closePath();
  }, [hx - 6, hy - 11, 10, 8], rgb(0xd8352a), { lw: 1, bevel: 0.4 });
  lit(ctx, () => ell(ctx, hx, hy, 5.2, 4.6), [hx - 5.2, hy - 4.6, 10.4, 9.2], cylV(ctx, hy - 5, hy + 5, CHICK, 0.8), { lw: 1.2 });
  // beak: shut and smug, or wide open mid-squawk
  if (squawk) {
    lit(ctx, () => poly(ctx, [hx + 3, hy - 2, hx + 12, hy - 6, hx + 5, hy]), [hx + 3, hy - 6, 9, 6], rgb(0xf08a2a), { lw: 1, bevel: 0.3 });
    lit(ctx, () => poly(ctx, [hx + 3, hy + 1, hx + 11, hy + 5, hx + 4, hy + 3]), [hx + 3, hy + 1, 8, 4], rgb(0xd9661c), { lw: 1, bevel: 0.3 });
    ctx.fillStyle = rgb(0x5a1410);
    ctx.beginPath();
    ctx.moveTo(hx + 5, hy);
    ctx.lineTo(hx + 9, hy - 2.5);
    ctx.lineTo(hx + 8.5, hy + 3);
    ctx.closePath();
    ctx.fill();
  } else {
    lit(ctx, () => poly(ctx, [hx + 3.5, hy - 2.5, hx + 10, hy - 0.5, hx + 3.5, hy + 1.8]), [hx + 3.5, hy - 2.5, 6.5, 4.3], rgb(0xf08a2a), { lw: 1, bevel: 0.3 });
  }
  // wattle
  lit(ctx, () => ell(ctx, hx + 3, hy + 4.5, 1.8, 2.6), [hx + 1.2, hy + 2, 3.6, 5.2], rgb(0xc8302a), { lw: 0.8, bevel: 0 });
  // the classic dazed eye (wide open when squawking)
  if (squawk) eye(ctx, hx + 0.5, hy - 1.2, 2.4, 2.6, 0.2, -0.2);
  else {
    ctx.strokeStyle = OL;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hx - 1.4, hy - 2.6);
    ctx.lineTo(hx + 1.8, hy + 0.2);
    ctx.moveTo(hx + 1.8, hy - 2.6);
    ctx.lineTo(hx - 1.4, hy + 0.2);
    ctx.stroke();
  }
  sheen(ctx, -10, -5, 8, 2.2, 0.35, -0.1);
  glint(ctx, -15, -6.5, 1.4, 0.7);
};

// ---------------------------------------------------------------------------
// Mousetrap (deck 64 × 10 centred; trigger port at (-26, 2))
// ---------------------------------------------------------------------------

const paintMousetrap: Painter = (ctx, _p, r) => {
  const box: Box = [-32, -5, 64, 10];
  lit(ctx, () => rr(ctx, -32, -5, 64, 10, 1.6), box, rgb(0xc99a5c), {
    inner: () => {
      woodGrain(ctx, r, -32, -5, 64, 10, { base: 0xc99a5c, dir: 'h', knots: 1, lineGap: 1.4 });
      label(ctx, 'VICTOR-Y', -6, 1.6, 3.4, 'rgba(150,30,20,0.85)', { weight: '900' });
      grimeBottom(ctx, box, 0.35);
      edgeChips(ctx, r, box, 8, 'rgba(240,210,160,0.5)', 0.7);
    },
  });
  // the spring coil at the hinge (local (0,-5)) and staples
  coilSpring(ctx, -5, -6.5, 5, -6.5, 2.2, 4, 0.9, 0xb4b8ba);
  for (const x of [-14, 10]) stick(ctx, [x, -5, x, -7, x + 3, -7, x + 3, -5], 0.8, 0x9ea4a8);
  // trigger plate with a wedge of cheese
  lit(ctx, () => rr(ctx, 12, -7, 14, 2.4, 0.8), [12, -7, 14, 2.4], metal(ctx, 12, -7, 26, -5, 0xa7adb0), { lw: 1, bevel: 0.3 });
  lit(ctx, () => poly(ctx, [14, -7, 24, -7, 24, -12.5]), [14, -12.5, 10, 5.5], cylV(ctx, -12.5, -7, 0xf4cf4a, 0.8), {
    lw: 1,
    inner: () => {
      ctx.fillStyle = 'rgba(190,130,20,0.7)';
      for (const [x, y, s] of [[20, -8.5, 0.9], [22.5, -10.4, 0.6], [17.5, -7.8, 0.5]]) {
        ctx.beginPath();
        ctx.arc(x, y, s, 0, TAU);
        ctx.fill();
      }
    },
  });
  // the catch wire lying back toward the left end
  stick(ctx, [-3, -6.5, -24, -6.3], 0.9, 0xbfc3c6);
};

/** The snapping U-bar seen side-on: from the hinge (origin) out to +28. Game rotates it. */
const paintTrapBar: Painter = (ctx) => {
  stick(ctx, [0, 0, 27, 0], 1.6, 0xc9cdd0);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(2, -0.6, 22, 0.35);
  hexBolt(ctx, 0, 0, 1.4, 0x9a9890);
};

// ---------------------------------------------------------------------------
// Toaster (body 60 × 40 centred (0,4): y -16…24; side lever at (35,-4))
// ---------------------------------------------------------------------------

const CHROME = 0xb9c3c8;

const paintToaster: Painter = (ctx, _p, r) => {
  // feet
  for (const x of [-22, 22]) lit(ctx, () => rr(ctx, x - 4, 22, 8, 4, 1.4), [x - 4, 22, 8, 4], rgb(0x2a2420), { lw: 1, bevel: 0 });
  // lever track on the right side
  lit(ctx, () => rr(ctx, 29, -12, 4, 20, 1.2), [29, -12, 4, 20], rgb(0x3a3532), { lw: 1, bevel: 0.3 });
  const box: Box = [-30, -16, 60, 40];
  lit(ctx, () => rr(ctx, -30, -16, 60, 40, 9), box, lin(ctx, -30, 0, 30, 0, [
    [0, rgb(shade(CHROME, -0.2))],
    [0.12, rgb(shade(CHROME, 0.45))],
    [0.3, rgb(shade(CHROME, 0.05))],
    [0.5, rgb(shade(CHROME, -0.25))],
    [0.62, rgb(shade(CHROME, 0.3))],
    [0.85, rgb(CHROME)],
    [1, rgb(shade(CHROME, -0.35))],
  ]), {
    inner: () => {
      // reflected kitchen: a warm band and the floor line
      ctx.fillStyle = 'rgba(214,150,90,0.18)';
      ctx.fillRect(-30, 6, 60, 6);
      ctx.fillStyle = 'rgba(30,24,20,0.18)';
      ctx.fillRect(-30, 14, 60, 10);
      // retro red stripe
      ctx.fillStyle = cylV(ctx, -3, 2, 0xc8382c, 0.8);
      ctx.fillRect(-30, -3, 60, 5);
      seam(ctx, -30, -3, 30, -3, 0.5);
      seam(ctx, -30, 2, 30, 2, 0.5);
      scratches(ctx, r, box, 14, true, 0.25);
      grimeBottom(ctx, box, 0.25);
    },
  });
  // slots on top
  for (const x of [-11, 11]) {
    lit(ctx, () => rr(ctx, x - 9, -18, 18, 4, 1.6), [x - 9, -18, 18, 4], rgb(0x1a1412), { lw: 1.1, bevel: 0.4, form: 0 });
  }
  // browning dial
  lit(ctx, () => circ(ctx, -14, 11, 4.4), [-18.4, 6.6, 8.8, 8.8], cylV(ctx, 6.6, 15.4, 0x2a2420), { lw: 1 });
  stick(ctx, [-14, 11, -12, 8.2], 0.8, 0xe8e0d0);
  label(ctx, 'TOASTMASTER', 7, 10, 3, 'rgba(40,30,26,0.75)', { weight: '900', maxW: 26 });
  sheen(ctx, -20, -8, 7, 3, 0.55, -0.2);
  glint(ctx, -23, -10, 2, 0.85);
  glint(ctx, 16, -11, 1.3, 0.6);
};

const paintToasterLever: Painter = (ctx) => {
  lit(ctx, () => rr(ctx, -6, -3, 12, 6, 2.6), [-6, -3, 12, 6], cylV(ctx, -3, 3, 0x2a2420), { lw: 1.1 });
  glint(ctx, -2.5, -1.5, 1, 0.6);
};

/** A slice of toast, 24 × 26 (chamfer 5). */
const paintToast: Painter = (ctx, _p, r) => {
  const shape = () => {
    ctx.moveTo(-12, 13);
    ctx.lineTo(-12, -4);
    ctx.bezierCurveTo(-15, -8, -13, -14, -6, -13);
    ctx.bezierCurveTo(-3, -15, 3, -15, 6, -13);
    ctx.bezierCurveTo(13, -14, 15, -8, 12, -4);
    ctx.lineTo(12, 13);
    ctx.closePath();
  };
  const box: Box = [-14, -15, 28, 28];
  lit(ctx, shape, box, rgb(0x9a5a24), {
    inner: () => {
      // golden middle inside the crust
      ctx.save();
      ctx.translate(0, 0.6);
      ctx.scale(0.8, 0.8);
      ctx.beginPath();
      shape();
      ctx.fillStyle = rad(ctx, 0, 0, 2, 0, 0, 16, [[0, rgb(0xf2c46a)], [0.7, rgb(0xd8963e)], [1, rgb(0xb06a28)]]);
      ctx.fill();
      ctx.restore();
      speckle(ctx, r, box, 30, ['rgba(120,60,20,0.45)', 'rgba(255,230,170,0.35)'], 0.2, 0.5);
      // a pat of butter
      lit(ctx, () => rr(ctx, -4, -3, 8, 5, 1.2), [-4, -3, 8, 5], rgb(0xfbe68a), { lw: 0.7, bevel: 0.3, form: 0.4 });
    },
  });
};

// ---------------------------------------------------------------------------
// Teapot (belly 44 × 34 at (0,4); spout tip (34,-12); handle around x -26)
// ---------------------------------------------------------------------------

const ENAMEL = 0x2f8f8a;

const paintTeapot: Painter = (ctx, _p, r) => {
  // handle loop
  ctx.save();
  ctx.lineCap = 'round';
  const handle = () => {
    ctx.beginPath();
    ctx.moveTo(-18, -6);
    ctx.bezierCurveTo(-36, -10, -36, 16, -18, 14);
  };
  handle();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 6.6;
  ctx.stroke();
  handle();
  ctx.strokeStyle = rgb(0x1f2a2a);
  ctx.lineWidth = 4.6;
  ctx.stroke();
  ctx.restore();
  // spout
  const spout = () => {
    ctx.moveTo(14, 8);
    ctx.bezierCurveTo(26, 6, 26, -4, 32, -13);
    ctx.lineTo(36, -11);
    ctx.bezierCurveTo(32, -2, 30, 10, 16, 16);
    ctx.closePath();
  };
  lit(ctx, spout, [14, -13, 22, 29], cylH(ctx, 14, 36, ENAMEL, 0.8), { lw: 1.4 });
  // belly
  const box: Box = [-23, -14, 46, 37];
  lit(ctx, () => ell(ctx, 0, 4, 23, 17.5), box, rad(ctx, -8, -2, 2, 0, 6, 26, [[0, rgb(shade(ENAMEL, 0.45))], [0.55, rgb(ENAMEL)], [1, rgb(shade(ENAMEL, -0.4))]]), {
    form: 0.6,
    inner: () => {
      // a band of white dots (enamelware)
      ctx.fillStyle = 'rgba(250,244,230,0.9)';
      for (let x = -18; x <= 18; x += 6) {
        ctx.beginPath();
        ctx.arc(x, 8 + Math.abs(x) * 0.08, 1.3, 0, TAU);
        ctx.fill();
      }
      edgeChips(ctx, r, [-21, -9, 42, 30], 6, 'rgba(30,26,24,0.7)', 0.9);
      grimeBottom(ctx, box, 0.3);
    },
  });
  // base ring
  lit(ctx, () => rr(ctx, -14, 19.5, 28, 4, 1.4), [-14, 19.5, 28, 4], rgb(shade(ENAMEL, -0.35)), { lw: 1.1, bevel: 0.3 });
  sheen(ctx, -9, -1, 8, 4, 0.6, -0.5);
  glint(ctx, -12, -3, 2, 0.9);
};

const paintTeapotLid: Painter = (ctx) => {
  lit(ctx, () => ell(ctx, 0, 1.5, 12, 3.4), [-12, -2, 24, 7], cylV(ctx, -2, 5, shade(ENAMEL, -0.05)), { lw: 1.2 });
  lit(ctx, () => {
    ctx.moveTo(-8, 0);
    ctx.quadraticCurveTo(0, -8, 8, 0);
    ctx.closePath();
  }, [-8, -6, 16, 6], cylV(ctx, -6, 0, ENAMEL), { lw: 1.2 });
  lit(ctx, () => ell(ctx, 0, -6.5, 2.6, 2), [-2.6, -8.5, 5.2, 4], rgb(0x1f2a2a), { lw: 1 });
  glint(ctx, -3, -3.5, 1.2, 0.8);
};

// ---------------------------------------------------------------------------
// Bowling pin (belly 18 × 30 at y 13, neck 10 × 26 at y -14: y -27…28)
// ---------------------------------------------------------------------------

const pinPath = (ctx: Ctx) => {
  ctx.moveTo(-6, 28);
  ctx.bezierCurveTo(-10, 20, -10, 6, -6.5, -1);
  ctx.bezierCurveTo(-4, -7, -3.6, -11, -4.2, -15);
  ctx.bezierCurveTo(-6, -21, -5, -28, 0, -28);
  ctx.bezierCurveTo(5, -28, 6, -21, 4.2, -15);
  ctx.bezierCurveTo(3.6, -11, 4, -7, 6.5, -1);
  ctx.bezierCurveTo(10, 6, 10, 20, 6, 28);
  ctx.closePath();
};

const paintBowlingPin: Painter = (ctx, _p, r) => {
  const box: Box = [-10, -28, 20, 56];
  lit(ctx, () => pinPath(ctx), box, cylH(ctx, -10, 10, 0xf2ece0, 0.7), {
    inner: () => {
      // two red neck stripes
      ctx.fillStyle = cylH(ctx, -10, 10, 0xc8302a, 0.6);
      ctx.fillRect(-10, -12.5, 20, 2.2);
      ctx.fillRect(-10, -8.6, 20, 2.2);
      mottle(ctx, r, box, 5, 0xc8b89a, 0.2, 2, 5);
      scratches(ctx, r, box, 6, false, 0.2);
      grimeBottom(ctx, box, 0.25);
    },
  });
  sheen(ctx, -3.5, 8, 2, 8, 0.55, 0.05);
  glint(ctx, -2, -23, 1.2, 0.8);
};

// ---------------------------------------------------------------------------
// Whiskers the cat (body 44 × 26 centred, facing +x)
// ---------------------------------------------------------------------------

const FUR = 0xe0893a;
const FUR_DARK = 0xa85420;
const BELLY = 0xf6dcb4;

const stripes = (ctx: Ctx, xs: number[], y0: number, y1: number) => {
  ctx.strokeStyle = rgb(FUR_DARK, 0.75);
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (const x of xs) {
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.quadraticCurveTo(x + 1.5, (y0 + y1) / 2, x - 0.5, y1);
    ctx.stroke();
  }
};

const ear = (ctx: Ctx, pts: number[]) => {
  lit(ctx, () => poly(ctx, pts), [Math.min(pts[0], pts[2], pts[4]), Math.min(pts[1], pts[3], pts[5]), 8, 8], rgb(FUR), { lw: 1.1, bevel: 0.4 });
  const cx = (pts[0] + pts[2] + pts[4]) / 3, cy = (pts[1] + pts[3] + pts[5]) / 3;
  ctx.fillStyle = rgb(0xe8a0a0, 0.9);
  ctx.beginPath();
  ctx.moveTo(cx + (pts[0] - cx) * 0.5, cy + (pts[1] - cy) * 0.5);
  ctx.lineTo(cx + (pts[2] - cx) * 0.5, cy + (pts[3] - cy) * 0.5);
  ctx.lineTo(cx + (pts[4] - cx) * 0.5, cy + (pts[5] - cy) * 0.5);
  ctx.closePath();
  ctx.fill();
};

const whiskers = (ctx: Ctx, x: number, y: number, dir: number) => {
  ctx.strokeStyle = 'rgba(250,244,230,0.85)';
  ctx.lineWidth = 0.45;
  for (const k of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * 9, y + k * 2.2 - 0.5);
    ctx.stroke();
  }
};

/** Curled up asleep: a loaf with the tail wrapped round the front. */
const paintCatSleep: Painter = (ctx, _p, r) => {
  const box: Box = [-22, -10, 44, 23];
  lit(ctx, () => {
    ctx.moveTo(-22, 12);
    ctx.bezierCurveTo(-24, -4, -12, -10, 0, -9);
    ctx.bezierCurveTo(10, -8, 18, -6, 20, 2);
    ctx.lineTo(20, 12);
    ctx.closePath();
  }, box, cylV(ctx, -10, 13, FUR, 0.8), {
    inner: () => {
      stripes(ctx, [-14, -8, -2, 4], -9, 0);
      mottle(ctx, r, box, 5, FUR_DARK, 0.2, 3, 6);
      grimeBottom(ctx, box, 0.2);
    },
  });
  // head resting on the paws at the front
  ear(ctx, [10, -9, 13, -16, 16, -8]);
  ear(ctx, [17, -8, 21, -14, 22, -5]);
  lit(ctx, () => ell(ctx, 16, -1, 8.5, 7.5), [7.5, -8.5, 17, 15], cylV(ctx, -8.5, 6.5, FUR, 0.8), {
    inner: () => stripes(ctx, [13, 16], -8, -4),
  });
  // closed eyes and a contented smile
  ctx.strokeStyle = OL;
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  for (const x of [13, 19]) {
    ctx.beginPath();
    ctx.arc(x, -2, 1.8, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.fillStyle = rgb(0xd0707a);
  ctx.beginPath();
  ctx.arc(16.5, 1.2, 0.9, 0, TAU);
  ctx.fill();
  whiskers(ctx, 21, 2, 1);
  // front paws and the tail wrapped round them
  for (const x of [8, 14]) lit(ctx, () => ell(ctx, x, 10.5, 3.6, 2.4), [x - 3.6, 8, 7.2, 5], rgb(BELLY), { lw: 1, bevel: 0.3 });
  ctx.save();
  ctx.lineCap = 'round';
  const tail = () => {
    ctx.beginPath();
    ctx.moveTo(-21, 9);
    ctx.bezierCurveTo(-24, 15, -4, 15, 4, 12);
  };
  tail();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 6;
  ctx.stroke();
  tail();
  ctx.strokeStyle = rgb(FUR);
  ctx.lineWidth = 4.4;
  ctx.stroke();
  ctx.restore();
  lit(ctx, () => ell(ctx, 4, 12, 2.6, 2.2), [1.4, 9.8, 5.2, 4.4], rgb(FUR_DARK), { lw: 0.9, bevel: 0 });
  sheen(ctx, -8, -6, 8, 2.5, 0.3, -0.1);
};

/** Running: stretched out, ears back, wide eyes. `frame` 0 = legs out, 1 = legs gathered. */
const catRunPainter = (frame: number, startled = false): Painter => (ctx, _p, r) => {
  const legs = frame === 0
    ? [[-15, 4, -24, 12], [-10, 5, -14, 13], [10, 4, 6, 13], [14, 3, 22, 11]]
    : [[-14, 4, -8, 13], [-9, 5, -3, 13], [9, 4, 4, 13], [13, 3, 9, 13]];
  if (startled) {
    // all four legs stiff and splayed, back arched high
    legs.splice(0, 4, [-14, 2, -18, 13], [-9, 3, -10, 13], [9, 3, 10, 13], [14, 2, 18, 13]);
  }
  // far legs darker, drawn first
  for (const [i, l] of legs.entries()) {
    const far = i % 2 === 1;
    stick(ctx, l, 3.4, far ? shade(FUR, -0.25) : FUR);
    lit(ctx, () => ell(ctx, l[2], l[3] - 0.5, 2.6, 1.6), [l[2] - 2.6, l[3] - 2.1, 5.2, 3.2], rgb(far ? shade(BELLY, -0.2) : BELLY), { lw: 0.8, bevel: 0 });
  }
  // tail: straight up when startled (puffed), streaming back when running
  ctx.save();
  ctx.lineCap = 'round';
  const tail = () => {
    ctx.beginPath();
    ctx.moveTo(-18, -2);
    if (startled) ctx.bezierCurveTo(-24, -8, -22, -18, -18, -22);
    else ctx.bezierCurveTo(-26, -6, -30, -10, -32, -16 + frame * 4);
  };
  tail();
  ctx.strokeStyle = OL;
  ctx.lineWidth = startled ? 7.5 : 5.4;
  ctx.stroke();
  tail();
  ctx.strokeStyle = rgb(FUR);
  ctx.lineWidth = startled ? 5.8 : 3.8;
  ctx.stroke();
  ctx.restore();
  // body
  const hump = startled ? -17 : -9 - frame;
  const box: Box = [-21, hump, 38, 16 - hump];
  lit(ctx, () => {
    ctx.moveTo(-20, 3);
    ctx.bezierCurveTo(-23, hump + 3, -8, hump, 0, hump + (startled ? 0 : 1));
    ctx.bezierCurveTo(8, hump + 1, 16, hump + 4, 17, -2);
    ctx.bezierCurveTo(16, 6, 6, 7, -2, 7);
    ctx.bezierCurveTo(-12, 7, -19, 7, -20, 3);
    ctx.closePath();
  }, box, cylV(ctx, hump, 8, FUR, 0.8), {
    inner: () => {
      stripes(ctx, [-12, -6, 0, 6], hump + 1, hump + 8);
      ctx.fillStyle = rgb(BELLY, 0.85);
      ctx.beginPath();
      ctx.ellipse(-1, 7, 12, 3.2, 0, 0, TAU);
      ctx.fill();
      mottle(ctx, r, box, 4, FUR_DARK, 0.2, 3, 6);
      if (startled) {
        // fur standing on end
        ctx.strokeStyle = rgb(FUR_DARK, 0.9);
        ctx.lineWidth = 0.8;
        for (let x = -16; x <= 12; x += 3) {
          ctx.beginPath();
          ctx.moveTo(x, hump + 3);
          ctx.lineTo(x + 0.6, hump + 0.5);
          ctx.stroke();
        }
      }
    },
  });
  if (startled) {
    // spiky fur outline along the arched back
    ctx.save();
    ctx.strokeStyle = OL;
    ctx.fillStyle = rgb(FUR);
    ctx.lineWidth = 1;
    for (let x = -14; x <= 12; x += 4) {
      const y = hump + 1 + Math.pow(x / 16, 2) * 7;
      ctx.beginPath();
      ctx.moveTo(x - 2, y + 1.5);
      ctx.lineTo(x, y - 3);
      ctx.lineTo(x + 2, y + 1.5);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  // head, out in front
  const hx = 20, hy = startled ? -8 : -4;
  if (startled) {
    ear(ctx, [hx - 6, hy - 5, hx - 4, hy - 13, hx - 1, hy - 6]);
    ear(ctx, [hx + 1, hy - 6, hx + 5, hy - 13, hx + 6, hy - 4]);
  } else {
    // ears flat back
    ear(ctx, [hx - 6, hy - 4, hx - 13, hy - 8, hx - 3, hy - 7]);
    ear(ctx, [hx - 2, hy - 6, hx - 7, hy - 11, hx + 1, hy - 7]);
  }
  lit(ctx, () => ell(ctx, hx, hy, 8, 7), [hx - 8, hy - 7, 16, 14], cylV(ctx, hy - 7, hy + 7, FUR, 0.8), {
    inner: () => stripes(ctx, [hx - 3, hx], hy - 7, hy - 3),
  });
  // muzzle
  lit(ctx, () => ell(ctx, hx + 4.5, hy + 3, 4, 3), [hx + 0.5, hy, 8, 6], rgb(BELLY), { lw: 0.8, bevel: 0, form: 0.3 });
  ctx.fillStyle = rgb(0xd0707a);
  ctx.beginPath();
  ctx.arc(hx + 7, hy + 1.6, 1, 0, TAU);
  ctx.fill();
  if (startled) {
    // open mouth mid-yowl
    ctx.fillStyle = rgb(0x5a1410);
    ctx.beginPath();
    ctx.ellipse(hx + 5, hy + 5, 2, 1.6, 0, 0, TAU);
    ctx.fill();
    eye(ctx, hx - 1, hy - 2, 2.6, 3, 0.1, 0);
    eye(ctx, hx + 4.5, hy - 2.2, 2.4, 2.9, 0.1, 0);
  } else {
    eye(ctx, hx + 1, hy - 1.5, 2.2, 2.6, 0.9, 0);
    eye(ctx, hx + 5.5, hy - 1.8, 1.9, 2.4, 0.9, 0);
  }
  whiskers(ctx, hx + 7, hy + 3, 1);
  sheen(ctx, -6, hump + 3, 7, 2.2, 0.3, -0.05);
};

/** "z z Z" for a sleeping cat. */
const paintZzz: Painter = (ctx) => {
  ctx.save();
  ctx.lineJoin = 'round';
  for (const [x, y, s] of [[-6, 6, 6], [0, 0, 8], [7, -7, 10]]) {
    ctx.font = `900 ${s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2;
    ctx.strokeStyle = OL;
    ctx.strokeText('z', x, y);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillText('z', x, y);
  }
  ctx.restore();
};

// ---------------------------------------------------------------------------
// Bell (bell body trapezoid (-10,-16)(10,-16)(21,18)(-21,18); wall bracket above; port (14,-30))
// ---------------------------------------------------------------------------

const BRASS = 0xc9973e;

const paintBellBracket: Painter = (ctx, _p, r) => {
  // wall plate
  const box: Box = [-9, -36, 18, 10];
  lit(ctx, () => rr(ctx, -9, -36, 18, 10, 2), box, metal(ctx, -9, -36, 9, -26, 0x5a4a3a), {
    inner: () => {
      scratches(ctx, r, box, 5, true, 0.25);
      edgeChips(ctx, r, box, 5, 'rgba(200,170,120,0.4)', 0.7);
    },
  });
  screw(ctx, -5.5, -31, 1.1, 0.4);
  screw(ctx, 5.5, -31, 1.1, -0.6);
  // yoke down to the bell's crown
  lit(ctx, () => rr(ctx, -2.2, -27, 4.4, 9, 1.2), [-2.2, -27, 4.4, 9], cylH(ctx, -2.2, 2.2, 0x4a3e34), { lw: 1.1 });
  hexBolt(ctx, 0, -20, 1.6, 0x8f949a);
};

/** The bell itself, origin at the pivot (0,-20) so it can swing. */
const paintBellBody: Painter = (ctx, _p, r) => {
  // clapper peeking out under the lip
  lit(ctx, () => circ(ctx, 0, 39, 3.2), [-3.2, 35.8, 6.4, 6.4], cylV(ctx, 35.8, 42.2, 0x4a4038), { lw: 1 });
  const shape = () => {
    ctx.moveTo(-6, 4);
    ctx.bezierCurveTo(-11, 4, -10, 14, -11, 22);
    ctx.bezierCurveTo(-12, 30, -18, 34, -22, 37);
    ctx.lineTo(22, 37);
    ctx.bezierCurveTo(18, 34, 12, 30, 11, 22);
    ctx.bezierCurveTo(10, 14, 11, 4, 6, 4);
    ctx.closePath();
  };
  const box: Box = [-22, 4, 44, 34];
  lit(ctx, shape, box, cylH(ctx, -22, 22, BRASS, 1.1), {
    inner: () => {
      mottle(ctx, r, box, 6, 0x5a6a3a, 0.22, 2, 5);
      ctx.fillStyle = 'rgba(60,40,10,0.35)';
      ctx.fillRect(-22, 28, 44, 1.2);
      ctx.fillRect(-22, 32.5, 44, 0.8);
      scratches(ctx, r, box, 6, true, 0.3);
    },
  });
  // crown loop
  lit(ctx, () => { circ(ctx, 0, 1.5, 3.4); circ(ctx, 0, 1.5, 1.6); }, [-3.4, -1.9, 6.8, 6.8], cylV(ctx, -2, 5, BRASS), { rule: 'evenodd', lw: 1 });
  lit(ctx, () => rr(ctx, -23, 35.5, 46, 3.6, 1.6), [-23, 35.5, 46, 3.6], cylV(ctx, 35.5, 39, shade(BRASS, -0.1)), { lw: 1.1, bevel: 0.4 });
  sheen(ctx, -5, 18, 2.4, 9, 0.6, 0.15);
  glint(ctx, -5, 12, 1.8, 0.9);
};

// ---------------------------------------------------------------------------
// Basketball hoop (backboard 8 × 84 at x -32; rim from x -22 to 30 at y 14; net below)
// ---------------------------------------------------------------------------

const paintHoopBoard: Painter = (ctx, _p, r) => {
  // a wall bracket behind the board
  lit(ctx, () => rr(ctx, -40, -10, 6, 20, 1.4), [-40, -10, 6, 20], cylH(ctx, -40, -34, 0x4a4e52), { lw: 1 });
  const box: Box = [-36, -42, 8, 84];
  lit(ctx, () => rr(ctx, -36, -42, 8, 84, 2), box, cylH(ctx, -36, -28, 0xeef0ec, 0.6), {
    inner: () => {
      // the orange target square seen edge-on
      ctx.fillStyle = rgb(0xe0622a);
      ctx.fillRect(-29.5, -6, 1.5, 22);
      ctx.fillStyle = rgb(0x2a5ea8);
      ctx.fillRect(-36, -42, 8, 3);
      ctx.fillRect(-36, 39, 8, 3);
      scratches(ctx, r, box, 6, false, 0.2);
      grimeBottom(ctx, box, 0.25);
    },
  });
  for (const y of [-32, 32]) screw(ctx, -32, y, 1.1, 0.3);
  // rim bracket from the board to the near post
  lit(ctx, () => poly(ctx, [-28, 10, -22, 12, -22, 16, -28, 20]), [-28, 10, 6, 10], cylV(ctx, 10, 20, 0x5a5e62), { lw: 1 });
  glint(ctx, -34, -36, 1.4, 0.7);
};

/** The rim seen from the side: a flat orange ring with its two end posts. Drawn in front. */
const paintHoopRim: Painter = (ctx) => {
  lit(ctx, () => ell(ctx, 4, 14, 26.5, 3.4), [-22.5, 10.6, 53, 6.8], lin(ctx, 0, 10.6, 0, 17.4, [
    [0, rgb(0xf08038)],
    [0.3, rgb(0xffb070)],
    [0.55, rgb(0xd9561c)],
    [1, rgb(0x8a3010)],
  ]), { lw: 1.2, form: 0, bevel: 0 });
  // hollow middle: the back half of the ring is hidden by the net strings
  ctx.fillStyle = 'rgba(30,14,8,0.55)';
  ctx.beginPath();
  ctx.ellipse(4, 13.8, 23, 1.6, 0, 0, TAU);
  ctx.fill();
  for (const x of [-22, 30]) lit(ctx, () => circ(ctx, x, 14, 3), [x - 3, 11, 6, 6], cylV(ctx, 11, 17, 0xd9561c), { lw: 1 });
};

/** White string net hanging under the rim (y 14…48). */
const paintHoopNet: Painter = (ctx) => {
  const top = 15, bot = 46;
  const xt = (u: number) => -21 + u * 50;
  const xb = (u: number) => -11 + u * 30;
  const lines: [number, number, number, number][] = [];
  const N = 7;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    // diagonal criss-cross strings
    lines.push([xt(u), top, xb(Math.min(1, u + 1 / N)), bot]);
    lines.push([xt(u), top, xb(Math.max(0, u - 1 / N)), bot]);
  }
  ctx.save();
  ctx.lineCap = 'round';
  for (const [pass, w, col] of [[0, 1.7, 'rgba(29,22,18,0.6)'], [1, 0.9, 'rgba(250,248,240,0.95)']] as const) {
    void pass;
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    for (const [x0, y0, x1, y1] of lines) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + (x1 - x0) * 0.1, (y0 + y1) / 2, x1, y1);
      ctx.stroke();
    }
    // horizontal knots rows
    for (const t of [0.35, 0.7, 1]) {
      const y = top + (bot - top) * t;
      const l = -21 + 10 * t, rr2 = 29 - 10 * t;
      ctx.beginPath();
      ctx.moveTo(l, y);
      ctx.quadraticCurveTo((l + rr2) / 2, y + 2, rr2, y);
      ctx.stroke();
    }
  }
  ctx.restore();
};

export const GOOFY_DEFS: Record<string, PartDef> = {
  basketball: { size: () => centred(36, 36), paint: paintBasketball },
  rubber_chicken: { size: () => [68, 42, 34, 22], paint: chickenPainter(false) },
  chicken_squawk: { size: () => [68, 42, 34, 22], paint: chickenPainter(true) },
  mousetrap: { size: () => [68, 22, 34, 14], paint: paintMousetrap },
  trap_bar: { size: () => [32, 6, 2, 3], paint: paintTrapBar },
  toaster: { size: () => [74, 48, 36, 21], paint: paintToaster },
  toaster_lever: { size: () => centred(14, 8), paint: paintToasterLever },
  toast: { size: () => centred(30, 30), paint: paintToast },
  teapot: { size: () => [78, 46, 37, 19], paint: paintTeapot },
  teapot_lid: { size: () => [28, 14, 14, 9], paint: paintTeapotLid },
  bowling_pin: { size: () => centred(24, 60), paint: paintBowlingPin },
  cat: { size: () => [56, 36, 26, 18], paint: paintCatSleep },
  cat_run_0: { size: () => [74, 40, 36, 22], paint: catRunPainter(0) },
  cat_run_1: { size: () => [74, 40, 36, 22], paint: catRunPainter(1) },
  cat_startle: { size: () => [74, 44, 36, 26], paint: catRunPainter(0, true) },
  zzz: { size: () => centred(24, 24), paint: paintZzz },
  bell: { size: () => [24, 18, 12, 37], paint: paintBellBracket },
  bell_body: { size: () => [48, 46, 24, 3], paint: paintBellBody },
  basketball_hoop: { size: () => [44, 88, 42, 44], paint: paintHoopBoard },
  hoop_rim: { size: () => [62, 20, 27, 0], paint: paintHoopRim },
  hoop_net: { size: () => [56, 50, 24, 0], paint: paintHoopNet },
};

/** Parts-bin icon layers for the goofy parts (shared local frame). */
export function goofyIconLayers(type: string): { key: string; x?: number; y?: number; rot?: number }[] | null {
  switch (type) {
    case 'basketball': return [{ key: 'basketball', rot: 0.3 }, { key: 'shine_s' }];
    case 'rubber_chicken': return [{ key: 'chicken_squawk', rot: -0.15 }];
    case 'mousetrap': return [{ key: 'mousetrap' }, { key: 'trap_bar', x: 0, y: -5, rot: -Math.PI }];
    case 'toaster': return [{ key: 'toast', x: -11, y: -12 }, { key: 'toast', x: 11, y: -12 }, { key: 'toaster' }, { key: 'toaster_lever', x: 35, y: -8 }];
    case 'teapot': return [{ key: 'teapot' }, { key: 'teapot_lid', y: -14 }];
    case 'bowling_pin': return [{ key: 'bowling_pin', rot: 0.12 }];
    case 'cat': return [{ key: 'cat' }, { key: 'zzz', x: 6, y: -22 }];
    case 'bell': return [{ key: 'bell' }, { key: 'bell_body', y: -20 }];
    case 'basketball_hoop': return [{ key: 'basketball_hoop' }, { key: 'hoop_net' }, { key: 'hoop_rim' }];
    default: return null;
  }
}

