import { Global, Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';

/**
 * Global, like Prisma, because everything that moves money needs it and
 * threading it through five module import lists would be ceremony without
 * meaning. It has one dependency of its own and holds no request state.
 */
@Global()
@Module({
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
