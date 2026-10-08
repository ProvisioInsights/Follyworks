import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The simulation imports 'follyworks-matter'. In the browser that is the Matter build bundled
// inside Phaser (Phaser.Physics.Matter.Matter); in headless tests it is the very same source
// file loaded directly, so tests exercise identical physics without a renderer.
const matterAlias = process.env.VITEST
  ? r('./node_modules/phaser/src/physics/matter-js/CustomMain.js')
  : r('./src/sim/matter-browser.ts');

// Offline play: after the first visit a service worker keeps every built file, so the game
// starts without a network. The precache list is the build's own output, and the cache name is a
// hash of it, so each deploy replaces the old cache instead of serving stale code.
const offline = (): Plugin => ({
  name: 'follyworks-offline',
  apply: 'build',
  generateBundle(_opts, bundle) {
    const files = ['./', ...Object.keys(bundle).sort().map((f) => `./${f}`)];
    const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
    const source = readFileSync(r('./src/sw.js'), 'utf8')
      .replace('__VERSION__', version)
      .replace('__FILES__', JSON.stringify(files));
    this.emitFile({ type: 'asset', fileName: 'sw.js', source });
  },
});

export default defineConfig({
  plugins: [offline()],
  base: './',
  server: { host: '127.0.0.1', port: 5173 },
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
