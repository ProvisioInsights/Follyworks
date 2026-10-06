// Physics Lab screens: the lesson list and the intro card shown at the top of a lesson's briefing.
// Lessons are all open from the start; progress is the usual per-level record in the save.

import type { AppContext } from '../app/context';
import { CONCEPTS } from '../content/science';
import { LAB, labCode, type LabEntry } from '../game/levels/lab';
import { h, icon } from './dom';
import type { Screen } from './screens';
import { conceptCard } from './science';

export const labSolvedCount = (progress: Record<string, { solved: boolean } | undefined>) => LAB.filter((e) => progress[e.level.id]?.solved).length;

/** The lesson's intro: the idea, a picture in words, the challenge, and the full card to open. */
export const labIntro = (entry: LabEntry): HTMLElement => {
  const card = CONCEPTS[entry.concept];
  const row = (label: string, text: string, cls: string) => h('div', { class: `li-row ${cls}` }, h('div', { class: 'li-label' }, label), h('div', { class: 'li-text' }, text));
  return h(
    'div',
    { class: 'lab-intro' },
    h('div', { class: 'li-concept' }, icon('flask', 16), h('span', null, 'Physics Lab · '), h('b', null, card.title)),
    row('The idea', entry.intro.idea, 'idea'),
    row('Picture it', entry.intro.picture, 'picture'),
    row('Your challenge', entry.intro.challenge, 'challenge'),
    card.formula ? h('div', { class: 'cc-formula' }, card.formula) : null,
    h('details', { class: 'science' }, h('summary', null, icon('bulb', 16), h('span', { class: 'sci-label' }, 'How it works'), h('span', { class: 'sci-topic' }, card.title)), h('div', { class: 'sci-body' }, conceptCard(card))),
  );
};

export const labScreen = (app: AppContext): Screen => {
  const p = app.store.data.progress;
  const last = app.store.data.lab.lastPlayed;
  const solved = labSolvedCount(p);
  const tiles = h('div', { class: 'level-tiles' });
  LAB.forEach((e, i) => {
    const pr = p[e.level.id];
    const medal = (cls: string, l: string, on: boolean, tip: string) => h('span', { class: `medal ${cls} ${on ? 'on' : ''}`, tip }, l);
    tiles.append(
      h(
        'button',
        {
          class: `level-tile lab-tile${e.level.id === last ? ' last' : ''}`,
          'aria-label': `${labCode(i)} ${e.level.name}`,
          'data-lab': e.level.id,
          onClick: () => (app.sfx('ui'), app.playLab(i)),
        },
        h('span', { class: 'idx' }, labCode(i)),
        h(
          'span',
          { class: 'grow' },
          h('div', { class: 'name' }, e.level.name),
          h('div', { class: 'blurb' }, h('span', { class: 'lab-concept' }, CONCEPTS[e.concept].title), e.level.id === last && !pr?.solved ? ' · carry on' : ''),
        ),
        h('span', { class: 'medals' }, medal('s', 'S', !!pr?.solved, 'Solved'), medal('e', 'E', !!pr?.elegant, 'Elegant')),
      ),
    );
  });
  const root = h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'screen-head' },
      h('button', { class: 'btn ghost', onClick: () => app.showMenu() }, icon('back'), 'Menu'),
      h('h1', null, 'Physics Lab'),
      h('div', { class: 'spacer' }),
      h('div', { class: 'progress-summary' }, h('span', null, h('b', null, `${solved}/${LAB.length}`), ' lessons done')),
    ),
    h(
      'div',
      { class: 'screen-body scroll' },
      h(
        'div',
        { class: 'chapters' },
        h(
          'div',
          { class: 'panel chapter lab-chapter' },
          h('div', { class: 'chapter-head' }, h('span', { class: 'chapter-num' }, icon('flask', 18)), h('h2', null, 'Lessons')),
          h('div', { class: 'sub' }, 'Short missions, one real idea each: read the card, build, and watch the idea at work. Where the workshop simplifies real physics, the cards say so.'),
          tiles,
        ),
      ),
    ),
  );
  app.ui.append(root);
  return { root, destroy: () => root.remove() };
};
