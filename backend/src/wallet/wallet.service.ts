import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return {
      balance: (await this.computeBalance(wallet.id)).toFixed(2),
      currency: wallet.currency,
    };
  }

  async computeBalance(walletId: string): Promise<Prisma.Decimal> {
    const [credits, debits] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        where: { walletId, direction: 'credit' },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { walletId, direction: 'debit' },
        _sum: { amount: true },
      }),
    ]);
    const c = credits._sum.amount ?? new Prisma.Decimal(0);
    const d = debits._sum.amount ?? new Prisma.Decimal(0);
    return c.minus(d);
  }

  async findUserWallet(userId: string, currency: string) {
    return this.prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency } },
    });
  }
}
