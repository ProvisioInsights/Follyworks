/**
 * The secret arcade room ("Insert Coin", unlocked by the Konami code): an original pixel-art game
 * stage in the spirit of late-80s / early-90s cartridge games. A banded night sky with a starfield,
 * a big blocky moon and a little ringed planet, dim pixel clouds and stepped hills, a status strip
 * along the top, block-tile pillars at the sides and a floor of bevelled brick blocks.
 *
 * Everything is drawn as hard-edged rectangles on an 8 world-px grid (4 px for fine detail) from a
 * small flat palette; the only "gradient" is the banded sky. Same contract and readability rule as
 * the other rooms: the middle stays calm, dark and plain so parts read; detail lives at the top,
 * the corners and the edges; nothing is shaped like a part, a socket or a hook.
 *
 * It is a secret, so it is not listed in ENVIRONMENTS (the level editor) or THEME_ROOMS.
 */

import { type Ctx, type Rand, css } from './envHelpers';
import { ENV_MARGIN, type EnvDef, type EnvironmentInfo, type Painter } from './environment';

/** Display info (kept out of the public room lists; see the header). */
export const ARCADE_ROOM: EnvironmentInfo = {
  id: 'arcade',
  name: 'Bonus Stage',
  blurb: 'A starry pixel night, a blocky moon and a floor of bricks. Press start.',
  accent: 0xf8cc10,
};

/** The pixel grid, in world px. */
const U = 8;
/** Fine detail (text, stars, highlights). */
const H = U / 2;
const snap = (v: number, k = U): number => Math.round(v / k) * k;

// a small flat palette (original)
const SKY = [0x070818, 0x0a0c24, 0x0e1230, 0x12183c, 0x171e48, 0x1c2452];
const STAR = [0xf4f4f8, 0xffe890, 0x9cd8ff, 0xffb0d8];
const MOON = { base: 0xd8c88c, shade: 0xa8945c, crater: 0xb4a068, rim: 0xeee2b0, glow: 0x1a2258 };
const PLANET = { base: 0xc070e0, shade: 0x8848b0, ring: 0x7cf0dc, ringShade: 0x30a8a0 };
const CLOUD = { base: 0x262e64, hi: 0x343e7c };
const HILL_FAR = { base: 0x10243c, hi: 0x183450 };
const HILL_NEAR = { base: 0x0c1c2c, hi: 0x14303e, bush: 0x0a2420 };
const PALM = { trunk: 0x3a2a1c, trunkHi: 0x5a4028, leaf: 0x125a3a, leafHi: 0x1e7a48 };
const STONE = { base: 0x3a3460, hi: 0x5a5290, lo: 0x221e3e, mortar: 0x120e22 };
const BRICK = { base: 0xb4581c, hi: 0xf0a060, lo: 0x6a2808, mortar: 0x240c02, top: 0x40b840, topHi: 0x9ce85c, topLo: 0x1c6414 };
const STRIP = { bg: 0x05050f, line: 0x2c74f0, text: 0xf4f4f8, gold: 0xf8cc10, heart: 0xdc2c2c };

const X0 = () => -ENV_MARGIN.left;
const Y0 = () => -ENV_MARGIN.top;
const fullW = (P: Painter) => P.G.w + ENV_MARGIN.left + ENV_MARGIN.right;
const fullH = (P: Painter) => P.G.h + ENV_MARGIN.top + ENV_MARGIN.bottom;

function fill(g: Ctx, x: number, y: number, w: number, h: number, c: number, a = 1): void {
  g.fillStyle = css(c, a);
  g.fillRect(x, y, w, h);
}

/** A filled pixel disc: every `k` cell whose centre lies inside the circle. */
function pixelDisc(g: Ctx, cx: number, cy: number, r: number, c: number, k = U, test?: (dx: number, dy: number) => boolean): void {
  g.fillStyle = css(c);
  for (let y = snap(cy - r, k) - k; y <= cy + r; y += k) {
    for (let x = snap(cx - r, k) - k; x <= cx + r; x += k) {
      const dx = x + k / 2 - cx;
      const dy = y + k / 2 - cy;
      if (dx * dx + dy * dy <= r * r && (!test || test(dx, dy))) g.fillRect(x, y, k, k);
    }
  }
}

// ------------------------------------------------------------------ 5x7 pixel font (original)

const FONT: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

/** Width of `text` in world px at pixel size `k`. */
const textW = (text: string, k: number): number => text.length * 6 * k - k;

function pixelText(g: Ctx, text: string, x: number, y: number, k: number, c: number, shadow = 0x000000): void {
  for (const pass of [0, 1]) {
    g.fillStyle = css(pass ? c : shadow);
    const o = pass ? 0 : k;
    let cx = x;
    for (const ch of text) {
      const rows = FONT[ch] ?? FONT[' '];
      for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (rows[r][q] === '1') g.fillRect(cx + q * k + o, y + r * k + o, k, k);
      cx += 6 * k;
    }
  }
}

/** A tiny pixel heart (a "lives" icon), 7x6 cells. */
function heart(g: Ctx, x: number, y: number, k: number, c: number): void {
  const rows = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
  g.fillStyle = css(0x000000);
  rows.forEach((row, r) => [...row].forEach((b, q) => b === '1' && g.fillRect(x + q * k + k, y + r * k + k, k, k)));
  g.fillStyle = css(c);
  rows.forEach((row, r) => [...row].forEach((b, q) => b === '1' && g.fillRect(x + q * k, y + r * k, k, k)));
  g.fillStyle = css(0xffffff, 0.85);
  g.fillRect(x + k, y + k, k, k);
}

// ------------------------------------------------------------------ pieces

/** Banded night sky over a rect: hard horizontal bands, darkest at the top. */
function bandedSky(g: Ctx, x: number, y0: number, w: number, y1: number): void {
  const n = SKY.length;
  const bandH = snap((y1 - y0) / n, U);
  for (let i = 0; i < n; i++) {
    const top = y0 + i * bandH;
    fill(g, x, top, w, i === n - 1 ? y1 - top + U : bandH, SKY[i]);
    // a dithered seam into the next band, the old-school way
    if (i < n - 1) {
      g.fillStyle = css(SKY[i + 1]);
      for (let xx = snap(x, U); xx < x + w; xx += U) g.fillRect(xx + ((xx / U) % 2 === 0 ? 0 : H), top + bandH - H, H, H);
    }
  }
}

/** Stars: sparse single pixels and a few plus-shaped twinkles, thinning out toward the centre. */
function stars(P: Painter, rng: Rand, x: number, y: number, w: number, h: number, n: number): void {
  const { far: g, G } = P;
  for (let i = 0; i < n; i++) {
    const sx = snap(rng.range(x, x + w), H);
    const sy = snap(rng.range(y, y + h), H);
    // keep the middle of the room calm: fewer and dimmer stars there
    const dx = (sx - G.w / 2) / (G.w / 2);
    const dy = (sy - G.h * 0.5) / (G.h / 2);
    const centre = Math.max(0, 1 - Math.hypot(dx * 0.9, dy * 1.3));
    if (rng.chance(centre * 0.85)) continue;
    const c = rng.pick(STAR);
    const a = 0.45 + 0.5 * rng.next() * (1 - centre);
    if (rng.chance(0.1) && centre < 0.3) {
      fill(g, sx - H, sy, H * 3, H, c, a * 0.6);
      fill(g, sx, sy - H, H, H * 3, c, a * 0.6);
      fill(g, sx, sy, H, H, 0xffffff, a);
    } else fill(g, sx, sy, H, H, c, a);
  }
}

/** The big blocky moon with craters, a shaded crescent and a stepped glow ring. */
function moon(g: Ctx, cx: number, cy: number, r: number): void {
  pixelDisc(g, cx, cy, r + U * 2.2, MOON.glow);
  pixelDisc(g, cx, cy, r + U * 0.9, 0x2a3678);
  pixelDisc(g, cx, cy, r, MOON.base);
  // shaded crescent lower-left (outside a disc shifted up-right)
  pixelDisc(g, cx, cy, r, MOON.shade, U, (dx, dy) => (dx - r * 0.24) ** 2 + (dy + r * 0.24) ** 2 > (r * 0.98) ** 2);
  // a lit rim upper-right
  pixelDisc(g, cx, cy, r, MOON.rim, H, (dx, dy) => dx * dx + dy * dy > (r - H * 1.5) ** 2 && dx - dy > r * 0.7);
  for (const [ox, oy, rr] of [[-0.35, -0.2, 0.22], [0.2, 0.25, 0.16], [0.42, -0.05, 0.1], [-0.1, 0.5, 0.12]] as const) {
    pixelDisc(g, cx + ox * r, cy + oy * r, rr * r, MOON.crater, H);
    pixelDisc(g, cx + ox * r - H, cy + oy * r - H, rr * r * 0.65, MOON.shade, H);
  }
}

/** A small ringed planet: the ring passes behind the disc at the top and in front at the bottom. */
function planet(g: Ctx, cx: number, cy: number, r: number): void {
  const ringCells: [number, number, boolean][] = [];
  for (let x = snap(cx - r * 2, H); x <= cx + r * 2; x += H) {
    const t = (x + H / 2 - cx) / (r * 2);
    const yy = snap(cy + t * r * 0.5 - H / 2, H);
    for (const dy of [0, H]) {
      const inDisc = (x + H / 2 - cx) ** 2 + (yy + dy + H / 2 - cy) ** 2 < r * r;
      ringCells.push([x, yy + dy, !inDisc || t > 0]);
    }
  }
  pixelDisc(g, cx, cy, r, PLANET.base, H);
  pixelDisc(g, cx, cy, r, PLANET.shade, H, (dx, dy) => (dx - r * 0.3) ** 2 + (dy + r * 0.3) ** 2 > (r * 0.95) ** 2);
  fill(g, snap(cx + r * 0.2, H), snap(cy - r * 0.6, H), H, H, 0xf4d4ff);
  for (const [x, y, front] of ringCells) if (front) fill(g, x, y, H, H, y > cy ? PLANET.ringShade : PLANET.ring);
}

/** A blocky cloud: three stacked rows of cells with a lighter top edge. */
function cloud(g: Ctx, x: number, y: number, w: number): void {
  x = snap(x);
  y = snap(y);
  w = snap(w);
  fill(g, x + U * 2, y, w - U * 4, U, CLOUD.hi);
  fill(g, x + U, y + U, w - U * 2, U, CLOUD.base);
  fill(g, x + U, y + U, w - U * 2, H, CLOUD.hi);
  fill(g, x, y + U * 2, w, U, CLOUD.base);
  fill(g, x + U * 3, y - U, U * 3, U, CLOUD.hi);
}

/** Stepped hills along the bottom: tall at the sides, low in the middle. */
function hills(P: Painter, rng: Rand, base: number, maxH: number, col: { base: number; hi: number }, phase: number): void {
  const { far: g, G } = P;
  const x0 = snap(X0(), U * 2);
  for (let x = x0; x < G.w + ENV_MARGIN.right; x += U * 2) {
    const t = x / G.w;
    const side = Math.min(1, Math.abs(t - 0.5) * 2.2);
    const wave = 0.5 + 0.5 * Math.sin(t * 9 + phase) * Math.cos(t * 3.3 + phase * 2);
    const hh = snap(maxH * (0.25 + 0.75 * side) * (0.55 + 0.45 * wave), U);
    fill(g, x, base - hh, U * 2, hh + U, col.base);
    fill(g, x, base - hh, U * 2, H, col.hi);
    if (rng.chance(0.18) && hh > U * 3) fill(g, x + H, base - hh + U * 2, H, H, col.hi);
  }
}

/** A pixel palm tree: a stepped curving trunk and blocky fronds. */
function palm(g: Ctx, x: number, base: number, h: number, lean: number): void {
  x = snap(x);
  let tx = x;
  const segs = Math.round(h / U);
  for (let i = 0; i < segs; i++) {
    const y = base - (i + 1) * U;
    if (i > 2 && i % 3 === 0) tx += lean * U;
    fill(g, tx, y, U * 2, U, i % 2 ? PALM.trunk : PALM.trunkHi);
  }
  const top = base - segs * U;
  const fx = tx + U;
  const frond = (dir: number, droop: number) => {
    for (let k = 0; k < 6; k++) {
      const px = fx + dir * k * U;
      const py = top - U + Math.round((k * k * droop) / 6) * U;
      fill(g, px - (dir < 0 ? U : 0), py, U, U, k < 3 ? PALM.leafHi : PALM.leaf);
      if (k > 1) fill(g, px - (dir < 0 ? U : 0), py + U, U, H, PALM.leaf);
    }
  };
  frond(1, 0.5);
  frond(-1, 0.5);
  frond(1, 1.4);
  frond(-1, 1.4);
  fill(g, fx - U, top - U * 2, U * 2, U, PALM.leafHi);
  fill(g, fx - H, top - U * 3, U, U, PALM.leaf);
}

/** A bevelled square block tile (stone pillars, brick floor). */
function block(g: Ctx, x: number, y: number, s: number, c: { base: number; hi: number; lo: number; mortar: number }): void {
  fill(g, x, y, s, s, c.mortar);
  fill(g, x, y, s - H, s - H, c.lo);
  fill(g, x, y, s - U, s - U, c.base);
  fill(g, x, y, s - U, H, c.hi);
  fill(g, x, y, H, s - U, c.hi);
}

/** A brick-floor block: a bevelled tile with a split mortar line, like a stack of two bricks. */
function brick(g: Ctx, x: number, y: number, s: number): void {
  block(g, x, y, s, BRICK);
  fill(g, x, y + s / 2 - H, s - H, H, BRICK.mortar);
  fill(g, x + H, y + s / 2, s - U, H, BRICK.hi);
}

// ------------------------------------------------------------------ the room

export const arcade: EnvDef = {
  flat: true,
  stage: true,
  theme: {
    soil: { top: 0x240c02, mid: 0x240c02, deep: 0x120601, rock: 0x6a2808, root: 0x240c02 },
    grass: 0x40b840,
    sky: [SKY[0], SKY[SKY.length - 1]],
    concrete: STONE.base,
    side: STONE.base,
    ceiling: STRIP.bg,
    veil: 0x05061a,
    veilAlpha: 0.1,
    key: 0x9cd8ff,
    shadow: 0x000000,
    floor: { top: BRICK.top, face: BRICK.base },
  },
  exterior(P) {
    const { far: g, rng, G } = P;
    const W = fullW(P), HH = fullH(P);
    bandedSky(g, X0(), Y0(), W, G.h);
    stars(P, rng.fork(3), X0(), Y0(), W, G.h - Y0() - 120, 260);
    // ground: rows of brick blocks under the whole stage, a grassy top course
    const s = U * 4;
    for (let y = G.h; y < Y0() + HH; y += s) {
      for (let x = snap(X0(), s) - s; x < X0() + W; x += s) brick(g, x, y, s);
    }
    fill(g, X0(), G.h, W, H, BRICK.topHi);
    fill(g, X0(), G.h + H, W, H, BRICK.top);
    for (let x = snap(X0(), U); x < X0() + W; x += U * 2) fill(g, x, G.h + U, U, H, BRICK.topLo);
    // block-tile pillars in the side margins, with a pipe running out of each
    const pillar = (x0: number, x1: number) => {
      for (let y = snap(Y0(), s); y < G.h; y += s) for (let x = snap(x0, s); x < x1; x += s) block(g, x, y, s, STONE);
    };
    pillar(X0(), 0);
    pillar(G.w, G.w + ENV_MARGIN.right);
  },
  backWall(P) {
    const { far: g, rng, G, amb } = P;
    const top = G.ceilY;
    bandedSky(g, 0, snap(top, U), G.w, G.h);
    stars(P, rng.fork(5), 0, top, G.w, G.h - top - 140, Math.round((G.w * G.h) / 3800));
    // a few twinkling stars near the corners
    for (const [fx, fy] of [[0.12, 0.2], [0.3, 0.12], [0.7, 0.16], [0.9, 0.42], [0.08, 0.5], [0.55, 0.08]] as const) {
      amb.push({ kind: 'blink', x: snap(G.w * fx, H) + H / 2, y: snap(G.h * fy, H) + H / 2, color: 0xfff4c0, size: 1.4, period: 1.6 + fx * 2, layer: 'far' });
    }
    const side = snap(Math.max(U * 5, G.bx0), U * 4);
    // the moon, upper right; a little ringed planet, upper left
    const r = snap(Math.min(76, G.h * 0.09 + 20), U);
    moon(g, snap(G.w - side - r - U * 7), snap(U * 7 + r + U * 2), r);
    planet(g, snap(side + U * 16), snap(U * 14), U * 3);
    // dim clouds high up
    cloud(g, G.w * 0.2, U * 18, U * 14);
    cloud(g, G.w * 0.62, U * 12, U * 18);
    cloud(g, G.w * 0.42, U * 26, U * 10);
    // hills along the bottom: tall at the sides, low under the middle
    const hr = rng.fork(9);
    hills(P, hr, G.h, Math.min(220, G.h * 0.3), HILL_FAR, 0.7);
    hills(P, hr, G.h, Math.min(130, G.h * 0.17), HILL_NEAR, 2.1);
    // bushes at the foot of the near hills
    for (let x = snap(side, U); x < G.w - side; x += U * 2) {
      const t = x / G.w;
      if (Math.abs(t - 0.5) < 0.18 || !rng.chance(0.55)) continue;
      fill(g, x, G.h - U * 2, U * 2, U * 2, HILL_NEAR.bush);
      fill(g, x + H, G.h - U * 3, U, U, HILL_NEAR.bush);
    }
    // palm trees in the bottom corners
    palm(g, side + U * 6, G.h, Math.min(200, G.h * 0.26), 1);
    palm(g, G.w - side - U * 10, G.h, Math.min(170, G.h * 0.22), -1);
    // block-tile pillars framing the stage
    const s = U * 4;
    for (let y = snap(top, s) - s; y < G.h; y += s) {
      for (let x = 0; x < side; x += s) block(g, x, y, s, STONE);
      for (let x = G.w - side; x < G.w; x += s) block(g, x, y, s, STONE);
    }
    // inner edge of the pillars: a hard shadow line onto the sky
    fill(g, side, top, H, G.h - top, 0x000000, 0.5);
    fill(g, G.w - side - H, top, H, G.h - top, 0x000000, 0.5);
    // status strip along the top: player score, high score, stage and lives
    const sy = snap(top, U);
    const sh = U * 4;
    fill(g, 0, sy, G.w, sh, STRIP.bg);
    fill(g, 0, sy + sh, G.w, H, STRIP.line);
    fill(g, 0, sy + sh + H, G.w, H, 0x000000, 0.6);
    const k = 3;
    const ty = sy + (sh - 7 * k) / 2;
    pixelText(g, '1P', side + U * 2, ty, k, STRIP.gold);
    pixelText(g, '004200', side + U * 2 + textW('1P ', k), ty, k, STRIP.text);
    const hi = 'HI 050000';
    pixelText(g, hi, snap(G.w / 2 - textW(hi, k) / 2, H), ty, k, STRIP.text);
    pixelText(g, 'HI', snap(G.w / 2 - textW(hi, k) / 2, H), ty, k, STRIP.gold);
    const st = 'STAGE 1-1';
    const sx = snap(G.w - side - U * 2 - textW(st, k) - U * 10, H);
    pixelText(g, st, sx, ty, k, STRIP.text);
    for (let i = 0; i < 3; i++) heart(g, G.w - side - U * 2 - (3 - i) * U * 3 + U, ty + k, k, STRIP.heart);
  },
  floor() {},
  props() {},
  lights(P) {
    const { amb, G } = P;
    // a blinking "insert coin" style cursor in the status strip
    amb.push({ kind: 'blink', x: snap(Math.max(U * 5, G.bx0), U * 4) + U * 2 + textW('1P 004200', 3) + U * 2, y: snap(G.ceilY, U) + U * 2, color: 0xf8cc10, size: 1.6, period: 0.9, layer: 'far' });
  },
  soilExtras() {},
  near(P) {
    const { near: g, G } = P;
    // chunky foreground pillars in the outer margins (they only show around the stage)
    const s = U * 4;
    const deep = { base: 0x1c1834, hi: 0x2e2852, lo: 0x0e0c1c, mortar: 0x06050c };
    for (let y = snap(Y0(), s); y < G.h + ENV_MARGIN.bottom; y += s) {
      for (let x = snap(X0(), s); x < -U * 6; x += s) block(g, x, y, s, deep);
      for (let x = snap(G.w + U * 8, s); x < G.w + ENV_MARGIN.right; x += s) block(g, x, y, s, deep);
    }
  },
};
