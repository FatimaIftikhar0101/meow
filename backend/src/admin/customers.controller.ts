import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
import { CustomersService } from './customers.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { RevealAccountDto } from './dto/reveal-account.dto';

/**
 * Customer 360 — the page support works from.
 *
 * Separate from `AdminController` because the permissions differ in kind, not
 * just in name: everything here is about one person's record, and one route
 * reaches PII that the rest of the panel is built to keep masked. Keeping that
 * route beside the others it belongs with makes the boundary something you can
 * see in a file listing.
 */
@Controller('admin/customers')
@UseGuards(JwtAuthGuard, StaffGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get(':id')
  @RequirePermission('customer.read')
  overview(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.overview(id);
  }

  /**
   * See one full account number.
   *
   * `customer.pii_full`, which only compliance holds — support gets the masked
   * view and cannot lift it. Audited with a mandatory reason; see
   * `CustomersService.reveal` for why the audit is written before the value is
   * returned rather than after.
   */
  @Post(':id/reveal')
  @RequirePermission('customer.pii_full')
  reveal(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevealAccountDto,
  ) {
    return this.customers.reveal(staff, id, dto);
  }

  @Get(':id/notes')
  @RequirePermission('customer.read')
  listNotes(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.listNotes(id);
  }

  @Post(':id/notes')
  @RequirePermission('customer.note')
  addNote(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.customers.addNote(staff, id, dto.body);
  }
}
