import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { writeAudit } from '../common/audit/audit';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { UpdateRecipientDto } from './dto/update-recipient.dto';

@Injectable()
export class RecipientsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.recipient.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        country: true,
        bankAccount: true,
        bankName: true,
        bankCode: true,
        createdAt: true,
      },
    });
  }

  async create(userId: string, dto: CreateRecipientDto) {
    const recipient = await this.prisma.recipient.create({
      data: { ...dto, userId },
    });
    await this.audit(userId, 'recipient.create', recipient.id, {
      after: recipientState(recipient),
    });
    return recipient;
  }

  async update(userId: string, id: string, dto: UpdateRecipientDto) {
    const before = await this.ensureOwned(userId, id);
    const updated = await this.prisma.recipient.update({
      where: { id },
      data: dto,
    });
    // Editing a saved recipient is how someone would quietly redirect future
    // payments, so this is one of the more interesting entries in the log.
    // Past transfers are unaffected — they carry their own snapshot.
    await this.audit(userId, 'recipient.update', id, {
      before: recipientState(before),
      after: recipientState(updated),
    });
    return updated;
  }

  async remove(userId: string, id: string) {
    const existing = await this.ensureOwned(userId, id);
    const hasActiveTransfers = await this.prisma.transfer.count({
      where: {
        recipientId: id,
        status: {
          in: [
            'initiated',
            'payment_received',
            'compliance_check',
            'fx_converted',
            'payout_processing',
          ],
        },
      },
    });
    if (hasActiveTransfers > 0) {
      throw new ForbiddenException(
        'Cannot delete recipient with in-flight transfers',
      );
    }
    await this.prisma.recipient.update({
      where: { id },
      data: { active: false },
    });
    await this.audit(userId, 'recipient.delete', id, {
      before: { active: true },
      after: { active: false },
    });
    return { id: existing.id, deleted: true };
  }

  private async ensureOwned(userId: string, id: string) {
    const recipient = await this.prisma.recipient.findUnique({ where: { id } });
    if (!recipient || !recipient.active || recipient.userId !== userId) {
      throw new NotFoundException('Recipient not found');
    }
    return recipient;
  }

  private audit(
    userId: string,
    action: string,
    entityId: string,
    change: { before?: unknown; after?: unknown } = {},
  ) {
    return writeAudit(this.prisma, {
      actor: { id: userId },
      action,
      entityType: 'recipient',
      entityId,
      ...change,
    });
  }
}

/**
 * A recipient's fields, with the account number reduced to its last four.
 *
 * The audit log is read by staff and retained for years; putting a full
 * account number in it would undo the encryption protecting the column it came
 * from. Four digits is enough to see that a change happened and which way.
 */
function recipientState(r: {
  name: string;
  email: string | null;
  phone: string | null;
  country: string;
  bankAccount: string;
  bankName: string | null;
  bankCode: string | null;
  active: boolean;
}) {
  return {
    name: r.name,
    email: r.email,
    phone: r.phone,
    country: r.country,
    bankAccountLast4: r.bankAccount.slice(-4),
    bankName: r.bankName,
    bankCode: r.bankCode,
    active: r.active,
  };
}
