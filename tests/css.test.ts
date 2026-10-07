// Stylesheets are concatenated by the bundler, and browsers now parse CSS nesting: one unclosed
// rule silently nests every later rule (and every later file) under it. That once turned the
// whole theme section and science.css into dead `.hint-note …` rules. Guard the brace balance.

import { describe, expect, it } from 'vitest';

const sheets = import.meta.glob<string>('../src/ui/*.css', { query: '?raw', import: 'default', eager: true });

describe('stylesheets', () => {
  it('finds the UI stylesheets', () => expect(Object.keys(sheets).length).toBeGreaterThanOrEqual(2));
  it.each(Object.keys(sheets))('%s has balanced braces and never closes a rule it did not open', (f: string) => {
    const css = sheets[f].replace(/\/\*[\s\S]*?\*\//g, '').replace(/'[^'\n]*'|"[^"\n]*"/g, '""');
    let depth = 0;
    for (const ch of css) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });
});
