import { Module } from '@nestjs/common';
import {
  NeedsProfileAuthController,
  RecommendationsController,
} from './needs-profile.controller';
import { NeedsProfileService } from './needs-profile.service';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [NeedsProfileAuthController, RecommendationsController],
  providers: [NeedsProfileService, PrismaService],
  exports: [NeedsProfileService],
})
export class NeedsProfileModule {}
