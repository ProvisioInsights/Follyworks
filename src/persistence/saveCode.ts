// Save codes: the whole save as one line of text a player can copy to another device by hand
// (chat, email, notes), with no server involved. "FW1." + base64url(deflate-raw(JSON)). Browsers
// without CompressionStream write "FW1j." + base64url(JSON) instead; both forms decode anywhere
// a matching stream exists, and the uncompressed form decodes everywhere.

import { parseSave, type SaveData } from './save';

const PREFIX_Z = 'FW1.';
const PREFIX_J = 'FW1j.';

const toB64url = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64url = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const pipe = async (bytes: Uint8Array, stream: GenericTransformStream) => {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
};

const hasStreams = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** Encode a save as a save code. `compress: false` forces the uncompressed form (tests, old browsers). */
export const encodeSaveCode = async (data: SaveData, compress = hasStreams()): Promise<string> => {
  const json = new TextEncoder().encode(JSON.stringify(data));
  if (compress) {
    try {
      return PREFIX_Z + toB64url(await pipe(json, new CompressionStream('deflate-raw')));
    } catch {
      /* fall through to the uncompressed form */
    }
  }
  return PREFIX_J + toB64url(json);
};

export class SaveCodeError extends Error {}

/**
 * Decode a save code into a validated save. Whitespace (line breaks from chat apps) is ignored.
 * Throws SaveCodeError with a message fit to show the player.
 */
export const decodeSaveCode = async (code: string): Promise<SaveData> => {
  const c = code.replace(/\s+/g, '');
  let bytes: Uint8Array;
  try {
    if (c.startsWith(PREFIX_Z)) {
      if (!hasStreams()) throw new SaveCodeError('This browser cannot open compressed save codes. Try a newer browser.');
      bytes = await pipe(fromB64url(c.slice(PREFIX_Z.length)), new DecompressionStream('deflate-raw'));
    } else if (c.startsWith(PREFIX_J)) {
      bytes = fromB64url(c.slice(PREFIX_J.length));
    } else {
      throw new SaveCodeError('That is not a Follyworks save code. Save codes start with FW1.');
    }
  } catch (e) {
    if (e instanceof SaveCodeError) throw e;
    throw new SaveCodeError('That save code is damaged or cut short. Copy the whole code and try again.');
  }
  const text = new TextDecoder().decode(bytes);
  let ok = false;
  try {
    const raw = JSON.parse(text);
    ok = !!raw && typeof raw === 'object' && !Array.isArray(raw) && 'progress' in raw;
  } catch {
    ok = false;
  }
  if (!ok) throw new SaveCodeError('That save code is damaged or cut short. Copy the whole code and try again.');
  return parseSave(text).data;
};
