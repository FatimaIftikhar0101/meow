import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSupportMessageDto, CreateSupportTicketDto } from './dto/support.dto';
import { SupportService } from './support.service';

/** Customer-facing, authenticated help and support conversation routes. */
@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('help')
  help() {
    return this.support.publishedHelp();
  }

  @Get('tickets')
  list(@CurrentUser() customer: AuthUser) {
    return this.support.listMine(customer.id);
  }

  @Get('tickets/:id')
  get(
    @CurrentUser() customer: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.support.getMine(customer.id, id);
  }

  @Post('tickets')
  create(@CurrentUser() customer: AuthUser, @Body() dto: CreateSupportTicketDto) {
    return this.support.createTicket(customer, dto);
  }

  @Post('tickets/:id/messages')
  @HttpCode(HttpStatus.OK)
  reply(
    @CurrentUser() customer: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSupportMessageDto,
  ) {
    return this.support.replyAsCustomer(customer, id, dto.body);
  }
}
