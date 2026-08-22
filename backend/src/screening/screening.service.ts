import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { AlertSeverity, BlocklistKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * What the business checks before and after it moves money.
 *
 * Two jobs with deliberately different consequences.
 *
 * **The blocklist blocks.** It runs before the transfer exists and throws, so
 * no money moves and no ledger entry is written. It is a short, indexed lookup
 * on values normalised at write time.
 *
 * **The rules alert.** They run after the transfer is created and never throw
 * into the money path. A rule engine that can fail a payment is a rule engine
 * that will one day fail every payment because somebody deployed a bad regular
 * expression on a Friday. What it produces is a queue for a human.
 *
 * The rules here are heuristics, not law. They exist so that a real screening
 * vendor drops into a shape that already has a queue, an adjudication trail and
 * a case file around it — the parts that take longest to get right and that no
 * vendor supplies.
 */
@Injectable()
export class ScreeningService {
  private readonly logger = new Logger(ScreeningService.name);

  /** Above this, in send currency, a single transfer is worth a look. Chosen
   *  to sit under the CAD 10,000 reporting threshold, because the interesting
   *  behaviour is what happens just below a threshold, not above it. */
  static readonly LARGE_AMOUNT = new Prisma.Decimal('7500');

  /** The reporting threshold itself. Payments clustering just under it are the
   *  classic structuring signature. */
  static readonly REPORTING_THRESHOLD = new Prisma.Decimal('10000');

  /** How many transfers in 24 hours stops being ordinary. */
  static readonly VELOCITY_COUNT = 5;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalise a value for matching.
   *
   * Applied identically on write and on read — that symmetry is the whole
   * correctness argument, so both paths call this one function rather than
   * each doing their own lower-casing.
   */
  static normalise(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Refuse a payment to a blocked party.
   *
   * Called before the transfer row is created. Throwing here means nothing was
   * written: no transfer, no ledger posting, no partial state to clean up.
   *
   * The message deliberately does not say which field matched. Telling a
   * sender exactly which of the beneficiary's details is on a list turns the
   * product into an oracle for testing names against it.
   */
  async assertNotBlocked(input: {
    recipientName: string;
    recipientCountry: string;
    bankAccount: string;
    email?: string | null;
  }): Promise<void> {
    const candidates: Array<{ kind: BlocklistKind; value: string }> = [
      { kind: 'name', value: ScreeningService.normalise(input.recipientName) },
      {
        kind: 'country',
        value: ScreeningService.normalise(input.recipientCountry),
      },
      { kind: 'account', value: ScreeningService.normalise(input.bankAccount) },
    ];
    if (input.email) {
      candidates.push({
        kind: 'email',
        value: ScreeningService.normalise(input.email),
      });
    }

    const hit = await this.prisma.blocklistEntry.findFirst({
      where: { active: true, OR: candidates },
      select: { id: true, kind: true },
    });

    if (hit) {
      this.logger.warn(`Blocked transfer attempt: ${hit.kind} entry ${hit.id}`);
      throw new ForbiddenException(
        'This transfer cannot be sent. Please contact support.',
      );
    }
  }

  /**
   * Look at a transfer that has already been created and raise what is worth
   * raising.
   *
   * Never throws into the caller. A failure here must not fail a payment that
   * has already been accepted and posted — the customer's money has moved, and
   * refusing to record the movement because a heuristic query timed out would
   * be strictly worse than the missing alert.
   */
  async screenTransfer(transfer: {
    id: string;
    userId: string;
    sendAmount: Prisma.Decimal;
    sendCurrency: string;
    recipientCountry: string;
  }): Promise<void> {
    try {
      const alerts = await this.evaluate(transfer);
      if (alerts.length === 0) return;

      await this.prisma.complianceAlert.createMany({
        data: alerts.map((a) => ({
          rule: a.rule,
          severity: a.severity,
          userId: transfer.userId,
          transferId: transfer.id,
          detail: a.detail as Prisma.InputJsonValue,
        })),
      });
      this.logger.log(
        `Transfer ${transfer.id} raised ${alerts.length} alert(s): ${alerts
          .map((a) => a.rule)
          .join(', ')}`,
      );
    } catch (err) {
      this.logger.error(
        `Screening failed for transfer ${transfer.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * The rules.
   *
   * Separated from the writing so it can be tested as a pure-ish function of
   * what the database holds, and so a future vendor integration replaces this
   * method rather than the surrounding plumbing.
   */
  private async evaluate(transfer: {
    id: string;
    userId: string;
    sendAmount: Prisma.Decimal;
    sendCurrency: string;
    recipientCountry: string;
  }): Promise<
    Array<{
      rule: string;
      severity: AlertSeverity;
      detail: Record<string, unknown>;
    }>
  > {
    const out: Array<{
      rule: string;
      severity: AlertSeverity;
      detail: Record<string, unknown>;
    }> = [];

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.prisma.transfer.findMany({
      where: {
        userId: transfer.userId,
        createdAt: { gte: dayAgo },
        status: { not: 'failed' },
      },
      select: {
        id: true,
        sendAmount: true,
        sendCurrency: true,
        createdAt: true,
      },
    });

    // ── One large payment ────────────────────────────────────────────────────
    if (
      transfer.sendAmount.greaterThanOrEqualTo(ScreeningService.LARGE_AMOUNT)
    ) {
      out.push({
        rule: 'large_amount',
        severity: transfer.sendAmount.greaterThanOrEqualTo(
          ScreeningService.REPORTING_THRESHOLD,
        )
          ? 'high'
          : 'medium',
        detail: {
          amount: transfer.sendAmount.toFixed(2),
          currency: transfer.sendCurrency,
          threshold: ScreeningService.LARGE_AMOUNT.toFixed(2),
        },
      });
    }

    // ── Too many, too fast ───────────────────────────────────────────────────
    if (recent.length >= ScreeningService.VELOCITY_COUNT) {
      out.push({
        rule: 'velocity',
        severity: 'medium',
        detail: {
          count: recent.length,
          windowHours: 24,
          threshold: ScreeningService.VELOCITY_COUNT,
        },
      });
    }

    // ── Structuring ──────────────────────────────────────────────────────────
    //
    // Several payments in a day that individually stay under the reporting
    // threshold and together cross it. This is the pattern the threshold
    // itself creates, so it is the one worth looking for — a single payment
    // over the line is declared and unremarkable; five just under it is a
    // decision somebody made.
    const sameCurrency = recent.filter(
      (r) => r.sendCurrency === transfer.sendCurrency,
    );
    if (sameCurrency.length >= 2) {
      const total = sameCurrency.reduce(
        (acc, r) => acc.plus(r.sendAmount),
        new Prisma.Decimal(0),
      );
      const allUnder = sameCurrency.every((r) =>
        r.sendAmount.lessThan(ScreeningService.REPORTING_THRESHOLD),
      );
      if (
        allUnder &&
        total.greaterThanOrEqualTo(ScreeningService.REPORTING_THRESHOLD)
      ) {
        out.push({
          rule: 'structuring',
          severity: 'high',
          detail: {
            count: sameCurrency.length,
            total: total.toFixed(2),
            currency: transfer.sendCurrency,
            threshold: ScreeningService.REPORTING_THRESHOLD.toFixed(2),
            transferIds: sameCurrency.map((r) => r.id),
          },
        });
      }
    }

    // ── A destination that is not on the blocklist but is not routine ────────
    //
    // Distinct from the blocklist on purpose. The blocklist is a decision the
    // business has already made; this is a flag saying somebody should look.
    // Collapsing them would mean every judgement call became a refusal.
    const corridor = await this.prisma.corridor.findFirst({
      where: { toCountry: transfer.recipientCountry },
      select: { id: true, active: true },
    });
    if (!corridor) {
      out.push({
        rule: 'unknown_corridor',
        severity: 'medium',
        detail: { country: transfer.recipientCountry },
      });
    }

    return out;
  }
}
