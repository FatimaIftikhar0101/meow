import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CorridorsController } from './corridors.controller';
import { CorridorsService } from './corridors.service';

@Module({
  imports: [AuthModule],
  controllers: [CorridorsController],
  providers: [CorridorsService],
  exports: [CorridorsService],
})
export class CorridorsModule {}
