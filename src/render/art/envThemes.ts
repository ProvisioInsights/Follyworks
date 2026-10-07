/**
 * Rooms for the visual themes (see src/core/themes.ts and src/render/skin.ts): a stone-age quarry
 * cave, a steam-and-brass foundry, a flat 90s toolbox backdrop, a comic-book rooftop panel and a
 * far-future neon lab. Same contract and layers as the six workshop rooms in environment.ts, and
 * the same readability rule: the middle of the room stays calm, muted and mid-dark, detail lives at
 * the edges, and props are knocked back by the shared filter so nothing reads as a part.
 */

import {
  type Ctx,
  type Rand,
  blob,
  bricks,
  cable,
  contactShadow,
  crack,
  css,
  flange,
  gauge,
  hGrad,
  hangingCable,
  leafCluster,
  led,
  lightCone,
  metalPanel,
  mix,
  monitor,
  pipe,
  poly,
  rivet,
  rivetRow,
  rock,
  roots,
  rrPath,
  shade,
  silhouette,
  soil,
  stain,
  stencil,
  streaks,
  texture,
  tubeLamp,
  turf,
  vGrad,
  valveWheel,
} from './envHelpers';
import {
  ENV_MARGIN,
  type EnvDef,
  type EnvironmentInfo,
  type Painter,
  blockCourses,
  cagedLamp,
  clipped,
  cylinder,
  floorPerspective,
  timber,
} from './environment';
import { FESTIVE, PASTEL, balloon, bigPlant, bunting, cloud, doodle, flowerPot, skyPane, sun, sunbeam, sunnyWindow } from './envCheer';

/** Display info for the theme rooms (not offered as level environments). */
export const THEME_ROOMS: EnvironmentInfo[] = [
  { id: 'cave', name: 'Quarry Cave', blurb: 'Cut rock, torchlight and a wall of handprints.', accent: 0xe08a46 },
  { id: 'foundry', name: 'Brass Foundry', blurb: 'Riveted plate, copper pipe and a furnace that never quite goes out.', accent: 0xd6a04e },
  { id: 'toolbox', name: 'Toolbox', blurb: 'Flat colours, a tiled wall and a chunky grey frame.', accent: 0x5fb0c8 },
  { id: 'rooftop', name: 'Rooftop Panel', blurb: 'A sunny city, printed in four colours.', accent: 0xf0c83c },
  { id: 'neonlab', name: 'Neon Lab', blurb: 'A pastel space station with glow strips and a big round window on a friendly planet.', accent: 0x5ff0ff },
];

// ---------------------------------------------------------------------------
// shared bits
// ---------------------------------------------------------------------------

const X0 = () => -ENV_MARGIN.left;
const Y0 = () => -ENV_MARGIN.top;
const fullW = (P: Painter) => P.G.w + ENV_MARGIN.left + ENV_MARGIN.right;
const fullH = (P: Painter) => P.G.h + ENV_MARGIN.top + ENV_MARGIN.bottom;

/** Thick ink outline used by the flat and comic rooms. */
function ink(g: Ctx, path: Path2D, w = 3, color = 0x0a0a12, a = 1): void {
  g.save();
  g.strokeStyle = css(color, a);
  g.lineWidth = w;
  g.lineJoin = 'round';
  g.stroke(path);
  g.restore();
}

function rect(x: number, y: number, w: number, h: number): Path2D {
  const p = new Path2D();
  p.rect(x, y, w, h);
  return p;
}

/** Halftone dot screen over a rect: dot size follows `size(x, y)` in [0,1]. */
function halftone(g: Ctx, x: number, y: number, w: number, h: number, step: number, color: number, alpha: number, size: (x: number, y: number) => number): void {
  g.save();
  g.fillStyle = css(color, alpha);
  let row = 0;
  for (let yy = y; yy < y + h; yy += step * 0.866, row++) {
    const off = row % 2 ? step / 2 : 0;
    for (let xx = x + off; xx < x + w; xx += step) {
      const r = size(xx, yy) * step * 0.5;
      if (r < 0.25) continue;
      g.beginPath();
      g.arc(xx, yy, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

/** A wall torch: wrapped stick, flame, soft pool of light. */
function torch(P: Painter, x: number, y: number): void {
  const { far: g, light, amb } = P;
  g.save();
  g.translate(x, y);
  g.rotate(0.12);
  g.fillStyle = css(0x1e140c);
  g.fillRect(-4, -2, 8, 46);
  g.fillStyle = hGrad(g, -3, 3, [[0, 0x6a4a2a], [1, 0x3a2614]]);
  g.fillRect(-3, 0, 6, 44);
  g.fillStyle = css(0x4a3220);
  g.fillRect(-5, -4, 10, 10);
  g.restore();
  // iron bracket
  g.strokeStyle = css(0x241c16);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x - 10, y + 22);
  g.lineTo(x + 2, y + 18);
  g.stroke();
  // flame
  g.save();
  g.translate(x, y - 6);
  const drop = (s: number, c: string) => {
    g.beginPath();
    g.moveTo(0, -22 * s);
    g.bezierCurveTo(9 * s, -10 * s, 9 * s, 2 * s, 0, 6 * s);
    g.bezierCurveTo(-9 * s, 2 * s, -9 * s, -10 * s, 0, -22 * s);
    g.fillStyle = c;
    g.fill();
  };
  drop(1, 'rgba(230,110,40,0.9)');
  drop(0.66, 'rgba(255,180,80,0.95)');
  drop(0.34, 'rgba(255,240,200,1)');
  g.restore();
  blob(g, x, y - 12, 70, 70, 0xff8a3a, 0.14);
  blob(light, x, y - 12, 46, 46, 0xffc070, 0.75, 0.15);
  blob(light, x, y + 60, 230, 200, 0xff8a3a, 0.24);
  amb.push({ kind: 'blink', x, y: y - 14, color: 0xffb060, size: 5, period: 0.7, layer: 'far' });
}

/** Clay pot standing at floorY. */
function pot(g: Ctx, x: number, floorY: number, w: number, h: number, color: number): void {
  contactShadow(g, x, floorY, w * 1.2);
  const p = new Path2D();
  p.moveTo(x - w * 0.22, floorY - h);
  p.lineTo(x + w * 0.22, floorY - h);
  p.bezierCurveTo(x + w * 0.2, floorY - h * 0.82, x + w * 0.62, floorY - h * 0.7, x + w * 0.5, floorY - h * 0.3);
  p.quadraticCurveTo(x + w * 0.38, floorY, x, floorY);
  p.quadraticCurveTo(x - w * 0.38, floorY, x - w * 0.5, floorY - h * 0.3);
  p.bezierCurveTo(x - w * 0.62, floorY - h * 0.7, x - w * 0.2, floorY - h * 0.82, x - w * 0.22, floorY - h);
  p.closePath();
  g.fillStyle = hGrad(g, x - w / 2, x + w / 2, [[0, shade(color, 0.12)], [0.4, color], [1, shade(color, -0.5)]]);
  g.fill(p);
  g.strokeStyle = css(shade(color, -0.6), 0.8);
  g.lineWidth = 1.5;
  g.stroke(p);
  g.strokeStyle = css(shade(color, -0.35), 0.7);
  g.beginPath();
  g.moveTo(x - w * 0.46, floorY - h * 0.5);
  g.quadraticCurveTo(x, floorY - h * 0.42, x + w * 0.46, floorY - h * 0.5);
  g.stroke();
}

// ---------------------------------------------------------------------------
// Stone age: Quarry Cave
// ---------------------------------------------------------------------------

const OCHRE = 0xa45a36;

const cave: EnvDef = {
  theme: {
    soil: { top: 0x4a3b2c, mid: 0x3b2e23, deep: 0x1e1712, rock: 0x7a7066, root: 0x2e2216 },
    grass: 0x5f6b34,
    sky: [0x5aaef0, 0xc4e8fb],
    concrete: 0x6a6056,
    side: 0x463b31,
    ceiling: 0x3a312a,
    veil: 0x2e251e,
    veilAlpha: 0.32,
    key: 0xff9a50,
    shadow: 0x1a2030,
    floor: { top: 0x6a5a48, face: 0x3a2e24 },
  },
  exterior(P) {
    const { far: g, G, T } = P;
    const rng = P.rng.fork(11);
    const W = fullW(P), H = fullH(P);
    g.fillStyle = vGrad(g, Y0(), G.surfaceY, [[0, T.sky[0]], [1, T.sky[1]]]);
    g.fillRect(X0(), Y0(), W, G.surfaceY - Y0() + 2);
    soil(g, rng, X0(), G.surfaceY, W, Y0() + H - G.surfaceY, T.soil, { surfaceY: G.surfaceY + 6, roots: W / 80 });
    // the cave is cut straight into bedrock: a thick rough rock mass instead of a concrete shell
    const t = G.wallT;
    const x0 = -t - 18, y0 = G.slabTop - 20, x1 = G.w + t + 18, y1 = G.h + G.floorSlab + 16;
    const mass = new Path2D();
    const pts: [number, number][] = [];
    for (let x = x0; x <= x1; x += 40) pts.push([x, y0 + rng.range(-10, 8)]);
    for (let y = y0; y <= y1; y += 40) pts.push([x1 + rng.range(-6, 10), y]);
    for (let x = x1; x >= x0; x -= 40) pts.push([x, y1 + rng.range(-6, 10)]);
    for (let y = y1; y >= y0; y -= 40) pts.push([x0 + rng.range(-10, 6), y]);
    pts.forEach(([x, y], i) => (i ? mass.lineTo(x, y) : mass.moveTo(x, y)));
    mass.closePath();
    g.fillStyle = vGrad(g, y0, y1, [[0, 0x5e554c], [1, 0x3e3731]]);
    g.fill(mass);
    clipped(g, mass, () => {
      texture(g, 'mottle', x0, y0, x1 - x0, y1 - y0, { alpha: 0.55, op: 'soft-light', scale: 0.9 });
      texture(g, 'speckle', x0, y0, x1 - x0, y1 - y0, { alpha: 0.8 });
      for (let i = 0; i < 60; i++) rock(g, rng, rng.range(x0, x1), rng.range(y0, y1), rng.range(8, 20), 0x6e655c);
      for (let i = 0; i < 14; i++) crack(g, rng, rng.range(x0, x1), rng.range(y0, y1), rng.range(30, 70), 0x1e1a16, 0.6);
    });
    ink(g, mass, 2, 0x120e0b, 0.8);
    turf(g, rng, X0(), X0() + W, G.surfaceY, T.grass, T.soil.top);
  },
  backWall(P) {
    const { far: g, rng, G } = P;
    const x = G.bx0, y = G.by0, w = G.bx1 - G.bx0, h = G.by1 - G.by0;
    g.fillStyle = vGrad(g, y, G.by1, [[0, 0x4a3f35], [0.55, 0x52463a], [1, 0x41372e]]);
    g.fillRect(x, y, w, h);
    // sedimentary strata, gently wavy
    for (let k = 0; k < 9; k++) {
      const by = y + 30 + k * (h / 9) + rng.range(-8, 8);
      g.fillStyle = css(k % 2 ? 0x3a3129 : 0x5a4d40, 0.35);
      g.beginPath();
      g.moveTo(x, by);
      for (let sx = 0; sx <= w; sx += 60) g.lineTo(x + sx, by + Math.sin(sx * 0.008 + k) * 6 + rng.range(-3, 3));
      for (let sx = w; sx >= 0; sx -= 60) g.lineTo(x + sx, by + 18 + Math.sin(sx * 0.01 + k) * 5);
      g.closePath();
      g.fill();
    }
    // quarried steps low on the wall: cut blocks with chisel marks
    const qy = G.by1 - 150;
    blockCourses(g, rng, x, qy, w, 150, 0x51463b, 96, 50, 0.1);
    for (let i = 0; i < w / 14; i++) {
      const cx = x + rng.range(0, w), cy = qy + rng.range(6, 144);
      g.strokeStyle = css(0x2a231d, 0.35);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + rng.range(4, 9), cy + rng.range(-2, 2));
      g.stroke();
    }
    texture(g, 'mottle', x, y, w, h, { alpha: 0.4, op: 'soft-light', scale: 1.3 });
    texture(g, 'grime', x, y, w, h, { alpha: 0.4, scale: 1.8 });
    for (let i = 0; i < w / 160; i++) crack(g, rng, rng.range(x, x + w), rng.range(y, G.by1), rng.range(30, 80), 0x1e1a15, 0.5);
    // stalactites hanging from the cave roof
    for (let sx = x + 10; sx < x + w; sx += rng.range(26, 70)) {
      const len = rng.range(12, 46);
      const wd = rng.range(6, 14);
      g.fillStyle = vGrad(g, y, y + len, [[0, 0x3e352c], [1, 0x5c5044]]);
      g.beginPath();
      g.moveTo(sx - wd / 2, y);
      g.lineTo(sx + wd / 2, y);
      g.lineTo(sx + rng.range(-1, 1), y + len);
      g.closePath();
      g.fill();
    }
    // cave paintings: handprints, a herd and a sun, faded into the rock
    g.save();
    g.globalAlpha = 0.24;
    const hand = (hx: number, hy: number, rot: number, col: number) => {
      g.save();
      g.translate(hx, hy);
      g.rotate(rot);
      g.fillStyle = css(col);
      g.beginPath();
      g.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2);
      g.fill();
      for (let f = 0; f < 4; f++) {
        g.beginPath();
        g.ellipse(-7 + f * 4.6, -16 - (f === 1 || f === 2 ? 3 : 0), 2.2, 7, (f - 1.5) * 0.12, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      g.ellipse(11, -2, 2.4, 6.5, 0.9, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };
    hand(x + 70, G.by1 - 230, -0.2, OCHRE);
    hand(x + 98, G.by1 - 244, 0.1, 0x6a3020);
    hand(x + w - 120, G.by1 - 250, 0.25, OCHRE);
    // a little herd of long-legged grazers
    const beast = (bx: number, by: number, s: number) => {
      g.strokeStyle = css(0x2a1a12);
      g.fillStyle = css(0x2a1a12);
      g.lineWidth = 2.2 * s;
      g.beginPath();
      g.ellipse(bx, by, 16 * s, 7 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      for (const lx of [-11, -6, 7, 12]) {
        g.moveTo(bx + lx * s, by + 4 * s);
        g.lineTo(bx + (lx + 1) * s, by + 18 * s);
      }
      g.moveTo(bx + 14 * s, by - 3 * s);
      g.lineTo(bx + 22 * s, by - 12 * s);
      g.moveTo(bx + 21 * s, by - 13 * s);
      g.lineTo(bx + 17 * s, by - 22 * s);
      g.moveTo(bx + 22 * s, by - 13 * s);
      g.lineTo(bx + 28 * s, by - 21 * s);
      g.stroke();
    };
    beast(x + w * 0.62, G.by1 - 236, 1.1);
    beast(x + w * 0.7, G.by1 - 226, 0.9);
    g.strokeStyle = css(OCHRE);
    g.lineWidth = 2.5;
    g.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) {
      const r = 2 + a * 2.6;
      const px = x + w * 0.2 + Math.cos(a) * r, py = G.by1 - 250 + Math.sin(a) * r;
      a ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
    g.restore();
  },
  sideWalls(P) {
    const { far: g, rng, G } = P;
    for (let i = 0; i < 26; i++) {
      const left = i % 2 === 0;
      rock(g, rng, left ? rng.range(0, G.bx0) : rng.range(G.bx1, G.w), rng.range(G.ceilY, G.h), rng.range(10, 22), 0x4e443a);
    }
  },
  ceiling(P) {
    const { far: g, rng, G } = P;
    g.fillStyle = css(0x2e2620, 0.75);
    g.fillRect(0, G.ceilY, G.w, G.by0 - G.ceilY);
    for (let i = 0; i < 30; i++) rock(g, rng, rng.range(0, G.w), rng.range(G.ceilY, G.by0), rng.range(8, 16), 0x463b31);
  },
  floor(P) {
    const { far: g, rng, G } = P;
    floorPerspective(P, 0x5e4e3e, { cols: 7, rows: 2, line: 0x2a2018, lineAlpha: 0.15 });
    for (let i = 0; i < 140; i++) {
      g.fillStyle = css(rng.pick([0x7a6a58, 0x3a2e24, 0x8a7a66]), rng.range(0.3, 0.7));
      g.beginPath();
      g.ellipse(rng.range(0, G.w), rng.range(G.by1 + 4, G.h), rng.range(1, 3.5), rng.range(0.8, 2), 0, 0, Math.PI * 2);
      g.fill();
    }
    // straw
    g.strokeStyle = css(0xb09858, 0.3);
    g.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      const sx = rng.range(0, G.w), sy = rng.range(G.by1 + 8, G.h);
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + rng.range(-9, 9), sy + rng.range(-2, 2));
      g.stroke();
    }
  },
  props(P) {
    const { far: g, rng, G } = P;
    // left: stacked quarry blocks and a log pile
    const bx = G.bx0 + 20;
    const blockC = 0x4e4438;
    const blk = (x: number, y: number, w: number, h: number) => {
      const c = shade(blockC, rng.range(-0.08, 0.08));
      g.fillStyle = css(shade(c, -0.6));
      g.fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle = vGrad(g, y, y + h, [[0, shade(c, 0.15)], [1, shade(c, -0.25)]]);
      g.fillRect(x, y, w, h);
      texture(g, 'speckle', x, y, w, h, { alpha: 0.9, scale: 0.6 });
      crack(g, rng, x + w * 0.5, y + h * 0.5, 14, 0x2a241e, 0.5);
    };
    contactShadow(g, bx + 110, G.by1, 240);
    blk(bx, G.by1 - 50, 110, 50);
    blk(bx + 114, G.by1 - 40, 90, 40);
    // logs lying on their sides, bark out
    const lx = bx + 230;
    for (let row = 0; row < 3; row++) {
      const ly = G.by1 - 14 - row * 22;
      const llen = 150 - row * 34;
      const x0 = lx + row * 17;
      g.fillStyle = css(0x1e140c);
      g.beginPath();
      g.roundRect(x0 - 1, ly - 11, llen + 2, 22, 10);
      g.fill();
      g.fillStyle = vGrad(g, ly - 10, ly + 10, [[0, 0x6a4a2e], [0.4, 0x5a3e26], [1, 0x2e2014]]);
      g.beginPath();
      g.roundRect(x0, ly - 10, llen, 20, 9);
      g.fill();
      g.strokeStyle = css(0x2a1a0e, 0.6);
      g.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(x0 + 10, ly - 5 + k * 5);
        g.lineTo(x0 + llen - 12, ly - 5 + k * 5 + rng.range(-1, 1));
        g.stroke();
      }
    }
    // right: clay pots, a spear rack and a drying hide
    const rx = G.bx1 - 260;
    pot(g, rx, G.by1, 46, 64, 0x9a5a3a);
    pot(g, rx + 50, G.by1, 36, 48, 0x7a4a30);
    pot(g, rx + 92, G.by1, 52, 78, 0xa8683e);
    const hx = G.bx1 - 120, hy = G.by1 - 250;
    timber(g, rng, hx - 50, hy - 20, 8, 270, 0x5a4026);
    timber(g, rng, hx + 50, hy - 20, 8, 270, 0x5a4026);
    timber(g, rng, hx - 60, hy - 12, 128, 8, 0x5a4026);
    const hide = new Path2D();
    hide.moveTo(hx - 40, hy);
    hide.bezierCurveTo(hx - 10, hy + 6, hx + 10, hy + 6, hx + 42, hy);
    hide.bezierCurveTo(hx + 50, hy + 50, hx + 36, hy + 100, hx + 30, hy + 130);
    hide.bezierCurveTo(hx + 8, hy + 120, hx - 10, hy + 124, hx - 30, hy + 132);
    hide.bezierCurveTo(hx - 40, hy + 96, hx - 52, hy + 40, hx - 40, hy);
    g.fillStyle = vGrad(g, hy, hy + 130, [[0, 0x9a7650], [1, 0x7a5a3a]]);
    g.fill(hide);
    g.strokeStyle = css(0x3a2614, 0.8);
    g.lineWidth = 2;
    g.stroke(hide);
    texture(g, 'mottle', hx - 50, hy, 100, 140, { alpha: 0.4, op: 'soft-light' });
    // bones on the floor line
    g.strokeStyle = css(0xd8ccb0, 0.85);
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(G.w * 0.46, G.by1 - 4);
    g.lineTo(G.w * 0.46 + 40, G.by1 - 10);
    g.stroke();
  },
  cheer(P) {
    const { far: g, rng, G } = P;
    // a sunny cave mouth high in the back wall: blue sky, clouds, green hills
    const mouth = new Path2D();
    const cx = 520, cy = 120;
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const r = 1 + Math.sin(a * 3 + 1) * 0.08 + Math.sin(a * 5) * 0.05;
      const px = cx + Math.cos(a) * 125 * r, py = cy + Math.sin(a) * 92 * r;
      i ? mouth.lineTo(px, py) : mouth.moveTo(px, py);
    }
    mouth.closePath();
    g.save();
    g.lineWidth = 22;
    g.strokeStyle = css(0x7a5a3c);
    g.stroke(mouth);
    g.lineWidth = 8;
    g.strokeStyle = css(0xb08a5c);
    g.stroke(mouth);
    g.clip(mouth);
    skyPane(g, rng, cx - 140, cy - 100, 280, 200, { sun: [0.72, 0.3], clouds: 2, hills: true });
    g.restore();
    blob(P.light, cx, cy + 110, 170, 60, 0xfff2c8, 0.1, 0.3);
    sunbeam(P, cx, cy + 92, 200, 420, G.by1 - cy - 92, 140, 0.14);
    // vines and flowers tumbling in round the mouth
    for (const [vx, vl] of [[410, 120], [470, 80], [600, 110], [640, 70]] as const) {
      g.strokeStyle = css(0x4f7a32);
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(vx, cy - 60);
      g.quadraticCurveTo(vx + 10, cy - 60 + vl * 0.6, vx - 6, cy - 60 + vl);
      g.stroke();
      for (let ly = cy - 50; ly < cy - 60 + vl; ly += 22) leafCluster(g, rng, vx + rng.range(-6, 6), ly, 16, [0x5f9a3e, 0x7cb850], 2, 0, Math.PI);
    }
    // leaf-and-feather garlands, a pot of wild flowers and a happy cave painting
    bunting(g, 60, 34, 360, 44, 14, [0x6cc87a, 0xf2c043, 0xe0603c, 0x8fd0f5], 20, 'leaf');
    bunting(g, 690, 44, 1060, 34, 14, [0xe0603c, 0x6cc87a, 0xf2c043, 0xe07ab8], 20, 'leaf');
    flowerPot(g, rng, 600, G.by1, 30, 0xb8683e);
    g.save();
    g.globalAlpha = 0.75;
    sun(g, 500, 330, 18, true);
    g.strokeStyle = css(0xb8502a);
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (const fx of [450, 560, 600]) {
      g.beginPath();
      g.arc(fx, 352, 6, 0, Math.PI * 2);
      g.moveTo(fx, 358);
      g.lineTo(fx, 380);
      g.moveTo(fx - 12, 362);
      g.lineTo(fx, 368);
      g.lineTo(fx + 12, 360);
      g.moveTo(fx - 8, 396);
      g.lineTo(fx, 380);
      g.lineTo(fx + 8, 396);
      g.stroke();
    }
    g.restore();
  },
  lights(P) {
    const { G, amb } = P;
    torch(P, G.bx0 + 200, G.by0 + 170);
    torch(P, G.bx1 - 300, G.by0 + 150);
    lightCone(P.light, G.w * 0.5, G.by0, 120, 520, G.by1 - G.by0, 0xffd8a0, 0.04, 30);
    amb.push({ kind: 'dust', x: G.w * 0.3, y: 60, w: 420, h: Math.min(420, G.h * 0.6), color: 0xffd8a0, layer: 'far' });
    amb.push({ kind: 'drip', x: G.bx0 + 420, y: G.by0 + 30, color: 0x9fb7c0, size: 2, period: 5, layer: 'far' });
  },
  soilExtras(P) {
    const { far: g, rng, G } = P;
    // an ammonite and a few old bones in the earth
    const ax = -140, ay = G.h * 0.55;
    g.strokeStyle = css(0xb8a888, 0.5);
    g.lineWidth = 3;
    g.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.15) {
      const r = 2 + a * 2.8;
      const px = ax + Math.cos(a) * r, py = ay + Math.sin(a) * r;
      a ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = css(0xcabd9e, 0.45);
      g.lineWidth = 4;
      const bx = rng.range(-ENV_MARGIN.left, G.w + ENV_MARGIN.right), by = rng.range(G.h + 80, G.h + 220);
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + rng.range(20, 40), by + rng.range(-8, 8));
      g.stroke();
    }
  },
  near(P) {
    const { near: g, rng, G, amb } = P;
    const dark = 0x140f0b, rim = 0xff9a50;
    // hanging roots and vines through the cave roof
    for (let i = 0; i < 4; i++) roots(g, rng, 30 + i * 90, -200, 180, 4, 0x1c140c, 3);
    for (let i = 0; i < 3; i++) roots(g, rng, G.w - 40 - i * 80, -200, 170, 4, 0x1c140c, 3);
    amb.push({ kind: 'sway', x: 80, y: 30, size: 8, period: 6, layer: 'near' });
    // boulders in the bottom corners
    const bl = new Path2D();
    bl.ellipse(10, G.h + 30, 130, 80, 0.1, 0, Math.PI * 2);
    silhouette(g, bl, dark, rim, -2, -2, 0.25);
    const br = new Path2D();
    br.ellipse(G.w + 10, G.h + 40, 150, 90, -0.15, 0, Math.PI * 2);
    silhouette(g, br, dark, rim, -2, -2, 0.25);
  },
};

// ---------------------------------------------------------------------------
// Steam: Brass Foundry
// ---------------------------------------------------------------------------

const BRASS = 0xb88a44;
const COPPER = 0xa8603a;

const foundry: EnvDef = {
  exterior(P) {
    const { far: g, G, T } = P;
    const rng = P.rng.fork(11);
    const W = fullW(P), H = fullH(P);
    g.fillStyle = vGrad(g, Y0(), G.surfaceY, [[0, T.sky[0]], [1, T.sky[1]]]);
    g.fillRect(X0(), Y0(), W, G.surfaceY - Y0() + 2);
    // factory chimneys on the skyline
    for (let cx = X0() + 60; cx < X0() + W; cx += rng.range(140, 260)) {
      const ch = rng.range(40, 110);
      g.fillStyle = css(0x241a14);
      g.fillRect(cx, G.surfaceY - ch, rng.range(14, 24), ch);
    }
    soil(g, rng, X0(), G.surfaceY, W, Y0() + H - G.surfaceY, T.soil, { surfaceY: G.surfaceY + 6, roots: W / 90 });
    const t = G.wallT;
    g.fillStyle = css(0x120c08);
    g.fillRect(-t - 6, G.slabTop - 6, G.w + 2 * t + 12, G.h + G.floorSlab - G.slabTop + 12);
    bricks(g, rng, -t, G.slabTop, G.w + 2 * t, G.h + G.floorSlab - G.slabTop, 0x4a2a1e, 0x1e140e, 40, 16);
    g.fillStyle = css(0x0a0604, 0.35);
    g.fillRect(-t, G.slabTop, G.w + 2 * t, G.h + G.floorSlab - G.slabTop);
    // iron cap along the top of the shell
    g.fillStyle = vGrad(g, G.slabTop, G.slabTop + 12, [[0, 0x6a5848], [1, 0x2a2018]]);
    g.fillRect(-t, G.slabTop, G.w + 2 * t, 12);
    rivetRow(g, -t + 10, G.w + t - 10, G.slabTop + 6, 36, 2.2, 0x8a7258);
    turf(g, rng, X0(), X0() + W, G.surfaceY, T.grass, T.soil.top);
  },
  theme: {
    soil: { top: 0x4a3a2c, mid: 0x3a2c22, deep: 0x1e1612, rock: 0x6d6258, root: 0x2f2318 },
    grass: 0x55602f,
    sky: [0x5aaef0, 0xc4e8fb],
    concrete: 0x6e5e50,
    side: 0x45372b,
    ceiling: 0x372b21,
    veil: 0x2e2218,
    veilAlpha: 0.36,
    key: 0xffa050,
    shadow: 0x1e1a2a,
    floor: { top: 0x5a4a3a, face: 0x2e241c },
  },
  backWall(P) {
    const { far: g, rng, G } = P;
    const x = G.bx0, y = G.by0, w = G.bx1 - G.bx0;
    const split = G.by1 - 170;
    // riveted iron plate above, sooty brick dado below
    const plate = 0x4a4036;
    const pw = 128, ph = 92;
    for (let py = y; py < split; py += ph) for (let px = x; px < x + w; px += pw) metalPanel(g, rng, px, py, pw, Math.min(ph, split - py), plate, true);
    bricks(g, rng, x, split, w, G.by1 - split, 0x5a3326, 0x2a1c16, 44, 18);
    g.fillStyle = css(0x1a120c, 0.4);
    g.fillRect(x, split, w, G.by1 - split);
    // brass trim rail
    g.fillStyle = vGrad(g, split - 6, split + 6, [[0, shade(BRASS, 0.3)], [1, shade(BRASS, -0.45)]]);
    g.fillRect(x, split - 6, w, 12);
    rivetRow(g, x + 10, x + w - 10, split, 40, 2.2, BRASS);
    texture(g, 'grime', x, y, w, G.by1 - y, { alpha: 0.5, scale: 1.4 });
    streaks(g, rng, x, x + w, y + 20, 300, Math.round(w / 30), 0x1a120a, 0.3);
    stencil(g, 'No. 7 WORKS', x + w * 0.5, y + 60, 22, 0xd8c098, 0.12, 'center');
  },
  ceiling(P) {
    const { far: g, rng, G } = P;
    g.fillStyle = css(0x2a2018, 0.8);
    g.fillRect(0, G.ceilY, G.w, G.by0 - G.ceilY);
    for (let bx = 60; bx < G.w; bx += 180) {
      g.fillStyle = css(0x3e3228);
      g.fillRect(bx - 8, G.ceilY, 16, G.by0 - G.ceilY);
      rivet(g, bx, (G.ceilY + G.by0) / 2, 2, 0x6a5848);
    }
    void rng;
  },
  floor(P) {
    floorPerspective(P, 0x463c33, { cols: 14, rows: 3, line: 0x1a140f, lineAlpha: 0.45, checker: 0x3a3028 });
  },
  props(P) {
    const { far: g, rng, G, amb } = P;
    // pipe runs: brass along the top, copper risers
    const py = G.by0 + 40;
    pipe(g, [[G.bx0, py], [G.bx1, py]], { color: BRASS, r: 9, flangeEvery: 200 });
    pipe(g, [[G.bx0 + 120, py], [G.bx0 + 120, G.by1 - 200]], { color: COPPER, r: 7, flangeEvery: 120 });
    pipe(g, [[G.bx1 - 150, py], [G.bx1 - 150, G.by1 - 260]], { color: COPPER, r: 7, flangeEvery: 120 });
    valveWheel(g, G.bx0 + 120, G.by1 - 300, 16, 0x8a3a24);
    amb.push({ kind: 'steam', x: G.bx1 - 150, y: G.by1 - 262, period: 3.2, layer: 'far' });
    amb.push({ kind: 'steam', x: G.bx0 + 400, y: py - 8, period: 4.1, layer: 'far' });
    // boiler, left: a riveted drum lying on brick saddles, with gauges
    const bx = G.bx0 + 30, bw = 300, bh = 120, by = G.by1 - 34 - bh;
    contactShadow(g, bx + bw / 2, G.by1, bw);
    g.fillStyle = css(0x2a1c14);
    g.fillRect(bx + 30, G.by1 - 40, 50, 40);
    g.fillRect(bx + bw - 80, G.by1 - 40, 50, 40);
    g.fillStyle = css(0x1a120c);
    g.beginPath();
    g.roundRect(bx - 2, by - 2, bw + 4, bh + 4, bh / 2);
    g.fill();
    g.fillStyle = vGrad(g, by, by + bh, [[0, 0x8a6a46], [0.3, 0xb88a56], [0.55, 0x8a6036], [1, 0x3e2a18]]);
    g.beginPath();
    g.roundRect(bx, by, bw, bh, bh / 2);
    g.fill();
    for (let k = 1; k < 5; k++) {
      const sx = bx + (k * bw) / 5;
      g.fillStyle = css(0x3a2614, 0.6);
      g.fillRect(sx - 2, by + 4, 4, bh - 8);
      for (let ry = by + 14; ry < by + bh - 10; ry += 16) rivet(g, sx + 5, ry, 1.8, 0xc89a5a);
    }
    gauge(g, rng, bx + 70, by - 24, 20);
    gauge(g, rng, bx + 120, by - 18, 14);
    pipe(g, [[bx + 70, by - 4], [bx + 70, by + 4]], { color: BRASS, r: 3 });
    pipe(g, [[bx + 260, by], [bx + 260, py]], { color: COPPER, r: 6 });
    // furnace, right: brick arch with a glowing mouth
    const fx = G.bx1 - 300, fw = 200, fh = 210, fy = G.by1 - fh;
    g.fillStyle = css(0x1a100a);
    g.fillRect(fx - 4, fy - 4, fw + 8, fh + 4);
    bricks(g, rng, fx, fy, fw, fh, 0x5e3424, 0x24160f, 30, 14);
    const mouth = new Path2D();
    mouth.moveTo(fx + 50, G.by1 - 24);
    mouth.lineTo(fx + 50, G.by1 - 100);
    mouth.arc(fx + 100, G.by1 - 100, 50, Math.PI, 0);
    mouth.lineTo(fx + 150, G.by1 - 24);
    mouth.closePath();
    g.fillStyle = vGrad(g, G.by1 - 150, G.by1 - 24, [[0, 0x4a1e0c], [0.6, 0x9a4416], [1, 0xc0702a]]);
    g.fill(mouth);
    g.strokeStyle = css(0x1a0e08);
    g.lineWidth = 6;
    g.stroke(mouth);
    // chimney flue
    g.fillStyle = vGrad(g, G.by0, fy, [[0, 0x2a2018], [1, 0x3a2c22]]);
    g.fillRect(fx + 70, G.by0, 60, fy - G.by0);
    rivetRow(g, fx + 76, fx + 124, fy - 20, 16, 2, 0x6a5848);
    // coal heap and a crucible
    g.fillStyle = css(0x161210);
    g.beginPath();
    g.moveTo(fx - 120, G.by1);
    g.quadraticCurveTo(fx - 70, G.by1 - 50, fx - 20, G.by1);
    g.closePath();
    g.fill();
    for (let i = 0; i < 20; i++) {
      g.fillStyle = css(0x3a3430, rng.range(0.4, 0.8));
      g.beginPath();
      g.arc(fx - 120 + rng.range(10, 90), G.by1 - rng.range(2, 30), rng.range(2, 4), 0, Math.PI * 2);
      g.fill();
    }
    cylinder(g, G.w * 0.52, G.by1, 44, 90, 0x6a4a30, BRASS);
  },
  cheer(P) {
    const { far: g, rng, G } = P;
    // a tall arched works window full of sunshine between the gas lamps
    sunnyWindow(P, 404, 70, 212, 270, { arch: true, cols: 3, rows: 4, frame: 0xd8b878, sun: [0.7, 0.26], clouds: 2, beam: 160 });
    bunting(g, 60, 62, 1060, 62, 12, [0xc8402e, 0xf4ead0, 0x2e5a8a, 0xe0b040]);
    flowerPot(g, rng, 300, 414, 24, 0xb06a40);
    doodle(g, rng, 676, 236, 66, 80, 'machine', 0.05, 0xf4e8cc);
    bigPlant(g, rng, 1036, G.by1, 120, 0xb88a44);
  },
  lights(P) {
    const { far: g, light, G, amb } = P;
    const fx = G.bx1 - 300;
    // furnace glow
    blob(g, fx + 100, G.by1 - 70, 110, 80, 0xff7a2a, 0.14);
    blob(light, fx + 100, G.by1 - 70, 60, 50, 0xffb060, 0.45, 0.2);
    blob(light, fx + 100, G.by1 - 40, 260, 160, 0xff7a2a, 0.16);
    amb.push({ kind: 'blink', x: fx + 100, y: G.by1 - 60, color: 0xff8a3a, size: 16, period: 1.7, layer: 'far' });
    // gas lamps on the walls
    cagedLamp(g, light, G.bx0 + 260, G.by0 + 120, 0xffc070, 0.9);
    cagedLamp(g, light, G.w * 0.62, G.by0 + 110, 0xffc070, 0.8);
    amb.push({ kind: 'dust', x: G.w * 0.4, y: 70, w: 380, h: Math.min(400, G.h * 0.55), color: 0xffd8a0, layer: 'far' });
  },
  soilExtras(P) {
    const { far: g, G } = P;
    pipe(g, [[X0(), G.h + 140], [G.w + ENV_MARGIN.right, G.h + 140]], { color: COPPER, r: 16, flangeEvery: 220 });
    pipe(g, [[-G.wallT - 30, G.h * 0.3], [-G.wallT - 30, G.h + 140]], { color: BRASS, r: 9, flangeEvery: 160 });
  },
  near(P) {
    const { near: g, rng, G, amb } = P;
    // big copper pipe and valve, top-left
    pipe(g, [[-230, 20], [60, 20], [60, -200]], { color: shade(COPPER, -0.35), r: 22, flangeEvery: 140 });
    valveWheel(g, 60, -20, 24, 0x5a2416);
    amb.push({ kind: 'steam', x: 20, y: 0, period: 3.6, layer: 'near' });
    // chain hanging top-right
    for (let cy = -200; cy < 80; cy += 14) {
      g.strokeStyle = css(0x1a140f);
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(G.w - 60 + Math.sin(cy * 0.02) * 3, cy, 5, 8, 0, 0, Math.PI * 2);
      g.stroke();
    }
    // riveted boiler-end silhouettes at the bottom corners
    const bl = new Path2D();
    bl.ellipse(0, G.h + 60, 140, 120, 0, 0, Math.PI * 2);
    silhouette(g, bl, 0x1a120c, 0xffa050, -2, -2, 0.25);
    const br = new Path2D();
    br.addPath(rrPath(G.w - 90, G.h - 60, 160, 260, 20));
    silhouette(g, br, 0x1a120c, 0xffa050, -2, -2, 0.25);
    void rng;
  },
};

// ---------------------------------------------------------------------------
// Retro: the Toolbox (flat colours, a plain tiled wall, a chunky bevelled frame)
// ---------------------------------------------------------------------------

const toolbox: EnvDef = {
  flat: true,
  theme: {
    soil: { top: 0x1f4f55, mid: 0x1f4f55, deep: 0x1f4f55, rock: 0x2a6068, root: 0x1f4f55 },
    grass: 0x1f4f55,
    sky: [0x1f4f55, 0x1f4f55],
    concrete: 0x8a8a8a,
    side: 0x5aa6cc,
    ceiling: 0x4a96bc,
    veil: 0x0e1820,
    veilAlpha: 0.18,
    key: 0xffffff,
    shadow: 0x000000,
    floor: { top: 0x6b4f33, face: 0x3a2a1a },
  },
  exterior(P) {
    const { far: g, G } = P;
    const W = fullW(P), H = fullH(P);
    // a plain desktop-style backdrop with a simple diamond tile
    g.fillStyle = css(0x1d4a50);
    g.fillRect(X0(), Y0(), W, H);
    g.fillStyle = css(0x245860);
    for (let y = Y0(); y < Y0() + H; y += 32) {
      for (let x = X0() + ((y / 32) % 2 ? 16 : 0); x < X0() + W; x += 32) {
        g.beginPath();
        g.moveTo(x, y - 6);
        g.lineTo(x + 6, y);
        g.lineTo(x, y + 6);
        g.lineTo(x - 6, y);
        g.closePath();
        g.fill();
      }
    }
    // chunky grey bevelled frame around the room
    const t = G.wallT;
    const fx = -t, fy = G.ceilY - t, fw = G.w + 2 * t, fh = G.h - G.ceilY + 2 * t;
    g.fillStyle = css(0x000000);
    g.fillRect(fx - 3, fy - 3, fw + 6, fh + 6);
    g.fillStyle = css(0x8c8c8c);
    g.fillRect(fx, fy, fw, fh);
    // bevel: light top-left, dark bottom-right (outer and inner)
    const bevelBand = (x: number, y: number, w: number, h: number, hi: number, lo: number, b: number) => {
      g.fillStyle = css(hi);
      g.beginPath();
      g.moveTo(x, y + h);
      g.lineTo(x, y);
      g.lineTo(x + w, y);
      g.lineTo(x + w - b, y + b);
      g.lineTo(x + b, y + b);
      g.lineTo(x + b, y + h - b);
      g.closePath();
      g.fill();
      g.fillStyle = css(lo);
      g.beginPath();
      g.moveTo(x + w, y);
      g.lineTo(x + w, y + h);
      g.lineTo(x, y + h);
      g.lineTo(x + b, y + h - b);
      g.lineTo(x + w - b, y + h - b);
      g.lineTo(x + w - b, y + b);
      g.closePath();
      g.fill();
    };
    bevelBand(fx, fy, fw, fh, 0xc4c4c4, 0x4a4a4a, 5);
    bevelBand(-6, G.ceilY - 6, G.w + 12, G.h - G.ceilY + 12, 0x4a4a4a, 0xc4c4c4, 4);
    g.fillStyle = css(0x000000);
    g.fillRect(-2, G.ceilY - 2, G.w + 4, G.h - G.ceilY + 4);
    // screw heads in the frame corners
    for (const [sx, sy] of [[fx + 18, fy + 18], [fx + fw - 18, fy + 18], [fx + 18, fy + fh - 18], [fx + fw - 18, fy + fh - 18]]) {
      g.fillStyle = css(0x000000);
      g.beginPath();
      g.arc(sx, sy, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = css(0xb0b0b0);
      g.beginPath();
      g.arc(sx, sy, 6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = css(0x000000);
      g.fillRect(sx - 5, sy - 1, 10, 2);
    }
  },
  backWall(P) {
    const { far: g, G } = P;
    const x = G.bx0, y = G.by0, w = G.bx1 - G.bx0, h = G.by1 - G.by0;
    // plain flat wall with big square tiles
    g.fillStyle = css(0x86c8e8);
    g.fillRect(x, y, w, h);
    g.fillStyle = css(0x92d0ee);
    for (let ty = y; ty < G.by1; ty += 64) for (let tx = x + (((ty - y) / 64) % 2 ? 32 : 0); tx < x + w; tx += 64) g.fillRect(tx + 2, ty + 2, 28, 28);
    g.strokeStyle = css(0x62a8cc);
    g.lineWidth = 2;
    g.beginPath();
    for (let ty = y; ty <= G.by1; ty += 64) {
      g.moveTo(x, ty);
      g.lineTo(x + w, ty);
    }
    for (let tx = x; tx <= x + w; tx += 64) {
      g.moveTo(tx, y);
      g.lineTo(tx, G.by1);
    }
    g.stroke();
    // flat skirting board
    g.fillStyle = css(0x5a3e26);
    g.fillRect(x, G.by1 - 22, w, 22);
    g.fillStyle = css(0x000000);
    g.fillRect(x, G.by1 - 24, w, 2);
  },
  sideWalls(P) {
    const { far: g, G } = P;
    g.fillStyle = css(0x5aa6cc);
    g.fillRect(0, G.ceilY, G.bx0, G.h - G.ceilY);
    g.fillRect(G.bx1, G.ceilY, G.w - G.bx1, G.h - G.ceilY);
  },
  ceiling(P) {
    const { far: g, G } = P;
    g.fillStyle = css(0x4a96bc);
    g.fillRect(0, G.ceilY, G.w, G.by0 - G.ceilY);
  },
  floor(P) {
    const { far: g, G } = P;
    g.fillStyle = css(0x9a7048);
    g.fillRect(0, G.by1, G.w, G.h - G.by1);
    g.fillStyle = css(0x8a6440);
    g.fillRect(0, G.by1, G.w, (G.h - G.by1) * 0.4);
    g.strokeStyle = css(0x000000, 0.7);
    g.lineWidth = 2;
    g.beginPath();
    const cols = 10;
    for (let i = 0; i <= cols; i++) {
      g.moveTo(G.bx0 + (i / cols) * (G.bx1 - G.bx0), G.by1);
      g.lineTo((i / cols) * G.w, G.h);
    }
    g.moveTo(0, G.by1 + (G.h - G.by1) * 0.45);
    g.lineTo(G.w, G.by1 + (G.h - G.by1) * 0.45);
    g.stroke();
  },
  props(P) {
    const { far: g, G } = P;
    const box = (x: number, y: number, w: number, h: number, fill: number, lw = 3) => {
      g.fillStyle = css(fill);
      g.fillRect(x, y, w, h);
      g.fillStyle = css(shade(fill, 0.25));
      g.fillRect(x, y, w, 4);
      g.fillStyle = css(shade(fill, -0.3));
      g.fillRect(x, y + h - 4, w, 4);
      ink(g, rect(x, y, w, h), lw, 0x000000);
    };
    // window, upper left: flat sky with one cloud
    const wx = G.bx0 + 60, wy = G.by0 + 70, ww = 180, wh = 130;
    box(wx - 10, wy - 10, ww + 20, wh + 20, 0xd8d0b8);
    g.fillStyle = css(0x4a7aa8);
    g.fillRect(wx, wy, ww, wh);
    g.fillStyle = css(0xd8e4ee);
    for (const [cx, cy, r] of [[wx + 60, wy + 46, 16], [wx + 80, wy + 40, 20], [wx + 102, wy + 48, 14]]) {
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = css(0xd8d0b8);
    g.fillRect(wx + ww / 2 - 4, wy, 8, wh);
    g.fillRect(wx, wy + wh / 2 - 4, ww, 8);
    ink(g, rect(wx, wy, ww, wh), 3, 0x000000);
    // shelf with jars and books, upper right
    const sx = G.bx1 - 320, sy = G.by0 + 150;
    box(sx, sy, 260, 14, 0x8a6038);
    const items: [number, number, number][] = [[18, 40, 0xc83c2c], [44, 52, 0x2c6ac8], [70, 46, 0x3c9a3c], [96, 34, 0xd8b02c], [140, 30, 0xe8e0c8], [176, 44, 0x8a3ca8], [210, 38, 0xc86a2c]];
    for (const [ix, ih, c] of items) box(sx + ix, sy - ih, 22, ih, c, 2.5);
    // blueprint poster, centre-right
    const bx = G.w * 0.56, by = G.by0 + 60;
    box(bx, by, 150, 104, 0x2a5a9a);
    g.strokeStyle = css(0xdde8f8, 0.8);
    g.lineWidth = 2;
    g.strokeRect(bx + 16, by + 18, 60, 40);
    g.beginPath();
    g.arc(bx + 110, by + 52, 22, 0, Math.PI * 2);
    g.moveTo(bx + 16, by + 82);
    g.lineTo(bx + 132, by + 82);
    g.stroke();
    // red toolbox on the floor, right, and a stack of crates, left
    const tx = G.bx1 - 240, tw = 150, th = 70;
    box(tx, G.by1 - th, tw, th, 0xc0302a);
    box(tx + 40, G.by1 - th - 14, tw - 80, 14, 0x8a8a8a, 2.5);
    box(tx + 10, G.by1 - th + 26, tw - 20, 8, 0x8a1c18, 2);
    box(G.bx0 + 30, G.by1 - 70, 90, 70, 0xb8863c);
    box(G.bx0 + 124, G.by1 - 54, 70, 54, 0xa0742e);
    box(G.bx0 + 50, G.by1 - 126, 70, 56, 0xc8964a);
  },
  cheer(P) {
    const { far: g, rng, G } = P;
    // the window gets a proper summer sky (flat colours, chunky outline)
    const wx = G.bx0 + 60, wy = G.by0 + 70, ww = 180, wh = 130;
    g.fillStyle = css(0xd8d0b8);
    g.fillRect(wx - 10, wy - 10, ww + 20, wh + 20);
    g.fillStyle = css(0x58b4f0);
    g.fillRect(wx, wy, ww, wh);
    g.fillStyle = css(0x8ed2f8);
    g.fillRect(wx, wy + wh * 0.55, ww, wh * 0.45);
    sun(g, wx + ww * 0.78, wy + 34, 18, true);
    cloud(g, rng, wx + 64, wy + 52, 46);
    g.fillStyle = css(0x6cc05a);
    g.beginPath();
    g.moveTo(wx, wy + wh);
    g.quadraticCurveTo(wx + ww * 0.3, wy + wh - 40, wx + ww * 0.6, wy + wh - 16);
    g.quadraticCurveTo(wx + ww * 0.8, wy + wh - 32, wx + ww, wy + wh - 20);
    g.lineTo(wx + ww, wy + wh);
    g.closePath();
    g.fill();
    g.fillStyle = css(0xd8d0b8);
    g.fillRect(wx + ww / 2 - 4, wy, 8, wh);
    g.fillRect(wx, wy + wh / 2 - 4, ww, 8);
    ink(g, rect(wx, wy, ww, wh), 3, 0x000000);
    ink(g, rect(wx - 10, wy - 10, ww + 20, wh + 20), 3, 0x000000);
    bunting(g, 60, 30, 1060, 30, 14, [0xe83c2c, 0xf8d030, 0x2c8ae8, 0x3cc84c, 0xffffff]);
    flowerPot(g, rng, 140, 446, 26);
    doodle(g, rng, 452, 236, 70, 84, 'robot', -0.05, 0xffffff);
    doodle(g, rng, 556, 262, 66, 58, 'rainbow', 0.06, 0xffffff);
    bigPlant(g, rng, 730, G.by1, 130);
  },
  lights(P) {
    const { far: g, light, G } = P;
    // one flat ceiling lamp
    const lx = G.w * 0.4;
    g.strokeStyle = css(0x000000);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(lx, G.by0);
    g.lineTo(lx, G.by0 + 40);
    g.stroke();
    const shadePath = poly([[lx - 34, G.by0 + 70], [lx + 34, G.by0 + 70], [lx + 16, G.by0 + 40], [lx - 16, G.by0 + 40]]);
    g.fillStyle = css(0x3c8a5a);
    g.fill(shadePath);
    ink(g, shadePath, 3, 0x000000);
    g.fillStyle = css(0xf8f0b0);
    g.beginPath();
    g.arc(lx, G.by0 + 74, 9, 0, Math.PI);
    g.fill();
    blob(light, lx, G.by0 + 140, 300, 220, 0xfff0c0, 0.16);
  },
  soilExtras() {},
  near(P) {
    const { near: g, G } = P;
    // big flat tabs on the frame, like the corners of a toy box lid
    for (const [x, y] of [[-150, -150], [G.w + 150, -150]]) {
      const p = new Path2D();
      p.moveTo(x - 70, y);
      p.lineTo(x + 70, y);
      p.lineTo(x, y + 70);
      p.closePath();
      g.fillStyle = css(0x6e6e6e);
      g.fill(p);
      ink(g, p, 3, 0x000000);
    }
  },
};

// ---------------------------------------------------------------------------
// Comic: Rooftop Panel
// ---------------------------------------------------------------------------

const INK = 0x0a0a18;

function building(g: Ctx, rng: Rand, x: number, base: number, w: number, h: number, color: number, lit: number, litAlpha: number): void {
  const p = rect(x, base - h, w, h);
  g.fillStyle = css(color);
  g.fill(p);
  // windows
  for (let wy = base - h + 12; wy < base - 14; wy += 18) {
    for (let wx = x + 8; wx < x + w - 10; wx += 15) {
      const on = rng.chance(0.32);
      g.fillStyle = css(on ? lit : shade(color, -0.25), on ? litAlpha : 0.8);
      g.fillRect(wx, wy, 7, 10);
    }
  }
  ink(g, p, 2.5, INK);
}

const rooftop: EnvDef = {
  theme: {
    soil: { top: 0x1a1e34, mid: 0x161a2e, deep: 0x101322, rock: 0x22283e, root: 0x1a1e34 },
    grass: 0x1a1e34,
    sky: [0x161a2e, 0x161a2e],
    concrete: 0x2c3046,
    side: 0x9a6a64,
    ceiling: 0x6aaee0,
    veil: 0x161a34,
    veilAlpha: 0.34,
    key: 0x9fb0ff,
    shadow: 0x200a30,
    floor: { top: 0x3a3a48, face: 0x1e1e28 },
  },
  exterior(P) {
    const { far: g, G } = P;
    const W = fullW(P), H = fullH(P);
    // a dark printed page with a coarse halftone, then the panel's gutter and ink border
    g.fillStyle = css(0xf6e2a0);
    g.fillRect(X0(), Y0(), W, H);
    halftone(g, X0(), Y0(), W, H, 9, 0xeec46a, 1, (x, y) => 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(x * 0.004 + y * 0.003)));
    const t = G.wallT;
    g.fillStyle = css(0xe8e0c8);
    g.fillRect(-t, G.ceilY - t, G.w + 2 * t, G.h - G.ceilY + 2 * t);
    g.fillStyle = css(INK);
    g.fillRect(-t + 10, G.ceilY - t + 10, G.w + 2 * t - 20, G.h - G.ceilY + 2 * t - 20);
  },
  backWall(P) {
    const { far: g, rng, G } = P;
    const x = G.bx0, y = G.by0, w = G.bx1 - G.bx0;
    const horizon = G.by1 - 46;
    // a bright day sky in flat bands with a halftone fade
    g.fillStyle = vGrad(g, y, horizon, [[0, 0x3e9ee8], [0.6, 0x78c4f2], [1, 0xbfe6fa]]);
    g.fillRect(x, y, w, G.by1 - y);
    halftone(g, x, y, w, horizon - y, 8, 0xffffff, 0.45, (_x, yy) => Math.max(0, (yy - y) / (horizon - y) - 0.3) * 0.9);
    // the sun with printed rays, and two inked clouds
    const mx = x + w * 0.78, my = y + 110, mr = 50;
    g.save();
    g.strokeStyle = css(INK);
    g.lineWidth = 3;
    g.fillStyle = css(0xffcc3a);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const ray = poly([[mx + Math.cos(a - 0.12) * (mr + 8), my + Math.sin(a - 0.12) * (mr + 8)], [mx + Math.cos(a) * (mr + 34), my + Math.sin(a) * (mr + 34)], [mx + Math.cos(a + 0.12) * (mr + 8), my + Math.sin(a + 0.12) * (mr + 8)]]);
      g.fill(ray);
      g.stroke(ray);
    }
    g.restore();
    g.fillStyle = css(0xffe46a);
    g.beginPath();
    g.arc(mx, my, mr, 0, Math.PI * 2);
    g.fill();
    halftone(g, mx - mr, my - mr, mr * 2, mr * 2, 6, 0xf0a030, 0.7, (xx, yy) => ((xx - mx + 16) ** 2 + (yy - my + 10) ** 2 > mr * mr * 0.8 && (xx - mx) ** 2 + (yy - my) ** 2 < mr * mr ? 0.85 : 0));
    ink(g, (() => { const p = new Path2D(); p.arc(mx, my, mr, 0, Math.PI * 2); return p; })(), 3, INK);
    for (const [cx, cy, cs] of [[x + w * 0.2, y + 90, 70], [x + w * 0.5, y + 60, 56]] as const) {
      cloud(g, rng, cx, cy, cs);
    }
    // skyline: far row lighter, near row darker, all inked
    let bx = x - 10;
    while (bx < x + w) {
      const bw = rng.range(50, 110);
      building(g, rng, bx, horizon, bw, rng.range(110, 260), 0x9ab4dc, 0xeef8ff, 0.85);
      bx += bw + rng.range(-6, 10);
    }
    bx = x - 30;
    while (bx < x + w) {
      const bw = rng.range(70, 140);
      building(g, rng, bx, horizon, bw, rng.range(60, 170), 0xe0a07a, 0xfff4d0, 0.9);
      bx += bw + rng.range(10, 60);
    }
    // a water tower on stilts
    const tx = x + w * 0.3, ty = horizon - 200;
    g.strokeStyle = css(INK);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(tx + 6, ty + 60);
    g.lineTo(tx - 4, horizon - 100);
    g.moveTo(tx + 54, ty + 60);
    g.lineTo(tx + 64, horizon - 100);
    g.stroke();
    const tank = rect(tx, ty, 60, 62);
    g.fillStyle = css(0xd06a48);
    g.fill(tank);
    ink(g, tank, 3, INK);
    const roof = poly([[tx - 6, ty], [tx + 66, ty], [tx + 30, ty - 26]]);
    g.fillStyle = css(0x9a4632);
    g.fill(roof);
    ink(g, roof, 3, INK);
    // the roof's own brick parapet along the back line
    const pTop = G.by1 - 46;
    bricks(g, rng, x, pTop, w, 46, 0xb85a48, 0x7a3428, 40, 16);
    g.fillStyle = css(0x6a6878);
    g.fillRect(x, pTop - 8, w, 10);
    ink(g, rect(x, pTop - 8, w, 54), 3, INK);
  },
  sideWalls(P) {
    const { far: g, rng, G } = P;
    bricks(g, rng, 0, G.ceilY, G.bx0, G.h - G.ceilY, 0xa8584a, 0x6a3028, 30, 14);
    bricks(g, rng, G.bx1, G.ceilY, G.w - G.bx1, G.h - G.ceilY, 0xa8584a, 0x6a3028, 30, 14);
    g.fillStyle = css(0x0a0a18, 0.12);
    g.fillRect(0, G.ceilY, G.w, G.h - G.ceilY);
  },
  ceiling(P) {
    const { far: g, G } = P;
    g.fillStyle = css(0x5aa8e4);
    g.fillRect(0, G.ceilY, G.w, G.by0 - G.ceilY);
    // action lines streaming in from the top edge
    g.strokeStyle = css(0xffffff, 0.5);
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i < 40; i++) {
      const sx = (i / 40) * G.w;
      g.moveTo(sx, G.ceilY);
      g.lineTo(G.w / 2 + (sx - G.w / 2) * 0.9, G.by0);
    }
    g.stroke();
  },
  floor(P) {
    const { far: g, rng, G } = P;
    floorPerspective(P, 0x8a8a9c, { cols: 8, rows: 2, line: INK, lineAlpha: 0.6 });
    halftone(g, 0, G.by1, G.w, G.h - G.by1, 6, 0x5a5a6c, 0.6, (_x, y) => 0.6 - ((y - G.by1) / (G.h - G.by1)) * 0.5);
    for (let i = 0; i < 4; i++) stain(g, rng, rng.range(G.bx0, G.bx1), rng.range(G.by1 + 10, G.h - 6), rng.range(20, 40), 0x14141c, 0.4, 0.3);
  },
  props(P) {
    const { far: g, rng, G } = P;
    // AC unit, left
    const ax = G.bx0 + 40, aw = 170, ah = 110;
    const ac = rect(ax, G.by1 - ah, aw, ah);
    g.fillStyle = css(0x7a7e90);
    g.fill(ac);
    g.fillStyle = css(0x5a5e70);
    for (let ly = G.by1 - ah + 14; ly < G.by1 - 10; ly += 10) g.fillRect(ax + 10, ly, aw * 0.45, 4);
    g.fillStyle = css(0x4a4e60);
    g.fillRect(ax + aw * 0.58, G.by1 - ah + 14, aw * 0.34, ah - 28);
    g.strokeStyle = css(0x2a2e3e);
    g.lineWidth = 2;
    for (let lx = ax + aw * 0.58 + 6; lx < ax + aw * 0.92; lx += 8) {
      g.beginPath();
      g.moveTo(lx, G.by1 - ah + 16);
      g.lineTo(lx, G.by1 - 16);
      g.stroke();
    }
    ink(g, ac, 3, INK);
    // chimney stack and pipe vents, centre-left
    const cx = G.bx0 + 260;
    const ch = rect(cx, G.by1 - 180, 54, 180);
    bricks(g, rng, cx, G.by1 - 180, 54, 180, 0x6a3430, 0x2a1416, 18, 10);
    ink(g, ch, 3, INK);
    // stair hut with a door, right
    const hx = G.bx1 - 230, hw = 190, hh = 220;
    const hut = rect(hx, G.by1 - hh, hw, hh);
    g.fillStyle = css(0x4a4a5e);
    g.fill(hut);
    halftone(g, hx, G.by1 - hh, hw, hh, 6, 0x22223a, 0.7, (xx) => (xx - hx) / hw * 0.8);
    ink(g, hut, 3, INK);
    const door = rect(hx + 60, G.by1 - 150, 70, 150);
    g.fillStyle = css(0x2a2238);
    g.fill(door);
    ink(g, door, 3, INK);
    g.fillStyle = css(0xd8c060);
    g.fillRect(hx + 64, G.by1 - 146, 62, 6);
    // a tv aerial on the hut
    g.strokeStyle = css(INK);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(hx + 30, G.by1 - hh);
    g.lineTo(hx + 30, G.by1 - hh - 90);
    for (let k = 0; k < 4; k++) {
      g.moveTo(hx + 10 + k * 3, G.by1 - hh - 80 + k * 14);
      g.lineTo(hx + 50 - k * 3, G.by1 - hh - 80 + k * 14);
    }
    g.stroke();
    contactShadow(g, G.w * 0.5, G.by1, 120);
  },
  cheer(P) {
    const { far: g, rng, G } = P;
    // a rooftop party: bunting from the aerial to the chimney, potted flowers, balloons on the hut
    bunting(g, G.bx0 + 286, G.by1 - 184, G.bx1 - 200, G.by1 - 300, 30, [0xe83c3c, 0xf8d030, 0x2c8ae8, 0xffffff]);
    bunting(g, G.bx0 + 10, G.by1 - 150, G.bx0 + 280, G.by1 - 186, 14, [0xf8d030, 0x2c8ae8, 0xe83c3c]);
    flowerPot(g, rng, 480, G.by1, 26, 0xc8603c);
    flowerPot(g, rng, 530, G.by1, 22, 0x3c7ac8);
    balloon(g, G.bx1 - 60, G.by1 - 300, 18, 0xe83c3c, 70);
    balloon(g, G.bx1 - 30, G.by1 - 285, 16, 0xf8d030, 60);
  },
  lights(P) {
    const { far: g, light, G, amb } = P;
    // warm sunshine slanting across the roof from the upper right
    lightCone(light, G.bx1 - 240, G.by0, 160, 520, G.by1 - G.by0, 0xfff0c0, 0.12, -220);
    // the door's lamp
    blob(light, G.bx1 - 135, G.by1 - 150, 60, 30, 0xffd870, 0.6, 0.2);
    // red aircraft light on the aerial
    amb.push({ kind: 'blink', x: G.bx1 - 200, y: G.by1 - 310, color: 0xff3a3a, size: 3.5, period: 1.6, layer: 'far' });
    led(g, light, G.bx1 - 200, G.by1 - 310, 0xff3a3a, true, 3);
  },
  soilExtras() {},
  near(P) {
    const { near: g, G } = P;
    // a caption box on the panel's top edge, and a sound-effect burst in the corner
    const cap = rect(14, -36, 340, 30);
    g.fillStyle = css(0xe8d88a);
    g.fill(cap);
    ink(g, cap, 3, INK);
    g.save();
    g.font = 'bold italic 16px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.fillStyle = css(INK);
    g.textBaseline = 'middle';
    g.fillText('MEANWHILE, HIGH ABOVE THE CITY...', 26, -21);
    g.restore();
    const bx = G.w + 120, by = -110;
    const burst = new Path2D();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = i % 2 ? 54 : 92;
      const px = bx + Math.cos(a) * r, py = by + Math.sin(a) * r * 0.75;
      i ? burst.lineTo(px, py) : burst.moveTo(px, py);
    }
    burst.closePath();
    g.fillStyle = css(0xd8a43a);
    g.fill(burst);
    ink(g, burst, 4, INK);
    g.save();
    g.font = 'bold italic 34px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = css(0xb8302a);
    g.strokeStyle = css(INK);
    g.lineWidth = 4;
    g.strokeText('KRANK!', bx, by);
    g.fillText('KRANK!', bx, by);
    g.restore();
  },
};

// ---------------------------------------------------------------------------
// Future: Neon Lab
// ---------------------------------------------------------------------------

const NEON = 0x4fe8ff;
const PINK = 0xe05ad8;

const neonlab: EnvDef = {
  theme: {
    soil: { top: 0x1a2030, mid: 0x141a28, deep: 0x0a0e18, rock: 0x2a3244, root: 0x1a2030 },
    grass: 0x1a2030,
    sky: [0x2a2a6a, 0x5a4a9a],
    concrete: 0x343c50,
    side: 0xa49cd4,
    ceiling: 0xaca4dc,
    veil: 0x0c1424,
    veilAlpha: 0.4,
    key: 0x7fe0ff,
    shadow: 0x2a0c3a,
    floor: { top: 0x232c3c, face: 0x10141c },
  },
  exterior(P) {
    const { far: g, rng, G, T } = P;
    const W = fullW(P), H = fullH(P);
    g.fillStyle = vGrad(g, Y0(), Y0() + H, [[0, T.sky[0]], [1, T.sky[1]]]);
    g.fillRect(X0(), Y0(), W, H);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = css(rng.chance(0.2) ? 0xbfe8ff : 0xffffff, rng.range(0.2, 0.7));
      g.fillRect(rng.range(X0(), X0() + W), rng.range(Y0(), Y0() + H), rng.range(0.8, 2), rng.range(0.8, 2));
    }
    // hull plating around the lab
    const t = G.wallT;
    const hx = -t - 20, hy = G.slabTop - 30, hw = G.w + 2 * t + 40, hh = G.h + G.floorSlab - G.slabTop + 60;
    g.fillStyle = vGrad(g, hy, hy + hh, [[0, 0xe4e6f6], [1, 0xc0c4e4]]);
    g.beginPath();
    g.roundRect(hx, hy, hw, hh, 40);
    g.fill();
    g.strokeStyle = css(0xa0a6cc);
    g.lineWidth = 2;
    for (let px = hx + 60; px < hx + hw; px += 120) {
      g.beginPath();
      g.moveTo(px, hy);
      g.lineTo(px, hy + hh);
      g.stroke();
    }
    g.strokeStyle = css(NEON, 0.35);
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(hx + 8, hy + 8, hw - 16, hh - 16, 34);
    g.stroke();
  },
  backWall(P) {
    const { far: g, G } = P;
    const x = G.bx0, y = G.by0, w = G.bx1 - G.bx0;
    g.fillStyle = css(0xb8b2e2);
    g.fillRect(x, y, w, G.by1 - y);
    // glossy panels
    const pw = 120, ph = 96;
    for (let py = y + 4; py < G.by1; py += ph) {
      for (let px = x + 4; px < x + w; px += pw) {
        g.fillStyle = vGrad(g, py, py + ph, [[0, 0xe6e2fa], [0.5, 0xdcd6f6], [1, 0xd0caf0]]);
        g.beginPath();
        g.roundRect(px, py, pw - 8, ph - 8, 10);
        g.fill();
        g.fillStyle = css(0xffffff, 0.3);
        g.beginPath();
        g.roundRect(px + 4, py + 4, pw - 16, 14, 6);
        g.fill();
      }
    }
    // neon guide lines
    g.fillStyle = css(NEON, 0.35);
    g.fillRect(x, y + 58, w, 2);
    g.fillRect(x, G.by1 - 112, w, 2);
    g.fillStyle = css(PINK, 0.4);
    for (let sx = x + 40; sx < x + w; sx += 240) g.fillRect(sx, G.by1 - 118, 60, 2);
    stencil(g, 'DECK 9 // KINETICS', x + 24, y + 40, 16, 0x9fe8ff, 0.2);
  },
  ceiling(P) {
    const { far: g, G } = P;
    g.fillStyle = css(0xb0a8dc);
    g.fillRect(0, G.ceilY, G.w, G.by0 - G.ceilY);
    g.fillStyle = css(NEON, 0.35);
    for (let k = 0; k < 4; k++) g.fillRect(G.w * (0.15 + k * 0.22), G.ceilY + 10, G.w * 0.12, 3);
  },
  floor(P) {
    const { far: g, G } = P;
    floorPerspective(P, 0xb4c0e0, { cols: 18, rows: 3, line: 0x7a86b8, lineAlpha: 0.3 });
    g.fillStyle = vGrad(g, G.by1, G.h, [[0, 0x4fe8ff, 0.06], [1, 0x4fe8ff, 0]]);
    g.fillRect(0, G.by1, G.w, G.h - G.by1);
  },
  props(P) {
    const { far: g, light, rng, G, amb } = P;
    // server racks, left, with LED rows
    for (let k = 0; k < 3; k++) {
      const rx = G.bx0 + 24 + k * 74, rw = 66, rh = 300 - k * 30, ry = G.by1 - rh;
      contactShadow(g, rx + rw / 2, G.by1, rw);
      g.fillStyle = css(0x8890b8);
      g.fillRect(rx - 2, ry - 2, rw + 4, rh + 2);
      g.fillStyle = vGrad(g, ry, G.by1, [[0, 0xf0f2fc], [1, 0xd4d8ee]]);
      g.fillRect(rx, ry, rw, rh);
      for (let sy = ry + 10; sy < G.by1 - 10; sy += 18) {
        g.fillStyle = css(0xbcc2e0);
        g.fillRect(rx + 6, sy, rw - 12, 12);
        g.fillStyle = css(rng.chance(0.5) ? NEON : 0x7cf09a, 0.8);
        g.fillRect(rx + 10, sy + 5, 3, 3);
        if (rng.chance(0.4)) g.fillRect(rx + 16, sy + 5, 3, 3);
      }
      amb.push({ kind: 'blink', x: rx + 11, y: ry + 16, color: NEON, size: 2, period: 1.3 + k * 0.4, layer: 'far' });
    }
    // holo screens, upper left and centre-right
    monitor(g, light, rng, G.bx0 + 60, G.by0 + 90, 150, 86, NEON, 0.8, false);
    amb.push({ kind: 'monitor', x: G.bx0 + 60, y: G.by0 + 90, w: 150, h: 86, color: NEON, period: 5, layer: 'far' });
    monitor(g, light, rng, G.w * 0.6, G.by0 + 84, 110, 66, PINK, 0.6, false);
    amb.push({ kind: 'monitor', x: G.w * 0.6, y: G.by0 + 84, w: 110, h: 66, color: PINK, period: 4, layer: 'far' });
    // specimen tube, right
    const tx = G.bx1 - 170, tw = 90, th = 260, ty = G.by1 - th;
    contactShadow(g, tx + tw / 2, G.by1, tw * 1.2);
    g.fillStyle = css(0x2a3448);
    g.fillRect(tx - 10, G.by1 - 30, tw + 20, 30);
    g.fillRect(tx - 10, ty - 20, tw + 20, 24);
    g.fillStyle = hGrad(g, tx, tx + tw, [[0, 0x1a5a50, 0.8], [0.4, 0x3aa890, 0.7], [1, 0x103a34, 0.8]]);
    g.fillRect(tx, ty + 4, tw, th - 34);
    for (let i = 0; i < 12; i++) {
      g.strokeStyle = css(0xbff8e8, 0.5);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(tx + rng.range(10, tw - 10), ty + rng.range(20, th - 50), rng.range(2, 5), 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = css(0xffffff, 0.12);
    g.fillRect(tx + 12, ty + 8, 8, th - 44);
    blob(light, tx + tw / 2, ty + th / 2, 90, 150, 0x3ae8b0, 0.3);
    // a hexagonal portal frame, centre (outline only, very dim)
    const hx = G.w * 0.5, hy = G.by1 - 170, hr = 120;
    const hex = new Path2D();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      i ? hex.lineTo(hx + Math.cos(a) * hr, hy + Math.sin(a) * hr) : hex.moveTo(hx + Math.cos(a) * hr, hy + Math.sin(a) * hr);
    }
    hex.closePath();
    g.strokeStyle = css(0xc4bee8);
    g.lineWidth = 16;
    g.stroke(hex);
    g.strokeStyle = css(PINK, 0.25);
    g.lineWidth = 2;
    g.stroke(hex);
  },
  cheer(P) {
    const { far: g, rng, G } = P;
    // a big round window on a friendly blue planet and a ringed moon (no sun: it would read as a lit bulb)
    const cx = 560, cy = 168, r = 92;
    const port = new Path2D();
    port.arc(cx, cy, r, 0, Math.PI * 2);
    g.save();
    g.clip(port);
    g.fillStyle = vGrad(g, cy - r, cy + r, [[0, 0x3a3a8e], [1, 0x7a62c4]]);
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = css(0xffffff, rng.range(0.4, 0.9));
      g.fillRect(rng.range(cx - r, cx + r), rng.range(cy - r, cy + r), 1.6, 1.6);
    }
    const pr = r * 0.9, px = cx - r * 0.35, py = cy + r * 0.6;
    const pg = g.createRadialGradient(px - pr * 0.3, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, css(0x9ae0ff));
    pg.addColorStop(1, css(0x2a7ad0));
    g.fillStyle = pg;
    g.beginPath();
    g.arc(px, py, pr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = css(0x6cc87a);
    for (const [ox, oy, rr] of [[-20, -30, 24], [30, -10, 18], [-40, 10, 14]] as const) {
      g.beginPath();
      g.ellipse(px + ox, py + oy, rr * 1.4, rr, 0.3, 0, Math.PI * 2);
      g.fill();
    }
    cloud(g, rng, px + 10, py - 52, 40, 0.5);
    // a little pink ringed moon
    g.fillStyle = css(0xf2a6d8);
    g.beginPath();
    g.arc(cx + r * 0.3, cy + r * 0.05, 14, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = css(0xffe4a0);
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(cx + r * 0.3, cy + r * 0.05, 26, 7, -0.3, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    g.lineWidth = 14;
    g.strokeStyle = css(0xf4f2ff);
    g.stroke(port);
    g.lineWidth = 2;
    g.strokeStyle = css(0x9a94c8);
    g.stroke(port);
    blob(P.light, cx, cy, r * 1.4, r * 1.4, 0xd8e8ff, 0.08, 0.4);
    bunting(g, 60, 64, 1060, 64, 12, PASTEL, 20, 'square');
    flowerPot(g, rng, 104, G.by1 - 300, 22, 0xf2a6d8);
    doodle(g, rng, 730, 300, 64, 78, 'rocket', -0.05, 0xfdfcff);
    doodle(g, rng, 812, 320, 62, 74, 'robot', 0.06, 0xfdfcff);
    bigPlant(g, rng, 860, G.by1, 120, 0x9be3a5);
  },
  lights(P) {
    const { far: g, light, G, amb } = P;
    const len = Math.min(240, G.w * 0.18);
    tubeLamp(g, light, G.w * 0.3 - len / 2, G.by0 + 20, len, NEON, 0.7);
    tubeLamp(g, light, G.w * 0.7 - len / 2, G.by0 + 20, len, PINK, 0.5);
    amb.push({ kind: 'flicker', x: G.w * 0.7, y: G.by0 + 22, w: len, h: 16, color: PINK, period: 6, layer: 'far' });
    amb.push({ kind: 'dust', x: G.w * 0.3 - len, y: G.by0 + 40, w: len * 2, h: Math.min(400, G.h * 0.5), color: 0xbff0ff, layer: 'far' });
  },
  soilExtras() {},
  near(P) {
    const { near: g, rng, G, amb } = P;
    // sleek conduits top-left, a drone top-right, bulkhead corners low
    for (let i = 0; i < 3; i++) cable(g, -230, 10 + i * 10, 180 + i * 20, -200, 160 + i * 20, 7, 0x0c121c, 0.1);
    const d = new Path2D();
    d.ellipse(G.w - 40, -30, 50, 14, 0, 0, Math.PI * 2);
    d.rect(G.w - 100, -40, 20, 6);
    d.rect(G.w + 0, -40, 20, 6);
    silhouette(g, d, 0x0c121c, NEON, 0, 2, 0.4);
    amb.push({ kind: 'blink', x: G.w - 40, y: -22, color: NEON, size: 3, period: 1.1, layer: 'near' });
    const bl = new Path2D();
    bl.moveTo(-230, G.h - 40);
    bl.quadraticCurveTo(-20, G.h - 60, 10, G.h + 260);
    bl.lineTo(-230, G.h + 260);
    bl.closePath();
    silhouette(g, bl, 0x0c121c, NEON, -2, -2, 0.3);
    const br = new Path2D();
    br.moveTo(G.w + 230, G.h - 40);
    br.quadraticCurveTo(G.w + 20, G.h - 60, G.w - 10, G.h + 260);
    br.lineTo(G.w + 230, G.h + 260);
    br.closePath();
    silhouette(g, br, 0x0c121c, PINK, 2, -2, 0.3);
    hangingCable(g, rng, 120, -200, 150, 3, 0x0c121c);
  },
};

/** Theme rooms by id, looked up by paintEnvironment alongside the workshop rooms. */
export const THEMED_ENVS: Record<string, EnvDef> = { cave, foundry, toolbox, rooftop, neonlab };

// Keep imported helpers referenced even when a room stops using one.
void flange;
void mix;
void FESTIVE;
