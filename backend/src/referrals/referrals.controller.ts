import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.referrals.getDashboard(user.id);
  }

  @Get('check')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async checkCode(@Query('code') code: string) {
    const valid = await this.referrals.checkCode(code ?? '');
    return { valid };
  }
}
