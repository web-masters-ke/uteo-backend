import { Module } from '@nestjs/common';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [FollowsController],
  providers: [FollowsService, PrismaService],
  exports: [FollowsService],
})
export class FollowsModule {}
