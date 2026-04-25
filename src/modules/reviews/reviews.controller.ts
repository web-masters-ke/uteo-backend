import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto, ListReviewsDto } from './dto/reviews.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly svc: ReviewsService) {}
  @Post() create(@CurrentUser('id') uid: string, @Body() dto: CreateReviewDto) { return this.svc.create(uid, dto); }
  @Public() @Get() findAll(@Query() dto: ListReviewsDto, @CurrentUser('role') role?: string) { return this.svc.findAll(dto, role); }
  @Get('stats/global') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN') getGlobalStats() { return this.svc.getGlobalStats(); }
  @Public() @Get('stats/:trainerId') getStats(@Param('trainerId') tid: string) { return this.svc.getTrainerStats(tid); }
  @Public() @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @CurrentUser('id') uid: string, @CurrentUser('role') role: string, @Body() dto: UpdateReviewDto) { return this.svc.update(id, uid, dto, role); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser('id') uid: string, @CurrentUser('role') role: string) { return this.svc.remove(id, uid, role); }
  @Patch(':id/hide') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN') hide(@Param('id') id: string) { return this.svc.hide(id); }
  @Patch(':id/show') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN') show(@Param('id') id: string) { return this.svc.show(id); }
  @Post(':id/respond') @UseGuards(RolesGuard) @Roles('TRAINER') respond(@Param('id') id: string, @CurrentUser('id') uid: string, @Body() body: { response: string }) { return this.svc.respondToReview(id, uid, body.response); }
}
