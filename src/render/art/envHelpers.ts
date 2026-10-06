/**
 * Shared procedural painters for the workshop environments.
 *
 * Everything here draws with the Canvas 2D API in *world units*: callers set
 * up the context transform (scale + margin offset) once, and helpers paint in
 * the same coordinate space as the physics world. All randomness flows through
 * a seeded {@link Rand} so output is deterministic.
 */

export type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small, fast, seedable PRNG (mulberry32) with convenience helpers. */
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
  fork(salt: number): Rand {
    return new Rand(Math.floor(this.next() * 4294967296) ^ salt);
  }
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

export function css(c: number, a = 1): string {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** k > 0 lightens toward white, k < 0 darkens toward black. */
export function shade(c: number, k: number): number {
  return k >= 0 ? mix(c, 0xffffff, k) : mix(c, 0x000000, -k);
}

/** Shift a colour by a small random amount for hand-painted variation. */
export function jitter(rng: Rand, c: number, amt = 0.06): number {
  return shade(c, rng.range(-amt, amt));
}

// ---------------------------------------------------------------------------
// Texture tiles (generated once per module, deterministic)
// ---------------------------------------------------------------------------

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement): Ctx {
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas context unavailable');
  return g;
}

type TileKind = 'grain' | 'mottle' | 'grime' | 'speckle';
const tileCache = new Map<string, HTMLCanvasElement>();

/** Tileable multi-octave value noise in [0,1]. */
function valueNoiseField(size: number, seed: number, baseCells: number, octaves: number, falloff: number): Float32Array {
  const out = new Float32Array(size * size);
  const rng = new Rand(seed);
  let amp = 1;
  let total = 0;
  let cells = baseCells;
  for (let o = 0; o < octaves; o++) {
    const grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = rng.next();
    const step = size / cells;
    for (let y = 0; y < size; y++) {
      const gy = y / step;
      const y0 = Math.floor(gy) % cells;
      const y1 = (y0 + 1) % cells;
      let fy = gy - Math.floor(gy);
      fy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < size; x++) {
        const gx = x / step;
        const x0 = Math.floor(gx) % cells;
        const x1 = (x0 + 1) % cells;
        let fx = gx - Math.floor(gx);
        fx = fx * fx * (3 - 2 * fx);
        const a = grid[y0 * cells + x0];
        const b = grid[y0 * cells + x1];
        const c = grid[y1 * cells + x0];
        const d = grid[y1 * cells + x1];
        const v = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
        out[y * size + x] += v * amp;
      }
    }
    total += amp;
    amp *= falloff;
    cells *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/**
 * Get a cached texture tile.
 * - grain: fine neutral gray noise (use with overlay / soft-light)
 * - mottle: soft cloudy neutral gray (use with soft-light / multiply)
 * - grime: transparent with dark blotches (use source-over)
 * - speckle: transparent with sparse light/dark specks (aggregate, dirt)
 */
export function tile(kind: TileKind): HTMLCanvasElement {
  const hit = tileCache.get(kind);
  if (hit) return hit;
  const size = kind === 'grain' ? 128 : 256;
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const img = g.createImageData(size, size);
  const d = img.data;
  if (kind === 'grain') {
    const rng = new Rand(1234);
    for (let i = 0; i < size * size; i++) {
      const v = 128 + (rng.next() + rng.next() - 1) * 70;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
  } else if (kind === 'mottle') {
    const f = valueNoiseField(size, 777, 4, 5, 0.55);
    for (let i = 0; i < f.length; i++) {
      const v = 128 + (f[i] - 0.5) * 300;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.max(0, Math.min(255, v));
      d[i * 4 + 3] = 255;
    }
  } else if (kind === 'grime') {
    const f = valueNoiseField(size, 4242, 4, 5, 0.6);
    for (let i = 0; i < f.length; i++) {
      const t = Math.max(0, (f[i] - 0.5) / 0.35);
      d[i * 4] = 28; d[i * 4 + 1] = 22; d[i * 4 + 2] = 16;
      d[i * 4 + 3] = Math.min(150, t * 150);
    }
  } else {
    const rng = new Rand(99);
    for (let i = 0; i < size * size; i++) {
      const r = rng.next();
      if (r < 0.03) {
        const light = rng.next() < 0.45;
        const v = light ? 230 : 15;
        d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v;
        d[i * 4 + 3] = 70 + rng.next() * 140;
      } else d[i * 4 + 3] = 0;
    }
  }
  g.putImageData(img, 0, 0);
  tileCache.set(kind, c);
  return c;
}

export interface TextureOpts {
  alpha: number;
  op?: GlobalCompositeOperation;
  /** World units per tile pixel. Default 1. */
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

/** Fill the current clip (or a rect) with a tiled texture. */
export function texture(g: Ctx, kind: TileKind, x: number, y: number, w: number, h: number, o: TextureOpts): void {
  const pat = g.createPattern(tile(kind), 'repeat');
  if (!pat) return;
  const s = o.scale ?? 1;
  pat.setTransform(new DOMMatrix().translate(o.offsetX ?? 0, o.offsetY ?? 0).scale(s));
  g.save();
  g.globalAlpha = o.alpha;
  g.globalCompositeOperation = o.op ?? 'source-over';
  g.fillStyle = pat;
  g.fillRect(x, y, w, h);
  g.restore();
}

/** Apply a texture within an arbitrary path. */
export function textureIn(g: Ctx, path: Path2D, bounds: [number, number, number, number], kind: TileKind, o: TextureOpts): void {
  g.save();
  g.clip(path);
  texture(g, kind, bounds[0], bounds[1], bounds[2], bounds[3], o);
  g.restore();
}

// ---------------------------------------------------------------------------
// Basic shapes & shading
// ---------------------------------------------------------------------------

export function poly(pts: readonly (readonly [number, number])[]): Path2D {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}

export function roundRect(g: Ctx | Path2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

export function rrPath(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  roundRect(p, x, y, w, h, r);
  return p;
}

export function vGrad(g: Ctx, y0: number, y1: number, stops: [number, number, number?][]): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [t, c, a] of stops) gr.addColorStop(t, css(c, a ?? 1));
  return gr;
}

export function hGrad(g: Ctx, x0: number, x1: number, stops: [number, number, number?][]): CanvasGradient {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  for (const [t, c, a] of stops) gr.addColorStop(t, css(c, a ?? 1));
  return gr;
}

/** Soft radial blob (glow, stain, shadow). */
export function blob(g: Ctx, x: number, y: number, rx: number, ry: number, color: number, alpha: number, hard = 0): void {
  if (rx <= 0 || ry <= 0) return;
  g.save();
  g.translate(x, y);
  g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, css(color, alpha));
  gr.addColorStop(Math.min(0.95, hard), css(color, alpha));
  gr.addColorStop(1, css(color, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, rx, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Contact shadow under an object resting at y. */
export function contactShadow(g: Ctx, cx: number, y: number, w: number, alpha = 0.45): void {
  blob(g, cx, y, w * 0.6, Math.max(4, w * 0.08), 0x000000, alpha, 0.3);
}

/** Irregular stain built from overlapping soft blobs. */
export function stain(g: Ctx, rng: Rand, x: number, y: number, r: number, color: number, alpha: number, flat = 1): void {
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    const rr = r * rng.range(0.4, 1);
    blob(g, x + rng.range(-r, r) * 0.6, y + rng.range(-r, r) * 0.35 * flat, rr, rr * flat * rng.range(0.6, 1), color, alpha / n * 2, 0.35);
  }
}

/** Vertical grime streaks running down from a line (water/rust runs). */
export function streaks(g: Ctx, rng: Rand, x0: number, x1: number, y: number, len: number, count: number, color: number, alpha: number): void {
  g.save();
  for (let i = 0; i < count; i++) {
    const x = rng.range(x0, x1);
    const l = len * rng.range(0.3, 1);
    const w = rng.range(1.5, 6);
    const gr = g.createLinearGradient(0, y, 0, y + l);
    gr.addColorStop(0, css(color, alpha * rng.range(0.5, 1)));
    gr.addColorStop(1, css(color, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.quadraticCurveTo(x + rng.range(-2, 2), y + l * 0.6, x + rng.range(-1.5, 1.5), y + l);
    g.quadraticCurveTo(x + rng.range(-2, 2), y + l * 0.6, x + w / 2, y);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** Thin bevel: light top/left edge, dark bottom/right edge. */
export function bevel(g: Ctx, x: number, y: number, w: number, h: number, light: number, dark: number, a = 0.6, lw = 1.5): void {
  g.save();
  g.lineWidth = lw;
  g.strokeStyle = css(light, a);
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x, y);
  g.lineTo(x + w, y);
  g.stroke();
  g.strokeStyle = css(dark, a);
  g.beginPath();
  g.moveTo(x + w, y);
  g.lineTo(x + w, y + h);
  g.lineTo(x, y + h);
  g.stroke();
  g.restore();
}

export function rivet(g: Ctx, x: number, y: number, r: number, base: number): void {
  g.fillStyle = css(shade(base, -0.55), 0.6);
  g.beginPath();
  g.arc(x + r * 0.35, y + r * 0.4, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = css(base);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = css(shade(base, 0.45), 0.8);
  g.beginPath();
  g.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2);
  g.fill();
}

export function rivetRow(g: Ctx, x0: number, x1: number, y: number, step: number, r: number, base: number): void {
  for (let x = x0; x <= x1 + 0.01; x += step) rivet(g, x, y, r, base);
}

/** Diagonal yellow/black hazard stripes, worn. */
export function hazard(g: Ctx, rng: Rand, x: number, y: number, w: number, h: number, alpha = 1, stripe = 18): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.globalAlpha = alpha;
  g.fillStyle = css(0x2a2620);
  g.fillRect(x, y, w, h);
  g.fillStyle = css(0xc99a2e);
  for (let sx = x - h - stripe * 2; sx < x + w + h; sx += stripe * 2) {
    g.beginPath();
    g.moveTo(sx, y + h);
    g.lineTo(sx + stripe, y + h);
    g.lineTo(sx + stripe + h, y);
    g.lineTo(sx + h, y);
    g.closePath();
    g.fill();
  }
  // wear: chipped patches
  for (let i = 0; i < Math.max(2, w / 40); i++) {
    blob(g, rng.range(x, x + w), rng.range(y, y + h), rng.range(4, 12), rng.range(2, 6), 0x5a5048, 0.55, 0.6);
  }
  texture(g, 'grime', x, y, w, h, { alpha: 0.5, scale: 0.5 });
  g.restore();
}

/** Stencil text, slightly faded. */
export function stencil(g: Ctx, text: string, x: number, y: number, size: number, color: number, alpha = 0.5, align: CanvasTextAlign = 'left'): void {
  g.save();
  g.font = `bold ${size}px "Arial Narrow", Arial, sans-serif`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillStyle = css(color, alpha);
  g.fillText(text, x, y);
  g.restore();
}

// ---------------------------------------------------------------------------
// Pipes, cables
// ---------------------------------------------------------------------------

export interface PipeStyle {
  color: number;
  r: number;
  /** flange/coupling spacing; 0 = none */
  flangeEvery?: number;
  rim?: number;
}

/**
 * Axis-aligned (or any) polyline pipe with tube shading built from concentric
 * strokes plus an offset specular highlight. Rounded joins read as elbows.
 */
export function pipe(g: Ctx, pts: readonly (readonly [number, number])[], st: PipeStyle): void {
  const { color, r } = st;
  const path = new Path2D();
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'butt';
  // outline / occlusion
  g.strokeStyle = css(shade(color, -0.75), 0.9);
  g.lineWidth = r * 2 + 3;
  g.stroke(path);
  const layers: [number, number][] = [
    [1.0, -0.45],
    [0.82, -0.22],
    [0.6, 0],
    [0.36, 0.12],
  ];
  for (const [wk, sk] of layers) {
    g.strokeStyle = css(shade(color, sk));
    g.lineWidth = r * 2 * wk;
    g.stroke(path);
  }
  // offset specular
  g.translate(-r * 0.32, -r * 0.38);
  g.strokeStyle = css(shade(color, 0.42), 0.55);
  g.lineWidth = r * 0.22;
  g.stroke(path);
  g.restore();
  if (st.flangeEvery && st.flangeEvery > 0) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.floor(len / st.flangeEvery);
      for (let k = 1; k <= n; k++) {
        const t = (k * st.flangeEvery) / len;
        if (t > 0.97) break;
        flange(g, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, Math.abs(x1 - x0) > Math.abs(y1 - y0), r, color);
      }
    }
  }
}

export function flange(g: Ctx, x: number, y: number, horizontal: boolean, r: number, color: number): void {
  const t = Math.max(4, r * 0.45);
  const R = r * 1.28;
  g.save();
  g.translate(x, y);
  if (!horizontal) g.rotate(Math.PI / 2);
  g.fillStyle = css(shade(color, -0.7));
  g.fillRect(-t / 2 - 1, -R - 1, t + 2, R * 2 + 2);
  const gr = g.createLinearGradient(0, -R, 0, R);
  gr.addColorStop(0, css(shade(color, 0.25)));
  gr.addColorStop(0.35, css(shade(color, 0.05)));
  gr.addColorStop(1, css(shade(color, -0.5)));
  g.fillStyle = gr;
  g.fillRect(-t / 2, -R, t, R * 2);
  // bolts
  g.fillStyle = css(shade(color, -0.6));
  for (const by of [-R * 0.75, R * 0.75]) {
    g.beginPath();
    g.arc(0, by, Math.max(1.2, r * 0.12), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

export function valveWheel(g: Ctx, x: number, y: number, r: number, color = 0xa8392c): void {
  g.save();
  g.translate(x, y);
  g.strokeStyle = css(shade(color, -0.7));
  g.lineWidth = r * 0.34;
  g.beginPath();
  g.arc(1, 1.5, r, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = css(color);
  g.lineWidth = r * 0.24;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.4;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    g.lineWidth = r * 0.16;
    g.stroke();
  }
  g.strokeStyle = css(shade(color, 0.35), 0.7);
  g.lineWidth = r * 0.08;
  g.beginPath();
  g.arc(0, 0, r, Math.PI * 1.05, Math.PI * 1.55);
  g.stroke();
  g.fillStyle = css(0x2b2b2b);
  g.beginPath();
  g.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function gauge(g: Ctx, rng: Rand, x: number, y: number, r: number): void {
  g.save();
  g.fillStyle = css(0x1b1b1b, 0.6);
  g.beginPath();
  g.arc(x + 2, y + 3, r + 2, 0, Math.PI * 2);
  g.fill();
  const rim = g.createLinearGradient(x - r, y - r, x + r, y + r);
  rim.addColorStop(0, css(0xb9b2a0));
  rim.addColorStop(1, css(0x4b463e));
  g.fillStyle = rim;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = css(0xd9d0b8);
  g.beginPath();
  g.arc(x, y, r * 0.8, 0, Math.PI * 2);
  g.fill();
  // red zone
  g.strokeStyle = css(0xb8412e, 0.9);
  g.lineWidth = r * 0.12;
  g.beginPath();
  g.arc(x, y, r * 0.66, -0.4, 0.5);
  g.stroke();
  g.strokeStyle = css(0x333028);
  g.lineWidth = Math.max(0.8, r * 0.05);
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * r * 0.58, y + Math.sin(a) * r * 0.58);
    g.lineTo(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72);
    g.stroke();
  }
  const na = Math.PI * 0.75 + rng.range(0.25, 0.85) * Math.PI * 1.5;
  g.strokeStyle = css(0x1b1b1b);
  g.lineWidth = Math.max(1, r * 0.08);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + Math.cos(na) * r * 0.62, y + Math.sin(na) * r * 0.62);
  g.stroke();
  // glass glint
  g.fillStyle = css(0xffffff, 0.22);
  g.beginPath();
  g.ellipse(x - r * 0.3, y - r * 0.35, r * 0.35, r * 0.18, -0.6, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** A sagging cable between two points. */
export function cable(g: Ctx, x0: number, y0: number, x1: number, y1: number, sag: number, width: number, color: number, highlight = 0.25): void {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2 + sag;
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = css(shade(color, -0.6), 0.9);
  g.lineWidth = width + 1.5;
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo(mx, my, x1, y1);
  g.stroke();
  g.strokeStyle = css(color);
  g.lineWidth = width;
  g.stroke();
  if (highlight > 0) {
    g.strokeStyle = css(shade(color, 0.5), highlight);
    g.lineWidth = Math.max(0.6, width * 0.3);
    g.beginPath();
    g.moveTo(x0, y0 - width * 0.25);
    g.quadraticCurveTo(mx, my - width * 0.25, x1, y1 - width * 0.25);
    g.stroke();
  }
  g.restore();
}

/** Bundle of cables with slight variations. */
export function cableBundle(g: Ctx, rng: Rand, x0: number, y0: number, x1: number, y1: number, sag: number, colors: readonly number[], width = 4): void {
  for (const c of colors) {
    cable(g, x0 + rng.range(-4, 4), y0 + rng.range(-3, 3), x1 + rng.range(-4, 4), y1 + rng.range(-3, 3), sag * rng.range(0.75, 1.25), width * rng.range(0.7, 1.2), c);
  }
}

/** A cable hanging from a point, ending in a loose curl. */
export function hangingCable(g: Ctx, rng: Rand, x: number, y: number, len: number, width: number, color: number): void {
  const sway = rng.range(-18, 18);
  g.save();
  g.lineCap = 'round';
  const path = new Path2D();
  path.moveTo(x, y);
  path.bezierCurveTo(x + sway * 0.2, y + len * 0.4, x + sway, y + len * 0.7, x + sway * 0.6, y + len);
  path.quadraticCurveTo(x + sway * 0.6 + 12, y + len + 14, x + sway * 0.6 + 16, y + len + 2);
  g.strokeStyle = css(shade(color, -0.6));
  g.lineWidth = width + 1.5;
  g.stroke(path);
  g.strokeStyle = css(color);
  g.lineWidth = width;
  g.stroke(path);
  g.restore();
}

// ---------------------------------------------------------------------------
// Lamps (paint fixture on `g`, glow on `light`)
// ---------------------------------------------------------------------------

export function hangingBulb(g: Ctx, light: Ctx, x: number, top: number, y: number, color: number, size: number, glow = 1): void {
  // cord
  g.save();
  g.strokeStyle = css(0x17130f);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, top);
  g.lineTo(x, y - size * 1.2);
  g.stroke();
  // socket
  g.fillStyle = css(0x2a2420);
  g.fillRect(x - size * 0.45, y - size * 1.4, size * 0.9, size * 0.8);
  g.fillStyle = css(0x6b5a44, 0.6);
  g.fillRect(x - size * 0.45, y - size * 1.4, size * 0.2, size * 0.8);
  // bulb
  const gr = g.createRadialGradient(x, y, 0, x, y, size);
  gr.addColorStop(0, css(0xfffbe8));
  gr.addColorStop(0.5, css(shade(color, 0.55)));
  gr.addColorStop(1, css(color));
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(x, y, size * 0.75, size, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  blob(g, x, y, size * 3, size * 3, color, 0.35 * glow);
  // light pools
  blob(light, x, y, size * 4, size * 4, shade(color, 0.3), 0.75 * glow, 0.1);
  blob(light, x, y + size * 10, size * 26, size * 20, color, 0.3 * glow);
}

/** Wall/ceiling fluorescent tube in a housing. */
export function tubeLamp(g: Ctx, light: Ctx, x: number, y: number, len: number, color: number, glow = 1, broken = false): void {
  g.save();
  g.fillStyle = css(0x24221f);
  g.fillRect(x - 4, y - 9, len + 8, 9);
  g.fillStyle = css(0x4a4640);
  g.fillRect(x - 4, y - 9, len + 8, 2);
  const gr = g.createLinearGradient(0, y - 1, 0, y + 7);
  const c = broken ? shade(color, -0.45) : color;
  gr.addColorStop(0, css(shade(c, 0.7)));
  gr.addColorStop(0.5, css(shade(c, 0.2)));
  gr.addColorStop(1, css(c));
  g.fillStyle = gr;
  g.fillRect(x, y - 1, len, 7);
  g.fillStyle = css(0x3a3631);
  g.fillRect(x - 3, y - 2, 6, 9);
  g.fillRect(x + len - 3, y - 2, 6, 9);
  g.restore();
  if (glow > 0) {
    blob(g, x + len / 2, y + 3, len * 0.7, 26, color, 0.25 * glow);
    blob(light, x + len / 2, y + 3, len * 0.6, 14, shade(color, 0.4), 0.8 * glow, 0.3);
    blob(light, x + len / 2, y + 50, len * 1.2, 170, color, 0.28 * glow);
  }
}

/** Downward cone of light (god ray) painted into the light layer. */
export function lightCone(light: Ctx, x: number, y: number, topW: number, botW: number, len: number, color: number, alpha: number, skew = 0): void {
  light.save();
  const gr = light.createLinearGradient(0, y, 0, y + len);
  gr.addColorStop(0, css(color, alpha));
  gr.addColorStop(1, css(color, 0));
  light.fillStyle = gr;
  light.beginPath();
  light.moveTo(x - topW / 2, y);
  light.lineTo(x + topW / 2, y);
  light.lineTo(x + botW / 2 + skew, y + len);
  light.lineTo(x - botW / 2 + skew, y + len);
  light.closePath();
  light.fill();
  light.restore();
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Box with lit top and side shading. Returns nothing; draws at (x, bottom). */
export function crateBox(g: Ctx, rng: Rand, x: number, bottom: number, w: number, h: number, color: number, tape = true): void {
  const y = bottom - h;
  const c = jitter(rng, color, 0.06);
  g.fillStyle = css(shade(c, -0.7));
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = vGrad(g, y, bottom, [[0, shade(c, 0.12)], [1, shade(c, -0.25)]]);
  g.fillRect(x, y, w, h);
  g.fillStyle = css(shade(c, 0.3), 0.6);
  g.fillRect(x, y, w, 2);
  g.fillStyle = css(shade(c, -0.4), 0.5);
  g.fillRect(x + w - 3, y, 3, h);
  if (tape) {
    g.fillStyle = css(shade(c, 0.22), 0.55);
    g.fillRect(x + w * 0.42, y, w * 0.16, h * 0.35);
  }
  if (rng.chance(0.4)) {
    g.fillStyle = css(0xe9e2cf, 0.45);
    g.fillRect(x + w * 0.15, y + h * 0.5, w * 0.3, h * 0.2);
  }
}

/** Shelf with brackets and assorted items. */
export function shelf(g: Ctx, rng: Rand, x: number, y: number, w: number, plank: number, items: readonly number[], density = 1): void {
  // brackets
  g.fillStyle = css(0x2d2924);
  for (const bx of [x + 8, x + w - 14]) {
    g.beginPath();
    g.moveTo(bx, y);
    g.lineTo(bx + 6, y);
    g.lineTo(bx + 6, y + 22);
    g.closePath();
    g.fill();
  }
  // items
  let cx = x + rng.range(4, 14);
  while (cx < x + w - 14) {
    if (!rng.chance(density)) {
      cx += rng.range(10, 24);
      continue;
    }
    const kind = rng.int(0, 3);
    const col = jitter(rng, rng.pick(items), 0.08);
    if (kind === 0) {
      // jar
      const jw = rng.range(10, 16), jh = rng.range(14, 22);
      g.fillStyle = css(shade(col, -0.6));
      g.fillRect(cx - 1, y - jh - 1, jw + 2, jh + 1);
      g.fillStyle = hGrad(g, cx, cx + jw, [[0, shade(col, -0.1)], [0.35, shade(col, 0.3)], [1, shade(col, -0.35)]]);
      g.fillRect(cx, y - jh, jw, jh);
      g.fillStyle = css(0x3a3530);
      g.fillRect(cx - 1, y - jh - 4, jw + 2, 4);
      cx += jw + rng.range(2, 6);
    } else if (kind === 1) {
      // can
      const jw = rng.range(14, 22), jh = rng.range(16, 26);
      g.fillStyle = css(shade(col, -0.6));
      g.fillRect(cx - 1, y - jh - 1, jw + 2, jh + 1);
      g.fillStyle = hGrad(g, cx, cx + jw, [[0, shade(col, -0.2)], [0.3, shade(col, 0.2)], [1, shade(col, -0.45)]]);
      g.fillRect(cx, y - jh, jw, jh);
      g.fillStyle = css(0xd8cfb8, 0.55);
      g.fillRect(cx, y - jh * 0.65, jw, jh * 0.3);
      cx += jw + rng.range(2, 6);
    } else if (kind === 2) {
      const bw = rng.range(20, 34), bh = rng.range(14, 26);
      crateBox(g, rng, cx, y, bw, bh, col, rng.chance(0.5));
      cx += bw + rng.range(2, 6);
    } else {
      // bottle
      const bw = rng.range(7, 10), bh = rng.range(20, 28);
      g.fillStyle = css(shade(col, -0.6));
      g.fillRect(cx - 1, y - bh, bw + 2, bh);
      g.fillStyle = hGrad(g, cx, cx + bw, [[0, shade(col, -0.1)], [0.35, shade(col, 0.35)], [1, shade(col, -0.4)]]);
      g.fillRect(cx, y - bh * 0.7, bw, bh * 0.7);
      g.fillRect(cx + bw * 0.3, y - bh, bw * 0.4, bh * 0.35);
      cx += bw + rng.range(3, 7);
    }
  }
  // plank
  g.fillStyle = css(0x1f1a15);
  g.fillRect(x - 1, y - 1, w + 2, plank + 3);
  g.fillStyle = vGrad(g, y, y + plank, [[0, 0x8a6a48], [1, 0x50392a]]);
  g.fillRect(x, y, w, plank);
  g.fillStyle = css(0xc09a6a, 0.5);
  g.fillRect(x, y, w, 1.5);
  blob(g, x + w / 2, y + plank + 8, w * 0.55, 10, 0x000000, 0.28);
}

/** Leaf shape at origin pointing along +x. */
function leafPath(len: number, wid: number): Path2D {
  const p = new Path2D();
  p.moveTo(0, 0);
  p.quadraticCurveTo(len * 0.45, -wid, len, 0);
  p.quadraticCurveTo(len * 0.45, wid, 0, 0);
  return p;
}

/** Cluster of painterly leaves radiating from (x, y). */
export function leafCluster(g: Ctx, rng: Rand, x: number, y: number, r: number, colors: readonly number[], count = 12, angle0 = -Math.PI, angle1 = 0): void {
  for (let i = 0; i < count; i++) {
    const a = rng.range(angle0, angle1);
    const len = r * rng.range(0.55, 1);
    const wid = len * rng.range(0.22, 0.36);
    const c = jitter(rng, rng.pick(colors), 0.08);
    const p = leafPath(len, wid);
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = css(shade(c, -0.55));
    g.translate(1, 1.5);
    g.fill(p);
    g.translate(-1, -1.5);
    const gr = g.createLinearGradient(0, -wid, 0, wid);
    gr.addColorStop(0, css(shade(c, 0.22)));
    gr.addColorStop(1, css(shade(c, -0.25)));
    g.fillStyle = gr;
    g.fill(p);
    g.strokeStyle = css(shade(c, -0.35), 0.6);
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(len * 0.9, 0);
    g.stroke();
    g.restore();
  }
}

/** Terracotta pot with plant. */
export function pottedPlant(g: Ctx, rng: Rand, cx: number, bottom: number, potW: number, leafColors: readonly number[], potColor = 0xa65a3a): void {
  const ph = potW * 0.85;
  const top = bottom - ph;
  leafCluster(g, rng, cx, top + 2, potW * rng.range(0.9, 1.5), leafColors, rng.int(9, 16), -Math.PI * 0.95, -Math.PI * 0.05);
  g.fillStyle = css(shade(potColor, -0.65));
  g.beginPath();
  g.moveTo(cx - potW / 2 - 1, top - 1);
  g.lineTo(cx + potW / 2 + 1, top - 1);
  g.lineTo(cx + potW * 0.36 + 1, bottom + 1);
  g.lineTo(cx - potW * 0.36 - 1, bottom + 1);
  g.closePath();
  g.fill();
  g.fillStyle = hGrad(g, cx - potW / 2, cx + potW / 2, [[0, shade(potColor, -0.15)], [0.35, shade(potColor, 0.18)], [1, shade(potColor, -0.4)]]);
  g.beginPath();
  g.moveTo(cx - potW / 2, top);
  g.lineTo(cx + potW / 2, top);
  g.lineTo(cx + potW * 0.36, bottom);
  g.lineTo(cx - potW * 0.36, bottom);
  g.closePath();
  g.fill();
  g.fillStyle = css(shade(potColor, 0.1));
  g.fillRect(cx - potW / 2 - 2, top, potW + 4, ph * 0.2);
  g.fillStyle = css(shade(potColor, -0.35), 0.6);
  g.fillRect(cx - potW / 2 - 2, top + ph * 0.2 - 1.5, potW + 4, 1.5);
}

// ---------------------------------------------------------------------------
// Earth: soil, rocks, roots
// ---------------------------------------------------------------------------

export interface SoilPalette {
  top: number;
  mid: number;
  deep: number;
  rock: number;
  root: number;
}

export function rock(g: Ctx, rng: Rand, x: number, y: number, r: number, color: number): void {
  const n = rng.int(6, 9);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const rr = r * rng.range(0.7, 1.05);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.72]);
  }
  const c = jitter(rng, color, 0.08);
  const p = poly(pts);
  g.save();
  g.fillStyle = css(shade(c, -0.7), 0.7);
  g.translate(1.5, 2);
  g.fill(p);
  g.translate(-1.5, -2);
  const gr = g.createLinearGradient(x - r, y - r, x + r * 0.6, y + r);
  gr.addColorStop(0, css(shade(c, 0.28)));
  gr.addColorStop(0.55, css(c));
  gr.addColorStop(1, css(shade(c, -0.45)));
  g.fillStyle = gr;
  g.fill(p);
  // facet line
  g.strokeStyle = css(shade(c, -0.4), 0.5);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  g.lineTo(x + rng.range(-r, r) * 0.3, y + rng.range(-r, r) * 0.3);
  g.lineTo(pts[Math.floor(n / 2)][0], pts[Math.floor(n / 2)][1]);
  g.stroke();
  g.restore();
}

export function roots(g: Ctx, rng: Rand, x: number, y: number, len: number, width: number, color: number, depth = 3): void {
  g.save();
  g.lineCap = 'round';
  const grow = (sx: number, sy: number, ang: number, l: number, w: number, d: number): void => {
    const steps = 5;
    let px = sx, py = sy, a = ang;
    g.strokeStyle = css(color, 0.85);
    for (let i = 0; i < steps; i++) {
      a += rng.range(-0.35, 0.35);
      const nx = px + Math.cos(a) * (l / steps);
      const ny = py + Math.sin(a) * (l / steps);
      g.lineWidth = Math.max(0.6, w * (1 - i / steps));
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(nx, ny);
      g.stroke();
      if (d > 0 && rng.chance(0.35)) grow(nx, ny, a + rng.range(-0.9, 0.9), l * 0.5, w * 0.55, d - 1);
      px = nx;
      py = ny;
    }
  };
  grow(x, y, Math.PI / 2 + rng.range(-0.5, 0.5), len, width, depth);
  g.restore();
}

/**
 * Paint a soil cutaway band (strata, pebbles, rocks, roots) into a rect.
 * `surfaceY` is where roots start growing from.
 */
export function soil(g: Ctx, rng: Rand, x: number, y: number, w: number, h: number, pal: SoilPalette, opts: { rocks?: number; roots?: number; surfaceY?: number } = {}): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = vGrad(g, y, y + h, [[0, pal.top], [0.45, pal.mid], [1, pal.deep]]);
  g.fillRect(x, y, w, h);
  // wavy strata
  const bands = Math.max(3, Math.round(h / 55));
  for (let i = 0; i < bands; i++) {
    const by = y + (i + rng.range(0.2, 0.8)) * (h / bands);
    const c = rng.chance(0.5) ? shade(pal.mid, rng.range(-0.25, -0.1)) : shade(pal.mid, rng.range(0.04, 0.12));
    g.fillStyle = css(c, rng.range(0.25, 0.45));
    g.beginPath();
    g.moveTo(x, by);
    const segs = Math.ceil(w / 120);
    for (let s = 0; s <= segs; s++) {
      g.lineTo(x + (s / segs) * w, by + rng.range(-7, 7));
    }
    for (let s = segs; s >= 0; s--) {
      g.lineTo(x + (s / segs) * w, by + rng.range(6, 18));
    }
    g.closePath();
    g.fill();
  }
  texture(g, 'mottle', x, y, w, h, { alpha: 0.55, op: 'soft-light', scale: 1.2 });
  texture(g, 'speckle', x, y, w, h, { alpha: 0.7, scale: 1 });
  texture(g, 'grain', x, y, w, h, { alpha: 0.25, op: 'overlay', scale: 1 });
  // pebbles
  const area = (w * h) / 10000;
  for (let i = 0; i < area * 1.4; i++) {
    const px = rng.range(x, x + w), py = rng.range(y, y + h);
    const pr = rng.range(1.5, 4);
    g.fillStyle = css(jitter(rng, shade(pal.rock, rng.range(-0.2, 0.2)), 0.1), 0.85);
    g.beginPath();
    g.ellipse(px, py, pr, pr * 0.7, rng.range(0, 3), 0, Math.PI * 2);
    g.fill();
  }
  const rocks = opts.rocks ?? area * 0.12;
  for (let i = 0; i < rocks; i++) {
    rock(g, rng, rng.range(x, x + w), rng.range(y + 10, y + h), rng.range(7, 22), pal.rock);
  }
  const sy = opts.surfaceY;
  if (sy !== undefined) {
    const nr = opts.roots ?? w / 90;
    for (let i = 0; i < nr; i++) roots(g, rng, rng.range(x, x + w), sy + rng.range(0, 6), rng.range(30, 90), rng.range(1.2, 3), pal.root);
  }
  g.restore();
}

/** Grass/turf lip along a surface line, with tufts. */
export function turf(g: Ctx, rng: Rand, x0: number, x1: number, y: number, grass: number, soilTop: number): void {
  g.save();
  g.fillStyle = css(shade(soilTop, -0.15));
  g.fillRect(x0, y, x1 - x0, 10);
  g.fillStyle = vGrad(g, y - 6, y + 8, [[0, shade(grass, 0.1)], [1, shade(grass, -0.4)]]);
  g.beginPath();
  g.moveTo(x0, y + 8);
  for (let x = x0; x <= x1; x += 10) g.lineTo(x, y - rng.range(0, 6));
  g.lineTo(x1, y + 8);
  g.closePath();
  g.fill();
  g.lineCap = 'round';
  for (let x = x0; x < x1; x += rng.range(3, 9)) {
    const c = jitter(rng, grass, 0.15);
    g.strokeStyle = css(c, 0.9);
    g.lineWidth = rng.range(1, 2.2);
    const h = rng.range(5, rng.chance(0.1) ? 26 : 14);
    g.beginPath();
    g.moveTo(x, y + 2);
    g.quadraticCurveTo(x + rng.range(-3, 3), y - h * 0.5, x + rng.range(-6, 6), y - h);
    g.stroke();
  }
  g.restore();
}

/** Concrete cut face with aggregate and rebar ends. */
export function concreteCut(g: Ctx, rng: Rand, x: number, y: number, w: number, h: number, color: number, rebar = true): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = vGrad(g, y, y + h, [[0, shade(color, 0.06)], [1, shade(color, -0.12)]]);
  g.fillRect(x, y, w, h);
  texture(g, 'mottle', x, y, w, h, { alpha: 0.4, op: 'soft-light', scale: 0.6 });
  texture(g, 'speckle', x, y, w, h, { alpha: 0.9, scale: 0.7 });
  const n = (w * h) / 260;
  for (let i = 0; i < n; i++) {
    g.fillStyle = css(jitter(rng, shade(color, rng.range(-0.3, 0.15)), 0.05), 0.7);
    g.beginPath();
    g.ellipse(rng.range(x, x + w), rng.range(y, y + h), rng.range(0.8, 2.6), rng.range(0.6, 2), rng.range(0, 3), 0, Math.PI * 2);
    g.fill();
  }
  if (rebar) {
    const horizontal = w > h;
    const len = horizontal ? w : h;
    const n2 = Math.floor(len / 70);
    for (let i = 0; i < n2; i++) {
      const t = (i + 0.5) / n2;
      const px = horizontal ? x + t * w : x + w * rng.range(0.3, 0.7);
      const py = horizontal ? y + h * rng.range(0.3, 0.7) : y + t * h;
      g.fillStyle = css(0x3b2a1f);
      g.beginPath();
      g.arc(px, py, 3, 0, Math.PI * 2);
      g.fill();
      blob(g, px + 1, py + 4, 4, 9, 0x6b3a1e, 0.35);
    }
  }
  // cracks
  for (let i = 0; i < Math.max(1, len2(w, h) / 300); i++) crack(g, rng, rng.range(x, x + w), rng.range(y, y + h), rng.range(15, 45), 0x2b2724, 0.55);
  g.restore();
}

function len2(w: number, h: number): number {
  return Math.max(w, h);
}

export function crack(g: Ctx, rng: Rand, x: number, y: number, len: number, color: number, alpha: number): void {
  g.save();
  g.strokeStyle = css(color, alpha);
  g.lineWidth = 1;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x, y);
  let a = rng.range(0, Math.PI * 2);
  let px = x, py = y;
  for (let i = 0; i < 6; i++) {
    a += rng.range(-0.7, 0.7);
    px += Math.cos(a) * len / 6;
    py += Math.sin(a) * len / 6;
    g.lineTo(px, py);
    if (rng.chance(0.25)) {
      g.moveTo(px, py);
      g.lineTo(px + Math.cos(a + 1) * len / 6, py + Math.sin(a + 1) * len / 6);
      g.moveTo(px, py);
    }
  }
  g.stroke();
  g.restore();
}

// ---------------------------------------------------------------------------
// Wall surfaces
// ---------------------------------------------------------------------------

/** Brick courses within a rect. */
export function bricks(g: Ctx, rng: Rand, x: number, y: number, w: number, h: number, color: number, mortar: number, bw = 44, bh = 18): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = css(mortar);
  g.fillRect(x, y, w, h);
  let row = 0;
  for (let by = y; by < y + h; by += bh) {
    const off = row % 2 ? bw / 2 : 0;
    for (let bx = x - off; bx < x + w; bx += bw) {
      const c = jitter(rng, color, 0.12);
      g.fillStyle = css(c);
      g.fillRect(bx + 1.5, by + 1.5, bw - 3, bh - 3);
      g.fillStyle = css(shade(c, 0.18), 0.5);
      g.fillRect(bx + 1.5, by + 1.5, bw - 3, 1.5);
      g.fillStyle = css(shade(c, -0.3), 0.5);
      g.fillRect(bx + 1.5, by + bh - 3, bw - 3, 1.5);
    }
    row++;
  }
  texture(g, 'mottle', x, y, w, h, { alpha: 0.45, op: 'soft-light', scale: 0.8 });
  g.restore();
}

/** Glazed tiles with grout. */
export function tiles(g: Ctx, rng: Rand, x: number, y: number, w: number, h: number, color: number, grout: number, size = 30, missing = 0.02): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = css(grout);
  g.fillRect(x, y, w, h);
  for (let ty = y; ty < y + h; ty += size) {
    for (let tx = x; tx < x + w; tx += size) {
      if (rng.chance(missing)) {
        g.fillStyle = css(shade(grout, -0.35));
        g.fillRect(tx + 1, ty + 1, size - 2, size - 2);
        texture(g, 'speckle', tx + 1, ty + 1, size - 2, size - 2, { alpha: 0.9 });
        continue;
      }
      const c = jitter(rng, color, 0.04);
      g.fillStyle = vGrad(g, ty, ty + size, [[0, shade(c, 0.07)], [1, shade(c, -0.06)]]);
      g.fillRect(tx + 1, ty + 1, size - 2, size - 2);
      g.fillStyle = css(0xffffff, 0.12);
      g.fillRect(tx + 2, ty + 2, size - 4, 1.2);
      if (rng.chance(0.03)) crack(g, rng, tx + size / 2, ty + size / 2, size * 0.8, 0x2a2a2a, 0.5);
    }
  }
  g.restore();
}

/** Riveted sheet-metal panel. */
export function metalPanel(g: Ctx, rng: Rand, x: number, y: number, w: number, h: number, color: number, rivets = true): void {
  const c = jitter(rng, color, 0.035);
  g.fillStyle = vGrad(g, y, y + h, [[0, shade(c, 0.05)], [1, shade(c, -0.1)]]);
  g.fillRect(x, y, w, h);
  bevel(g, x + 0.5, y + 0.5, w - 1, h - 1, shade(c, 0.35), shade(c, -0.55), 0.55, 1.5);
  if (rivets) {
    const r = 2;
    rivetRow(g, x + 7, x + w - 7, y + 7, Math.max(24, (w - 14) / Math.max(1, Math.round((w - 14) / 40))), r, shade(c, -0.05));
    rivetRow(g, x + 7, x + w - 7, y + h - 7, Math.max(24, (w - 14) / Math.max(1, Math.round((w - 14) / 40))), r, shade(c, -0.05));
  }
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export function monitor(g: Ctx, light: Ctx, rng: Rand, x: number, y: number, w: number, h: number, screen: number, glow = 1, dead = false): void {
  g.save();
  g.fillStyle = css(0x111315);
  g.fillRect(x - 6, y - 6, w + 12, h + 12);
  g.fillStyle = vGrad(g, y - 5, y + h + 5, [[0, 0x3d4247], [1, 0x23272b]]);
  g.fillRect(x - 5, y - 5, w + 10, h + 10);
  if (dead) {
    g.fillStyle = css(0x0e1416);
    g.fillRect(x, y, w, h);
    g.fillStyle = css(0xffffff, 0.06);
    g.fillRect(x + 3, y + 3, w * 0.4, h * 0.25);
    g.restore();
    return;
  }
  g.fillStyle = vGrad(g, y, y + h, [[0, shade(screen, -0.55)], [1, shade(screen, -0.75)]]);
  g.fillRect(x, y, w, h);
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const bright = shade(screen, 0.25);
  g.strokeStyle = css(bright, 0.85);
  g.fillStyle = css(bright, 0.75);
  g.lineWidth = 1.2;
  const mode = rng.int(0, 2);
  if (mode === 0) {
    // waveform
    g.beginPath();
    for (let i = 0; i <= w; i += 3) {
      const yy = y + h * 0.55 + Math.sin(i * 0.12 + rng.range(0, 1)) * h * 0.18 * Math.sin(i * 0.02);
      i ? g.lineTo(x + i, yy) : g.moveTo(x + i, yy);
    }
    g.stroke();
    g.fillRect(x + 4, y + 4, w * 0.35, 2);
  } else if (mode === 1) {
    // text lines
    for (let ly = y + 5; ly < y + h - 4; ly += 5) g.fillRect(x + 4, ly, rng.range(w * 0.2, w * 0.8), 1.6);
  } else {
    // bars
    const n = 6;
    for (let i = 0; i < n; i++) {
      const bh = rng.range(0.2, 0.8) * (h - 10);
      g.fillRect(x + 5 + (i * (w - 10)) / n, y + h - 5 - bh, (w - 10) / n - 3, bh);
    }
  }
  // scanlines
  g.fillStyle = css(0x000000, 0.18);
  for (let ly = y; ly < y + h; ly += 3) g.fillRect(x, ly, w, 1);
  g.fillStyle = css(0xffffff, 0.07);
  g.fillRect(x, y, w, h * 0.35);
  g.restore();
  blob(g, x + w / 2, y + h / 2, w * 0.9, h * 0.9, screen, 0.12 * glow);
  blob(light, x + w / 2, y + h / 2, w * 0.9, h * 1.1, screen, 0.45 * glow, 0.2);
}

export function led(g: Ctx, light: Ctx, x: number, y: number, color: number, on = true, r = 2.4): void {
  g.fillStyle = css(0x111111);
  g.beginPath();
  g.arc(x, y, r + 1, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = css(on ? shade(color, 0.3) : shade(color, -0.6));
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  if (on) blob(light, x, y, r * 5, r * 5, color, 0.6, 0.2);
}

/** Vent grille (round or rect) — fan blades optional. */
export function ventGrille(g: Ctx, x: number, y: number, r: number, frame: number): void {
  g.save();
  g.fillStyle = css(shade(frame, -0.7));
  g.beginPath();
  g.arc(x + 2, y + 3, r + 4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hGrad(g, x - r, x + r, [[0, shade(frame, 0.2)], [1, shade(frame, -0.35)]]);
  g.beginPath();
  g.arc(x, y, r + 4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = css(0x0e0e0e);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = css(shade(frame, -0.2));
  g.lineWidth = 2;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.clip();
  for (let yy = y - r; yy < y + r; yy += 6) {
    g.beginPath();
    g.moveTo(x - r, yy);
    g.lineTo(x + r, yy);
    g.stroke();
  }
  g.restore();
}

/** Simple dark silhouette shape helper for near layer: fill with rim light on one side. */
export function silhouette(g: Ctx, path: Path2D, base: number, rim: number, rimDx = -2, rimDy = -2, rimAlpha = 0.35): void {
  g.save();
  g.fillStyle = css(rim, rimAlpha);
  g.translate(rimDx, rimDy);
  g.fill(path);
  g.translate(-rimDx, -rimDy);
  g.fillStyle = css(base);
  g.fill(path);
  g.clip(path);
  // soft painted variation + faint inner rim glow so shapes are not flat cut-outs
  texture(g, 'mottle', -6000, -6000, 12000, 12000, { alpha: 0.12, op: 'screen', scale: 1.4 });
  g.translate(rimDx * 2, rimDy * 2);
  g.strokeStyle = css(rim, rimAlpha * 0.35);
  g.lineWidth = 8;
  g.stroke(path);
  g.restore();
}
