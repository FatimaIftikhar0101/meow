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
import { AlertsService } from './alerts.service';
import {
  AddBlocklistDto,
  AdjudicateAlertDto,
  ListAlertsDto,
  ListCasesDto,
  OpenCaseDto,
  ReasonDto,
} from './dto/screening.dto';

/**
 * Financial crime: the queue, the files, and the list that refuses.
 *
 * Four permissions that already existed in the map with nothing consuming
 * them — `alert.read`, `alert.adjudicate`, `case.manage`, `blocklist.read` and
 * `blocklist.write` — and all of them sit with compliance, not operations.
 * That separation is the point: the person who moves a payment along should
 * not be the person who decides whether it should have moved.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, StaffGuard, PermissionsGuard)
export class ScreeningController {
  constructor(private readonly alerts: AlertsService) {}

  @Get('alerts')
  @RequirePermission('alert.read')
  listAlerts(@Query() query: ListAlertsDto) {
    return this.alerts.listAlerts(query);
  }

  @Post('alerts/:id/adjudicate')
  @RequirePermission('alert.adjudicate')
  adjudicate(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjudicateAlertDto,
  ) {
    return this.alerts.adjudicate(
      staff,
      id,
      dto.status,
      dto.reason,
      dto.caseId,
    );
  }

  @Get('cases')
  @RequirePermission('case.manage')
  listCases(@Query() query: ListCasesDto) {
    return this.alerts.listCases(query);
  }

  @Get('cases/:id')
  @RequirePermission('case.manage')
  getCase(@Param('id', ParseUUIDPipe) id: string) {
    return this.alerts.getCase(id);
  }

  @Post('cases')
  @RequirePermission('case.manage')
  openCase(@CurrentUser() staff: AuthUser, @Body() dto: OpenCaseDto) {
    return this.alerts.openCase(staff, dto.userId, dto.summary);
  }

  @Post('cases/:id/close')
  @RequirePermission('case.manage')
  closeCase(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.alerts.closeCase(staff, id, dto.reason);
  }

  @Get('blocklist')
  @RequirePermission('blocklist.read')
  listBlocklist(@Query('includeInactive') includeInactive?: string) {
    return this.alerts.listBlocklist(includeInactive === 'true');
  }

  @Post('blocklist')
  @RequirePermission('blocklist.write')
  addBlocklist(@CurrentUser() staff: AuthUser, @Body() dto: AddBlocklistDto) {
    return this.alerts.addToBlocklist(staff, dto.kind, dto.display, dto.reason);
  }

  @Post('blocklist/:id/remove')
  @RequirePermission('blocklist.write')
  removeBlocklist(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.alerts.removeFromBlocklist(staff, id, dto.reason);
  }
}
