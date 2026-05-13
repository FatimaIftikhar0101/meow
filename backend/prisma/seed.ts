import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CorridorSeed {
  fromCurrency: string;
  toCurrency: string;
  fromCountry: string;
  toCountry: string;
  baseRate: string;
  marginBps: number;
  feeFlat: string;
  feePercentBps: number;
  minSendAmount: string;
  maxSendAmount: string;
}

const corridors: CorridorSeed[] = [
  { fromCurrency: 'CAD', toCurrency: 'PKR', fromCountry: 'CA', toCountry: 'PK', baseRate: '205.50', marginBps: 150, feeFlat: '2.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000' },
  { fromCurrency: 'CAD', toCurrency: 'INR', fromCountry: 'CA', toCountry: 'IN', baseRate: '61.20', marginBps: 150, feeFlat: '2.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000' },
  { fromCurrency: 'CAD', toCurrency: 'PHP', fromCountry: 'CA', toCountry: 'PH', baseRate: '41.10', marginBps: 150, feeFlat: '2.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000' },
  { fromCurrency: 'USD', toCurrency: 'PKR', fromCountry: 'US', toCountry: 'PK', baseRate: '279.50', marginBps: 130, feeFlat: '1.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000' },
  { fromCurrency: 'USD', toCurrency: 'INR', fromCountry: 'US', toCountry: 'IN', baseRate: '83.40', marginBps: 130, feeFlat: '1.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000' },
  { fromCurrency: 'USD', toCurrency: 'PHP', fromCountry: 'US', toCountry: 'PH', baseRate: '56.10', marginBps: 130, feeFlat: '1.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000' },
  { fromCurrency: 'GBP', toCurrency: 'PKR', fromCountry: 'GB', toCountry: 'PK', baseRate: '355.00', marginBps: 130, feeFlat: '1.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000' },
];

async function main() {
  for (const c of corridors) {
    await prisma.corridor.upsert({
      where: { fromCurrency_toCurrency: { fromCurrency: c.fromCurrency, toCurrency: c.toCurrency } },
      update: {
        fromCountry: c.fromCountry,
        toCountry: c.toCountry,
        baseRate: c.baseRate,
        marginBps: c.marginBps,
        feeFlat: c.feeFlat,
        feePercentBps: c.feePercentBps,
        minSendAmount: c.minSendAmount,
        maxSendAmount: c.maxSendAmount,
        active: true,
      },
      create: {
        ...c,
        active: true,
      },
    });
  }
  console.log(`Seeded ${corridors.length} corridors`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
