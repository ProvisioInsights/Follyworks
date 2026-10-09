// Turns `wrangler d1 execute --json` output for the playtests table (id, created_at, note, log)
// into one playtest log file per row. Pure, so tests/playtestSend.test.ts can check it.

/** The SQL `npm run playtests:pull` runs. Columns must match the Worker's `playtests` table. */
export const PULL_SQL = 'SELECT id, created_at, note, log FROM playtests ORDER BY id';

const slug = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);

/** Parse wrangler's JSON (tolerating log lines printed before it) into its result rows. */
export const rowsFromD1 = (output) => {
  const text = String(output);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.search(/^\s*[[{]/m);
    if (start < 0) throw new Error('wrangler printed no JSON');
    parsed = JSON.parse(text.slice(start));
  }
  const sets = Array.isArray(parsed) ? parsed : [parsed];
  return sets.flatMap((s) => (Array.isArray(s?.results) ? s.results : []));
};

/**
 * One { file, log } per stored playtest whose log parses as a version-1 playtest log. The
 * player's note (their name) is copied into the log when the log has none.
 */
export const filesFromD1 = (output) => {
  const files = [];
  const skipped = [];
  for (const row of rowsFromD1(output)) {
    let log;
    try {
      log = typeof row.log === 'string' ? JSON.parse(row.log) : row.log;
    } catch {
      log = null;
    }
    if (log?.v !== 1 || !Array.isArray(log.sessions)) {
      skipped.push(row.id);
      continue;
    }
    if (row.note && !log.name) log.name = String(row.note);
    const who = slug(log.name ?? row.note);
    files.push({ file: `d1-${String(row.id).padStart(4, '0')}${who ? `-${who}` : ''}.json`, log, created: row.created_at ?? null });
  }
  return { files, skipped };
};
