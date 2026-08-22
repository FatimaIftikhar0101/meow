import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  PermissionsGuard,
  RequirePermission,
} from '../auth/guards/permissions.guard';
import { StaffGuard } from '../auth/guards/staff.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApprovalsService } from './approvals.service';
import {
  CreateApprovalDto,
  DecideApprovalDto,
  ListApprovalsDto,
} from './dto/approval.dto';

/**
 * The four-eyes queue.
 *
 * Reading it needs only `approval.request`, so the person who asked can see
 * what happened to their request. Deciding needs `approval.decide`, which
 * operations does not have — that separation is the entire feature.
 */
@Controller('admin/approvals')
@UseGuards(JwtAuthGuard, StaffGuard, PermissionsGuard)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @RequirePermission('approval.request')
  list(@Query() query: ListApprovalsDto) {
    return this.approvals.list(query);
  }

  /** What can be asked for. Drives the panel rather than a hardcoded list. */
  @Get('actions')
  @RequirePermission('approval.request')
  actions() {
    return this.approvals.listActions();
  }

  @Post()
  @RequirePermission('approval.request')
  create(@CurrentUser() staff: AuthUser, @Body() dto: CreateApprovalDto) {
    return this.approvals.request(staff, dto);
  }

  @Post(':id/approve')
  @RequirePermission('approval.decide')
  approve(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.approvals.decide(staff, id, true, dto.reason);
  }

  @Post(':id/reject')
  @RequirePermission('approval.decide')
  reject(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.approvals.decide(staff, id, false, dto.reason);
  }

  /** Withdrawing your own request needs no decider — see the service. */
  @Post(':id/cancel')
  @RequirePermission('approval.request')
  cancel(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.approvals.cancel(staff, id, dto.reason);
  }
}
