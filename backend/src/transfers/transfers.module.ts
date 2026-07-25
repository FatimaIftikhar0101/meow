import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { CorridorsModule } from '../corridors/corridors.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { WalletModule } from '../wallet/wallet.module';
import { TransfersController } from './transfers.controller';
import { TransfersGateway } from './transfers.gateway';
import { TransfersScheduler } from './transfers.scheduler';
import { TransfersService } from './transfers.service';

@Module({
  imports: [AuthModule, WalletModule, CorridorsModule, ComplianceModule, NotificationsModule, ReferralsModule],
  controllers: [TransfersController],
  providers: [TransfersService, TransfersGateway, TransfersScheduler],
  exports: [TransfersService],
})
export class TransfersModule {}
