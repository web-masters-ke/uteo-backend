import { Module } from '@nestjs/common';
import { BreakoutRoomsController } from './breakout-rooms.controller';
import { BreakoutRoomsService } from './breakout-rooms.service';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [BreakoutRoomsController],
  providers: [BreakoutRoomsService, PrismaService],
  exports: [BreakoutRoomsService],
})
export class BreakoutRoomsModule {}
