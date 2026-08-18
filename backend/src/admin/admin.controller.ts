import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransferStatus } from '@prisma/client';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ComplianceService } from '../compliance/compliance.service';
import { TransfersService } from '../transfers/transfers.service';
import { AdminService } from './admin.service';
import { ForceFailDto } from './dto/force-fail.dto';
import { SuspendDto } from './dto/suspend.dto';
import { KycOverrideDto } from './dto/kyc-override.dto';
import { UpdateCorridorDto } from './dto/update-corridor.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly transfers: TransfersService,
    private readonly compliance: ComplianceService,
  ) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  listUsers(
    @Query('search') search: string | undefined,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.admin.listUsers(search, page, Math.min(pageSize, 100));
  }

  @Get('users/:id')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getUser(id);
  }

  @Post('users/:id/suspend')
  suspend(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendDto,
  ) {
    return this.admin.suspend(admin, id, true, dto.reason);
  }

  @Post('users/:id/unsuspend')
  unsuspend(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendDto,
  ) {
    return this.admin.suspend(admin, id, false, dto.reason);
  }

  @Post('users/:id/kyc/override')
  overrideKyc(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: KycOverrideDto,
  ) {
    return this.compliance.adminOverride(admin, id, dto.status, dto.reason);
  }

  @Get('transfers')
  listTransfers(
    @Query('status') status: TransferStatus | undefined,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.admin.listTransfers(status, page, Math.min(pageSize, 100));
  }

  @Get('transfers/:id')
  getTransfer(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getTransfer(id);
  }

  @Post('transfers/:id/force-fail')
  forceFail(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ForceFailDto,
  ) {
    return this.transfers.adminForceFail(admin, id, dto.reason);
  }

  @Get('audit')
  listAudit(
    @Query('userId') userId: string | undefined,
    @Query('action') action: string | undefined,
    @Query('entityType') entityType: string | undefined,
    @Query('entityId') entityId: string | undefined,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe) pageSize: number,
  ) {
    return this.admin.listAudit(
      { userId, action, entityType, entityId },
      page,
      Math.min(pageSize, 200),
    );
  }

  @Get('corridors')
  listCorridors() {
    return this.admin.listCorridors();
  }

  @Patch('corridors/:id')
  updateCorridor(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCorridorDto,
  ) {
    return this.admin.updateCorridor(id, dto, admin);
  }
}
