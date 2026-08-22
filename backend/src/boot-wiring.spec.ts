import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { StaffService } from './staff/staff.service';
import { MfaService } from './auth/mfa.service';
import { LedgerService } from './ledger/ledger.service';

/**
 * Instantiate every provider in the application graph.
 *
 * Unit tests construct services with hand-built dependency lists, so a module
 * that forgets to import or provide something still passes all of them and
 * fails at boot instead. This resolves the real graph with only the database
 * stubbed, which is the one dependency that needs a server.
 */
describe('application wiring', () => {
  it('resolves every provider, including the new staff and MFA services', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $on: jest.fn(),
        user: {},
        // LedgerService builds the chart of accounts on module init, so the
        // graph cannot resolve without something for it to read.
        corridor: { findMany: jest.fn().mockResolvedValue([]) },
        ledgerAccount: { upsert: jest.fn() },
      })
      .compile();

    expect(moduleRef.get(StaffService)).toBeInstanceOf(StaffService);
    expect(moduleRef.get(MfaService)).toBeInstanceOf(MfaService);
    // Global, and every money path depends on it — so a missing provider here
    // would surface as a boot failure in production, not a test failure.
    expect(moduleRef.get(LedgerService)).toBeInstanceOf(LedgerService);

    await moduleRef.close();
  });
});
