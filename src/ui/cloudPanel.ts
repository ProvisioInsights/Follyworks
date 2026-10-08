// Settings section "Play on another device": this device's cloud code with Copy, linking to a code
// from another device, and offline save codes. Plain words, big enough targets for fingers.

import type { AppContext } from '../app/context';
import type { CloudStatus, LinkResult } from '../persistence/cloud';
import { describeSave, mergeSaves } from '../persistence/merge';
import { decodeSaveCode, encodeSaveCode, SaveCodeError } from '../persistence/saveCode';
import type { SaveData } from '../persistence/save';
import './cloud.css';
import { h, icon, modal, toast } from './dom';

const STATUS_TEXT: Record<CloudStatus, string> = {
  connecting: 'Connecting…',
  saving: 'Saving to cloud…',
  saved: 'Saved to cloud',
  offline: 'Offline, saved on this device',
};

const LINK_TEXT: Record<Exclude<LinkResult, 'linked'>, string> = {
  invalid: 'That code is not complete. It has 16 letters and numbers, like K7QM-2XRP-9DTB-W4QA.',
  same: 'That is already this device’s code.',
  'not-found': 'Nothing is saved under that code yet. Open Follyworks on the other device while online, then try again.',
  offline: 'Could not reach the cloud. Check the internet connection and try again.',
};

/** Copy text; true when it reached the clipboard. */
const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/** Merge another copy of the save into this device's, keeping the best of both. */
const mergeIn = (app: AppContext, other: SaveData) => {
  app.store.restamp();
  app.store.adopt(mergeSaves(app.store.data, other));
};

export const cloudSection = (app: AppContext, closeSettings: () => void) => {
  const cloud = app.cloud;
  const status = h('span', { class: 'cloud-status', 'data-status': cloud.status, role: 'status' }, STATUS_TEXT[cloud.status]);
  const off = cloud.onStatus((s) => {
    if (!status.isConnected) return off();
    status.dataset.status = s;
    status.textContent = STATUS_TEXT[s];
  });

  const code = h('input', { class: 'cloud-code', type: 'text', readonly: true, value: cloud.code, 'aria-label': 'This device’s code', spellcheck: false }) as HTMLInputElement;
  const copyCode = async () => {
    app.sfx('click');
    if (await copyText(cloud.code)) toast('Code copied.');
    else {
      code.focus();
      code.select();
      toast('Code selected. Copy it, or write it down.');
    }
  };

  // "Use a code from another device": a field that opens in place.
  const input = h('input', {
    class: 'cloud-code',
    type: 'text',
    placeholder: 'XXXX-XXXX-XXXX-XXXX',
    'aria-label': 'Code from another device',
    autocomplete: 'off',
    autocapitalize: 'characters',
    spellcheck: false,
    maxlength: 24,
  }) as HTMLInputElement;
  const linkMsg = h('div', { class: 'cloud-msg', role: 'alert' });
  const linkBtn = h('button', { class: 'btn small primary', type: 'button' }, 'Link') as HTMLButtonElement;
  const doLink = async () => {
    if (!input.value.trim()) return input.focus();
    linkBtn.disabled = true;
    linkMsg.textContent = 'Linking…';
    const res = await cloud.link(input.value);
    linkBtn.disabled = false;
    if (res !== 'linked') {
      linkMsg.textContent = LINK_TEXT[res];
      return;
    }
    closeSettings();
    cloud.onChange();
    toast('Linked. Both devices now share one save, with the best of each.', 'info', 4000);
  };
  linkBtn.addEventListener('click', doLink);
  input.addEventListener('keydown', (e) => e.key === 'Enter' && doLink());
  const linkRow = h('div', { class: 'cloud-row cloud-link', hidden: true }, input, linkBtn);
  const openLink = h('button', { class: 'btn small', type: 'button' }, 'Use a code from another device') as HTMLButtonElement;
  openLink.addEventListener('click', () => {
    app.sfx('click');
    openLink.hidden = true;
    linkRow.hidden = false;
    input.focus();
  });

  return h(
    'div',
    { class: 'settings-diff cloud-box', 'data-section': 'cloud' },
    h('div', { class: 'sd-head cloud-head' }, h('span', { class: 'sd-label' }, 'Play on another device'), status),
    h('p', { class: 'cloud-help' }, 'Your progress saves to the cloud by itself. To carry on somewhere else, enter this code there.'),
    h('div', { class: 'cloud-row' }, code, h('button', { class: 'btn small', type: 'button', onClick: copyCode }, icon('copy', 16), 'Copy')),
    h('div', { class: 'cloud-row' }, openLink),
    linkRow,
    linkMsg,
    h(
      'div',
      { class: 'cloud-row cloud-codes' },
      h('span', { class: 'muted' }, 'No internet? Use a save code:'),
      h('button', { class: 'btn small', type: 'button', onClick: () => copySaveCode(app) }, 'Copy save code'),
      h('button', { class: 'btn small', type: 'button', onClick: () => loadSaveCode(app, closeSettings) }, 'Load save code'),
    ),
  );
};

const copySaveCode = async (app: AppContext) => {
  app.sfx('click');
  app.store.flush();
  const text = await encodeSaveCode(app.store.data);
  if (await copyText(text)) return toast('Save code copied. Paste it into Load save code on the other device.', 'info', 4000);
  // No clipboard access: show it to copy by hand.
  const box = h('textarea', { class: 'cloud-savecode', readonly: true, rows: 6, 'aria-label': 'Save code' }, text) as HTMLTextAreaElement;
  modal(app.ui, {
    title: 'Your save code',
    body: [h('p', null, 'Copy all of this and paste it into Load save code on the other device.'), box],
    actions: [{ label: 'Done', kind: 'primary', onClick: () => {} }],
    width: 520,
  });
  box.focus();
  box.select();
};

const loadSaveCode = (app: AppContext, closeSettings: () => void) => {
  app.sfx('click');
  const box = h('textarea', { class: 'cloud-savecode', rows: 5, placeholder: 'Paste a save code (it starts with FW1)', 'aria-label': 'Save code', spellcheck: false }) as HTMLTextAreaElement;
  const msg = h('p', { class: 'cloud-msg cloud-load-msg', role: 'status' });
  let decoded: SaveData | null = null;
  let seq = 0;
  const check = async () => {
    const mine = ++seq;
    decoded = null;
    if (!box.value.trim()) return void (msg.textContent = '');
    try {
      const d = await decodeSaveCode(box.value);
      if (mine !== seq) return;
      decoded = d;
      msg.textContent = `This code has ${describeSave(d)}. Loading adds them to this device’s ${describeSave(app.store.data)}, keeping the best result for every puzzle, so nothing is lost.`;
    } catch (e) {
      if (mine !== seq) return;
      msg.textContent = e instanceof SaveCodeError ? e.message : 'That save code could not be read.';
    }
  };
  box.addEventListener('input', check);
  modal(app.ui, {
    title: 'Load a save code',
    body: [box, msg],
    actions: [
      { label: 'Cancel', onClick: () => {} },
      {
        label: 'Load',
        kind: 'primary',
        onClick: () => {
          if (!decoded) {
            if (!msg.textContent) msg.textContent = 'Paste a save code first.';
            box.focus();
            return false;
          }
          mergeIn(app, decoded);
          closeSettings();
          app.cloud.onChange();
          app.cloud.schedule();
          toast('Save code loaded.');
        },
      },
    ],
    width: 520,
  });
  box.focus();
};
