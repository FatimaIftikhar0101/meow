import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { TransfersModule } from '../transfers/transfers.module';
import { WalletModule } from '../wallet/wallet.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, WalletModule, TransfersModule, ComplianceModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
