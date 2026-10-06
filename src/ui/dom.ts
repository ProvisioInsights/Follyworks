// Tiny DOM helpers and an inline icon set (stroke icons, currentColor).

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, any>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'tip') el.dataset.tip = v;
      else if (k in el && typeof v !== 'string') (el as any)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: HTMLElement, children: (Child | Child[])[]) {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function clear(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

const P: Record<string, string> = {
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
  step: '<path d="M6 5v14l9-7z" fill="currentColor" stroke="none"/><rect x="16" y="5" width="2.6" height="14" rx="1" fill="currentColor" stroke="none"/>',
  rewind: '<path d="M11 6v12l-8-6zM20 6v12l-8-6z" fill="currentColor" stroke="none"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4.5h-4.5"/>',
  rotateL: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v4.5h4.5"/>',
  flip: '<path d="M12 3v18M8 7 3 12l5 5V7zM16 7l5 5-5 5V7z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  grid: '<path d="M4 9h16M4 15h16M9 4v16M15 4v16"/><rect x="4" y="4" width="16" height="16" rx="2"/>',
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.3 1.1 2.2h5c0-.9.3-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="m17 9 5 5M22 9l-5 5"/>',
  slow: '<circle cx="12" cy="13" r="7.5"/><path d="M12 13V9M10 2.5h4"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5l-8 8a2.1 2.1 0 0 1-3-3l8-8a4 4 0 0 1-2-2z"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7.5 14h9"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
  forces: '<path d="M4 20 20 4M20 4h-6M20 4v6"/><circle cx="6" cy="18" r="1.5" fill="currentColor"/>',
  trail: '<path d="M3 18c4-1 5-9 9-9s4 7 9 6" stroke-dasharray="2 3"/><circle cx="21" cy="15" r="1.6" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  rope: '<path d="M5 4c0 6 14 4 14 10s-8 6-8 6"/><circle cx="5" cy="4" r="1.6"/>',
  play2: '<path d="M8 5v14l11-7z"/>',
};

export function icon(name: keyof typeof P | string, size = 22): SVGSVGElement {
  const wrap = document.createElement('span');
  wrap.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? P.info}</svg>`;
  return wrap.firstChild as SVGSVGElement;
}

/** Icon button with tooltip. */
export function iconBtn(name: string, tip: string, onClick: (e: MouseEvent) => void, extra: Attrs = {}) {
  return h('button', { class: 'icon-btn', 'aria-label': tip.replace(/<[^>]+>/g, ''), tip, onClick, ...extra }, icon(name));
}

// ---------------------------------------------------------------- tooltips (one shared element)

let tipEl: HTMLDivElement | null = null;
let tipTimer = 0;
export function installTooltips() {
  tipEl = h('div', { class: 'tooltip', style: { display: 'none' } });
  document.body.appendChild(tipEl);
  document.addEventListener('pointerover', (e) => {
    const t = (e.target as HTMLElement).closest?.('[data-tip]') as HTMLElement | null;
    clearTimeout(tipTimer);
    if (!t || !tipEl) {
      if (tipEl) tipEl.style.display = 'none';
      return;
    }
    tipTimer = window.setTimeout(() => {
      if (!tipEl || !t.isConnected) return;
      tipEl.innerHTML = t.dataset.tip ?? '';
      tipEl.style.display = 'block';
      const r = t.getBoundingClientRect();
      const tr = tipEl.getBoundingClientRect();
      let x = r.left + r.width / 2 - tr.width / 2;
      let y = r.top - tr.height - 8;
      if (y < 6) y = r.bottom + 8;
      x = Math.max(6, Math.min(window.innerWidth - tr.width - 6, x));
      tipEl.style.left = `${x}px`;
      tipEl.style.top = `${y}px`;
    }, 350);
  });
  document.addEventListener('pointerdown', () => {
    clearTimeout(tipTimer);
    if (tipEl) tipEl.style.display = 'none';
  });
}

// ---------------------------------------------------------------- toasts

let toastBox: HTMLDivElement | null = null;
export function toast(msg: string, kind: 'info' | 'warn' = 'info', ms = 2600) {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts' });
    document.body.appendChild(toastBox);
  }
  // collapse duplicates
  for (const c of Array.from(toastBox.children)) if (c.textContent === msg) c.remove();
  const t = h('div', { class: `toast ${kind}` }, msg);
  toastBox.appendChild(t);
  while (toastBox.children.length > 3) toastBox.firstChild?.remove();
  setTimeout(() => t.remove(), ms);
}

// ---------------------------------------------------------------- modal

export interface ModalOpts {
  title: string;
  body: (Child | Child[])[];
  actions: { label: string; kind?: string; onClick: () => void | boolean; icon?: string }[];
  strip?: string;
  onClose?: () => void;
  closable?: boolean;
  width?: number;
}

export function modal(root: HTMLElement, o: ModalOpts) {
  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey, true);
    o.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && o.closable !== false) {
      e.stopPropagation();
      close();
    }
  };
  const foot = h(
    'div',
    { class: 'modal-foot' },
    o.actions.map((a) =>
      h('button', { class: `btn ${a.kind ?? ''}`, onClick: () => a.onClick() !== false && close() }, a.icon ? icon(a.icon) : null, a.label),
    ),
  );
  const m = h(
    'div',
    { class: 'panel modal', style: o.width ? { width: `min(${o.width}px, calc(100vw - 32px))` } : undefined, role: 'dialog', 'aria-label': o.title },
    o.strip ? h('div', { class: `strip ${o.strip}` }) : null,
    h('div', { class: 'modal-head' }, h('h2', null, o.title), o.closable !== false ? iconBtn('close', 'Close', close) : null),
    h('div', { class: 'modal-body scroll' }, ...o.body),
    foot,
  );
  const back = h('div', { class: 'modal-back', onPointerdown: (e: PointerEvent) => e.target === back && o.closable !== false && close() }, m);
  root.appendChild(back);
  document.addEventListener('keydown', onKey, true);
  (foot.querySelector('.btn.primary, .btn.go') as HTMLElement | null)?.focus();
  return { close, el: m };
}

export const fmtTime = (s: number) => `${s.toFixed(1)}s`;

/** "1 part", "3 parts". */
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
