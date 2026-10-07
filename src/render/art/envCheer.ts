/**
 * Cheerful dressing and daylight for every room (John: "happy bright scenes"): sunny windows with
 * blue sky and fluffy clouds, bunting, potted plants and doodle posters, plus a per-room daylight
 * grade that lifts and warms the whole backdrop.
 *
 * The readability rule still holds. Dressing is painted on its own layer and composited with a
 * gentler version of the props knock-back (less saturation and contrast, a slight blur), it stays
 * away from anything that could read as a socket, hook or part, and parts keep their dark rims.
 */

import { type Ctx, Rand, blob, css, hGrad, leafCluster, lightCone, mix, pottedPlant, rrPath, shade, vGrad } from './envHelpers';
import type { Painter } from './environment';

// ---------------------------------------------------------------------------
// Daylight: how much each room is lifted and what calms its centre
// ---------------------------------------------------------------------------

export interface Daylight {
  /** Light wash that calms the centre (replaces the old mid-dark veil). */
  veil: number;
  veilAlpha: number;
  /** Final grade over the whole backdrop. */
  brightness: number;
  saturate: number;
  /** Warm sunlight tint laid over the room (soft-light). */
  sun: number;
  sunAlpha: number;
  /** Fresh paint: back and side walls are re-hued toward this colour (luminance kept) and lifted. */
  paint?: number;
  paintAlpha?: number;
}

const D = (brightness: number, saturate: number, veil: number, veilAlpha: number, paint?: number, paintAlpha = 0.55, sun = 0xffe2a8, sunAlpha = 0.35): Daylight => ({ veil, veilAlpha, brightness, saturate, sun, sunAlpha, paint, paintAlpha });

export const DAYLIGHT: Record<string, Daylight> = {
  garage: D(1.3, 1.1, 0xf2e8d4, 0.14, 0x8fd6c2, 0.6),
  underground: D(1.28, 1.06, 0xf0dcc0, 0.12, 0xe8cca4, 0.35),
  greenhouse: D(1.18, 1.06, 0xeaf4dc, 0.1, undefined, 0, 0xfff0b8),
  maintenance: D(1.28, 1.08, 0xe8eedc, 0.12, 0x8fc4ea, 0.55),
  basement: D(1.26, 1.08, 0xf4e6cc, 0.12, 0xf4d88a, 0.45),
  research: D(1.26, 1.06, 0xe4f2ee, 0.12, 0x98e6d8, 0.55, 0xfff4cc),
  backyard: D(1.04, 1.02, 0xfff6e0, 0.06, undefined, 0, 0xfff0c0, 0.2),
  playroom: D(1.04, 1.02, 0xfff4ec, 0.06, undefined, 0, 0xfff0d0, 0.2),
  cave: D(1.3, 1.1, 0xf2dcbc, 0.12, 0xf2bf86, 0.45),
  foundry: D(1.26, 1.08, 0xf4e2c0, 0.12, 0xf0c88a, 0.45),
  toolbox: D(1.08, 1.04, 0xeef4f8, 0.05, undefined, 0, 0xfff4d0, 0.15),
  rooftop: D(1.04, 1.02, 0xf4f0e0, 0.04, undefined, 0, 0xfff0c0, 0.12),
  neonlab: D(1.06, 1.0, 0xf0eaff, 0.08, undefined, 0, 0xfff4ff, 0.2),
};

/** Re-hue a wall toward fresh paint (keeps its texture) and lift its shadows. */
export function freshPaint(g: Ctx, path: Path2D, color: number, alpha: number): void {
  g.save();
  g.clip(path);
  g.globalCompositeOperation = 'color';
  g.fillStyle = css(color, alpha);
  g.fill(path);
  g.globalCompositeOperation = 'screen';
  g.fillStyle = css(color, alpha * 0.45);
  g.fill(path);
  g.restore();
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

export const FESTIVE = [0xf2c043, 0xe0603c, 0x4fa8e0, 0x6cc87a, 0xe07ab8, 0xfff2d8];
export const PASTEL = [0xffd27a, 0xff9e8a, 0x8fd0f5, 0x9be3a5, 0xf2a6d8, 0xc9b4ff];
const LEAVES = [0x4f8f3e, 0x66a646, 0x3f7a35, 0x7cb850];

// ---------------------------------------------------------------------------
// Sky, sun, clouds
// ---------------------------------------------------------------------------

/** A fluffy cumulus cloud: overlapping puffs with a soft lilac underside. */
export function cloud(g: Ctx, rng: Rand, x: number, y: number, s: number, alpha = 1): void {
  const puffs: [number, number, number][] = [];
  const n = rng.int(4, 6);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    puffs.push([x + (t - 0.5) * s * 1.6, y - Math.sin(t * Math.PI) * s * 0.35 + rng.range(-3, 3), s * rng.range(0.32, 0.5) * (0.7 + Math.sin(t * Math.PI) * 0.5)]);
  }
  g.save();
  g.globalAlpha = alpha;
  // underside shade
  g.fillStyle = css(0xc9d6ee);
  for (const [px, py, r] of puffs) {
    g.beginPath();
    g.arc(px, py + r * 0.18, r, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = css(0xffffff);
  for (const [px, py, r] of puffs) {
    g.beginPath();
    g.arc(px - r * 0.06, py - r * 0.06, r * 0.92, 0, Math.PI * 2);
    g.fill();
  }
  g.fillRect(x - s * 0.8, y - s * 0.05, s * 1.6, s * 0.22);
  g.restore();
}

/** A smiling sun: soft glow, disc and short rays. */
export function sun(g: Ctx, x: number, y: number, r: number, face = true): void {
  blob(g, x, y, r * 3.2, r * 3.2, 0xfff2a0, 0.55);
  g.save();
  g.strokeStyle = css(0xffd24a);
  g.lineWidth = Math.max(2, r * 0.16);
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.moveTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3);
    g.lineTo(x + Math.cos(a) * r * 1.65, y + Math.sin(a) * r * 1.65);
  }
  g.stroke();
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  gr.addColorStop(0, css(0xfffbe0));
  gr.addColorStop(1, css(0xffd34a));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  if (face && r > 10) {
    g.fillStyle = css(0xb8761e, 0.8);
    g.beginPath();
    g.arc(x - r * 0.32, y - r * 0.12, r * 0.09, 0, Math.PI * 2);
    g.arc(x + r * 0.32, y - r * 0.12, r * 0.09, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = css(0xb8761e, 0.8);
    g.lineWidth = Math.max(1.2, r * 0.08);
    g.beginPath();
    g.arc(x, y + r * 0.05, r * 0.42, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
  }
  g.restore();
}

export interface SkyOpts {
  /** Where the sun sits, as a fraction of the pane (omit for no sun). */
  sun?: [number, number];
  clouds?: number;
  /** Rolling green hills along the bottom. */
  hills?: boolean;
  top?: number;
  bottom?: number;
}

/** Blue daytime sky with clouds, an optional sun and hills, filling a rectangle (or any clip). */
export function skyPane(g: Ctx, rng: Rand, x: number, y: number, w: number, h: number, o: SkyOpts = {}): void {
  g.fillStyle = vGrad(g, y, y + h, [[0, o.top ?? 0x58aef0], [1, o.bottom ?? 0xc4e8fb]]);
  g.fillRect(x, y, w, h);
  if (o.sun) sun(g, x + w * o.sun[0], y + h * o.sun[1], Math.min(w, h) * 0.11 + 6);
  const n = o.clouds ?? 2;
  for (let i = 0; i < n; i++) {
    const cx = x + w * ((i + 0.5) / n) + rng.range(-w * 0.12, w * 0.12);
    const cy = y + h * rng.range(0.25, 0.55);
    cloud(g, rng, cx, cy, Math.min(w * 0.22, 70) * rng.range(0.8, 1.15));
  }
  if (o.hills) {
    const base = y + h;
    for (const [k, col] of [[0.3, 0x8fcf72], [0.18, 0x6bb85a]] as const) {
      g.fillStyle = css(col);
      g.beginPath();
      g.moveTo(x, base);
      const ph = rng.range(0, 6);
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        g.lineTo(x + t * w, base - h * k * (0.55 + 0.45 * Math.sin(t * 5.2 + ph)));
      }
      g.lineTo(x + w, base);
      g.closePath();
      g.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// Windows and light
// ---------------------------------------------------------------------------

export interface WindowOpts extends SkyOpts {
  cols?: number;
  rows?: number;
  frame?: number;
  /** Round-topped (arched) window. */
  arch?: boolean;
  /** A sill with a little flower pot on it. */
  sill?: boolean;
  /** Sunbeam slanting down into the room (painted into the light layer). */
  beam?: number;
  curtains?: number;
}

/** A sunny window with blue sky, clouds, an optional sun and a painted frame. */
export function sunnyWindow(P: Painter, x: number, y: number, w: number, h: number, o: WindowOpts = {}): void {
  const { far: g, light, rng } = P;
  const frame = o.frame ?? 0xf3ede0;
  const outline = new Path2D();
  if (o.arch) {
    outline.moveTo(x, y + h);
    outline.lineTo(x, y + w / 2);
    outline.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    outline.lineTo(x + w, y + h);
    outline.closePath();
  } else outline.addPath(rrPath(x, y, w, h, 3));
  // frame body
  g.save();
  g.fillStyle = css(shade(frame, -0.45));
  g.translate(0, 3);
  g.fill(outline);
  g.restore();
  g.fillStyle = css(frame);
  g.fill(outline);
  // glass
  const f = Math.max(6, w * 0.05);
  g.save();
  g.translate(x + w / 2, y + h / 2);
  g.scale((w - 2 * f) / w, (h - 2 * f) / h);
  g.translate(-(x + w / 2), -(y + h / 2));
  g.clip(outline);
  skyPane(g, rng, x, y, w, h, { hills: true, ...o });
  // glass sheen
  g.fillStyle = css(0xffffff, 0.16);
  g.beginPath();
  g.moveTo(x + w * 0.15, y + h);
  g.lineTo(x + w * 0.45, y);
  g.lineTo(x + w * 0.6, y);
  g.lineTo(x + w * 0.3, y + h);
  g.closePath();
  g.fill();
  g.restore();
  // mullions
  const cols = o.cols ?? 2, rows = o.rows ?? 2;
  g.fillStyle = css(frame);
  for (let i = 1; i < cols; i++) g.fillRect(x + (w * i) / cols - f * 0.3, y + (o.arch ? 0 : f), f * 0.6, h - (o.arch ? 0 : 2 * f));
  for (let j = 1; j < rows; j++) g.fillRect(x + f, y + (h * j) / rows - f * 0.3, w - 2 * f, f * 0.6);
  g.strokeStyle = css(shade(frame, -0.35), 0.8);
  g.lineWidth = 1.5;
  g.stroke(outline);
  if (o.curtains !== undefined) {
    for (const side of [0, 1]) {
      const cx = side ? x + w - 4 : x - 22;
      g.fillStyle = hGrad(g, cx, cx + 26, [[0, shade(o.curtains, -0.15)], [0.5, shade(o.curtains, 0.15)], [1, shade(o.curtains, -0.2)]]);
      g.beginPath();
      g.moveTo(cx, y - 8);
      g.lineTo(cx + 26, y - 8);
      g.quadraticCurveTo(cx + (side ? 6 : 20), y + h * 0.55, cx + 26, y + h + 6);
      g.lineTo(cx, y + h + 6);
      g.closePath();
      g.fill();
    }
    g.fillStyle = css(0x8a6a4a);
    g.fillRect(x - 30, y - 12, w + 60, 5);
  }
  if (o.sill) {
    g.fillStyle = css(shade(frame, -0.1));
    g.fillRect(x - 10, y + h, w + 20, 8);
    g.fillStyle = css(shade(frame, -0.5), 0.6);
    g.fillRect(x - 10, y + h + 8, w + 20, 3);
    flowerPot(g, rng, x + w * 0.72, y + h, 22);
  }
  // daylight pouring in
  blob(light, x + w / 2, y + h / 2, w * 0.9, h * 0.8, 0xfff2c8, 0.08, 0.2);
  if (o.beam !== undefined) lightCone(light, x + w / 2, y + h, w * 0.8, w * 1.6, 420, 0xfff0c0, 0.12, o.beam);
}

/** Warm sunbeam slanting through the room (light layer only). */
export function sunbeam(P: Painter, x: number, y: number, topW: number, botW: number, len: number, skew: number, alpha = 0.14): void {
  lightCone(P.light, x, y, topW, botW, len, 0xfff0c0, alpha, skew);
}

// ---------------------------------------------------------------------------
// Party bits
// ---------------------------------------------------------------------------

/** A string of triangular pennants sagging from (x0, y0) to (x1, y1). */
export function bunting(g: Ctx, x0: number, y0: number, x1: number, y1: number, sag: number, colors: readonly number[] = FESTIVE, size = 22, shape: 'flag' | 'leaf' | 'square' = 'flag'): void {
  const at = (t: number): [number, number] => {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag * 2;
    const u = 1 - t;
    return [u * u * x0 + 2 * u * t * mx + t * t * x1, u * u * y0 + 2 * u * t * my + t * t * y1];
  };
  g.save();
  g.strokeStyle = css(0x6a5a48);
  g.lineWidth = 1.6;
  g.beginPath();
  for (let i = 0; i <= 30; i++) {
    const [px, py] = at(i / 30);
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.stroke();
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(3, Math.floor(len / (size * 1.35)));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const [ax, ay] = at(t - 0.4 / n);
    const [bx, by] = at(t + 0.4 / n);
    const c = colors[i % colors.length];
    const tipX = (ax + bx) / 2, tipY = (ay + by) / 2 + size;
    g.fillStyle = css(shade(c, -0.35));
    g.beginPath();
    if (shape === 'square') {
      g.moveTo(ax, ay + 1);
      g.lineTo(bx, by + 1);
      g.lineTo(bx, by + size * 0.8 + 1);
      g.lineTo(ax, ay + size * 0.8 + 1);
    } else if (shape === 'leaf') {
      g.moveTo(ax, ay + 1);
      g.quadraticCurveTo(ax - 4, (ay + tipY) / 2, tipX, tipY + 1);
      g.quadraticCurveTo(bx + 4, (by + tipY) / 2, bx, by + 1);
    } else {
      g.moveTo(ax, ay + 1);
      g.lineTo(bx, by + 1);
      g.lineTo(tipX, tipY + 1);
    }
    g.closePath();
    g.fill();
    g.fillStyle = css(c);
    g.beginPath();
    if (shape === 'square') {
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.lineTo(bx, by + size * 0.8);
      g.lineTo(ax, ay + size * 0.8);
    } else if (shape === 'leaf') {
      g.moveTo(ax, ay);
      g.quadraticCurveTo(ax - 4, (ay + tipY) / 2, tipX, tipY);
      g.quadraticCurveTo(bx + 4, (by + tipY) / 2, bx, by);
    } else {
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.lineTo(tipX, tipY);
    }
    g.closePath();
    g.fill();
    g.fillStyle = css(0xffffff, 0.25);
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo((ax + bx) / 2, (ay + by) / 2);
    g.lineTo(tipX - (bx - ax) * 0.15, tipY - size * 0.35);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** A party balloon on a curly string. */
export function balloon(g: Ctx, x: number, y: number, r: number, color: number, string = 60): void {
  g.save();
  g.strokeStyle = css(0x8a7a6a, 0.8);
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(x, y + r * 1.15);
  for (let i = 1; i <= 8; i++) g.quadraticCurveTo(x + (i % 2 ? 6 : -6), y + r * 1.15 + (i - 0.5) * (string / 8), x, y + r * 1.15 + i * (string / 8));
  g.stroke();
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  gr.addColorStop(0, css(shade(color, 0.55)));
  gr.addColorStop(0.5, css(color));
  gr.addColorStop(1, css(shade(color, -0.3)));
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(x, y, r * 0.88, r * 1.05, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = css(shade(color, -0.2));
  g.beginPath();
  g.moveTo(x - 4, y + r * 1.15);
  g.lineTo(x + 4, y + r * 1.15);
  g.lineTo(x, y + r * 1.0);
  g.closePath();
  g.fill();
  g.fillStyle = css(0xffffff, 0.55);
  g.beginPath();
  g.ellipse(x - r * 0.35, y - r * 0.45, r * 0.16, r * 0.26, -0.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** A pot of leaves with a few bright flowers. */
export function flowerPot(g: Ctx, rng: Rand, x: number, bottom: number, potW: number, pot = 0xd0714a, flowers: readonly number[] = [0xff6f7f, 0xffd24a, 0xffffff, 0xb07aff]): void {
  pottedPlant(g, rng, x, bottom, potW, LEAVES, pot);
  const top = bottom - potW * 0.85;
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const fx = x + rng.range(-potW * 0.7, potW * 0.7);
    const fy = top - rng.range(potW * 0.5, potW * 1.2);
    const c = rng.pick(flowers);
    const r = potW * rng.range(0.13, 0.18);
    g.fillStyle = css(c);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(fx + Math.cos(a) * r, fy + Math.sin(a) * r, r * 0.8, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = css(0xffc23a);
    g.beginPath();
    g.arc(fx, fy, r * 0.6, 0, Math.PI * 2);
    g.fill();
  }
}

/** A big leafy plant standing on the floor (a fiddle-leaf in a pot). */
export function bigPlant(g: Ctx, rng: Rand, x: number, floorY: number, h: number, pot = 0xe0a060): void {
  g.strokeStyle = css(0x5a4a2a);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x, floorY - h * 0.2);
  g.quadraticCurveTo(x + 6, floorY - h * 0.6, x - 4, floorY - h);
  g.stroke();
  for (let i = 0; i < 6; i++) {
    const t = 0.35 + (i / 6) * 0.65;
    leafCluster(g, rng, x + rng.range(-4, 4), floorY - h * t, h * 0.28, LEAVES, 4, -Math.PI * 0.95, -Math.PI * 0.05);
  }
  pottedPlant(g, rng, x, floorY, h * 0.32, LEAVES, pot);
}

// ---------------------------------------------------------------------------
// Doodle posters
// ---------------------------------------------------------------------------

export type DoodleKind = 'sun' | 'cat' | 'rocket' | 'robot' | 'rainbow' | 'machine';

/** A taped-up sheet of paper with a silly crayon doodle on it. */
export function doodle(g: Ctx, rng: Rand, x: number, y: number, w: number, h: number, kind: DoodleKind, rot = 0, paper = 0xf3ead6): void {
  g.save();
  g.translate(x + w / 2, y + h / 2);
  g.rotate(rot);
  g.translate(-w / 2, -h / 2);
  g.fillStyle = css(0x000000, 0.18);
  g.fillRect(3, 4, w, h);
  g.fillStyle = css(paper);
  g.fillRect(0, 0, w, h);
  // tape
  g.fillStyle = css(0xf4e7a8, 0.85);
  g.save();
  g.translate(w / 2, 0);
  g.rotate(rng.range(-0.15, 0.15));
  g.fillRect(-12, -5, 24, 10);
  g.restore();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const cr = (c: number, lw = 2.4) => {
    g.strokeStyle = css(c);
    g.lineWidth = lw;
  };
  const m = Math.min(w, h);
  const cx = w / 2, cy = h * 0.48;
  switch (kind) {
    case 'sun': {
      cr(0xf0a020, 2.6);
      g.beginPath();
      g.arc(cx, cy, m * 0.2, 0, Math.PI * 2);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        g.moveTo(cx + Math.cos(a) * m * 0.27, cy + Math.sin(a) * m * 0.27);
        g.lineTo(cx + Math.cos(a) * m * 0.38, cy + Math.sin(a) * m * 0.38);
      }
      g.stroke();
      cr(0x3a3020, 2);
      g.beginPath();
      g.arc(cx, cy + 2, m * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
      g.moveTo(cx - m * 0.07, cy - m * 0.05);
      g.lineTo(cx - m * 0.07, cy - m * 0.03);
      g.moveTo(cx + m * 0.07, cy - m * 0.05);
      g.lineTo(cx + m * 0.07, cy - m * 0.03);
      g.stroke();
      break;
    }
    case 'cat': {
      cr(0xe07a30, 2.6);
      g.beginPath();
      g.arc(cx, cy + m * 0.04, m * 0.24, 0, Math.PI * 2);
      g.moveTo(cx - m * 0.2, cy - m * 0.08);
      g.lineTo(cx - m * 0.16, cy - m * 0.32);
      g.lineTo(cx - m * 0.04, cy - m * 0.19);
      g.moveTo(cx + m * 0.2, cy - m * 0.08);
      g.lineTo(cx + m * 0.16, cy - m * 0.32);
      g.lineTo(cx + m * 0.04, cy - m * 0.19);
      g.stroke();
      cr(0x2a2a2a, 2);
      g.beginPath();
      g.moveTo(cx - m * 0.1, cy);
      g.lineTo(cx - m * 0.06, cy);
      g.moveTo(cx + m * 0.06, cy);
      g.lineTo(cx + m * 0.1, cy);
      g.moveTo(cx - m * 0.05, cy + m * 0.1);
      g.quadraticCurveTo(cx, cy + m * 0.15, cx + m * 0.05, cy + m * 0.1);
      g.moveTo(cx - m * 0.12, cy + m * 0.06);
      g.lineTo(cx - m * 0.32, cy + m * 0.02);
      g.moveTo(cx + m * 0.12, cy + m * 0.06);
      g.lineTo(cx + m * 0.32, cy + m * 0.02);
      g.stroke();
      break;
    }
    case 'rocket': {
      cr(0xd8443a, 2.6);
      g.beginPath();
      g.moveTo(cx, cy - m * 0.34);
      g.quadraticCurveTo(cx + m * 0.16, cy - m * 0.1, cx + m * 0.1, cy + m * 0.2);
      g.lineTo(cx - m * 0.1, cy + m * 0.2);
      g.quadraticCurveTo(cx - m * 0.16, cy - m * 0.1, cx, cy - m * 0.34);
      g.moveTo(cx - m * 0.1, cy + m * 0.12);
      g.lineTo(cx - m * 0.2, cy + m * 0.26);
      g.moveTo(cx + m * 0.1, cy + m * 0.12);
      g.lineTo(cx + m * 0.2, cy + m * 0.26);
      g.stroke();
      cr(0x3a8ad8, 2);
      g.beginPath();
      g.arc(cx, cy - m * 0.08, m * 0.06, 0, Math.PI * 2);
      g.stroke();
      cr(0xf0a020, 2.4);
      g.beginPath();
      g.moveTo(cx - m * 0.05, cy + m * 0.24);
      g.lineTo(cx, cy + m * 0.4);
      g.lineTo(cx + m * 0.05, cy + m * 0.24);
      g.stroke();
      break;
    }
    case 'robot': {
      cr(0x3a7ad0, 2.6);
      g.strokeRect(cx - m * 0.16, cy - m * 0.3, m * 0.32, m * 0.22);
      g.strokeRect(cx - m * 0.2, cy - m * 0.04, m * 0.4, m * 0.3);
      g.beginPath();
      g.moveTo(cx, cy - m * 0.3);
      g.lineTo(cx, cy - m * 0.4);
      g.moveTo(cx - m * 0.1, cy + m * 0.26);
      g.lineTo(cx - m * 0.1, cy + m * 0.38);
      g.moveTo(cx + m * 0.1, cy + m * 0.26);
      g.lineTo(cx + m * 0.1, cy + m * 0.38);
      g.moveTo(cx - m * 0.2, cy + m * 0.02);
      g.lineTo(cx - m * 0.34, cy - m * 0.12);
      g.moveTo(cx + m * 0.2, cy + m * 0.02);
      g.lineTo(cx + m * 0.34, cy - m * 0.12);
      g.stroke();
      cr(0xe0543c, 2.2);
      g.beginPath();
      g.arc(cx, cy - m * 0.42, m * 0.03, 0, Math.PI * 2);
      g.stroke();
      cr(0x2a2a2a, 2);
      g.beginPath();
      g.arc(cx - m * 0.06, cy - m * 0.2, 1.5, 0, Math.PI * 2);
      g.arc(cx + m * 0.06, cy - m * 0.2, 1.5, 0, Math.PI * 2);
      g.moveTo(cx - m * 0.06, cy - m * 0.13);
      g.quadraticCurveTo(cx, cy - m * 0.1, cx + m * 0.06, cy - m * 0.13);
      g.stroke();
      break;
    }
    case 'rainbow': {
      [0xe0543c, 0xf0a020, 0xf2d03a, 0x5ab85a, 0x3a8ad8, 0x8a5ad0].forEach((c, i) => {
        cr(c, 3);
        g.beginPath();
        g.arc(cx, cy + m * 0.22, m * (0.36 - i * 0.045), Math.PI, 0);
        g.stroke();
      });
      break;
    }
    case 'machine': {
      // a ball, a ramp, a bucket and a very happy face: a contraption plan
      cr(0x3a3020, 2);
      g.beginPath();
      g.moveTo(w * 0.12, h * 0.3);
      g.lineTo(w * 0.62, h * 0.55);
      g.stroke();
      cr(0xd8443a, 2.4);
      g.beginPath();
      g.arc(w * 0.18, h * 0.22, m * 0.07, 0, Math.PI * 2);
      g.stroke();
      cr(0x3a8ad8, 2.4);
      g.beginPath();
      g.moveTo(w * 0.66, h * 0.62);
      g.lineTo(w * 0.7, h * 0.82);
      g.lineTo(w * 0.86, h * 0.82);
      g.lineTo(w * 0.9, h * 0.62);
      g.stroke();
      cr(0x5ab85a, 2);
      g.beginPath();
      g.setLineDash([3, 4]);
      g.moveTo(w * 0.62, h * 0.5);
      g.quadraticCurveTo(w * 0.8, h * 0.3, w * 0.78, h * 0.58);
      g.stroke();
      g.setLineDash([]);
      cr(0xf0a020, 2);
      g.beginPath();
      g.arc(w * 0.3, h * 0.78, m * 0.1, 0, Math.PI * 2);
      g.moveTo(w * 0.26, h * 0.8);
      g.quadraticCurveTo(w * 0.3, h * 0.84, w * 0.34, h * 0.8);
      g.stroke();
      break;
    }
  }
  g.restore();
}

/** A sprinkle of paper confetti stuck to a wall or floor. */
export function confettiDots(g: Ctx, rng: Rand, x: number, y: number, w: number, h: number, n: number, colors: readonly number[] = PASTEL, alpha = 0.55): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = css(rng.pick(colors), alpha);
    const px = x + rng.range(0, w), py = y + rng.range(0, h);
    g.save();
    g.translate(px, py);
    g.rotate(rng.range(0, Math.PI));
    g.fillRect(-3, -1.5, 6, 3);
    g.restore();
  }
}

/** Mix a theme colour toward a pastel. */
export const pastel = (c: number, k = 0.45): number => mix(c, 0xffffff, k);
