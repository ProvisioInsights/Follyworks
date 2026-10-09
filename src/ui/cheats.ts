// Cheat-code interface: the retro "CHEAT ACTIVATED" toast, the hidden code box (seven taps on the
// title logo, for touch screens without a keyboard), the Settings section and the disco wash.

import type { AppContext } from '../app/context';
import { CHEATS, matchCode } from '../game/cheats';
import { h, modal } from './dom';

/** A short arcade-style banner at the top of the screen. */
export function cheatToast(title: string, sub: string, ms = 2600): void {
  document.querySelector('.cheat-toast')?.remove();
  const el = h('div', { class: 'cheat-toast', role: 'status', 'aria-live': 'polite' }, h('b', null, title), h('small', null, sub));
  document.body.append(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

/** Seven quick taps on `el` (each within 2 s of the last, generous for slow phones) open the code box. */
export function hiddenCodeBox(el: HTMLElement, app: AppContext): void {
  let taps = 0;
  let last = 0;
  el.addEventListener('pointerdown', () => {
    const now = performance.now();
    taps = now - last < 2000 ? taps + 1 : 1;
    last = now;
    el.classList.remove('tapped');
    void el.offsetWidth;
    el.classList.add('tapped');
    if (taps >= 7) {
      taps = 0;
      codeBox(app);
    }
  });
}

export function codeBox(app: AppContext): void {
  const input = h('input', {
    type: 'text',
    class: 'code-input',
    'aria-label': 'Code',
    placeholder: 'ENTER CODE',
    autocomplete: 'off',
    autocapitalize: 'characters',
    spellcheck: false,
    maxLength: 24,
  }) as HTMLInputElement;
  const submit = () => {
    const id = matchCode(input.value);
    if (!id) {
      // a wrong code does nothing, apart from a little shake
      input.classList.remove('nope');
      void input.offsetWidth;
      input.classList.add('nope');
      input.select();
      return false;
    }
    app.enterCheat(id);
    return true;
  };
  const form = h('form', { class: 'code-box', onSubmit: (e: Event) => (e.preventDefault(), submit() && m.close()) }, input);
  const m = modal(app.ui, {
    title: 'Secret codes',
    cls: 'code-modal',
    body: [form],
    actions: [
      { label: 'Cancel', onClick: () => {} },
      { label: 'OK', kind: 'primary', onClick: submit },
    ],
    width: 360,
  });
  input.focus();
}

/** Settings: how many cheats were found, a switch for each found one and one "all off" button. */
export function cheatsSection(app: AppContext): HTMLElement {
  const box = h('div', { class: 'settings-cheats', 'data-section': 'cheats' });
  const render = () => {
    box.replaceChildren();
    const s = app.settings;
    const found = CHEATS.filter((c) => s.cheats.found.includes(c.id));
    box.append(
      h('div', { class: 'sd-head' }, h('span', { class: 'sd-label' }, 'Cheats'), h('span', { class: 'muted' }, `Cheats found: ${found.length} of ${CHEATS.length}`)),
    );
    const list = h('div', { class: 'cheat-list' });
    for (const c of CHEATS) {
      if (!s.cheats.found.includes(c.id)) {
        list.append(h('div', { class: 'cheat-row unfound' }, h('span', { class: 'cheat-code' }, '???'), h('span', { class: 'muted' }, 'Not found yet')));
        continue;
      }
      const cb = h('input', { type: 'checkbox', checked: app.cheatOn(c.id), 'aria-label': c.name }) as HTMLInputElement;
      cb.addEventListener('change', () => {
        app.setCheat(c.id, cb.checked);
        render();
      });
      list.append(
        h(
          'label',
          { class: 'cheat-row' },
          h('span', { class: 'cheat-code' }, c.code || '↑↑↓↓←→←→BA'),
          h('span', null, c.name, h('div', { class: 'muted', style: { fontSize: '12px' } }, c.blurb, c.physics ? ' · no stamps' : '')),
          cb,
        ),
      );
    }
    box.append(list);
    if (found.length)
      box.append(
        h(
          'button',
          {
            class: 'btn small',
            onClick: () => {
              app.allCheatsOff();
              render();
            },
          },
          'Turn all cheats off',
        ),
      );
    else box.append(h('div', { class: 'muted', style: { fontSize: '12px' } }, 'Old games had secret codes. So does this one.'));
  };
  render();
  return box;
}

/** The DISCOFEVER colour wash over the room (pointer-transparent, under the HUD). */
export function discoWash(on: boolean): void {
  let el = document.getElementById('disco-wash');
  if (!on) return el?.remove();
  if (el) return;
  el = h('div', { id: 'disco-wash', 'aria-hidden': 'true' });
  document.getElementById('stage')?.after(el);
}
