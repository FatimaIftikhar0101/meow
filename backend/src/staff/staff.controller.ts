import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  PermissionsGuard,
  RequirePermission,
} from '../auth/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffGuard } from '../auth/guards/staff.guard';
import { AssignRoleDto } from './dto/assign-role.dto';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { StaffReasonDto } from './dto/staff-reason.dto';
import { StaffService } from './staff.service';

/**
 * Managing the people who run the business, as opposed to the people who use
 * it. Same guard stack as the rest of the back office: staff to get through the
 * door, then a named capability per route.
 *
 * `staff.write` and `role.assign` are held only by `admin` in the permission
 * map, so a support or compliance token reaches nothing here — enforced there
 * rather than by another guard, which is the point of the map.
 */
@Controller('staff')
@UseGuards(JwtAuthGuard, StaffGuard, PermissionsGuard)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @RequirePermission('staff.read')
  list() {
    return this.staff.list();
  }

  @Post('invite')
  @RequirePermission('staff.write')
  invite(@CurrentUser() actor: AuthUser, @Body() dto: InviteStaffDto) {
    return this.staff.invite(actor, dto);
  }

  @Patch(':id/role')
  @RequirePermission('role.assign')
  assignRole(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.staff.assignRole(actor, id, dto.role, dto.reason);
  }

  @Post(':id/deactivate')
  @RequirePermission('staff.write')
  deactivate(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StaffReasonDto,
  ) {
    return this.staff.setActive(actor, id, false, dto.reason);
  }

  @Post(':id/reactivate')
  @RequirePermission('staff.write')
  reactivate(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StaffReasonDto,
  ) {
    return this.staff.setActive(actor, id, true, dto.reason);
  }
}
