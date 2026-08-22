import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { TransfersModule } from '../transfers/transfers.module';
import { WalletModule } from '../wallet/wallet.module';
import { AdminController } from './admin.controller';
import { CustomersController } from './customers.controller';
import { AdminService } from './admin.service';
import { CustomersService } from './customers.service';

@Module({
  imports: [AuthModule, WalletModule, TransfersModule, ComplianceModule],
  controllers: [AdminController, CustomersController],
  providers: [AdminService, CustomersService],
})
export class AdminModule {}
