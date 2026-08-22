import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AlertsService } from './alerts.service';
import { ScreeningController } from './screening.controller';
import { ScreeningService } from './screening.service';

/**
 * Global because the transfer path screens on every payment, and threading a
 * module import through for a check that must never be skipped invites a
 * future module that forgets to import it and screens nothing.
 */
@Global()
@Module({
  imports: [AuthModule],
  controllers: [ScreeningController],
  providers: [ScreeningService, AlertsService],
  exports: [ScreeningService],
})
export class ScreeningModule {}
