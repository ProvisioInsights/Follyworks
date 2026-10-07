/**
 * Two happy rooms for the Modern per-level set: a sunny backyard garden workshop and a kids'
 * playroom dressed for a birthday party. Same contract and readability rule as the other rooms
 * (environment.ts): the middle stays calm, detail lives at the edges and up high, and props are
 * knocked back by the shared filter so nothing reads as a part, socket or hook.
 */

import {
  type Ctx,
  type Rand,
  blob,
  contactShadow,
  css,
  hGrad,
  leafCluster,
  rrPath,
  shade,
  silhouette,
  soil,
  texture,
  turf,
  vGrad,
} from './envHelpers';
import { ENV_MARGIN, type EnvDef, type Painter, floorPerspective, workbench } from './environment';
import { FESTIVE, PASTEL, balloon, bigPlant, bunting, cloud, confettiDots, doodle, flowerPot, skyPane, sun, sunbeam, sunnyWindow } from './envCheer';

const X0 = () => -ENV_MARGIN.left;
const Y0 = () => -ENV_MARGIN.top;
const fullW = (P: Painter) => P.G.w + ENV_MARGIN.left + ENV_MARGIN.right;
const fullH = (P: Painter) => P.G.h + ENV_MARGIN.top + ENV_MARGIN.bottom;

const LEAVES = [0x4f8f3e, 0x66a646, 0x3f7a35, 0x7cb850];

/** A round, leafy tree (crown of leaf clusters on a short trunk). */
function tree(g: Ctx, rng: Rand, x: number, base: number, h: number, crown: number): void {
  g.fillStyle = hGrad(g, x - 10, x + 10, [[0, 0x8a6038], [1, 0x5a3c22]]);
  g.fillRect(x - 9, base - h, 18, h);
  blob(g, x, base - h - crown * 0.2, crown * 1.1, crown * 0.95, 0x4f8f3e, 0.95, 0.75);
  for (let i = 0; i < 18; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(0, crown * 0.75);
    leafCluster(g, rng, x + Math.cos(a) * r, base - h - crown * 0.2 + Math.sin(a) * r * 0.85, crown * 0.32, LEAVES, 5, 0, Math.PI * 2);
  }
  // a few pink blossoms
  for (let i = 0; i < 14; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(crown * 0.2, crown * 0.85);
    g.fillStyle = css(rng.pick([0xffc8dc, 0xffffff, 0xffb0c8]), 0.9);
    g.beginPath();
    g.arc(x + Math.cos(a) * r, base - h - crown * 0.2 + Math.sin(a) * r * 0.8, 3, 0, Math.PI * 2);
    g.fill();
  }
}

/** Picket fence with pointed tops from x0 to x1, standing on `base`. */
function fence(g: Ctx, rng: Rand, x0: number, x1: number, base: number, h: number, color: number): void {
  const pw = 26;
  g.fillStyle = css(shade(color, -0.25));
  g.fillRect(x0, base - h * 0.78, x1 - x0, 10);
  g.fillRect(x0, base - h * 0.3, x1 - x0, 10);
  for (let x = x0; x < x1; x += pw + 6) {
    const c = shade(color, rng.range(-0.06, 0.06));
    g.fillStyle = hGrad(g, x, x + pw, [[0, shade(c, 0.12)], [0.6, c], [1, shade(c, -0.18)]]);
    g.beginPath();
    g.moveTo(x, base);
    g.lineTo(x, base - h + 12);
    g.lineTo(x + pw / 2, base - h);
    g.lineTo(x + pw, base - h + 12);
    g.lineTo(x + pw, base);
    g.closePath();
    g.fill();
    g.strokeStyle = css(shade(c, -0.4), 0.5);
    g.lineWidth = 1;
    g.stroke();
  }
}

/** Mown lawn on the receding floor plane: alternating stripes. */
function lawn(P: Painter): void {
  const { far: g, G } = P;
  g.fillStyle = vGrad(g, G.by1, G.h, [[0, 0x7cc45e], [1, 0x5aa646]]);
  g.fillRect(0, G.by1, G.w, G.h - G.by1);
  const n = 12;
  for (let i = 0; i < n; i += 2) {
    const a = G.bx0 + (i / n) * (G.bx1 - G.bx0), b = G.bx0 + ((i + 1) / n) * (G.bx1 - G.bx0);
    const c = (i / n) * G.w, d = ((i + 1) / n) * G.w;
    g.fillStyle = css(0xffffff, 0.07);
    g.beginPath();
    g.moveTo(a, G.by1);
    g.lineTo(b, G.by1);
    g.lineTo(d, G.h);
    g.lineTo(c, G.h);
    g.closePath();
    g.fill();
  }
  texture(g, 'speckle', 0, G.by1, G.w, G.h - G.by1, { alpha: 0.25 });
}

// ---------------------------------------------------------------------------
// Sunny Backyard Workshop
// ---------------------------------------------------------------------------

const backyard: EnvDef = {
  theme: {
    soil: { top: 0x7a5a3a, mid: 0x684a30, deep: 0x4a3420, rock: 0x9a8a78, root: 0x5a4028 },
    grass: 0x6cc05a,
    sky: [0x4aa6ee, 0xc4e8fb],
    concrete: 0xc8b89a,
    side: 0x7ab45a,
    ceiling: 0x6ab8f0,
    veil: 0xfff6e0,
    veilAlpha: 0.06,
    key: 0xfff0c0,
    shadow: 0x4a6a8a,
    floor: { top: 0x6cb850, face: 0x4a8a3a },
  },
  exterior(P) {
    const { far: g, rng, G, T } = P;
    const W = fullW(P), H = fullH(P);
    // open sky everywhere above the lawn
    g.fillStyle = vGrad(g, Y0(), G.h, [[0, T.sky[0]], [1, T.sky[1]]]);
    g.fillRect(X0(), Y0(), W, G.h - Y0());
    sun(g, G.w + 90, -110, 34, true);
    for (const [cx, cy, s] of [[-120, -120, 70], [260, -150, 60], [700, -130, 80]] as const) cloud(g, rng, cx, cy, s);
    // trees in the side margins
    tree(g, rng, -120, G.h, 220, 120);
    tree(g, rng, G.w + 120, G.h, 200, 110);
    // the garden soil below the lawn, cut away like the other rooms
    soil(g, rng, X0(), G.h, W, Y0() + H - G.h, T.soil, { surfaceY: G.h + 6, roots: W / 90 });
    turf(g, rng, X0(), X0() + W, G.h, T.grass, T.soil.top);
  },
  backWall(P) {
    const { far: g, rng, G } = P;
    const x = G.bx0, y = G.by0, w = G.bx1 - G.bx0;
    const fenceTop = G.by1 - 190;
    skyPane(g, rng, x, y, w, G.by1 - y, { clouds: 3, top: 0x58aef0, bottom: 0xd2eefb });
    // far hills and a tree line peeking over the fence
    g.fillStyle = css(0x9ad27c);
    g.beginPath();
    g.moveTo(x, fenceTop + 40);
    for (let i = 0; i <= 30; i++) g.lineTo(x + (i / 30) * w, fenceTop - 30 - Math.sin(i * 0.45) * 26 - Math.sin(i * 1.3) * 8);
    g.lineTo(x + w, fenceTop + 40);
    g.closePath();
    g.fill();
    for (let tx = x + 20; tx < x + w; tx += rng.range(70, 130)) blob(g, tx, fenceTop - 20, rng.range(36, 60), rng.range(30, 46), 0x6cb058, 0.95, 0.7);
    fence(g, rng, x, x + w, G.by1, 190, 0xf2e6cc);
  },
  sideWalls(P) {
    const { far: g, rng, G } = P;
    // a tall hedge on both sides
    g.fillStyle = css(0x5a9a48);
    g.fillRect(0, G.ceilY, G.w, G.h - G.ceilY);
    for (let i = 0; i < 70; i++) {
      const left = i % 2 === 0;
      const px = left ? rng.range(0, G.bx0) : rng.range(G.bx1, G.w);
      leafCluster(g, rng, px, rng.range(G.ceilY, G.h), 18, LEAVES, 4, 0, Math.PI * 2);
    }
  },
  ceiling(P) {
    const { far: g, G } = P;
    g.fillStyle = vGrad(g, G.ceilY, G.by0, [[0, 0x4aa6ee], [1, 0x58aef0]]);
    g.fillRect(0, G.ceilY, G.w, G.by0 - G.ceilY);
  },
  floor(P) {
    lawn(P);
  },
  props(P) {
    const { far: g, rng, G } = P;
    // potting bench on the left with pots and a watering can
    workbench(g, rng, G.bx0 + 30, G.by1, 260, 120);
    const top = G.by1 - 120;
    for (const [px, pw] of [[G.bx0 + 70, 24], [G.bx0 + 120, 30], [G.bx0 + 180, 22]] as const) flowerPot(g, rng, px, top, pw);
    g.fillStyle = css(0x4a8ac8);
    g.fillRect(G.bx0 + 220, top - 30, 40, 30);
    g.strokeStyle = css(0x4a8ac8);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(G.bx0 + 260, top - 22);
    g.lineTo(G.bx0 + 286, top - 40);
    g.stroke();
    // the little red shed, right, with a round window and a bunting-trimmed roof
    const sx = G.bx1 - 280, sw = 240, sh = 230, sy = G.by1 - sh;
    contactShadow(g, sx + sw / 2, G.by1, sw);
    g.fillStyle = vGrad(g, sy, G.by1, [[0, 0xd0604a], [1, 0xa8483a]]);
    g.fillRect(sx, sy, sw, sh);
    g.strokeStyle = css(0x8a3a2e, 0.6);
    g.lineWidth = 1.5;
    for (let bx = sx + 20; bx < sx + sw; bx += 20) {
      g.beginPath();
      g.moveTo(bx, sy);
      g.lineTo(bx, G.by1);
      g.stroke();
    }
    g.fillStyle = css(0x6a4a3a);
    g.beginPath();
    g.moveTo(sx - 20, sy + 4);
    g.lineTo(sx + sw / 2, sy - 70);
    g.lineTo(sx + sw + 20, sy + 4);
    g.closePath();
    g.fill();
    g.fillStyle = css(0xf6efe0);
    g.fillRect(sx + 30, G.by1 - 150, 80, 150);
    g.fillStyle = css(0xe8dcc4);
    g.fillRect(sx + 38, G.by1 - 142, 64, 142);
    g.save();
    g.beginPath();
    g.arc(sx + 170, sy + 70, 30, 0, Math.PI * 2);
    g.clip();
    skyPane(g, rng, sx + 140, sy + 40, 60, 60, { clouds: 0 });
    g.restore();
    g.strokeStyle = css(0xf6efe0);
    g.lineWidth = 6;
    g.beginPath();
    g.arc(sx + 170, sy + 70, 30, 0, Math.PI * 2);
    g.stroke();
    // a birdhouse on a pole in the middle distance
    const bx = G.w * 0.5 + 40;
    g.fillStyle = css(0x8a6038);
    g.fillRect(bx - 3, G.by1 - 230, 6, 230);
    g.fillStyle = css(0x6ab0e0);
    g.fillRect(bx - 22, G.by1 - 270, 44, 40);
    g.fillStyle = css(0xe0603c);
    g.beginPath();
    g.moveTo(bx - 28, G.by1 - 268);
    g.lineTo(bx, G.by1 - 296);
    g.lineTo(bx + 28, G.by1 - 268);
    g.closePath();
    g.fill();
    g.fillStyle = css(0x2a2018);
    g.beginPath();
    g.arc(bx, G.by1 - 252, 7, 0, Math.PI * 2);
    g.fill();
  },
  cheer(P) {
    const { far: g, rng, G } = P;
    // party line from the tree to the shed, sunflowers along the fence, a bed of flowers
    bunting(g, G.bx0 + 10, 110, G.bx1 - 160, 100, 30, FESTIVE);
    for (const [fx, fh] of [[G.bx0 + 330, 220], [G.bx0 + 380, 250], [G.bx0 + 430, 200]] as const) {
      g.strokeStyle = css(0x5a9a3e);
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(fx, G.by1);
      g.lineTo(fx + 4, G.by1 - fh);
      g.stroke();
      leafCluster(g, rng, fx + 2, G.by1 - fh * 0.5, 22, LEAVES, 3, -Math.PI, 0);
      g.fillStyle = css(0xffc83a);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.beginPath();
        g.ellipse(fx + 4 + Math.cos(a) * 16, G.by1 - fh + Math.sin(a) * 16, 9, 5, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = css(0x7a4a1e);
      g.beginPath();
      g.arc(fx + 4, G.by1 - fh, 11, 0, Math.PI * 2);
      g.fill();
    }
    for (let fx = G.w * 0.56; fx < G.bx1 - 300; fx += 46) flowerPot(g, rng, fx, G.by1, 22, rng.pick([0xd0714a, 0x4a8ac8, 0xe0b040]));
    doodle(g, rng, G.bx1 - 236, G.by1 - 210, 54, 62, 'sun', -0.06);
  },
  lights(P) {
    const { G, amb } = P;
    sunbeam(P, G.bx1 - 120, G.by0, 220, 600, G.by1 - G.by0, -260, 0.12);
    blob(P.light, G.bx1 - 60, G.by0 + 40, 260, 200, 0xfff0c0, 0.25);
    amb.push({ kind: 'dust', x: G.w * 0.35, y: 80, w: 460, h: Math.min(420, G.h * 0.6), color: 0xfff6c0, layer: 'far' });
  },
  soilExtras() {},
  near(P) {
    const { near: g, rng, G, amb } = P;
    const dark = 0x2e4a24, rim = 0xfff0c0;
    // leafy branch top-left, bushes in the bottom corners
    const br = new Path2D();
    br.moveTo(-230, -60);
    br.quadraticCurveTo(-60, -40, 40, -10);
    br.lineTo(44, -2);
    br.quadraticCurveTo(-60, -28, -230, -44);
    br.closePath();
    silhouette(g, br, 0x3a2a1a, rim, 0, -2, 0.3);
    for (let i = 0; i < 9; i++) leafCluster(g, rng, -200 + i * 28, -40 + Math.sin(i) * 10, 26, [0x2e4a24, 0x3a5a2a], 4, 0, Math.PI * 2);
    amb.push({ kind: 'sway', x: 30, y: 0, size: 10, period: 6, layer: 'near' });
    for (const [bx, by, r] of [[0, G.h + 30, 120], [G.w + 10, G.h + 40, 140]] as const) {
      const b = new Path2D();
      b.ellipse(bx, by, r, r * 0.6, 0, 0, Math.PI * 2);
      silhouette(g, b, dark, rim, -2, -3, 0.3);
      for (let i = 0; i < 8; i++) leafCluster(g, rng, bx + rng.range(-r * 0.8, r * 0.8), by - rng.range(0, r * 0.5), 24, [0x2e4a24, 0x3a5a2a, 0x46682e], 4, -Math.PI, 0);
    }
  },
};

// ---------------------------------------------------------------------------
// Birthday Playroom
// ---------------------------------------------------------------------------

function block(g: Ctx, x: number, bottom: number, s: number, color: number, letter: string): void {
  const y = bottom - s;
  g.fillStyle = css(shade(color, -0.35));
  g.fillRect(x - 1, y - 1, s + 2, s + 2);
  g.fillStyle = vGrad(g, y, bottom, [[0, shade(color, 0.15)], [1, shade(color, -0.1)]]);
  g.fillRect(x, y, s, s);
  g.fillStyle = css(0xffffff, 0.85);
  g.font = `bold ${Math.round(s * 0.62)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, x + s / 2, y + s / 2 + 1);
}

function teddy(g: Ctx, x: number, bottom: number, s: number): void {
  const c = 0xc8925a;
  const disc = (dx: number, dy: number, r: number, col = c) => {
    g.fillStyle = css(col);
    g.beginPath();
    g.arc(x + dx * s, bottom - dy * s, r * s, 0, Math.PI * 2);
    g.fill();
  };
  disc(-0.32, 0.12, 0.16);
  disc(0.32, 0.12, 0.16);
  disc(0, 0.38, 0.34);
  disc(0, 0.86, 0.26);
  disc(-0.2, 1.08, 0.1);
  disc(0.2, 1.08, 0.1);
  disc(0, 0.78, 0.1, 0xecc89a);
  disc(0, 0.38, 0.18, 0xecc89a);
  g.fillStyle = css(0x2a1a10);
  g.beginPath();
  g.arc(x - 0.09 * s, bottom - 0.92 * s, 0.035 * s, 0, Math.PI * 2);
  g.arc(x + 0.09 * s, bottom - 0.92 * s, 0.035 * s, 0, Math.PI * 2);
  g.arc(x, bottom - 0.81 * s, 0.04 * s, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = css(0xe0543c);
  g.beginPath();
  g.moveTo(x - 0.14 * s, bottom - 0.62 * s);
  g.lineTo(x, bottom - 0.66 * s);
  g.lineTo(x - 0.14 * s, bottom - 0.7 * s);
  g.moveTo(x + 0.14 * s, bottom - 0.62 * s);
  g.lineTo(x, bottom - 0.66 * s);
  g.lineTo(x + 0.14 * s, bottom - 0.7 * s);
  g.fill();
}

const playroom: EnvDef = {
  theme: {
    soil: { top: 0x7a5a3a, mid: 0x684a30, deep: 0x4a3420, rock: 0x9a8a78, root: 0x5a4028 },
    grass: 0x6cc05a,
    sky: [0x5aaef0, 0xc4e8fb],
    concrete: 0xd8ccb8,
    side: 0xf0c4b4,
    ceiling: 0xf6e4d8,
    veil: 0xfff4ec,
    veilAlpha: 0.06,
    key: 0xfff0d0,
    shadow: 0x8a6a9a,
    floor: { top: 0xd8a878, face: 0x9a6a44 },
  },
  backWall(P) {
    const { far: g, rng, G } = P;
    const x = G.bx0, y = G.by0, w = G.bx1 - G.bx0;
    const rail = G.by1 - 150;
    // peach wallpaper with soft stripes and polka dots
    g.fillStyle = css(0xfbe2d2);
    g.fillRect(x, y, w, rail - y);
    g.fillStyle = css(0xf8d6c4);
    for (let sx = x; sx < x + w; sx += 56) g.fillRect(sx, y, 24, rail - y);
    for (let py = y + 20; py < rail; py += 40) {
      for (let px = x + ((py / 40) % 2 ? 28 : 0); px < x + w; px += 56) {
        g.fillStyle = css(rng.pick(PASTEL), 0.55);
        g.beginPath();
        g.arc(px + 12, py, 4, 0, Math.PI * 2);
        g.fill();
      }
    }
    // mint wainscot with a white chair rail
    g.fillStyle = vGrad(g, rail, G.by1, [[0, 0xbfe8d8], [1, 0xa8dcc8]]);
    g.fillRect(x, rail, w, G.by1 - rail);
    g.strokeStyle = css(0x94ccb8);
    g.lineWidth = 2;
    for (let px = x + 30; px < x + w; px += 90) g.strokeRect(px, rail + 22, 60, G.by1 - rail - 50);
    g.fillStyle = css(0xffffff);
    g.fillRect(x, rail - 6, w, 10);
    g.fillStyle = css(0xffffff);
    g.fillRect(x, G.by1 - 16, w, 16);
  },
  sideWalls(P) {
    const { far: g, G } = P;
    g.fillStyle = css(0xf2ccbc, 0.6);
    g.fillRect(0, G.ceilY, G.w, G.h - G.ceilY);
  },
  ceiling(P) {
    const { far: g, G } = P;
    g.fillStyle = css(0xf8ece4);
    g.fillRect(0, G.ceilY, G.w, G.by0 - G.ceilY);
  },
  floor(P) {
    const { far: g, G } = P;
    floorPerspective(P, 0xd2a072, { cols: 16, rows: 3, line: 0x9a6a44, lineAlpha: 0.35 });
    // a round pastel rug
    g.fillStyle = css(0x9ad4f0, 0.8);
    g.beginPath();
    g.ellipse(G.w * 0.5, G.by1 + 30, 240, 20, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = css(0xffffff, 0.7);
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(G.w * 0.5, G.by1 + 30, 210, 15, 0, 0, Math.PI * 2);
    g.stroke();
  },
  props(P) {
    const { far: g, rng, G } = P;
    // toy shelf, left: blocks, books and a teddy
    const sx = G.bx0 + 20, sw = 230;
    for (const sy of [G.by1 - 250, G.by1 - 140]) {
      g.fillStyle = css(0xf6efe4);
      g.fillRect(sx, sy, sw, 12);
      g.fillStyle = css(0xd8ccb8);
      g.fillRect(sx, sy + 12, sw, 3);
    }
    g.fillStyle = css(0xf6efe4);
    g.fillRect(sx, G.by1 - 250, 12, 250);
    g.fillRect(sx + sw - 12, G.by1 - 250, 12, 250);
    block(g, sx + 20, G.by1 - 250, 34, 0xe0603c, 'A');
    block(g, sx + 58, G.by1 - 250, 34, 0x4fa8e0, 'B');
    block(g, sx + 39, G.by1 - 284, 34, 0x6cc87a, 'C');
    teddy(g, sx + 160, G.by1 - 250, 70);
    let bx = sx + 20;
    for (const c of [0xe07ab8, 0xf2c043, 0x4fa8e0, 0x9be3a5, 0xff9e8a, 0xc9b4ff]) {
      const bh = rng.range(54, 76);
      g.fillStyle = css(c);
      g.fillRect(bx, G.by1 - 140 - bh, 18, bh);
      bx += 20;
    }
    // party table with a cake, right of centre
    const tx = G.w * 0.62, tw = 170, tt = G.by1 - 100;
    contactShadow(g, tx + tw / 2, G.by1, tw);
    g.fillStyle = css(0xf6efe4);
    g.fillRect(tx, tt, tw, 10);
    g.fillRect(tx + 12, tt + 10, 8, 90);
    g.fillRect(tx + tw - 20, tt + 10, 8, 90);
    g.fillStyle = css(0xf2a6d8);
    g.beginPath();
    g.moveTo(tx - 6, tt);
    for (let i = 0; i <= 10; i++) g.lineTo(tx - 6 + (i / 10) * (tw + 12), tt + (i % 2 ? 26 : 18));
    g.lineTo(tx + tw + 6, tt);
    g.closePath();
    g.fill();
    const cx = tx + tw / 2;
    g.fillStyle = css(0xfff4e0);
    g.fillRect(cx - 44, tt - 40, 88, 40);
    g.fillStyle = css(0xf08ab8);
    g.fillRect(cx - 44, tt - 44, 88, 10);
    g.fillStyle = css(0xfff4e0);
    g.fillRect(cx - 30, tt - 68, 60, 26);
    g.fillStyle = css(0xf08ab8);
    g.fillRect(cx - 30, tt - 72, 60, 8);
    g.fillStyle = css(0xd8303a);
    g.beginPath();
    g.arc(cx, tt - 78, 7, 0, Math.PI * 2);
    g.fill();
    confettiDots(g, rng, cx - 44, tt - 40, 88, 36, 22, FESTIVE, 0.9);
    // toy box, right
    const bxx = G.bx1 - 190, bw = 150, bh = 100;
    contactShadow(g, bxx + bw / 2, G.by1, bw);
    g.fillStyle = vGrad(g, G.by1 - bh, G.by1, [[0, 0xf2c043], [1, 0xd8a830]]);
    g.fillRect(bxx, G.by1 - bh, bw, bh);
    g.fillStyle = css(0xe0603c);
    g.fillRect(bxx - 6, G.by1 - bh - 14, bw + 12, 16);
    g.fillStyle = css(0xffffff, 0.85);
    g.font = 'bold 34px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('TOYS', bxx + bw / 2, G.by1 - bh / 2);
  },
  cheer(P) {
    const { far: g, rng, G } = P;
    sunnyWindow(P, 380, 96, 230, 180, { cols: 2, rows: 2, sun: [0.76, 0.3], clouds: 2, curtains: 0x8fd0f5, beam: 150 });
    // a HAPPY DAY banner, one letter per flag
    const word = 'HAPPY DAY!';
    const x0 = 650, x1 = 1040, yy = 80;
    bunting(g, x0, yy, x1, yy, 10, PASTEL, 30);
    g.save();
    g.font = 'bold 18px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = css(0x6a4a5a);
    const n = Math.max(3, Math.floor((x1 - x0) / (30 * 1.35)));
    for (let i = 0; i < Math.min(n, word.length); i++) {
      const t = (i + 0.5) / n;
      const u = 1 - t;
      const px = u * u * x0 + 2 * u * t * ((x0 + x1) / 2) + t * t * x1;
      const py = u * u * yy + 2 * u * t * (yy + 20) + t * t * yy;
      g.fillText(word[i], px, py + 11);
    }
    g.restore();
    bunting(g, 60, 40, 360, 50, 14, FESTIVE);
    // balloons bobbing in the corners
    balloon(g, 980, 180, 24, 0xe0603c, 120);
    balloon(g, 1020, 200, 22, 0x4fa8e0, 110);
    balloon(g, 1000, 150, 20, 0xf2c043, 140);
    balloon(g, 110, 140, 20, 0xe07ab8, 100);
    balloon(g, 150, 160, 18, 0x6cc87a, 90);
    confettiDots(g, rng, G.bx0, G.by0 + 20, G.bx1 - G.bx0, 300, 70, FESTIVE, 0.4);
    doodle(g, rng, 440, 320, 62, 72, 'cat', -0.06);
    doodle(g, rng, 520, 330, 62, 56, 'rainbow', 0.05);
    flowerPot(g, rng, 960, G.by1 - 114, 22);
    bigPlant(g, rng, 320, G.by1, 120, 0xf2a6d8);
  },
  lights(P) {
    const { far: g, light, G, amb } = P;
    // a paper lantern
    const lx = G.w * 0.5 + 120, ly = 40;
    g.strokeStyle = css(0x8a7a6a);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(lx, G.ceilY + 10);
    g.lineTo(lx, ly - 22);
    g.stroke();
    g.fillStyle = css(0xfff4d8);
    g.beginPath();
    g.arc(lx, ly, 24, 0, Math.PI * 2);
    g.fill();
    blob(light, lx, ly, 70, 70, 0xfff0c8, 0.5, 0.2);
    blob(light, lx, ly + 200, 380, 260, 0xfff0d0, 0.14);
    amb.push({ kind: 'dust', x: 360, y: 100, w: 420, h: 380, color: 0xfff6d8, layer: 'far' });
  },
  soilExtras(P) {
    const { far: g, rng } = P;
    void rng;
    void g;
  },
  near(P) {
    const { near: g, G } = P;
    const dark = 0x4a3048, rim = 0xffe4c8;
    // a giant teddy ear and a stack of blocks in the corners, balloon strings at the top
    const bl = new Path2D();
    bl.addPath(rrPath(-200, G.h - 60, 110, 110, 6));
    bl.addPath(rrPath(-80, G.h - 10, 100, 100, 6));
    bl.addPath(rrPath(-150, G.h - 150, 90, 90, 6));
    silhouette(g, bl, dark, rim, -2, -2, 0.35);
    const br = new Path2D();
    br.ellipse(G.w + 90, G.h + 10, 140, 120, 0, 0, Math.PI * 2);
    br.ellipse(G.w + 10, G.h - 90, 46, 46, 0, 0, Math.PI * 2);
    silhouette(g, br, 0x5a3a2a, rim, -2, -2, 0.35);
    g.strokeStyle = css(0x4a3048, 0.8);
    g.lineWidth = 1.5;
    for (const sx of [G.w + 40, G.w + 80]) {
      g.beginPath();
      g.moveTo(sx, -200);
      g.quadraticCurveTo(sx - 20, -100, sx + 10, -20);
      g.stroke();
    }
  },
};

export const HAPPY_ENVS: Record<string, EnvDef> = { backyard, playroom };
