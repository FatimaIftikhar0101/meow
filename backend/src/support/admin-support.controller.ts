import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/guards/permissions.guard';
import { StaffGuard } from '../auth/guards/staff.guard';
import {
  CreateSupportCategoryDto,
  CreateSupportFaqDto,
  CreateSupportMessageDto,
  ListSupportTicketsDto,
  UpdateSupportCategoryDto,
  UpdateSupportFaqDto,
} from './dto/support.dto';
import { SupportService } from './support.service';

/** The shared support desk and its administrator-managed Help Centre. */
@Controller('admin/support')
@UseGuards(JwtAuthGuard, StaffGuard, PermissionsGuard)
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  @RequirePermission('support.ticket.manage')
  listTickets(@CurrentUser() staff: AuthUser, @Query() query: ListSupportTicketsDto) {
    return this.support.listForStaff(staff, query);
  }

  @Get('tickets/:id')
  @RequirePermission('support.ticket.manage')
  getTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.support.getForStaff(id);
  }

  @Post('tickets/:id/claim')
  @RequirePermission('support.ticket.manage')
  @HttpCode(HttpStatus.OK)
  claim(@CurrentUser() staff: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.support.claim(staff, id);
  }

  @Post('tickets/:id/unclaim')
  @RequirePermission('support.ticket.manage')
  @HttpCode(HttpStatus.OK)
  unclaim(@CurrentUser() staff: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.support.unclaim(staff, id);
  }

  @Post('tickets/:id/reply')
  @RequirePermission('support.ticket.manage')
  @HttpCode(HttpStatus.OK)
  reply(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSupportMessageDto,
  ) {
    return this.support.replyAsStaff(staff, id, dto.body);
  }

  @Post('tickets/:id/resolve')
  @RequirePermission('support.ticket.manage')
  @HttpCode(HttpStatus.OK)
  resolve(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSupportMessageDto,
  ) {
    return this.support.resolve(staff, id, dto.body);
  }

  @Get('help')
  @RequirePermission('faq.draft')
  help() {
    return this.support.manageHelp();
  }

  @Post('categories')
  @RequirePermission('faq.manage')
  createCategory(@CurrentUser() staff: AuthUser, @Body() dto: CreateSupportCategoryDto) {
    return this.support.createCategory(staff, dto);
  }

  @Patch('categories/:id')
  @RequirePermission('faq.manage')
  updateCategory(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportCategoryDto,
  ) {
    return this.support.updateCategory(staff, id, dto);
  }

  @Post('faqs')
  @RequirePermission('faq.draft')
  createFaq(@CurrentUser() staff: AuthUser, @Body() dto: CreateSupportFaqDto) {
    return this.support.createFaq(staff, dto);
  }

  @Patch('faqs/:id/draft')
  @RequirePermission('faq.draft')
  updateDraft(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportFaqDto,
  ) {
    return this.support.updateDraft(staff, id, dto);
  }

  @Patch('faqs/:id')
  @RequirePermission('faq.manage')
  updateFaq(
    @CurrentUser() staff: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportFaqDto,
  ) {
    return this.support.updateFaq(staff, id, dto);
  }

  @Post('faqs/:id/publish')
  @RequirePermission('faq.manage')
  @HttpCode(HttpStatus.OK)
  publish(@CurrentUser() staff: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.support.publishFaq(staff, id);
  }
}
