/**
 * Procedural, hand-painted-looking background art for the six workshop
 * environments. Each environment is a cutaway "diorama": a room sunk into the
 * ground, shown in cross-section with soil, roots, pipes and cables around it,
 * a slab ceiling cut away at the top and a slightly receding floor plane.
 *
 * Readability rule: the middle of the room stays calm and mid-dark; detail
 * lives at the edges, the top, low on the back wall and in the soil.
 */

import {
  Ctx,
  Rand,
  SoilPalette,
  bevel,
  blob,
  bricks,
  cable,
  cableBundle,
  concreteCut,
  contactShadow,
  crack,
  crateBox,
  css,
  ctx2d,
  flange,
  gauge,
  hGrad,
  hangingBulb,
  hangingCable,
  hashString,
  hazard,
  jitter,
  leafCluster,
  led,
  lightCone,
  makeCanvas,
  metalPanel,
  mix,
  monitor,
  pipe,
  poly,
  pottedPlant,
  rivet,
  rock,
  roots,
  rrPath,
  shade,
  shelf,
  silhouette,
  soil,
  stain,
  stencil,
  streaks,
  texture,
  tiles,
  tubeLamp,
  turf,
  vGrad,
  valveWheel,
  ventGrille,
} from './envHelpers';
import { DAYLIGHT, type Daylight, bigPlant, bunting, doodle, flowerPot, freshPaint, skyPane, sunbeam, sunnyWindow } from './envCheer';
import { HAPPY_ENVS } from './envHappy';
import { THEMED_ENVS } from './envThemes';

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface EnvironmentInfo {
  id: string;
  name: string;
  blurb: string;
  /** dominant accent colour as 0xRRGGBB for UI tinting */
  accent: number;
}

export const ENVIRONMENTS: EnvironmentInfo[] = [
  { id: 'garage', name: 'Improvised Garage', blurb: 'Pegboard, oil stains and a roller door that sticks halfway. Warm bulbs, cold coffee.', accent: 0xf0a04b },
  { id: 'underground', name: 'Underground Workshop', blurb: 'Dug deep under the yard. Orange tube light, dripping roots and fungus that glows when nobody is looking.', accent: 0x7cf0a0 },
  { id: 'greenhouse', name: 'Greenhouse Laboratory', blurb: 'Sunken glasshouse on a summer afternoon. Grow lights hum over the seedlings and the air is thick enough to drink.', accent: 0xe07ad0 },
  { id: 'maintenance', name: 'Maintenance Room', blurb: 'Painted steel, big pipes and a breaker panel that blinks in a rhythm only the building understands.', accent: 0xf2c043 },
  { id: 'basement', name: 'Strange Domestic Basement', blurb: 'Sunny wallpaper, a washing machine with opinions, string lights and one small window full of lawn.', accent: 0x9ab8ff },
  { id: 'backyard', name: 'Sunny Backyard Workshop', blurb: 'A potting bench, a red shed, sunflowers along the fence and bunting strung from the tree.', accent: 0x7cc45e },
  { id: 'playroom', name: 'Birthday Playroom', blurb: 'Balloons, a HAPPY DAY banner, a cake on the table and a box of toys nobody has put away.', accent: 0xf2a6d8 },
  { id: 'research', name: 'Abandoned Research Facility', blurb: 'Tiled walls, cyan monitors still running, violet sparks in the junction box and a hatch that stays shut.', accent: 0x4fdcf5 },
];

export const ENV_MARGIN = { left: 220, right: 220, top: 200, bottom: 260 };

export interface AmbientEmitter {
  kind: 'blink' | 'drip' | 'steam' | 'fan' | 'sway' | 'monitor' | 'dust' | 'flicker' | 'spark';
  x: number;
  y: number;
  color?: number;
  size?: number;
  period?: number;
  w?: number;
  h?: number;
  layer: 'far' | 'near';
}

export interface EnvironmentLayers {
  far: HTMLCanvasElement;
  light: HTMLCanvasElement;
  near: HTMLCanvasElement;
  ambient: AmbientEmitter[];
  floor: { top: number; face: number };
}

// ---------------------------------------------------------------------------
// Internal model
// ---------------------------------------------------------------------------

/** Room geometry in world units. */
export interface Geo {
  w: number;
  h: number;
  /** front cut of the ceiling slab (underside) */
  ceilY: number;
  slabTop: number;
  surfaceY: number;
  wallT: number;
  floorSlab: number;
  /** back wall rectangle (perspective inset) */
  bx0: number;
  bx1: number;
  by0: number;
  by1: number;
}

export interface Theme {
  soil: SoilPalette;
  grass: number;
  sky: [number, number];
  concrete: number;
  side: number;
  ceiling: number;
  /** colour used to calm the centre of the room */
  veil: number;
  veilAlpha: number;
  /** key light tint (top of room) and cool shadow tint (low corners) */
  key: number;
  shadow: number;
  floor: { top: number; face: number };
}

export interface Painter {
  far: Ctx;
  light: Ctx;
  near: Ctx;
  rng: Rand;
  G: Geo;
  T: Theme;
  amb: AmbientEmitter[];
}

export interface EnvDef {
  theme: Theme;
  /** Replaces the default exterior (sky, soil cutaway and concrete shell). */
  exterior?(P: Painter): void;
  /** Flat art (retro): skip the painterly grain and soften the cinematic grade. */
  flat?: boolean;
  /**
   * A flat 2D stage instead of a cutaway room (arcade): `backWall` paints the whole room rect and
   * there are no perspective side walls, ceiling, floor plane, seams or soft occlusion.
   */
  stage?: boolean;
  /** Clipped to the back wall rectangle. */
  backWall(P: Painter): void;
  /** Clipped to the two side-wall trapezoids (after the common shading). */
  sideWalls?(P: Painter): void;
  /** Clipped to the ceiling trapezoid (after the common ceiling). */
  ceiling?(P: Painter): void;
  /** Clipped to the receding floor plane. */
  floor(P: Painter): void;
  /** Furniture / machinery inside the room, drawn before the calm veil. */
  props(P: Painter): void;
  /**
   * Cheerful dressing (sunny windows, bunting, plants, doodles), painted on its own layer and
   * knocked back more gently than props (see envCheer.ts).
   */
  cheer?(P: Painter): void;
  /** Lamps & emissive bits drawn after the veil (stay crisp). */
  lights(P: Painter): void;
  /** Extra detail in the soil cutaway (outside the room). */
  soilExtras(P: Painter): void;
  near(P: Painter): void;
}

function geometry(w: number, h: number): Geo {
  const inset = Math.max(48, Math.min(90, w * 0.04));
  const ceilY = -40;
  const slabTop = ceilY - 46;
  return {
    w,
    h,
    ceilY,
    slabTop,
    surfaceY: slabTop - 64,
    wallT: 42,
    floorSlab: 44,
    bx0: inset,
    bx1: w - inset,
    by0: ceilY + 34,
    by1: h - 56,
  };
}

export const backPath = (G: Geo): Path2D => poly([[G.bx0, G.by0], [G.bx1, G.by0], [G.bx1, G.by1], [G.bx0, G.by1]]);
export const leftPath = (G: Geo): Path2D => poly([[0, G.ceilY], [G.bx0, G.by0], [G.bx0, G.by1], [0, G.h]]);
export const rightPath = (G: Geo): Path2D => poly([[G.w, G.ceilY], [G.bx1, G.by0], [G.bx1, G.by1], [G.w, G.h]]);
export const ceilPath = (G: Geo): Path2D => poly([[0, G.ceilY], [G.w, G.ceilY], [G.bx1, G.by0], [G.bx0, G.by0]]);
export const floorPath = (G: Geo): Path2D => poly([[G.bx0, G.by1], [G.bx1, G.by1], [G.w, G.h], [0, G.h]]);
export const roomPath = (G: Geo): Path2D => poly([[0, G.ceilY], [G.w, G.ceilY], [G.w, G.h], [0, G.h]]);

export function clipped(g: Ctx, path: Path2D, fn: () => void): void {
  g.save();
  g.clip(path);
  fn();
  g.restore();
}

// ---------------------------------------------------------------------------
// Local painters shared by several environments
// ---------------------------------------------------------------------------

/** Painted block / panel courses: subtle joints & per-block tint. */
export function blockCourses(g: Ctx, rng: Rand, x: number, y: number, w: number, h: number, color: number, bw: number, bh: number, contrast = 0.12): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  let row = 0;
  for (let by = y; by < y + h; by += bh) {
    const off = row % 2 ? bw / 2 : 0;
    for (let bx = x - off; bx < x + w; bx += bw) {
      g.fillStyle = css(jitter(rng, color, contrast * 0.35), 0.6);
      g.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
    }
    g.fillStyle = css(shade(color, -0.45), contrast * 2.2);
    g.fillRect(x, by, w, 1.6);
    g.fillStyle = css(shade(color, 0.3), contrast * 1.1);
    g.fillRect(x, by + 1.6, w, 1);
    for (let bx = x - off; bx < x + w; bx += bw) {
      g.fillStyle = css(shade(color, -0.45), contrast * 2.2);
      g.fillRect(bx, by, 1.6, bh);
    }
    row++;
  }
  g.restore();
}

/** Floor plane with perspective lines converging toward the back. */
export function floorPerspective(P: Painter, base: number, opts: { cols: number; rows: number; line: number; lineAlpha: number; checker?: number }): void {
  const { far: g, G } = P;
  g.fillStyle = vGrad(g, G.by1, G.h, [[0, shade(base, -0.35)], [0.5, shade(base, -0.08)], [1, base]]);
  g.fillRect(0, G.by1, G.w, G.h - G.by1);
  const ys: number[] = [];
  for (let k = 0; k <= opts.rows; k++) ys.push(G.by1 + (G.h - G.by1) * Math.pow(k / opts.rows, 1.35));
  const xAt = (i: number, y: number): number => {
    const t = (y - G.by1) / (G.h - G.by1);
    const xb = G.bx0 + (i / opts.cols) * (G.bx1 - G.bx0);
    const xf = (i / opts.cols) * G.w;
    return xb + (xf - xb) * t;
  };
  if (opts.checker !== undefined) {
    for (let k = 0; k < opts.rows; k++) {
      for (let i = 0; i < opts.cols; i++) {
        if ((i + k) % 2) continue;
        g.fillStyle = css(opts.checker, 0.55);
        g.beginPath();
        g.moveTo(xAt(i, ys[k]), ys[k]);
        g.lineTo(xAt(i + 1, ys[k]), ys[k]);
        g.lineTo(xAt(i + 1, ys[k + 1]), ys[k + 1]);
        g.lineTo(xAt(i, ys[k + 1]), ys[k + 1]);
        g.closePath();
        g.fill();
      }
    }
  }
  g.strokeStyle = css(opts.line, opts.lineAlpha);
  g.lineWidth = 1.2;
  g.beginPath();
  for (let i = 0; i <= opts.cols; i++) {
    g.moveTo(xAt(i, G.by1), G.by1);
    g.lineTo(xAt(i, G.h), G.h);
  }
  for (const y of ys) {
    g.moveTo(0, y);
    g.lineTo(G.w, y);
  }
  g.stroke();
  texture(g, 'mottle', 0, G.by1, G.w, G.h - G.by1, { alpha: 0.45, op: 'soft-light', scale: 0.9 });
  texture(g, 'grain', 0, G.by1, G.w, G.h - G.by1, { alpha: 0.2, op: 'overlay' });
}

/** Glowing fungus cluster (bio-glow). */
function fungus(g: Ctx, light: Ctx, rng: Rand, x: number, y: number, n: number, color: number, dir = -1): void {
  for (let i = 0; i < n; i++) {
    const fx = x + rng.range(-1, 1) * n * 4;
    const fy = y + rng.range(-4, 4);
    const sh = rng.range(5, 16);
    const cr = rng.range(3, 8);
    g.strokeStyle = css(shade(color, -0.35), 0.85);
    g.lineWidth = Math.max(1, cr * 0.3);
    g.beginPath();
    g.moveTo(fx, fy);
    g.quadraticCurveTo(fx + rng.range(-3, 3), fy + (dir * sh) / 2, fx + rng.range(-2, 2), fy + dir * sh);
    g.stroke();
    const cy = fy + dir * sh;
    const gr = g.createRadialGradient(fx, cy, 0, fx, cy, cr);
    gr.addColorStop(0, css(shade(color, 0.6)));
    gr.addColorStop(1, css(shade(color, -0.2)));
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(fx, cy, cr, cr * 0.55, 0, dir < 0 ? Math.PI : 0, dir < 0 ? Math.PI * 2 : Math.PI);
    g.closePath();
    g.fill();
  }
  blob(g, x, y + dir * 8, n * 9, n * 7, color, 0.18);
  blob(light, x, y + dir * 8, n * 12, n * 9, color, 0.45, 0.1);
  for (let i = 0; i < n * 1.5; i++) {
    const px = x + rng.range(-1, 1) * n * 10;
    const py = y + rng.range(-1, 1) * n * 7;
    g.fillStyle = css(shade(color, 0.5), rng.range(0.4, 0.9));
    g.beginPath();
    g.arc(px, py, rng.range(0.8, 1.8), 0, Math.PI * 2);
    g.fill();
  }
}

/** Bulkhead caged lamp on a wall. */
export function cagedLamp(g: Ctx, light: Ctx, x: number, y: number, color: number, glow = 1): void {
  g.save();
  g.fillStyle = css(0x1e1d1b);
  g.beginPath();
  g.ellipse(x, y, 22, 15, 0, 0, Math.PI * 2);
  g.fill();
  const gr = g.createRadialGradient(x, y, 0, x, y, 16);
  gr.addColorStop(0, css(0xfff5dc));
  gr.addColorStop(0.6, css(shade(color, 0.3)));
  gr.addColorStop(1, css(color));
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(x, y, 16, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = css(0x2a2622);
  g.lineWidth = 2;
  for (const dx of [-8, 0, 8]) {
    g.beginPath();
    g.moveTo(x + dx, y - 11);
    g.lineTo(x + dx, y + 11);
    g.stroke();
  }
  g.beginPath();
  g.ellipse(x, y, 17, 11, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();
  blob(g, x, y, 70, 55, color, 0.16 * glow);
  blob(light, x, y, 40, 30, shade(color, 0.3), 0.7 * glow, 0.2);
  blob(light, x, y + 60, 200, 170, color, 0.18 * glow);
}

/** Generic distant hills / bushes on the surface strip. */
function surfaceDressing(P: Painter, bush: number): void {
  const { far: g, rng, G } = P;
  const x0 = -ENV_MARGIN.left, x1 = G.w + ENV_MARGIN.right;
  g.fillStyle = css(shade(P.T.sky[1], -0.25), 0.8);
  g.beginPath();
  g.moveTo(x0, G.surfaceY);
  for (let x = x0; x <= x1; x += 40) g.lineTo(x, G.surfaceY - 14 - Math.sin(x * 0.006) * 10 - rng.range(0, 6));
  g.lineTo(x1, G.surfaceY);
  g.closePath();
  g.fill();
  for (let x = x0 + rng.range(20, 120); x < x1; x += rng.range(160, 380)) {
    leafCluster(g, rng, x, G.surfaceY + 2, rng.range(14, 26), [bush, shade(bush, -0.2), shade(bush, 0.1)], 10, -Math.PI * 0.95, -Math.PI * 0.05);
  }
}

/** Pegboard tool outline + tool. */
function tool(g: Ctx, rng: Rand, kind: number, x: number, y: number, s: number): void {
  const steel = jitter(rng, 0x8a8e8e, 0.08);
  const handle = rng.pick([0xa33a2a, 0x2d5d8a, 0xc08a2a, 0x3a6a3a]);
  g.save();
  g.translate(x, y);
  // painted outline (shadow board)
  g.strokeStyle = css(0x1c1712, 0.35);
  g.lineWidth = 3;
  const drawShape = (fill: boolean): void => {
    g.beginPath();
    if (kind === 0) {
      // wrench
      g.rect(-2.5 * s, 0, 5 * s, 34 * s);
      g.moveTo(6 * s, 0);
      g.arc(0, 0, 6 * s, 0, Math.PI * 2);
    } else if (kind === 1) {
      // hammer
      g.rect(-2 * s, 4 * s, 4 * s, 34 * s);
      g.rect(-9 * s, -2 * s, 18 * s, 7 * s);
    } else if (kind === 2) {
      // saw
      g.moveTo(-6 * s, 0);
      g.lineTo(6 * s, 0);
      g.lineTo(4 * s, 46 * s);
      g.lineTo(-4 * s, 46 * s);
      g.closePath();
    } else if (kind === 3) {
      // screwdriver
      g.rect(-2.5 * s, 0, 5 * s, 14 * s);
      g.rect(-1 * s, 14 * s, 2 * s, 18 * s);
    } else {
      // pliers
      g.moveTo(-1 * s, 0);
      g.lineTo(-5 * s, 30 * s);
      g.lineTo(-2 * s, 30 * s);
      g.lineTo(1 * s, 6 * s);
      g.lineTo(4 * s, 30 * s);
      g.lineTo(7 * s, 30 * s);
      g.lineTo(2 * s, 0);
      g.closePath();
    }
    if (fill) g.fill();
    else g.stroke();
  };
  g.translate(2, 2);
  drawShape(false);
  g.translate(-2, -2);
  g.fillStyle = css(0x15110d, 0.5);
  g.translate(1.5, 2);
  drawShape(true);
  g.translate(-1.5, -2);
  g.fillStyle = hGrad(g, -8 * s, 8 * s, [[0, shade(steel, 0.25)], [0.5, steel], [1, shade(steel, -0.35)]]);
  drawShape(true);
  if (kind === 1 || kind === 3) {
    g.fillStyle = css(kind === 1 ? 0x7a5634 : handle);
    if (kind === 1) g.fillRect(-2 * s, 6 * s, 4 * s, 32 * s);
    else g.fillRect(-2.5 * s, 0, 5 * s, 14 * s);
  }
  if (kind === 2) {
    g.fillStyle = css(0x6b4a2e);
    g.fillRect(-6 * s, -10 * s, 12 * s, 11 * s);
  }
  if (kind === 4) {
    g.fillStyle = css(handle);
    g.fillRect(-5 * s, 18 * s, 3 * s, 12 * s);
    g.fillRect(4 * s, 18 * s, 3 * s, 12 * s);
  }
  if (kind === 0) {
    g.fillStyle = css(0x2b2b2b);
    g.beginPath();
    g.arc(0, -1 * s, 2.6 * s, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Wooden workbench standing on the back floor line. */
export function workbench(g: Ctx, rng: Rand, x: number, floorY: number, w: number, topH: number): void {
  const wood = 0x6e4f33;
  const top = floorY - topH;
  contactShadow(g, x + w / 2, floorY, w, 0.5);
  g.fillStyle = css(0x2a1f17);
  for (const lx of [x + 10, x + w - 24]) g.fillRect(lx, top, 14, topH);
  g.fillStyle = css(0x3a2b1f);
  g.fillRect(x + 10, floorY - 42, w - 20, 8);
  // drawers
  g.fillStyle = vGrad(g, top + 14, top + 60, [[0, 0x5a4029], [1, 0x3d2b1d]]);
  g.fillRect(x + w * 0.55, top + 14, w * 0.38, 46);
  g.strokeStyle = css(0x1f160f, 0.8);
  g.lineWidth = 1.5;
  g.strokeRect(x + w * 0.55, top + 14, w * 0.38, 23);
  g.strokeRect(x + w * 0.55, top + 37, w * 0.38, 23);
  g.fillStyle = css(0xb0a080, 0.7);
  g.fillRect(x + w * 0.72, top + 24, 12, 3);
  g.fillRect(x + w * 0.72, top + 47, 12, 3);
  // boxes under
  crateBox(g, rng, x + 30, floorY - 2, 54, 34, 0x8a6a48);
  crateBox(g, rng, x + 92, floorY - 2, 40, 26, 0x6a6e5a, false);
  // top
  g.fillStyle = css(0x1d1510);
  g.fillRect(x - 2, top - 2, w + 4, 18);
  g.fillStyle = vGrad(g, top, top + 14, [[0, shade(wood, 0.15)], [1, shade(wood, -0.3)]]);
  g.fillRect(x, top, w, 14);
  g.fillStyle = css(0xd0a878, 0.45);
  g.fillRect(x, top, w, 1.5);
  texture(g, 'grain', x, top, w, 14, { alpha: 0.35, op: 'overlay' });
}

/** Vertical/horizontal timber with grain. */
export function timber(g: Ctx, rng: Rand, x: number, y: number, w: number, h: number, color: number): void {
  g.fillStyle = css(shade(color, -0.65));
  g.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  const vertical = h > w;
  g.fillStyle = vertical
    ? hGrad(g, x, x + w, [[0, shade(color, 0.12)], [0.4, color], [1, shade(color, -0.35)]])
    : vGrad(g, y, y + h, [[0, shade(color, 0.15)], [0.4, color], [1, shade(color, -0.35)]]);
  g.fillRect(x, y, w, h);
  g.strokeStyle = css(shade(color, -0.35), 0.5);
  g.lineWidth = 1;
  const n = Math.max(2, Math.floor((vertical ? w : h) / 6));
  for (let i = 0; i < n; i++) {
    g.beginPath();
    if (vertical) {
      const gx = x + rng.range(2, w - 2);
      g.moveTo(gx, y);
      g.bezierCurveTo(gx + rng.range(-2, 2), y + h * 0.3, gx + rng.range(-2, 2), y + h * 0.6, gx + rng.range(-1, 1), y + h);
    } else {
      const gy = y + rng.range(2, h - 2);
      g.moveTo(x, gy);
      g.bezierCurveTo(x + w * 0.3, gy + rng.range(-2, 2), x + w * 0.6, gy + rng.range(-2, 2), x + w, gy + rng.range(-1, 1));
    }
    g.stroke();
  }
  // knots
  for (let i = 0; i < (vertical ? h : w) / 150; i++) {
    const kx = vertical ? x + w * rng.range(0.3, 0.7) : x + rng.range(0, w);
    const ky = vertical ? y + rng.range(0, h) : y + h * rng.range(0.3, 0.7);
    g.fillStyle = css(shade(color, -0.5), 0.6);
    g.beginPath();
    g.ellipse(kx, ky, vertical ? 2.5 : 5, vertical ? 5 : 2.5, 0, 0, Math.PI * 2);
    g.fill();
  }
}

/** Gas cylinder / tall tank standing at floorY. */
export function cylinder(g: Ctx, x: number, floorY: number, w: number, h: number, color: number, band = 0xc9c0a8): void {
  const top = floorY - h;
  contactShadow(g, x + w / 2, floorY, w * 1.4);
  g.fillStyle = css(shade(color, -0.7));
  g.beginPath();
  g.roundRect(x - 1.5, top - 1.5, w + 3, h + 3, w / 2);
  g.fill();
  g.fillStyle = hGrad(g, x, x + w, [[0, shade(color, -0.2)], [0.3, shade(color, 0.28)], [0.55, color], [1, shade(color, -0.5)]]);
  g.beginPath();
  g.roundRect(x, top, w, h, w / 2);
  g.fill();
  g.fillStyle = css(band, 0.55);
  g.fillRect(x, top + h * 0.22, w, 6);
  g.fillStyle = css(0x2a2a28);
  g.fillRect(x + w * 0.35, top - 10, w * 0.3, 12);
}

// ---------------------------------------------------------------------------
// Common structure: sky, earth, concrete cut, shell shading, veil, vignette
// ---------------------------------------------------------------------------

function paintExterior(P: Painter, def: EnvDef): void {
  if (def.exterior) return def.exterior(P);
  const { far: g, G, T } = P;
  const rng = P.rng.fork(11);
  const X0 = -ENV_MARGIN.left, Y0 = -ENV_MARGIN.top;
  const W = G.w + ENV_MARGIN.left + ENV_MARGIN.right;
  const H = G.h + ENV_MARGIN.top + ENV_MARGIN.bottom;
  // sky strip
  g.fillStyle = vGrad(g, Y0, G.surfaceY, [[0, T.sky[0]], [1, T.sky[1]]]);
  g.fillRect(X0, Y0, W, G.surfaceY - Y0 + 2);
  texture(g, 'mottle', X0, Y0, W, G.surfaceY - Y0, { alpha: 0.35, op: 'soft-light', scale: 2 });
  surfaceDressing(P, shade(T.grass, -0.35));
  // soil everywhere below the surface
  soil(g, rng, X0, G.surfaceY, W, Y0 + H - G.surfaceY, T.soil, { surfaceY: G.surfaceY + 6, roots: W / 70 });
  // deeper roots hanging along the outside of the walls and slab
  for (let i = 0; i < W / 220; i++) roots(g, rng, rng.range(X0, X0 + W), G.surfaceY + 8, rng.range(60, 140), rng.range(1.5, 3.2), T.soil.root, 4);
  def.soilExtras(P);
  // bitumen membrane + concrete shell cut
  const t = G.wallT;
  const memb = 0x16130f;
  g.fillStyle = css(memb);
  g.fillRect(-t - 6, G.slabTop - 6, G.w + 2 * t + 12, G.h + G.floorSlab - G.slabTop + 12);
  // footings
  g.fillRect(-t - 30, G.h + G.floorSlab - 4, t + 66, 34);
  g.fillRect(G.w - 36, G.h + G.floorSlab - 4, t + 66, 34);
  concreteCut(g, rng, -t - 26, G.h + G.floorSlab, t + 58, 26, shade(T.concrete, -0.08), false);
  concreteCut(g, rng, G.w - 32, G.h + G.floorSlab, t + 58, 26, shade(T.concrete, -0.08), false);
  concreteCut(g, rng, -t, G.slabTop, G.w + 2 * t, G.ceilY - G.slabTop, T.concrete);
  concreteCut(g, rng, -t, G.ceilY, t, G.h - G.ceilY, T.concrete);
  concreteCut(g, rng, G.w, G.ceilY, t, G.h - G.ceilY, T.concrete);
  concreteCut(g, rng, -t, G.h, G.w + 2 * t, G.floorSlab, shade(T.concrete, -0.05));
  // ink edge around cut + inner lit edge
  g.strokeStyle = css(0x0f0d0b, 0.85);
  g.lineWidth = 2;
  g.strokeRect(-t, G.slabTop, G.w + 2 * t, G.h + G.floorSlab - G.slabTop);
  g.strokeStyle = css(shade(T.concrete, 0.35), 0.6);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(-t, G.slabTop + 1);
  g.lineTo(G.w + t, G.slabTop + 1);
  g.stroke();
  turf(g, rng, X0, X0 + W, G.surfaceY, T.grass, T.soil.top);
}

function paintShell(P: Painter, def: EnvDef, day?: Daylight): void {
  const { far: g, G, T } = P;
  const rng = P.rng.fork(23);
  const occ = day ? 0.5 : 1;
  if (def.stage) {
    clipped(g, roomPath(G), () => def.backWall(P));
    return;
  }
  // back wall
  clipped(g, backPath(G), () => {
    def.backWall(P);
    if (day?.paint !== undefined) freshPaint(g, backPath(G), day.paint, day.paintAlpha ?? 0.5);
    // ceiling-line shadow and wall grime at the top
    g.fillStyle = vGrad(g, G.by0, G.by0 + 90, [[0, 0x000000, 0.45 * occ], [1, 0x000000, 0]]);
    g.fillRect(G.bx0, G.by0, G.bx1 - G.bx0, 90);
    // floor-line occlusion
    g.fillStyle = vGrad(g, G.by1 - 70, G.by1, [[0, 0x000000, 0], [1, 0x000000, 0.4 * occ]]);
    g.fillRect(G.bx0, G.by1 - 70, G.bx1 - G.bx0, 70);
    // corner occlusion
    g.fillStyle = hGrad(g, G.bx0, G.bx0 + 70, [[0, 0x000000, 0.4 * occ], [1, 0x000000, 0]]);
    g.fillRect(G.bx0, G.by0, 70, G.by1 - G.by0);
    g.fillStyle = hGrad(g, G.bx1 - 70, G.bx1, [[0, 0x000000, 0], [1, 0x000000, 0.4 * occ]]);
    g.fillRect(G.bx1 - 70, G.by0, 70, G.by1 - G.by0);
  });
  // side walls
  const sideFill = (path: Path2D, left: boolean): void => {
    clipped(g, path, () => {
      const xa = left ? 0 : G.w;
      const xb = left ? G.bx0 : G.bx1;
      g.fillStyle = hGrad(g, xa, xb, [[0, shade(T.side, 0.04)], [1, shade(T.side, -0.38)]]);
      g.fillRect(Math.min(xa, xb), G.ceilY, Math.abs(xb - xa), G.h - G.ceilY);
      texture(g, 'mottle', Math.min(xa, xb), G.ceilY, Math.abs(xb - xa), G.h - G.ceilY, { alpha: 0.5, op: 'soft-light', scale: 0.8 });
      streaks(g, rng, Math.min(xa, xb), Math.max(xa, xb), G.ceilY + 10, 160, 6, 0x1a1510, 0.25);
    });
  };
  sideFill(leftPath(G), true);
  sideFill(rightPath(G), false);
  if (def.sideWalls) {
    const both = new Path2D();
    both.addPath(leftPath(G));
    both.addPath(rightPath(G));
    clipped(g, both, () => def.sideWalls?.(P));
  }
  if (day?.paint !== undefined) {
    freshPaint(g, leftPath(G), shade(day.paint, -0.1), (day.paintAlpha ?? 0.5) * 0.8);
    freshPaint(g, rightPath(G), shade(day.paint, -0.1), (day.paintAlpha ?? 0.5) * 0.8);
  }
  // ceiling underside
  clipped(g, ceilPath(G), () => {
    g.fillStyle = vGrad(g, G.ceilY, G.by0, [[0, shade(T.ceiling, 0.06)], [1, shade(T.ceiling, -0.35)]]);
    g.fillRect(0, G.ceilY, G.w, G.by0 - G.ceilY);
    texture(g, 'mottle', 0, G.ceilY, G.w, G.by0 - G.ceilY, { alpha: 0.5, op: 'soft-light' });
    // formwork board lines receding
    g.strokeStyle = css(0x000000, 0.18);
    g.lineWidth = 1;
    g.beginPath();
    const n = Math.round(G.w / 120);
    for (let i = 0; i <= n; i++) {
      g.moveTo((i / n) * G.w, G.ceilY);
      g.lineTo(G.bx0 + (i / n) * (G.bx1 - G.bx0), G.by0);
    }
    g.stroke();
    def.ceiling?.(P);
  });
  // floor plane
  clipped(g, floorPath(G), () => {
    def.floor(P);
    g.fillStyle = vGrad(g, G.by1, G.by1 + 22, [[0, 0x000000, 0.45], [1, 0x000000, 0]]);
    g.fillRect(0, G.by1, G.w, 22);
  });
  // edges between planes: soft dark seams
  g.save();
  g.strokeStyle = css(0x000000, 0.35);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, G.ceilY);
  g.lineTo(G.bx0, G.by0);
  g.lineTo(G.bx0, G.by1);
  g.lineTo(0, G.h);
  g.moveTo(G.w, G.ceilY);
  g.lineTo(G.bx1, G.by0);
  g.lineTo(G.bx1, G.by1);
  g.lineTo(G.w, G.h);
  g.moveTo(G.bx0, G.by0);
  g.lineTo(G.bx1, G.by0);
  g.stroke();
  g.restore();
}

function paintVeil(P: Painter, flat = false, day?: Daylight): void {
  const { far: g, G, T } = P;
  const veil = day?.veil ?? T.veil;
  const veilAlpha = day?.veilAlpha ?? T.veilAlpha;
  const dark = day ? 0.45 : 1;
  clipped(g, roomPath(G), () => {
    if (day) {
      // daylight: warm sun from the upper left, soft-light so it brightens without flattening
      g.save();
      g.globalCompositeOperation = 'soft-light';
      const gr = g.createLinearGradient(0, G.ceilY, G.w * 0.7, G.h);
      gr.addColorStop(0, css(day.sun, day.sunAlpha));
      gr.addColorStop(1, css(day.sun, day.sunAlpha * 0.3));
      g.fillStyle = gr;
      g.fillRect(0, G.ceilY, G.w, G.h - G.ceilY);
      g.restore();
    }
    if (flat) {
      // flat art: one even wash keeps the backdrop calm without painterly lighting
      g.fillStyle = css(veil, veilAlpha);
      g.fillRect(0, G.ceilY, G.w, G.h - G.ceilY);
      return;
    }
    // cinematic grade: warm key from above, cool shadow pooling low in the corners
    g.save();
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = vGrad(g, G.ceilY, G.h, [[0, T.key, 0.55], [0.45, T.key, 0.18], [1, T.key, 0]]);
    g.fillRect(0, G.ceilY, G.w, G.h - G.ceilY);
    g.restore();
    g.save();
    g.globalCompositeOperation = 'multiply';
    blob(g, 0, G.h, G.w * 0.35, G.h * 0.5, T.shadow, 0.45 * dark);
    blob(g, G.w, G.h, G.w * 0.35, G.h * 0.5, T.shadow, 0.45 * dark);
    g.restore();
    // calm the centre: a low-contrast wash (light and warm in daylight)
    blob(g, G.w / 2, G.h * 0.47, G.w * 0.4, G.h * 0.4, veil, veilAlpha, 0.35);
    // inner shadow along the front cut (room is recessed behind the cut)
    g.fillStyle = hGrad(g, 0, 26, [[0, 0x000000, 0.45 * dark], [1, 0x000000, 0]]);
    g.fillRect(0, G.ceilY, 26, G.h - G.ceilY);
    g.fillStyle = hGrad(g, G.w - 26, G.w, [[0, 0x000000, 0], [1, 0x000000, 0.45 * dark]]);
    g.fillRect(G.w - 26, G.ceilY, 26, G.h - G.ceilY);
    g.fillStyle = vGrad(g, G.ceilY, G.ceilY + 22, [[0, 0x000000, 0.5 * dark], [1, 0x000000, 0]]);
    g.fillRect(0, G.ceilY, G.w, 22);
  });
}

function paintFinish(P: Painter, flat = false, day?: Daylight): void {
  const { far: g, G } = P;
  const X0 = -ENV_MARGIN.left, Y0 = -ENV_MARGIN.top;
  const W = G.w + ENV_MARGIN.left + ENV_MARGIN.right;
  const H = G.h + ENV_MARGIN.top + ENV_MARGIN.bottom;
  // painterly unevenness & grain over everything
  if (!flat) {
    texture(g, 'mottle', X0, Y0, W, H, { alpha: day ? 0.06 : 0.14, op: 'soft-light', scale: 2.2, offsetX: 37, offsetY: 91 });
    texture(g, 'grain', X0, Y0, W, H, { alpha: day ? 0.07 : 0.1, op: 'overlay' });
  }
  // vignette focused on the world rect
  const cx = G.w / 2, cy = G.h / 2;
  const r0 = Math.min(G.w, G.h) * 0.45;
  const r1 = Math.hypot(W / 2, H / 2) * 1.02;
  const gr = g.createRadialGradient(cx, cy, r0, cx, cy, r1);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  const v = day ? 0.5 : 1;
  gr.addColorStop(0.6, `rgba(8,6,4,${(0.28 * v).toFixed(3)})`);
  gr.addColorStop(1, `rgba(6,4,3,${(0.6 * v).toFixed(3)})`);
  g.save();
  g.translate(cx, cy);
  g.scale(1, H / W + 0.25);
  g.translate(-cx, -cy);
  g.fillStyle = gr;
  g.fillRect(X0 - W, Y0 - H, W * 3, H * 3);
  g.restore();
}

// ---------------------------------------------------------------------------
// Environment: Improvised Garage
// ---------------------------------------------------------------------------

const garage: EnvDef = {
  theme: {
    soil: { top: 0x5b4330, mid: 0x4a3526, deep: 0x2b1f17, rock: 0x7a6f62, root: 0x3a2a1c },
    grass: 0x6f7d3a,
    sky: [0x5aaef0, 0xc4e8fb],
    concrete: 0x8a857a,
    side: 0x585a4c,
    ceiling: 0x5a574f,
    veil: 0x3e3d33,
    veilAlpha: 0.3,
    key: 0xffa955,
    shadow: 0x1c2a3a,
    floor: { top: 0x726c62, face: 0x3b3731 },
  },
  backWall(P) {
    const { far: g, rng, G } = P;
    const x = G.bx0, y = G.by0, w = G.bx1 - G.bx0, h = G.by1 - G.by0;
    const upper = 0x5c5e4f, lower = 0x45463b;
    const split = G.by1 - 200;
    g.fillStyle = vGrad(g, y, split, [[0, shade(upper, -0.15)], [0.6, upper], [1, shade(upper, -0.05)]]);
    g.fillRect(x, y, w, split - y);
    blockCourses(g, rng, x, y, w, split - y, upper, 84, 40, 0.1);
    g.fillStyle = css(lower);
    g.fillRect(x, split, w, G.by1 - split);
    blockCourses(g, rng, x, split, w, G.by1 - split, lower, 84, 40, 0.1);
    g.fillStyle = css(0x8a5c34, 0.85);
    g.fillRect(x, split - 4, w, 9);
    g.fillStyle = css(0xc9935a, 0.3);
    g.fillRect(x, split - 4, w, 1.5);
    texture(g, 'mottle', x, y, w, h, { alpha: 0.28, op: 'soft-light', scale: 1.1 });
    texture(g, 'grime', x, y, w, h, { alpha: 0.35, scale: 1.6 });
    streaks(g, rng, x, x + w, y + 20, 260, Math.round(w / 40), 0x2a2116, 0.22);
    for (let i = 0; i < 5; i++) stain(g, rng, rng.range(x, x + w), rng.range(split + 30, G.by1), rng.range(30, 60), 0x1e1912, 0.25, 0.6);
    for (let i = 0; i < w / 260; i++) crack(g, rng, rng.range(x, x + w), rng.range(y, G.by1), rng.range(30, 70), 0x1e1c16, 0.5);
    // conduit along the top
    pipe(g, [[x, y + 22], [x + w, y + 22]], { color: 0x7d7f78, r: 4 });
    for (let cx = x + 140; cx < x + w; cx += 320) {
      g.fillStyle = css(0x4a4c46);
      g.fillRect(cx - 9, y + 13, 18, 18);
      bevel(g, cx - 9, y + 13, 18, 18, 0xb0b2aa, 0x1c1c1a, 0.5, 1);
    }
    // faded poster near top centre-left (story bit, low contrast)
    const px = x + w * 0.4, py = y + 70;
    g.save();
    g.translate(px, py);
    g.rotate(-0.04);
    g.fillStyle = css(0xb6a98a, 0.35);
    g.fillRect(0, 0, 70, 92);
    g.fillStyle = css(0x8a3a2c, 0.3);
    g.beginPath();
    g.arc(35, 38, 20, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = css(0x2c2a24, 0.3);
    g.fillRect(10, 70, 50, 4);
    g.fillRect(16, 78, 38, 3);
    g.restore();
  },
  floor(P) {
    const { far: g, rng, G } = P;
    floorPerspective(P, 0x6a655b, { cols: 6, rows: 2, line: 0x2a2620, lineAlpha: 0.35 });
    for (let i = 0; i < Math.max(3, G.w / 300); i++) {
      stain(g, rng, rng.range(G.bx0, G.bx1), rng.range(G.by1 + 12, G.h - 6), rng.range(24, 60), 0x0f0c09, 0.5, 0.28);
    }
    // tyre marks
    g.strokeStyle = css(0x17140f, 0.2);
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(G.w * 0.66, G.h);
    g.quadraticCurveTo(G.w * 0.72, G.by1 + 20, G.w * 0.8, G.by1 + 4);
    g.stroke();
  },
  props(P) {
    const { far: g, rng, G, amb } = P;
    // pegboard + workbench, left zone
    const pw = Math.min(330, G.w * 0.21);
    const px = G.bx0 + 26, py = G.by1 - 470;
    g.fillStyle = css(0x2a1f15);
    g.fillRect(px - 6, py - 6, pw + 12, 252);
    g.fillStyle = vGrad(g, py, py + 240, [[0, 0x7d6045], [1, 0x5e4732]]);
    g.fillRect(px, py, pw, 240);
    g.fillStyle = css(0x24190f, 0.55);
    for (let hy = py + 8; hy < py + 236; hy += 14) for (let hx = px + 8; hx < px + pw - 4; hx += 14) g.fillRect(hx, hy, 2.2, 2.2);
    texture(g, 'mottle', px, py, pw, 240, { alpha: 0.4, op: 'soft-light' });
    let tx = px + 24;
    let k = 0;
    while (tx < px + pw - 20) {
      tool(g, rng, k % 5, tx, py + 30 + rng.range(0, 30), rng.range(1.4, 1.9));
      tx += rng.range(34, 52);
      k++;
    }
    // coil of wire on a hook
    g.strokeStyle = css(0xa2642e);
    g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.ellipse(px + pw * 0.5 + i * 2, py + 180, 26, 20, 0, 0, Math.PI * 2);
      g.stroke();
    }
    const bw = pw + 110;
    workbench(g, rng, G.bx0 + 10, G.by1, bw, 150);
    // items on bench
    const bt = G.by1 - 150;
    crateBox(g, rng, G.bx0 + 40, bt, 76, 34, 0x8e3a2b, false);
    g.fillStyle = css(0xd0b070, 0.6);
    g.fillRect(G.bx0 + 70, bt - 26, 16, 4);
    // vice
    g.fillStyle = css(0x3e5a6a);
    g.fillRect(G.bx0 + bw - 46, bt - 30, 38, 30);
    g.fillStyle = css(0x2b3c46);
    g.fillRect(G.bx0 + bw - 52, bt - 24, 8, 20);
    g.fillStyle = css(0x9aa6aa);
    g.fillRect(G.bx0 + bw - 64, bt - 18, 14, 3);
    // battery charger with LED
    const cx = G.bx0 + 150, cy = bt;
    g.fillStyle = css(0x2e3130);
    g.fillRect(cx, cy - 26, 44, 26);
    bevel(g, cx, cy - 26, 44, 26, 0x8a8f8c, 0x111111, 0.5, 1);
    g.fillStyle = css(0x9a8a5a, 0.5);
    g.fillRect(cx + 6, cy - 20, 18, 8);
    led(g, P.light, cx + 34, cy - 17, 0x63f07a);
    amb.push({ kind: 'blink', x: cx + 34, y: cy - 17, color: 0x63f07a, size: 2.4, period: 2.2, layer: 'far' });
    cable(g, cx + 44, cy - 10, G.bx0 + bw - 10, cy - 4, 18, 2.5, 0x1d1d1d);
    // fluorescent strip above pegboard (warm white)
    tubeLamp(g, P.light, px + 10, py - 26, pw - 20, 0xffdfa6, 0.55);

    // roller door, right zone
    const dw = Math.min(340, G.w * 0.2);
    const dx1 = G.bx1 - 36, dx0 = dx1 - dw;
    const dy0 = G.by0 + 150;
    const gap = 24;
    const dbot = G.by1 - gap;
    // outside glow through the gap
    g.fillStyle = vGrad(g, dbot, G.by1, [[0, 0x2a3a52], [1, 0x6a84a8]]);
    g.fillRect(dx0, dbot, dw, gap);
    blob(P.light, dx0 + dw / 2, G.by1 + 8, dw * 0.65, 30, 0x6f8fc0, 0.35, 0.2);
    // rails & housing
    g.fillStyle = css(0x23262a);
    g.fillRect(dx0 - 16, dy0 - 40, 16, G.by1 - dy0 + 40);
    g.fillRect(dx1, dy0 - 40, 16, G.by1 - dy0 + 40);
    g.fillStyle = vGrad(g, dy0 - 52, dy0, [[0, 0x535a5f], [1, 0x2f3438]]);
    g.fillRect(dx0 - 24, dy0 - 52, dw + 48, 52);
    bevel(g, dx0 - 24, dy0 - 52, dw + 48, 52, 0x8a9296, 0x111316, 0.6, 1.5);
    // slats
    const door = 0x4a5258;
    for (let sy = dy0; sy < dbot; sy += 22) {
      const hgt = Math.min(22, dbot - sy);
      g.fillStyle = vGrad(g, sy, sy + hgt, [[0, shade(door, 0.18)], [0.35, door], [0.85, shade(door, -0.2)], [1, shade(door, -0.55)]]);
      g.fillRect(dx0, sy, dw, hgt);
    }
    texture(g, 'grime', dx0, dy0, dw, dbot - dy0, { alpha: 0.5, scale: 1.3 });
    streaks(g, rng, dx0, dx1, dy0, 240, Math.round(dw / 30), 0x5a3420, 0.3);
    g.fillStyle = css(0x1a1c1e);
    g.fillRect(dx0 + dw / 2 - 18, dbot - 14, 36, 6);
    g.fillStyle = css(0x2b2f33);
    g.fillRect(dx0, dbot - 4, dw, 4);
    stencil(g, 'FOLLY & SONS', dx0 + dw / 2, dy0 + (dbot - dy0) * 0.4, 26, 0xd8cfb8, 0.18, 'center');
    // pull rope
    g.strokeStyle = css(0xb8a070, 0.8);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(dx0 + dw * 0.8, dbot - 8);
    g.quadraticCurveTo(dx0 + dw * 0.82, dbot + 20, dx0 + dw * 0.8, G.by1 - 2);
    g.stroke();

    // high shelf top-centre with paint cans
    const sx = G.w * 0.5 - 120;
    shelf(g, rng, sx, G.by0 + 92, 240, 9, [0x8a3a2b, 0x3d5a6e, 0xb08a3a, 0x6e6a58], 0.9);
    // small vent fan, upper left of wall
    const fx = G.bx0 + 60 + pw * 0.75, fy = G.by0 + 96;
    ventGrille(g, fx, fy, 22, 0x5a5c55);
    amb.push({ kind: 'fan', x: fx, y: fy, size: 20, period: 1.4, color: 0x2a2b28, layer: 'far' });
    // bucket + broom low at middle-right of back line
    const bx = G.w * 0.6;
    contactShadow(g, bx + 20, G.by1, 50);
    g.fillStyle = hGrad(g, bx, bx + 40, [[0, 0x3e5a6c], [0.35, 0x5f7f92], [1, 0x2a3c48]]);
    g.beginPath();
    g.moveTo(bx, G.by1 - 40);
    g.lineTo(bx + 40, G.by1 - 40);
    g.lineTo(bx + 35, G.by1);
    g.lineTo(bx + 5, G.by1);
    g.closePath();
    g.fill();
    g.strokeStyle = css(0x6e5236);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(bx + 52, G.by1);
    g.lineTo(bx + 82, G.by1 - 200);
    g.stroke();
  },
  cheer(P) {
    const { far: g, rng, G } = P;
    // a sunny window between the pegboard and the roller door, with a geranium on the sill
    sunnyWindow(P, 432, 136, 250, 170, { cols: 3, rows: 2, sun: [0.8, 0.28], clouds: 2, sill: true, beam: 140 });
    bunting(g, 60, 34, 410, 40, 16);
    bunting(g, 712, 40, 1062, 34, 16, [0x4fa8e0, 0xf2c043, 0xe07ab8, 0x6cc87a, 0xe0603c]);
    doodle(g, rng, 520, 360, 74, 88, 'machine', -0.05);
    doodle(g, rng, 612, 372, 62, 72, 'sun', 0.07);
    flowerPot(g, rng, 330, 424, 26);
    bigPlant(g, rng, 752, G.by1, 150);
  },
  lights(P) {
    const { far: g, light, G, amb } = P;
    const warm = 0xffb25c;
    const xs = [G.w * 0.28, G.w * 0.62];
    xs.forEach((x, i) => {
      const y = 96 + i * 16;
      blob(g, x, y + 120, 280, 220, warm, 0.07);
      hangingBulb(g, light, x, G.ceilY + 10, y, warm, 9, 1);
      lightCone(light, x, y, 20, 520, G.by1 - y, warm, 0.07);
      amb.push({ kind: 'sway', x, y, size: 9, period: 5 + i, color: warm, layer: 'far' });
    });
    amb.push({ kind: 'flicker', x: xs[1], y: 112, w: 80, h: 80, color: warm, period: 7, layer: 'far' });
    amb.push({ kind: 'dust', x: xs[0] - 170, y: 60, w: 340, h: Math.min(460, G.h * 0.55), color: 0xffd6a0, layer: 'far' });
    amb.push({ kind: 'drip', x: G.bx0 + 140 + 320, y: G.by0 + 30, color: 0x9fb7c0, size: 2, period: 4.2, layer: 'far' });
  },
  soilExtras(P) {
    const { far: g, rng, G } = P;
    const X0 = -ENV_MARGIN.left, X1 = G.w + ENV_MARGIN.right;
    // clay sewer pipe & cable bundle below the floor
    const sy = G.h + 160;
    pipe(g, [[X0, sy], [X1, sy]], { color: 0x7d5a43, r: 18, flangeEvery: 260 });
    pipe(g, [[G.w * 0.7, G.h + G.floorSlab], [G.w * 0.7, sy - 14]], { color: 0x5d6064, r: 8 });
    cableBundle(g, rng, X0, G.h + 95, X1, G.h + 105, 30, [0x1c1c1c, 0x2b2b2b, 0x9a4f22], 4);
    // water main on left, cable down the right side
    pipe(g, [[X0, G.h * 0.4], [-G.wallT - 30, G.h * 0.4], [-G.wallT - 30, G.h + 210], [X0, G.h + 210]], { color: 0x4f5a62, r: 10, flangeEvery: 180 });
    cableBundle(g, rng, G.w + G.wallT + 40, G.surfaceY + 20, G.w + G.wallT + 70, G.h + 60, 40, [0x1a1a1a, 0x7a2a22], 4);
    // buried junk: an old bottle and a horseshoe
    g.fillStyle = css(0x3f6a4a, 0.75);
    g.save();
    g.translate(-150, G.h * 0.7);
    g.rotate(0.7);
    g.fillRect(-6, -20, 12, 30);
    g.fillRect(-3, -30, 6, 12);
    g.restore();
  },
  near(P) {
    const { near: g, rng, G, amb } = P;
    const dark = 0x15110d, rim = 0xffb25c;
    // extension cord hanging from top-left
    hangingCable(g, rng, 70, -200, 250, 6, 0x2a1d14);
    g.fillStyle = css(0x9a5222);
    g.fillRect(58, 48, 26, 18);
    amb.push({ kind: 'sway', x: 70, y: 60, size: 8, period: 6, layer: 'near' });
    // shelf corner, top-right
    const sx = G.w - 150;
    const sh = new Path2D();
    sh.rect(sx, 34, 400, 14);
    sh.rect(sx + 20, -200, 10, 240);
    sh.addPath(rrPath(sx + 30, -4, 36, 38, 3));
    sh.addPath(rrPath(sx + 76, 4, 50, 30, 2));
    silhouette(g, sh, dark, rim, -2, -2, 0.3);
    // tyre stack bottom-left
    for (let i = 0; i < 3; i++) {
      const ty = G.h + 40 - i * 38;
      const p = new Path2D();
      p.ellipse(30, ty, 110, 22, 0, 0, Math.PI * 2);
      silhouette(g, p, shade(dark, 0.05 * i), rim, 0, -2, 0.22);
      g.strokeStyle = css(0x2a2420, 0.8);
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(30, ty - 4, 70, 10, 0, Math.PI, Math.PI * 2);
      g.stroke();
    }
    // jerry can + leaning broom bottom-right
    const jx = G.w - 70;
    const jc = new Path2D();
    jc.addPath(rrPath(jx, G.h - 70, 90, 110, 8));
    jc.rect(jx + 10, G.h - 84, 26, 16);
    silhouette(g, jc, 0x2a1210, rim, -2, -1, 0.3);
    g.strokeStyle = css(0x3a1a14, 0.9);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(jx + 10, G.h - 20);
    g.lineTo(jx + 80, G.h + 30);
    g.moveTo(jx + 80, G.h - 20);
    g.lineTo(jx + 10, G.h + 30);
    g.stroke();
    const br = new Path2D();
    br.moveTo(G.w + 60, G.h + 120);
    br.lineTo(G.w - 90, G.h - 260);
    br.lineTo(G.w - 82, G.h - 263);
    br.lineTo(G.w + 70, G.h + 116);
    br.closePath();
    silhouette(g, br, 0x1d150e, rim, -2, 0, 0.35);
  },
};

// ---------------------------------------------------------------------------
// Environment: Underground Workshop
// ---------------------------------------------------------------------------

const GLOW_GREEN = 0x7cf09a;

const underground: EnvDef = {
  theme: {
    soil: { top: 0x4a3a2c, mid: 0x3a2c22, deep: 0x1f1813, rock: 0x6d6a63, root: 0x2f2318 },
    grass: 0x5e6a35,
    sky: [0x5aaef0, 0xc4e8fb],
    concrete: 0x77736a,
    side: 0x4a443b,
    ceiling: 0x4c463e,
    veil: 0x2f2a24,
    veilAlpha: 0.3,
    key: 0xff9a48,
    shadow: 0x10261c,
    floor: { top: 0x5e4a37, face: 0x2c2119 },
  },
  backWall(P) {
    const { far: g, rng, G } = P;
    const x = G.bx0, y = G.by0, w = G.bx1 - G.bx0, h = G.by1 - G.by0;
    g.fillStyle = vGrad(g, y, G.by1, [[0, 0x3e3933], [0.5, 0x4a443c], [1, 0x38332d]]);
    g.fillRect(x, y, w, h);
    // embedded rock face
    // exposed rock, dense at the edges & bottom, sparse in the middle
    const n = (w * h) / 2600;
    for (let i = 0; i < n; i++) {
      const rx = rng.range(x - 20, x + w + 20), ry = rng.range(y - 10, G.by1 + 10);
      const ex = Math.abs(rx - G.w / 2) / (w / 2), ey = Math.abs(ry - (y + h * 0.42)) / (h / 2);
      if (Math.max(ex, ey) < rng.range(0.55, 1.05)) continue;
      rock(g, rng, rx, ry, rng.range(16, 46), jitter(rng, 0x534d46, 0.05));
    }
    // sprayed shotcrete over the middle (rough, low contrast)
    blob(g, G.w / 2, y + h * 0.42, w * 0.42, h * 0.42, 0x48423a, 0.92, 0.55);
    for (let i = 0; i < 14; i++) {
      blob(g, rng.range(x + w * 0.15, x + w * 0.85), rng.range(y + h * 0.1, y + h * 0.8), rng.range(60, 160), rng.range(40, 110), jitter(rng, 0x4a443c, 0.05), 0.5, 0.4);
    }
    texture(g, 'speckle', x, y, w, h, { alpha: 0.6, scale: 0.6 });
    texture(g, 'mottle', x, y, w, h, { alpha: 0.28, op: 'soft-light', scale: 0.9 });
    texture(g, 'speckle', x, y, w, h, { alpha: 0.5 });
    texture(g, 'grime', x, y, w, h, { alpha: 0.4, scale: 1.4 });
    streaks(g, rng, x, x + w, y + 30, 300, Math.round(w / 45), 0x16110c, 0.3);
    // damp seep with faint green
    for (let i = 0; i < 4; i++) stain(g, rng, rng.range(x, x + w), rng.range(y + 40, y + 160), rng.range(30, 60), 0x2e4a2c, 0.3, 1.6);
  },
  ceiling(P) {
    const { far: g, rng, G } = P;
    // hatch in the ceiling above the ladder
    const hx = G.bx1 - 112;
    const hy = (G.ceilY + G.by0) / 2 + 4;
    g.fillStyle = css(0x16120e);
    g.beginPath();
    g.ellipse(hx, hy, 36, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = css(0x6a645a);
    g.lineWidth = 3;
    g.stroke();
    blob(g, hx, hy, 30, 7, 0x5a6c88, 0.4);
    void rng;
  },
  floor(P) {
    const { far: g, rng, G } = P;
    floorPerspective(P, 0x3e3127, { cols: 4, rows: 1, line: 0x18120d, lineAlpha: 0.2 });
    // duckboards
    const boardsY0 = G.by1 + 8;
    for (let y = boardsY0; y < G.h; y += 13) {
      const t = (y - G.by1) / (G.h - G.by1);
      const x0 = G.bx0 * (1 - t) + 80 * t + G.w * 0.18;
      const x1 = G.bx1 * (1 - t) + G.w * t - G.w * 0.18 - 80 * t;
      g.fillStyle = css(0x120d09, 0.6);
      g.fillRect(x0, y + 8, x1 - x0, 3);
      g.fillStyle = vGrad(g, y, y + 9, [[0, 0x7a5e42], [1, 0x4e3a28]]);
      g.fillRect(x0, y, x1 - x0, 8 + t * 2);
    }
    texture(g, 'grime', 0, G.by1, G.w, G.h - G.by1, { alpha: 0.5 });
    blob(g, G.w * 0.2, G.h - 18, 90, 10, 0x6a7c90, 0.18);
    void rng;
  },
  props(P) {
    const { far: g, light, rng, G, amb } = P;
    const wood = 0x5f442d;
    // timber frame
    timber(g, rng, G.bx0 + 30, G.by0, 26, G.by1 - G.by0, wood);
    timber(g, rng, G.bx1 - 56, G.by0, 26, G.by1 - G.by0, wood);
    timber(g, rng, G.bx0, G.by0 + 6, G.bx1 - G.bx0, 24, shade(wood, 0.05));
    for (const bx of [G.bx0 + 43, G.bx1 - 43]) {
      g.fillStyle = css(0x2b2a28);
      g.fillRect(bx - 18, G.by0 + 4, 36, 30);
      rivet(g, bx - 10, G.by0 + 12, 2.2, 0x6a665e);
      rivet(g, bx + 10, G.by0 + 26, 2.2, 0x6a665e);
    }
    // conduit under the header, dropping on the left into a junction box
    const cy = G.by0 + 46;
    pipe(g, [[G.bx0 + 60, G.by1 - 300], [G.bx0 + 60, cy], [G.bx1 - 60, cy]], { color: 0x7a7c74, r: 5 });
    const jx = G.bx0 + 60, jy = G.by1 - 300;
    g.fillStyle = css(0x3c403c);
    g.fillRect(jx - 22, jy, 44, 54);
    bevel(g, jx - 22, jy, 44, 54, 0x9aa09a, 0x111111, 0.6, 1.5);
    hazard(g, rng, jx - 18, jy + 40, 36, 8, 0.8, 6);
    led(g, light, jx + 10, jy + 12, 0xff5a3a);
    amb.push({ kind: 'blink', x: jx + 10, y: jy + 12, color: 0xff5a3a, size: 2.4, period: 1.6, layer: 'far' });
    // hanging cable loops along the header
    const hooks: number[] = [];
    for (let hx = G.bx0 + 120; hx < G.bx1 - 100; hx += rng.range(150, 230)) hooks.push(hx);
    for (let i = 0; i < hooks.length - 1; i++) {
      const sag = rng.range(30, 70);
      cable(g, hooks[i], cy + 4, hooks[i + 1], cy + 4, sag, 3.5, i % 2 ? 0x2a2a2a : 0x6b3a22);
      if (i % 2 === 0) amb.push({ kind: 'sway', x: (hooks[i] + hooks[i + 1]) / 2, y: cy + 4 + sag / 2, size: 6, period: 6 + i, layer: 'far' });
    }
    // ladder up to the ceiling hatch on the right
    const lx = G.bx1 - 130;
    for (const rx of [lx, lx + 36]) {
      g.fillStyle = css(0x1a1612);
      g.fillRect(rx - 1, G.by0 - 6, 7, G.by1 - G.by0 + 6);
      g.fillStyle = hGrad(g, rx, rx + 5, [[0, 0x8a8478], [1, 0x4a463e]]);
      g.fillRect(rx, G.by0 - 6, 5, G.by1 - G.by0 + 6);
    }
    for (let ry = G.by1 - 24; ry > G.by0; ry -= 30) {
      g.fillStyle = css(0x2a2620);
      g.fillRect(lx + 5, ry + 1, 31, 4);
      g.fillStyle = css(0x7a7468);
      g.fillRect(lx + 5, ry, 31, 3);
    }
    // generator low right
    const gx = G.bx1 - 300, gw = 140, gh = 86;
    contactShadow(g, gx + gw / 2, G.by1, gw);
    g.fillStyle = css(0x1c1d16);
    g.fillRect(gx - 2, G.by1 - gh - 2, gw + 4, gh + 2);
    g.fillStyle = vGrad(g, G.by1 - gh, G.by1, [[0, 0x6a7148], [1, 0x3f4430]]);
    g.fillRect(gx, G.by1 - gh, gw, gh);
    g.fillStyle = css(0x1c1d16, 0.7);
    for (let vy = G.by1 - gh + 16; vy < G.by1 - 18; vy += 8) g.fillRect(gx + 14, vy, 50, 3);
    g.fillStyle = css(0x2b2b2b);
    g.fillRect(gx + gw - 30, G.by1 - gh - 28, 12, 30);
    gauge(g, rng, gx + 100, G.by1 - gh + 34, 14);
    cable(g, gx, G.by1 - 30, G.bx1 - 300 - 160, G.by1 + 4, 20, 4, 0x1c1c1c);
    // barrels & crates low left
    const lx0 = G.bx0 + 80;
    cylinder(g, lx0, G.by1, 54, 84, 0x4d5a3e, 0x9a8a5a);
    cylinder(g, lx0 + 58, G.by1, 54, 84, 0x6a3a2a, 0x9a8a5a);
    crateBox(g, rng, lx0 + 120, G.by1, 70, 50, 0x7a5a3a);
    crateBox(g, rng, lx0 + 130, G.by1 - 50, 50, 36, 0x6a5038);
    // bio-glow fungus in room corners
    fungus(g, light, rng, G.bx0 + 20, G.by1 - 4, 6, GLOW_GREEN, -1);
    fungus(g, light, rng, G.bx1 - 14, G.by0 + 40, 5, GLOW_GREEN, 1);
    fungus(g, light, rng, G.bx0 + 10, G.by0 + 46, 4, GLOW_GREEN, 1);
  },
  cheer(P) {
    const { far: g, rng, G } = P;
    // the hatch above the ladder is propped open: a disc of blue sky and a shaft of sun
    g.save();
    g.beginPath();
    g.ellipse(958, -24, 40, 14, 0, 0, Math.PI * 2);
    g.clip();
    skyPane(g, rng, 900, -50, 120, 60, { clouds: 1 });
    g.restore();
    sunbeam(P, 958, -16, 70, 190, G.by1 + 16, -40, 0.2);
    // a light well onto the yard, high on the wall
    sunnyWindow(P, 520, 104, 190, 120, { cols: 2, rows: 1, sun: [0.22, 0.3], clouds: 1, beam: 90 });
    bunting(g, 80, 44, 430, 52, 18);
    bunting(g, 700, 52, 905, 44, 12, [0x6cc87a, 0xf2c043, 0xe0603c, 0x4fa8e0]);
    doodle(g, rng, 548, 300, 70, 84, 'robot', -0.06);
    doodle(g, rng, 636, 316, 62, 56, 'rainbow', 0.05);
    flowerPot(g, rng, 840, 482, 24);
    bigPlant(g, rng, 330, G.by1, 140);
  },
  lights(P) {
    const { far: g, light, G, amb } = P;
    const orange = 0xff9a48;
    const len = Math.min(320, G.w * 0.2);
    const tx = G.w / 2 - len / 2, ty = G.by0 + 70;
    blob(g, G.w / 2, ty + 120, len * 1.4, 220, orange, 0.08);
    tubeLamp(g, light, tx, ty, len, orange, 1);
    lightCone(light, G.w / 2, ty + 6, len, len * 2.6, G.by1 - ty, orange, 0.06);
    amb.push({ kind: 'flicker', x: G.w / 2, y: ty + 3, w: len, h: 20, color: orange, period: 9, layer: 'far' });
    amb.push({ kind: 'dust', x: G.w / 2 - len * 0.8, y: ty + 20, w: len * 1.6, h: Math.min(420, G.h * 0.5), color: 0xffc890, layer: 'far' });
    cagedLamp(g, light, G.bx0 + 140, G.by0 + 120, 0xffc070, 0.6);
    amb.push({ kind: 'drip', x: G.bx1 - 14, y: G.by0 + 52, color: GLOW_GREEN, size: 2.2, period: 3.1, layer: 'far' });
    amb.push({ kind: 'drip', x: G.bx0 + 14, y: G.by0 + 56, color: GLOW_GREEN, size: 2, period: 4.3, layer: 'far' });
    amb.push({ kind: 'drip', x: G.w * 0.37, y: G.ceilY + 12, color: 0x9ab4b8, size: 1.8, period: 5.5, layer: 'far' });
  },
  soilExtras(P) {
    const { far: g, light, rng, G } = P;
    const X0 = -ENV_MARGIN.left, X1 = G.w + ENV_MARGIN.right;
    // bigger rocks / bedrock bottom
    for (let i = 0; i < (X1 - X0) / 90; i++) rock(g, rng, rng.range(X0, X1), rng.range(G.h + 120, G.h + 250), rng.range(20, 46), 0x5f5c56);
    for (let i = 0; i < 10; i++) rock(g, rng, rng.range(X0, -G.wallT - 20), rng.range(G.surfaceY + 40, G.h), rng.range(14, 34), 0x625e57);
    for (let i = 0; i < 10; i++) rock(g, rng, rng.range(G.w + G.wallT + 20, X1), rng.range(G.surfaceY + 40, G.h), rng.range(14, 34), 0x625e57);
    // drainage pipe and cables
    pipe(g, [[X0, G.h + 140], [X1, G.h + 140]], { color: 0x4e5654, r: 12, flangeEvery: 300 });
    cableBundle(g, rng, X0, G.surfaceY + 40, -G.wallT - 10, G.slabTop + 20, 60, [0x1a1a1a, 0x8a3a1e], 4);
    cableBundle(g, rng, G.w + G.wallT + 10, G.slabTop + 30, X1, G.surfaceY + 50, 50, [0x1a1a1a, 0x2a4a6a], 4);
    // bio-glow fungus in the soil
    const spots: [number, number, number][] = [
      [-120, G.h * 0.25, -1],
      [-170, G.h * 0.62, -1],
      [-80, G.h + 120, -1],
      [G.w + 120, G.h * 0.4, -1],
      [G.w + 160, G.h * 0.8, -1],
      [G.w * 0.3, G.surfaceY + 40, 1],
      [G.w * 0.72, G.surfaceY + 36, 1],
      [G.w * 0.5, G.h + 200, -1],
    ];
    for (const [fx, fy, d] of spots) fungus(g, light, rng, fx, fy, rng.int(4, 7), GLOW_GREEN, d);
  },
  near(P) {
    const { near: g, rng, G, amb } = P;
    const dark = 0x100d0a;
    // dangling roots top-left
    g.save();
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x = rng.range(-200, 180);
      g.strokeStyle = css(dark);
      g.lineWidth = rng.range(2, 6);
      g.beginPath();
      g.moveTo(x, -200);
      g.bezierCurveTo(x + rng.range(-30, 30), -100, x + rng.range(-40, 40), 0, x + rng.range(-30, 30), rng.range(20, 110));
      g.stroke();
    }
    g.restore();
    amb.push({ kind: 'sway', x: 80, y: 60, size: 10, period: 7, layer: 'near' });
    // rock outcrop bottom-left
    const rp = new Path2D();
    rp.moveTo(-230, G.h + 270);
    rp.lineTo(-230, G.h - 20);
    rp.lineTo(-150, G.h - 70);
    rp.lineTo(-60, G.h - 40);
    rp.lineTo(10, G.h + 10);
    rp.lineTo(80, G.h + 60);
    rp.lineTo(100, G.h + 270);
    rp.closePath();
    silhouette(g, rp, 0x17130f, 0x8a7a68, -2, -3, 0.35);
    // hanging cable bundle top-right
    for (let i = 0; i < 3; i++) cable(g, G.w - 200 + i * 10, -210, G.w + 230, -10 + i * 14, 150 + i * 20, 7, dark, 0.15);
    // glowing mushrooms bottom-right on a stump
    const sp = new Path2D();
    sp.addPath(rrPath(G.w + 10, G.h - 10, 260, 300, 30));
    silhouette(g, sp, 0x1a140f, 0x7cf09a, -2, -2, 0.25);
    fungus(g, P.light, rng, G.w + 50, G.h - 10, 5, GLOW_GREEN, -1);
  },
};

// ---------------------------------------------------------------------------
// Environment: Greenhouse Laboratory
// ---------------------------------------------------------------------------

const MAGENTA = 0xe46ad0;
const LEAF = [0x4d7a3a, 0x5f8d43, 0x3d6533, 0x739a4c];

const greenhouse: EnvDef = {
  theme: {
    soil: { top: 0x51402c, mid: 0x433426, deep: 0x2a2019, rock: 0x77705f, root: 0x3a2c1d },
    grass: 0x7a8a3f,
    sky: [0x5aaef0, 0xc4e8fb],
    concrete: 0x8a857a,
    side: 0x50574a,
    ceiling: 0x2e3a48,
    veil: 0x363a48,
    veilAlpha: 0.22,
    key: 0xe08ac0,
    shadow: 0x1a2440,
    floor: { top: 0x7a5946, face: 0x3e2c22 },
  },
  backWall(P) {
    const { far: g, rng, G } = P;
    const x = G.bx0, y = G.by0, w = G.bx1 - G.bx0;
    const knee = G.by1 - 150;
    // a bright summer sky through the glass, sun high on the right, fluffy clouds
    skyPane(g, rng, x, y, w, knee - y, { sun: [0.82, 0.18], clouds: 4, top: 0x4aa6ee, bottom: 0xd6f0fb });
    // distant tree line & hills
    g.fillStyle = css(0x7cc06a, 0.95);
    g.beginPath();
    g.moveTo(x, knee);
    for (let hx = x; hx <= x + w; hx += 30) g.lineTo(hx, knee - 50 - Math.sin(hx * 0.004) * 26);
    g.lineTo(x + w, knee);
    g.closePath();
    g.fill();
    g.fillStyle = css(0x4f9a4a);
    for (let tx = x; tx < x + w; tx += rng.range(14, 36)) {
      const th = rng.range(16, 60);
      g.beginPath();
      g.moveTo(tx - 9, knee);
      g.lineTo(tx, knee - th);
      g.lineTo(tx + 9, knee);
      g.closePath();
      g.fill();
    }
    // condensation & reflections
    g.fillStyle = vGrad(g, y, knee, [[0, 0xdfe8f0, 0.04], [0.7, 0xdfe8f0, 0.08], [1, 0xdfe8f0, 0.2]]);
    g.fillRect(x, y, w, knee - y);
    texture(g, 'mottle', x, y, w, knee - y, { alpha: 0.4, op: 'soft-light', scale: 0.7 });
    streaks(g, rng, x, x + w, knee - 160, 150, Math.round(w / 25), 0xcfe0e8, 0.08);
    // mullions
    const mull = 0x33423a;
    const n = Math.max(3, Math.round(w / 170));
    for (let i = 0; i <= n; i++) {
      const mx = x + (i / n) * w;
      g.fillStyle = css(shade(mull, -0.6), 0.85);
      g.fillRect(mx - 5, y, 10, knee - y);
      g.fillStyle = hGrad(g, mx - 4, mx + 4, [[0, shade(mull, 0.15)], [1, shade(mull, -0.3)]]);
      g.fillRect(mx - 4, y, 8, knee - y);
    }
    for (const t of [0.3, 0.72]) {
      const my = y + (knee - y) * t;
      g.fillStyle = css(shade(mull, -0.4), 0.75);
      g.fillRect(x, my - 3, w, 6);
    }
    // one cracked pane, taped
    const cpx = x + w * 0.17, cpy = y + 40;
    crack(g, rng, cpx, cpy, 60, 0xdfe8f0, 0.35);
    g.fillStyle = css(0xd8c890, 0.35);
    g.save();
    g.translate(cpx, cpy);
    g.rotate(0.7);
    g.fillRect(-26, -4, 52, 8);
    g.rotate(-1.4);
    g.fillRect(-26, -4, 52, 8);
    g.restore();
    // knee wall + sill
    bricks(g, rng, x, knee, w, G.by1 - knee, 0x6a4334, 0x33281f, 42, 17);
    g.fillStyle = vGrad(g, knee - 12, knee + 2, [[0, 0x9a948a], [1, 0x5a564f]]);
    g.fillRect(x, knee - 12, w, 14);
    g.fillStyle = css(0x000000, 0.3);
    g.fillRect(x, knee + 2, w, 6);
    texture(g, 'grime', x, knee, w, G.by1 - knee, { alpha: 0.4 });
  },
  ceiling(P) {
    const { far: g, G } = P;
    // glazed roof
    g.fillStyle = vGrad(g, G.ceilY, G.by0, [[0, 0x1c2236], [1, 0x2e3650]]);
    g.fillRect(0, G.ceilY, G.w, G.by0 - G.ceilY);
    const n = Math.round(G.w / 170);
    g.strokeStyle = css(0x2a352f);
    g.lineWidth = 6;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      g.moveTo((i / n) * G.w, G.ceilY);
      g.lineTo(G.bx0 + (i / n) * (G.bx1 - G.bx0), G.by0);
    }
    g.stroke();
  },
  sideWalls(P) {
    const { far: g, rng, G } = P;
    // coiled green hose on the left wall
    const hx = G.bx0 * 0.5, hy = G.h * 0.48;
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = css(shade(0x3e6e3a, -0.6));
      g.lineWidth = 6;
      g.beginPath();
      g.ellipse(hx + i * 1.5, hy + i, 20, 36, 0, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = css(jitter(rng, 0x4a7e42, 0.06));
      g.lineWidth = 4;
      g.stroke();
    }
    cable(g, hx + 10, hy + 36, G.bx0 + 30, G.by1 + 10, 40, 5, 0x4a7e42);
  },
  floor(P) {
    const { far: g, rng, G } = P;
    floorPerspective(P, 0x6e4e3c, { cols: 12, rows: 3, line: 0x2a1c14, lineAlpha: 0.5, checker: 0x5e4232 });
    // wet sheen & puddles
    for (let i = 0; i < 5; i++) blob(g, rng.range(G.w * 0.1, G.w * 0.9), rng.range(G.by1 + 14, G.h - 8), rng.range(40, 110), rng.range(5, 10), 0x9ab0c0, 0.15);
    // drain grate
    g.fillStyle = css(0x1e1a16);
    g.fillRect(G.w * 0.46, G.by1 + 24, 60, 12);
    g.fillStyle = css(0x5a5650);
    for (let i = 0; i < 6; i++) g.fillRect(G.w * 0.46 + 4 + i * 9, G.by1 + 26, 4, 8);
  },
  props(P) {
    const { far: g, light, rng, G, amb } = P;
    const rackW = Math.min(300, G.w * 0.19);
    const racks: number[] = [G.bx0 + 18, G.bx1 - 18 - rackW];
    racks.forEach((rx, ri) => {
      const tiers = [G.by1 - 30, G.by1 - 170, G.by1 - 310];
      contactShadow(g, rx + rackW / 2, G.by1, rackW);
      for (const ux of [rx, rx + rackW - 6]) {
        g.fillStyle = css(0x1e2320);
        g.fillRect(ux - 1, tiers[2] - 130, 8, G.by1 - tiers[2] + 130);
        g.fillStyle = hGrad(g, ux, ux + 6, [[0, 0x8a948e], [1, 0x4a524e]]);
        g.fillRect(ux, tiers[2] - 130, 6, G.by1 - tiers[2] + 130);
      }
      tiers.forEach((ty, ti) => {
        // grow light above tier
        const lampY = ty - 110;
        const col = (ti + ri) % 2 ? 0xf2dcff : MAGENTA;
        // plants
        let px = rx + 26;
        while (px < rx + rackW - 22) {
          const pw = rng.range(24, 34);
          pottedPlant(g, rng, px, ty, pw, LEAF, jitter(rng, 0xa65a3a, 0.08));
          px += pw + rng.range(10, 20);
        }
        // shelf
        g.fillStyle = css(0x1e2320);
        g.fillRect(rx - 2, ty - 1, rackW + 4, 8);
        g.fillStyle = vGrad(g, ty, ty + 6, [[0, 0x9aa49e], [1, 0x5a625e]]);
        g.fillRect(rx, ty, rackW, 6);
        tubeLamp(g, light, rx + 14, lampY, rackW - 28, col, 0.75);
        lightCone(light, rx + rackW / 2, lampY + 4, rackW - 28, rackW + 20, 104, col, 0.16);
        if (ri === 1 && ti === 1) amb.push({ kind: 'flicker', x: rx + rackW / 2, y: lampY + 3, w: rackW - 28, h: 14, color: col, period: 8, layer: 'far' });
      });
      // timer box with LED
      if (ri === 0) {
        const bx = rx + rackW + 8, by = G.by1 - 230;
        g.fillStyle = css(0xbdb8a8);
        g.fillRect(bx, by, 28, 38);
        bevel(g, bx, by, 28, 38, 0xffffff, 0x333333, 0.4, 1);
        led(g, light, bx + 14, by + 10, 0x6aff8a, true, 2);
        amb.push({ kind: 'blink', x: bx + 14, y: by + 10, color: 0x6aff8a, size: 2, period: 3, layer: 'far' });
        cable(g, bx + 14, by + 38, rx + rackW - 10, G.by1 - 300, 30, 2, 0x1d1d1d);
      }
    });
    // planter trough along the knee wall
    const tx0 = G.w * 0.33, tx1 = G.w * 0.67;
    const tTop = G.by1 - 46;
    leafCluster(g, rng, (tx0 + tx1) / 2, tTop, 40, LEAF, 4);
    for (let lx = tx0 + 16; lx < tx1 - 10; lx += rng.range(18, 30)) leafCluster(g, rng, lx, tTop + 4, rng.range(18, 34), LEAF, rng.int(5, 9), -Math.PI * 0.95, -Math.PI * 0.05);
    contactShadow(g, (tx0 + tx1) / 2, G.by1, tx1 - tx0);
    g.fillStyle = css(0x24180f);
    g.fillRect(tx0 - 2, tTop - 2, tx1 - tx0 + 4, 48);
    g.fillStyle = vGrad(g, tTop, G.by1, [[0, 0x7a5a3c], [1, 0x4a3422]]);
    g.fillRect(tx0, tTop, tx1 - tx0, 46);
    g.fillStyle = css(0x000000, 0.25);
    for (let bx = tx0 + 60; bx < tx1; bx += 60) g.fillRect(bx, tTop, 2, 46);
    stencil(g, 'TRIAL 7B', tx0 + 14, tTop + 24, 12, 0xe8dcc0, 0.4);
    // humidifier with steam (right end of trough)
    const hx = tx1 + 30;
    g.fillStyle = css(0x1c1c1c);
    g.fillRect(hx - 1, G.by1 - 61, 46, 61);
    g.fillStyle = vGrad(g, G.by1 - 60, G.by1, [[0, 0xd0d4cc], [1, 0x8a8e88]]);
    g.fillRect(hx, G.by1 - 60, 44, 60);
    g.fillStyle = css(0x4a7a9a, 0.6);
    g.fillRect(hx + 8, G.by1 - 44, 28, 20);
    amb.push({ kind: 'steam', x: hx + 22, y: G.by1 - 62, size: 16, period: 3.5, color: 0xe8eef0, layer: 'far' });
    // hose along the floor line
    cable(g, G.bx0 + 30, G.by1 + 10, tx0 + 10, G.by1 + 4, 14, 5, 0x4a7e42);
    // hanging baskets
    [G.w * 0.33, G.w * 0.67].forEach((bx, i) => {
      const by = 112 + i * 18;
      g.strokeStyle = css(0x2a2a26);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(bx, G.ceilY + 10);
      g.lineTo(bx - 16, by);
      g.moveTo(bx, G.ceilY + 10);
      g.lineTo(bx + 16, by);
      g.stroke();
      // trailing vines
      g.lineCap = 'round';
      for (let v = 0; v < 4; v++) {
        const vx = bx + rng.range(-16, 16);
        const vl = rng.range(50, 110);
        g.strokeStyle = css(0x3a5a30);
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(vx, by + 6);
        g.quadraticCurveTo(vx + rng.range(-12, 12), by + vl * 0.6, vx + rng.range(-8, 8), by + vl);
        g.stroke();
        for (let ly = by + 14; ly < by + vl; ly += 12) leafCluster(g, rng, vx + rng.range(-6, 6), ly, 8, LEAF, 2, 0, Math.PI);
      }
      leafCluster(g, rng, bx, by - 2, 30, LEAF, 12, -Math.PI, 0);
      pottedPlant(g, rng, bx, by + 18, 34, LEAF, 0x8a5a3a);
      amb.push({ kind: 'sway', x: bx, y: by, size: 14, period: 6 + i * 1.5, layer: 'far' });
    });
  },
  cheer(P) {
    const { far: g, rng } = P;
    bunting(g, 60, 70, 1060, 70, 24);
    doodle(g, rng, 500, 300, 64, 78, 'sun', -0.04);
  },
  lights(P) {
    const { light, G, amb } = P;
    // humid haze
    blob(light, G.w * 0.5, G.h * 0.7, G.w * 0.6, G.h * 0.35, 0xc8b8d8, 0.05);
    blob(light, G.w * 0.62, G.by1 - 160, G.w * 0.4, 120, 0xd89a72, 0.08);
    amb.push({ kind: 'dust', x: G.w * 0.25, y: G.h * 0.15, w: G.w * 0.5, h: G.h * 0.55, color: 0xf0e6c8, layer: 'far' });
    amb.push({ kind: 'drip', x: G.bx0 + (G.bx1 - G.bx0) * 0.25, y: G.by0 + 20, color: 0xcfe6f0, size: 1.8, period: 4.4, layer: 'far' });
    amb.push({ kind: 'drip', x: G.bx0 + (G.bx1 - G.bx0) * 0.78, y: G.by0 + 26, color: 0xcfe6f0, size: 1.8, period: 5.6, layer: 'far' });
  },
  soilExtras(P) {
    const { far: g, rng, G } = P;
    const X0 = -ENV_MARGIN.left, X1 = G.w + ENV_MARGIN.right;
    // irrigation line & water tank pipe in soil
    pipe(g, [[X0, G.h + 120], [X1, G.h + 120]], { color: 0x3e5a6a, r: 9, flangeEvery: 240 });
    pipe(g, [[X1, G.h * 0.3], [G.w + G.wallT + 40, G.h * 0.3], [G.w + G.wallT + 40, G.h + 120]], { color: 0x3e5a6a, r: 9 });
    // big tree roots coming down from the surface
    for (let i = 0; i < 6; i++) roots(g, rng, rng.range(X0, X1), G.surfaceY + 4, rng.range(120, 200), rng.range(4, 7), shade(P.T.soil.root, 0.1), 4);
  },
  near(P) {
    const { near: g, rng, G, amb } = P;
    const dark = [0x14200f, 0x1a2a14, 0x10180c];
    // big leaves bottom-left & bottom-right
    leafCluster(g, rng, -60, G.h + 120, 260, dark, 9, -Math.PI * 0.6, -Math.PI * 0.05);
    leafCluster(g, rng, G.w + 60, G.h + 130, 260, dark, 9, -Math.PI * 0.95, -Math.PI * 0.4);
    // hanging vine top-left
    g.lineCap = 'round';
    for (let v = 0; v < 3; v++) {
      const vx = 40 + v * 50;
      const vl = rng.range(160, 300);
      g.strokeStyle = css(0x0f160b);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(vx, -200);
      g.quadraticCurveTo(vx + 20, -200 + vl * 0.6, vx - 10, -200 + vl);
      g.stroke();
      for (let ly = -180; ly < -200 + vl; ly += 26) leafCluster(g, rng, vx + rng.range(-10, 10), ly, 26, dark, 2, 0, Math.PI);
    }
    amb.push({ kind: 'sway', x: 90, y: 40, size: 16, period: 7, layer: 'near' });
    // glazing bar corner top-right
    const gb = new Path2D();
    gb.rect(G.w + 40, -200, 26, 310);
    gb.rect(G.w - 120, 20, 360, 22);
    silhouette(g, gb, 0x151c18, 0xd89a72, -2, -2, 0.3);
  },
};

// ---------------------------------------------------------------------------
// Environment: Maintenance Room
// ---------------------------------------------------------------------------

const maintenance: EnvDef = {
  theme: {
    soil: { top: 0x4f3e2e, mid: 0x403227, deep: 0x251c16, rock: 0x6e6c66, root: 0x34271b },
    grass: 0x66733a,
    sky: [0x5aaef0, 0xc4e8fb],
    concrete: 0x7f8282,
    side: 0x43524f,
    ceiling: 0x4b5050,
    veil: 0x2c3736,
    veilAlpha: 0.38,
    key: 0xffc070,
    shadow: 0x10202a,
    floor: { top: 0x5a5f60, face: 0x2b2f31 },
  },
  backWall(P) {
    const { far: g, rng, G } = P;
    const x = G.bx0, y = G.by0, w = G.bx1 - G.bx0;
    const split = G.by1 - 190;
    const upper = 0x4a5e5f, lower = 0x394846;
    const pw = (w) / Math.max(4, Math.round(w / 170));
    for (let py = y; py < split; py += 124) {
      const ph = Math.min(124, split - py);
      for (let px = x; px < x + w - 1; px += pw) metalPanel(g, rng, px, py, pw, ph, upper);
    }
    for (let px = x; px < x + w - 1; px += pw) metalPanel(g, rng, px, split, pw, G.by1 - split, lower);
    texture(g, 'mottle', x, y, w, G.by1 - y, { alpha: 0.28, op: 'soft-light', scale: 1.1 });
    texture(g, 'grime', x, y, w, G.by1 - y, { alpha: 0.4, scale: 1.3 });
    for (let py = y + 124; py < split; py += 124) streaks(g, rng, x, x + w, py, 90, Math.round(w / 60), 0x5a3a24, 0.25);
    streaks(g, rng, x, x + w, split + 8, 120, Math.round(w / 50), 0x1a1612, 0.25);
    // painted stripe + hazard kick strip
    g.fillStyle = css(0x8a7536, 0.85);
    g.fillRect(x, split - 5, w, 10);
    hazard(g, rng, x, G.by1 - 26, w, 26, 0.75, 16);
    stencil(g, 'B-2', x + 40, y + 190, 64, 0xd0d6cc, 0.12);
    stencil(g, 'AUTHORIZED PERSONNEL ONLY', x + w * 0.5, split - 26, 14, 0xd0d6cc, 0.2, 'center');
  },
  floor(P) {
    const { far: g, rng, G } = P;
    floorPerspective(P, 0x4c5153, { cols: 8, rows: 2, line: 0x1c1f20, lineAlpha: 0.45 });
    // diamond plate tread
    g.save();
    for (let y = G.by1 + 6; y < G.h; y += 8) {
      const t = (y - G.by1) / (G.h - G.by1);
      const step = 10 + t * 6;
      for (let x = (y / 8) % 2 ? 0 : step / 2; x < G.w; x += step) {
        g.fillStyle = css(0xb0b6b8, 0.12 + t * 0.06);
        g.fillRect(x, y, 4 + t * 2, 1.4);
      }
    }
    g.restore();
    for (let i = 0; i < 4; i++) stain(g, rng, rng.range(G.bx0, G.bx1), rng.range(G.by1 + 10, G.h - 6), rng.range(20, 50), 0x3a2a1a, 0.3, 0.3);
  },
  props(P) {
    const { far: g, light, rng, G, amb } = P;
    const big = 0x7a4c3c, steel = 0x5d6a6c;
    // big pipes across the top
    pipe(g, [[0, 40], [G.w, 40]], { color: big, r: 21, flangeEvery: 220 });
    pipe(g, [[G.bx0 + 56, G.by1 + 6], [G.bx0 + 56, 96], [G.w, 96]], { color: steel, r: 13, flangeEvery: 200 });
    pipe(g, [[G.bx1 - 34, G.ceilY], [G.bx1 - 34, G.by1 - 160], [G.bx1 - 74, G.by1 - 160], [G.bx1 - 74, G.by1 + 4]], { color: 0x8a8a7a, r: 7 });
    streaks(g, rng, G.bx0, G.bx1, 62, 90, Math.round(G.w / 80), 0x4a2a1a, 0.25);
    // valve + gauges on the vertical steel pipe
    const vx = G.bx0 + 56;
    valveWheel(g, vx + 28, G.h * 0.52, 18);
    g.fillStyle = css(0x3a3a36);
    g.fillRect(vx + 12, G.h * 0.52 - 5, 16, 10);
    gauge(g, rng, vx + 40, G.h * 0.36, 17);
    g.fillStyle = css(0x3a3a36);
    g.fillRect(vx + 12, G.h * 0.36 - 3, 12, 6);
    valveWheel(g, G.w * 0.24, 40, 15, 0xb0402e);
    gauge(g, rng, G.w * 0.76, 72, 14);
    // steam vent stub
    const sx = vx + 13, sy = G.by1 - 120;
    pipe(g, [[sx, sy], [sx + 40, sy]], { color: steel, r: 6 });
    flange(g, sx + 40, sy, true, 6, steel);
    amb.push({ kind: 'steam', x: sx + 46, y: sy, size: 14, period: 4, color: 0xdfe6e6, layer: 'far' });
    amb.push({ kind: 'drip', x: G.w * 0.46, y: 62, color: 0xa8b8b0, size: 2, period: 3.8, layer: 'far' });
    // breaker panel
    const bw = 170, bh = 230;
    const bx = G.bx1 - 290, by = Math.max(150, G.h * 0.3);
    g.fillStyle = css(0x16191a);
    g.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    g.fillStyle = vGrad(g, by, by + bh, [[0, 0x6e7674], [1, 0x4a5250]]);
    g.fillRect(bx, by, bw, bh);
    g.fillStyle = css(0x22282a);
    g.fillRect(bx + 12, by + 30, bw - 24, bh - 44);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        const ex = bx + 22 + c * 30, ey = by + 40 + r * 28;
        g.fillStyle = css(0x111314);
        g.fillRect(ex, ey, 18, 20);
        g.fillStyle = css(rng.chance(0.15) ? 0x8a2a20 : 0x3a3e40);
        g.fillRect(ex + 5, ey + (rng.chance(0.5) ? 3 : 10), 8, 7);
      }
    }
    // open door
    g.fillStyle = css(0x3e4644);
    g.beginPath();
    g.moveTo(bx + bw, by);
    g.lineTo(bx + bw + 44, by + 18);
    g.lineTo(bx + bw + 44, by + bh - 10);
    g.lineTo(bx + bw, by + bh);
    g.closePath();
    g.fill();
    g.fillStyle = css(0xd8d0b0, 0.35);
    g.fillRect(bx + bw + 12, by + 50, 22, 30);
    stencil(g, 'MAIN', bx + 12, by + 16, 14, 0xe8e0c8, 0.55);
    // warning triangle above
    const wx = bx + bw / 2, wy = by - 40;
    g.fillStyle = css(0x1a1a1a);
    g.beginPath();
    g.moveTo(wx, wy - 26);
    g.lineTo(wx + 28, wy + 22);
    g.lineTo(wx - 28, wy + 22);
    g.closePath();
    g.fill();
    g.fillStyle = css(0xd2a83a);
    g.beginPath();
    g.moveTo(wx, wy - 20);
    g.lineTo(wx + 22, wy + 18);
    g.lineTo(wx - 22, wy + 18);
    g.closePath();
    g.fill();
    g.fillStyle = css(0x1a1a1a);
    g.beginPath();
    g.moveTo(wx + 3, wy - 8);
    g.lineTo(wx - 6, wy + 5);
    g.lineTo(wx, wy + 5);
    g.lineTo(wx - 4, wy + 15);
    g.lineTo(wx + 7, wy);
    g.lineTo(wx + 1, wy);
    g.closePath();
    g.fill();
    // conduits up from the panel
    pipe(g, [[bx + 30, by], [bx + 30, G.ceilY]], { color: 0x7a7e78, r: 5 });
    pipe(g, [[bx + 60, by], [bx + 60, G.ceilY]], { color: 0x7a7e78, r: 5 });
    // LED column
    const leds: [number, number][] = [[0x5af07a, 1.1], [0xff5a3a, 0.7], [0xffb43a, 2.3]];
    leds.forEach(([c, period], i) => {
      const lx = bx + bw - 14, ly = by + 44 + i * 18;
      led(g, light, lx, ly, c);
      amb.push({ kind: 'blink', x: lx, y: ly, color: c, size: 2.4, period, layer: 'far' });
    });
    // vent fan top right
    const fx = G.bx1 - 110, fy = 190;
    ventGrille(g, fx, fy, 34, 0x6a7472);
    amb.push({ kind: 'fan', x: fx, y: fy, size: 32, period: 0.9, color: 0x2a2f30, layer: 'far' });
    // gas cylinders chained to the wall, low left
    const cx = G.bx0 + 110;
    cylinder(g, cx, G.by1, 40, 150, 0x4f5f4a);
    cylinder(g, cx + 46, G.by1, 40, 140, 0x7a3b30);
    g.strokeStyle = css(0x2a2a2a);
    g.lineWidth = 3;
    g.setLineDash([5, 3]);
    g.beginPath();
    g.moveTo(cx - 6, G.by1 - 100);
    g.lineTo(cx + 92, G.by1 - 100);
    g.stroke();
    g.setLineDash([]);
    // crates low right
    crateBox(g, rng, G.bx1 - 420, G.by1, 80, 56, 0x5a6250, false);
    crateBox(g, rng, G.bx1 - 334, G.by1, 60, 40, 0x6a5a42);
    // toolbox cart low centre-left
    const tx = G.w * 0.36;
    contactShadow(g, tx + 50, G.by1, 110);
    g.fillStyle = css(0x1a1010);
    g.fillRect(tx - 2, G.by1 - 92, 104, 84);
    g.fillStyle = vGrad(g, G.by1 - 90, G.by1 - 10, [[0, 0x9a3a2c], [1, 0x5a2018]]);
    g.fillRect(tx, G.by1 - 90, 100, 80);
    for (let d = 0; d < 4; d++) {
      g.fillStyle = css(0x2a0e0a, 0.7);
      g.fillRect(tx + 6, G.by1 - 84 + d * 19, 88, 2);
      g.fillStyle = css(0xb8b0a0, 0.6);
      g.fillRect(tx + 40, G.by1 - 78 + d * 19, 20, 3);
    }
    for (const wx2 of [tx + 12, tx + 88]) {
      g.fillStyle = css(0x111111);
      g.beginPath();
      g.arc(wx2, G.by1 - 6, 6, 0, Math.PI * 2);
      g.fill();
    }
  },
  cheer(P) {
    const { far: g, rng, G } = P;
    // two high windows onto a blue sky between the wall lamps
    sunnyWindow(P, 300, 172, 160, 120, { cols: 2, rows: 2, sun: [0.75, 0.3], clouds: 1, beam: 120 });
    sunnyWindow(P, 540, 172, 160, 120, { cols: 2, rows: 2, clouds: 2, beam: 120 });
    bunting(g, 60, 104, 780, 104, 14);
    doodle(g, rng, 296, 340, 62, 72, 'cat', -0.06);
    doodle(g, rng, 690, 330, 66, 80, 'machine', 0.05);
    flowerPot(g, rng, 452, 482, 24);
    bigPlant(g, rng, 590, G.by1, 130);
  },
  lights(P) {
    const { far: g, light, G, amb } = P;
    const amber = 0xffc070;
    cagedLamp(g, light, G.bx0 + 200, 150, amber, 0.9);
    cagedLamp(g, light, G.w * 0.6, 150, amber, 0.9);
    const len = Math.min(240, G.w * 0.15);
    tubeLamp(g, light, G.w * 0.38 - len / 2, 128, len, 0xdfe8e0, 0.6);
    amb.push({ kind: 'flicker', x: G.w * 0.38, y: 131, w: len, h: 16, color: 0xdfe8e0, period: 11, layer: 'far' });
    amb.push({ kind: 'dust', x: G.w * 0.25, y: 130, w: G.w * 0.5, h: Math.min(400, G.h * 0.45), color: 0xe8dcc0, layer: 'far' });
  },
  soilExtras(P) {
    const { far: g, rng, G } = P;
    const X0 = -ENV_MARGIN.left, X1 = G.w + ENV_MARGIN.right;
    pipe(g, [[X0, G.h + 130], [X1, G.h + 130]], { color: 0x6a4a3a, r: 22, flangeEvery: 260 });
    pipe(g, [[X0, G.h + 200], [X1, G.h + 200]], { color: 0x4e5a5c, r: 11, flangeEvery: 220 });
    pipe(g, [[X0, 40], [0, 40]], { color: 0x7a4c3c, r: 21 });
    pipe(g, [[G.w, 40], [X1, 40]], { color: 0x7a4c3c, r: 21 });
    pipe(g, [[G.w, 96], [X1, 96]], { color: 0x5d6a6c, r: 13 });
    cableBundle(g, rng, X0, G.h * 0.7, -G.wallT - 10, G.h * 0.55, 40, [0x1a1a1a, 0xa04a1e, 0x1a1a1a], 4);
    cableBundle(g, rng, G.w + G.wallT + 10, G.h * 0.62, X1, G.h * 0.8, 40, [0x1a1a1a, 0x2a2a2a], 5);
  },
  near(P) {
    const { near: g, rng, G, amb } = P;
    const dark = 0x14181a, rim = 0xffc070;
    // big elbow pipe top-left
    pipe(g, [[110, -230], [110, -10], [-240, -10]], { color: 0x262a2c, r: 28 });
    flange(g, 110, -60, false, 28, 0x262a2c);
    // pipe stub with valve bottom-right
    pipe(g, [[G.w + 240, G.h - 40], [G.w - 110, G.h - 40], [G.w - 110, G.h + 270]], { color: 0x26292b, r: 22 });
    valveWheel(g, G.w - 40, G.h - 76, 22, 0x5a1c14);
    // chain hanging top-right
    g.strokeStyle = css(dark);
    g.lineWidth = 3;
    for (let cy = -200; cy < 100; cy += 12) {
      g.beginPath();
      g.ellipse(G.w - 90, cy, 4, 7, 0, 0, Math.PI * 2);
      g.stroke();
    }
    amb.push({ kind: 'sway', x: G.w - 90, y: 100, size: 6, period: 5, layer: 'near' });
    // traffic cone bottom-left
    const cone = new Path2D();
    cone.moveTo(10, G.h + 20);
    cone.lineTo(50, G.h - 110);
    cone.lineTo(70, G.h - 110);
    cone.lineTo(110, G.h + 20);
    cone.closePath();
    cone.rect(-10, G.h + 14, 140, 14);
    silhouette(g, cone, 0x2a140c, rim, -2, -1, 0.35);
    g.fillStyle = css(0x6a6a5a, 0.5);
    g.fillRect(36, G.h - 60, 48, 12);
    void rng;
  },
};

// ---------------------------------------------------------------------------
// Environment: Strange Domestic Basement
// ---------------------------------------------------------------------------

const MOON = 0x9ab8ff;

const basement: EnvDef = {
  theme: {
    soil: { top: 0x4c3b2d, mid: 0x3e3026, deep: 0x231b15, rock: 0x726c62, root: 0x33261b },
    grass: 0x55663a,
    sky: [0x5aaef0, 0xc4e8fb],
    concrete: 0x7d776d,
    side: 0x4f4b3e,
    ceiling: 0x4e4a40,
    veil: 0x35322a,
    veilAlpha: 0.3,
    key: 0xffb860,
    shadow: 0x141c34,
    floor: { top: 0x645b4d, face: 0x342e27 },
  },
  backWall(P) {
    const { far: g, rng, G } = P;
    const x = G.bx0, y = G.by0, w = G.bx1 - G.bx0, h = G.by1 - G.by0;
    bricks(g, rng, x, y, w, h, 0x6a4232, 0x3a2e28, 46, 19);
    texture(g, 'grime', x, y, w, h, { alpha: 0.35 });
    // wallpaper with peel holes
    const holes: Path2D[] = [];
    const holeSpecs: [number, number, number][] = [
      [x + 140, y + 120, 90],
      [x + w * 0.55, G.by1 - 120, 110],
      [x + w - 170, y + h * 0.42, 80],
      [x + w * 0.3, G.by1 - 70, 60],
      [x + w * 0.78, y + 60, 50],
    ];
    for (const [hx, hy, hr] of holeSpecs) {
      const pts: [number, number][] = [];
      const n = 11;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = hr * rng.range(0.55, 1.15);
        pts.push([hx + Math.cos(a) * rr * 1.2, hy + Math.sin(a) * rr * 0.75]);
      }
      holes.push(poly(pts));
    }
    const paper = new Path2D();
    paper.rect(x, y, w, h);
    holes.forEach((hp) => paper.addPath(hp));
    g.save();
    g.clip(paper, 'evenodd');
    const base = 0x5c5a45;
    g.fillStyle = css(base);
    g.fillRect(x, y, w, h);
    for (let sx = x; sx < x + w; sx += 52) {
      g.fillStyle = css(0x66634c, 0.8);
      g.fillRect(sx, y, 22, h);
      g.fillStyle = css(0x4e4c3a, 0.6);
      g.fillRect(sx + 22, y, 2, h);
    }
    // damask-ish motif
    g.fillStyle = css(0x7c7658, 0.45);
    for (let my = y + 20; my < y + h; my += 64) {
      for (let mx = x + 37 + ((my / 64) % 2 ? 26 : 0); mx < x + w; mx += 52) {
        g.beginPath();
        g.moveTo(mx, my - 9);
        g.quadraticCurveTo(mx + 7, my, mx, my + 9);
        g.quadraticCurveTo(mx - 7, my, mx, my - 9);
        g.fill();
        g.fillRect(mx - 1, my + 9, 2, 5);
      }
    }
    texture(g, 'mottle', x, y, w, h, { alpha: 0.28, op: 'soft-light', scale: 1.2 });
    // water stains
    for (let i = 0; i < 5; i++) {
      const sx = rng.range(x, x + w), sy = y + rng.range(10, 120);
      stain(g, rng, sx, sy, rng.range(40, 80), 0x4a3a20, 0.35, 1.4);
      g.strokeStyle = css(0x3a2c18, 0.25);
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(sx, sy, rng.range(30, 60), rng.range(30, 60), 0, 0, Math.PI * 2);
      g.stroke();
    }
    streaks(g, rng, x, x + w, y + 10, 220, Math.round(w / 50), 0x2e2416, 0.25);
    texture(g, 'grime', x, y, w, h, { alpha: 0.3, scale: 1.5 });
    g.restore();
    // torn edges + curled flaps
    holes.forEach((hp, i) => {
      g.save();
      g.strokeStyle = css(0xb8a98a, 0.75);
      g.lineWidth = 2.2;
      g.stroke(hp);
      g.strokeStyle = css(0x000000, 0.35);
      g.lineWidth = 5;
      g.translate(2, 3);
      g.stroke(hp);
      g.restore();
      const [hx, hy, hr] = holeSpecs[i];
      g.fillStyle = css(0xc4b494, 0.85);
      g.beginPath();
      g.moveTo(hx - hr * 0.3, hy - hr * 0.6);
      g.quadraticCurveTo(hx - hr * 0.1, hy - hr * 0.2, hx + hr * 0.15, hy - hr * 0.55);
      g.closePath();
      g.fill();
    });
    // baseboard
    g.fillStyle = vGrad(g, G.by1 - 26, G.by1, [[0, 0x5a4330], [1, 0x34261a]]);
    g.fillRect(x, G.by1 - 26, w, 26);
    g.fillStyle = css(0xb08a60, 0.35);
    g.fillRect(x, G.by1 - 26, w, 1.5);
    // copper water pipes along the top
    pipe(g, [[x, y + 40], [x + w, y + 40]], { color: 0x9a6a44, r: 4 });
    pipe(g, [[x, y + 54], [x + w, y + 54]], { color: 0x8a5e3e, r: 3.5 });
  },
  floor(P) {
    const { far: g, rng, G } = P;
    floorPerspective(P, 0x5e5546, { cols: 14, rows: 3, line: 0x2a241c, lineAlpha: 0.35, checker: 0x433b31 });
    for (let i = 0; i < 4; i++) stain(g, rng, rng.range(G.bx0, G.bx1), rng.range(G.by1 + 10, G.h - 8), rng.range(30, 70), 0x241d14, 0.3, 0.3);
    // rag rug in the middle back
    const rx = G.w * 0.42;
    g.fillStyle = css(0x5a3a3a, 0.65);
    g.beginPath();
    g.ellipse(rx, G.by1 + 24, 120, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = css(0x8a6a50, 0.35);
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(rx, G.by1 + 24, 100, 10, 0, 0, Math.PI * 2);
    g.stroke();
  },
  props(P) {
    const { far: g, light, rng, G, amb } = P;
    // high window with moonlight
    const ww = 180, wh = 76;
    const wx = G.w * 0.36, wy = G.by0 + 14;
    g.fillStyle = css(0x241c14);
    g.fillRect(wx - 12, wy - 10, ww + 24, wh + 22);
    g.fillStyle = vGrad(g, wy, wy + wh, [[0, 0x18223a], [1, 0x34456a]]);
    g.fillRect(wx, wy, ww, wh);
    blob(g, wx + ww * 0.72, wy + 22, 34, 34, 0xc8d8ff, 0.35);
    g.fillStyle = css(0xe8eef8);
    g.beginPath();
    g.arc(wx + ww * 0.72, wy + 22, 10, 0, Math.PI * 2);
    g.fill();
    // grass outside the window
    g.strokeStyle = css(0x0e1410);
    g.lineWidth = 2;
    for (let gx = wx; gx < wx + ww; gx += 4) {
      g.beginPath();
      g.moveTo(gx, wy + wh);
      g.lineTo(gx + rng.range(-5, 5), wy + wh - rng.range(8, 26));
      g.stroke();
    }
    g.fillStyle = css(0x0e1410);
    g.fillRect(wx, wy + wh - 8, ww, 8);
    texture(g, 'grime', wx, wy, ww, wh, { alpha: 0.5, scale: 0.6 });
    g.fillStyle = css(0x4a3a2a);
    g.fillRect(wx + ww / 2 - 4, wy, 8, wh);
    g.strokeStyle = css(0x5a4836);
    g.lineWidth = 6;
    g.strokeRect(wx - 3, wy - 3, ww + 6, wh + 6);
    g.fillStyle = css(0x6a5a46);
    g.fillRect(wx - 16, wy + wh + 6, ww + 32, 8);
    // cobweb in the corner
    g.strokeStyle = css(0xd8d8d8, 0.25);
    g.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(wx, wy);
      g.lineTo(wx + Math.cos(i * 0.3) * 40, wy + Math.sin(i * 0.3) * 40);
      g.stroke();
    }
    for (let r = 10; r < 40; r += 9) {
      g.beginPath();
      g.arc(wx, wy, r, 0, Math.PI / 2);
      g.stroke();
    }
    // moonbeam
    const beamLen = G.by1 - wy;
    lightCone(light, wx + ww / 2, wy + wh, ww * 0.9, ww * 2.4, beamLen, 0xfff0c0, 0.12, G.w * 0.12);
    blob(g, wx + ww / 2 + G.w * 0.12, G.by1 + 10, ww * 1.1, 18, 0xfff0c0, 0.14);
    amb.push({ kind: 'dust', x: wx, y: wy + wh, w: ww + G.w * 0.14, h: beamLen * 0.8, color: 0xc8d8ff, layer: 'far' });

    // jam-jar shelf top-left
    shelf(g, rng, G.bx0 + 30, G.by0 + 150, 220, 9, [0x8a3a3a, 0xa0702a, 0x6a7a3a, 0xc0a060], 0.9);

    // washing machine low left
    const mx = G.bx0 + 50, mw = 150, mh = 170, my = G.by1 - mh;
    contactShadow(g, mx + mw / 2, G.by1, mw);
    g.fillStyle = css(0x2a2822);
    g.fillRect(mx - 2, my - 2, mw + 4, mh + 2);
    g.fillStyle = vGrad(g, my, G.by1, [[0, 0xbab4a0], [1, 0x8a8472]]);
    g.fillRect(mx, my, mw, mh);
    g.fillStyle = css(0x9a9482);
    g.fillRect(mx, my, mw, 32);
    g.fillStyle = css(0x3a3832);
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.arc(mx + 22 + k * 26, my + 16, 7, 0, Math.PI * 2);
      g.fill();
    }
    led(g, light, mx + mw - 20, my + 16, 0xff7a3a, true, 2);
    amb.push({ kind: 'blink', x: mx + mw - 20, y: my + 16, color: 0xff7a3a, size: 2, period: 2.6, layer: 'far' });
    const dcx = mx + mw / 2, dcy = my + 100;
    g.fillStyle = css(0x55524a);
    g.beginPath();
    g.arc(dcx, dcy, 50, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = vGrad(g, dcy - 40, dcy + 40, [[0, 0x2a3640], [1, 0x141a20]]);
    g.beginPath();
    g.arc(dcx, dcy, 40, 0, Math.PI * 2);
    g.fill();
    for (const [c, ox, oy] of [[0x7a3a4a, -12, 14], [0x3a5a7a, 10, 18], [0xa08a5a, 0, 26]] as const) blob(g, dcx + ox, dcy + oy, 16, 10, c, 0.6, 0.5);
    g.fillStyle = css(0xffffff, 0.18);
    g.beginPath();
    g.ellipse(dcx - 14, dcy - 16, 16, 8, -0.6, 0, Math.PI * 2);
    g.fill();
    texture(g, 'grime', mx, my, mw, mh, { alpha: 0.45, scale: 0.7 });
    crateBox(g, rng, mx + 30, my, 34, 40, 0x3a6a8a, false);

    // stacked boxes low centre-right
    const bx = G.w * 0.6;
    crateBox(g, rng, bx, G.by1, 90, 64, 0x8a6b48);
    crateBox(g, rng, bx + 94, G.by1, 70, 50, 0x7a5e3e);
    crateBox(g, rng, bx + 14, G.by1 - 64, 70, 48, 0x947552);
    stencil(g, 'XMAS', bx + 49, G.by1 - 40, 12, 0x2a1c10, 0.55, 'center');
    stencil(g, 'DO NOT OPEN', bx + 50, G.by1 - 92, 9, 0x8a2a20, 0.6, 'center');

    // boiler right
    const ox = G.bx1 - 180, ow = 120, oh = 290;
    const oy = G.by1 - oh;
    pipe(g, [[ox + 30, oy], [ox + 30, G.ceilY]], { color: 0x9a6a44, r: 6 });
    pipe(g, [[ox + 86, oy], [ox + 86, oy - 40], [G.bx1 + 4, oy - 40]], { color: 0x6a6a64, r: 10 });
    contactShadow(g, ox + ow / 2, G.by1, ow * 1.2);
    g.fillStyle = css(0x22201c);
    g.beginPath();
    g.roundRect(ox - 2, oy - 2, ow + 4, oh + 2, 24);
    g.fill();
    g.fillStyle = hGrad(g, ox, ox + ow, [[0, 0x4e4a40], [0.3, 0x857f70], [0.6, 0x6b6558], [1, 0x3a362e]]);
    g.beginPath();
    g.roundRect(ox, oy, ow, oh, 22);
    g.fill();
    for (const by2 of [oy + 50, oy + oh - 60]) {
      g.fillStyle = css(0x2e2b26, 0.8);
      g.fillRect(ox, by2, ow, 6);
    }
    gauge(g, rng, ox + ow / 2, oy + 90, 16);
    g.fillStyle = css(0x1a1612);
    g.fillRect(ox + ow / 2 - 18, oy + oh - 44, 36, 18);
    g.fillStyle = vGrad(g, oy + oh - 42, oy + oh - 28, [[0, 0xffd27a], [1, 0xff6a2a]]);
    g.fillRect(ox + ow / 2 - 15, oy + oh - 41, 30, 12);
    blob(light, ox + ow / 2, oy + oh - 36, 60, 34, 0xff8a3a, 0.6, 0.15);
    blob(g, ox + ow / 2, G.by1 + 6, 70, 10, 0xff8a3a, 0.15);
    amb.push({ kind: 'flicker', x: ox + ow / 2, y: oy + oh - 35, w: 30, h: 12, color: 0xff8a3a, period: 1.8, layer: 'far' });
    texture(g, 'grime', ox, oy, ow, oh, { alpha: 0.5, scale: 0.8 });
    amb.push({ kind: 'drip', x: ox + 86, y: oy - 30, color: 0xb0b8b8, size: 2, period: 4.8, layer: 'far' });
  },
  cheer(P) {
    const { far: g, rng } = P;
    // the little high window now looks out on a sunny lawn
    sunnyWindow(P, 393, 2, 200, 96, { cols: 2, rows: 1, sun: [0.75, 0.32], clouds: 1, curtains: 0xf08a8a });
    doodle(g, rng, 650, 300, 66, 80, 'cat', 0.06);
    doodle(g, rng, 300, 330, 62, 72, 'rainbow', -0.05);
    flowerPot(g, rng, 520, 560, 26);
  },
  lights(P) {
    const { far: g, light, rng, G, amb } = P;
    // string lights in two swags
    const pts: [number, number][] = [[G.bx0 + 10, G.by0 + 70], [G.w * 0.5, G.by0 + 90], [G.bx1 - 10, G.by0 + 66]];
    const colors = [0xffc46a, 0xffc46a, 0xff8a5a, 0xffc46a, 0xa8d88a, 0xffc46a];
    let blinkCount = 0;
    for (let s = 0; s < 2; s++) {
      const [x0, y0] = pts[s];
      const [x1, y1] = pts[s + 1];
      const sag = 70;
      cable(g, x0, y0, x1, y1, sag * 2, 1.6, 0x1c1a16, 0.15);
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag * 2;
      const n = Math.round((x1 - x0) / 46);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const bxp = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1;
        const byp = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1;
        const c = colors[(i + s * 3) % colors.length];
        g.fillStyle = css(0x1c1a16);
        g.fillRect(bxp - 2, byp, 4, 5);
        g.fillStyle = css(shade(c, 0.35));
        g.beginPath();
        g.ellipse(bxp, byp + 9, 3.2, 4.5, 0, 0, Math.PI * 2);
        g.fill();
        blob(light, bxp, byp + 9, 22, 22, c, 0.5, 0.15);
        blob(g, bxp, byp + 9, 14, 14, c, 0.18);
        if (rng.chance(0.12) && blinkCount < 3) {
          blinkCount++;
          amb.push({ kind: 'blink', x: bxp, y: byp + 9, color: c, size: 3.2, period: 1.5 + blinkCount, layer: 'far' });
        }
      }
    }
    blob(g, G.w * 0.5, G.by0 + 180, G.w * 0.45, 140, 0xffc46a, 0.05);
  },
  soilExtras(P) {
    const { far: g, rng, G } = P;
    const X0 = -ENV_MARGIN.left, X1 = G.w + ENV_MARGIN.right;
    pipe(g, [[X0, G.h + 150], [X1, G.h + 150]], { color: 0x6e5a4a, r: 16, flangeEvery: 280 });
    pipe(g, [[G.w * 0.3, G.h + G.floorSlab], [G.w * 0.3, G.h + 136]], { color: 0x5a5e60, r: 7 });
    cableBundle(g, rng, X0, G.surfaceY + 50, -G.wallT - 10, G.h * 0.3, 80, [0x1a1a1a, 0x2a2a2a], 4);
    // gas line on the right
    pipe(g, [[X1, G.h * 0.55], [G.w + G.wallT + 30, G.h * 0.55], [G.w + G.wallT + 30, G.surfaceY + 6]], { color: 0xb08a2a, r: 7 });
    // buried treasure: a lost toy car
    g.fillStyle = css(0x8a2a22, 0.7);
    g.fillRect(-160, G.h + 220, 30, 12);
    g.fillStyle = css(0x111111, 0.8);
    g.beginPath();
    g.arc(-153, G.h + 233, 4, 0, Math.PI * 2);
    g.arc(-136, G.h + 233, 4, 0, Math.PI * 2);
    g.fill();
  },
  near(P) {
    const { near: g, rng, G, amb } = P;
    const dark = 0x15120e, rim = 0xffc46a;
    // dangling string-light end + cobweb top-left
    cable(g, -230, -40, 160, 30, 50, 3, dark, 0.1);
    hangingCable(g, rng, 160, 30, 70, 3, dark);
    g.fillStyle = css(0x2a2016);
    g.beginPath();
    g.ellipse(176, 104, 7, 10, 0, 0, Math.PI * 2);
    g.fill();
    amb.push({ kind: 'sway', x: 168, y: 100, size: 6, period: 5.5, layer: 'near' });
    g.strokeStyle = css(0xd0d0d0, 0.18);
    g.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.moveTo(-60, -60);
      g.lineTo(-60 + Math.cos(i * 0.25) * 200, -60 + Math.sin(i * 0.25) * 200);
      g.stroke();
    }
    for (let r = 40; r < 200; r += 30) {
      g.beginPath();
      g.arc(-60, -60, r, 0.05, 1.5);
      g.stroke();
    }
    // mop bucket bottom-left
    const mb = new Path2D();
    mb.moveTo(-40, G.h - 60);
    mb.lineTo(110, G.h - 60);
    mb.lineTo(100, G.h + 60);
    mb.lineTo(-30, G.h + 60);
    mb.closePath();
    mb.rect(70, G.h - 330, 8, 280);
    silhouette(g, mb, 0x1a1a18, rim, -2, -1, 0.3);
    // box corner bottom-right
    const bx = new Path2D();
    bx.rect(G.w - 80, G.h - 70, 320, 340);
    bx.rect(G.w - 40, G.h - 130, 260, 62);
    silhouette(g, bx, 0x241a10, rim, -2, -2, 0.3);
    // lagged pipe top-right
    pipe(g, [[G.w + 240, 30], [G.w - 140, 30], [G.w - 140, -230]], { color: 0x2c2620, r: 18 });
    g.strokeStyle = css(0x3a3028, 0.8);
    g.lineWidth = 2;
    for (let x = G.w - 120; x < G.w + 240; x += 14) {
      g.beginPath();
      g.moveTo(x, 13);
      g.lineTo(x - 6, 47);
      g.stroke();
    }
  },
};

// ---------------------------------------------------------------------------
// Environment: Abandoned Research Facility
// ---------------------------------------------------------------------------

const CYAN = 0x3fd8f0;
const VIOLET = 0xb07aff;

const research: EnvDef = {
  theme: {
    soil: { top: 0x463c33, mid: 0x3a3029, deep: 0x1f1a16, rock: 0x6c6a66, root: 0x30261c },
    grass: 0x56633a,
    sky: [0x5aaef0, 0xc4e8fb],
    concrete: 0x84888a,
    side: 0x4a5755,
    ceiling: 0x464c4c,
    veil: 0x2a3434,
    veilAlpha: 0.42,
    key: 0x8fe0f0,
    shadow: 0x1a1430,
    floor: { top: 0x56625f, face: 0x29312f },
  },
  backWall(P) {
    const { far: g, rng, G } = P;
    const x = G.bx0, y = G.by0, w = G.bx1 - G.bx0;
    const split = G.by1 - 150;
    tiles(g, rng, x, y, w, split - y, 0x55635f, 0x434d4a, 32, 0.008);
    tiles(g, rng, x, split + 32, w, G.by1 - split - 32, 0x36454a, 0x262e2f, 32, 0.03);
    tiles(g, rng, x, split, w, 32, 0x3f6a6c, 0x262e2f, 32, 0.01);
    texture(g, 'mottle', x, y, w, G.by1 - y, { alpha: 0.28, op: 'soft-light', scale: 1.2 });
    texture(g, 'grime', x, y, w, G.by1 - y, { alpha: 0.45, scale: 1.4 });
    streaks(g, rng, x, x + w, y + 30, 320, Math.round(w / 35), 0x2a3022, 0.28);
    for (let i = 0; i < 5; i++) stain(g, rng, rng.range(x, x + w), rng.range(split - 60, G.by1), rng.range(40, 80), 0x2a3a24, 0.3, 0.8);
    stencil(g, 'LAB 04', x + 30, split - 30, 26, 0xd8e8e4, 0.16);
    stencil(g, 'CONTAINMENT', x + w - 360, split - 30, 16, 0xd8e8e4, 0.12);
  },
  floor(P) {
    const { far: g, rng, G } = P;
    floorPerspective(P, 0x4a5654, { cols: 16, rows: 3, line: 0x1e2423, lineAlpha: 0.55 });
    texture(g, 'grime', 0, G.by1, G.w, G.h - G.by1, { alpha: 0.5 });
    for (let i = 0; i < 4; i++) stain(g, rng, rng.range(G.bx0, G.bx1), rng.range(G.by1 + 10, G.h - 6), rng.range(20, 50), 0x1a201c, 0.35, 0.3);
    // painted guide line
    g.strokeStyle = css(0xc9a22e, 0.35);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(G.bx0 + 20, G.by1 + 14);
    g.lineTo(G.bx1 - 20, G.by1 + 14);
    g.stroke();
  },
  props(P) {
    const { far: g, light, rng, G, amb } = P;
    // cable tray along the top
    const ty = G.by0 + 34;
    g.fillStyle = css(0x1a1e1f);
    g.fillRect(G.bx0, ty - 2, G.bx1 - G.bx0, 22);
    for (let cx = G.bx0 + 10; cx < G.bx1; cx += rng.range(80, 140)) {
      const sag = rng.range(20, 90);
      const span = rng.range(60, 140);
      cable(g, cx, ty + 12, Math.min(G.bx1, cx + span), ty + 12, sag, rng.range(2.5, 4.5), rng.pick([0x1d1d1d, 0x2a2a2a, 0x3a4a5a, 0x5a3a22]));
    }
    g.fillStyle = vGrad(g, ty, ty + 4, [[0, 0x9aa2a2], [1, 0x5a6262]]);
    g.fillRect(G.bx0, ty, G.bx1 - G.bx0, 4);
    g.fillRect(G.bx0, ty + 16, G.bx1 - G.bx0, 4);
    for (let rx = G.bx0 + 20; rx < G.bx1; rx += 60) {
      g.fillStyle = css(0x2a3030);
      g.fillRect(rx, ty - 30, 4, 34);
    }
    // monitor bank, left
    const mx = G.bx0 + 40, my = Math.max(140, G.h * 0.24);
    pipe(g, [[mx + 70, ty + 18], [mx + 70, my]], { color: 0x3a4040, r: 5 });
    const screens: [number, number, number, number, boolean][] = [
      [mx, my, 120, 76, false],
      [mx + 132, my + 6, 96, 64, false],
      [mx + 20, my + 92, 100, 64, true],
      [mx + 132, my + 82, 96, 70, false],
    ];
    screens.forEach(([sx, sy, sw, sh, dead]) => {
      monitor(g, light, rng, sx, sy, sw, sh, CYAN, 0.9, dead);
      if (!dead) amb.push({ kind: 'monitor', x: sx, y: sy, w: sw, h: sh, color: CYAN, period: rng.range(3, 7), layer: 'far' });
    });
    // console desk low left
    const dx = G.bx0 + 24, dw = Math.min(320, G.w * 0.2), dTop = G.by1 - 86;
    contactShadow(g, dx + dw / 2, G.by1, dw);
    g.fillStyle = css(0x161a1b);
    g.fillRect(dx - 2, dTop - 2, dw + 4, 88);
    g.fillStyle = vGrad(g, dTop, G.by1, [[0, 0x4a5254], [1, 0x2a3032]]);
    g.fillRect(dx, dTop, dw, 86);
    g.fillStyle = css(0x2a3234);
    g.beginPath();
    g.moveTo(dx, dTop);
    g.lineTo(dx + dw, dTop);
    g.lineTo(dx + dw - 12, dTop - 18);
    g.lineTo(dx + 12, dTop - 18);
    g.closePath();
    g.fill();
    for (let k = 0; k < 14; k++) {
      g.fillStyle = css(0x6a7476, 0.8);
      g.fillRect(dx + 30 + k * 10, dTop - 12, 7, 5);
    }
    led(g, light, dx + dw - 40, dTop - 9, 0x5af07a, true, 2);
    led(g, light, dx + dw - 28, dTop - 9, 0xffb43a, false, 2);
    amb.push({ kind: 'blink', x: dx + dw - 40, y: dTop - 9, color: 0x5af07a, size: 2, period: 1.7, layer: 'far' });
    // mug & papers
    g.fillStyle = css(0xc8c0a8, 0.5);
    g.save();
    g.translate(dx + dw - 90, dTop - 22);
    g.rotate(-0.1);
    g.fillRect(0, 0, 30, 4);
    g.restore();
    g.fillStyle = css(0xb04a3a);
    g.fillRect(dx + dw - 20, dTop - 34, 12, 14);
    // sealed hatch low right
    const hx = G.bx1 - 200, hr = Math.min(108, G.h * 0.12), hy = G.by1 - hr - 30;
    g.fillStyle = css(0x1e2424);
    g.fillRect(hx - hr - 24, hy - hr - 24, (hr + 24) * 2, (hr + 24) * 2 + 30);
    bevel(g, hx - hr - 24, hy - hr - 24, (hr + 24) * 2, (hr + 24) * 2 + 30, 0x8a9494, 0x0a0c0c, 0.5, 2);
    // hazard ring
    for (let i = 0; i < 24; i++) {
      g.fillStyle = css(i % 2 ? 0x24221e : 0xb58f2e);
      g.beginPath();
      g.arc(hx, hy, hr + 16, (i / 24) * Math.PI * 2, ((i + 1) / 24) * Math.PI * 2);
      g.arc(hx, hy, hr + 4, ((i + 1) / 24) * Math.PI * 2, (i / 24) * Math.PI * 2, true);
      g.closePath();
      g.fill();
    }
    const dg = g.createRadialGradient(hx - hr * 0.35, hy - hr * 0.4, hr * 0.1, hx, hy, hr);
    dg.addColorStop(0, css(0x7a8486));
    dg.addColorStop(1, css(0x3a4244));
    g.fillStyle = dg;
    g.beginPath();
    g.arc(hx, hy, hr, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = css(0x1a1e1e, 0.8);
    g.lineWidth = 2;
    g.beginPath();
    g.arc(hx, hy, hr * 0.78, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      rivet(g, hx + Math.cos(a) * hr * 0.9, hy + Math.sin(a) * hr * 0.9, 3, 0x6a7476);
    }
    valveWheel(g, hx, hy, hr * 0.42, 0x5a6466);
    texture(g, 'grime', hx - hr, hy - hr, hr * 2, hr * 2, { alpha: 0.5, scale: 0.7 });
    stencil(g, 'SEALED', hx, hy - hr - 46, 20, 0xc8402e, 0.6, 'center');
    // red warning lamp above hatch
    const wlx = hx + hr + 4, wly = hy - hr - 46;
    g.fillStyle = css(0x1a1a1a);
    g.fillRect(wlx - 9, wly - 4, 18, 14);
    g.fillStyle = css(0xff4a3a);
    g.beginPath();
    g.arc(wlx, wly - 4, 8, Math.PI, Math.PI * 2);
    g.fill();
    blob(light, wlx, wly - 6, 40, 34, 0xff3a2a, 0.5, 0.15);
    amb.push({ kind: 'blink', x: wlx, y: wly - 6, color: 0xff3a2a, size: 8, period: 2.4, layer: 'far' });
    // violet junction box upper right
    const jx = G.bx1 - 240, jy = Math.max(110, G.h * 0.16);
    g.fillStyle = css(0x161818);
    g.fillRect(jx - 3, jy - 3, 96, 76);
    g.fillStyle = css(0x3a4244);
    g.fillRect(jx, jy, 90, 70);
    g.fillStyle = css(0x0e1012);
    g.fillRect(jx + 8, jy + 8, 74, 54);
    // exposed wires with violet arcs
    for (let i = 0; i < 4; i++) cable(g, jx + 14 + i * 16, jy + 10, jx + 20 + i * 14, jy + 60, 6, 2.2, [0xa83a2a, 0x2a5aa0, 0xc8a02a, 0x2a2a2a][i]);
    g.strokeStyle = css(0xe8d0ff, 0.9);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(jx + 30, jy + 30);
    for (let k = 1; k <= 6; k++) g.lineTo(jx + 30 + k * 6, jy + 30 + rng.range(-7, 7));
    g.stroke();
    blob(g, jx + 45, jy + 32, 50, 40, VIOLET, 0.2);
    blob(light, jx + 45, jy + 32, 70, 60, VIOLET, 0.55, 0.1);
    amb.push({ kind: 'spark', x: jx + 48, y: jy + 32, color: VIOLET, size: 18, period: 3.2, layer: 'far' });
    // violet conduit glow strip
    pipe(g, [[jx + 45, jy], [jx + 45, ty + 18]], { color: 0x4a3a6a, r: 5 });
    g.fillStyle = css(VIOLET, 0.6);
    g.fillRect(jx + 43, ty + 22, 4, jy - ty - 26);
    blob(light, jx + 45, (ty + jy) / 2, 14, (jy - ty) / 2, VIOLET, 0.3);
    // extra wall display top-right
    monitor(g, light, rng, G.bx1 - 120, jy + 6, 70, 46, CYAN, 0.6, false);
    amb.push({ kind: 'monitor', x: G.bx1 - 120, y: jy + 6, w: 70, h: 46, color: CYAN, period: 4.5, layer: 'far' });
    // fallen ceiling panel leaning low centre
    g.save();
    g.translate(G.w * 0.52, G.by1);
    g.rotate(-0.25);
    g.fillStyle = css(0x1a1e1e);
    g.fillRect(-2, -62, 124, 64);
    g.fillStyle = css(0x7c8482);
    g.fillRect(0, -60, 120, 60);
    texture(g, 'speckle', 0, -60, 120, 60, { alpha: 0.9 });
    g.restore();
  },
  cheer(P) {
    const { far: g, rng, G } = P;
    // tall windows thrown open: the lab has gone to seed, beautifully
    sunnyWindow(P, 410, 118, 150, 170, { cols: 2, rows: 3, sun: [0.7, 0.22], clouds: 1, beam: 110 });
    sunnyWindow(P, 590, 118, 150, 170, { cols: 2, rows: 3, clouds: 1, beam: 110 });
    bunting(g, 60, 92, 1060, 92, 18, [0x6cc87a, 0x4fa8e0, 0xf2c043, 0xe07ab8, 0xfff2d8]);
    doodle(g, rng, 452, 330, 66, 80, 'robot', -0.05);
    doodle(g, rng, 600, 340, 62, 72, 'rocket', 0.06);
    flowerPot(g, rng, 200, 470, 26);
    bigPlant(g, rng, 560, G.by1, 140);
    bigPlant(g, rng, 1030, G.by1, 120);
  },
  lights(P) {
    const { far: g, light, G, amb } = P;
    const cool = 0xcfe8f0;
    const len = Math.min(220, G.w * 0.14);
    const ty = G.by0 + 76;
    tubeLamp(g, light, G.w * 0.32 - len / 2, ty, len, cool, 0.75);
    lightCone(light, G.w * 0.32, ty + 6, len, len * 2.2, G.by1 - ty, cool, 0.045);
    tubeLamp(g, light, G.w * 0.66 - len / 2, ty, len, cool, 0.35, true);
    amb.push({ kind: 'flicker', x: G.w * 0.66, y: ty + 3, w: len, h: 16, color: cool, period: 5, layer: 'far' });
    amb.push({ kind: 'dust', x: G.w * 0.32 - len, y: ty + 20, w: len * 2, h: Math.min(420, G.h * 0.5), color: 0xd8f0ff, layer: 'far' });
    amb.push({ kind: 'drip', x: G.w * 0.45, y: G.by0 + 54, color: 0x9ab8b8, size: 1.8, period: 4.6, layer: 'far' });
  },
  soilExtras(P) {
    const { far: g, rng, G } = P;
    const X0 = -ENV_MARGIN.left, X1 = G.w + ENV_MARGIN.right;
    pipe(g, [[X0, G.h + 120], [X1, G.h + 120]], { color: 0x5a6a72, r: 14, flangeEvery: 240 });
    pipe(g, [[X0, G.h + 190], [X1, G.h + 190]], { color: 0x3e4a50, r: 9, flangeEvery: 200 });
    // armoured power cable glowing faintly violet at a splice
    cableBundle(g, rng, X0, G.h * 0.45, -G.wallT - 8, G.h * 0.4, 30, [0x1a1a1a, 0x3a2a5a], 6);
    blob(P.light, -150, G.h * 0.45 + 10, 30, 20, VIOLET, 0.35);
    cableBundle(g, rng, G.w + G.wallT + 8, G.h * 0.3, X1, G.h * 0.36, 30, [0x1a1a1a, 0x1e2a3a], 6);
    // old survey marker / concrete plug
    g.fillStyle = css(0x8a8a84, 0.8);
    g.fillRect(G.w + 120, G.surfaceY + 6, 24, 70);
  },
  near(P) {
    const { near: g, rng, G, amb } = P;
    const dark = 0x0f1314, rim = CYAN;
    // drooping cable bundle top-left
    for (let i = 0; i < 4; i++) cable(g, -230, -20 + i * 8, 200 + i * 12, -200, 200 + i * 22, 6, dark, 0.12);
    amb.push({ kind: 'sway', x: 60, y: 120, size: 8, period: 6.5, layer: 'near' });
    // broken ceiling panel hanging top-right
    const bp = new Path2D();
    bp.moveTo(G.w - 140, -60);
    bp.lineTo(G.w + 230, -60);
    bp.lineTo(G.w + 230, -20);
    bp.lineTo(G.w - 20, 110);
    bp.lineTo(G.w - 160, 40);
    bp.closePath();
    silhouette(g, bp, 0x161b1c, rim, -2, 2, 0.2);
    hangingCable(g, rng, G.w - 60, 60, 60, 3, dark);
    // gas cylinder bottom-right
    const gc = new Path2D();
    gc.addPath(rrPath(G.w - 70, G.h - 200, 80, 470, 36));
    gc.rect(G.w - 46, G.h - 220, 32, 24);
    silhouette(g, gc, 0x141a1a, rim, -2, 0, 0.25);
    // cable spool bottom-left
    const sp = new Path2D();
    sp.ellipse(20, G.h + 30, 70, 110, 0, 0, Math.PI * 2);
    silhouette(g, sp, 0x15191a, rim, -2, -2, 0.2);
    g.fillStyle = css(0x1e2628);
    g.fillRect(-50, G.h - 30, 140, 30);
  },
};

// ---------------------------------------------------------------------------
// Registry & entry point
// ---------------------------------------------------------------------------

const DEFS: Record<string, EnvDef> = { garage, underground, greenhouse, maintenance, basement, research, ...HAPPY_ENVS };

/**
 * Paint all layers. Deterministic for the same (id, w, h, scale).
 * The effective scale may be lowered so no canvas dimension exceeds 4096 px;
 * read it back as `far.width / (w + ENV_MARGIN.left + ENV_MARGIN.right)`.
 */
export function paintEnvironment(id: string, w: number, h: number, scale: number): EnvironmentLayers {
  const envId = DEFS[id] || THEMED_ENVS[id] ? id : 'garage';
  const def = DEFS[envId] ?? THEMED_ENVS[envId];
  const M = ENV_MARGIN;
  const Wt = w + M.left + M.right;
  const Ht = h + M.top + M.bottom;
  const s = Math.max(0.05, Math.min(scale, 4096 / Wt, 4096 / Ht));
  const pw = Math.min(4096, Math.round(Wt * s));
  const ph = Math.min(4096, Math.round(Ht * s));

  const make = (): [HTMLCanvasElement, Ctx] => {
    const c = makeCanvas(pw, ph);
    const g = ctx2d(c);
    g.setTransform(s, 0, 0, s, M.left * s, M.top * s);
    return [c, g];
  };
  const [farC, far] = make();
  const [lightC, light] = make();
  const [nearC, near] = make();

  const G = geometry(w, h);
  const seed = hashString(envId) ^ Math.imul(Math.round(w), 73856093) ^ Math.imul(Math.round(h), 19349663);
  const root = new Rand(seed);
  const amb: AmbientEmitter[] = [];
  const P: Painter = { far, light, near, rng: root.fork(1), G, T: def.theme, amb };

  const day = DAYLIGHT[envId];
  paintExterior(P, def);
  P.rng = root.fork(2);
  paintShell(P, def, day);
  P.rng = root.fork(3);
  // Furniture and machinery are painted on their own layer and knocked back (less colour, less
  // contrast, a touch of blur) before joining the wall, so nothing in the room's dressing reads as
  // a part, a socket or a hook the player could use.
  const [propsC, propsG] = make();
  clipped(propsG, roomPath(G), () => def.props({ ...P, far: propsG }));
  far.save();
  far.setTransform(1, 0, 0, 1, 0, 0);
  // Canvas filters are missing in some older browsers: fall back to simply fading the props.
  const filterable = typeof (far as { filter?: unknown }).filter === 'string';
  if (filterable) far.filter = `saturate(0.45) brightness(0.68) contrast(0.78) blur(${((def.flat ? 0.5 : 1.1) * s).toFixed(2)}px)`;
  far.globalAlpha = filterable ? 0.9 : 0.55;
  far.drawImage(propsC, 0, 0);
  far.restore();
  if (def.cheer) {
    // Cheerful dressing: knocked back too, but more gently, so the sky stays blue and the bunting
    // stays bright while still sitting behind the parts.
    const [cheerC, cheerG] = make();
    P.rng = root.fork(6);
    clipped(cheerG, roomPath(G), () => def.cheer?.({ ...P, far: cheerG }));
    far.save();
    far.setTransform(1, 0, 0, 1, 0, 0);
    if (filterable) far.filter = `saturate(0.8) contrast(0.86) blur(${((def.flat ? 0.4 : 0.7) * s).toFixed(2)}px)`;
    far.globalAlpha = filterable ? 0.94 : 0.7;
    far.drawImage(cheerC, 0, 0);
    far.restore();
  }
  paintVeil(P, def.flat, day);
  P.rng = root.fork(4);
  clipped(far, roomPath(G), () => def.lights(P));
  paintFinish(P, def.flat, day);
  if (day && filterable) {
    // Daylight grade over the whole backdrop: brighter and a touch more colourful.
    const [copyC, copyG] = make();
    copyG.setTransform(1, 0, 0, 1, 0, 0);
    copyG.drawImage(farC, 0, 0);
    far.save();
    far.setTransform(1, 0, 0, 1, 0, 0);
    far.clearRect(0, 0, pw, ph);
    far.filter = `brightness(${day.brightness}) saturate(${day.saturate})`;
    far.drawImage(copyC, 0, 0);
    far.restore();
  }
  P.rng = root.fork(5);
  def.near(P);

  // Contract: nothing in the foreground may hide a machine part, so the whole world rect (where
  // parts can go) stays clear; near-layer props only show in the margins around the room.
  near.clearRect(0, 0, w, h);
  // Gentle rim of atmosphere on near silhouettes so they sit in the scene.
  near.save();
  near.globalCompositeOperation = 'source-atop';
  near.fillStyle = css(mix(def.theme.veil, 0x000000, 0.4), 0.25);
  near.fillRect(-M.left, -M.top, Wt, Ht);
  near.restore();

  return { far: farC, light: lightC, near: nearC, ambient: amb, floor: { ...def.theme.floor } };
}
