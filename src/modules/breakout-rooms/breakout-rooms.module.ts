import { Module } from '@nestjs/common';
import { BreakoutRoomsController } from './breakout-rooms.controller';
import { BreakoutRoomsService } from './breakout-rooms.service';

@Module({
  controllers: [BreakoutRoomsController],
  providers: [BreakoutRoomsService],
  exports: [BreakoutRoomsService],
})
export class BreakoutRoomsModule {}
