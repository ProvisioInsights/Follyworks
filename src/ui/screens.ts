// Menu, campaign map, custom-level manager and settings.

import type { AppContext } from '../app/context';
import { exportLevel, parseLevel, STANDARD_WORLD } from '../core/level';
import { CAMPAIGN, CHAPTERS, isUnlocked, levelCode, solvedCount } from '../game/campaign';
import { buildKey, DIFFICULTIES, DIFFICULTY_LABELS } from '../game/difficulty';
import { ENVIRONMENTS } from '../render/art/environment';
import { h, icon, modal, toast } from './dom';

export interface Screen {
  root: HTMLElement;
  destroy(): void;
}

// ------------------------------------------------------------------ main menu

export const mainMenu = (app: AppContext): Screen => {
  const p = app.store.data.progress;
  const solved = solvedCount(p);
  const nextIdx = CAMPAIGN.findIndex((c, i) => !p[c.level.id]?.solved && isUnlocked(i, p, app.settings.unlockAll));
  const btn = (label: string, sub: string, ic: string, onClick: () => void, cls = '') =>
    h('button', { class: `btn ${cls}`, onClick: () => (app.sfx('ui'), onClick()) }, icon(ic), label, sub ? h('small', null, sub) : null);
  const root = h(
    'div',
    { class: 'menu' },
    h(
      'div',
      { class: 'menu-col' },
      h('div', { class: 'logo' }, 'FOLLY', h('br'), 'WORKS'),
      h('div', { class: 'tagline' }, 'Build the unnecessary.'),
      h(
        'div',
        { class: 'menu-buttons' },
        solved > 0 && nextIdx >= 0
          ? btn('Continue', `${levelCode(nextIdx)} ${CAMPAIGN[nextIdx].level.name}`, 'play', () => app.playCampaign(nextIdx), 'primary')
          : btn(solved ? 'Campaign' : 'Start', solved ? '' : 'the tutorial', 'play', () => (solved ? app.showCampaign() : app.playCampaign(0)), 'primary'),
        btn('Puzzles', `${solved}/${CAMPAIGN.length} solved`, 'map', () => app.showCampaign()),
        btn('Sandbox', 'every part, no rules', 'box', () => app.openSandbox()),
        btn('Level editor', `${app.store.data.customLevels.length} of yours`, 'wrench', () => app.showLevels()),
        btn('Settings', '', 'gear', () => app.openSettings()),
      ),
    ),
    h('div'),
    h('div', { class: 'menu-foot' }, 'A toy box for gloriously unnecessary engineering.'),
    h('div', { class: 'menu-caption' }, 'Now running: a perfectly reasonable machine'),
  );
  app.ui.append(root);
  return { root, destroy: () => root.remove() };
};

// ------------------------------------------------------------------ campaign map

export const campaignScreen = (app: AppContext): Screen => {
  const p = app.store.data.progress;
  const unlockAll = app.settings.unlockAll;
  const total = CAMPAIGN.length;
  const solved = solvedCount(p);
  const elegant = CAMPAIGN.filter((c) => p[c.level.id]?.elegant).length;
  const absurd = CAMPAIGN.filter((c) => p[c.level.id]?.absurd).length;
  const grid = h('div', { class: 'chapters' });
  for (const ch of CHAPTERS) {
    const entries = CAMPAIGN.map((c, i) => ({ c, i })).filter((x) => x.c.chapter === ch.index);
    if (!entries.length) continue;
    const tiles = h('div', { class: 'level-tiles' });
    for (const { c, i } of entries) {
      const pr = p[c.level.id];
      const open = isUnlocked(i, p, unlockAll);
      const medal = (cls: string, l: string, on: boolean, tip: string) => h('span', { class: `medal ${cls} ${on ? 'on' : ''}`, tip }, l);
      tiles.append(
        h(
          'button',
          {
            class: `level-tile ${open ? '' : 'locked'}`,
            disabled: !open,
            'aria-label': `${levelCode(i)} ${c.level.name}${open ? '' : ' (locked)'}`,
            onClick: () => open && (app.sfx('ui'), app.playCampaign(i)),
          },
          h('span', { class: 'idx' }, levelCode(i)),
          h('span', { class: 'grow' }, h('div', { class: 'name' }, c.level.name), h('div', { class: 'blurb' }, open ? c.level.metadata?.blurb ?? c.level.description.split('. ')[0] : 'Solve more puzzles to unlock')),
          open
            ? h(
                'span',
                { class: 'tile-right' },
                h('span', { class: 'medals' }, medal('s', 'S', !!pr?.solved, 'Solved'), medal('e', 'E', !!pr?.elegant, 'Elegant'), c.level.bonus?.absurdStages === 0 ? null : medal('a', 'A', !!pr?.absurd, 'Absurd')),
                h(
                  'span',
                  { class: 'diff-beaten', 'aria-label': 'Difficulties beaten' },
                  DIFFICULTIES.map((d) => {
                    const on = !!pr?.byDifficulty[d].solved;
                    return h('span', { class: `diff-dot ${d} ${on ? 'on' : ''}`, 'data-diff': d, tip: `${DIFFICULTY_LABELS[d]}: ${on ? 'beaten' : 'not beaten yet'}` }, DIFFICULTY_LABELS[d][0]);
                  }),
                ),
              )
            : icon('lock', 18),
        ),
      );
    }
    grid.append(
      h(
        'div',
        { class: 'panel chapter' },
        h('div', { class: 'chapter-head' }, h('span', { class: 'chapter-num' }, ch.index === 0 ? '0' : String(ch.index)), h('h2', null, ch.title)),
        h('div', { class: 'sub' }, ch.subtitle),
        tiles,
      ),
    );
  }
  const root = h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'screen-head' },
      h('button', { class: 'btn ghost', onClick: () => app.showMenu() }, icon('back'), 'Menu'),
      h('h1', null, 'Puzzles'),
      h('div', { class: 'spacer' }),
      h('div', { class: 'progress-summary' }, h('span', null, h('b', null, `${solved}/${total}`), ' solved'), h('span', null, h('b', null, String(elegant)), ' elegant'), h('span', null, h('b', null, String(absurd)), ' absurd')),
    ),
    h('div', { class: 'screen-body scroll' }, grid),
  );
  app.ui.append(root);
  return { root, destroy: () => root.remove() };
};

// ------------------------------------------------------------------ custom levels

export const levelsScreen = (app: AppContext, refresh: () => void): Screen => {
  const store = app.store;
  const list = h('div', { class: 'levels-list' });
  const levels = store.data.customLevels;
  if (!levels.length) {
    list.append(h('div', { class: 'panel empty-state' }, h('h2', null, 'No levels yet'), h('p', null, 'Make a puzzle for yourself or a friend: build a room, hand out parts, set a goal, test it, export it.')));
  }
  for (const l of levels) {
    const env = ENVIRONMENTS.find((e) => e.id === l.environment);
    const pr = store.data.progress[l.id];
    list.append(
      h(
        'div',
        { class: 'panel custom-row' },
        h('span', { style: { width: '10px', alignSelf: 'stretch', borderRadius: '4px', background: `#${(env?.accent ?? 0x888888).toString(16).padStart(6, '0')}` } }),
        h(
          'div',
          { class: 'grow' },
          h('div', { class: 'name' }, l.name),
          h('div', { class: 'muted', style: { fontSize: '13px' } }, `${env?.name ?? l.environment} · ${l.goals.length} goal${l.goals.length === 1 ? '' : 's'} · ${l.startingObjects.length + l.fixedObjects.length} objects${pr?.solved ? ' · solved' : ''}`),
        ),
        h('button', { class: 'btn small go', onClick: () => app.playCustom(l.id), disabled: !l.goals.length, tip: l.goals.length ? 'Play it' : 'Add a goal first' }, icon('play'), 'Play'),
        h('button', { class: 'btn small primary', onClick: () => app.editLevel(l.id) }, icon('edit'), 'Edit'),
        h(
          'button',
          {
            class: 'btn small',
            onClick: () => {
              const copy = parseLevel(JSON.parse(JSON.stringify(l))).level!;
              copy.id = `custom-${Date.now().toString(36)}`;
              copy.name = `${l.name} (copy)`;
              store.upsertCustomLevel(copy);
              refresh();
            },
          },
          icon('copy'),
          'Duplicate',
        ),
        h('button', { class: 'btn small', onClick: () => renameLevel(app, l.id, refresh) }, 'Rename'),
        h('button', { class: 'btn small', onClick: () => exportDialog(app, l.id) }, icon('download'), 'Export'),
        h(
          'button',
          {
            class: 'btn small ghost',
            'aria-label': 'Delete',
            onClick: () =>
              modal(app.ui, {
                title: 'Delete level?',
                body: [h('p', null, `“${l.name}” will be gone from this browser. Export it first if you want a copy.`)],
                actions: [
                  { label: 'Keep it', onClick: () => {} },
                  {
                    label: 'Delete',
                    kind: 'stop',
                    onClick: () => {
                      store.deleteCustomLevel(l.id);
                      refresh();
                    },
                  },
                ],
              }),
          },
          icon('trash'),
        ),
      ),
    );
  }
  const root = h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'screen-head' },
      h('button', { class: 'btn ghost', onClick: () => app.showMenu() }, icon('back'), 'Menu'),
      h('h1', null, 'Your levels'),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn', onClick: () => importDialog(app, refresh) }, icon('upload'), 'Import'),
      h(
        'button',
        {
          class: 'btn primary',
          onClick: () => {
            const id = `custom-${Date.now().toString(36)}`;
            const lvl = parseLevel({
              schemaVersion: 1,
              id,
              name: 'Untitled contraption',
              description: 'Explain what the player should make happen.',
              environment: 'garage',
              world: { ...STANDARD_WORLD },
              fixedObjects: [],
              startingObjects: [],
              connections: [],
              inventory: [
                { type: 'plank', count: 3 },
                { type: 'ball', count: 2 },
              ],
              goals: [],
              restrictions: { timeLimit: 30 },
              metadata: { author: 'You', created: new Date().toISOString() },
            }).level!;
            store.upsertCustomLevel(lvl);
            app.editLevel(id);
          },
        },
        icon('plus'),
        'New level',
      ),
    ),
    h('div', { class: 'screen-body scroll' }, list),
  );
  app.ui.append(root);
  return { root, destroy: () => root.remove() };
};

const renameLevel = (app: AppContext, id: string, refresh: () => void) => {
  const l = app.store.data.customLevels.find((q) => q.id === id);
  if (!l) return;
  const input = h('input', { type: 'text', value: l.name, style: { width: '100%' } }) as HTMLInputElement;
  modal(app.ui, {
    title: 'Rename level',
    body: [input],
    actions: [
      { label: 'Cancel', onClick: () => {} },
      {
        label: 'Rename',
        kind: 'primary',
        onClick: () => {
          l.name = input.value.trim() || l.name;
          app.store.upsertCustomLevel(l);
          refresh();
        },
      },
    ],
  });
  setTimeout(() => input.select(), 30);
};

export const exportDialog = (app: AppContext, id: string) => {
  const l = app.store.data.customLevels.find((q) => q.id === id);
  if (!l) return;
  const text = exportLevel(l);
  const ta = h('textarea', { rows: 10, style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' }, readOnly: true }) as HTMLTextAreaElement;
  ta.value = text;
  modal(app.ui, {
    title: 'Export level',
    body: [h('p', { class: 'muted', style: { marginTop: 0 } }, 'Share this file or text. Anyone can import it in their level editor.'), ta],
    actions: [
      {
        label: 'Copy text',
        onClick: () => {
          navigator.clipboard?.writeText(text).then(
            () => toast('Copied to clipboard.'),
            () => toast('Copy failed. Select the text and copy it manually.', 'warn'),
          );
          return false;
        },
      },
      {
        label: 'Download file',
        kind: 'primary',
        icon: 'download',
        onClick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: `${l.name.replace(/[^\w-]+/g, '_') || 'level'}.follyworks.json` });
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          return false;
        },
      },
    ],
    width: 640,
  });
};

const importDialog = (app: AppContext, refresh: () => void) => {
  const ta = h('textarea', { rows: 8, placeholder: 'Paste level JSON here…', style: { width: '100%', fontFamily: 'monospace', fontSize: '12px' } }) as HTMLTextAreaElement;
  const file = h('input', { type: 'file', accept: '.json,application/json' }) as HTMLInputElement;
  const msg = h('div', { class: 'muted', style: { fontSize: '13px', minHeight: '18px' } });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (f) ta.value = await f.text();
  });
  modal(app.ui, {
    title: 'Import level',
    body: [h('div', { style: { marginBottom: '8px' } }, file), ta, msg],
    actions: [
      { label: 'Cancel', onClick: () => {} },
      {
        label: 'Import',
        kind: 'primary',
        onClick: () => {
          let raw: unknown;
          try {
            raw = JSON.parse(ta.value);
          } catch {
            msg.textContent = 'That isn’t valid JSON.';
            msg.style.color = 'var(--orange)';
            return false;
          }
          let res;
          try {
            res = parseLevel(raw);
          } catch (err) {
            msg.textContent = `Couldn’t read that level: ${(err as Error).message}`;
            msg.style.color = 'var(--orange)';
            return false;
          }
          const l = res.level;
          if (app.store.data.customLevels.some((q) => q.id === l.id)) l.id = `${l.id}-${Date.now().toString(36)}`;
          app.store.upsertCustomLevel(l);
          toast(res.problems.length ? `Imported with ${res.problems.length} fix${res.problems.length === 1 ? '' : 'es'}.` : `Imported “${l.name}”.`);
          refresh();
        },
      },
    ],
    width: 620,
  });
};

// ------------------------------------------------------------------ settings

export const settingsDialog = (app: AppContext) => {
  const s = app.settings;
  const slider = (label: string, key: 'master' | 'sfx' | 'music') => {
    const inp = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(s[key]), 'aria-label': label }) as HTMLInputElement;
    inp.addEventListener('input', () => app.updateSettings({ [key]: Number(inp.value) }));
    inp.addEventListener('change', () => app.sfx('click'));
    return [h('span', null, label), inp];
  };
  const check = (label: string, key: 'muted' | 'reducedMotion' | 'snap' | 'showForces' | 'ghostTrails' | 'unlockAll' | 'tips' | 'guidance', note?: string) => {
    const cb = h('input', { type: 'checkbox', checked: s[key] }) as HTMLInputElement;
    cb.addEventListener('change', () => app.updateSettings({ [key]: cb.checked }));
    return [h('span', null, label, note ? h('div', { class: 'muted', style: { fontSize: '12px' } }, note) : null), h('label', null, cb)];
  };
  const text = h(
    'select',
    { 'aria-label': 'Text size' },
    [
      [1, 'Normal'],
      [1.15, 'Large'],
      [1.3, 'Largest'],
    ].map(([v, l]) => h('option', { value: String(v), selected: s.textScale === v }, String(l))),
  ) as HTMLSelectElement;
  text.addEventListener('change', () => app.updateSettings({ textScale: Number(text.value) }));
  modal(app.ui, {
    title: 'Settings',
    body: [
      h(
        'div',
        { class: 'settings-grid' },
        ...slider('Master volume', 'master'),
        ...slider('Sound effects', 'sfx'),
        ...slider('Music', 'music'),
        ...check('Mute everything', 'muted'),
        h('span', null, 'Text size'),
        text,
        ...check('Reduce motion', 'reducedMotion', 'No camera shake or ambient animation'),
        ...check('Tutorial guidance', 'guidance', 'Step-by-step pointers in the first missions'),
        ...check('Snap to grid', 'snap'),
        ...check('Ghost trails', 'ghostTrails', 'Show where things went last run'),
        ...check('Show physics shapes', 'showForces', 'Collision outlines and motion arrows'),
        ...check('Unlock all puzzles', 'unlockAll'),
      ),
      h(
        'div',
        { style: { marginTop: '18px', display: 'flex', gap: '8px' } },
        h(
          'button',
          {
            class: 'btn small',
            onClick: () =>
              modal(app.ui, {
                title: 'Reset puzzle progress?',
                body: [h('p', null, 'Clears solved/elegant/absurd records and saved machines for campaign puzzles. Your custom levels and sandbox saves stay.')],
                actions: [
                  { label: 'Cancel', onClick: () => {} },
                  {
                    label: 'Reset progress',
                    kind: 'stop',
                    onClick: () => {
                      for (const c of CAMPAIGN) {
                        delete app.store.data.progress[c.level.id];
                        for (const d of DIFFICULTIES) delete app.store.data.builds[buildKey(c.level.id, d)];
                      }
                      app.store.flush();
                      toast('Progress reset.');
                    },
                  },
                ],
              }),
          },
          'Reset progress…',
        ),
      ),
    ],
    actions: [{ label: 'Done', kind: 'primary', onClick: () => {} }],
    width: 560,
  });
};
