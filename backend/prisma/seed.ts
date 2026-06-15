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
  active: boolean;
}

/**
 * Launch scope: Canada -> Pakistan and Canada -> India only.
 *
 * Other corridors stay in the table as inactive so any previously-created
 * transfer rows still resolve their FX history, but no new transfers can
 * be opened against them (CorridorsService.findActive checks the active
 * flag). To enable a corridor later, flip active=true and reseed, or use
 * /admin/corridors PATCH.
 */
const corridors: CorridorSeed[] = [
  { fromCurrency: 'CAD', toCurrency: 'PKR', fromCountry: 'CA', toCountry: 'PK', baseRate: '205.50', marginBps: 150, feeFlat: '2.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000', active: true },
  { fromCurrency: 'CAD', toCurrency: 'INR', fromCountry: 'CA', toCountry: 'IN', baseRate: '61.20', marginBps: 150, feeFlat: '2.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000', active: true },

  // Roadmap — kept seeded but inactive so we have rate references for the
  // admin UI. Will be flipped on individually as compliance approves each.
  { fromCurrency: 'CAD', toCurrency: 'PHP', fromCountry: 'CA', toCountry: 'PH', baseRate: '41.10', marginBps: 150, feeFlat: '2.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000', active: false },
  { fromCurrency: 'USD', toCurrency: 'PKR', fromCountry: 'US', toCountry: 'PK', baseRate: '279.50', marginBps: 130, feeFlat: '1.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000', active: false },
  { fromCurrency: 'USD', toCurrency: 'INR', fromCountry: 'US', toCountry: 'IN', baseRate: '83.40', marginBps: 130, feeFlat: '1.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000', active: false },
  { fromCurrency: 'USD', toCurrency: 'PHP', fromCountry: 'US', toCountry: 'PH', baseRate: '56.10', marginBps: 130, feeFlat: '1.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000', active: false },
  { fromCurrency: 'GBP', toCurrency: 'PKR', fromCountry: 'GB', toCountry: 'PK', baseRate: '355.00', marginBps: 130, feeFlat: '1.99', feePercentBps: 0, minSendAmount: '5', maxSendAmount: '10000', active: false },
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
        active: c.active,
      },
      create: c,
    });
  }
  const active = corridors.filter((c) => c.active).length;
  console.log(`Seeded ${corridors.length} corridors (${active} active, ${corridors.length - active} inactive)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
