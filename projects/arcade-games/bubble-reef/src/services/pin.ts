const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

// No 0/O, 1/I/L: the parent copies this by hand onto paper.
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const RECOVERY_LENGTH = 8;

export interface HashedSecret {
  hash: string;
  salt: string;
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^([0-9a-f]{2})+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function derive(secret: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    HASH_BITS,
  );
  return toHex(new Uint8Array(bits));
}

export async function hashSecret(secret: string): Promise<HashedSecret> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return { hash: await derive(secret, salt), salt: toHex(salt) };
}

export async function verifySecret(secret: string, hash: string, salt: string): Promise<boolean> {
  const saltBytes = fromHex(salt);
  if (!saltBytes) return false;
  return constantTimeEqual(await derive(secret, saltBytes), hash);
}

export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** True for anything unusable as a PIN, including input that is not exactly four digits. */
export function isTrivialPin(pin: string): boolean {
  if (!/^[0-9]{4}$/.test(pin)) return true;
  const [a, b, c, d] = Array.from(pin, Number) as [number, number, number, number];

  const abab = a === c && b === d;
  const aabb = a === b && c === d;
  const ascending = (a + 1) % 10 === b && (b + 1) % 10 === c && (c + 1) % 10 === d;
  const descending = (a + 9) % 10 === b && (b + 9) % 10 === c && (c + 9) % 10 === d;
  return abab || aabb || ascending || descending;
}

export function generateRecoveryCode(): string {
  const size = RECOVERY_ALPHABET.length;
  // Bytes at or above the last multiple of the alphabet size would skew the modulo.
  const limit = 256 - (256 % size);
  let code = '';
  while (code.length < RECOVERY_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(RECOVERY_LENGTH))) {
      if (byte < limit && code.length < RECOVERY_LENGTH) code += RECOVERY_ALPHABET.charAt(byte % size);
    }
  }
  return code;
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}
