import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

/**
 * Application-level encryption for individual columns.
 *
 * Bank account numbers were stored as plaintext. Anyone with a copy of the
 * database — a backup, a support export, a compromised read replica, a hosting
 * provider's staff — had every customer's beneficiary account numbers in the
 * clear. Postgres disk encryption does not help with any of those, because in
 * all of them the database itself is doing the reading.
 *
 * AES-256-GCM, so tampering with a stored value is detected rather than
 * silently decrypting to something else. Each value carries its own random IV.
 *
 * Stored format:  v1.<iv>.<authTag>.<ciphertext>   (each part base64url)
 *
 * The version prefix matters twice. It lets `decryptField` recognise values
 * written before this existed and pass them through unchanged, so the code can
 * deploy before the backfill runs rather than needing both at the same instant.
 * And it leaves room to rotate to a new scheme without guessing at what an old
 * value is.
 */

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM's standard nonce length
const KEY_BYTES = 32; // AES-256

let cachedKey: Buffer | null = null;

/**
 * The key, from ENCRYPTION_KEY — 32 bytes, base64.
 *
 * Read lazily and cached rather than at import time, so a missing key fails
 * when someone tries to encrypt something (with a message saying what to do)
 * instead of at module load, where it would take the whole process down before
 * any logging is set up.
 */
export function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY is not set. Generate one with: ' +
        `node -e "console.log(require('crypto').randomBytes(${KEY_BYTES}).toString('base64'))"`,
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}.`,
    );
  }
  cachedKey = key;
  return key;
}

/** Only for tests, which set a key per-case. */
export function resetEncryptionKeyCache(): void {
  cachedKey = null;
}

const b64 = (b: Buffer) => b.toString('base64url');

export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${VERSION}.${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(ct)}`;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(`${VERSION}.`);
}

/**
 * Decrypt a stored value.
 *
 * Anything without the version prefix is a row written before encryption
 * existed and is returned unchanged. That tolerance is deliberate and
 * temporary: it exists so the backfill can run after the deploy rather than
 * during it. Once no plaintext rows remain, this branch can be removed and
 * unprefixed values treated as corruption.
 */
export function decryptField(stored: string): string {
  if (!isEncrypted(stored)) return stored;

  const parts = stored.split('.');
  if (parts.length !== 4) {
    throw new Error('Encrypted field is malformed');
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(ivB64, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * The last four characters, for display to anyone who should not see the whole
 * number — staff, list views, the audit log.
 *
 * Takes the plaintext. Masking ciphertext would show four characters of
 * base64, which looks like a real answer and is not one.
 */
export function maskAccount(plaintext: string): string {
  const tail = plaintext.slice(-4);
  return tail.length ? `••••${tail}` : '';
}

/** Last four with no decoration, for structured fields like audit entries. */
export function last4(plaintext: string): string {
  return plaintext.slice(-4);
}

/**
 * Constant-time comparison, for anywhere a decrypted value is checked against
 * user input. Not used yet; here so that when it is needed nobody reaches for
 * `===` on a secret.
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
