// Cloud save ids. Each device makes a random 80-bit id (16 Crockford base32 characters) the first
// time it runs. It names the device's save on the server and doubles as the code a player types on
// another device, shown as K7QM-2XRP-9DTB-W4QA. Shared by the game and the Worker (worker/index.ts).

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CLOUD_ID_LENGTH = 16;
const VALID = new RegExp(`^[${ALPHABET}]{${CLOUD_ID_LENGTH}}$`);

export const isCloudId = (s: string) => VALID.test(s);

/** A fresh random id from the platform's secure random source. */
export const newCloudId = (rand: (n: number) => ArrayLike<number> = (n) => crypto.getRandomValues(new Uint8Array(n))) => {
  const bytes = rand(CLOUD_ID_LENGTH);
  let id = '';
  // 256 is a multiple of 32, so the low 5 bits of each byte are uniform.
  for (let i = 0; i < CLOUD_ID_LENGTH; i++) id += ALPHABET[bytes[i] & 31];
  return id;
};

/**
 * Read a code the way a person types it: any case, dashes and spaces ignored, and the letters
 * Crockford reads as digits (O as 0, I and L as 1). Returns null unless it is a whole valid id.
 */
export const parseCloudCode = (input: string): string | null => {
  const s = input
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  return isCloudId(s) ? s : null;
};

/** K7QM2XRP9DTBW4QA -> K7QM-2XRP-9DTB-W4QA */
export const formatCloudId = (id: string) => id.match(/.{1,4}/g)?.join('-') ?? id;
