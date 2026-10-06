// Per-theme skins for part art. A skin is applied once, at paint time, to the canvas a painter
// produced (TextureBank caches the result per theme), so the painters stay theme-agnostic and the
// simulation never knows. Every skin keeps the silhouette, size and origin of the texture exactly
// (sockets, ports and hit shapes are drawn elsewhere and unchanged); it only regrades colour and
// adds an edge treatment inside the shape. Pure pixel maths lives in `gradePixels` so it can be
// unit-tested without a canvas.

import type { ThemeId } from '../core/themes';

// ------------------------------------------------------------------ rooms

/** The room each theme dresses a mission in. `null` keeps the level's own environment. */
export const THEME_ROOM: Record<ThemeId, string | null> = {
  retro: 'toolbox',
  stone: 'cave',
  steam: 'foundry',
  modern: null,
  comic: 'rooftop',
  future: 'neonlab',
};

export const roomFor = (theme: ThemeId, environment: string): string => THEME_ROOM[theme] ?? environment;

// ------------------------------------------------------------------ rims

export interface RimStyle {
  /** Halo width in world px. */
  width: number;
  color: string;
  /** Optional soft outer glow drawn before the rim (future theme). */
  glow?: { width: number; color: string };
}

/** The contrast halo drawn under every part (see DECISIONS.md, "Room dressing is knocked back"). */
export const RIM_STYLE: Record<ThemeId, RimStyle> = {
  modern: { width: 1.6, color: 'rgba(12, 8, 6, 0.88)' },
  retro: { width: 2.2, color: 'rgba(0, 0, 0, 1)' },
  comic: { width: 2.1, color: 'rgba(8, 8, 20, 1)' },
  stone: { width: 1.8, color: 'rgba(30, 18, 8, 0.92)' },
  steam: { width: 1.8, color: 'rgba(28, 14, 4, 0.92)' },
  future: { width: 1.3, color: 'rgba(3, 8, 22, 0.94)', glow: { width: 3.6, color: 'rgba(70, 225, 255, 0.34)' } },
};

// ------------------------------------------------------------------ colour helpers

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const luma = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h: number;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  if (s <= 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const k = h / 360;
  return [f(k + 1 / 3) * 255, f(k) * 255, f(k - 1 / 3) * 255];
}

/** Piecewise-linear colour ramp over [0,1]. */
function ramp(stops: [number, number][], t: number): [number, number, number] {
  t = clamp01(t);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const k = (t - t0) / Math.max(1e-6, t1 - t0);
      return [
        ((c0 >> 16) & 255) + ((((c1 >> 16) & 255) - ((c0 >> 16) & 255)) * k),
        ((c0 >> 8) & 255) + ((((c1 >> 8) & 255) - ((c0 >> 8) & 255)) * k),
        (c0 & 255) + (((c1 & 255) - (c0 & 255)) * k),
      ];
    }
  }
  const c = stops[stops.length - 1][1];
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

/** Deterministic per-pixel hash noise in [0,1). */
const hash2 = (x: number, y: number, seed: number) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Smooth value noise (bilinear over hash2 lattice). */
const vnoise = (x: number, y: number, seed: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

const EARTH: [number, number][] = [
  [0, 0x22170f],
  [0.32, 0x5a4330],
  [0.6, 0x9a7d58],
  [0.82, 0xc9b48c],
  [1, 0xefe4c8],
];
const BRASS: [number, number][] = [
  [0, 0x1e1007],
  [0.3, 0x5e3518],
  [0.55, 0xa8652e],
  [0.75, 0xd2a050],
  [0.9, 0xeccf86],
  [1, 0xfbf0cc],
];
/** Hues the comic skin leans towards: the bold primaries of a four-colour press. */
const COMIC_HUES = [2, 26, 48, 130, 205, 225, 290];

// ------------------------------------------------------------------ distance to edge

/**
 * Chamfer distance (in px) from each opaque pixel (alpha >= 128) to the nearest transparent one,
 * treating everything outside the image as transparent. Transparent pixels get 0.
 */
export function edgeDistance(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = data[i * 4 + 3] >= 128 ? INF : 0;
  const A = 1;
  const B = 1.4142;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let v = d[i];
      // neighbours outside the image are transparent (distance 0)
      v = Math.min(v, (x > 0 ? d[i - 1] : 0) + A);
      v = Math.min(v, (y > 0 ? d[i - w] : 0) + A);
      v = Math.min(v, (x > 0 && y > 0 ? d[i - w - 1] : 0) + B);
      v = Math.min(v, (x < w - 1 && y > 0 ? d[i - w + 1] : 0) + B);
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let v = d[i];
      v = Math.min(v, (x < w - 1 ? d[i + 1] : 0) + A);
      v = Math.min(v, (y < h - 1 ? d[i + w] : 0) + A);
      v = Math.min(v, (x < w - 1 && y < h - 1 ? d[i + w + 1] : 0) + B);
      v = Math.min(v, (x > 0 && y < h - 1 ? d[i + w - 1] : 0) + B);
      d[i] = v;
    }
  }
  return d;
}

// ------------------------------------------------------------------ the grade

export interface GradeOpts {
  /** Canvas px per world px (2 for scene textures, more for icons). */
  scale: number;
  /** Seed for grain. */
  seed?: number;
  /** Skip the edge treatment (thin overlays). */
  noEdge?: boolean;
  /** Translucent pixels are a soft shadow, not the antialiased silhouette (parts-bin icons). */
  softShadow?: boolean;
}

/**
 * Regrade RGBA pixels in place for a theme. Alpha is never changed, so silhouettes, sizes and
 * origins stay exactly as painted. 'modern' is the identity.
 */
export function gradePixels(theme: ThemeId, data: Uint8ClampedArray, w: number, h: number, o: GradeOpts): void {
  if (theme === 'modern') return;
  const s = o.scale;
  const seed = o.seed ?? 1;
  const dist = o.noEdge ? null : edgeDistance(data, w, h);
  const ink = (theme === 'retro' ? 1.15 : theme === 'comic' ? 0.95 : 0.65) * s;
  const dot = 3.1 * s; // comic halftone period
  // Flat-colour skins posterize a smoothed copy, so painted grain and speckle become flat fills
  // instead of noisy blotches.
  const flat = theme === 'retro' || theme === 'comic' ? smoothRGB(data, w, h, Math.max(1, Math.round(1.1 * s))) : null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a === 0) continue;
      let r = flat ? flat[i] : data[i];
      let g = flat ? flat[i + 1] : data[i + 1];
      let b = flat ? flat[i + 2] : data[i + 2];
      const L = luma(r, g, b);
      const e = dist ? dist[y * w + x] : 1e9;
      // a partly transparent pixel is the antialiased edge itself
      const soft = a < 128 && !o.softShadow;
      const atEdge = soft || (a >= 128 && e <= ink);
      switch (theme) {
        case 'retro': {
          let [hh, ss, ll] = rgbToHsl(r, g, b);
          hh = Math.round(hh / 15) * 15;
          ss = ss < 0.12 ? 0 : ss < 0.4 ? 0.42 : ss < 0.7 ? 0.68 : 0.9;
          ll = ll < 0.18 ? 0.12 : ll < 0.4 ? 0.3 : ll < 0.62 ? 0.52 : ll < 0.84 ? 0.72 : 0.94;
          [r, g, b] = hslToRgb(hh, ss, ll);
          if (atEdge) r = g = b = 0;
          break;
        }
        case 'comic': {
          let [hh, ss, ll] = rgbToHsl(r, g, b);
          if (ss > 0.15) {
            let best = COMIC_HUES[0];
            let bd = 999;
            for (const c of COMIC_HUES) {
              const dd = Math.abs(((hh - c + 540) % 360) - 180);
              if (dd < bd) (bd = dd), (best = c);
            }
            const dd = ((best - hh + 540) % 360) - 180;
            hh += dd * 0.4;
            ss = Math.min(1, ss * 1.45 + 0.08);
          }
          ll = ll < 0.2 ? 0.14 : ll < 0.45 ? 0.36 : ll < 0.7 ? 0.58 : ll < 0.9 ? 0.8 : 0.96;
          [r, g, b] = hslToRgb(hh, ss, ll);
          // halftone shading in the shadows, on a 45-degree screen
          const shadow = clamp01((0.56 - L) / 0.42);
          if (shadow > 0) {
            const u = (x + y) * 0.7071;
            const v = (x - y) * 0.7071;
            const du = (((u % dot) + dot) % dot) - dot / 2;
            const dv = (((v % dot) + dot) % dot) - dot / 2;
            const dd = Math.sqrt(du * du + dv * dv) / (dot / 2);
            if (dd < shadow * 1.05) {
              r *= 0.42;
              g *= 0.42;
              b = b * 0.42 + 14;
            }
          }
          if (atEdge) (r = 12), (g = 12), (b = 26);
          break;
        }
        case 'stone': {
          const grey = L * 255;
          const [er, eg, eb] = ramp(EARTH, L * 1.05);
          r = (r * 0.62 + grey * 0.38) * 0.58 + er * 0.42;
          g = (g * 0.62 + grey * 0.38) * 0.58 + eg * 0.42;
          b = (b * 0.62 + grey * 0.38) * 0.58 + eb * 0.42;
          // grain: fine speckle plus soft strata, like split rock or old wood
          const n = (hash2(x, y, seed) - 0.5) * 20 + (vnoise(x / (2.4 * s), y / (9 * s), seed) - 0.5) * 26;
          r += n;
          g += n * 0.92;
          b += n * 0.8;
          if (atEdge) {
            const k = 0.5;
            r *= k;
            g *= k;
            b *= k;
          }
          break;
        }
        case 'steam': {
          const [br, bg, bb] = ramp(BRASS, L * 1.08);
          r = r * 0.34 + br * 0.66;
          g = g * 0.34 + bg * 0.66;
          b = b * 0.3 + bb * 0.6;
          const n = (hash2(x, y, seed) - 0.5) * 8;
          r += n;
          g += n;
          b += n;
          if (atEdge) {
            r *= 0.42;
            g *= 0.36;
            b *= 0.3;
          } else if (e <= ink * 2.2) {
            // a polished bevel just inside the dark edge
            r = r + (255 - r) * 0.18;
            g = g + (230 - g) * 0.16;
            b = b + (170 - b) * 0.1;
          }
          break;
        }
        case 'future': {
          let [hh, ss, ll] = rgbToHsl(r, g, b);
          ss = Math.min(1, ss * 0.95);
          // contrast lift around the middle
          ll = clamp01(0.5 + (ll - 0.5) * 1.12);
          [r, g, b] = hslToRgb(hh, ss, ll);
          r = r * 0.84;
          g = g * 0.97 + 4;
          b = Math.min(255, b * 1.08 + 16);
          if (y % Math.max(2, Math.round(1.5 * s)) === 0) {
            r *= 0.93;
            g *= 0.95;
            b *= 0.97;
          }
          // neon rim light just inside the silhouette
          const rimW = 1.5 * s;
          if (soft || (a >= 128 && e <= rimW)) {
            const k = soft ? 0.85 : 0.8 * (1 - (e - 1) / rimW);
            r = r + (95 - r) * k;
            g = g + (240 - g) * k;
            b = b + (255 - b) * k;
          }
          break;
        }
      }
      data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
  }
}

/** Alpha-weighted box blur of the colour channels (two separable passes); alpha is ignored. */
function smoothRGB(data: Uint8ClampedArray, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h * 4);
  const out = new Float32Array(w * h * 4);
  const pass = (src: ArrayLike<number>, dst: Float32Array, horizontal: boolean) => {
    const n = horizontal ? w : h;
    const m = horizontal ? h : w;
    for (let j = 0; j < m; j++) {
      let sr = 0, sg = 0, sb = 0, sa = 0;
      const idx = (k: number) => (horizontal ? j * w + k : k * w + j) * 4;
      for (let k = -r; k <= r; k++) {
        if (k < 0 || k >= n) continue;
        const q = idx(k);
        const a = data[q + 3];
        sr += src[q] * a; sg += src[q + 1] * a; sb += src[q + 2] * a; sa += a;
      }
      for (let k = 0; k < n; k++) {
        const q = idx(k);
        if (sa > 0) {
          dst[q] = sr / sa; dst[q + 1] = sg / sa; dst[q + 2] = sb / sa;
        } else {
          dst[q] = src[q]; dst[q + 1] = src[q + 1]; dst[q + 2] = src[q + 2];
        }
        const add = k + r + 1, rem = k - r;
        if (add < n) {
          const qa = idx(add);
          const a = data[qa + 3];
          sr += src[qa] * a; sg += src[qa + 1] * a; sb += src[qa + 2] * a; sa += a;
        }
        if (rem >= 0) {
          const qr = idx(rem);
          const a = data[qr + 3];
          sr -= src[qr] * a; sg -= src[qr + 1] * a; sb -= src[qr + 2] * a; sa -= a;
        }
      }
    }
  };
  pass(data, tmp, true);
  pass(tmp, out, false);
  return out;
}

/** Rivet centres along a band just inside the silhouette (steam theme). */
export function rivetSpots(dist: Float32Array, w: number, h: number, scale: number): [number, number][] {
  const target = 3.2 * scale;
  const tol = 0.6 * scale;
  const step = Math.round(13 * scale);
  const out: [number, number][] = [];
  const minD2 = (step * 0.75) ** 2;
  for (let cy = 0; cy < h; cy += step) {
    for (let cx = 0; cx < w; cx += step) {
      let best = -1;
      let bestErr = tol;
      for (let y = cy; y < Math.min(h, cy + step); y++) {
        for (let x = cx; x < Math.min(w, cx + step); x++) {
          const err = Math.abs(dist[y * w + x] - target);
          if (err < bestErr) (bestErr = err), (best = y * w + x);
        }
      }
      if (best < 0) continue;
      const px = best % w;
      const py = Math.floor(best / w);
      if (out.some(([qx, qy]) => (qx - px) ** 2 + (qy - py) ** 2 < minD2)) continue;
      out.push([px, py]);
    }
  }
  return out;
}

// ------------------------------------------------------------------ canvas entry point

/** Texture keys painted as translucent overlays: regraded lightly, no edge treatment. */
const OVERLAY = /^(shine_|_flame)/;
/** Round or organic shapes where rivets would look wrong. */
const NO_RIVETS = /^(ball|bowling_ball|cannonball|balloon_|cactus|candle|glove|robot_|shine_|roller|pulley_wheel|motor_pinion|timer_hand|switch_lever|fan_blades|tool_|_flame)/;

/** Apply a theme skin to painted art. Returns the same canvas, regraded in place. */
export function skinCanvas(canvas: HTMLCanvasElement, theme: ThemeId, key: string, scale: number, icon = false): HTMLCanvasElement {
  if (theme === 'modern') return canvas;
  const w = canvas.width;
  const h = canvas.height;
  const g = canvas.getContext('2d');
  if (!g || w < 2 || h < 2) return canvas;
  // Read back through a scratch canvas made for it (the painter's context was not).
  let img: ImageData;
  try {
    const scratch = document.createElement('canvas');
    scratch.width = w;
    scratch.height = h;
    const sg = scratch.getContext('2d', { willReadFrequently: true })!;
    sg.drawImage(canvas, 0, 0);
    img = sg.getImageData(0, 0, w, h);
  } catch {
    return canvas;
  }
  const overlay = OVERLAY.test(key);
  let seed = 7;
  for (let i = 0; i < key.length; i++) seed = (Math.imul(seed, 31) + key.charCodeAt(i)) | 0;
  gradePixels(theme, img.data, w, h, { scale, seed, noEdge: overlay, softShadow: icon });
  g.putImageData(img, 0, 0);
  if (theme === 'steam' && !overlay && !NO_RIVETS.test(key) && w > 26 * scale && h > 14 * scale) {
    const dist = edgeDistance(img.data, w, h);
    const r = 1.05 * scale;
    for (const [x, y] of rivetSpots(dist, w, h, scale)) {
      g.fillStyle = 'rgba(30, 14, 4, 0.75)';
      g.beginPath();
      g.arc(x + r * 0.3, y + r * 0.35, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#b07a3a';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255, 236, 180, 0.85)';
      g.beginPath();
      g.arc(x - r * 0.3, y - r * 0.3, r * 0.42, 0, Math.PI * 2);
      g.fill();
    }
  }
  return canvas;
}
