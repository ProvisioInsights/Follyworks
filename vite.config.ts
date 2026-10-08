import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { handle, type Env } from './worker/api';
import { sqliteD1 } from './worker/dev/sqliteD1.mjs';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The simulation imports 'follyworks-matter'. In the browser that is the Matter build bundled
// inside Phaser (Phaser.Physics.Matter.Matter); in headless tests it is the very same source
// file loaded directly, so tests exercise identical physics without a renderer.
const matterAlias = process.env.VITEST
  ? r('./node_modules/phaser/src/physics/matter-js/CustomMain.js')
  : r('./src/sim/matter-browser.ts');

// `npm run dev` and `npm run preview` answer /api/* with the real Worker handler (worker/api.ts)
// over an in-memory SQLite stand-in for D1, so cloud saves work locally (and reset on restart).
type Middlewares = { use(fn: (req: IncomingMessage, res: ServerResponse, next: (e?: unknown) => void) => void): void };
const apiMiddleware = (middlewares: Middlewares) => {
  let env: Env | null = null;
  middlewares.use(async (req, res, next) => {
    if (!req.url?.startsWith('/api/')) return next();
    try {
      env ??= { DB: sqliteD1() };
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const out = await handle(new Request(`http://localhost${req.url}`, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined }), env);
      res.statusCode = out.status;
      out.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await out.arrayBuffer()));
    } catch (e) {
      next(e);
    }
  });
};
const localApi = (): Plugin => ({
  name: 'follyworks-local-api',
  configureServer: (server) => apiMiddleware(server.middlewares),
  configurePreviewServer: (server) => apiMiddleware(server.middlewares),
});

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173 },
  plugins: [localApi()],
  resolve: { alias: { 'follyworks-matter': matterAlias } },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
});
