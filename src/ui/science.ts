// DOM for the "How it works" science cards: the collapsible section in the properties panel, the
// "Physics in your machine" chip row on the results card, and the plain card used by lab intros.

import { CONCEPTS, conceptsForType, type ConceptCard, type ConceptId } from '../content/science';
import { h, icon } from './dom';
import './science.css';

/** The card's text: body, formula, real-world example, the in-game caveat and a try-this line. */
export const conceptCard = (c: ConceptCard, opts: { title?: boolean } = {}) =>
  h(
    'div',
    { class: 'concept-card' },
    opts.title ? h('div', { class: 'cc-title' }, c.title) : null,
    c.body.map((p) => h('p', null, p)),
    c.formula ? h('div', { class: 'cc-formula' }, c.formula) : null,
    c.realWorld ? h('p', { class: 'cc-real' }, h('b', null, 'Real world: '), c.realWorld) : null,
    c.inGame ? h('p', { class: 'cc-game' }, h('b', null, 'In the workshop: '), c.inGame) : null,
    h('p', { class: 'cc-try' }, icon('play', 14), h('span', null, h('b', null, 'Try this: '), c.tryIt)),
  );

// Whether the properties-panel section is open is remembered while the game runs, so it doesn't
// snap shut every time a different part is selected.
let sectionOpen = false;

/** Collapsible "How it works" section for one part type, or null when the type has no card. */
export const scienceSection = (type: string): HTMLElement | null => {
  const cards = conceptsForType(type);
  if (!cards.length) return null;
  let current = cards[0];
  const summary = h('summary', null, icon('bulb', 16), h('span', { class: 'sci-label' }, 'How it works'), h('span', { class: 'sci-topic' }, current.title));
  const holder = h('div', { class: 'sci-body' });
  const render = () => {
    holder.replaceChildren(conceptCard(current));
    (summary.lastChild as HTMLElement).textContent = current.title;
    if (cards.length > 1)
      holder.append(
        h(
          'div',
          { class: 'sci-also' },
          'Also: ',
          cards
            .filter((c) => c !== current)
            .map((c) =>
              h(
                'button',
                {
                  class: 'chip',
                  type: 'button',
                  onClick: () => {
                    current = c;
                    render();
                  },
                },
                c.title,
              ),
            ),
        ),
      );
  };
  render();
  const d = h('details', { class: 'science', open: sectionOpen }, summary, holder);
  d.addEventListener('toggle', () => (sectionOpen = d.open));
  return d;
};

/**
 * Results card: one chip per concept the run used. Clicking a chip opens its card underneath
 * (one at a time) so the results card stays compact.
 */
export const physicsInMachine = (ids: ConceptId[]): HTMLElement | null => {
  const cards = ids.map((id) => CONCEPTS[id]).filter(Boolean);
  if (!cards.length) return null;
  const holder = h('div', { class: 'pim-card' });
  let openId: ConceptId | null = null;
  const chips = cards.map((c) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-expanded': 'false', 'data-concept': c.id }, c.title);
    b.addEventListener('click', () => {
      openId = openId === c.id ? null : c.id;
      for (const x of chips) x.setAttribute('aria-expanded', String(x.dataset.concept === openId));
      holder.replaceChildren(...(openId ? [conceptCard(CONCEPTS[openId])] : []));
    });
    return b;
  });
  return h('div', { class: 'physics-in-machine' }, h('div', { class: 'pim-head' }, icon('bulb', 16), 'Physics in your machine'), h('div', { class: 'concept-chips' }, chips), holder);
};
