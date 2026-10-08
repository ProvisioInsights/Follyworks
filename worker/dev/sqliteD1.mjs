// A stand-in for Cloudflare D1 over Node's built-in SQLite (in memory), with the real migrations
// applied. Used by the Worker's unit tests and by the Vite dev server's /api emulation
// (vite.config.ts). Never deployed. D1 is SQLite too, so the SQL is exercised for real.
// Plain JS with a .d.mts beside it, because the app's tsconfig has no Node types.

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../../migrations/', import.meta.url));

export const sqliteD1 = () => {
  // Loaded lazily and through require so bundlers leave it alone: only dev and tests need it.
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) db.exec(readFileSync(MIGRATIONS + f, 'utf8'));
  return {
    all: (sql) => db.prepare(sql).all(),
    prepare: (sql) => ({
      bind: (...values) => ({
        first: async () => db.prepare(sql).get(...values) ?? null,
        run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...values).changes) } }),
      }),
    }),
  };
};
