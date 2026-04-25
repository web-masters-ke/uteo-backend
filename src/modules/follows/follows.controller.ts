import { Controller, Get, Post, Delete, Param, Query } from '@nestjs/common';
import { FollowsService } from './follows.service';
import { ListFollowsDto } from './dto/follows.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('users')
export class FollowsController {
  constructor(private readonly svc: FollowsService) {}

  @Post(':id/follow')
  follow(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.follow(uid, id);
  }

  @Delete(':id/follow')
  unfollow(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.unfollow(uid, id);
  }

  @Public()
  @Get(':id/followers')
  getFollowers(@Param('id') id: string, @Query() dto: ListFollowsDto) {
    return this.svc.getFollowers(id, dto);
  }

  @Public()
  @Get(':id/following')
  getFollowing(@Param('id') id: string, @Query() dto: ListFollowsDto) {
    return this.svc.getFollowing(id, dto);
  }

  @Public()
  @Get(':id/follow-stats')
  getStats(@Param('id') id: string) {
    return this.svc.getStats(id);
  }

  @Get(':id/is-following')
  isFollowing(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.isFollowing(uid, id);
  }
}
