import {
  decryptField,
  encryptField,
  isEncrypted,
  last4,
  maskAccount,
  resetEncryptionKeyCache,
  safeEqual,
} from './field-crypto';

const KEY = Buffer.alloc(32, 7).toString('base64');
const ACCOUNT = 'PK36SCBL0000001123456702';

describe('field encryption', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = KEY;
    resetEncryptionKeyCache();
  });

  it('round-trips a value', () => {
    expect(decryptField(encryptField(ACCOUNT))).toBe(ACCOUNT);
  });

  it('never stores the plaintext', () => {
    const stored = encryptField(ACCOUNT);
    expect(stored).not.toContain(ACCOUNT);
    expect(stored).not.toContain('1123456702');
  });

  it('produces a different ciphertext each time', () => {
    // A deterministic ciphertext would leak that two customers pay the same
    // beneficiary, which is exactly the sort of thing this is protecting.
    expect(encryptField(ACCOUNT)).not.toBe(encryptField(ACCOUNT));
  });

  it('detects tampering rather than decrypting to something else', () => {
    const stored = encryptField(ACCOUNT);
    const parts = stored.split('.');
    const ct = Buffer.from(parts[3], 'base64url');
    ct[0] ^= 0xff;
    parts[3] = ct.toString('base64url');

    expect(() => decryptField(parts.join('.'))).toThrow();
  });

  it('refuses a value encrypted under a different key', () => {
    const stored = encryptField(ACCOUNT);
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    resetEncryptionKeyCache();

    expect(() => decryptField(stored)).toThrow();
  });

  it('passes through values written before encryption existed', () => {
    // The backfill runs after the deploy, so both forms coexist for a while.
    // Reading a legacy row must return the number, not throw.
    expect(isEncrypted(ACCOUNT)).toBe(false);
    expect(decryptField(ACCOUNT)).toBe(ACCOUNT);
  });

  it('is idempotent-safe: an encrypted value is recognised as such', () => {
    // The backfill relies on this to resume after an interruption. Encrypting
    // twice would be unrecoverable — the second decrypt returns ciphertext.
    expect(isEncrypted(encryptField(ACCOUNT))).toBe(true);
  });

  it('rejects a malformed stored value', () => {
    expect(() => decryptField('v1.only.three')).toThrow(/malformed/i);
  });

  describe('key handling', () => {
    it('explains how to generate one when absent', () => {
      delete process.env.ENCRYPTION_KEY;
      resetEncryptionKeyCache();
      expect(() => encryptField(ACCOUNT)).toThrow(/ENCRYPTION_KEY is not set/);
    });

    it('rejects a key of the wrong length', () => {
      process.env.ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64');
      resetEncryptionKeyCache();
      expect(() => encryptField(ACCOUNT)).toThrow(/must decode to 32 bytes/);
    });
  });
});

describe('masking', () => {
  it('shows only the last four', () => {
    expect(maskAccount(ACCOUNT)).toBe('••••6702');
    expect(last4(ACCOUNT)).toBe('6702');
  });

  it('returns nothing for an empty value rather than bare dots', () => {
    expect(maskAccount('')).toBe('');
  });
});

describe('safeEqual', () => {
  it('matches identical values and rejects different ones', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });

  it('handles unequal lengths without throwing', () => {
    // timingSafeEqual itself throws on a length mismatch.
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
