import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
    await this.audit(userId, 'recipient.create', recipient.id);
    return recipient;
  }

  async update(userId: string, id: string, dto: UpdateRecipientDto) {
    await this.ensureOwned(userId, id);
    const updated = await this.prisma.recipient.update({
      where: { id },
      data: dto,
    });
    await this.audit(userId, 'recipient.update', id);
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
    await this.audit(userId, 'recipient.delete', id);
    return { id: existing.id, deleted: true };
  }

  private async ensureOwned(userId: string, id: string) {
    const recipient = await this.prisma.recipient.findUnique({ where: { id } });
    if (!recipient || !recipient.active || recipient.userId !== userId) {
      throw new NotFoundException('Recipient not found');
    }
    return recipient;
  }

  private audit(userId: string, action: string, entityId: string) {
    return this.prisma.auditLog.create({
      data: { userId, action, entityType: 'recipient', entityId },
    });
  }
}
