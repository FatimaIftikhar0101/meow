import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConvertQueryDto } from './dto/convert-query.dto';
import { CorridorsService } from './corridors.service';

@Controller('corridors')
@UseGuards(JwtAuthGuard)
export class CorridorsController {
  constructor(private readonly corridors: CorridorsService) {}

  @Get()
  list() {
    return this.corridors.list();
  }

  @Get('convert')
  convert(@Query() query: ConvertQueryDto) {
    return this.corridors.convert(query.from, query.to, query.amount);
  }
}
