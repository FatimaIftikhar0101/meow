import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  // MailModule is here for the optional copy of a setup code. Handing the code
  // over directly is still the primary path — email is an extra, never the
  // only way a new colleague receives it.
  imports: [AuthModule, MailModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
