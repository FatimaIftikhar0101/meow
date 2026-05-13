import { BadRequestException, Injectable } from '@nestjs/common';
import { Corridor, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AppliedQuote {
  receiveAmount: Prisma.Decimal;
  rate: Prisma.Decimal;
  fee: Prisma.Decimal;
  corridor: Corridor;
}

@Injectable()
export class CorridorsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.corridor.findMany({
      where: { active: true },
      orderBy: [{ fromCurrency: 'asc' }, { toCurrency: 'asc' }],
    });
  }

  async findActive(from: string, to: string) {
    const corridor = await this.prisma.corridor.findUnique({
      where: {
        fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to },
      },
    });
    if (!corridor || !corridor.active) {
      throw new BadRequestException(`Corridor ${from}->${to} not supported`);
    }
    return corridor;
  }

  computeQuote(corridor: Corridor, sendAmount: Prisma.Decimal): AppliedQuote {
    if (
      sendAmount.lt(corridor.minSendAmount) ||
      sendAmount.gt(corridor.maxSendAmount)
    ) {
      throw new BadRequestException(
        `Amount must be between ${corridor.minSendAmount.toString()} and ${corridor.maxSendAmount.toString()} ${corridor.fromCurrency}`,
      );
    }
    const rate = new Prisma.Decimal(corridor.baseRate).times(
      new Prisma.Decimal(10000 - corridor.marginBps).div(10000),
    );
    const fee = new Prisma.Decimal(corridor.feeFlat).plus(
      sendAmount.times(corridor.feePercentBps).div(10000),
    );
    const receiveAmount = sendAmount.times(rate);
    return { receiveAmount, rate, fee, corridor };
  }

  async convert(from: string, to: string, amount: number) {
    const corridor = await this.findActive(from, to);
    const quote = this.computeQuote(corridor, new Prisma.Decimal(amount));
    return {
      from: corridor.fromCurrency,
      to: corridor.toCurrency,
      sendAmount: amount,
      receiveAmount: Number(quote.receiveAmount.toFixed(2)),
      rate: Number(quote.rate.toFixed(6)),
      fee: Number(quote.fee.toFixed(2)),
      minSendAmount: Number(corridor.minSendAmount),
      maxSendAmount: Number(corridor.maxSendAmount),
    };
  }
}
