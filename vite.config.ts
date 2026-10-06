import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The simulation imports 'follyworks-matter'. In the browser that is the Matter build bundled
// inside Phaser (Phaser.Physics.Matter.Matter); in headless tests it is the very same source
// file loaded directly, so tests exercise identical physics without a renderer.
const matterAlias = process.env.VITEST
  ? r('./node_modules/phaser/src/physics/matter-js/CustomMain.js')
  : r('./src/sim/matter-browser.ts');

export default defineConfig({
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
