-- Cloud saves and playtest logs (worker/index.ts). Apply once per database:
--   npx wrangler d1 migrations apply follyworks --remote

-- One row per save id. The id is a random secret made on the player's device, which is also the
-- code they type on another device. `data` is the save JSON. `rev` goes up by one per write, so a
-- device that has not seen the latest copy is told to merge first (HTTP 412).
CREATE TABLE saves (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

-- Playtest logs players chose to send (src/telemetry/playtest.ts), with an optional note.
CREATE TABLE playtests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  player TEXT,
  note TEXT,
  log TEXT NOT NULL
);
CREATE INDEX playtests_created ON playtests (created_at);
