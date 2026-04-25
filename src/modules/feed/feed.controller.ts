import { Controller, Get, Post, Query } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedQueryDto } from './dto/feed.dto';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('feed')
export class FeedController {
  constructor(private readonly svc: FeedService) {}

  @Get()
  getFeed(@CurrentUser() user: JwtUser, @Query() dto: FeedQueryDto) {
    return this.svc.getFeed(user.id, dto);
  }

  @Post('refresh')
  refreshFeed(@CurrentUser() user: JwtUser) {
    return this.svc.refreshFeed(user.id);
  }
}
