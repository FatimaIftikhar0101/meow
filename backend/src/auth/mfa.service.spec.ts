import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { generateSync } from 'otplib';
import {
  decryptField,
  isEncrypted,
  resetEncryptionKeyCache,
} from '../common/crypto/field-crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MfaService } from './mfa.service';

const KEY = Buffer.alloc(32, 7).toString('base64');

const mockPrisma = () => ({
  user: { findUnique: jest.fn(), update: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
});

describe('MfaService', () => {
  let service: MfaService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = KEY;
    resetEncryptionKeyCache();

    prisma = mockPrisma();
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [MfaService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(MfaService);
  });

  describe('beginEnrolment', () => {
    it('stores the secret encrypted and does not enable anything yet', async () => {
      prisma.user.findUnique.mockResolvedValue({ mfaEnabledAt: null });

      const { secret, uri } = await service.beginEnrolment('u-1', 'a@meow.test');

      const written = prisma.user.update.mock.calls[0][0].data;
      // The secret mints valid codes forever — closer to a password than to a
      // password hash, so it must not sit in the column in the clear.
      expect(isEncrypted(written.mfaSecret)).toBe(true);
      expect(written.mfaSecret).not.toContain(secret);
      expect(decryptField(written.mfaSecret)).toBe(secret);

      // Not enrolled until a code has been proved to work.
      expect(written.mfaEnabledAt).toBeUndefined();
      expect(uri).toContain('otpauth://totp/Meow:');
    });

    it('refuses to re-issue a secret once enrolment is complete', async () => {
      prisma.user.findUnique.mockResolvedValue({ mfaEnabledAt: new Date() });
      // Otherwise a stolen live session could quietly swap the second factor.
      await expect(
        service.beginEnrolment('u-1', 'a@meow.test'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('confirmEnrolment', () => {
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        mfaSecret: '',
        mfaEnabledAt: null,
      });
    });

    it('rejects a code that does not match', async () => {
      prisma.user.findUnique.mockResolvedValue({
        mfaSecret: require('../common/crypto/field-crypto').encryptField(secret),
        mfaEnabledAt: null,
      });
      await expect(
        service.confirmEnrolment('u-1', 'a@meow.test', '000000'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('enables MFA and returns recovery codes exactly once', async () => {
      const { encryptField } = require('../common/crypto/field-crypto');
      prisma.user.findUnique.mockResolvedValue({
        mfaSecret: encryptField(secret),
        mfaEnabledAt: null,
      });

      const { recoveryCodes } = await service.confirmEnrolment(
        'u-1',
        'a@meow.test',
        generateSync({ secret }),
      );

      expect(recoveryCodes).toHaveLength(10);
      const written = prisma.user.update.mock.calls[0][0].data;
      expect(written.mfaEnabledAt).toBeInstanceOf(Date);
      // Hashes, not the codes. A recovery code that can be read back later is
      // just a weaker password.
      for (const code of recoveryCodes) {
        expect(written.mfaRecoveryCodes).not.toContain(code);
      }
      expect(written.mfaRecoveryCodes[0]).toMatch(/^\$2[aby]\$/);
      // The step is recorded so the enrolling code cannot immediately be
      // replayed as a login.
      expect(typeof written.mfaLastTimeStep).toBe('number');
    });

    it('refuses before enrolment has been started', async () => {
      prisma.user.findUnique.mockResolvedValue({
        mfaSecret: null,
        mfaEnabledAt: null,
      });
      await expect(
        service.confirmEnrolment('u-1', 'a@meow.test', '123456'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verify', () => {
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    let encryptField: (v: string) => string;

    beforeEach(() => {
      encryptField = require('../common/crypto/field-crypto').encryptField;
    });

    const enrolled = (over: Record<string, unknown> = {}) => ({
      mfaSecret: encryptField(secret),
      mfaEnabledAt: new Date(),
      mfaRecoveryCodes: [],
      mfaLastTimeStep: null,
      ...over,
    });

    it('accepts the current code and records the step it spent', async () => {
      prisma.user.findUnique.mockResolvedValue(enrolled());

      await expect(
        service.verify('u-1', generateSync({ secret })),
      ).resolves.toBe(true);

      expect(prisma.user.update.mock.calls[0][0].data.mfaLastTimeStep).toEqual(
        expect.any(Number),
      );
    });

    it('rejects a code from a step already spent', async () => {
      const token = generateSync({ secret });
      // Learn the step the way the service does, then replay against it.
      prisma.user.findUnique.mockResolvedValue(enrolled());
      await service.verify('u-1', token);
      const spentStep = prisma.user.update.mock.calls[0][0].data.mfaLastTimeStep;

      prisma.user.update.mockClear();
      prisma.user.findUnique.mockResolvedValue(
        enrolled({ mfaLastTimeStep: spentStep }),
      );

      // Same code, still inside its 30-second window — and refused, which is
      // the difference between shoulder-surfing being useful and not.
      await expect(service.verify('u-1', token)).resolves.toBe(false);
    });

    it('returns false when the account is not enrolled', async () => {
      prisma.user.findUnique.mockResolvedValue(
        enrolled({ mfaEnabledAt: null }),
      );
      await expect(service.verify('u-1', '123456')).resolves.toBe(false);
    });

    it('accepts a recovery code and consumes it', async () => {
      const bcrypt = require('bcrypt');
      const code = 'a1b2c3d4e5';
      const hash = await bcrypt.hash(code, 10);
      const other = await bcrypt.hash('ffffffffff', 10);
      prisma.user.findUnique.mockResolvedValue(
        enrolled({ mfaRecoveryCodes: [other, hash] }),
      );

      await expect(service.verify('u-1', code)).resolves.toBe(true);

      // Only the one used is spent; the rest survive.
      const written = prisma.user.update.mock.calls[0][0].data;
      expect(written.mfaRecoveryCodes).toEqual([other]);
    });

    it('rejects a recovery code that has already been spent', async () => {
      const bcrypt = require('bcrypt');
      const code = 'a1b2c3d4e5';
      prisma.user.findUnique.mockResolvedValue(
        enrolled({ mfaRecoveryCodes: [await bcrypt.hash('ffffffffff', 10)] }),
      );
      await expect(service.verify('u-1', code)).resolves.toBe(false);
    });
  });
});
