// Difficulty UI: the one-time "How tricky do you like it?" chooser, the Settings picker and the
// small read-only badge shown in the briefing, HUD and results. The difficulty itself is one global
// setting (settings.difficulty); see game/difficulty.ts for what Easy and Hard change.

import type { AppContext } from '../app/context';
import { DIFFICULTIES, DIFFICULTY_BLURBS, DIFFICULTY_LABELS, type Difficulty } from '../game/difficulty';
import { h, icon } from './dom';
import type { Screen } from './screens';

/** Three rising bars, lit up to the difficulty (the same ladder as the campaign map badges). */
const ladder = (d: Difficulty) =>
  h(
    'span',
    { class: 'diff-ladder', 'aria-hidden': 'true' },
    DIFFICULTIES.map((x, i) => h('span', { class: `bar b${i} ${i <= DIFFICULTIES.indexOf(d) ? 'lit' : ''}` })),
  );

/**
 * Full-screen first-time chooser. Shown once, the first time a campaign mission is started with
 * no difficulty chosen yet; `onPick` saves the choice and carries on into the mission.
 */
export const difficultyChooser = (app: AppContext, o: { onPick: (d: Difficulty) => void; onBack: () => void }): Screen => {
  const cards = DIFFICULTIES.map((d) =>
    h(
      'button',
      {
        class: `diff-card ${d}${d === 'normal' ? ' recommended' : ''}`,
        'data-diff': d,
        type: 'button',
        onClick: () => (app.sfx('ui'), o.onPick(d)),
      },
      d === 'normal' ? h('span', { class: 'dc-tag' }, 'Recommended') : null,
      ladder(d),
      h('b', null, DIFFICULTY_LABELS[d]),
      h('span', { class: 'dc-blurb' }, DIFFICULTY_BLURBS[d]),
    ),
  );
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      o.onBack();
    }
  };
  const root = h(
    'div',
    { class: 'screen diff-choose', role: 'dialog', 'aria-label': 'Choose a difficulty' },
    h('div', { class: 'screen-head' }, h('button', { class: 'btn ghost', onClick: () => o.onBack() }, icon('back'), 'Back')),
    h(
      'div',
      { class: 'dc-body scroll' },
      h(
        'div',
        { class: 'panel dc-panel' },
        h('h1', null, 'How tricky do you like it?'),
        h('p', { class: 'dc-sub' }, 'Pick one for every puzzle. You can change it any time in Settings.'),
        h('div', { class: 'dc-cards' }, cards),
      ),
    ),
  );
  app.ui.append(root);
  window.addEventListener('keydown', onKey);
  (cards[1] as HTMLElement).focus();
  return {
    root,
    destroy: () => {
      window.removeEventListener('keydown', onKey);
      root.remove();
    },
  };
};

/** Settings: three cards that set the global difficulty. */
export const difficultyPicker = (current: Difficulty, onPick: (d: Difficulty) => void) => {
  const group = h('div', { class: 'diff-pick', role: 'radiogroup', 'aria-label': 'Difficulty' });
  const render = (cur: Difficulty) =>
    group.replaceChildren(
      ...DIFFICULTIES.map((d) =>
        h(
          'button',
          {
            class: `diff-btn ${d} ${d === cur ? 'on' : ''}`,
            type: 'button',
            role: 'radio',
            'data-diff': d,
            'aria-checked': d === cur ? 'true' : 'false',
            onClick: () => {
              render(d);
              onPick(d);
            },
          },
          h('b', null, DIFFICULTY_LABELS[d]),
          h('small', null, DIFFICULTY_BLURBS[d]),
        ),
      ),
    );
  render(current);
  return group;
};

/**
 * The current difficulty as a small badge. With `app` it is a button that opens Settings at the
 * Difficulty control (nothing else); without, a plain label.
 */
export const difficultyBadge = (d: Difficulty, app?: AppContext) =>
  app
    ? h(
        'button',
        {
          class: `diff-badge ${d}`,
          type: 'button',
          'data-diff': d,
          tip: `${DIFFICULTY_BLURBS[d]}<br><i>Change it in Settings.</i>`,
          'aria-label': `Difficulty: ${DIFFICULTY_LABELS[d]}. Change in Settings`,
          onClick: (e: MouseEvent) => {
            e.stopPropagation();
            app.sfx('ui');
            app.openSettings('difficulty');
          },
        },
        DIFFICULTY_LABELS[d],
      )
    : h('span', { class: `diff-badge ${d}`, 'data-diff': d }, DIFFICULTY_LABELS[d]);
