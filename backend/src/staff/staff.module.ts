import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  // No MailModule: staff onboarding hands the setup code to the admin who
  // created the account rather than emailing it.
  imports: [AuthModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
