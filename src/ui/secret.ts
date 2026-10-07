// The Konami-code reward: a short attract-mode splash announcing the secret arcade theme.

import { h } from './dom';

export function secretBanner(ui: HTMLElement, ms = 3600): void {
  ui.querySelector('.secret-splash')?.remove();
  const close = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  };
  const el = h(
    'div',
    { class: 'secret-splash', role: 'status', 'aria-live': 'polite', onClick: close },
    h(
      'div',
      { class: 'ss-box' },
      h('div', { class: 'ss-kicker' }, 'Secret found'),
      h('div', { class: 'ss-title' }, 'Insert Coin'),
      h('div', { class: 'ss-sub' }, 'Arcade theme unlocked'),
      h('div', { class: 'ss-arrows', 'aria-hidden': 'true' }, ...['↑', '↑', '↓', '↓', '←', '→', '←', '→'].map((a) => h('i', null, a)), 'B', 'A'),
      h('div', { class: 'ss-blink' }, 'Press start'),
      h('div', { class: 'ss-foot' }, 'Enter the code again to switch it off. It also lives in Settings, under Theme.'),
    ),
  );
  ui.append(el);
  setTimeout(() => el.isConnected && close(), ms);
}
