import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { TransfersController } from './transfers.controller';
import { TransfersGateway } from './transfers.gateway';
import { TransfersService } from './transfers.service';

@Module({
  imports: [AuthModule, WalletModule],
  controllers: [TransfersController],
  providers: [TransfersService, TransfersGateway],
  exports: [TransfersService],
})
export class TransfersModule {}
