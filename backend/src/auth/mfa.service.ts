import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { decryptField, encryptField } from '../common/crypto/field-crypto';
import { writeAudit } from '../common/audit/audit';
import { PrismaService } from '../prisma/prisma.service';

const ISSUER = 'Meow';
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BYTES = 5;
/** Seconds, not steps. One step either side absorbs the clock drift of a phone
 *  that has not synced recently, without widening the window meaningfully. */
const DRIFT_TOLERANCE_SECONDS = 30;
const BCRYPT_ROUNDS = 10;

/** Codes are typed by people, who put spaces and dashes in them. */
function normalise(code: string): string {
  return code.trim().replace(/[\s-]/g, '');
}

/** Six digits, and nothing else, is what a TOTP token looks like. */
const TOTP_SHAPE = /^\d{6}$/;

/**
 * Verify a time-based code without letting a malformed one escape as a crash.
 *
 * `verifySync` throws TokenLengthError for anything that is not six digits
 * rather than reporting it invalid, so a recovery code — which is longer —
 * would take the whole request down on its way to being checked. Codes come
 * straight from a person typing, so "wrong shape" is an ordinary outcome and
 * has to read as invalid, not exceptional.
 */
function checkTotp(
  secret: string,
  token: string,
  afterTimeStep?: number,
): { valid: boolean; timeStep: number | null } {
  if (!TOTP_SHAPE.test(token)) return { valid: false, timeStep: null };
  try {
    const result = verifySync({
      secret,
      token,
      epochTolerance: DRIFT_TOLERANCE_SECONDS,
      afterTimeStep,
    });
    return { valid: result.valid, timeStep: timeStepOf(result) };
  } catch {
    return { valid: false, timeStep: null };
  }
}

/**
 * Pull the time step out of a verification result.
 *
 * The library types the result as a HOTP/TOTP union and only the TOTP arm has
 * a step. We always ask for TOTP, so this narrows rather than casts — a cast
 * would keep compiling if the strategy ever changed underneath it.
 */
function timeStepOf(result: object): number | null {
  return 'timeStep' in result && typeof result.timeStep === 'number'
    ? result.timeStep
    : null;
}

/**
 * Two-factor authentication for back-office accounts.
 *
 * Enrolment is two steps on purpose. The first hands out a secret and records
 * it; the second is only reached once the person has produced a working code
 * from it. Between the two the account counts as un-enrolled, so somebody who
 * scans a QR code and then loses their phone is not locked out of an account
 * they never finished securing.
 *
 * The secret is encrypted at rest. It is not a hash of anything — it is the
 * key itself, and anyone holding it can mint valid codes indefinitely, which
 * makes it closer to a password than to a password hash.
 */
@Injectable()
export class MfaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hand out a secret and the URI an authenticator app expects.
   *
   * Safe to call again before confirming: it replaces an unconfirmed secret,
   * which is what someone who abandoned a half-finished enrolment needs. It
   * refuses once enrolment is complete, so an attacker holding a live session
   * cannot quietly swap the second factor for one of their own.
   */
  async beginEnrolment(userId: string, email: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabledAt: true },
    });
    if (user?.mfaEnabledAt) {
      throw new BadRequestException(
        'Two-factor authentication is already set up on this account',
      );
    }

    const secret = generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: encryptField(secret), mfaLastTimeStep: null },
    });

    return {
      secret,
      // The client renders the QR code from this. Keeping image generation out
      // of the backend avoids a dependency, and the raw secret is shown anyway
      // for anyone typing it in by hand.
      uri: generateURI({ issuer: ISSUER, label: email, secret }),
    };
  }

  /**
   * Finish enrolment, and hand back the recovery codes exactly once.
   *
   * The codes are returned in plaintext here and stored only as hashes, so
   * this response is the sole opportunity to keep them. That is deliberate: a
   * recovery code retrievable later is just a weaker password.
   */
  async confirmEnrolment(userId: string, email: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabledAt: true },
    });
    if (user?.mfaEnabledAt) {
      throw new BadRequestException('Two-factor is already set up');
    }
    if (!user?.mfaSecret) {
      throw new BadRequestException('Start enrolment before confirming it');
    }

    const result = checkTotp(decryptField(user.mfaSecret), normalise(code));
    if (!result.valid) {
      throw new BadRequestException(
        'That code did not match. Check the time on your phone and try the current code.',
      );
    }

    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      crypto.randomBytes(RECOVERY_CODE_BYTES).toString('hex'),
    );
    const hashed = await Promise.all(
      codes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          mfaEnabledAt: new Date(),
          mfaRecoveryCodes: hashed,
          mfaLastTimeStep: result.timeStep,
        },
      });
      await writeAudit(tx, {
        actor: { id: userId, email },
        action: 'auth.mfa.enrolled',
        entityType: 'user',
        entityId: userId,
      });
    });

    return { recoveryCodes: codes };
  }

  /**
   * Check a code at sign-in. Accepts a time-based code or one recovery code.
   *
   * Returns false rather than throwing, so the caller decides what a failure
   * looks like — the login path deliberately does not distinguish a wrong code
   * from a wrong password in what it tells the user.
   */
  async verify(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        mfaSecret: true,
        mfaEnabledAt: true,
        mfaRecoveryCodes: true,
        mfaLastTimeStep: true,
      },
    });
    if (!user?.mfaEnabledAt || !user.mfaSecret) return false;

    const trimmed = normalise(code);
    const result = checkTotp(
      decryptField(user.mfaSecret),
      trimmed,
      // Rejects any step already spent. Without this a code stays usable for
      // its whole window, so one observed over a shoulder — or replayed by
      // something sitting in the middle — works a second time.
      user.mfaLastTimeStep ?? undefined,
    );

    if (result.valid) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { mfaLastTimeStep: result.timeStep },
      });
      return true;
    }

    return this.consumeRecoveryCode(userId, trimmed, user.mfaRecoveryCodes);
  }

  /**
   * Spend a recovery code, if the input matches an unused one.
   *
   * Every stored hash is compared even after a match, so the work done does
   * not depend on which code was supplied — or on whether any matched at all.
   */
  private async consumeRecoveryCode(
    userId: string,
    input: string,
    hashes: string[],
  ): Promise<boolean> {
    let matched = -1;
    for (let i = 0; i < hashes.length; i++) {
      if (await bcrypt.compare(input, hashes[i])) matched = i;
    }
    if (matched === -1) return false;

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaRecoveryCodes: hashes.filter((_, i) => i !== matched) },
    });
    return true;
  }
}
