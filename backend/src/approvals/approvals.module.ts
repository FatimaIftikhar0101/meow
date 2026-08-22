import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TransfersModule } from '../transfers/transfers.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  imports: [AuthModule, TransfersModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}
