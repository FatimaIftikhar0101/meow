import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { writeStaffAudit } from '../common/audit/audit';
import { decryptField, maskAccount } from '../common/crypto/field-crypto';
import { WalletService } from '../wallet/wallet.service';
import { RevealAccountDto } from './dto/reveal-account.dto';

/**
 * Everything about one customer, on one screen.
 *
 * Support currently answers "where is my money?" by moving between the user
 * list, the transfer queue and the ledger, holding the customer's id in their
 * head. That is slow on a good day and wrong on a bad one, because the id in
 * their head is the thing that gets mistyped. This assembles the same facts in
 * one request, keyed once.
 *
 * ── Account numbers are masked here, always ──────────────────────────────────
 *
 * Every account number this service returns has been through `maskAccount`.
 * Seeing a full one is a separate request, to `reveal()`, which requires
 * `customer.pii_full` — compliance only — a written reason, and leaves an audit
 * row behind. That split is the whole design: a reveal is an event that
 * happened at a time for a reason, not a field that support happens to have on
 * screen all afternoon.
 */
@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
  ) {}

  /**
   * Decrypt for display, without letting one bad row take the page down.
   *
   * `decryptField` throws on a value it cannot authenticate — right, because
   * silently returning garbage from a tampered ciphertext would be worse. But
   * this is the screen support opens while a customer is on the phone, and a
   * single unreadable row should cost that row, not the whole customer. The
   * failure is logged rather than swallowed, so corruption still surfaces
   * somewhere a person will see it.
   */
  private maskSafely(stored: string): string {
    try {
      return maskAccount(decryptField(stored));
    } catch (err) {
      this.logger.error(
        `Unreadable encrypted account number: ${(err as Error).message}`,
      );
      return '[unreadable]';
    }
  }

  /**
   * Run a supporting query, and let it fail without taking the page with it.
   *
   * Found by running this against a real database: `listNotes` sat inside the
   * same `Promise.all` as everything else, so one missing table blanked the
   * whole customer — profile, balances, transfers and all — rather than one
   * card. On the screen support opens while a customer is on the phone, that
   * is the wrong trade for a section nobody is currently reading.
   *
   * The failure is **named in the response**, never swallowed into an empty
   * array. "No notes" and "could not load notes" are different answers, and an
   * agent who is shown the first when the second is true will tell a customer
   * something untrue with complete confidence.
   */
  private async section<T>(
    name: string,
    run: () => Promise<T>,
    fallback: T,
    degraded: string[],
  ): Promise<T> {
    try {
      return await run();
    } catch (err) {
      degraded.push(name);
      this.logger.error(
        `Customer overview section "${name}" failed: ${(err as Error).message}`,
      );
      return fallback;
    }
  }

  /**
   * The aggregate.
   *
   * Deliberately not one giant `include`. The relations that are unbounded —
   * transfers, sessions, notifications, notes — each need their own ordering
   * and their own limit, and nesting them under a single `findUnique` would
   * either fetch everything or need a `take` per relation anyway. This way the
   * limits are visible at the call site.
   */
  async overview(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        country: true,
        role: true,
        suspended: true,
        emailVerified: true,
        authProvider: true,
        referralCode: true,
        createdAt: true,
        ledgerAccounts: {
          where: { kind: 'customer_wallet' },
          select: { id: true, currency: true },
        },
        kycRecords: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            provider: true,
            reason: true,
            verifiedAt: true,
            createdAt: true,
            // Evidence, for the question "how do we know who this is?".
            // `documentLast4` is already a last-4 in the schema; there is no
            // full number stored to leak.
            verifiedName: true,
            documentType: true,
            documentLast4: true,
            documentExpiry: true,
            method: true,
            reviewedById: true,
            reviewedAt: true,
          },
        },
        referredBy: {
          select: {
            id: true,
            status: true,
            code: true,
            rewardAmount: true,
            rewardCurrency: true,
            rewardedAt: true,
            referrer: { select: { id: true, email: true } },
          },
        },
        _count: {
          select: { transfers: true, recipients: true, referralsMade: true },
        },
      },
    });
    if (!user) throw new NotFoundException('Customer not found');

    // What the page is for. If these cannot be read there is no page, so they
    // are not wrapped — a failure here should surface as a failure.
    const degraded: string[] = [];
    const [transfers, sessions, notifications, notes, referralsMade] =
      await Promise.all([
        this.prisma.transfer.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            status: true,
            sendAmount: true,
            sendCurrency: true,
            receiveAmount: true,
            receiveCurrency: true,
            feeAmount: true,
            fxRateApplied: true,
            createdAt: true,
            updatedAt: true,
            failureReason: true,
            // The snapshot, not the recipient relation — what this transfer
            // actually did, which is the point of the snapshot columns.
            recipientName: true,
            recipientCountry: true,
            recipientBankName: true,
            recipientBankAccount: true,
          },
        }),
        this.section(
          'sessions',
          () =>
            this.prisma.session.findMany({
              where: { userId: id },
              orderBy: { lastSeenAt: 'desc' },
              take: 10,
              select: {
                id: true,
                userAgent: true,
                ipAddress: true,
                createdAt: true,
                lastSeenAt: true,
                expiresAt: true,
                revokedAt: true,
              },
            }),
          [],
          degraded,
        ),
        this.section(
          'notifications',
          () =>
            this.prisma.notification.findMany({
              where: { userId: id },
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: {
                id: true,
                type: true,
                title: true,
                body: true,
                read: true,
                createdAt: true,
              },
            }),
          [],
          degraded,
        ),
        this.section('notes', () => this.listNotes(id), [], degraded),
        this.section(
          'referrals',
          () =>
            this.prisma.referral.findMany({
              where: { referrerId: id },
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: {
                id: true,
                status: true,
                rewardAmount: true,
                rewardCurrency: true,
                rewardedAt: true,
                createdAt: true,
                referee: { select: { id: true, email: true } },
              },
            }),
          [],
          degraded,
        ),
      ]);

    const balances = await Promise.all(
      user.ledgerAccounts.map(async (w) => ({
        accountId: w.id,
        currency: w.currency,
        balance: (await this.wallets.computeBalance(w.id)).toFixed(2),
      })),
    );

    // Spelled out rather than spread. This is the one response in the panel
    // that assembles a whole person, so what leaves the server should be
    // readable in one place — a field added to the `select` above for an
    // internal check does not silently become part of the API.
    return {
      profile: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        country: user.country,
        role: user.role,
        suspended: user.suspended,
        emailVerified: user.emailVerified,
        authProvider: user.authProvider,
        referralCode: user.referralCode,
        createdAt: user.createdAt,
        transferCount: user._count.transfers,
        recipientCount: user._count.recipients,
        referralCount: user._count.referralsMade,
      },
      balances,
      kyc: user.kycRecords,
      transfers: transfers.map(({ recipientBankAccount, ...t }) => ({
        ...t,
        recipientBankAccountMasked: this.maskSafely(recipientBankAccount),
      })),
      sessions,
      notifications,
      notes,
      referrals: { referredBy: user.referredBy, made: referralsMade },
      /** Sections that could not be read. Empty on a healthy page; the UI says
       *  so per card rather than showing an empty one as if it were the truth. */
      degraded,
    };
  }

  /**
   * Show one full account number, and record that it happened.
   *
   * Three things have to be true before the value is returned, and the order
   * matters:
   *
   *  1. The record named belongs to the customer named. Without this check a
   *     staff member could pass any customer id they are allowed to view
   *     together with a recipient id belonging to someone else entirely, and
   *     the audit row would name the wrong person — which is worse than no
   *     audit row, because it reads as evidence.
   *  2. The audit entry is written **before** the value is returned, and its
   *     failure is not caught. An unaudited reveal must not be possible, so if
   *     the log cannot be written the reveal does not happen.
   *  3. Only then is the plaintext decrypted and returned.
   */
  async reveal(actor: AuthUser, customerId: string, dto: RevealAccountDto) {
    const { recipientId, transferId, reason } = dto;
    if (Boolean(recipientId) === Boolean(transferId)) {
      throw new BadRequestException(
        'Name exactly one of recipientId or transferId',
      );
    }

    let stored: string;
    let entityType: string;
    let entityId: string;

    if (recipientId) {
      // The userId in the filter is the ownership check, not a convenience.
      const recipient = await this.prisma.recipient.findFirst({
        where: { id: recipientId, userId: customerId },
        select: { id: true, bankAccount: true, name: true },
      });
      if (!recipient) {
        throw new NotFoundException('Recipient not found for this customer');
      }
      stored = recipient.bankAccount;
      entityType = 'Recipient';
      entityId = recipient.id;
    } else {
      const transfer = await this.prisma.transfer.findFirst({
        where: { id: transferId, userId: customerId },
        select: { id: true, recipientBankAccount: true, recipientName: true },
      });
      if (!transfer) {
        throw new NotFoundException('Transfer not found for this customer');
      }
      stored = transfer.recipientBankAccount;
      entityType = 'Transfer';
      entityId = transfer.id;
    }

    // Decrypt first so a failure here fails the request rather than leaving an
    // audit row claiming a reveal that never produced a value.
    const plaintext = decryptField(stored);

    await writeStaffAudit(this.prisma, {
      actor: { id: actor.id, email: actor.email },
      action: 'admin.customer.pii_reveal',
      entityType,
      entityId,
      reason,
      // A reveal changes what a person can see, not what the record holds.
      // Recording that as the before/after is the honest reading of a pair the
      // type requires, and it is what the log is actually evidence of.
      before: { visibility: 'masked', value: maskAccount(plaintext) },
      after: { visibility: 'full' },
      metadata: { customerId },
    });

    return {
      entityType,
      entityId,
      bankAccount: plaintext,
      revealedAt: new Date().toISOString(),
    };
  }

  listNotes(customerId: string) {
    return this.prisma.customerNote.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, email: true } },
      },
    });
  }

  async addNote(actor: AuthUser, customerId: string, body: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.customerNote.create({
      data: { customerId, authorId: actor.id, body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, email: true } },
      },
    });
  }
}
