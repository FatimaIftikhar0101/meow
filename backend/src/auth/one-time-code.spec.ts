import {
  checkCode,
  codeExpiry,
  generateCode,
  hashCode,
  MAX_ATTEMPTS,
  normaliseCode,
} from './one-time-code';

describe('one-time codes', () => {
  describe('generateCode', () => {
    it('is always six digits, including when the number is small', async () => {
      // 42 must be "000042", not "42". A code that varies in length leaks how
      // large the number is, and shrinks the search space for the short ones.
      const codes = Array.from({ length: 300 }, () => generateCode());
      for (const c of codes) expect(c).toMatch(/^\d{6}$/);
    });

    it('does not repeat itself in any obvious way', () => {
      const seen = new Set(Array.from({ length: 500 }, () => generateCode()));
      // Birthday collisions in 500 draws from a million are possible, so this
      // is deliberately loose — it catches a constant or a tiny range, which is
      // the failure worth catching.
      expect(seen.size).toBeGreaterThan(480);
    });

    it('reaches both ends of the range', () => {
      const codes = Array.from({ length: 4000 }, () => Number(generateCode()));
      expect(Math.min(...codes)).toBeLessThan(200_000);
      expect(Math.max(...codes)).toBeGreaterThan(800_000);
    });
  });

  describe('normaliseCode', () => {
    it('accepts what people actually type', () => {
      expect(normaliseCode(' 123 456 ')).toBe('123456');
      expect(normaliseCode('123-456')).toBe('123456');
    });
  });

  describe('checkCode', () => {
    const good = '123456';
    let record: { hash: string; expires: Date; attempts: number };

    beforeEach(async () => {
      record = {
        hash: await hashCode(good),
        expires: codeExpiry(),
        attempts: 0,
      };
    });

    it('accepts the right code', async () => {
      await expect(checkCode(good, record)).resolves.toEqual({ ok: true });
    });

    it('accepts it with the spacing a person adds', async () => {
      await expect(checkCode(' 123 456', record)).resolves.toEqual({
        ok: true,
      });
    });

    it('counts a wrong code against the budget', async () => {
      // Without this the attempt cap does nothing and six digits falls in
      // minutes.
      await expect(checkCode('000000', record)).resolves.toEqual({
        ok: false,
        reason: 'invalid',
        attempts: 1,
      });
    });

    it('refuses once the budget is spent, even for the right code', async () => {
      record.attempts = MAX_ATTEMPTS;
      await expect(checkCode(good, record)).resolves.toMatchObject({
        ok: false,
        reason: 'locked',
      });
    });

    it('refuses an expired code', async () => {
      record.expires = new Date(Date.now() - 1000);
      await expect(checkCode(good, record)).resolves.toMatchObject({
        ok: false,
        reason: 'expired',
      });
    });

    it('refuses when no code was ever issued', async () => {
      await expect(
        checkCode(good, { hash: null, expires: null, attempts: 0 }),
      ).resolves.toMatchObject({ ok: false, reason: 'invalid' });
    });

    it('does not burn an attempt on an expired or locked code', async () => {
      // The count only means something for guesses. Charging for a code that
      // was never in play would let someone lock a victim out by hammering a
      // stale one.
      record.expires = new Date(Date.now() - 1000);
      await expect(checkCode('000000', record)).resolves.toMatchObject({
        attempts: 0,
      });

      record.expires = codeExpiry();
      record.attempts = MAX_ATTEMPTS;
      await expect(checkCode('000000', record)).resolves.toMatchObject({
        attempts: MAX_ATTEMPTS,
      });
    });

    it('stores a hash, not the code', async () => {
      expect(record.hash).not.toContain(good);
      expect(record.hash).toMatch(/^\$2[aby]\$/);
    });
  });
});
