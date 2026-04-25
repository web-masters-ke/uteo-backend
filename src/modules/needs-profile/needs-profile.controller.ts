import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { NeedsProfileService } from './needs-profile.service';
import {
  RecommendationsQueryDto,
  UpsertNeedsProfileDto,
} from './dto/needs-profile.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth/needs-profile')
export class NeedsProfileAuthController {
  constructor(private readonly svc: NeedsProfileService) {}

  @Get()
  get(@CurrentUser('id') userId: string) {
    return this.svc.get(userId);
  }

  @Put()
  upsert(@CurrentUser('id') userId: string, @Body() dto: UpsertNeedsProfileDto) {
    return this.svc.upsert(userId, dto);
  }
}

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly svc: NeedsProfileService) {}

  @Get('onboarding')
  onboarding(@CurrentUser('id') userId: string, @Query() q: RecommendationsQueryDto) {
    return this.svc.getOnboardingRecommendations(userId, { limit: q.limit });
  }

  @Get('trainers')
  trainers(@CurrentUser('id') userId: string, @Query() q: RecommendationsQueryDto) {
    return this.svc.getTrainerRecommendations(userId, { limit: q.limit });
  }

  @Get('courses')
  courses(@CurrentUser('id') userId: string, @Query() q: RecommendationsQueryDto) {
    return this.svc.getCourseRecommendations(userId, { limit: q.limit });
  }
}
