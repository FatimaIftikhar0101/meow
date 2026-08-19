import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { StaffService } from './staff/staff.service';
import { MfaService } from './auth/mfa.service';

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
      })
      .compile();

    expect(moduleRef.get(StaffService)).toBeInstanceOf(StaffService);
    expect(moduleRef.get(MfaService)).toBeInstanceOf(MfaService);

    await moduleRef.close();
  });
});
