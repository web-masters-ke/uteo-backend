import { Module } from '@nestjs/common';
import {
  NeedsProfileAuthController,
  RecommendationsController,
} from './needs-profile.controller';
import { NeedsProfileService } from './needs-profile.service';

@Module({
  controllers: [NeedsProfileAuthController, RecommendationsController],
  providers: [NeedsProfileService],
  exports: [NeedsProfileService],
})
export class NeedsProfileModule {}
