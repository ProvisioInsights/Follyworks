/**
 * Shared Canvas 2D painting helpers for the part textures (see parts.ts).
 *
 * Everything draws in *world units*: the caller has already applied
 * `ctx.scale(scale, scale)` and translated to the texture origin, so the
 * helpers work directly in a part's local frame. All randomness flows through
 * a seeded {@link Rand}; nothing here touches Math.random.
 *
 * Lighting convention for the whole family: warm key light from the upper
 * left, cool bounce from the lower right, dark warm outline.
 */

export type Ctx = CanvasRenderingContext2D;
export type Fill = string | CanvasGradient | CanvasPattern;
/** x, y, w, h */
export type Box = [number, number, number, number];

/** Dark warm outline colour shared by every part. */
export const OL = '#1d1612';
/** Outline weight in world units. */
export const LW = 1.6;
/** Thin inner line weight for panel seams and detail. */
export const LW_IN = 0.6;

export const KEY_LIGHT = 'rgba(255,232,190,';
export const BOUNCE = 'rgba(130,180,210,';

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG with a few conveniences. */
export class Rand {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length];
  }
  /** Roughly gaussian in [-1, 1]. */
  soft(): number {
    return (this.next() + this.next() + this.next()) / 1.5 - 1;
  }
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

export function rgb(c: number, a = 1): string {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

/** k > 0 lightens toward a warm white, k < 0 darkens toward a warm black. */
export function shade(c: number, k: number): number {
  return k >= 0 ? mix(c, 0xfff4e2, k) : mix(c, 0x140c08, -k);
}

/** Cool-shifted shadow tone (bounce light side). */
export function cool(c: number, k: number): number {
  return mix(mix(c, 0x2a3442, k), 0x000000, k * 0.35);
}

// ---------------------------------------------------------------------------
// Paths (sub-path builders; caller owns beginPath)
// ---------------------------------------------------------------------------

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.arcTo(x + w, y, x + w, y + k, k);
  ctx.lineTo(x + w, y + h - k);
  ctx.arcTo(x + w, y + h, x + w - k, y + h, k);
  ctx.lineTo(x + k, y + h);
  ctx.arcTo(x, y + h, x, y + h - k, k);
  ctx.lineTo(x, y + k);
  ctx.arcTo(x, y, x + k, y, k);
  ctx.closePath();
}

/** Rectangle with 45° chamfered corners. */
export function chamferRect(ctx: Ctx, x: number, y: number, w: number, h: number, c: number): void {
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

export function poly(ctx: Ctx, pts: number[]): void {
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

export function circ(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

export function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.closePath();
}

/**
 * Spur gear outline as a sub-path. `n` teeth, tips at `tip`, roots at `root`.
 */
export function gearPath(ctx: Ctx, cx: number, cy: number, n: number, tip: number, root: number, phase = 0): void {
  const p = (Math.PI * 2) / n;
  const ht = p * 0.16; // half tip width
  const hb = p * 0.29; // half base width
  for (let i = 0; i < n; i++) {
    const a = phase + i * p;
    const r0 = a - hb;
    if (i === 0) ctx.moveTo(cx + Math.cos(r0) * root, cy + Math.sin(r0) * root);
    // flank up
    const mid = (tip + root) / 2;
    ctx.lineTo(cx + Math.cos(a - ht * 1.35) * mid, cy + Math.sin(a - ht * 1.35) * mid);
    ctx.lineTo(cx + Math.cos(a - ht) * tip, cy + Math.sin(a - ht) * tip);
    ctx.arc(cx, cy, tip, a - ht, a + ht);
    ctx.lineTo(cx + Math.cos(a + ht * 1.35) * mid, cy + Math.sin(a + ht * 1.35) * mid);
    ctx.lineTo(cx + Math.cos(a + hb) * root, cy + Math.sin(a + hb) * root);
    ctx.arc(cx, cy, root, a + hb, a + p - hb);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Gradients
// ---------------------------------------------------------------------------

export function lin(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(Math.max(0, Math.min(1, o)), c);
  return g;
}

export function rad(
  ctx: Ctx,
  x0: number, y0: number, r0: number,
  x1: number, y1: number, r1: number,
  stops: [number, string][],
): CanvasGradient {
  const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (const [o, c] of stops) g.addColorStop(Math.max(0, Math.min(1, o)), c);
  return g;
}

/** Vertical cylinder-like shading across [y0, y1] (light near the top third). */
export function cylV(ctx: Ctx, y0: number, y1: number, base: number, k = 1): CanvasGradient {
  return lin(ctx, 0, y0, 0, y1, [
    [0, rgb(shade(base, -0.15 * k))],
    [0.18, rgb(shade(base, 0.35 * k))],
    [0.32, rgb(shade(base, 0.12 * k))],
    [0.7, rgb(base)],
    [0.9, rgb(cool(base, 0.35 * k))],
    [1, rgb(shade(base, -0.25 * k))],
  ]);
}

/** Horizontal cylinder shading across [x0, x1] (light on the left). */
export function cylH(ctx: Ctx, x0: number, x1: number, base: number, k = 1): CanvasGradient {
  return lin(ctx, x0, 0, x1, 0, [
    [0, rgb(shade(base, -0.1 * k))],
    [0.2, rgb(shade(base, 0.32 * k))],
    [0.38, rgb(shade(base, 0.1 * k))],
    [0.72, rgb(base)],
    [0.9, rgb(cool(base, 0.35 * k))],
    [1, rgb(shade(base, -0.3 * k))],
  ]);
}

/** Brushed/rolled metal: banded linear gradient. */
export function metal(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, base: number): CanvasGradient {
  return lin(ctx, x0, y0, x1, y1, [
    [0, rgb(shade(base, 0.32))],
    [0.22, rgb(shade(base, 0.08))],
    [0.4, rgb(shade(base, 0.22))],
    [0.62, rgb(base)],
    [0.8, rgb(shade(base, -0.12))],
    [1, rgb(cool(base, 0.3))],
  ]);
}

/**
 * Soft form shading overlay over a box (call inside a clip). Light from the
 * upper-left, shadow toward the lower-right, sweeping across the box's
 * smaller dimension so long thin parts still read as rounded.
 */
export function formShade(ctx: Ctx, box: Box, k = 1): void {
  const [x, y, w, h] = box;
  const cx = x + w / 2, cy = y + h / 2;
  const m = Math.min(w, h) * 0.6 + 2;
  // sweep across the short axis so long parts read as rounded, not split in two
  const [dx, dy] = h > w * 2.5 ? [1, 0] : w > h * 2.5 ? [0, 1] : h > w * 1.3 ? [0.91, 0.42] : w > h * 1.3 ? [0.3, 0.95] : [0.6, 0.8];
  const g = lin(ctx, cx - dx * m, cy - dy * m, cx + dx * m, cy + dy * m, [
    [0, `${KEY_LIGHT}${(0.26 * k).toFixed(3)})`],
    [0.42, 'rgba(255,240,220,0)'],
    [0.62, 'rgba(0,0,0,0)'],
    [1, `rgba(24,12,30,${(0.38 * k).toFixed(3)})`],
  ]);
  ctx.fillStyle = g;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
}

// ---------------------------------------------------------------------------
// The workhorse: lit, outlined shape
// ---------------------------------------------------------------------------

export interface LitOpts {
  /** Painted inside the shape's clip, after the base fill. */
  inner?: () => void;
  /** Form-shade strength (0 disables). Default 1. */
  form?: number;
  /** Bevel strength (0 disables). Default 1. */
  bevel?: number;
  hi?: string;
  lo?: string;
  /** Outline weight, or false for none. */
  lw?: number | false;
  rule?: CanvasFillRule;
}

/** Fill a path, paint details inside its clip, add form shading, a bevel and the outline. */
export function lit(ctx: Ctx, path: () => void, box: Box, fill: Fill, o: LitOpts = {}): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill(o.rule ?? 'nonzero');
  ctx.save();
  ctx.clip(o.rule ?? 'nonzero');
  if (o.inner) o.inner();
  const f = o.form ?? 1;
  if (f > 0) formShade(ctx, box, f);
  const bv = o.bevel ?? 1;
  if (bv > 0) {
    const off = 0.75 * bv;
    ctx.lineWidth = 1.5 * bv;
    ctx.save();
    ctx.translate(off, off);
    ctx.beginPath();
    path();
    ctx.strokeStyle = o.hi ?? `${KEY_LIGHT}0.5)`;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(-off, -off);
    ctx.beginPath();
    path();
    ctx.strokeStyle = o.lo ?? `${BOUNCE}0.32)`;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  if (o.lw !== false) {
    ctx.beginPath();
    path();
    ctx.lineWidth = o.lw ?? LW;
    ctx.strokeStyle = OL;
    ctx.stroke();
  }
  ctx.restore();
}

/** Just the outline of a path. */
export function outline(ctx: Ctx, path: () => void, lw = LW, color = OL): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  path();
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

/** Run `fn` inside a clip of `path`. */
export function clipped(ctx: Ctx, path: () => void, fn: () => void): void {
  ctx.save();
  ctx.beginPath();
  path();
  ctx.clip();
  fn();
  ctx.restore();
}

/** A thin seam line: dark groove with a light lip beneath it. */
export function seam(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, a = 0.6): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = `rgba(29,22,18,${a})`;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.lineWidth = 0.45;
  ctx.strokeStyle = `${KEY_LIGHT}${(a * 0.45).toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(x0 + 0.45, y0 + 0.55);
  ctx.lineTo(x1 + 0.45, y1 + 0.55);
  ctx.stroke();
  ctx.restore();
}

/** Thick stroked rod/wire with outline and specular line. `path` builds an open path. */
export function tube(ctx: Ctx, path: () => void, width: number, base: number, o: { hi?: number; lw?: number; shadow?: boolean } = {}): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const lw = o.lw ?? LW * 0.8;
  ctx.beginPath();
  path();
  ctx.strokeStyle = OL;
  ctx.lineWidth = width + lw * 2;
  ctx.stroke();
  ctx.strokeStyle = rgb(shade(base, -0.18));
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.save();
  ctx.translate(-width * 0.14, -width * 0.16);
  ctx.beginPath();
  path();
  ctx.strokeStyle = rgb(base);
  ctx.lineWidth = width * 0.62;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(-width * 0.22, -width * 0.26);
  ctx.beginPath();
  path();
  ctx.strokeStyle = rgb(shade(base, o.hi ?? 0.55), 0.85);
  ctx.lineWidth = Math.max(0.35, width * 0.2);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Surface texture
// ---------------------------------------------------------------------------

/** Random speckle dots inside a box (call inside a clip). */
export function speckle(
  ctx: Ctx, rand: Rand, box: Box, n: number,
  colors: readonly string[], rmin = 0.2, rmax = 0.7,
): void {
  const [x, y, w, h] = box;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rand.pick(colors);
    const r = rand.range(rmin, rmax);
    const px = x + rand.next() * w, py = y + rand.next() * h;
    ctx.fillRect(px - r, py - r, r * 2, r * 2 * rand.range(0.6, 1));
  }
}

/** Soft mottling blobs (grime, patina) inside a box (call inside a clip). */
export function mottle(ctx: Ctx, rand: Rand, box: Box, n: number, color: number, a: number, rmin: number, rmax: number): void {
  const [x, y, w, h] = box;
  for (let i = 0; i < n; i++) {
    const px = x + rand.next() * w, py = y + rand.next() * h;
    const r = rand.range(rmin, rmax);
    ctx.fillStyle = rad(ctx, px, py, 0, px, py, r, [
      [0, rgb(color, a * rand.range(0.5, 1))],
      [1, rgb(color, 0)],
    ]);
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }
}

/** Fine scratches (call inside a clip). */
export function scratches(ctx: Ctx, rand: Rand, box: Box, n: number, light = true, alpha = 0.3): void {
  const [x, y, w, h] = box;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const px = x + rand.next() * w, py = y + rand.next() * h;
    const a = rand.range(-0.6, 0.6) + (rand.chance(0.5) ? 0 : Math.PI / 2) * 0.3;
    const l = rand.range(1.5, 5);
    ctx.strokeStyle = light ? `rgba(255,246,230,${(alpha * rand.range(0.4, 1)).toFixed(3)})` : `rgba(20,12,8,${(alpha * rand.range(0.4, 1)).toFixed(3)})`;
    ctx.lineWidth = rand.range(0.2, 0.4);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + rand.soft() * 0.6, py + Math.sin(a) * l * 0.5 + rand.soft() * 0.6, px + Math.cos(a) * l, py + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.restore();
}

/** Grime gathering toward the bottom of a box (call inside a clip). */
export function grimeBottom(ctx: Ctx, box: Box, a = 0.3, color = 0x2a1a10): void {
  const [x, y, w, h] = box;
  ctx.fillStyle = lin(ctx, 0, y + h * 0.55, 0, y + h, [
    [0, rgb(color, 0)],
    [1, rgb(color, a)],
  ]);
  ctx.fillRect(x, y, w, h);
}

/** Edge wear: small chips of `chip` colour along the inside of a rectangle's border. */
export function edgeChips(ctx: Ctx, rand: Rand, box: Box, n: number, chip: string, size = 1.2): void {
  const [x, y, w, h] = box;
  ctx.fillStyle = chip;
  for (let i = 0; i < n; i++) {
    const side = rand.int(0, 3);
    const t = rand.next();
    let px = 0, py = 0;
    if (side === 0) { px = x + t * w; py = y + rand.range(0, 1.2); }
    else if (side === 1) { px = x + w - rand.range(0, 1.2); py = y + t * h; }
    else if (side === 2) { px = x + t * w; py = y + h - rand.range(0, 1.2); }
    else { px = x + rand.range(0, 1.2); py = y + t * h; }
    const s = size * rand.range(0.4, 1.2);
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + rand.range(-0.3, 0.3);
      ctx.lineTo(px + Math.cos(a) * s * rand.range(0.5, 1), py + Math.sin(a) * s * rand.range(0.4, 0.9));
    }
    ctx.closePath();
    ctx.fill();
  }
}

export interface WoodOpts {
  base: number;
  dark?: number;
  light?: number;
  /** Grain runs along x ('h') or y ('v'). */
  dir?: 'h' | 'v';
  knots?: number;
  lineGap?: number;
}

/** Wood grain filling a rect (call inside a clip or with the rect as the shape). */
export function woodGrain(ctx: Ctx, rand: Rand, x: number, y: number, w: number, h: number, o: WoodOpts): void {
  ctx.save();
  if (o.dir === 'v') {
    ctx.translate(x + w, y);
    ctx.rotate(Math.PI / 2);
    // now drawing along +x for the length of h, across w
    paintGrain(ctx, rand, 0, 0, h, w, o);
  } else {
    paintGrain(ctx, rand, x, y, w, h, o);
  }
  ctx.restore();
}

function paintGrain(ctx: Ctx, rand: Rand, x: number, y: number, w: number, h: number, o: WoodOpts): void {
  const base = o.base;
  const dark = o.dark ?? shade(base, -0.42);
  const light = o.light ?? shade(base, 0.3);
  ctx.fillStyle = rgb(base);
  ctx.fillRect(x, y, w, h);
  // long soft colour streaks
  const streaks = Math.max(2, Math.round(h / 3));
  for (let i = 0; i < streaks; i++) {
    const yy = y + rand.next() * h;
    ctx.fillStyle = rgb(rand.chance(0.5) ? dark : light, rand.range(0.05, 0.14));
    ctx.fillRect(x, yy, w, rand.range(0.8, 2.6));
  }
  // grain lines
  const gap = o.lineGap ?? 1.5;
  const lines = Math.max(2, Math.round(h / gap));
  const step = 6;
  ctx.lineCap = 'round';
  for (let i = 0; i < lines; i++) {
    const y0 = y + (i + rand.range(0.1, 0.9)) * (h / lines);
    const amp = rand.range(0.15, 0.6);
    const f = rand.range(0.02, 0.06);
    const ph = rand.range(0, 6.28);
    const isDark = rand.chance(0.7);
    ctx.strokeStyle = rgb(isDark ? dark : light, isDark ? rand.range(0.18, 0.42) : rand.range(0.12, 0.28));
    ctx.lineWidth = rand.range(0.18, 0.45);
    ctx.beginPath();
    let started = false;
    let xs = x - rand.range(0, 20);
    // broken lines: segments of random length
    while (xs < x + w) {
      const len = rand.range(15, 80);
      const xe = Math.min(x + w + 2, xs + len);
      started = false;
      for (let xx = xs; xx <= xe; xx += step) {
        const yy = y0 + Math.sin(xx * f + ph) * amp + Math.sin(xx * f * 2.7 + ph * 1.3) * amp * 0.35;
        if (!started) { ctx.moveTo(xx, yy); started = true; } else ctx.lineTo(xx, yy);
      }
      xs = xe + rand.range(2, 12);
    }
    ctx.stroke();
  }
  // knots
  const knots = o.knots ?? Math.floor((w * h) / 2200);
  for (let i = 0; i < knots; i++) {
    const kx = x + rand.range(0.1, 0.9) * w;
    const ky = y + rand.range(0.25, 0.75) * h;
    const kr = rand.range(0.9, Math.min(2.6, h * 0.2));
    for (let r = kr * 2.6; r > 0.2; r -= 0.7) {
      ctx.strokeStyle = rgb(dark, 0.22);
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.ellipse(kx, ky, r * 1.9, r * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = rad(ctx, kx, ky, 0, kx, ky, kr, [
      [0, rgb(shade(dark, -0.3), 0.85)],
      [0.6, rgb(dark, 0.6)],
      [1, rgb(dark, 0)],
    ]);
    ctx.beginPath();
    ctx.ellipse(kx, ky, kr * 1.3, kr * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Hardware
// ---------------------------------------------------------------------------

/** Domed rivet / nail head with a contact shadow. */
export function rivet(ctx: Ctx, x: number, y: number, r: number, base = 0x9a9890): void {
  ctx.save();
  ctx.fillStyle = 'rgba(20,10,6,0.38)';
  ctx.beginPath();
  ctx.arc(x + r * 0.35, y + r * 0.45, r * 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rad(ctx, x - r * 0.35, y - r * 0.4, 0, x, y, r, [
    [0, rgb(shade(base, 0.6))],
    [0.45, rgb(base)],
    [1, rgb(shade(base, -0.45))],
  ]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.min(0.5, r * 0.35);
  ctx.strokeStyle = 'rgba(29,22,18,0.85)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,250,235,0.85)';
  ctx.beginPath();
  ctx.arc(x - r * 0.38, y - r * 0.4, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Slotted screw head. */
export function screw(ctx: Ctx, x: number, y: number, r: number, ang = 0.6, base = 0xa8a49a): void {
  rivet(ctx, x, y, r, base);
  ctx.save();
  ctx.strokeStyle = 'rgba(29,22,18,0.9)';
  ctx.lineWidth = r * 0.32;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(ang) * r * 0.8, y - Math.sin(ang) * r * 0.8);
  ctx.lineTo(x + Math.cos(ang) * r * 0.8, y + Math.sin(ang) * r * 0.8);
  ctx.stroke();
  ctx.restore();
}

/** Hex bolt head seen face-on. */
export function hexBolt(ctx: Ctx, x: number, y: number, r: number, base = 0x8f949a, ang = 0.2): void {
  ctx.save();
  ctx.fillStyle = 'rgba(20,10,6,0.4)';
  ctx.beginPath();
  ctx.arc(x + r * 0.3, y + r * 0.4, r * 1.05, 0, Math.PI * 2);
  ctx.fill();
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = ang + (i * Math.PI) / 3;
    pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.beginPath();
  poly(ctx, pts);
  ctx.fillStyle = lin(ctx, x - r, y - r, x + r, y + r, [
    [0, rgb(shade(base, 0.45))],
    [0.5, rgb(base)],
    [1, rgb(shade(base, -0.4))],
  ]);
  ctx.fill();
  ctx.lineWidth = Math.min(0.55, r * 0.3);
  ctx.strokeStyle = 'rgba(29,22,18,0.9)';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = rad(ctx, x - r * 0.2, y - r * 0.2, 0, x, y, r * 0.6, [
    [0, rgb(shade(base, 0.35))],
    [1, rgb(shade(base, -0.1))],
  ]);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Tiny four-point specular glint. */
export function glint(ctx: Ctx, x: number, y: number, s: number, a = 0.9): void {
  ctx.save();
  ctx.fillStyle = `rgba(255,252,240,${a})`;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s * 0.5, y);
  ctx.quadraticCurveTo(x, y, x, y + s * 0.7);
  ctx.quadraticCurveTo(x, y, x - s * 0.5, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
  ctx.fillStyle = rad(ctx, x, y, 0, x, y, s * 0.7, [
    [0, `rgba(255,250,235,${a * 0.6})`],
    [1, 'rgba(255,250,235,0)'],
  ]);
  ctx.fillRect(x - s, y - s, s * 2, s * 2);
  ctx.restore();
}

/** Soft oval specular highlight. */
export function sheen(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.5, rot = -0.6): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = rad(ctx, 0, 0, 0, 0, 0, rx, [
    [0, `rgba(255,250,238,${a})`],
    [0.5, `rgba(255,246,228,${(a * 0.45).toFixed(3)})`],
    [1, 'rgba(255,246,228,0)'],
  ]);
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/**
 * Helical coil spring between two points (axis from a to b), seen from the
 * side. Back half-turns are darker and drawn first.
 */
export function coilSpring(
  ctx: Ctx,
  ax: number, ay: number, bx: number, by: number,
  radius: number, coils: number, wire: number, base = 0xb0b4b6,
): void {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux; // across the axis
  const seg = 10;
  const pt = (t: number): [number, number, number] => {
    const th = t * Math.PI * 2 * coils;
    const along = t * len + Math.sin(th) * wire * 0.6;
    const across = Math.cos(th) * radius;
    return [ax + ux * along + nx * across, ay + uy * along + ny * across, Math.sin(th)];
  };
  const halves = coils * 2;
  const drawHalf = (i: number, front: boolean) => {
    ctx.beginPath();
    for (let k = 0; k <= seg; k++) {
      const t = (i + k / seg) / halves;
      const [x, y] = pt(t);
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = OL;
    ctx.lineWidth = wire + 1.1;
    ctx.stroke();
    ctx.strokeStyle = rgb(front ? base : shade(base, -0.45));
    ctx.lineWidth = wire;
    ctx.stroke();
    if (front) {
      ctx.strokeStyle = rgb(shade(base, 0.6), 0.9);
      ctx.lineWidth = wire * 0.35;
      ctx.save();
      ctx.translate(-wire * 0.18, -wire * 0.22);
      ctx.stroke();
      ctx.restore();
    }
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // half-turns with sin(th) >= 0 are front (th in [0, π])
  for (let i = 0; i < halves; i++) if (i % 2 === 1) drawHalf(i, false);
  for (let i = 0; i < halves; i++) if (i % 2 === 0) drawHalf(i, true);
  ctx.restore();
}

/** Insulated cable through a list of points (smoothed). */
export function cable(ctx: Ctx, pts: number[], width: number, base: number): void {
  tube(ctx, () => smoothPath(ctx, pts), width, base, { hi: 0.45 });
}

/** Catmull-Rom-ish smooth open path through points (flat array). */
export function smoothPath(ctx: Ctx, pts: number[]): void {
  const n = pts.length / 2;
  ctx.moveTo(pts[0], pts[1]);
  if (n === 2) {
    ctx.lineTo(pts[2], pts[3]);
    return;
  }
  for (let i = 0; i < n - 1; i++) {
    const x0 = pts[Math.max(0, i - 1) * 2], y0 = pts[Math.max(0, i - 1) * 2 + 1];
    const x1 = pts[i * 2], y1 = pts[i * 2 + 1];
    const x2 = pts[(i + 1) * 2], y2 = pts[(i + 1) * 2 + 1];
    const x3 = pts[Math.min(n - 1, i + 2) * 2], y3 = pts[Math.min(n - 1, i + 2) * 2 + 1];
    ctx.bezierCurveTo(x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6, x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6, x2, y2);
  }
}

/** Small text label in world units (system fonts only). */
export function label(
  ctx: Ctx, text: string, x: number, y: number, size: number, color: string,
  o: { weight?: string; font?: string; align?: CanvasTextAlign; spacing?: number; maxW?: number } = {},
): void {
  ctx.save();
  ctx.font = `${o.weight ?? 'bold'} ${size}px ${o.font ?? 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  if (o.maxW !== undefined) {
    const m = ctx.measureText(text).width;
    if (m > o.maxW) {
      ctx.translate(x, y);
      ctx.scale(o.maxW / m, 1);
      ctx.fillText(text, 0, 0);
      ctx.restore();
      return;
    }
  }
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Diagonal hazard stripes filling a box (call inside a clip). */
export function hazard(ctx: Ctx, box: Box, period: number, a = 0xe0a92a, b = 0x231c18, ang = -0.8): void {
  const [x, y, w, h] = box;
  ctx.save();
  ctx.fillStyle = rgb(a);
  ctx.fillRect(x, y, w, h);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(ang);
  const R = Math.hypot(w, h);
  ctx.fillStyle = rgb(b);
  for (let s = -R; s < R; s += period) ctx.fillRect(s, -R, period / 2, R * 2);
  ctx.restore();
}

/** Contact/drop shadow ellipse. */
export function dropShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.35): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = rad(ctx, 0, 0, 0, 0, 0, rx, [
    [0, `rgba(12,6,4,${a})`],
    [1, 'rgba(12,6,4,0)'],
  ]);
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}
