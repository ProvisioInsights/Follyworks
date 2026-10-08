// Playtest mode on screen (turned on by opening the game with ?playtest; telemetry/playtestSend.ts
// keeps the switch). While it is on: a small "Playtest" tag, a one-tap face rating after each
// mission (inside the results card when solved, as a small card after leaving one unsolved) with an
// optional one-line comment, and "Finish playtest", which sends the log to John. Nothing here ever
// blocks play: every prompt can be ignored or closed.

import type { AppContext } from '../app/context';
import { CAMPAIGN, levelCode } from '../game/campaign';
import { LAB, labCode } from '../game/levels/lab';
import { playtest, type SessionRecord } from '../telemetry/playtest';
import { downloadLog, playtestFileName, playtestMode, sendPlaytest, wantsPlaytest } from '../telemetry/playtestSend';
import { h, icon, modal, toast } from './dom';
import './playtest.css';

const storage = () => (typeof localStorage !== 'undefined' ? localStorage : null);

let app: AppContext | null = null;
let tag: HTMLElement | null = null;
let card: { el: HTMLElement; s: SessionRecord; flush: () => void } | null = null;
let unlisten: (() => void) | null = null;
let finishing = false;
/** Sessions already asked about, so one mission is never asked twice. */
const asked = new WeakSet<SessionRecord>();

export const playtestActive = () => playtestMode.on(storage());

/** Called once at start-up: ?playtest turns the mode on (a fresh log for a new tester). */
export function installPlaytestKit(ctx: AppContext) {
  app = ctx;
  if (wantsPlaytest(location.search)) {
    if (!playtestActive()) {
      playtest.fresh();
      playtestMode.set(storage(), true);
    }
    // Drop the switch from the address bar so a reload never starts another fresh log.
    const url = new URL(location.href);
    url.searchParams.delete('playtest');
    history.replaceState(history.state, '', url.toString());
  }
  if (playtestActive()) start();
}

function start() {
  if (!tag) {
    tag = h('button', { class: 'pt-tag', type: 'button', 'aria-label': 'Playtest mode is on. Finish playtest', onClick: () => finishPlaytest() }, h('span', { class: 'pt-dot' }), 'Playtest');
    document.body.appendChild(tag);
  }
  unlisten ??= playtest.listen((ev, s) => {
    if (finishing || s.kind !== 'campaign' || asked.has(s) || s.rating !== undefined) return;
    if (ev === 'solved') setTimeout(() => askInResults(s), 0);
    else if (s.solvedAt !== null || s.runs.length > 0 || s.length >= 20) showCard(s);
  });
}

function stop() {
  playtestMode.set(storage(), false);
  unlisten?.();
  unlisten = null;
  tag?.remove();
  tag = null;
  closeCard();
}

const missionName = (id: string) => {
  const c = CAMPAIGN.findIndex((e) => e.level.id === id);
  if (c >= 0) return `${levelCode(c)} ${CAMPAIGN[c].level.name}`;
  const l = LAB.findIndex((e) => e.level.id === id);
  return l >= 0 ? `${labCode(l)} ${LAB[l].level.name}` : 'that puzzle';
};

// ------------------------------------------------------------------ rating

const FACES: { label: string; color: string; mouth: string }[] = [
  { label: 'Not fun', color: '#ff6b6b', mouth: '<path d="M8 17.2q4-4 8 0"/>' },
  { label: 'Meh', color: '#ff9f50', mouth: '<path d="M8.5 16.4q3.5-2 7 0"/>' },
  { label: 'Okay', color: '#ffd166', mouth: '<path d="M8.5 15.6h7"/>' },
  { label: 'Fun', color: '#a6e05f', mouth: '<path d="M8.5 14.6q3.5 2.6 7 0"/>' },
  { label: 'Loved it', color: '#4fe39b', mouth: '<path d="M7.8 13.8q4.2 5.6 8.4 0z" fill="currentColor"/>' },
];

const face = (i: number) => {
  const f = FACES[i];
  const s = document.createElement('span');
  s.innerHTML = `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="8.7" cy="9.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.3" cy="9.6" r="1.1" fill="currentColor" stroke="none"/>${f.mouth}</svg>`;
  return s.firstChild as SVGSVGElement;
};

/** Five faces, then (once one is tapped) an optional one-line comment. Saves as it goes. */
function ratingWidget(s: SessionRecord, onDone: () => void) {
  asked.add(s);
  const input = h('input', { type: 'text', class: 'pt-comment', maxLength: 300, placeholder: 'What was fun or annoying? (optional)', 'aria-label': 'What was fun or annoying? (optional)', enterKeyHint: 'done' }) as HTMLInputElement;
  const flush = () => {
    if (input.value.trim()) playtest.rateSession(s, undefined, input.value);
  };
  const done = () => {
    flush();
    input.blur();
    el.classList.add('done');
    thanks.textContent = 'Thanks!';
    onDone();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') done();
  });
  const more = h('div', { class: 'pt-more' }, input, h('button', { class: 'btn small', type: 'button', onClick: done }, 'Done'));
  const faces = FACES.map((f, i) =>
    h(
      'button',
      {
        class: 'pt-face',
        type: 'button',
        style: { color: f.color },
        'aria-label': `${i + 1} of 5: ${f.label}`,
        title: f.label,
        onClick: () => {
          playtest.rateSession(s, i + 1);
          faces.forEach((b, j) => b.classList.toggle('on', j === i));
          el.classList.add('rated');
          app?.sfx('click');
        },
      },
      face(i),
    ),
  );
  const thanks = h('span', { class: 'pt-thanks' });
  const el = h('div', { class: 'pt-rate' }, h('div', { class: 'pt-faces', role: 'group', 'aria-label': 'Rate it' }, faces), more, thanks);
  return { el, flush };
}

/** Solved: the rating sits inside the results card, under the stars. */
function askInResults(s: SessionRecord) {
  const body = document.querySelector('.modal.results .modal-body');
  if (!body) return showCard(s);
  const w = ratingWidget(s, () => {});
  const box = h('div', { class: 'pt-inline' }, h('div', { class: 'pt-q' }, h('span', { class: 'pt-chip' }, 'Playtest'), 'How fun was that?'), w.el);
  const hero = body.querySelector('.result-hero');
  if (hero) hero.after(box);
  else body.prepend(box);
  // Leaving the results with a comment typed but not confirmed still keeps it.
  const obs = new MutationObserver(() => {
    if (!box.isConnected) {
      w.flush();
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

/** Left without solving (or the results card was not there): a small card at the bottom. */
function showCard(s: SessionRecord) {
  closeCard();
  let touched = false;
  const w = ratingWidget(s, () => setTimeout(() => card?.s === s && closeCard(), 900));
  const el = h(
    'div',
    { class: 'pt-card panel', role: 'dialog', 'aria-label': 'Rate the puzzle', onPointerdown: () => (touched = true), onFocusin: () => (touched = true) },
    h('div', { class: 'pt-q' }, h('span', { class: 'pt-chip' }, 'Playtest'), h('span', { class: 'grow' }, 'How was ', h('b', null, missionName(s.level)), '?'), h('button', { class: 'pt-x', type: 'button', 'aria-label': 'Skip', onClick: () => closeCard() }, icon('close', 16))),
    w.el,
  );
  document.body.appendChild(el);
  card = { el, s, flush: w.flush };
  // Ignored for a while: it gets out of the way.
  setTimeout(() => !touched && card?.el === el && closeCard(), 30_000);
}

function closeCard() {
  if (!card) return;
  card.flush();
  card.el.remove();
  card = null;
}

// ------------------------------------------------------------------ finishing

/** Ask for an optional name and send the log to John (or save it as a file if that fails). */
export function finishPlaytest() {
  if (!app || !playtestActive()) return;
  const name = h('input', { type: 'text', class: 'pt-name', maxLength: 40, placeholder: 'First name or nickname', 'aria-label': 'Your first name or nickname (optional)', autocomplete: 'given-name', enterKeyHint: 'send' }) as HTMLInputElement;
  const status = h('p', { class: 'muted pt-status' });
  name.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') void send();
  });
  let busy = false;
  const send = async () => {
    if (busy) return;
    busy = true;
    status.textContent = 'Sending…';
    closeCard();
    finishing = true;
    playtest.end(); // the mission on screen (if any) is the last one recorded
    finishing = false;
    const log = JSON.parse(JSON.stringify(playtest.log));
    const outcome = await sendPlaytest(log, name.value, { fetch: (u, i) => fetch(u, i), download: downloadLog });
    m.close();
    stop();
    if (outcome === 'sent') {
      playtest.fresh();
      toast('Sent to John. Thanks for playing!', 'info', 4000);
    } else {
      const file = playtestFileName(name.value.trim() ? { ...log, name: name.value.trim().slice(0, 60) } : log);
      modal(app!.ui, {
        title: 'Saved as a file',
        body: [
          h('p', null, "Couldn't reach the server, so your results were saved as a file instead:"),
          h('p', null, h('b', null, file)),
          h('p', null, "It's in your Downloads. Please send it to John (email or message is fine). Thanks for playing!"),
        ],
        actions: [{ label: 'OK', kind: 'primary', onClick: () => {} }],
        width: 460,
      });
    }
  };
  const played = playtest.log.sessions.filter((s) => s.kind === 'campaign').length;
  const m = modal(app.ui, {
    title: 'Finish playtest',
    body: [
      h('p', null, `Thanks for playing! This sends John what happened in the ${played === 1 ? 'puzzle' : 'puzzles'} you tried (runs, hints, ratings and comments). Nothing else.`),
      h('label', { class: 'pt-label' }, 'Your first name or nickname (optional)', name),
      status,
    ],
    actions: [
      { label: 'Keep playing', onClick: () => {} },
      { label: 'Send to John', kind: 'primary', onClick: () => (void send(), false) },
    ],
    width: 460,
  });
}

/** Settings row while playtest mode is on (null otherwise). */
export function playtestSettingsRow(close: () => void) {
  if (!playtestActive()) return null;
  return h(
    'div',
    { class: 'pt-settings' },
    h('span', { class: 'grow' }, h('b', null, 'Playtest mode is on'), h('div', { class: 'muted', style: { fontSize: '12px' } }, 'Your play is recorded for John. Finish to send it.')),
    h('button', { class: 'btn small primary', type: 'button', onClick: () => (close(), finishPlaytest()) }, 'Finish playtest…'),
  );
}
