/**
 * Procedural part art for Follyworks (see docs/ART_SPEC.md).
 *
 * Every texture is painted with Canvas 2D in *world units*: `paintPart` scales
 * the context by `scale` and translates to the texture origin, so painters use
 * the component's local frame directly (x right, y down, origin = placement
 * point). Output is deterministic (seeded per key + params) and never throws.
 */

import {
  type Ctx, type Box, OL, LW, LW_IN, KEY_LIGHT, BOUNCE,
  Rand, hashStr, rgb, mix, shade, cool,
  rr, chamferRect, poly, circ, ell, gearPath,
  lin, rad, cylV, cylH, metal,
  lit, outline, clipped, seam, tube, formShade,
  speckle, mottle, scratches, grimeBottom, edgeChips, woodGrain,
  rivet, screw, hexBolt, glint, sheen, coilSpring, smoothPath, label, hazard, dropShadow,
} from './partHelpers';

export interface PaintedTexture {
  canvas: HTMLCanvasElement;
  /** origin in canvas pixels */
  ox: number;
  oy: number;
}

type Params = Record<string, string | number | boolean>;
type Painter = (ctx: Ctx, p: Params, r: Rand) => void;
/** [w, h, ox, oy] in world units. */
type Size = [number, number, number, number];

interface PartDef {
  size: (p: Params) => Size;
  paint: Painter;
}

/** Where Bolt's visor sits in the robot_body local frame (place `robot_eye` here, mirrored when flipped). */
export const ROBOT_EYE = { x: 4.6, y: -15.8 };

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const PAL = {
  steel: 0x8b9398,
  steelDark: 0x515a60,
  iron: 0x34363b,
  brass: 0xc39545,
  copper: 0xb96a3c,
  rubber: 0x2a2727,
  ivory: 0xece0c3,
  cream: 0xeadcbc,
  terracotta: 0xb75f3c,
  orange: 0xdc7430,
  red: 0xbf362b,
  teal: 0x5a807c,
  mint: 0x7fae9c,
  mustard: 0xcf9f3c,
  cyan: 0x5fe8f4,
  green: 0x7fe05a,
  crateWood: 0x9a6a3d,
  pine: 0xbc8a52,
  oak: 0x6f4b2d,
} as const;

const num = (p: Params, k: string, d: number): number => {
  const v = p[k];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : d;
};
const str = (p: Params, k: string, d: string): string => {
  const v = p[k];
  return typeof v === 'string' ? v : d;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const centred = (w: number, h: number): Size => [w, h, w / 2, h / 2];
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Spheres
// ---------------------------------------------------------------------------

/** Rotation-invariant rim darkening for a sphere texture. */
function sphereEdge(ctx: Ctx, R: number, a = 0.4): void {
  ctx.fillStyle = rad(ctx, 0, 0, R * 0.5, 0, 0, R, [
    [0, 'rgba(30,12,6,0)'],
    [1, `rgba(30,12,6,${a})`],
  ]);
  ctx.fillRect(-R, -R, R * 2, R * 2);
}

const paintBall: Painter = (ctx, _p, r) => {
  const R = 14;
  const base = 0xc4553a;
  const box: Box = [-R, -R, R * 2, R * 2];
  lit(ctx, () => circ(ctx, 0, 0, R), box, rgb(base), {
    form: 0,
    bevel: 0,
    inner: () => {
      mottle(ctx, r, box, 7, 0x8a2a18, 0.28, 2, 6);
      mottle(ctx, r, box, 5, 0xe0795a, 0.18, 2, 5);
      // cream band (curved so the sphere reads)
      ctx.beginPath();
      ctx.moveTo(-16, -5.2);
      ctx.quadraticCurveTo(0, -1.2, 16, -5.2);
      ctx.lineTo(16, 1.6);
      ctx.quadraticCurveTo(0, 6.4, -16, 1.6);
      ctx.closePath();
      ctx.fillStyle = rgb(0xecdcb6);
      ctx.fill();
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = rgb(0x6e2414, 0.9);
      ctx.beginPath();
      ctx.moveTo(-16, -5.2);
      ctx.quadraticCurveTo(0, -1.2, 16, -5.2);
      ctx.moveTo(16, 1.6);
      ctx.quadraticCurveTo(0, 6.4, -16, 1.6);
      ctx.stroke();
      // thin pinstripe in the middle of the band
      ctx.lineWidth = 0.45;
      ctx.strokeStyle = rgb(0xc4553a, 0.85);
      ctx.beginPath();
      ctx.moveTo(-16, -1.8);
      ctx.quadraticCurveTo(0, 2.6, 16, -1.8);
      ctx.stroke();
      // valve plug + little star decal: they make the spin legible
      ctx.fillStyle = rgb(0x2a1a14);
      ctx.beginPath();
      ctx.ellipse(4.5, 9.5, 1.3, 1, 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgb(0xecdcb6, 0.9);
      star(ctx, -4, -9.5, 2.4, 1.0);
      speckle(ctx, r, box, 60, ['rgba(40,14,6,0.25)', 'rgba(255,230,200,0.18)'], 0.15, 0.4);
      scratches(ctx, r, box, 8, true, 0.25);
      sphereEdge(ctx, R, 0.42);
    },
  });
};

function star(ctx: Ctx, x: number, y: number, ro: number, ri: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr2 = i % 2 === 0 ? ro : ri;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
    else ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  ctx.closePath();
  ctx.fill();
}

const shinePainter = (R: number): Painter => (ctx) => {
  ctx.save();
  ctx.beginPath();
  circ(ctx, 0, 0, R + 0.3);
  ctx.clip();
  // terminator / core shadow toward lower-right
  ctx.fillStyle = rad(ctx, -R * 0.38, -R * 0.45, 0, -R * 0.2, -R * 0.25, R * 1.55, [
    [0, 'rgba(0,0,0,0)'],
    [0.45, 'rgba(0,0,0,0)'],
    [0.78, 'rgba(16,8,22,0.3)'],
    [1, 'rgba(10,4,16,0.62)'],
  ]);
  ctx.fillRect(-R - 1, -R - 1, R * 2 + 2, R * 2 + 2);
  // broad warm key light
  ctx.fillStyle = rad(ctx, -R * 0.38, -R * 0.42, 0, -R * 0.38, -R * 0.42, R * 0.8, [
    [0, 'rgba(255,238,210,0.42)'],
    [1, 'rgba(255,238,210,0)'],
  ]);
  ctx.fillRect(-R, -R, R * 2, R * 2);
  // cool bounce rim (lower right)
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(150,200,230,${(0.16 - i * 0.045).toFixed(3)})`;
    ctx.lineWidth = R * (0.08 + i * 0.07);
    ctx.beginPath();
    ctx.arc(0, 0, R - R * (0.06 + i * 0.03), -0.15, 1.85);
    ctx.stroke();
  }
  // warm thin rim at the top-left edge
  ctx.strokeStyle = 'rgba(255,226,180,0.22)';
  ctx.lineWidth = R * 0.06;
  ctx.beginPath();
  ctx.arc(0, 0, R - R * 0.05, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  ctx.restore();
  // specular
  sheen(ctx, -R * 0.36, -R * 0.44, R * 0.3, R * 0.17, 0.75, -0.75);
  glint(ctx, -R * 0.44, -R * 0.5, R * 0.16, 0.95);
};

const paintBowling: Painter = (ctx, _p, r) => {
  const R = 20;
  const box: Box = [-R, -R, R * 2, R * 2];
  lit(ctx, () => circ(ctx, 0, 0, R), box, rgb(0x2d2b31), {
    form: 0,
    bevel: 0,
    inner: () => {
      mottle(ctx, r, box, 10, 0x4b4756, 0.35, 3, 8);
      mottle(ctx, r, box, 5, 0x161418, 0.4, 3, 7);
      // casting marbling
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = `rgba(110,104,124,${r.range(0.08, 0.2).toFixed(3)})`;
        ctx.lineWidth = r.range(0.4, 1.2);
        const a = r.range(0, TAU);
        const rr2 = r.range(5, 17);
        ctx.beginPath();
        ctx.arc(r.range(-4, 4), r.range(-4, 4), rr2, a, a + r.range(0.6, 1.6));
        ctx.stroke();
      }
      speckle(ctx, r, box, 70, ['rgba(160,82,40,0.45)', 'rgba(120,60,30,0.4)', 'rgba(190,180,200,0.15)'], 0.15, 0.45);
      mottle(ctx, r, box, 4, 0x7a3c1c, 0.22, 1.5, 3.5);
      // finger holes
      const holes: [number, number, number][] = [[3.5, -10, 2.6], [10.5, -6.5, 2.6], [5.5, 1.5, 3.2]];
      for (const [x, y, hr] of holes) {
        ctx.fillStyle = 'rgba(80,76,90,0.6)';
        ctx.beginPath();
        ctx.arc(x + 0.3, y + 0.4, hr + 0.8, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rad(ctx, x - hr * 0.3, y - hr * 0.3, 0, x, y, hr, [
          [0, '#050407'],
          [0.75, '#0b0a0d'],
          [1, '#3a3742'],
        ]);
        ctx.beginPath();
        ctx.arc(x, y, hr, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = OL;
        ctx.stroke();
      }
      scratches(ctx, r, box, 12, true, 0.18);
      sphereEdge(ctx, R, 0.5);
    },
  });
};

const paintCannonball: Painter = (ctx, _p, r) => {
  const R = 12;
  const box: Box = [-R, -R, R * 2, R * 2];
  lit(ctx, () => circ(ctx, 0, 0, R), box, rgb(0x2b2c30), {
    form: 0,
    bevel: 0,
    inner: () => {
      mottle(ctx, r, box, 6, 0x4c4e55, 0.35, 2, 5);
      speckle(ctx, r, box, 50, ['rgba(10,10,12,0.6)', 'rgba(150,150,160,0.18)', 'rgba(130,70,40,0.35)'], 0.15, 0.4);
      // casting seam
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(12,12,14,0.85)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-13, 0.4);
      ctx.quadraticCurveTo(0, 3, 13, 0.4);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(190,190,200,0.35)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(-13, -0.4);
      ctx.quadraticCurveTo(0, 2.2, 13, -0.4);
      ctx.stroke();
      // sprue nub
      ctx.fillStyle = 'rgba(80,82,90,0.8)';
      ctx.beginPath();
      ctx.arc(-3, -7.5, 1.1, 0, TAU);
      ctx.fill();
      sphereEdge(ctx, R, 0.5);
    },
  });
};

// ---------------------------------------------------------------------------
// Crates, domino, plank, seesaw, fulcrum
// ---------------------------------------------------------------------------

function nail(ctx: Ctx, x: number, y: number, rr2 = 0.9): void {
  ctx.fillStyle = 'rgba(80,40,15,0.35)';
  ctx.beginPath();
  ctx.arc(x + 0.2, y + 0.3, rr2 * 1.9, 0, TAU);
  ctx.fill();
  rivet(ctx, x, y, rr2, 0x7a7670);
}

const paintCrateWood: Painter = (ctx, _p, r) => {
  const box: Box = [-22, -22, 44, 44];
  const sil = () => chamferRect(ctx, -22, -22, 44, 44, 3);
  lit(ctx, sil, box, rgb(0x2c1b0f), {
    bevel: 0.8,
    form: 0.9,
    inner: () => {
      // inner slats (recessed)
      const slatW = 10;
      for (let i = 0; i < 3; i++) {
        const x = -16 + i * (slatW + 1);
        const b = mix(PAL.crateWood, 0x6b4526, 0.3 + r.range(-0.1, 0.15));
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, -16, slatW, 32);
        ctx.clip();
        woodGrain(ctx, r, x, -16, slatW, 32, { base: b, dir: 'v', knots: r.chance(0.5) ? 1 : 0 });
        ctx.restore();
        seam(ctx, x + slatW + 0.5, -16, x + slatW + 0.5, 16, 0.7);
      }
      // faint stencil, then the panel's recess shadow
      label(ctx, 'FW', 0, 1, 11, 'rgba(36,16,8,0.32)', { weight: '900' });
      label(ctx, 'THIS SIDE UP', 0, 9.5, 2.6, 'rgba(36,16,8,0.3)');
      ctx.fillStyle = lin(ctx, 0, -16, 0, -11, [[0, 'rgba(20,10,4,0.55)'], [1, 'rgba(20,10,4,0)']]);
      ctx.fillRect(-16, -16, 32, 5);
      ctx.fillStyle = lin(ctx, -16, 0, -12, 0, [[0, 'rgba(20,10,4,0.45)'], [1, 'rgba(20,10,4,0)']]);
      ctx.fillRect(-16, -16, 4, 32);
      // diagonal brace
      ctx.save();
      ctx.beginPath();
      ctx.rect(-16, -16, 32, 32);
      ctx.clip();
      ctx.rotate(-Math.PI / 4);
      const bl = 48;
      ctx.fillStyle = 'rgba(20,10,4,0.4)';
      ctx.fillRect(-bl / 2 + 0.6, -3.5 + 1.2, bl, 7);
      lit(ctx, () => ctx.rect(-bl / 2, -3.5, bl, 7), [-bl / 2, -3.5, bl, 7], rgb(PAL.crateWood), {
        lw: 1,
        bevel: 0.6,
        form: 0.6,
        inner: () => woodGrain(ctx, r, -bl / 2, -3.5, bl, 7, { base: shade(PAL.crateWood, 0.05), knots: 0 }),
      });
      nail(ctx, -14, 0);
      nail(ctx, 14, 0);
      ctx.restore();
      // frame boards
      const board = (x: number, y: number, w: number, h: number, dir: 'h' | 'v') => {
        const b = mix(PAL.crateWood, 0xb07c48, r.range(0, 0.5));
        lit(ctx, () => ctx.rect(x, y, w, h), [x, y, w, h], rgb(b), {
          lw: 1,
          bevel: 0.7,
          form: 0.5,
          inner: () => woodGrain(ctx, r, x, y, w, h, { base: b, dir, knots: r.chance(0.4) ? 1 : 0 }),
        });
      };
      board(-23, -23, 46, 7, 'h');
      board(-23, 16, 46, 7, 'h');
      board(-23, -16, 7, 32, 'v');
      board(16, -16, 7, 32, 'v');
      for (const [x, y] of [[-19, -19], [19, -19], [-19, 19], [19, 19], [-6, -19.4], [6, 19.4], [-19.4, 5], [19.4, -5]] as const) nail(ctx, x, y);
      speckle(ctx, r, box, 90, ['rgba(30,14,6,0.3)', 'rgba(255,220,170,0.12)'], 0.15, 0.45);
      scratches(ctx, r, box, 14, true, 0.28);
      edgeChips(ctx, r, box, 14, 'rgba(230,190,140,0.35)', 1);
      grimeBottom(ctx, box, 0.3);
    },
  });
};

const paintCrateSteel: Painter = (ctx, _p, r) => {
  const box: Box = [-22, -22, 44, 44];
  const paint = 0x4d6a6a;
  const sil = () => chamferRect(ctx, -22, -22, 44, 44, 2.5);
  lit(ctx, sil, box, metal(ctx, -22, -22, 22, 22, paint), {
    bevel: 1,
    inner: () => {
      mottle(ctx, r, box, 10, shade(paint, -0.25), 0.25, 3, 8);
      // recessed centre panel
      const pb: Box = [-15, -15, 30, 30];
      lit(ctx, () => rr(ctx, -15, -15, 30, 30, 1.5), pb, rgb(shade(paint, -0.18)), {
        lw: 0.9,
        bevel: 0.8,
        hi: `${BOUNCE}0.25)`,
        lo: `${KEY_LIGHT}0.35)`,
        form: 0.4,
        inner: () => {
          // embossed X stiffener
          ctx.lineCap = 'round';
          for (const [a, b2, c, d] of [[-13, -13, 13, 13], [13, -13, -13, 13]]) {
            ctx.strokeStyle = 'rgba(16,20,22,0.6)';
            ctx.lineWidth = 3.6;
            ctx.beginPath();
            ctx.moveTo(a + 0.5, b2 + 0.7);
            ctx.lineTo(c + 0.5, d + 0.7);
            ctx.stroke();
            ctx.strokeStyle = rgb(shade(paint, 0.08));
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(a, b2);
            ctx.lineTo(c, d);
            ctx.stroke();
            ctx.strokeStyle = `${KEY_LIGHT}0.35)`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a - 0.7, b2 - 0.5);
            ctx.lineTo(c - 0.7, d - 0.5);
            ctx.stroke();
          }
          label(ctx, 'HEAVY', 0, -9.5, 3.4, 'rgba(236,224,196,0.55)', { weight: '900' });
          label(ctx, '250 kg', 0, 10, 2.6, 'rgba(236,224,196,0.45)');
        },
      });
      // hazard corners
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        ctx.save();
        ctx.beginPath();
        poly(ctx, [sx * 22, sy * 22, sx * 10, sy * 22, sx * 22, sy * 10]);
        ctx.clip();
        hazard(ctx, [-22, -22, 44, 44], 3.2, 0xd9a42a, 0x221b16, -0.785 * sx * sy);
        ctx.restore();
        seam(ctx, sx * 10, sy * 22, sx * 22, sy * 10, 0.7);
      }
      // rivet rows on the frame
      for (let x = -11; x <= 11; x += 5.5) {
        rivet(ctx, x, -18.5, 0.9, 0x9aa2a2);
        rivet(ctx, x, 18.5, 0.9, 0x9aa2a2);
        rivet(ctx, -18.5, x, 0.9, 0x9aa2a2);
        rivet(ctx, 18.5, x, 0.9, 0x9aa2a2);
      }
      // rust streaks under a few rivets
      for (let i = 0; i < 4; i++) {
        const x = r.range(-12, 12);
        const y = r.chance(0.5) ? -17.5 : 19.4;
        ctx.fillStyle = lin(ctx, 0, y, 0, y + 7, [[0, 'rgba(150,70,25,0.45)'], [1, 'rgba(150,70,25,0)']]);
        ctx.fillRect(x - 0.6, y, 1.2, 7);
      }
      edgeChips(ctx, r, box, 26, 'rgba(178,182,178,0.85)', 1.1);
      scratches(ctx, r, box, 22, true, 0.35);
      speckle(ctx, r, box, 80, ['rgba(10,14,16,0.25)', 'rgba(220,230,225,0.12)'], 0.15, 0.4);
      grimeBottom(ctx, box, 0.35);
    },
  });
};

const paintDomino: Painter = (ctx, _p, r) => {
  const box: Box = [-6, -29, 12, 58];
  lit(ctx, () => rr(ctx, -6, -29, 12, 58, 2.6), box, cylH(ctx, -6, 6, PAL.ivory, 0.8), {
    form: 0.6,
    inner: () => {
      mottle(ctx, r, box, 8, 0xc9a86a, 0.18, 2, 6);
      grimeBottom(ctx, box, 0.12);
      seam(ctx, -4.6, 0, 4.6, 0, 0.75);
      const pip = (x: number, y: number) => {
        ctx.fillStyle = 'rgba(255,250,235,0.6)';
        ctx.beginPath();
        ctx.arc(x + 0.25, y + 0.3, 1.7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rad(ctx, x - 0.4, y - 0.5, 0, x, y, 1.6, [[0, '#0d0a08'], [0.7, '#1c1612'], [1, '#3a2f26']]);
        ctx.beginPath();
        ctx.arc(x, y, 1.55, 0, TAU);
        ctx.fill();
      };
      pip(-3, -22.5); pip(0, -14.5); pip(3, -6.5);
      pip(-3, 6.5); pip(3, 6.5); pip(0, 14.5); pip(-3, 22.5); pip(3, 22.5);
      rivet(ctx, 0, 0, 1.15, PAL.brass);
      scratches(ctx, r, box, 6, false, 0.18);
      speckle(ctx, r, box, 25, ['rgba(120,90,40,0.25)'], 0.1, 0.3);
    },
  });
};

const paintPlank: Painter = (ctx, p, r) => {
  const L = clamp(num(p, 'length', 160), 10, 4000);
  const x0 = -L / 2;
  const box: Box = [x0, -7, L, 14];
  const base = PAL.pine;
  lit(ctx, () => rr(ctx, x0, -7, L, 14, 1.8), box, rgb(base), {
    form: 0.8,
    inner: () => {
      woodGrain(ctx, r, x0, -7, L, 14, { base, knots: Math.max(0, Math.round(L / 130 + r.range(-0.5, 0.5))), lineGap: 1.3 });
      // top face catch-light and lower edge
      ctx.fillStyle = 'rgba(255,226,170,0.22)';
      ctx.fillRect(x0, -7, L, 1.6);
      ctx.fillStyle = 'rgba(40,20,8,0.25)';
      ctx.fillRect(x0, 5, L, 2);
      // end grain caps
      for (const s of [-1, 1]) {
        const ex = s < 0 ? x0 : -x0 - 2.6;
        ctx.save();
        ctx.beginPath();
        ctx.rect(ex, -7, 2.6, 14);
        ctx.clip();
        ctx.fillStyle = rgb(shade(base, -0.18));
        ctx.fillRect(ex, -7, 2.6, 14);
        const cx = s < 0 ? x0 - 5 : -x0 + 5;
        ctx.strokeStyle = rgb(shade(base, -0.45), 0.55);
        ctx.lineWidth = 0.3;
        for (let rr2 = 2; rr2 < 14; rr2 += 1.1) {
          ctx.beginPath();
          ctx.arc(cx, 3, rr2, 0, TAU);
          ctx.stroke();
        }
        ctx.restore();
        seam(ctx, s < 0 ? ex + 2.6 : ex, -6.5, s < 0 ? ex + 2.6 : ex, 6.5, 0.45);
      }
      // nails: near both ends, then every ~110 units
      const nx: number[] = [x0 + 6, -x0 - 6];
      if (L > 220) for (let x = x0 + 110; x < -x0 - 60; x += 110) nx.push(x + r.range(-8, 8));
      for (const x of nx) {
        nail(ctx, x, -3.2, 0.8);
        nail(ctx, x + r.range(-0.6, 0.6), 3.4, 0.8);
      }
      scratches(ctx, r, box, Math.round(L / 12), true, 0.28);
      speckle(ctx, r, box, Math.round(L / 3), ['rgba(40,20,8,0.28)', 'rgba(255,230,190,0.15)'], 0.12, 0.35);
      edgeChips(ctx, r, box, Math.round(L / 25), 'rgba(80,45,20,0.45)', 0.9);
    },
  });
};

const paintSeesawPlank: Painter = (ctx, p, r) => {
  const L = clamp(num(p, 'length', 220), 20, 4000);
  const x0 = -L / 2;
  const box: Box = [x0, -6, L, 12];
  const paint = PAL.teal;
  lit(ctx, () => rr(ctx, x0, -6, L, 12, 2), box, rgb(paint), {
    form: 0.9,
    inner: () => {
      woodGrain(ctx, r, x0, -6, L, 12, { base: paint, dark: shade(paint, -0.28), light: shade(paint, 0.15), knots: 0, lineGap: 2 });
      mottle(ctx, r, box, Math.round(L / 20), shade(paint, 0.2), 0.2, 3, 8);
      // cream pinstripes near the ends
      for (const s of [-1, 1]) {
        for (const off of [20, 23.5]) {
          ctx.fillStyle = 'rgba(236,222,190,0.75)';
          ctx.fillRect(s * (L / 2 - off) - 0.6, -6, 1.2, 12);
        }
      }
      // worn paint: bare wood showing on the edges
      edgeChips(ctx, r, box, Math.round(L / 6), rgb(0xa77a49), 1.3);
      edgeChips(ctx, r, box, Math.round(L / 14), 'rgba(236,222,190,0.35)', 0.8);
      scratches(ctx, r, box, Math.round(L / 10), true, 0.3);
      grimeBottom(ctx, box, 0.25);
    },
  });
  // steel end lips that keep a parked ball from rolling off
  for (const s of [-1, 1]) {
    const lx = s * (L / 2 - 3) - 3;
    lit(ctx, () => rr(ctx, lx, -16, 6, 11, 1.2), [lx, -16, 6, 11], metal(ctx, lx, -16, lx + 6, -5, 0x8a9296), { lw: 1.1 });
    hexBolt(ctx, lx + 3, -9, 1);
  }
  // steel centre bracket
  lit(ctx, () => rr(ctx, -10, -7.3, 20, 14.6, 1.6), [-10, -7.3, 20, 14.6], metal(ctx, -10, -7, 10, 7, 0x8a9296), {
    lw: 1.3,
    inner: () => {
      scratches(ctx, r, [-10, -7, 20, 14], 6, true, 0.3);
      ctx.fillStyle = 'rgba(16,10,6,0.35)';
      ctx.beginPath();
      ctx.arc(0.4, 0.5, 4.4, 0, TAU);
      ctx.fill();
    },
  });
  for (const [x, y] of [[-6.6, -3.8], [6.6, -3.8], [-6.6, 3.8], [6.6, 3.8]]) hexBolt(ctx, x, y, 1.25);
  lit(ctx, () => circ(ctx, 0, 0, 3.9), [-3.9, -3.9, 7.8, 7.8], rad(ctx, -1, -1, 0, 0, 0, 3.9, [[0, rgb(0xd0d4d4)], [1, rgb(0x5d666a)]]), { lw: 1 });
  hexBolt(ctx, 0, 0, 1.8, 0xb79a5a);
  // eye bolts for ropes
  for (const s of [-1, 1]) {
    const x = s * (L / 2 - 10);
    ctx.fillStyle = 'rgba(16,10,6,0.35)';
    ctx.fillRect(x - 2, -5.4, 4.4, 1.6);
    lit(ctx, () => rr(ctx, x - 2, -6.4, 4, 1.8, 0.6), [x - 2, -6.4, 4, 1.8], rgb(0x9aa1a4), { lw: 0.8, bevel: 0.4 });
    tube(ctx, () => { ctx.arc(x, -5.9, 1.25, Math.PI * 0.95, Math.PI * 2.05); }, 0.75, 0xb6bcbf, { lw: 0.55 });
  }
};

const paintFulcrum: Painter = (ctx, _p, r) => {
  const steel = 0x5f6c74;
  // back gusset plate (keeps the silhouette solid)
  const tri = () => poly(ctx, [0, 1.5, 22.5, 33, -22.5, 33]);
  lit(ctx, tri, [-22, 1, 44, 32], rgb(0x343c40), {
    inner: () => {
      speckle(ctx, r, [-22, 1, 44, 32], 60, ['rgba(0,0,0,0.3)', 'rgba(200,210,215,0.1)'], 0.15, 0.4);
      // shadows cast by the legs onto the plate
      ctx.fillStyle = 'rgba(10,8,8,0.45)';
      ctx.beginPath();
      poly(ctx, [1.5, 9, 14, 31, 10, 31, 0.5, 13]);
      ctx.fill();
    },
  });
  // legs
  const leg = (s: number) => () => poly(ctx, [s * -1, 2, s * 4.6, 3.5, s * 22.6, 32.5, s * 15.5, 32.5]);
  for (const s of [-1, 1]) {
    lit(ctx, leg(s), [Math.min(s * -1, s * 22.6), 2, 23, 31], metal(ctx, -20, 0, 20, 30, steel), {
      lw: 1.3,
      inner: () => {
        scratches(ctx, r, [-22, 0, 44, 33], 8, true, 0.3);
        edgeChips(ctx, r, [-22, 0, 44, 33], 10, 'rgba(190,195,195,0.6)', 0.8);
      },
    });
  }
  // cross brace
  lit(ctx, () => rr(ctx, -13, 20.5, 26, 3.6, 1), [-13, 20.5, 26, 3.6], cylV(ctx, 20.5, 24.1, steel), { lw: 1.2 });
  rivet(ctx, -11, 22.3, 0.9); rivet(ctx, 11, 22.3, 0.9);
  // foot plate with hazard band
  lit(ctx, () => rr(ctx, -25, 31, 50, 5.6, 1.6), [-25, 31, 50, 5.6], cylV(ctx, 31, 36.6, 0x474f53), {
    lw: 1.4,
    inner: () => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-14, 31.8, 28, 3.6);
      ctx.clip();
      hazard(ctx, [-14, 31.8, 28, 3.6], 3, 0xdba32c, 0x241c16, -0.8);
      ctx.restore();
      seam(ctx, -14, 31.8, -14, 35.4, 0.6);
      seam(ctx, 14, 31.8, 14, 35.4, 0.6);
      grimeBottom(ctx, [-25, 31, 50, 5.6], 0.4);
    },
  });
  hexBolt(ctx, -20, 33.8, 1.3); hexBolt(ctx, 20, 33.8, 1.3);
  // pivot boss at the apex
  lit(ctx, () => circ(ctx, 0, 5, 4.6), [-4.6, 0.4, 9.2, 9.2], rad(ctx, -1.5, 3.5, 0, 0, 5, 4.6, [[0, rgb(0xe0c27a)], [0.6, rgb(PAL.brass)], [1, rgb(0x7a5a24)]]), { lw: 1.3 });
  hexBolt(ctx, 0, 5, 1.9, 0x9aa0a4);
};

// ---------------------------------------------------------------------------
// Trampoline
// ---------------------------------------------------------------------------

const paintTrampFrame: Painter = (ctx, _p, r) => {
  const steel = 0x8b959a;
  // back legs
  for (const x of [-30, 30]) {
    tube(ctx, () => { ctx.moveTo(x, 6); ctx.lineTo(x + Math.sign(x) * 1.5, 13); }, 2.2, shade(steel, -0.35));
  }
  // front legs + rubber feet
  for (const x of [-42, 42]) {
    tube(ctx, () => { ctx.moveTo(x * 0.96, 5); ctx.lineTo(x, 12.8); }, 2.6, steel);
    lit(ctx, () => rr(ctx, x - 3.6, 12.4, 7.2, 2.8, 1.2), [x - 3.6, 12.4, 7.2, 2.8], rgb(0x2a2626), { lw: 1.1, bevel: 0.5 });
  }
  // padded skirt
  const skirt = 0x2f6c70;
  lit(ctx, () => rr(ctx, -47, 2, 94, 7.6, 3), [-47, 2, 94, 7.6], cylV(ctx, 2, 9.6, skirt, 0.8), {
    inner: () => {
      ctx.setLineDash([1.4, 1.1]);
      ctx.strokeStyle = 'rgba(236,224,196,0.6)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(-45, 3.4); ctx.lineTo(45, 3.4);
      ctx.moveTo(-45, 8.3); ctx.lineTo(45, 8.3);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let x = -30; x <= 30; x += 15) seam(ctx, x, 3.8, x, 7.8, 0.5);
      label(ctx, 'BOING', 0, 5.9, 3.4, 'rgba(236,224,196,0.5)', { weight: '900' });
      scratches(ctx, r, [-47, 2, 94, 8], 10, true, 0.2);
      mottle(ctx, r, [-47, 2, 94, 8], 6, 0x1a3a3c, 0.3, 2, 5);
    },
  });
  // coil springs along the top
  for (let x = -43; x <= 43.1; x += 7.17) coilSpring(ctx, x, -3.4, x, 0.4, 1.15, 2.5, 0.5, 0xc0c6c8);
  // top rail
  lit(ctx, () => rr(ctx, -48.5, -0.6, 97, 3.4, 1.7), [-48.5, -0.6, 97, 3.4], cylV(ctx, -0.6, 2.8, steel), {
    lw: 1.3,
    inner: () => {
      scratches(ctx, r, [-48, -1, 96, 4], 12, true, 0.35);
      for (let x = -40; x <= 40; x += 20) rivet(ctx, x, 1.1, 0.6);
    },
  });
};

const paintTrampMat: Painter = (ctx, _p, r) => {
  const box: Box = [-46, -3, 92, 6];
  lit(ctx, () => rr(ctx, -46, -3, 92, 6, 2.6), box, cylV(ctx, -3, 3, 0x2b2829, 0.9), {
    lw: 1.3,
    inner: () => {
      // woven texture
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      for (let x = -46; x < 46; x += 1.2) { ctx.moveTo(x, -3); ctx.lineTo(x + 2, 3); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(224,122,48,0.85)';
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      rr(ctx, -44.5, -1.8, 89, 3.6, 1.6);
      ctx.stroke();
      ctx.setLineDash([1, 0.9]);
      ctx.strokeStyle = 'rgba(236,224,196,0.4)';
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(-43, -0.9); ctx.lineTo(43, -0.9);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,240,220,0.15)';
      ctx.fillRect(-46, -3, 92, 1.1);
      scratches(ctx, r, box, 10, true, 0.12);
    },
  });
};

// ---------------------------------------------------------------------------
// Bucket, hook, pulley
// ---------------------------------------------------------------------------

const paintBucket: Painter = (ctx, _p, r) => {
  const galv = 0x9ba3a5;
  // interior (back wall + floor)
  const inside = () => poly(ctx, [-28.6, -34, 28.6, -34, 28, 14.5, -28, 14.5]);
  lit(ctx, inside, [-29, -34, 58, 48], lin(ctx, -28, 0, 28, 0, [
    [0, rgb(0x2e3335)], [0.45, rgb(0x474e50)], [0.8, rgb(0x5d6567)], [1, rgb(0x3a4042)],
  ]), {
    lw: false,
    bevel: 0,
    form: 0,
    inner: () => {
      ctx.fillStyle = lin(ctx, 0, -34, 0, -16, [[0, 'rgba(10,10,12,0.55)'], [1, 'rgba(10,10,12,0)']]);
      ctx.fillRect(-29, -34, 58, 18);
      mottle(ctx, r, [-28, -34, 56, 48], 12, 0x7d8789, 0.25, 3, 8);
      speckle(ctx, r, [-28, -34, 56, 48], 80, ['rgba(180,190,195,0.15)', 'rgba(0,0,0,0.25)'], 0.2, 0.6);
      // floor ellipse
      ctx.fillStyle = rgb(0x596163, 0.9);
      ctx.beginPath();
      ctx.ellipse(0, 14.2, 27.5, 3.2, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(15,15,18,0.55)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      // rib shadows on the inner back wall
      for (const y of [-21, 3]) {
        ctx.strokeStyle = 'rgba(15,15,18,0.4)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(0, y - 3, 28, 3, 0, Math.PI, TAU);
        ctx.stroke();
      }
      grimeBottom(ctx, [-28, -34, 56, 48], 0.35, 0x1a1810);
    },
  });
  // back rim arc
  tube(ctx, () => ctx.ellipse(0, -34, 31.4, 3.4, 0, Math.PI, TAU), 1.6, shade(galv, -0.2), { lw: 0.7 });
  // walls + bottom slab (one U piece)
  const U = () => {
    ctx.moveTo(-34.5, -34);
    ctx.lineTo(-33.2, 19);
    ctx.quadraticCurveTo(-33, 22.2, -29.5, 22.2);
    ctx.lineTo(29.5, 22.2);
    ctx.quadraticCurveTo(33, 22.2, 33.2, 19);
    ctx.lineTo(34.5, -34);
    ctx.lineTo(28.6, -34);
    ctx.lineTo(28, 14);
    ctx.lineTo(-28, 14);
    ctx.lineTo(-28.6, -34);
    ctx.closePath();
  };
  lit(ctx, U, [-34.5, -34, 69, 56], lin(ctx, -34, 0, 34, 0, [
    [0, rgb(shade(galv, -0.05))], [0.04, rgb(shade(galv, 0.4))], [0.09, rgb(galv)],
    [0.5, rgb(shade(galv, -0.1))], [0.92, rgb(cool(galv, 0.25))], [0.97, rgb(shade(galv, 0.15))], [1, rgb(shade(galv, -0.3))],
  ]), {
    inner: () => {
      // spangle (galvanised crystals)
      for (let i = 0; i < 70; i++) {
        const x = r.range(-35, 35), y = r.range(-34, 22);
        ctx.fillStyle = r.chance(0.5) ? 'rgba(255,255,255,0.13)' : 'rgba(30,40,45,0.12)';
        ctx.beginPath();
        poly(ctx, [x, y, x + r.range(1, 3), y + r.range(-1, 1), x + r.range(0.5, 2.5), y + r.range(1, 3), x - r.range(0, 1.5), y + r.range(0.5, 2.5)]);
        ctx.fill();
      }
      // bottom slab face
      ctx.fillStyle = cylV(ctx, 14, 22.2, shade(galv, -0.1));
      ctx.fillRect(-34, 14, 68, 8.2);
      seam(ctx, -33, 14.2, 33, 14.2, 0.6);
      // ribs on the walls
      for (const y of [-22, 2]) {
        for (const s of [-1, 1]) {
          ctx.fillStyle = 'rgba(15,15,18,0.4)';
          ctx.fillRect(s < 0 ? -35 : 28, y + 0.8, 7, 1);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(s < 0 ? -35 : 28, y - 0.6, 7, 0.9);
        }
      }
      scratches(ctx, r, [-35, -34, 70, 56], 16, true, 0.3);
      mottle(ctx, r, [-35, 6, 70, 16], 6, 0x5a4a30, 0.25, 2, 6);
      grimeBottom(ctx, [-35, -34, 70, 56], 0.3, 0x2a2418);
    },
  });
  // rolled rim beads + front rim arc
  tube(ctx, () => ctx.ellipse(0, -34, 31.4, 3.4, 0, 0.05, Math.PI - 0.05), 1.5, shade(galv, 0.1), { lw: 0.7 });
  for (const s of [-1, 1]) {
    lit(ctx, () => rr(ctx, s * 31.5 - 3.4, -36, 6.8, 3.6, 1.8), [s * 31.5 - 3.4, -36, 6.8, 3.6], cylV(ctx, -36, -32.4, shade(galv, 0.05)), { lw: 1.2 });
  }
  // handle ears
  for (const s of [-1, 1]) {
    lit(ctx, () => rr(ctx, s * 33.6 - 2.4, -31, 4.8, 6.5, 1.5), [s * 33.6 - 2.4, -31, 4.8, 6.5], metal(ctx, s * 33 - 2, -31, s * 33 + 2, -25, 0x8a9294), { lw: 1 });
    rivet(ctx, s * 33.6, -28, 0.9);
  }
  // wire handle
  tube(ctx, () => { ctx.moveTo(-33.6, -28); ctx.bezierCurveTo(-33.6, -55, 33.6, -55, 33.6, -28); }, 1.25, 0xa9b0b2, { lw: 0.8 });
  // wooden grip
  lit(ctx, () => rr(ctx, -7.5, -48.6, 15, 5.2, 2.6), [-7.5, -48.6, 15, 5.2], cylV(ctx, -48.6, -43.4, 0x9a6438), {
    lw: 1.2,
    inner: () => {
      woodGrain(ctx, r, -7.5, -48.6, 15, 5.2, { base: 0x9a6438, knots: 0, lineGap: 1 });
      ctx.fillStyle = cylV(ctx, -48.6, -43.4, 0x9a6438);
      ctx.globalAlpha = 0.55;
      ctx.fillRect(-7.5, -48.6, 15, 5.2);
      ctx.globalAlpha = 1;
      for (const x of [-6.2, 6.2]) seam(ctx, x, -48, x, -44, 0.6);
    },
  });
};

const paintHook: Painter = (ctx, _p, r) => {
  const steel = 0x6a7377;
  lit(ctx, () => rr(ctx, -10, -12, 20, 11.5, 2.4), [-10, -12, 20, 11.5], metal(ctx, -10, -12, 10, 0, steel), {
    inner: () => {
      scratches(ctx, r, [-10, -12, 20, 12], 8, true, 0.3);
      grimeBottom(ctx, [-10, -12, 20, 12], 0.3);
      edgeChips(ctx, r, [-10, -12, 20, 11.5], 6, 'rgba(190,195,195,0.6)', 0.7);
    },
  });
  hexBolt(ctx, -6, -6.4, 1.8);
  hexBolt(ctx, 6, -6.4, 1.8);
  // collar
  lit(ctx, () => rr(ctx, -3.2, -2.4, 6.4, 3, 1), [-3.2, -2.4, 6.4, 3], cylV(ctx, -2.4, 0.6, 0x8d9599), { lw: 1 });
  // the hook itself
  const hk = () => {
    ctx.moveTo(-1.6, -0.5);
    ctx.lineTo(-1.6, 4.6);
    ctx.arc(1.9, 4.6, 3.5, Math.PI, 0, true);
    ctx.lineTo(5.4, 2.4);
  };
  tube(ctx, hk, 2.3, 0xa4abae, { lw: 0.9 });
  // pointed tip
  ctx.save();
  ctx.beginPath();
  poly(ctx, [4.1, 2.6, 6.7, 2.6, 5.6, -0.4]);
  ctx.fillStyle = rgb(0xb7bec1);
  ctx.fill();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = OL;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
  glint(ctx, -2, 3, 1.2, 0.8);
};

const paintPulleyMount: Painter = (ctx, _p, r) => {
  const steel = 0x76828a;
  // wall plate
  lit(ctx, () => rr(ctx, -14.5, -18, 29, 5.6, 1.6), [-14.5, -18, 29, 5.6], cylV(ctx, -18, -12.4, 0x4f585e), {
    lw: 1.4,
    inner: () => grimeBottom(ctx, [-14.5, -18, 29, 5.6], 0.3),
  });
  screw(ctx, -10.5, -15.2, 1.4, 0.4);
  screw(ctx, 10.5, -15.2, 1.4, 2.0);
  // strap from the plate to the axle
  const strap = () => {
    ctx.moveTo(-4.2, -12.6);
    ctx.lineTo(4.2, -12.6);
    ctx.lineTo(4, -4.2);
    ctx.arc(0, 0, 5.6, -Math.PI / 2 + 0.78, -Math.PI / 2 - 0.78 + TAU);
    ctx.lineTo(-4.2, -12.6);
    ctx.closePath();
  };
  lit(ctx, strap, [-5.6, -12.6, 11.2, 18.2], metal(ctx, -5, -12, 5, 5, steel), {
    lw: 1.4,
    inner: () => {
      scratches(ctx, r, [-6, -13, 12, 19], 6, true, 0.35);
      rivet(ctx, 0, -9.6, 0.9);
    },
  });
  hexBolt(ctx, 0, 0, 2.9, 0x9aa1a5, 0.5);
  ctx.fillStyle = rgb(0x2a2c2e);
  ctx.beginPath();
  ctx.arc(0, 0, 0.9, 0, TAU);
  ctx.fill();
};

const paintPulleyWheel: Painter = (ctx, _p, r) => {
  const R = 18;
  const iron = 0x4c5156;
  const ring = () => { circ(ctx, 0, 0, R); circ(ctx, 0, 0, 12.6); };
  // spokes (behind the rim edge)
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 5;
    ctx.save();
    ctx.rotate(a);
    lit(ctx, () => poly(ctx, [4, -1.9, 13.5, -1.25, 13.5, 1.25, 4, 1.9]), [4, -2, 9.5, 4], rgb(0xa8402f), { lw: 1, form: 0, bevel: 0.4, hi: 'rgba(255,200,170,0.35)', lo: 'rgba(40,10,10,0.3)' });
    ctx.restore();
  }
  ctx.restore();
  lit(ctx, ring, [-R, -R, R * 2, R * 2], rad(ctx, 0, 0, 12.6, 0, 0, R, [
    [0, rgb(shade(iron, -0.2))], [0.2, rgb(shade(iron, 0.15))], [0.45, rgb(iron)], [0.55, rgb(0x1e2023)],
    [0.75, rgb(0x2a2d31)], [0.86, rgb(shade(iron, 0.25))], [1, rgb(shade(iron, -0.2))],
  ]), {
    rule: 'evenodd',
    form: 0,
    bevel: 0,
    inner: () => {
      speckle(ctx, r, [-R, -R, R * 2, R * 2], 60, ['rgba(200,200,210,0.15)', 'rgba(0,0,0,0.3)'], 0.15, 0.4);
      // groove highlight lines (rotation invariant)
      ctx.strokeStyle = 'rgba(230,236,240,0.28)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, 17.1, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 13.6, 0, TAU);
      ctx.stroke();
    },
  });
  // hub
  lit(ctx, () => circ(ctx, 0, 0, 5.2), [-5.2, -5.2, 10.4, 10.4], rad(ctx, 0, 0, 0, 0, 0, 5.2, [[0, rgb(0xb7bdc0)], [0.7, rgb(0x7f878c)], [1, rgb(0x4c5257)]]), { lw: 1.2, form: 0, bevel: 0 });
  ctx.strokeStyle = 'rgba(29,22,18,0.6)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = rgb(0x18191b);
  ctx.beginPath();
  ctx.arc(0, 0, 1.6, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const a = (i * TAU) / 3 + 0.3;
    rivet(ctx, Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0.55);
  }
};

// ---------------------------------------------------------------------------
// Gears
// ---------------------------------------------------------------------------

function paintGearBody(ctx: Ctx, r: Rand, pitch: number, n: number, tipR: number, rootR: number, mat: 'brass' | 'steel', style: 'holes' | 'spokes' | 'solid'): void {
  const base = mat === 'steel' ? 0x50677f : PAL.brass;
  const phase = -Math.PI / 2;
  const hubR = Math.max(4, pitch * 0.3);
  const webOut = rootR - Math.max(3, pitch * 0.12);
  const holes = () => {
    if (style === 'holes') {
      const k = pitch > 30 ? 6 : 5;
      const rm = (hubR + webOut) / 2;
      const rh = Math.min((webOut - hubR) * 0.36, rm * Math.sin(Math.PI / k) * 0.62);
      for (let i = 0; i < k; i++) {
        const a = phase + Math.PI / n + (i * TAU) / k;
        circ(ctx, Math.cos(a) * rm, Math.sin(a) * rm, rh);
      }
    } else if (style === 'spokes') {
      const k = 6;
      const w = pitch * 0.085;
      const rin = hubR + 2.5;
      for (let i = 0; i < k; i++) {
        const a0 = phase + (i * TAU) / k;
        const a1 = a0 + TAU / k;
        const gi = Math.asin(Math.min(0.9, w / rin));
        const go = Math.asin(Math.min(0.9, w / webOut));
        ctx.moveTo(Math.cos(a0 + go) * webOut, Math.sin(a0 + go) * webOut);
        ctx.arc(0, 0, webOut, a0 + go, a1 - go);
        ctx.arc(0, 0, rin, a1 - gi, a0 + gi, true);
        ctx.closePath();
      }
    }
  };
  const body = () => {
    gearPath(ctx, 0, 0, n, tipR, rootR, phase);
    holes();
  };
  const box: Box = [-tipR, -tipR, tipR * 2, tipR * 2];
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  body();
  ctx.fillStyle = rad(ctx, 0, 0, 0, 0, 0, tipR, [
    [0, rgb(shade(base, 0.2))],
    [0.5, rgb(base)],
    [0.85, rgb(shade(base, -0.1))],
    [1, rgb(shade(base, -0.3))],
  ]);
  ctx.fill('evenodd');
  ctx.save();
  ctx.clip('evenodd');
  // machining rings
  for (let rr2 = hubR; rr2 < tipR; rr2 += 0.9) {
    ctx.strokeStyle = r.chance(0.5) ? 'rgba(255,245,220,0.07)' : 'rgba(30,20,10,0.07)';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, rr2, 0, TAU);
    ctx.stroke();
  }
  mottle(ctx, r, box, Math.round(pitch / 3), mat === 'steel' ? 0x7a96b4 : 0x5c6a3a, 0.22, 3, pitch * 0.25);
  mottle(ctx, r, box, Math.round(pitch / 4), mat === 'steel' ? 0x22303e : 0x6b4a1e, 0.25, 2, pitch * 0.2);
  // recessed web between hub and rim
  if (style !== 'solid') {
    ctx.fillStyle = rgb(shade(base, -0.18), 0.55);
    ctx.beginPath();
    circ(ctx, 0, 0, webOut);
    circ(ctx, 0, 0, hubR + 1.2);
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(25,15,8,0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, webOut, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,200,0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, webOut + 0.7, 0, TAU);
    ctx.stroke();
  }
  speckle(ctx, r, box, Math.round(pitch * 2), ['rgba(30,20,10,0.2)', 'rgba(255,245,215,0.15)'], 0.15, 0.4);
  scratches(ctx, r, box, Math.round(pitch / 3), true, 0.22);
  // uniform chamfer catch-light along every edge (rotation-safe)
  ctx.beginPath();
  body();
  ctx.strokeStyle = mat === 'steel' ? 'rgba(200,225,250,0.38)' : 'rgba(255,236,180,0.45)';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  body();
  ctx.lineWidth = LW;
  ctx.strokeStyle = OL;
  ctx.stroke();
  ctx.restore();
  // hub
  lit(ctx, () => circ(ctx, 0, 0, hubR), [-hubR, -hubR, hubR * 2, hubR * 2], rad(ctx, 0, 0, 0, 0, 0, hubR, [
    [0, rgb(shade(base, 0.35))], [0.7, rgb(shade(base, 0.05))], [1, rgb(shade(base, -0.25))],
  ]), { lw: 1.2, form: 0, bevel: 0 });
  ctx.strokeStyle = 'rgba(255,240,200,0.3)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, hubR - 1, 0, TAU);
  ctx.stroke();
  const bore = Math.max(1.4, hubR * 0.32);
  ctx.fillStyle = rgb(0x141210);
  ctx.beginPath();
  circ(ctx, 0, 0, bore);
  ctx.rect(-bore * 0.3, -bore - 0.9, bore * 0.6, 1.2);
  ctx.fill();
  if (hubR > 6) {
    for (let i = 0; i < 3; i++) {
      const a = phase + (i * TAU) / 3 + 0.5;
      screw(ctx, Math.cos(a) * hubR * 0.66, Math.sin(a) * hubR * 0.66, Math.max(0.8, hubR * 0.13), a, mat === 'steel' ? 0xb0b6ba : 0x9a9a92);
    }
  }
}

const gearPainter = (pitch: number, defMat: 'brass' | 'steel', style: 'holes' | 'spokes' | 'solid'): Painter => (ctx, p, r) => {
  const m = str(p, 'material', defMat) === 'steel' ? 'steel' : 'brass';
  paintGearBody(ctx, r, pitch, Math.max(6, Math.round(pitch / 3)), pitch + 6, pitch - 3, m, style);
};

const paintPinion: Painter = (ctx, _p, r) => {
  paintGearBody(ctx, r, 12, 9, 16, 9.8, 'steel', 'solid');
};

// ---------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------

const paintMotorBody: Painter = (ctx, _p, r) => {
  const paint = 0x47695f;
  // mounting feet (behind)
  for (const s of [-1, 1]) {
    const x = s < 0 ? -31.5 : 18.5;
    lit(ctx, () => rr(ctx, x, 18.5, 13, 5.8, 1.6), [x, 18.5, 13, 5.8], cylV(ctx, 18.5, 24.3, 0x4a5256), { lw: 1.3 });
    hexBolt(ctx, x + (s < 0 ? 3.4 : 9.6), 21.4, 1.4);
  }
  const box: Box = [-28, -16, 56, 40];
  lit(ctx, () => rr(ctx, -28, -16, 56, 40, 5), box, metal(ctx, -28, -16, 28, 24, paint), {
    inner: () => {
      mottle(ctx, r, box, 14, shade(paint, 0.2), 0.18, 2, 6);
      speckle(ctx, r, box, 140, ['rgba(10,20,16,0.3)', 'rgba(220,240,230,0.12)'], 0.12, 0.35);
      // cooling fins on both flanks
      for (const x0 of [-27, 17]) {
        for (let y = -12; y <= 10; y += 3.2) {
          if (x0 < 0 && y > 9) continue;
          ctx.fillStyle = 'rgba(12,20,18,0.55)';
          ctx.fillRect(x0, y, 10, 1.1);
          ctx.fillStyle = 'rgba(220,240,230,0.3)';
          ctx.fillRect(x0, y + 1.1, 10, 0.5);
        }
      }
      // nameplate
      lit(ctx, () => rr(ctx, 6, 13.5, 17.5, 8, 1.2), [6, 13.5, 17.5, 8], metal(ctx, 6, 13, 23, 21, 0xc2a058), {
        lw: 0.8,
        bevel: 0.5,
        inner: () => {
          label(ctx, 'FOLLY', 14.75, 15.8, 2.6, 'rgba(40,26,10,0.85)', { weight: '900' });
          ctx.fillStyle = 'rgba(40,26,10,0.5)';
          ctx.fillRect(8, 18.2, 13.5, 0.45);
          ctx.fillRect(8, 19.4, 9, 0.45);
        },
      });
      rivet(ctx, 7.1, 14.6, 0.45); rivet(ctx, 22.4, 14.6, 0.45); rivet(ctx, 7.1, 20.4, 0.45); rivet(ctx, 22.4, 20.4, 0.45);
      // hazard sticker
      ctx.save();
      ctx.translate(21.5, -11.3);
      ctx.beginPath();
      poly(ctx, [0, -3, 3.3, 2.6, -3.3, 2.6]);
      ctx.fillStyle = rgb(0xe3b22f);
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = OL;
      ctx.stroke();
      ctx.fillStyle = OL;
      ctx.fillRect(-0.35, -1.2, 0.7, 2);
      ctx.fillRect(-0.35, 1.25, 0.7, 0.7);
      ctx.restore();
      edgeChips(ctx, r, box, 30, 'rgba(170,176,172,0.7)', 1);
      scratches(ctx, r, box, 18, true, 0.3);
      grimeBottom(ctx, box, 0.4);
    },
  });
  // end-bell boss (pinion sits here)
  const bx = 0, by = -2;
  lit(ctx, () => circ(ctx, bx, by, 14), [bx - 14, by - 14, 28, 28], rad(ctx, bx - 4, by - 5, 0, bx, by, 14, [
    [0, rgb(0xc9cfd1)], [0.55, rgb(0x8c9599)], [1, rgb(0x4e565b)],
  ]), {
    inner: () => {
      for (let rr2 = 4; rr2 < 14; rr2 += 0.8) {
        ctx.strokeStyle = r.chance(0.5) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.arc(bx, by, rr2, 0, TAU);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(29,22,18,0.5)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(bx, by, 11.5, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(bx, by, 12.2, 0, TAU);
      ctx.stroke();
    },
  });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    hexBolt(ctx, bx + Math.cos(a) * 12.6, by + Math.sin(a) * 12.6, 1.15);
  }
  ctx.fillStyle = rad(ctx, bx, by, 0, bx, by, 5.5, [[0, 'rgba(10,8,6,0.8)'], [1, 'rgba(10,8,6,0)']]);
  ctx.beginPath();
  ctx.arc(bx, by, 5.5, 0, TAU);
  ctx.fill();
};

// ---------------------------------------------------------------------------
// Conveyor + roller
// ---------------------------------------------------------------------------

function wheelDisc(ctx: Ctx, r: Rand, x: number, y: number, R: number, spokes: number, base: number): void {
  ctx.save();
  ctx.translate(x, y);
  lit(ctx, () => circ(ctx, 0, 0, R), [-R, -R, R * 2, R * 2], rad(ctx, 0, 0, 0, 0, 0, R, [
    [0, rgb(shade(base, 0.25))], [0.7, rgb(base)], [0.85, rgb(shade(base, 0.2))], [1, rgb(shade(base, -0.35))],
  ]), {
    form: 0,
    bevel: 0,
    lw: 1.3,
    inner: () => {
      // recessed spoke windows
      for (let i = 0; i < spokes; i++) {
        const a = (i * TAU) / spokes;
        const a1 = a + TAU / spokes;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.78, a + 0.28, a1 - 0.28);
        ctx.arc(0, 0, R * 0.38, a1 - 0.55, a + 0.55, true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(14,12,12,0.78)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(29,22,18,0.9)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      speckle(ctx, r, [-R, -R, R * 2, R * 2], 25, ['rgba(255,255,255,0.12)', 'rgba(0,0,0,0.25)'], 0.12, 0.35);
    },
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.86, 0, TAU);
  ctx.stroke();
  lit(ctx, () => circ(ctx, 0, 0, R * 0.26), [-R * 0.26, -R * 0.26, R * 0.52, R * 0.52], rad(ctx, 0, 0, 0, 0, 0, R * 0.26, [[0, rgb(0xd0d5d7)], [1, rgb(0x6a7276)]]), { lw: 0.8, form: 0, bevel: 0 });
  ctx.fillStyle = rgb(0x18191b);
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.09, 0, TAU);
  ctx.fill();
  ctx.restore();
}

const paintConveyor: Painter = (ctx, p, r) => {
  const L = clamp(num(p, 'length', 220), 40, 4000);
  const x0 = -L / 2;
  const box: Box = [x0, -11, L, 22];
  // belt loop
  lit(ctx, () => rr(ctx, x0, -11, L, 22, 10.5), box, cylV(ctx, -11, 11, 0x2c2a29, 0.7), {
    form: 0.6,
    inner: () => {
      // keep the top run plain; texture the return run
      ctx.fillStyle = 'rgba(255,240,220,0.1)';
      ctx.fillRect(x0, -11, L, 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      for (let x = x0 + 4; x < -x0 - 4; x += 3) { ctx.moveTo(x, 8); ctx.lineTo(x + 0.8, 10.6); }
      ctx.stroke();
      scratches(ctx, r, [x0, 7, L, 4], Math.round(L / 20), true, 0.15);
    },
  });
  // side rail
  const rail = 0xcf9a30;
  const rb: Box = [x0 + 4, -7, L - 8, 14];
  lit(ctx, () => rr(ctx, x0 + 4, -7, L - 8, 14, 7), rb, cylV(ctx, -7, 7, rail, 0.8), {
    lw: 1.3,
    inner: () => {
      mottle(ctx, r, rb, Math.round(L / 15), 0x8a5a1a, 0.22, 2, 6);
      // hazard flashes inboard of the rollers
      for (const s of [-1, 1]) {
        const hx = s < 0 ? x0 + 22 : -x0 - 30;
        ctx.save();
        ctx.beginPath();
        ctx.rect(hx, -7, 8, 14);
        ctx.clip();
        hazard(ctx, [hx, -7, 8, 14], 3.2, 0xe0ac30, 0x221b16, -0.8);
        ctx.restore();
      }
      for (let x = x0 + 36; x < -x0 - 34; x += 14) {
        rivet(ctx, x, -4.3, 0.75, 0xa8a090);
        rivet(ctx, x, 4.3, 0.75, 0xa8a090);
      }
      edgeChips(ctx, r, rb, Math.round(L / 6), 'rgba(70,60,50,0.75)', 1);
      scratches(ctx, r, rb, Math.round(L / 8), true, 0.35);
      grimeBottom(ctx, rb, 0.45, 0x2a1a08);
    },
  });
  // end roller hubs (the left one is covered by the animated drive roller)
  wheelDisc(ctx, r, x0 + 12, 0, 8.6, 4, 0x8b9398);
  wheelDisc(ctx, r, -x0 - 12, 0, 8.6, 4, 0x8b9398);
};

const paintRoller: Painter = (ctx, _p, r) => {
  // rubber tyre
  lit(ctx, () => { circ(ctx, 0, 0, 11); circ(ctx, 0, 0, 8.6); }, [-11, -11, 22, 22], rgb(0x262424), {
    rule: 'evenodd',
    form: 0,
    bevel: 0,
    lw: 1.3,
    inner: () => {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 18; i++) {
        const a = (i * TAU) / 18;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
        ctx.lineTo(Math.cos(a) * 10.8, Math.sin(a) * 10.8);
        ctx.stroke();
      }
    },
  });
  wheelDisc(ctx, r, 0, 0, 8.6, 4, 0x9aa2a6);
};

// ---------------------------------------------------------------------------
// Fan
// ---------------------------------------------------------------------------

const FAN = { cx: 6, cy: -6, rx: 12, ry: 26 };

const paintFanBody: Painter = (ctx, _p, r) => {
  const enamel = PAL.mint;
  const chrome = 0xb7bfc3;
  // rear cage ring + struts (behind everything)
  ctx.save();
  ctx.lineCap = 'round';
  tube(ctx, () => ctx.ellipse(-1.5, -6, 9.5, 22, 0, 0, TAU), 0.9, shade(chrome, -0.35), { lw: 0.5 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const sx = -1.5 + Math.cos(a) * 9.5, sy = -6 + Math.sin(a) * 22;
    const ex = FAN.cx + Math.cos(a) * FAN.rx, ey = FAN.cy + Math.sin(a) * FAN.ry;
    tube(ctx, () => { ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + ex) / 2 + 1.5, (sy + ey) / 2 + Math.sin(a) * 3, ex, ey); }, 0.55, shade(chrome, -0.25), { lw: 0.45 });
  }
  ctx.restore();
  // base
  const base: Box = [-27, 30.5, 42, 7.5];
  lit(ctx, () => rr(ctx, -27, 30.5, 42, 7.5, 3.7), base, cylV(ctx, 30.5, 38, enamel, 0.9), {
    inner: () => {
      ctx.fillStyle = rgb(0x2a2626);
      ctx.fillRect(-27, 36.3, 42, 2);
      edgeChips(ctx, r, base, 8, 'rgba(60,70,66,0.7)', 0.9);
      label(ctx, 'ZEPHYR', 3, 33.6, 2.8, 'rgba(250,240,215,0.6)', { weight: '900' });
      scratches(ctx, r, base, 6, true, 0.3);
    },
  });
  // stand
  tube(ctx, () => { ctx.moveTo(-8, 31); ctx.lineTo(-9, 2); }, 3.6, chrome);
  lit(ctx, () => rr(ctx, -12, 26.5, 7, 5, 1.6), [-12, 26.5, 7, 5], cylV(ctx, 26.5, 31.5, enamel), { lw: 1.2 });
  // motor housing (egg) at the back of the cage
  const mb: Box = [-25, -16, 22, 20];
  lit(ctx, () => ell(ctx, -13.5, -6, 11.5, 10), mb, rad(ctx, -17, -10, 0, -13.5, -6, 12, [
    [0, rgb(shade(enamel, 0.35))], [0.6, rgb(enamel)], [1, rgb(cool(enamel, 0.4))],
  ]), {
    inner: () => {
      for (const y of [-9, -6, -3]) {
        ctx.fillStyle = 'rgba(16,24,22,0.75)';
        ctx.beginPath();
        rr(ctx, -21, y - 0.6, 7, 1.2, 0.6);
        ctx.fill();
        ctx.fillStyle = 'rgba(240,255,250,0.25)';
        ctx.fillRect(-20.5, y + 0.6, 6, 0.4);
      }
      mottle(ctx, r, mb, 5, 0x40564e, 0.25, 2, 5);
      edgeChips(ctx, r, mb, 8, 'rgba(60,70,66,0.6)', 0.8);
      sheen(ctx, -17, -11.5, 4, 2, 0.45, -0.4);
    },
  });
  // rear chrome cap
  lit(ctx, () => ell(ctx, -24.2, -6, 2.4, 5.5), [-26.6, -11.5, 4.8, 11], cylV(ctx, -11.5, -0.5, chrome), { lw: 1.1 });
  // tilt knuckle
  lit(ctx, () => circ(ctx, -9, 2.5, 3.4), [-12.4, -0.9, 6.8, 6.8], rad(ctx, -10, 1.5, 0, -9, 2.5, 3.4, [[0, rgb(0xe8eef0)], [1, rgb(0x6b7478)]]), { lw: 1.1 });
  ctx.fillStyle = rgb(0x2a2626);
  ctx.beginPath();
  ctx.arc(-9, 2.5, 1.1, 0, TAU);
  ctx.fill();
  // front ring of the cage (also repeated on the blade frames)
  tube(ctx, () => ctx.ellipse(FAN.cx, FAN.cy, FAN.rx, FAN.ry, 0, 0, TAU), 1.2, chrome, { lw: 0.6 });
};

const fanBladesPainter = (phase: number): Painter => (ctx, _p, r) => {
  const sx = FAN.rx / FAN.ry;
  const R = FAN.ry - 1.5;
  const m = (x: number, y: number): [number, number] => [x * sx, y];
  // motion blur disc
  ctx.fillStyle = rad(ctx, 0, 0, 0, 0, 0, R, [[0, 'rgba(230,210,160,0.22)'], [0.8, 'rgba(230,210,160,0.12)'], [1, 'rgba(230,210,160,0)']]);
  ctx.save();
  ctx.scale(sx, 1);
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.restore();
  // three brass blades
  const brass = 0xc8a050;
  for (let i = 0; i < 3; i++) {
    const a = phase + (i * TAU) / 3;
    const pt = (rr2: number, da: number) => m(Math.cos(a + da) * rr2, Math.sin(a + da) * rr2);
    const bladePath = () => {
      const p0 = pt(4, -0.35), p1 = pt(13, -0.62), p2 = pt(22.5, -0.42), p3 = pt(23.5, 0.05);
      const p4 = pt(21, 0.42), p5 = pt(12, 0.38), p6 = pt(4, 0.3);
      ctx.moveTo(p0[0], p0[1]);
      ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
      ctx.bezierCurveTo(p4[0], p4[1], p5[0], p5[1], p6[0], p6[1]);
      ctx.closePath();
    };
    const facing = Math.cos(a - 0.6);
    const b = shade(brass, facing * 0.22);
    const c = pt(14, 0);
    lit(ctx, bladePath, [c[0] - 8, c[1] - 12, 16, 24], rad(ctx, c[0] - 2, c[1] - 3, 0, c[0], c[1], 12, [[0, rgb(shade(b, 0.3))], [1, rgb(shade(b, -0.2))]]), {
      lw: 0.9,
      form: 0,
      bevel: 0.5,
      inner: () => {
        speckle(ctx, r, [c[0] - 8, c[1] - 12, 16, 24], 10, ['rgba(60,40,10,0.3)'], 0.1, 0.3);
        const q0 = pt(6, 0), q1 = pt(21, 0);
        ctx.strokeStyle = 'rgba(255,240,200,0.35)';
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.moveTo(q0[0], q0[1]);
        ctx.lineTo(q1[0], q1[1]);
        ctx.stroke();
      },
    });
  }
  // hub
  lit(ctx, () => ell(ctx, 0, 0, 4.2 * sx + 0.8, 4.2), [-3, -4.2, 6, 8.4], rad(ctx, -0.6, -1.2, 0, 0, 0, 4.5, [[0, rgb(0xeef2f3)], [1, rgb(0x6e777b)]]), { lw: 0.9, form: 0, bevel: 0 });
  // front grille (over the blades)
  ctx.save();
  ctx.lineCap = 'round';
  const chrome = 'rgba(205,214,218,0.85)';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const [x0, y0] = m(Math.cos(a) * 5, Math.sin(a) * 5);
    const [x1, y1] = m(Math.cos(a) * (FAN.ry - 0.5), Math.sin(a) * (FAN.ry - 0.5));
    ctx.strokeStyle = 'rgba(29,22,18,0.55)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = chrome;
    ctx.lineWidth = 0.32;
    ctx.stroke();
  }
  for (const k of [0.45, 0.75]) {
    ctx.strokeStyle = 'rgba(29,22,18,0.55)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.ellipse(0, 0, FAN.rx * k, FAN.ry * k, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = chrome;
    ctx.lineWidth = 0.35;
    ctx.stroke();
  }
  ctx.restore();
  tube(ctx, () => ctx.ellipse(0, 0, FAN.rx - 0.2, FAN.ry - 0.6, 0, 0, TAU), 1.2, 0xb7bfc3, { lw: 0.6 });
  // badge
  lit(ctx, () => ell(ctx, 0, 0, 2.6, 4.6), [-2.6, -4.6, 5.2, 9.2], rad(ctx, -0.8, -1.5, 0, 0, 0, 4.6, [[0, rgb(0xf0d78e)], [1, rgb(0x8a6424)]]), { lw: 0.8, form: 0 });
  ctx.fillStyle = 'rgba(80,40,10,0.8)';
  star(ctx, 0, 0, 1.6, 0.7);
};

// ---------------------------------------------------------------------------
// Balloons
// ---------------------------------------------------------------------------

const balloonPainter = (base: number): Painter => (ctx, _p, r) => {
  const body = () => {
    ctx.moveTo(0, -23);
    ctx.bezierCurveTo(12, -23, 20.5, -14, 20.5, -3);
    ctx.bezierCurveTo(20.5, 8.5, 10.5, 18, 1.8, 21.4);
    ctx.lineTo(-1.8, 21.4);
    ctx.bezierCurveTo(-10.5, 18, -20.5, 8.5, -20.5, -3);
    ctx.bezierCurveTo(-20.5, -14, -12, -23, 0, -23);
    ctx.closePath();
  };
  // knot
  lit(ctx, () => {
    ctx.moveTo(-1.6, 20.8);
    ctx.lineTo(1.6, 20.8);
    ctx.quadraticCurveTo(1.2, 22.6, 2.8, 25);
    ctx.quadraticCurveTo(0, 24.2, -2.8, 25);
    ctx.quadraticCurveTo(-1.2, 22.6, -1.6, 20.8);
    ctx.closePath();
  }, [-3, 20.5, 6, 4.5], rgb(shade(base, -0.15)), { lw: 1, bevel: 0.4 });
  const box: Box = [-20.5, -23, 41, 44.4];
  lit(ctx, body, box, rad(ctx, -4, -7, 0, 0, -2, 26, [
    [0, rgb(shade(base, 0.32))],
    [0.45, rgb(base)],
    [0.82, rgb(shade(base, -0.28))],
    [1, rgb(cool(base, 0.6))],
  ]), {
    form: 0.5,
    bevel: 1.2,
    lo: `${BOUNCE}0.45)`,
    inner: () => {
      // translucent inner glow
      ctx.fillStyle = rad(ctx, 4, 6, 0, 4, 6, 12, [[0, rgb(shade(base, 0.25), 0.35)], [1, rgb(shade(base, 0.25), 0)]]);
      ctx.fillRect(-20, -20, 40, 40);
      // little stretch wrinkles near the neck
      ctx.strokeStyle = rgb(shade(base, -0.45), 0.5);
      ctx.lineWidth = 0.4;
      for (const dx of [-2.6, 0, 2.4]) {
        ctx.beginPath();
        ctx.moveTo(dx * 0.6, 21);
        ctx.quadraticCurveTo(dx * 1.6, 17.5, dx * 2.2, 15 + r.range(-0.5, 0.5));
        ctx.stroke();
      }
      // window reflection + soft sheen
      sheen(ctx, -8.5, -11, 7, 10, 0.4, -0.55);
      ctx.save();
      ctx.translate(-9.5, -12.5);
      ctx.rotate(-0.55);
      ctx.fillStyle = 'rgba(255,252,242,0.75)';
      ctx.beginPath();
      rr(ctx, -1.6, -4.2, 3.2, 8.4, 1.6);
      ctx.fill();
      ctx.restore();
      glint(ctx, -4.8, -17, 1.8, 0.85);
      // lower-right bounce crescent
      ctx.strokeStyle = 'rgba(255,240,230,0.18)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, -2, 17.5, 0.1, 1.2);
      ctx.stroke();
      speckle(ctx, r, box, 18, ['rgba(255,255,255,0.12)'], 0.1, 0.25);
    },
  });
};

// ---------------------------------------------------------------------------
// Magnet
// ---------------------------------------------------------------------------

const paintMagnet: Painter = (ctx, _p, r) => {
  const iron = 0x4c5156;
  // base bracket
  lit(ctx, () => rr(ctx, -15, 13, 40, 8, 2), [-15, 13, 40, 8], cylV(ctx, 13, 21, 0x50595e), {
    inner: () => grimeBottom(ctx, [-15, 13, 40, 8], 0.4),
  });
  hexBolt(ctx, -9, 17.2, 1.4); hexBolt(ctx, 19, 17.2, 1.4);
  // back yoke flange
  lit(ctx, () => rr(ctx, -28, -20.5, 9, 36, 2), [-28, -20.5, 9, 36], metal(ctx, -28, -20, -19, 16, iron), {
    inner: () => {
      scratches(ctx, r, [-28, -20, 9, 36], 6, true, 0.3);
      edgeChips(ctx, r, [-28, -20.5, 9, 36], 8, 'rgba(180,186,190,0.6)', 0.8);
    },
  });
  rivet(ctx, -23.5, -16.5, 0.9); rivet(ctx, -23.5, 11.5, 0.9);
  // copper coil
  const cb: Box = [-19.5, -16, 37, 28];
  lit(ctx, () => rr(ctx, -19.5, -16, 37, 28, 3), cb, cylV(ctx, -16, 12, PAL.copper), {
    inner: () => {
      for (let x = -19; x < 18; x += 0.95) {
        ctx.strokeStyle = (Math.round(x * 10) % 2 === 0) ? 'rgba(60,20,6,0.35)' : 'rgba(255,200,150,0.18)';
        ctx.lineWidth = 0.35;
        ctx.beginPath();
        ctx.moveTo(x, -16);
        ctx.quadraticCurveTo(x + 0.5, -2, x, 12);
        ctx.stroke();
      }
      // insulating tape bands
      for (const tx of [-11, 7]) {
        ctx.fillStyle = cylV(ctx, -16, 12, 0xd9c79a);
        ctx.fillRect(tx, -16, 3.6, 28);
        seam(ctx, tx, -16, tx, 12, 0.5);
        seam(ctx, tx + 3.6, -16, tx + 3.6, 12, 0.5);
      }
      label(ctx, 'MAG-6', 8.8, 5.5, 1.8, 'rgba(60,40,20,0.7)', { maxW: 3.2 });
      mottle(ctx, r, cb, 6, 0x3a6a50, 0.18, 2, 4);
      speckle(ctx, r, cb, 40, ['rgba(255,220,180,0.2)', 'rgba(40,10,0,0.3)'], 0.1, 0.3);
    },
  });
  // coil flanges
  for (const fx of [-20.5, 16.5]) {
    lit(ctx, () => rr(ctx, fx, -18, 3, 32, 1.2), [fx, -18, 3, 32], cylV(ctx, -18, 14, 0x5a3426), { lw: 1.1 });
  }
  // front pole piece
  lit(ctx, () => rr(ctx, 19, -12, 9.5, 22, 2), [19, -12, 9.5, 22], cylV(ctx, -12, 10, iron), {
    inner: () => {
      ctx.fillStyle = cylV(ctx, -12, 10, PAL.red);
      ctx.fillRect(19, -12, 5, 22);
      label(ctx, 'N', 21.5, -1, 4, 'rgba(250,240,220,0.9)', { weight: '900' });
      ctx.fillStyle = cylV(ctx, -12, 10, 0xc7ccce);
      ctx.fillRect(26.2, -12, 2.3, 22);
      seam(ctx, 24, -12, 24, 10, 0.6);
      edgeChips(ctx, r, [19, -12, 9.5, 22], 6, 'rgba(60,60,64,0.8)', 0.7);
    },
  });
  // terminal studs (left clear-ish at -24,16)
  hexBolt(ctx, -14, -18.6, 1.2, 0xc2a058);
};

// ---------------------------------------------------------------------------
// Candle, dynamite, rocket
// ---------------------------------------------------------------------------

const paintCandle: Painter = (ctx, _p, r) => {
  const brass = PAL.brass;
  // dish (y 22..29)
  const dish = () => {
    ctx.moveTo(-12.4, 23);
    ctx.quadraticCurveTo(-12.4, 25.4, -9, 26.5);
    ctx.lineTo(-7.5, 29);
    ctx.lineTo(7.5, 29);
    ctx.lineTo(9, 26.5);
    ctx.quadraticCurveTo(12.4, 25.4, 12.4, 23);
    ctx.closePath();
  };
  lit(ctx, dish, [-12.4, 22, 24.8, 7], cylH(ctx, -12.4, 12.4, brass), {
    lw: 1.3,
    inner: () => {
      mottle(ctx, r, [-12, 22, 24, 7], 5, 0x3e5a3a, 0.25, 1, 3);
      ctx.fillStyle = 'rgba(30,18,6,0.45)';
      ctx.fillRect(-12, 26.4, 24, 0.6);
    },
  });
  // dish rim (inside visible)
  lit(ctx, () => ell(ctx, 0, 23, 12.4, 1.7), [-12.4, 21.3, 24.8, 3.4], rgb(0x7a5a26), { lw: 1, bevel: 0.4, form: 0 });
  // wax body
  const wax = 0xeee0bf;
  const body = () => rr(ctx, -7, -14, 14, 37.2, 1.8);
  const bb: Box = [-7, -14, 14, 37];
  lit(ctx, body, bb, cylH(ctx, -7, 7, wax, 0.7), {
    inner: () => {
      // warm translucency near the flame
      ctx.fillStyle = lin(ctx, 0, -14, 0, 4, [[0, 'rgba(255,200,120,0.45)'], [1, 'rgba(255,200,120,0)']]);
      ctx.fillRect(-7, -14, 14, 20);
      mottle(ctx, r, bb, 6, 0xc8b088, 0.2, 1.5, 4);
      grimeBottom(ctx, bb, 0.2, 0x6a5030);
      // drips
      for (const [x, len] of [[-4.6, 9], [1.8, 5.5], [5.2, 13]] as const) {
        ctx.fillStyle = 'rgba(255,248,230,0.85)';
        ctx.beginPath();
        ctx.moveTo(x - 1.1, -14);
        ctx.lineTo(x - 1.1, -14 + len);
        ctx.arc(x, -14 + len, 1.1, Math.PI, 0, true);
        ctx.lineTo(x + 1.1, -14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,130,90,0.45)';
        ctx.lineWidth = 0.35;
        ctx.stroke();
      }
    },
  });
  // melted pool on top
  lit(ctx, () => ell(ctx, 0, -13.3, 6.3, 1.4), [-6.3, -14.7, 12.6, 2.8], rad(ctx, 0, -13.3, 0, 0, -13.3, 6.3, [[0, 'rgb(255,226,170)'], [1, 'rgb(236,214,170)']]), { lw: 0.8, bevel: 0, form: 0 });
  // wick
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = OL;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -13.4);
  ctx.quadraticCurveTo(0.2, -16.5, 0.9, -19);
  ctx.stroke();
  ctx.strokeStyle = 'rgb(70,50,40)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,140,50,0.9)';
  ctx.beginPath();
  ctx.arc(0.9, -19, 0.55, 0, TAU);
  ctx.fill();
  ctx.restore();
};

const paintDynamite: Painter = (ctx, _p, r) => {
  const red = 0xb5322a;
  // fuse (behind the top stick's end)
  const fuse = () => smoothPath(ctx, [-13.5, -7, -17.2, -10.2, -16, -13.4, -12.6, -14.4, -10, -13.4]);
  tube(ctx, fuse, 1.25, 0x9a8458, { lw: 0.7 });
  ctx.save();
  ctx.setLineDash([0.5, 0.7]);
  ctx.strokeStyle = 'rgba(40,28,14,0.7)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  fuse();
  ctx.stroke();
  ctx.restore();
  // frayed tip
  ctx.strokeStyle = 'rgba(210,190,150,0.9)';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(-10, -13.4); ctx.lineTo(-9, -14.3);
  ctx.moveTo(-10, -13.4); ctx.lineTo(-9.1, -12.6);
  ctx.stroke();
  // sticks
  for (let i = 0; i < 3; i++) {
    const yc = -7.3 + i * 7.3;
    const sb: Box = [-17, yc - 3.65, 34, 7.3];
    lit(ctx, () => rr(ctx, -17, yc - 3.65, 33, 7.3, 1.4), sb, cylV(ctx, yc - 3.65, yc + 3.65, red), {
      lw: 1.2,
      inner: () => {
        mottle(ctx, r, sb, 4, 0x6a1610, 0.3, 2, 4);
        ctx.strokeStyle = 'rgba(60,10,6,0.45)';
        ctx.lineWidth = 0.35;
        ctx.beginPath();
        ctx.moveTo(-17, yc + 1.8);
        ctx.lineTo(17, yc + 1.8);
        ctx.stroke();
        if (i === 1) label(ctx, 'TNT', -0.5, yc + 0.2, 4.2, 'rgba(250,236,210,0.8)', { weight: '900' });
        speckle(ctx, r, sb, 20, ['rgba(255,220,200,0.15)', 'rgba(40,0,0,0.25)'], 0.1, 0.3);
      },
    });
    // end cap
    lit(ctx, () => ell(ctx, 16, yc, 1.5, 3.5), [14.5, yc - 3.5, 3, 7], rad(ctx, 15.6, yc - 1, 0, 16, yc, 3.5, [[0, rgb(0xe0c890)], [1, rgb(0x9c7c48)]]), { lw: 1, form: 0, bevel: 0 });
  }
  // tape bands
  for (const tx of [-10.5, 8]) {
    lit(ctx, () => rr(ctx, tx, -11.6, 4.6, 23.2, 1), [tx, -11.6, 4.6, 23.2], lin(ctx, tx, 0, tx + 4.6, 0, [[0, '#3a3634'], [0.3, '#4c4744'], [1, '#1c1a19']]), {
      lw: 1.1,
      inner: () => {
        for (const y of [-3.65, 3.65]) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(tx, y - 0.35, 4.6, 0.7);
        }
        for (const y of [-9.2, -1.9, 5.4]) {
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          ctx.fillRect(tx, y, 4.6, 0.8);
        }
      },
    });
  }
};

const paintRocket: Painter = (ctx, _p, r) => {
  const cream = PAL.cream;
  const red = PAL.red;
  // fins
  const fin = (s: number) => () => poly(ctx, [-26.5, s * 5.5, -14, s * 5.5, -21.5, s * 12.4, -27.5, s * 12.4]);
  for (const s of [-1, 1]) lit(ctx, fin(s), [-27.5, s < 0 ? -12.4 : 5.5, 13.5, 7], cylV(ctx, -12, 12, red, 0.6), { lw: 1.3 });
  // nozzle
  lit(ctx, () => poly(ctx, [-25.5, -4.4, -25.5, 4.4, -31.2, 6, -31.2, -6]), [-31.2, -6, 6, 12], cylV(ctx, -6, 6, 0x4a4e52), {
    lw: 1.3,
    inner: () => {
      ctx.fillStyle = 'rgba(20,14,10,0.6)';
      ctx.fillRect(-31.5, -6, 2, 12);
    },
  });
  // body
  const body = () => {
    ctx.moveTo(-26, -7.6);
    ctx.lineTo(12, -7.6);
    ctx.bezierCurveTo(20, -7.6, 25, -3.5, 27.4, 0);
    ctx.bezierCurveTo(25, 3.5, 20, 7.6, 12, 7.6);
    ctx.lineTo(-26, 7.6);
    ctx.closePath();
  };
  const bb: Box = [-26, -8, 54, 16];
  lit(ctx, body, bb, cylV(ctx, -7.6, 7.6, cream), {
    inner: () => {
      ctx.fillStyle = cylV(ctx, -7.6, 7.6, red);
      ctx.fillRect(12, -8, 16, 16);
      ctx.fillRect(-19, -8, 4, 16);
      seam(ctx, 12, -7.6, 12, 7.6, 0.7);
      seam(ctx, -19, -7.6, -19, 7.6, 0.5);
      seam(ctx, -15, -7.6, -15, 7.6, 0.5);
      for (let y = -6; y <= 6; y += 3) { rivet(ctx, 10.6, y, 0.45, 0xb0aaa0); rivet(ctx, -24.6, y, 0.45, 0xb0aaa0); }
      label(ctx, 'FW-1', -7.5, 4, 3.2, 'rgba(40,24,16,0.7)', { weight: '900' });
      // scorch toward the tail
      ctx.fillStyle = lin(ctx, -26, 0, -14, 0, [[0, 'rgba(30,18,10,0.55)'], [1, 'rgba(30,18,10,0)']]);
      ctx.fillRect(-26, -8, 12, 16);
      mottle(ctx, r, bb, 6, 0xb09060, 0.2, 2, 5);
      scratches(ctx, r, bb, 10, false, 0.2);
      sheen(ctx, 0, -4.6, 10, 1.3, 0.35, 0);
    },
  });
  // porthole
  lit(ctx, () => circ(ctx, 2, -0.5, 3.9), [-1.9, -4.4, 7.8, 7.8], rad(ctx, 1, -1.5, 0, 2, -0.5, 3.9, [[0, rgb(0xf0d488)], [1, rgb(0x8a6424)]]), { lw: 1.1, form: 0 });
  ctx.fillStyle = rad(ctx, 1.3, -1.4, 0, 2, -0.5, 2.6, [[0, '#7ce8f0'], [0.5, '#2a8a9a'], [1, '#0f2e38']]);
  ctx.beginPath();
  ctx.arc(2, -0.5, 2.6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(29,22,18,0.8)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  glint(ctx, 1.1, -1.6, 1, 0.9);
};

// ---------------------------------------------------------------------------
// Cannon
// ---------------------------------------------------------------------------

const paintCannonCarriage: Painter = (ctx, _p, r) => {
  const oak = PAL.oak;
  const cheek = () => {
    ctx.moveTo(-34, 21);
    ctx.lineTo(-34, 16.5);
    ctx.lineTo(-11, 3.5);
    ctx.lineTo(-8, -3.5);
    ctx.quadraticCurveTo(-6, -8.5, -1, -8.5);
    ctx.lineTo(8, -8.5);
    ctx.quadraticCurveTo(12.5, -8.5, 13.5, -4);
    ctx.lineTo(18, 13);
    ctx.lineTo(-12, 13);
    ctx.lineTo(-26, 21);
    ctx.closePath();
  };
  const cb: Box = [-34, -8.5, 52, 29.5];
  lit(ctx, cheek, cb, rgb(oak), {
    inner: () => {
      ctx.save();
      ctx.translate(-10, 6);
      ctx.rotate(-0.42);
      woodGrain(ctx, r, -40, -20, 80, 40, { base: oak, knots: 2, lineGap: 1.4 });
      ctx.restore();
      ctx.fillStyle = 'rgba(255,220,160,0.12)';
      ctx.fillRect(-34, -9, 52, 3);
      // iron straps
      ctx.fillStyle = cylH(ctx, -27.5, -24.5, 0x3c3e42);
      ctx.save();
      ctx.translate(-26, 15);
      ctx.rotate(-0.5);
      ctx.fillRect(-1.5, -8, 3, 16);
      ctx.restore();
      scratches(ctx, r, cb, 14, true, 0.25);
      grimeBottom(ctx, cb, 0.35);
    },
  });
  rivet(ctx, -27.5, 16.5, 0.9, 0x6a6a6a);
  rivet(ctx, -24.6, 12, 0.9, 0x6a6a6a);
  // trail skid
  lit(ctx, () => rr(ctx, -36, 18.5, 8, 3, 1), [-36, 18.5, 8, 3], cylV(ctx, 18.5, 21.5, 0x3c3e42), { lw: 1.1 });
  // trunnion cap strap
  tube(ctx, () => ctx.arc(0, -2, 5.6, Math.PI * 1.05, Math.PI * 1.95), 2.2, 0x55585c, { lw: 0.8 });
  hexBolt(ctx, -5.8, -1, 1.2); hexBolt(ctx, 5.8, -1, 1.2);
  // big spoked wheel
  const wx = 6, wy = 9, WR = 12;
  ctx.save();
  ctx.translate(wx, wy);
  for (let i = 0; i < 10; i++) {
    const a = (i * TAU) / 10 + 0.15;
    ctx.save();
    ctx.rotate(a);
    lit(ctx, () => poly(ctx, [2.6, -1.1, 9.6, -0.8, 9.6, 0.8, 2.6, 1.1]), [2.6, -1.1, 7, 2.2], rgb(0x8a5e36), { lw: 0.8, form: 0, bevel: 0.4 });
    ctx.restore();
  }
  // felloe + iron tyre
  lit(ctx, () => { circ(ctx, 0, 0, WR); circ(ctx, 0, 0, 9.2); }, [-WR, -WR, WR * 2, WR * 2], rad(ctx, 0, 0, 9.2, 0, 0, WR, [
    [0, rgb(0x6a4628)], [0.45, rgb(0x8a5e36)], [0.55, rgb(0x2e2f33)], [0.8, rgb(0x55585e)], [1, rgb(0x232427)],
  ]), {
    rule: 'evenodd',
    form: 0.8,
    inner: () => {
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        ctx.strokeStyle = 'rgba(20,10,4,0.6)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 9.2, Math.sin(a) * 9.2);
        ctx.lineTo(Math.cos(a) * 10.6, Math.sin(a) * 10.6);
        ctx.stroke();
        rivet(ctx, Math.cos(a + 0.5) * 11.2, Math.sin(a + 0.5) * 11.2, 0.45, 0x8a8a8a);
      }
    },
  });
  lit(ctx, () => circ(ctx, 0, 0, 3.2), [-3.2, -3.2, 6.4, 6.4], rad(ctx, -1, -1, 0, 0, 0, 3.2, [[0, rgb(0x8a8e92)], [1, rgb(0x2a2c30)]]), { lw: 1 });
  hexBolt(ctx, 0, 0, 1.3, 0x9aa0a4);
  ctx.restore();
};

const paintCannonBarrel: Painter = (ctx, _p, r) => {
  ctx.save();
  ctx.translate(0, -2); // work around the bore axis
  const iron = 0x35373c;
  const barrel = () => {
    ctx.moveTo(-17, -10);
    ctx.lineTo(34, -7);
    ctx.quadraticCurveTo(36.5, -7, 37.2, -8.6);
    ctx.lineTo(42, -8.6);
    ctx.lineTo(42, 8.6);
    ctx.lineTo(37.2, 8.6);
    ctx.quadraticCurveTo(36.5, 7, 34, 7);
    ctx.lineTo(-17, 10);
    ctx.quadraticCurveTo(-20.4, 10, -20.4, 0);
    ctx.quadraticCurveTo(-20.4, -10, -17, -10);
    ctx.closePath();
  };
  // cascabel knob
  lit(ctx, () => { circ(ctx, -20.2, 0, 2.2); }, [-22.4, -2.2, 4.4, 4.4], rad(ctx, -21, -1, 0, -20.2, 0, 2.2, [[0, rgb(0x7a7e84)], [1, rgb(0x1e1f22)]]), { lw: 1 });
  const bb: Box = [-20.4, -10, 62.4, 20];
  lit(ctx, barrel, bb, cylV(ctx, -10, 10, iron, 1.1), {
    form: 0.5,
    inner: () => {
      mottle(ctx, r, bb, 14, 0x55585e, 0.3, 2, 6);
      speckle(ctx, r, bb, 120, ['rgba(0,0,0,0.35)', 'rgba(180,180,190,0.15)', 'rgba(140,70,30,0.3)'], 0.12, 0.4);
      scratches(ctx, r, bb, 14, true, 0.2);
      // reinforcing bands
      for (const [bx, w, hh] of [[-13, 3.4, 10.6], [6, 2.6, 9.6], [31.5, 2.6, 8]] as const) {
        ctx.fillStyle = cylV(ctx, -hh, hh, shade(iron, 0.12), 1.2);
        ctx.fillRect(bx, -hh, w, hh * 2);
        seam(ctx, bx, -hh, bx, hh, 0.7);
        seam(ctx, bx + w, -hh, bx + w, hh, 0.7);
      }
      // muzzle face
      ctx.fillStyle = cylV(ctx, -8.6, 8.6, shade(iron, 0.2));
      ctx.fillRect(40.2, -8.6, 1.8, 17.2);
    },
  });
  // bands proud of the silhouette
  for (const [bx, w, hh] of [[-13, 3.4, 10.6], [6, 2.6, 9.6]] as const) {
    lit(ctx, () => rr(ctx, bx, -hh, w, hh * 2, 0.8), [bx, -hh, w, hh * 2], cylV(ctx, -hh, hh, shade(iron, 0.12), 1.2), { lw: 1.1 });
  }
  // bore
  ctx.fillStyle = rad(ctx, 42, 0, 0, 42, 0, 5, [[0, '#050404'], [1, '#1a1a1c']]);
  ctx.beginPath();
  ctx.ellipse(41.6, 0, 1.1, 5, 0, 0, TAU);
  ctx.fill();
  // trunnion boss at the pivot
  lit(ctx, () => circ(ctx, 0, 0, 3.8), [-3.8, -3.8, 7.6, 7.6], rad(ctx, -1.2, -1.4, 0, 0, 0, 3.8, [[0, rgb(0x8a8e94)], [1, rgb(0x232427)]]), { lw: 1.1 });
  // touch-hole with a brass vent
  lit(ctx, () => rr(ctx, -15.4, -11.4, 3.6, 2.2, 0.8), [-15.4, -11.4, 3.6, 2.2], rgb(PAL.brass), { lw: 0.8, form: 0 });
  ctx.fillStyle = '#0a0806';
  ctx.beginPath();
  ctx.arc(-13.6, -10.4, 0.55, 0, TAU);
  ctx.fill();
  // brass crest
  lit(ctx, () => ell(ctx, 19, 0, 2.4, 3.2), [16.6, -3.2, 4.8, 6.4], rad(ctx, 18.2, -1, 0, 19, 0, 3.2, [[0, rgb(0xf0d488)], [1, rgb(0x7a5a22)]]), { lw: 0.8, form: 0 });
  ctx.fillStyle = 'rgba(60,30,6,0.85)';
  star(ctx, 19, 0.1, 1.5, 0.65);
  ctx.restore();
};

// ---------------------------------------------------------------------------
// Boxing glove
// ---------------------------------------------------------------------------

const paintGloveBox: Painter = (ctx, _p, r) => {
  const paint = 0x2e5674;
  // trigger plate on the back
  lit(ctx, () => rr(ctx, -31.6, -9, 4, 18, 1.2), [-31.6, -9, 4, 18], cylH(ctx, -31.6, -27.6, 0x8a9296), { lw: 1.2 });
  rivet(ctx, -29.6, -6.5, 0.6); rivet(ctx, -29.6, 6.5, 0.6);
  // side face (+x) with the round opening
  lit(ctx, () => poly(ctx, [16.8, -17, 21.2, -14.8, 21.2, 14.8, 16.8, 17]), [16.8, -17, 4.4, 34], rgb(shade(paint, -0.32)), {
    lw: 1.3,
    inner: () => {
      ctx.fillStyle = rad(ctx, 19, 0, 0, 19, 0, 9, [[0, '#060404'], [1, '#1a1412']]);
      ctx.beginPath();
      ctx.ellipse(19.1, 0, 1.5, 8.2, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgb(0xc8a050);
      ctx.lineWidth = 0.7;
      ctx.stroke();
    },
  });
  // front face
  const fb: Box = [-29, -17, 46, 34];
  lit(ctx, () => rr(ctx, -29, -17, 46, 34, 2.4), fb, metal(ctx, -29, -17, 17, 17, paint), {
    inner: () => {
      woodGrain(ctx, r, -29, -17, 46, 34, { base: paint, dark: shade(paint, -0.3), light: shade(paint, 0.15), knots: 0, lineGap: 2.2 });
      ctx.fillStyle = metal(ctx, -29, -17, 17, 17, paint);
      ctx.globalAlpha = 0.55;
      ctx.fillRect(-29, -17, 46, 34);
      ctx.globalAlpha = 1;
      // cream border stripe
      ctx.strokeStyle = 'rgba(236,222,190,0.85)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      rr(ctx, -25.5, -13.5, 39, 27, 2);
      ctx.stroke();
      // starburst + stencil
      ctx.fillStyle = 'rgba(224,170,48,0.95)';
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (i * TAU) / 24;
        const rr2 = i % 2 === 0 ? 11 : 7.5;
        const x = -6 + Math.cos(a) * rr2 * 1.25, y = 0 + Math.sin(a) * rr2 * 0.95;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(29,22,18,0.7)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      label(ctx, 'POW!', -6, 0.4, 7, rgb(0xb8302a), { weight: '900' });
      edgeChips(ctx, r, fb, 22, 'rgba(160,120,80,0.7)', 1);
      scratches(ctx, r, fb, 14, true, 0.3);
      grimeBottom(ctx, fb, 0.35);
    },
  });
  // brass corner caps
  for (const [x, y, sx, sy] of [[-29, -17, 1, 1], [17, -17, -1, 1], [17, 17, -1, -1], [-29, 17, 1, -1]] as const) {
    lit(ctx, () => poly(ctx, [x, y, x + sx * 6, y, x + sx * 6, y + sy * 2, x + sx * 2, y + sy * 2, x + sx * 2, y + sy * 6, x, y + sy * 6]), [Math.min(x, x + sx * 6), Math.min(y, y + sy * 6), 6, 6], rgb(PAL.brass), { lw: 0.9, bevel: 0.5 });
    rivet(ctx, x + sx * 1.1, y + sy * 1.1, 0.45, 0xd0b070);
  }
};

const paintGloveSpring: Painter = (ctx) => {
  coilSpring(ctx, 1, 0, 39, 0, 6, 7, 1.3, 0xb4babd);
};

const paintGlove: Painter = (ctx, _p, r) => {
  const red = 0xc0322a;
  // cuff
  const cuffB: Box = [-6, -9.5, 11, 19];
  lit(ctx, () => rr(ctx, -6, -9.5, 11, 19, 3), cuffB, cylV(ctx, -9.5, 9.5, 0xe8dfca), {
    inner: () => {
      ctx.strokeStyle = 'rgba(110,70,40,0.9)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let y = -6; y <= 4; y += 2.6) {
        ctx.moveTo(-2.5, y); ctx.lineTo(1.5, y + 2.6);
        ctx.moveTo(1.5, y); ctx.lineTo(-2.5, y + 2.6);
      }
      ctx.stroke();
      ctx.fillStyle = cylV(ctx, -9.5, 9.5, red);
      ctx.fillRect(3, -9.5, 2, 19);
      mottle(ctx, r, cuffB, 4, 0x9a8a6a, 0.25, 1, 3);
    },
  });
  // mitt
  const mitt = () => {
    ctx.moveTo(3.5, -11);
    ctx.bezierCurveTo(8, -16, 24, -16.5, 28.6, -6);
    ctx.bezierCurveTo(31.2, 2, 27.5, 14.6, 16, 15);
    ctx.bezierCurveTo(8, 15.4, 3.5, 13, 3.5, 9);
    ctx.closePath();
  };
  const mb: Box = [3.5, -15.5, 27, 30.5];
  lit(ctx, mitt, mb, rad(ctx, 13, -6, 0, 16, 0, 18, [[0, rgb(shade(red, 0.25))], [0.5, rgb(red)], [1, rgb(cool(red, 0.5))]]), {
    bevel: 1.1,
    inner: () => {
      // knuckle creases
      ctx.strokeStyle = 'rgba(70,10,6,0.55)';
      ctx.lineWidth = 0.6;
      for (const k of [0, 1, 2]) {
        ctx.beginPath();
        ctx.arc(30 - k * 0.4, 1 + k * 0.3, 7 + k * 3.2, Math.PI * 0.78, Math.PI * 1.02);
        ctx.stroke();
      }
      sheen(ctx, 13, -9, 6, 2.6, 0.55, -0.15);
      glint(ctx, 10.5, -10.5, 1.6, 0.9);
      speckle(ctx, r, mb, 30, ['rgba(255,220,210,0.15)', 'rgba(40,0,0,0.25)'], 0.1, 0.3);
    },
  });
  // thumb
  const thumb = () => {
    ctx.moveTo(5.5, -6);
    ctx.bezierCurveTo(6.5, -12.5, 17, -14.5, 21.5, -9.5);
    ctx.bezierCurveTo(22.5, -7.6, 20, -5.6, 17, -6);
    ctx.bezierCurveTo(13, -6.4, 9, -4, 5.5, -6);
    ctx.closePath();
  };
  lit(ctx, thumb, [5.5, -14, 17, 10], rad(ctx, 12, -11, 0, 13, -8, 9, [[0, rgb(shade(red, 0.42))], [1, rgb(shade(red, 0.02))]]), { lw: 1.3, bevel: 0.8 });
  ctx.save();
  ctx.setLineDash([0.8, 0.7]);
  ctx.strokeStyle = 'rgba(250,230,210,0.75)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(7, -7);
  ctx.bezierCurveTo(9, -10.5, 16, -12, 20, -9);
  ctx.stroke();
  ctx.restore();
  // little brand patch
  lit(ctx, () => ell(ctx, 13, 6, 3.2, 2.3), [9.8, 3.7, 6.4, 4.6], rgb(0xeadcbc), { lw: 0.7, bevel: 0.4, form: 0.4 });
  ctx.fillStyle = rgb(0xb8302a);
  star(ctx, 13, 6.1, 1.6, 0.7);
};

// ---------------------------------------------------------------------------
// Electrics
// ---------------------------------------------------------------------------

const paintBattery: Painter = (ctx, _p, r) => {
  const caseC = 0x2f3236;
  const box: Box = [-17, -24, 34, 52];
  lit(ctx, () => rr(ctx, -17, -24, 34, 52, 3.2), box, cylH(ctx, -17, 17, caseC, 0.8), {
    inner: () => {
      // lid
      ctx.fillStyle = cylH(ctx, -17, 17, 0x1f2124, 0.9);
      ctx.fillRect(-17, -24, 34, 6);
      seam(ctx, -17, -18, 17, -18, 0.8);
      label(ctx, 'FOLLY CELL', 0, -14.4, 3, 'rgba(236,224,196,0.75)', { weight: '900' });
      // label band
      ctx.fillStyle = cylH(ctx, -17, 17, PAL.orange, 0.8);
      ctx.fillRect(-17, -10, 34, 27);
      ctx.fillStyle = cylH(ctx, -17, 17, 0x1e1b19, 0.8);
      ctx.fillRect(-17, 11.5, 34, 3.2);
      // lightning bolt
      ctx.fillStyle = 'rgba(30,20,14,0.9)';
      ctx.beginPath();
      poly(ctx, [-11, -7.5, -6.4, -7.5, -8.6, -2.5, -5.6, -2.5, -12, 7, -10, 0, -13, 0]);
      ctx.fill();
      label(ctx, '6V', 4.2, 0.2, 11, 'rgba(30,20,14,0.95)', { weight: '900' });
      label(ctx, 'HEAVY DUTY', 0, 13.1, 2.3, 'rgba(236,224,196,0.8)', { weight: '800' });
      seam(ctx, -17, -10, 17, -10, 0.6);
      seam(ctx, -17, 17, 17, 17, 0.6);
      edgeChips(ctx, r, box, 18, 'rgba(160,150,140,0.5)', 0.9);
      scratches(ctx, r, box, 18, true, 0.3);
      grimeBottom(ctx, box, 0.35);
    },
  });
  // + terminal: brass spring post
  lit(ctx, () => rr(ctx, -3.2, -25.8, 6.4, 2.2, 0.8), [-3.2, -25.8, 6.4, 2.2], rgb(0x5a5e62), { lw: 0.9 });
  coilSpring(ctx, 0, -24.6, 0, -30.6, 2.1, 3.5, 0.75, 0xd2a64e);
  ctx.save();
  ctx.fillStyle = rgb(0xd8402e);
  ctx.fillRect(-8.6, -22.2, 3.6, 1);
  ctx.fillRect(-7.3, -23.5, 1, 3.6);
  ctx.restore();
};

const paintSwitchPlate: Painter = (ctx, _p, r) => {
  const enamel = 0xd9ccae;
  // conduit stub below
  lit(ctx, () => rr(ctx, -3.6, 18, 7.2, 8.4, 1), [-3.6, 18, 7.2, 8.4], cylH(ctx, -3.6, 3.6, 0x6a7276), {
    lw: 1.2,
    inner: () => { for (let y = 20; y < 26; y += 1.6) seam(ctx, -3.6, y, 3.6, y, 0.6); },
  });
  const box: Box = [-16, -32, 32, 52];
  lit(ctx, () => rr(ctx, -16, -32, 32, 52, 4), box, metal(ctx, -16, -32, 16, 20, enamel), {
    inner: () => {
      mottle(ctx, r, box, 10, 0xa89068, 0.2, 2, 6);
      lit(ctx, () => rr(ctx, -12.6, -28.6, 25.2, 45.2, 2.6), [-12.6, -28.6, 25.2, 45.2], rgb(shade(enamel, 0.04)), { lw: 0.6, bevel: 0.6, form: 0.4 });
      label(ctx, 'OFF', -7.6, -3.4, 3, 'rgba(50,34,20,0.85)', { weight: '900' });
      label(ctx, 'ON', 7.6, -3.4, 3, 'rgba(160,40,30,0.9)', { weight: '900' });
      ctx.strokeStyle = 'rgba(50,34,20,0.5)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.arc(0, -12, 9.5, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();
      label(ctx, 'FOLLYWORKS', 0, 8.5, 2.2, 'rgba(50,34,20,0.5)', { weight: '800' });
      edgeChips(ctx, r, box, 14, 'rgba(70,60,50,0.6)', 0.8);
      scratches(ctx, r, box, 10, false, 0.15);
      grimeBottom(ctx, box, 0.25);
    },
  });
  screw(ctx, 0, -28.6, 1.5, 0.5);
  screw(ctx, 0, 15.8, 1.5, 2.2);
  // escutcheon + slot
  lit(ctx, () => rr(ctx, -9.5, -16.8, 19, 9.6, 4.8), [-9.5, -16.8, 19, 9.6], metal(ctx, -9, -17, 9, -7, 0xbcc3c6), { lw: 1.2 });
  ctx.fillStyle = rgb(0x0e0b0a);
  ctx.beginPath();
  rr(ctx, -7, -14.2, 14, 4.4, 2.2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-5.5, -10.2, 11, 0.4);
  // LED window
  lit(ctx, () => circ(ctx, 12, -24, 2.5), [9.5, -26.5, 5, 5], rgb(0x9aa2a6), { lw: 0.9, form: 0 });
  ctx.fillStyle = rad(ctx, 11.5, -24.5, 0, 12, -24, 1.7, [[0, '#4a2a22'], [1, '#160c0a']]);
  ctx.beginPath();
  ctx.arc(12, -24, 1.7, 0, TAU);
  ctx.fill();
  glint(ctx, 11.4, -24.6, 0.6, 0.8);
};

const paintSwitchLever: Painter = (ctx) => {
  lit(ctx, () => circ(ctx, 0, 0, 3.4), [-3.4, -3.4, 6.8, 6.8], rad(ctx, -1, -1, 0, 0, 0, 3.4, [[0, rgb(0xe6ecee)], [1, rgb(0x5e676c)]]), { lw: 1.1 });
  tube(ctx, () => { ctx.moveTo(0, -1); ctx.lineTo(0, -23); }, 2.4, 0xc3c9cc);
  lit(ctx, () => circ(ctx, 0, -25, 4.3), [-4.3, -29.3, 8.6, 8.6], rad(ctx, -1.4, -26.5, 0, 0, -25, 4.6, [[0, rgb(0xf07060)], [0.5, rgb(PAL.red)], [1, rgb(0x5a140e)]]), { lw: 1.2, form: 0 });
  glint(ctx, -1.5, -26.6, 1.3, 0.95);
};

const paintPlateBase: Painter = (ctx, _p, r) => {
  const steel = 0x7e868a;
  const trap = () => poly(ctx, [-38, 7, 38, 7, 30, -5, -30, -5]);
  const box: Box = [-38, -5, 76, 12];
  lit(ctx, trap, box, metal(ctx, -38, -5, 38, 7, steel), {
    inner: () => {
      // diamond plate
      for (let y = -2.5; y < 7; y += 2.6) {
        for (let x = -38 + ((y + 2.5) % 5.2 === 0 ? 0 : 2.6); x < 38; x += 5.2) {
          const vert = Math.round((x + y) / 2.6) % 2 === 0;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(vert ? 0.75 : -0.75);
          ctx.fillStyle = 'rgba(16,14,14,0.45)';
          ctx.fillRect(-1.3 + 0.25, -0.4 + 0.3, 2.6, 0.8);
          ctx.fillStyle = 'rgba(230,236,238,0.45)';
          ctx.fillRect(-1.3, -0.4, 2.6, 0.8);
          ctx.restore();
        }
      }
      // recess where the pad sinks
      ctx.fillStyle = lin(ctx, 0, -5, 0, -1, [[0, 'rgba(8,6,6,0.9)'], [1, 'rgba(8,6,6,0.4)']]);
      ctx.fillRect(-30.5, -5, 61, 3.8);
      scratches(ctx, r, box, 12, true, 0.3);
      grimeBottom(ctx, box, 0.4);
    },
  });
  hexBolt(ctx, -32, 3.6, 1.4);
  hexBolt(ctx, 32, 3.6, 1.4);
};

const paintPlateTop: Painter = (ctx, _p, r) => {
  const box: Box = [-30, -3, 60, 6];
  lit(ctx, () => rr(ctx, -30, -3, 60, 6, 2), box, rgb(0xe0ac2e), {
    lw: 1.3,
    inner: () => {
      hazard(ctx, box, 6, 0xe0ac2e, 0x231c18, -0.9);
      ctx.fillStyle = 'rgba(255,245,220,0.3)';
      ctx.fillRect(-30, -3, 60, 1.1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-30, 1.8, 60, 1.2);
      scratches(ctx, r, box, 14, true, 0.35);
      speckle(ctx, r, box, 40, ['rgba(0,0,0,0.25)'], 0.1, 0.3);
    },
  });
};

const paintTimer: Painter = (ctx, _p, r) => {
  const enamel = PAL.mustard;
  // wall ears
  for (const s of [-1, 1]) {
    lit(ctx, () => rr(ctx, s * 25.5 - 2.8, -3.2, 5.6, 6.4, 1.6), [s * 25.5 - 2.8, -3.2, 5.6, 6.4], cylV(ctx, -3.2, 3.2, 0x7a8286), { lw: 1.1 });
    screw(ctx, s * 26.2, 0, 1.2, 0.7 * s);
  }
  // bell
  lit(ctx, () => {
    ctx.moveTo(-8.5, -18);
    ctx.bezierCurveTo(-8.5, -24.2, 8.5, -24.2, 8.5, -18);
    ctx.closePath();
  }, [-8.5, -23, 17, 5], rad(ctx, -3, -22, 0, 0, -19, 9, [[0, rgb(0xf6dc96)], [0.6, rgb(PAL.brass)], [1, rgb(0x6a4c1c)]]), { lw: 1.3, form: 0.4 });
  glint(ctx, -3.2, -21.6, 1.3, 0.9);
  lit(ctx, () => circ(ctx, 0, -22.8, 1), [-1, -23.8, 2, 2], rgb(0x8a6a30), { lw: 0.7, form: 0, bevel: 0 });
  // case
  const box: Box = [-24, -19, 48, 42];
  lit(ctx, () => rr(ctx, -24, -19, 48, 42, 8), box, metal(ctx, -24, -19, 24, 23, enamel), {
    inner: () => {
      mottle(ctx, r, box, 10, 0x8a6018, 0.22, 2, 6);
      edgeChips(ctx, r, box, 20, 'rgba(50,40,30,0.75)', 1);
      scratches(ctx, r, box, 12, true, 0.3);
      label(ctx, 'MINUTE MINDER', 0, 19.6, 2.4, 'rgba(60,36,10,0.65)', { weight: '800' });
      grimeBottom(ctx, box, 0.3);
    },
  });
  // chrome bezel
  lit(ctx, () => { circ(ctx, 0, 0, 17.4); circ(ctx, 0, 0, 15.2); }, [-17.4, -17.4, 34.8, 34.8], metal(ctx, -17, -17, 17, 17, 0xc0c7ca), { rule: 'evenodd', lw: 1.1 });
  // dial face
  lit(ctx, () => circ(ctx, 0, 0, 15.2), [-15.2, -15.2, 30.4, 30.4], rad(ctx, -3, -4, 0, 0, 0, 15.2, [[0, rgb(0xfaf2de)], [1, rgb(0xd9ccad)]]), {
    lw: 0.8,
    form: 0.3,
    bevel: 0,
    inner: () => {
      // red "nearly done" segment
      ctx.strokeStyle = 'rgba(196,58,44,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 13.6, -Math.PI / 2 - 0.55, -Math.PI / 2);
      ctx.stroke();
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU - Math.PI / 2;
        const major = i % 5 === 0;
        const r0 = major ? 11.4 : 12.8;
        ctx.strokeStyle = major ? 'rgba(30,22,16,0.95)' : 'rgba(30,22,16,0.6)';
        ctx.lineWidth = major ? 0.6 : 0.28;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * 14.6, Math.sin(a) * 14.6);
        ctx.stroke();
      }
      for (let i = 0; i < 12; i += 3) {
        const a = (i / 12) * TAU - Math.PI / 2;
        label(ctx, String(i * 5), Math.cos(a) * 8.8, Math.sin(a) * 8.8 + 0.2, 2.8, 'rgba(30,22,16,0.9)', { weight: '800' });
      }
      label(ctx, 'MIN', 0, 4.4, 1.9, 'rgba(30,22,16,0.6)');
      // glass reflection
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.ellipse(-5, -7, 9, 3.2, -0.6, 0, TAU);
      ctx.fill();
    },
  });
};

const paintTimerHand: Painter = (ctx) => {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  poly(ctx, [0, -15.4, 1.05, -2.5, 0.75, 1.6, -0.75, 1.6, -1.05, -2.5]);
  ctx.fillStyle = lin(ctx, -1, 0, 1, 0, [[0, '#e05a48'], [1, '#8a1e16']]);
  ctx.fill();
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = OL;
  ctx.stroke();
  ctx.restore();
  lit(ctx, () => circ(ctx, 0, 0, 1.75), [-1.75, -1.75, 3.5, 3.5], rad(ctx, -0.5, -0.6, 0, 0, 0, 1.75, [[0, rgb(0xf6dc96)], [1, rgb(0x7a5a22)]]), { lw: 0.6, form: 0, bevel: 0 });
};

function gateSymbol(ctx: Ctx, mode: string, cx: number, cy: number): void {
  const path = () => {
    ctx.save();
    ctx.translate(cx, cy);
    switch (mode) {
      case 'and':
        ctx.moveTo(-10, -2.6); ctx.lineTo(-4, -2.6);
        ctx.moveTo(-10, 2.6); ctx.lineTo(-4, 2.6);
        ctx.moveTo(-4, -5); ctx.lineTo(0, -5);
        ctx.arc(0, 0, 5, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-4, 5); ctx.closePath();
        ctx.moveTo(5, 0); ctx.lineTo(10, 0);
        break;
      case 'xor':
        ctx.moveTo(-7.6, -5); ctx.quadraticCurveTo(-4.6, 0, -7.6, 5);
      // falls through to OR
      case 'or':
        ctx.moveTo(-10, -2.6); ctx.lineTo(-4.4, -2.6);
        ctx.moveTo(-10, 2.6); ctx.lineTo(-4.4, 2.6);
        ctx.moveTo(-5.6, -5);
        ctx.quadraticCurveTo(1, -5, 5.4, 0);
        ctx.quadraticCurveTo(1, 5, -5.6, 5);
        ctx.quadraticCurveTo(-2.6, 0, -5.6, -5);
        ctx.moveTo(5.4, 0); ctx.lineTo(10, 0);
        break;
      case 'not':
        ctx.moveTo(-10, 0); ctx.lineTo(-4.6, 0);
        ctx.moveTo(-4.6, -5); ctx.lineTo(3.4, 0); ctx.lineTo(-4.6, 5); ctx.closePath();
        ctx.moveTo(6.6, 0); ctx.arc(5, 0, 1.6, 0, TAU);
        ctx.moveTo(6.6, 0); ctx.lineTo(10, 0);
        break;
      default: {
        // toggle: a cycling arrow around a T
        ctx.moveTo(4.6, -2.5);
        ctx.arc(0, 0, 5.2, -0.5, Math.PI * 1.55);
        ctx.moveTo(4.6, -2.5); ctx.lineTo(5.6, -5.6);
        ctx.moveTo(4.6, -2.5); ctx.lineTo(1.6, -3.2);
        ctx.moveTo(-2.2, -2); ctx.lineTo(2.2, -2);
        ctx.moveTo(0, -2); ctx.lineTo(0, 2.8);
        ctx.moveTo(-10, 0); ctx.lineTo(-5.2, 0);
        ctx.moveTo(5.2, 1); ctx.lineTo(10, 1);
      }
    }
    ctx.restore();
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  path();
  ctx.strokeStyle = 'rgba(70,220,240,0.22)';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(110,236,250,0.5)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgb(205,252,255)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();
}

const paintLogicBox: Painter = (ctx, p, r) => {
  const mode = str(p, 'mode', 'and').toLowerCase();
  const grey = 0x7b8386;
  const box: Box = [-24, -19, 48, 40];
  lit(ctx, () => rr(ctx, -24, -19, 48, 40, 4), box, metal(ctx, -24, -19, 24, 21, grey), {
    inner: () => {
      mottle(ctx, r, box, 10, 0x4a5256, 0.22, 2, 6);
      lit(ctx, () => rr(ctx, -21, -16.4, 42, 35, 2.6), [-21, -16.4, 42, 35], rgb(shade(grey, 0.03)), { lw: 0.6, bevel: 0.7, form: 0.3 });
      edgeChips(ctx, r, box, 16, 'rgba(200,205,205,0.6)', 0.9);
      scratches(ctx, r, box, 16, true, 0.3);
      grimeBottom(ctx, box, 0.35);
    },
  });
  for (const [x, y] of [[-20.6, -15.4], [20.6, -15.4], [-20.6, 17.4], [20.6, 17.4]]) screw(ctx, x, y, 1.25, x * y > 0 ? 0.6 : 2.1);
  // enamel label
  lit(ctx, () => rr(ctx, -14, -15, 28, 8, 1.6), [-14, -15, 28, 8], rgb(0x22314a), {
    lw: 1,
    bevel: 0.6,
    inner: () => {
      ctx.strokeStyle = 'rgba(236,224,196,0.7)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      rr(ctx, -13, -14, 26, 6, 1.2);
      ctx.stroke();
      label(ctx, mode.toUpperCase(), 0, -10.8, mode === 'toggle' ? 3.6 : 4.4, 'rgb(244,236,214)', { weight: '900', maxW: 23 });
      sheen(ctx, -8, -13.5, 5, 1, 0.35, 0);
    },
  });
  rivet(ctx, -12.4, -11, 0.45, 0xb0b0a8);
  rivet(ctx, 12.4, -11, 0.45, 0xb0b0a8);
  // dark glass window with the glowing symbol
  lit(ctx, () => rr(ctx, -13.5, -4.6, 27, 18, 2.6), [-13.5, -4.6, 27, 18], rgb(0x0e181c), {
    lw: 1.1,
    bevel: 0.6,
    hi: 'rgba(0,0,0,0.5)',
    lo: 'rgba(200,230,240,0.25)',
    inner: () => {
      ctx.fillStyle = rad(ctx, 0, 4.4, 0, 0, 4.4, 14, [[0, 'rgba(40,180,200,0.22)'], [1, 'rgba(40,180,200,0)']]);
      ctx.fillRect(-13.5, -4.6, 27, 18);
      gateSymbol(ctx, mode, 0, 4.4);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      poly(ctx, [-13.5, -4.6, -4, -4.6, -13.5, 6]);
      ctx.fill();
    },
  });
};

const bulbPainter = (on: boolean): Painter => (ctx, _p, r) => {
  // cable stub
  tube(ctx, () => { ctx.moveTo(0, 24); ctx.lineTo(0, 29.4); }, 2.8, 0x2e2a28);
  // ceramic flange + socket
  const cer = 0xe6dfd0;
  lit(ctx, () => rr(ctx, -12.5, 19.5, 25, 6.5, 3), [-12.5, 19.5, 25, 6.5], cylV(ctx, 19.5, 26, cer), {
    inner: () => mottle(ctx, r, [-12.5, 19.5, 25, 6.5], 4, 0x8a8070, 0.2, 1, 3),
  });
  lit(ctx, () => rr(ctx, -9, 7, 18, 13.5, 2.6), [-9, 7, 18, 13.5], cylH(ctx, -9, 9, cer, 0.9), {
    inner: () => {
      for (const y of [10.5, 14, 17.5]) seam(ctx, -9, y, 9, y, 0.55);
      edgeChips(ctx, r, [-9, 7, 18, 13.5], 6, 'rgba(120,110,100,0.6)', 0.6);
      sheen(ctx, -4.5, 10, 2.4, 1, 0.5, 0);
    },
  });
  // brass screw base
  lit(ctx, () => rr(ctx, -6.4, 1, 12.8, 7.6, 1.4), [-6.4, 1, 12.8, 7.6], cylH(ctx, -6.4, 6.4, PAL.brass), {
    lw: 1.2,
    inner: () => {
      for (let y = 2.2; y < 8.6; y += 1.6) {
        ctx.strokeStyle = 'rgba(60,40,10,0.6)';
        ctx.lineWidth = 0.45;
        ctx.beginPath();
        ctx.moveTo(-6.4, y + 0.6);
        ctx.lineTo(6.4, y);
        ctx.stroke();
      }
    },
  });
  // glass
  const glass = () => {
    ctx.moveTo(-5.8, 2);
    ctx.bezierCurveTo(-5.8, -3, -13, -7, -13, -15);
    ctx.arc(0, -15, 13, Math.PI, TAU);
    ctx.bezierCurveTo(13, -7, 5.8, -3, 5.8, 2);
    ctx.closePath();
  };
  ctx.save();
  ctx.beginPath();
  glass();
  if (on) {
    ctx.fillStyle = rad(ctx, 0, -13, 0, 0, -13, 16, [
      [0, 'rgba(255,250,215,0.98)'], [0.35, 'rgba(255,214,120,0.85)'], [0.8, 'rgba(250,160,70,0.65)'], [1, 'rgba(220,120,50,0.7)'],
    ]);
  } else {
    ctx.fillStyle = rad(ctx, -2, -15, 0, 0, -13, 15, [
      [0, 'rgba(210,225,228,0.1)'], [0.7, 'rgba(200,218,222,0.2)'], [1, 'rgba(225,238,240,0.45)'],
    ]);
  }
  ctx.fill();
  ctx.clip();
  // glass stem & lead wires
  ctx.fillStyle = on ? 'rgba(255,240,200,0.5)' : 'rgba(220,232,236,0.35)';
  ctx.beginPath();
  poly(ctx, [-2.6, 2, 2.6, 2, 1.2, -8, -1.2, -8]);
  ctx.fill();
  ctx.strokeStyle = on ? 'rgba(255,220,150,0.9)' : 'rgba(80,70,60,0.85)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(-1, -7.5); ctx.lineTo(-4.6, -14);
  ctx.moveTo(1, -7.5); ctx.lineTo(4.6, -14);
  ctx.moveTo(0, -8); ctx.lineTo(0, -17.5);
  ctx.stroke();
  // filament coil
  const fil = () => {
    ctx.moveTo(-4.6, -14);
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const x = -4.6 + t * 9.2;
      const y = -14 - Math.sin(t * Math.PI) * 3.4 + Math.sin(t * Math.PI * 9) * 0.7;
      ctx.lineTo(x, y);
    }
  };
  ctx.lineJoin = 'round';
  if (on) {
    ctx.beginPath(); fil();
    ctx.strokeStyle = 'rgba(255,230,140,0.55)';
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,220,1)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  } else {
    ctx.beginPath(); fil();
    ctx.strokeStyle = 'rgba(50,40,34,0.9)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  // reflections
  ctx.strokeStyle = on ? 'rgba(255,255,240,0.6)' : 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -15, 10.2, Math.PI * 1.08, Math.PI * 1.42);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(150,200,230,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -15, 11.3, Math.PI * 0.05, Math.PI * 0.4);
  ctx.stroke();
  ctx.restore();
  glint(ctx, -6.6, -21, 1.7, 0.9);
  outline(ctx, glass, 1.4);
};

// ---------------------------------------------------------------------------
// Bolt the robot
// ---------------------------------------------------------------------------

const ROBOT_TIN = 0xd8742c;

const paintRobotBody: Painter = (ctx, _p, r) => {
  const tin = ROBOT_TIN;
  const steel = 0x5f686e;
  // wind-up key (behind)
  tube(ctx, () => { ctx.moveTo(-10, 0.5); ctx.lineTo(-15.5, 0.5); }, 1.8, PAL.brass);
  const bow = () => {
    ell(ctx, -17.2, -3.4, 2.3, 3.6);
    ell(ctx, -17.2, 4.4, 2.3, 3.6);
    circ(ctx, -17.2, -3.4, 0.9);
    circ(ctx, -17.2, 4.4, 0.9);
  };
  lit(ctx, bow, [-19.5, -7, 4.6, 15], rad(ctx, -18, -3, 0, -17.2, 0.5, 8, [[0, rgb(0xf2d690)], [0.6, rgb(PAL.brass)], [1, rgb(0x7a5a22)]]), { lw: 1.1, rule: 'evenodd' });
  lit(ctx, () => circ(ctx, -16.2, 0.5, 1.6), [-17.8, -1.1, 3.2, 3.2], rgb(0xb08840), { lw: 0.8 });
  // back hook ring (anchor at -12,-6)
  tube(ctx, () => ctx.arc(-12.6, -6, 1.5, 0, TAU), 0.8, 0xa9b0b4, { lw: 0.55 });
  // antenna
  tube(ctx, () => { ctx.moveTo(0, -21); ctx.lineTo(0, -26.4); }, 1.1, 0xa9b0b4, { lw: 0.7 });
  lit(ctx, () => rr(ctx, -2.2, -23.6, 4.4, 2, 0.8), [-2.2, -23.6, 4.4, 2], rgb(steel), { lw: 0.8 });
  lit(ctx, () => circ(ctx, 0, -27.8, 2.1), [-2.1, -29.9, 4.2, 4.2], rad(ctx, -0.7, -28.6, 0, 0, -27.8, 2.2, [[0, rgb(0xff8a74)], [0.6, rgb(0xd8392b)], [1, rgb(0x6a120c)]]), { lw: 0.9, form: 0 });
  glint(ctx, -0.7, -28.6, 0.8, 0.95);
  // hip plate
  lit(ctx, () => rr(ctx, -10, 6.5, 20, 4.2, 1.6), [-10, 6.5, 20, 4.2], cylV(ctx, 6.5, 10.7, steel), { lw: 1.2 });
  // torso
  const tb: Box = [-11, -7.5, 22, 15.5];
  lit(ctx, () => rr(ctx, -11, -7.5, 22, 15.5, 4.2), tb, metal(ctx, -11, -7, 11, 8, tin), {
    inner: () => {
      mottle(ctx, r, tb, 5, 0xa04a14, 0.2, 2, 4);
      // chest panel with two lamps
      lit(ctx, () => rr(ctx, -2, -4.2, 10, 7.6, 2), [-2, -4.2, 10, 7.6], cylV(ctx, -4.2, 3.4, PAL.cream, 0.6), { lw: 0.7, bevel: 0.5 });
      for (const [x, c] of [[1, 0x7fe05a], [5, 0xf0b040]] as const) {
        ctx.fillStyle = rgb(c);
        ctx.beginPath();
        ctx.arc(x, -1.6, 1.15, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(29,22,18,0.8)';
        ctx.lineWidth = 0.35;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(x - 0.4, -2, 0.35, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(40,30,20,0.6)';
      for (let k = 0; k < 3; k++) ctx.fillRect(0 + k * 2.6, 1.4, 1.6, 0.5);
      for (const [x, y] of [[-9, -5.5], [9, -5.5], [-9, 6], [9, 6]]) rivet(ctx, x, y, 0.55, 0xd8c8a8);
      edgeChips(ctx, r, tb, 10, 'rgba(90,60,40,0.7)', 0.6);
      scratches(ctx, r, tb, 8, true, 0.3);
    },
  });
  // neck
  lit(ctx, () => rr(ctx, -5, -9.4, 10, 3, 1), [-5, -9.4, 10, 3], cylV(ctx, -9.4, -6.4, steel), {
    lw: 1,
    inner: () => { for (let x = -3.5; x < 5; x += 1.6) seam(ctx, x, -9.2, x, -6.6, 0.5); },
  });
  // head
  const hb: Box = [-12, -22.5, 25, 14.5];
  lit(ctx, () => rr(ctx, -12, -22.5, 25, 14.5, 5.6), hb, metal(ctx, -12, -22, 13, -8, tin), {
    bevel: 1.1,
    inner: () => {
      mottle(ctx, r, hb, 5, 0xa04a14, 0.18, 2, 4);
      // cream face band
      ctx.fillStyle = cylV(ctx, -22.5, -8, PAL.cream, 0.5);
      ctx.beginPath();
      rr(ctx, -1.5, -22.5, 15, 14.5, 4);
      ctx.fill();
      seam(ctx, -1.5, -21.5, -1.5, -9, 0.5);
      // blush
      ctx.fillStyle = rad(ctx, 10.6, -10.2, 0, 10.6, -10.2, 2.4, [[0, 'rgba(240,110,110,0.6)'], [1, 'rgba(240,110,110,0)']]);
      ctx.fillRect(7, -14, 6.4, 6.4);
      ctx.strokeStyle = 'rgba(200,70,70,0.6)';
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(9.6, -10.6); ctx.lineTo(10.2, -9.8);
      ctx.moveTo(10.9, -10.6); ctx.lineTo(11.5, -9.8);
      ctx.stroke();
      // tiny smile
      ctx.strokeStyle = 'rgba(29,22,18,0.9)';
      ctx.lineWidth = 0.55;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(4.4, -9.3);
      ctx.quadraticCurveTo(6.2, -8.1, 7.8, -9.4);
      ctx.stroke();
      // forehead rivets
      for (let x = -9; x <= -4; x += 2.5) rivet(ctx, x, -20.4, 0.45, 0xd8c8a8);
      edgeChips(ctx, r, hb, 8, 'rgba(90,60,40,0.7)', 0.6);
      scratches(ctx, r, hb, 6, true, 0.3);
      sheen(ctx, -6, -20.5, 5, 1.2, 0.45, 0);
    },
  });
  // ear bolt
  lit(ctx, () => circ(ctx, -6.4, -15, 3.2), [-9.6, -18.2, 6.4, 6.4], rad(ctx, -7.4, -16, 0, -6.4, -15, 3.2, [[0, rgb(0xb8bfc3)], [1, rgb(0x41484c)]]), { lw: 1 });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.4;
    ctx.fillStyle = 'rgba(29,22,18,0.6)';
    ctx.beginPath();
    ctx.arc(-6.4 + Math.cos(a) * 2, -15 + Math.sin(a) * 2, 0.35, 0, TAU);
    ctx.fill();
  }
  // visor eye: chrome bezel, dark glass, cyan iris, anime shine
  const ex = ROBOT_EYE.x, ey = ROBOT_EYE.y;
  lit(ctx, () => circ(ctx, ex, ey, 5.6), [ex - 5.6, ey - 5.6, 11.2, 11.2], metal(ctx, ex - 6, ey - 6, ex + 6, ey + 6, 0xc8cfd2), { lw: 1.2 });
  ctx.fillStyle = rad(ctx, ex - 1, ey - 1.5, 0, ex, ey, 4.4, [[0, '#18323c'], [1, '#060c10']]);
  ctx.beginPath();
  ctx.arc(ex, ey, 4.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.fillStyle = rad(ctx, ex + 0.8, ey + 0.4, 0, ex + 0.8, ey + 0.4, 2.8, [[0, '#e8ffff'], [0.35, '#7cf2fa'], [0.8, '#1fb2cc'], [1, 'rgba(20,150,180,0)']]);
  ctx.beginPath();
  ctx.arc(ex + 0.8, ey + 0.4, 2.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(ex - 1.4, ey - 1.7, 1.15, 0.9, -0.5, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex + 1.9, ey + 1.9, 0.45, 0, TAU);
  ctx.fill();
  // near-side arm
  tube(ctx, () => { ctx.moveTo(1, -3); ctx.quadraticCurveTo(-0.5, 2, 2.5, 5.6); }, 2.6, shade(tin, -0.05), { lw: 0.9 });
  lit(ctx, () => circ(ctx, 1, -3.4, 2.4), [-1.4, -5.8, 4.8, 4.8], rad(ctx, 0.3, -4.2, 0, 1, -3.4, 2.4, [[0, rgb(0xb8bfc3)], [1, rgb(0x41484c)]]), { lw: 0.9 });
  lit(ctx, () => circ(ctx, 3, 6.6, 2.2), [0.8, 4.4, 4.4, 4.4], rad(ctx, 2.3, 5.8, 0, 3, 6.6, 2.2, [[0, rgb(0xc9d0d3)], [1, rgb(0x4a5155)]]), { lw: 0.9 });
};

const paintRobotLeg: Painter = (ctx) => {
  const steel = 0x5f686e;
  lit(ctx, () => rr(ctx, -2.2, 0, 4.4, 10, 1.8), [-2.2, 0, 4.4, 10], cylH(ctx, -2.2, 2.2, steel), {
    lw: 1,
    inner: () => { seam(ctx, -2.2, 5, 2.2, 5, 0.6); },
  });
  lit(ctx, () => {
    ctx.moveTo(-3.4, 13.6);
    ctx.lineTo(-3.4, 10.6);
    ctx.quadraticCurveTo(-3.4, 8.8, -1.4, 8.8);
    ctx.lineTo(1.2, 8.8);
    ctx.quadraticCurveTo(3.9, 9, 3.9, 12.2);
    ctx.lineTo(3.9, 13.6);
    ctx.closePath();
  }, [-3.4, 8.8, 7.3, 4.8], metal(ctx, -3, 9, 4, 13.6, ROBOT_TIN), {
    lw: 1,
    inner: () => {
      ctx.fillStyle = rgb(0x2a2422);
      ctx.fillRect(-3.4, 12.5, 7.3, 1.2);
    },
  });
  lit(ctx, () => circ(ctx, 0, 0, 2.3), [-2.3, -2.3, 4.6, 4.6], rad(ctx, -0.7, -0.8, 0, 0, 0, 2.3, [[0, rgb(0xc0c7ca)], [1, rgb(0x41484c)]]), { lw: 0.9 });
};

const paintRobotEye: Painter = (ctx) => {
  ctx.fillStyle = rad(ctx, 0, 0, 0, 0, 0, 7, [
    [0, 'rgba(210,255,255,0.95)'],
    [0.22, 'rgba(120,240,252,0.75)'],
    [0.55, 'rgba(40,190,230,0.28)'],
    [1, 'rgba(20,150,220,0)'],
  ]);
  ctx.fillRect(-7, -7, 14, 14);
};

// ---------------------------------------------------------------------------
// Cactus
// ---------------------------------------------------------------------------

const paintCactus: Painter = (ctx, _p, r) => {
  const green = 0x5b8a45;
  // arms (behind the column)
  tube(ctx, () => { ctx.moveTo(-6, -4.5); ctx.quadraticCurveTo(-14.4, -4.5, -14.4, -12); ctx.lineTo(-14.4, -16.5); }, 6.2, green, { lw: 1.3, hi: 0.3 });
  tube(ctx, () => { ctx.moveTo(6, -12.5); ctx.quadraticCurveTo(13.4, -12.5, 13.4, -18.5); ctx.lineTo(13.4, -21.5); }, 5.4, green, { lw: 1.3, hi: 0.3 });
  // column
  const cb: Box = [-9, -29, 18, 34];
  lit(ctx, () => rr(ctx, -9, -29, 18, 34, 8.6), cb, cylH(ctx, -9, 9, green, 0.9), {
    inner: () => {
      for (const x of [-5.5, -2, 1.8, 5.4]) {
        ctx.strokeStyle = 'rgba(20,50,20,0.45)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, -28);
        ctx.quadraticCurveTo(x * 1.12, -10, x, 6);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(200,240,170,0.22)';
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.moveTo(x - 0.8, -28);
        ctx.quadraticCurveTo(x * 1.12 - 0.8, -10, x - 0.8, 6);
        ctx.stroke();
      }
      mottle(ctx, r, cb, 5, 0x2e5a28, 0.25, 2, 5);
    },
  });
  // spines on column and arms
  const areole = (x: number, y: number) => {
    ctx.fillStyle = 'rgba(245,235,200,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, 0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,248,225,0.9)';
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    for (const a of [-2.4, -0.7, 0.9]) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a + r.range(-0.3, 0.3)) * 1.4, y + Math.sin(a + r.range(-0.3, 0.3)) * 1.4);
    }
    ctx.stroke();
  };
  for (const x of [-7.4, -3.8, 0, 3.6, 7.2]) {
    for (let y = -25 + (Math.abs(x) % 2); y < 3; y += 3.6) {
      const w = Math.sqrt(Math.max(0, 1 - ((y + 12) / 17) ** 6));
      if (Math.abs(x) > 8.6 * w) continue;
      areole(x, y + r.range(-0.4, 0.4));
    }
  }
  for (let y = -15; y < -5; y += 3.2) areole(-14.4 + r.range(-1.5, 1.5), y);
  for (let y = -20; y < -13; y += 3.2) areole(13.4 + r.range(-1.2, 1.2), y);
  // pot
  const pot = 0xb5603b;
  const pb: Box = [-13.5, 9, 27, 19];
  lit(ctx, () => poly(ctx, [-13.6, 9, 13.6, 9, 11, 28, -11, 28]), pb, cylH(ctx, -13.6, 13.6, pot, 0.9), {
    inner: () => {
      mottle(ctx, r, pb, 6, 0xe8d8c0, 0.22, 2, 5);
      mottle(ctx, r, pb, 4, 0x6a3018, 0.22, 2, 4);
      ctx.strokeStyle = 'rgba(236,222,190,0.7)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(-12.8, 14); ctx.lineTo(12.8, 14);
      ctx.stroke();
      for (let x = -10; x <= 10; x += 4) {
        ctx.fillStyle = 'rgba(236,222,190,0.7)';
        ctx.beginPath();
        poly(ctx, [x, 15.6, x + 1.4, 17.4, x, 19.2, x - 1.4, 17.4]);
        ctx.fill();
      }
      speckle(ctx, r, pb, 40, ['rgba(60,20,8,0.3)', 'rgba(255,220,190,0.15)'], 0.12, 0.35);
      grimeBottom(ctx, pb, 0.3);
    },
  });
  // soil + rim
  lit(ctx, () => ell(ctx, 0, 4.8, 13.4, 1.6), [-13.4, 3.2, 26.8, 3.2], rgb(0x2a1a10), { lw: 0.8, bevel: 0, form: 0 });
  lit(ctx, () => rr(ctx, -15.4, 4.6, 30.8, 5.4, 1.6), [-15.4, 4.6, 30.8, 5.4], cylH(ctx, -15.4, 15.4, shade(pot, 0.06), 0.9), {
    inner: () => edgeChips(ctx, r, [-15.4, 4.6, 30.8, 5.4], 6, 'rgba(70,30,15,0.6)', 0.8),
  });
  // flower + bud
  const flower = (x: number, y: number, s: number) => {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5;
      lit(ctx, () => ell(ctx, x + Math.cos(a) * 1.7 * s, y + Math.sin(a) * 1.3 * s, 1.5 * s, 1 * s, a), [x - 3 * s, y - 3 * s, 6 * s, 6 * s], rgb(0xe8508a), { lw: 0.6, bevel: 0.3, form: 0 });
    }
    ctx.fillStyle = rgb(0xf6d24a);
    ctx.beginPath();
    ctx.arc(x, y, 0.95 * s, 0, TAU);
    ctx.fill();
  };
  flower(2.6, -29, 1.15);
  lit(ctx, () => ell(ctx, -14.4, -19.6, 1.5, 2), [-16, -21.6, 3, 4], rgb(0xd8507e), { lw: 0.7, form: 0 });
};

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------

function cheapRivet(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(10,8,8,0.45)';
  ctx.fillRect(x - r + 0.35, y - r + 0.45, r * 2, r * 2);
  ctx.fillStyle = '#7a8286';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(240,244,246,0.7)';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.4, 0, TAU);
  ctx.fill();
}

const paintWall: Painter = (ctx, p, r) => {
  const w = clamp(num(p, 'w', 200), 4, 4000);
  const h = clamp(num(p, 'h', 40), 4, 4000);
  const mat = str(p, 'material', 'concrete');
  const x0 = -w / 2, y0 = -h / 2;
  const box: Box = [x0, y0, w, h];
  const area = w * h;
  const path = () => rr(ctx, x0, y0, w, h, 1.2);
  const form = clamp(40 / Math.min(w, h), 0.35, 1);
  if (mat === 'brick') {
    lit(ctx, path, box, rgb(0x857a6c), {
      form,
      bevel: 1.2,
      inner: () => {
        const bw = 22, bh = 8.6, gap = 1.4;
        const pal = [0x9a4a32, 0x8a412c, 0xa5553a, 0x7e3d2a, 0x9c5a40, 0x8f4a36];
        let row = 0;
        for (let y = y0 + 0.6; y < y0 + h; y += bh + gap, row++) {
          const off = row % 2 === 0 ? 0 : -(bw + gap) / 2;
          for (let x = x0 + off; x < x0 + w; x += bw + gap) {
            const c = mix(r.pick(pal), 0x5a2a1a, r.range(0, 0.25));
            ctx.fillStyle = rgb(c);
            ctx.fillRect(x, y, bw, bh);
            ctx.fillStyle = 'rgba(255,214,170,0.22)';
            ctx.fillRect(x, y, bw, 0.9);
            ctx.fillStyle = 'rgba(30,10,4,0.35)';
            ctx.fillRect(x, y + bh - 1, bw, 1);
            ctx.fillRect(x + bw - 0.8, y, 0.8, bh);
            if (r.chance(0.35)) {
              ctx.fillStyle = r.chance(0.5) ? 'rgba(30,10,4,0.25)' : 'rgba(230,190,150,0.15)';
              ctx.fillRect(x + r.range(1, bw - 6), y + r.range(1, bh - 3), r.range(2, 6), r.range(1, 2.5));
            }
            if (r.chance(0.1)) {
              ctx.fillStyle = 'rgba(133,122,108,0.9)';
              ctx.beginPath();
              const cx = r.chance(0.5) ? x : x + bw;
              const cy = r.chance(0.5) ? y : y + bh;
              ctx.arc(cx, cy, r.range(1, 2.4), 0, TAU);
              ctx.fill();
            }
          }
        }
        speckle(ctx, r, box, Math.min(6000, Math.round(area / 10)), ['rgba(20,10,6,0.25)', 'rgba(255,230,200,0.1)'], 0.15, 0.45);
        mottle(ctx, r, box, Math.min(300, Math.round(area / 900)), 0x2a1a10, 0.25, 6, 22);
        grimeBottom(ctx, box, 0.3);
      },
    });
  } else if (mat === 'wood') {
    const vertical = h > w * 1.4;
    lit(ctx, path, box, rgb(0x2a1a10), {
      form,
      bevel: 1.2,
      inner: () => {
        const bwid = 11;
        const across = vertical ? w : h;
        const n = Math.max(1, Math.round(across / bwid));
        const bs = across / n;
        for (let i = 0; i < n; i++) {
          const base = mix(PAL.pine, PAL.oak, r.range(0.1, 0.55));
          if (vertical) {
            const x = x0 + i * bs;
            woodGrain(ctx, r, x + 0.4, y0, bs - 0.8, h, { base, dir: 'v', knots: Math.round(h / 140 + r.range(-0.4, 0.6)) });
            ctx.fillStyle = 'rgba(255,220,170,0.15)';
            ctx.fillRect(x + 0.4, y0, 0.8, h);
          } else {
            const y = y0 + i * bs;
            woodGrain(ctx, r, x0, y + 0.4, w, bs - 0.8, { base, knots: Math.round(w / 140 + r.range(-0.4, 0.6)) });
            ctx.fillStyle = 'rgba(255,220,170,0.15)';
            ctx.fillRect(x0, y + 0.4, w, 0.8);
          }
        }
        // butt joints + nails along cross battens
        const len = vertical ? h : w;
        for (let s = 40; s < len - 10; s += 80) {
          for (let i = 0; i < n; i++) {
            const c = i * bs + bs / 2;
            const [nx, ny] = vertical ? [x0 + c, y0 + s] : [x0 + s, y0 + c];
            cheapRivet(ctx, nx + (vertical ? -2 : 0), ny + (vertical ? 0 : -2), 0.75);
            cheapRivet(ctx, nx + (vertical ? 2 : 0), ny + (vertical ? 0 : 2), 0.75);
          }
        }
        scratches(ctx, r, box, Math.min(400, Math.round(area / 120)), true, 0.25);
        mottle(ctx, r, box, Math.min(200, Math.round(area / 1200)), 0x1a0e06, 0.14, 6, 18);
        grimeBottom(ctx, box, 0.3);
      },
    });
  } else if (mat === 'steel') {
    const paint = 0x4c5c66;
    lit(ctx, path, box, rgb(paint), {
      form,
      bevel: 1.2,
      inner: () => {
        const nx = Math.max(1, Math.round(w / 64));
        const ny = Math.max(1, Math.round(h / 48));
        const pw = w / nx, ph = h / ny;
        for (let i = 0; i < nx; i++) {
          for (let j = 0; j < ny; j++) {
            const px = x0 + i * pw, py = y0 + j * ph;
            const c = shade(paint, r.range(-0.08, 0.08));
            ctx.fillStyle = lin(ctx, px, py, px + pw * 0.4, py + ph, [
              [0, rgb(shade(c, 0.12))], [0.5, rgb(c)], [1, rgb(shade(c, -0.12))],
            ]);
            ctx.fillRect(px, py, pw, ph);
          }
        }
        mottle(ctx, r, box, Math.min(260, Math.round(area / 700)), 0x2a3238, 0.25, 4, 16);
        mottle(ctx, r, box, Math.min(120, Math.round(area / 2000)), 0x8a4a22, 0.18, 3, 10);
        for (let i = 1; i < nx; i++) seam(ctx, x0 + i * pw, y0, x0 + i * pw, y0 + h, 0.8);
        for (let j = 1; j < ny; j++) seam(ctx, x0, y0 + j * ph, x0 + w, y0 + j * ph, 0.8);
        const step = 7;
        const rows: number[] = [];
        for (let j = 0; j <= ny; j++) rows.push(clamp(y0 + j * ph, y0 + 2.6, y0 + h - 2.6));
        for (const y of rows) for (let x = x0 + 4; x < x0 + w - 2; x += step) cheapRivet(ctx, x, y + (y < 0 ? 0 : 0), 0.8);
        for (let i = 0; i <= nx; i++) {
          const x = clamp(x0 + i * pw, x0 + 2.6, x0 + w - 2.6);
          for (let y = y0 + 4 + step; y < y0 + h - 4; y += step) cheapRivet(ctx, x, y, 0.8);
        }
        // rust streaks
        for (let k = 0; k < Math.min(60, Math.round(area / 3000) + 2); k++) {
          const x = r.range(x0, x0 + w), y = r.range(y0, y0 + h * 0.8);
          const l = r.range(6, 24);
          ctx.fillStyle = lin(ctx, 0, y, 0, y + l, [[0, 'rgba(150,70,25,0.4)'], [1, 'rgba(150,70,25,0)']]);
          ctx.fillRect(x, y, r.range(0.8, 2), l);
        }
        edgeChips(ctx, r, box, Math.min(500, Math.round((w + h) / 4)), 'rgba(170,176,178,0.7)', 1.1);
        scratches(ctx, r, box, Math.min(500, Math.round(area / 100)), true, 0.3);
        grimeBottom(ctx, box, 0.35);
      },
    });
  } else {
    // concrete
    lit(ctx, path, box, rgb(0x77716a), {
      form,
      bevel: 1.2,
      inner: () => {
        mottle(ctx, r, box, Math.min(400, Math.round(area / 400) + 3), 0x5a554e, 0.35, 4, 18);
        mottle(ctx, r, box, Math.min(300, Math.round(area / 600) + 2), 0x9a948a, 0.25, 4, 16);
        speckle(ctx, r, box, Math.min(7000, Math.round(area / 6)), ['rgba(30,26,22,0.3)', 'rgba(230,225,215,0.18)', 'rgba(60,56,50,0.3)'], 0.12, 0.45);
        // formwork board marks
        for (let y = y0 + 30; y < y0 + h - 4; y += 30) {
          ctx.fillStyle = 'rgba(30,26,22,0.18)';
          ctx.fillRect(x0, y, w, 0.6);
          ctx.fillStyle = 'rgba(230,225,215,0.1)';
          ctx.fillRect(x0, y + 0.6, w, 0.5);
        }
        // tie holes
        if (w >= 40 && h >= 40) {
          for (let y = y0 + 15; y < y0 + h - 8; y += 30) {
            for (let x = x0 + 20 + ((Math.round((y - y0) / 30) % 2) * 30); x < x0 + w - 8; x += 60) {
              ctx.fillStyle = 'rgba(230,225,215,0.25)';
              ctx.beginPath();
              ctx.arc(x + 0.35, y + 0.4, 1.9, 0, TAU);
              ctx.fill();
              ctx.fillStyle = 'rgba(25,22,20,0.8)';
              ctx.beginPath();
              ctx.arc(x, y, 1.6, 0, TAU);
              ctx.fill();
            }
          }
        }
        // drip stains from the top edge
        for (let k = 0; k < Math.min(80, Math.round(w / 25)); k++) {
          const x = r.range(x0, x0 + w);
          const l = Math.min(h, r.range(10, 60));
          ctx.fillStyle = lin(ctx, 0, y0, 0, y0 + l, [[0, 'rgba(40,34,26,0.3)'], [1, 'rgba(40,34,26,0)']]);
          ctx.fillRect(x, y0, r.range(1.5, 6), l);
        }
        // hairline cracks
        ctx.strokeStyle = 'rgba(25,20,16,0.55)';
        ctx.lineWidth = 0.4;
        for (let k = 0; k < Math.min(40, Math.round(area / 9000)); k++) {
          let x = r.range(x0, x0 + w), y = r.range(y0, y0 + h);
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let s = 0; s < 6; s++) {
            x += r.range(-5, 5);
            y += r.range(1, 6);
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        edgeChips(ctx, r, box, Math.min(500, Math.round((w + h) / 3)), 'rgba(170,164,154,0.7)', 1.3);
        grimeBottom(ctx, box, 0.3);
      },
    });
  }
};

// ---------------------------------------------------------------------------
// Parts-bin tool icons
// ---------------------------------------------------------------------------

const paintToolRope: Painter = (ctx, _p, r) => {
  const hemp = 0xc6a066;
  const loop = (cx: number, cy: number, rx: number, ry: number) => {
    const path = () => ctx.ellipse(cx, cy, rx, ry, -0.12, 0, TAU);
    tube(ctx, path, 3.6, hemp, { lw: 0.9, hi: 0.35 });
    // twist marks
    ctx.save();
    ctx.strokeStyle = 'rgba(80,50,20,0.7)';
    ctx.lineWidth = 0.45;
    const n = Math.round((rx + ry) * 1.2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const x = cx + Math.cos(a) * rx * Math.cos(-0.12) - Math.sin(a) * ry * Math.sin(-0.12);
      const y = cy + Math.cos(a) * rx * Math.sin(-0.12) + Math.sin(a) * ry * Math.cos(-0.12);
      ctx.beginPath();
      ctx.moveTo(x - 1.1, y - 1.3);
      ctx.lineTo(x + 0.9, y + 1.3);
      ctx.stroke();
    }
    ctx.restore();
  };
  dropShadow(ctx, 0, 22, 24, 5, 0.3);
  for (let i = 0; i < 5; i++) loop(-1 + i * 0.8, 1 - i * 0.9, 21 - i * 1.6, 15 - i * 0.9);
  // binding wrap
  for (let k = 0; k < 3; k++) {
    tube(ctx, () => { ctx.moveTo(-6 + k * 2.2, -17.5); ctx.lineTo(-3 + k * 2.2, -10.5); }, 2.2, shade(hemp, -0.05), { lw: 0.8 });
  }
  // loose end with red whipping
  const tail = () => smoothPath(ctx, [16, 10, 21, 16, 26, 20, 28, 26]);
  tube(ctx, tail, 3.4, hemp, { lw: 0.9, hi: 0.35 });
  lit(ctx, () => { ctx.save(); ctx.translate(26.6, 22.5); ctx.rotate(1.0); rr(ctx, -2.2, -2.2, 4.4, 4.4, 1); ctx.restore(); }, [24, 20, 5, 5], rgb(0xc0392b), { lw: 0.8 });
  ctx.strokeStyle = 'rgba(220,190,130,0.9)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  for (const a of [0.6, 1.1, 1.6]) { ctx.moveTo(28.4, 26.4); ctx.lineTo(28.4 + Math.cos(a) * 3, 26.4 + Math.sin(a) * 3); }
  ctx.stroke();
  void r;
};

const paintToolBelt: Painter = (ctx, _p, r) => {
  const c1 = { x: -11, y: 6, r: 14 }, c2 = { x: 17, y: -12, r: 7 };
  dropShadow(ctx, 2, 24, 26, 5, 0.3);
  wheelDisc(ctx, r, c1.x, c1.y, c1.r, 5, 0x8a9296);
  wheelDisc(ctx, r, c2.x, c2.y, c2.r, 4, 0xc39545);
  const br1 = c1.r + 1.2, br2 = c2.r + 1.2;
  const dx = c2.x - c1.x, dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);
  const th = Math.atan2(dy, dx);
  const b = Math.acos((br1 - br2) / d);
  const belt = () => {
    ctx.arc(c1.x, c1.y, br1, th + b, th + TAU - b);
    ctx.arc(c2.x, c2.y, br2, th - b, th + b);
    ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath(); belt();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 4.4;
  ctx.stroke();
  ctx.strokeStyle = rgb(0x2c2a2a);
  ctx.lineWidth = 2.8;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,220,0.22)';
  ctx.lineWidth = 0.6;
  ctx.setLineDash([2, 1.5]);
  ctx.stroke();
  ctx.restore();
};

const paintToolWire: Painter = (ctx) => {
  const red = 0xc0392b;
  dropShadow(ctx, 0, 21, 22, 5, 0.3);
  for (let i = 0; i < 6; i++) {
    tube(ctx, () => ctx.ellipse(-2 + i * 0.9, 2 - i * 0.7, 16 - i * 0.8, 12 - i * 0.3, -0.25, 0, TAU), 2.2, i % 2 ? shade(red, -0.08) : red, { lw: 0.8, hi: 0.5 });
  }
  // leads
  tube(ctx, () => smoothPath(ctx, [-14, -6, -19, -14, -20, -22]), 2.2, red, { lw: 0.8 });
  tube(ctx, () => smoothPath(ctx, [13, 8, 19, 14, 22, 21]), 2.2, 0x2c2a2a, { lw: 0.8 });
  // plugs
  const plug = (x: number, y: number, ang: number, col: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    lit(ctx, () => rr(ctx, -2.6, -6, 5.2, 8, 1.6), [-2.6, -6, 5.2, 8], cylH(ctx, -2.6, 2.6, col), { lw: 1 });
    for (const yy of [-4, -2.4, -0.8]) seam(ctx, -2.6, yy, 2.6, yy, 0.5);
    lit(ctx, () => rr(ctx, -0.9, -11, 1.8, 5.4, 0.8), [-0.9, -11, 1.8, 5.4], cylH(ctx, -0.9, 0.9, 0xd2b060), { lw: 0.7 });
    ctx.restore();
  };
  plug(-20, -22, -0.1, red);
  plug(22.4, 22, Math.PI + 0.3, 0x2c2a2a);
};

/** Small painted flame used only by icons (the game animates real flames). */
const paintIconFlame: Painter = (ctx) => {
  ctx.fillStyle = rad(ctx, 0, 0, 0, 0, 0, 9, [[0, 'rgba(255,200,90,0.5)'], [1, 'rgba(255,160,60,0)']]);
  ctx.fillRect(-9, -9, 18, 18);
  ctx.beginPath();
  ctx.moveTo(0, -7.5);
  ctx.bezierCurveTo(3.4, -2.5, 3.6, 2.4, 0, 4.2);
  ctx.bezierCurveTo(-3.6, 2.4, -3.4, -2.5, 0, -7.5);
  ctx.fillStyle = lin(ctx, 0, -7.5, 0, 4.2, [[0, '#ffefb0'], [0.5, '#ffb648'], [1, '#e8642a']]);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -2.5);
  ctx.bezierCurveTo(1.5, 0, 1.5, 2, 0, 3);
  ctx.bezierCurveTo(-1.5, 2, -1.5, 0, 0, -2.5);
  ctx.fillStyle = '#fff8e0';
  ctx.fill();
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const DEFS: Record<string, PartDef> = {
  ball: { size: () => centred(32, 32), paint: paintBall },
  shine_xs: { size: () => centred(28, 28), paint: shinePainter(12) },
  shine_s: { size: () => centred(32, 32), paint: shinePainter(14) },
  shine_m: { size: () => centred(48, 48), paint: shinePainter(20) },
  bowling_ball: { size: () => centred(44, 44), paint: paintBowling },
  cannonball: { size: () => centred(28, 28), paint: paintCannonball },
  crate_wood: { size: () => centred(48, 48), paint: paintCrateWood },
  crate_steel: { size: () => centred(48, 48), paint: paintCrateSteel },
  domino: { size: () => centred(14, 60), paint: paintDomino },
  plank: { size: (p) => centred(clamp(num(p, 'length', 160), 10, 4000) + 4, 18), paint: paintPlank },
  seesaw_plank: { size: (p) => { const w = clamp(num(p, 'length', 220), 20, 4000) + 4; return [w, 28, w / 2, 19]; }, paint: paintSeesawPlank },
  fulcrum: { size: () => [52, 40, 26, 2], paint: paintFulcrum },
  trampoline_frame: { size: () => centred(100, 34), paint: paintTrampFrame },
  trampoline_mat: { size: () => centred(92, 8), paint: paintTrampMat },
  bucket: { size: () => [74, 74, 37, 50], paint: paintBucket },
  hook: { size: () => [26, 32, 13, 12], paint: paintHook },
  pulley_mount: { size: () => [36, 46, 18, 18], paint: paintPulleyMount },
  pulley_wheel: { size: () => centred(40, 40), paint: paintPulleyWheel },
  gear_small: { size: () => centred(60, 60), paint: gearPainter(22, 'brass', 'holes') },
  gear_medium: { size: () => centred(84, 84), paint: gearPainter(34, 'steel', 'holes') },
  gear_large: { size: () => centred(120, 120), paint: gearPainter(52, 'brass', 'spokes') },
  motor_body: { size: () => [64, 52, 32, 24], paint: paintMotorBody },
  motor_pinion: { size: () => centred(32, 32), paint: paintPinion },
  conveyor: { size: (p) => centred(clamp(num(p, 'length', 220), 40, 4000) + 4, 30), paint: paintConveyor },
  roller: { size: () => centred(24, 24), paint: paintRoller },
  fan_body: { size: () => [60, 78, 30, 40], paint: paintFanBody },
  fan_blades_0: { size: () => centred(26, 52), paint: fanBladesPainter(0.2) },
  fan_blades_1: { size: () => centred(26, 52), paint: fanBladesPainter(0.2 + TAU / 9) },
  fan_blades_2: { size: () => centred(26, 52), paint: fanBladesPainter(0.2 + (2 * TAU) / 9) },
  balloon_red: { size: () => [48, 60, 24, 26], paint: balloonPainter(0xc8352e) },
  balloon_yellow: { size: () => [48, 60, 24, 26], paint: balloonPainter(0xdfa92c) },
  balloon_teal: { size: () => [48, 60, 24, 26], paint: balloonPainter(0x24918e) },
  magnet: { size: () => centred(64, 52), paint: paintMagnet },
  // Taller than the spec's 56 so the dish (y 22..29) is not clipped.
  candle: { size: () => [26, 60, 13, 30], paint: paintCandle },
  dynamite: { size: () => centred(40, 30), paint: paintDynamite },
  rocket: { size: () => centred(64, 26), paint: paintRocket },
  cannon_carriage: { size: () => [80, 42, 40, 20], paint: paintCannonCarriage },
  cannon_barrel: { size: () => [64, 26, 22, 13], paint: paintCannonBarrel },
  glove_box: { size: () => [58, 40, 31, 20], paint: paintGloveBox },
  glove_spring: { size: () => [40, 16, 0, 8], paint: paintGloveSpring },
  glove: { size: () => [36, 32, 6, 16], paint: paintGlove },
  // Taller than the spec's 60 so the + terminal reaches y = -30.
  battery: { size: () => [40, 64, 20, 32], paint: paintBattery },
  switch_plate: { size: () => [48, 58, 24, 32], paint: paintSwitchPlate },
  switch_lever: { size: () => [12, 34, 6, 30], paint: paintSwitchLever },
  plate_base: { size: () => [80, 16, 40, 8], paint: paintPlateBase },
  plate_top: { size: () => centred(60, 6), paint: paintPlateTop },
  timer: { size: () => [56, 50, 28, 24], paint: paintTimer },
  timer_hand: { size: () => [4, 18, 2, 16], paint: paintTimerHand },
  logic_box: { size: () => [56, 48, 28, 23], paint: paintLogicBox },
  bulb_off: { size: () => [40, 62, 20, 32], paint: bulbPainter(false) },
  bulb_on: { size: () => [40, 62, 20, 32], paint: bulbPainter(true) },
  // Taller than the spec's 48 so the antenna reaches its port at y = -30.
  robot_body: { size: () => [40, 52, 20, 30], paint: paintRobotBody },
  robot_leg: { size: () => [8, 16, 4, 2], paint: paintRobotLeg },
  robot_eye: { size: () => centred(14, 14), paint: paintRobotEye },
  cactus: { size: () => [38, 62, 19, 32], paint: paintCactus },
  wall: {
    size: (p) => centred(clamp(num(p, 'w', 200), 4, 4000) + 4, clamp(num(p, 'h', 40), 4, 4000) + 4),
    paint: paintWall,
  },
  tool_rope: { size: () => centred(64, 64), paint: paintToolRope },
  tool_belt: { size: () => centred(64, 64), paint: paintToolBelt },
  tool_wire: { size: () => centred(64, 64), paint: paintToolWire },
};

/** Internal-only painters (icons). */
const EXTRA: Record<string, PartDef> = {
  _flame: { size: () => centred(18, 18), paint: paintIconFlame },
};

export const PART_KEYS: string[] = Object.keys(DEFS);

function seedFor(key: string, params: Params): number {
  const pk = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return hashStr(`${key}?${pk}`);
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

function placeholder(scale: number): PaintedTexture {
  const s = Math.max(2, Math.ceil(32 * scale));
  const canvas = makeCanvas(s, s);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#1d1612';
    const q = s / 4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * q, j * q, q, q);
  }
  return { canvas, ox: s / 2, oy: s / 2 };
}

/** Paint one texture at `scale` px per unit. Unknown keys return a visible magenta placeholder (never throw). Deterministic. */
export function paintPart(key: string, params: Record<string, string | number | boolean>, scale: number): PaintedTexture {
  const def = DEFS[key] ?? EXTRA[key];
  const sc = Number.isFinite(scale) && scale > 0 ? scale : 2;
  if (!def) return placeholder(sc);
  try {
    const p = params ?? {};
    const [w, h, ox, oy] = def.size(p);
    const canvas = makeCanvas(Math.ceil(w * sc), Math.ceil(h * sc));
    const ctx = canvas.getContext('2d');
    if (!ctx) return { canvas, ox: ox * sc, oy: oy * sc };
    ctx.save();
    ctx.scale(sc, sc);
    ctx.translate(ox, oy);
    def.paint(ctx, p, new Rand(seedFor(key, p)));
    ctx.restore();
    return { canvas, ox: ox * sc, oy: oy * sc };
  } catch {
    return placeholder(sc);
  }
}

// ---------------------------------------------------------------------------
// Parts-bin icons
// ---------------------------------------------------------------------------

interface Layer {
  key: string;
  params?: Params;
  x?: number;
  y?: number;
  rot?: number;
  sx?: number;
}

function iconLayers(type: string, props: Params): Layer[] {
  const b = (k: string, d: boolean) => (typeof props[k] === 'boolean' ? (props[k] as boolean) : d);
  switch (type) {
    case 'ball': return [{ key: 'ball', rot: 0.4 }, { key: 'shine_s' }];
    case 'bowling_ball': return [{ key: 'bowling_ball' }, { key: 'shine_m' }];
    case 'cannonball': return [{ key: 'cannonball' }, { key: 'shine_xs' }];
    case 'crate': return [{ key: str(props, 'material', 'wood') === 'steel' ? 'crate_steel' : 'crate_wood' }];
    case 'domino': return [{ key: 'domino', rot: 0.18 }];
    case 'plank': return [{ key: 'plank', params: { length: 130 }, rot: -0.5 }];
    case 'seesaw': return [{ key: 'fulcrum' }, { key: 'seesaw_plank', params: { length: 150 }, rot: -0.14 }];
    case 'trampoline': return [{ key: 'trampoline_frame', rot: -0.12 }, { key: 'trampoline_mat', y: -6, rot: -0.12 }];
    case 'bucket': return [{ key: 'bucket' }];
    case 'hook': return [{ key: 'hook' }];
    case 'pulley': return [{ key: 'pulley_wheel' }, { key: 'pulley_mount' }];
    case 'gear': {
      const s = str(props, 'size', 'medium');
      return [{ key: s === 'small' ? 'gear_small' : s === 'large' ? 'gear_large' : 'gear_medium' }];
    }
    case 'motor': return [{ key: 'motor_body' }, { key: 'motor_pinion', y: -2 }];
    case 'conveyor': return [{ key: 'conveyor', params: { length: 110 } }, { key: 'roller', x: -55 + 12 }];
    case 'fan': return [{ key: 'fan_body' }, { key: 'fan_blades_0', x: 6, y: -6 }];
    case 'balloon': {
      const c = str(props, 'color', 'red');
      return [{ key: c === 'yellow' ? 'balloon_yellow' : c === 'teal' ? 'balloon_teal' : 'balloon_red' }];
    }
    case 'magnet': return [{ key: 'magnet' }];
    case 'candle': return b('lit', true) ? [{ key: 'candle' }, { key: '_flame', y: -25 }] : [{ key: 'candle' }];
    case 'dynamite': return [{ key: 'dynamite' }];
    case 'rocket': return [{ key: 'rocket', rot: -0.5 }];
    case 'cannon': return [{ key: 'cannon_barrel', y: -2, rot: -0.35 }, { key: 'cannon_carriage' }];
    case 'boxing_glove': return [{ key: 'glove_spring', x: 19, sx: 0.35 }, { key: 'glove', x: 32 }, { key: 'glove_box' }];
    case 'battery': return [{ key: 'battery' }];
    case 'toggle_switch': return [{ key: 'switch_plate' }, { key: 'switch_lever', y: -12, rot: (b('on', false) ? 28 : -28) * (Math.PI / 180) }];
    case 'pressure_plate': return [{ key: 'plate_base' }, { key: 'plate_top', y: -6 }];
    case 'timer': return [{ key: 'timer' }, { key: 'timer_hand', rot: 0.9 }];
    case 'logic_gate': return [{ key: 'logic_box', params: { mode: str(props, 'mode', 'and') } }];
    case 'light_bulb': return [{ key: 'bulb_on' }];
    case 'robot': return [
      { key: 'robot_leg', x: -6, y: 10, rot: 0.25 },
      { key: 'robot_leg', x: 6, y: 10, rot: -0.2 },
      { key: 'robot_body' },
      { key: 'robot_eye', x: ROBOT_EYE.x, y: ROBOT_EYE.y },
    ];
    case 'cactus': return [{ key: 'cactus' }];
    case 'wall': return [{ key: 'wall', params: { w: 100, h: 60, material: str(props, 'material', 'concrete') } }];
    case 'rope': return [{ key: 'tool_rope' }];
    case 'belt': return [{ key: 'tool_belt' }];
    case 'wire': return [{ key: 'tool_wire' }];
    default: return DEFS[type] ? [{ key: type, params: props }] : [];
  }
}

/** A parts-bin icon for a component type (or 'rope'/'belt'/'wire'), fitted into size×size pixels on transparent background, composed from the same painters. */
export function paintIcon(type: string, props: Record<string, string | number | boolean>, size: number): HTMLCanvasElement {
  const S = Math.max(4, Math.round(Number.isFinite(size) ? size : 64));
  const out = makeCanvas(S, S);
  const octx = out.getContext('2d');
  if (!octx) return out;
  try {
    const layers = iconLayers(type, props ?? {});
    if (layers.length === 0) {
      const ph = placeholder(S / 32);
      octx.drawImage(ph.canvas, 0, 0, S, S);
      return out;
    }
    // bounds of every layer in the shared local frame
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const l of layers) {
      const def = DEFS[l.key] ?? EXTRA[l.key];
      if (!def) continue;
      const [w, h, ox, oy] = def.size(l.params ?? {});
      const c = Math.cos(l.rot ?? 0), s = Math.sin(l.rot ?? 0);
      const sx = l.sx ?? 1;
      for (const [px, py] of [[-ox, -oy], [w - ox, -oy], [w - ox, h - oy], [-ox, h - oy]]) {
        const qx = px * sx;
        const x = (l.x ?? 0) + qx * c - py * s;
        const y = (l.y ?? 0) + qx * s + py * c;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    const pad = S * 0.08;
    const k = (S - pad * 2) / Math.max(maxX - minX, maxY - minY, 1);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const tmp = makeCanvas(S, S);
    const ctx = tmp.getContext('2d');
    if (!ctx) return out;
    for (const l of layers) {
      const def = DEFS[l.key] ?? EXTRA[l.key];
      if (!def) continue;
      const p = l.params ?? {};
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.scale(k, k);
      ctx.translate(-cx + (l.x ?? 0), -cy + (l.y ?? 0));
      ctx.rotate(l.rot ?? 0);
      ctx.scale(l.sx ?? 1, 1);
      def.paint(ctx, p, new Rand(seedFor(l.key, p)));
      ctx.restore();
    }
    octx.save();
    octx.shadowColor = 'rgba(8,4,2,0.5)';
    octx.shadowBlur = S * 0.04;
    octx.shadowOffsetX = S * 0.012;
    octx.shadowOffsetY = S * 0.025;
    octx.drawImage(tmp, 0, 0);
    octx.restore();
  } catch {
    const ph = placeholder(S / 32);
    octx.clearRect(0, 0, S, S);
    octx.drawImage(ph.canvas, 0, 0, S, S);
  }
  return out;
}

// Keep helpers referenced for tree-shaking clarity.
void LW_IN;
void formShade;
void clipped;
