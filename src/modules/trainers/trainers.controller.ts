import { Controller, Get, Post, Patch, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { TrainersService } from './trainers.service';
import { CreateTrainerProfileDto, UpdateTrainerProfileDto, ListTrainersDto, AddSkillsDto, AddCertificationDto, SetAvailabilityDto } from './dto/trainers.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('trainers')
export class TrainersController {
  constructor(private readonly svc: TrainersService) {}

  @Post('profile') createProfile(@CurrentUser('id') uid: string, @Body() dto: CreateTrainerProfileDto) { return this.svc.createProfile(uid, dto); }
  @Get('me/profile') getMyProfile(@CurrentUser('id') uid: string) { return this.svc.getMyProfile(uid); }
  @Get('certifications') listMyCerts(@CurrentUser('id') uid: string) { return this.svc.listMyCertifications(uid); }
  @Public() @Get() findAll(@Query() dto: ListTrainersDto) { return this.svc.findAll(dto); }
  @Public() @Get('by-type/:type') findByType(@Param('type') type: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.svc.findByType(type, Number(page) || 1, Number(limit) || 20); }
  @Get('recommend/for-me') recommend(@CurrentUser('id') uid: string, @Query() query: { skills?: string; category?: string; sessionType?: string; budget?: string; limit?: string }) { return this.svc.recommend(uid, { ...query, budget: query.budget ? Number(query.budget) : undefined, limit: query.limit ? Number(query.limit) : undefined }); }
  @Public() @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @CurrentUser('id') uid: string, @Body() dto: UpdateTrainerProfileDto) { return this.svc.update(id, uid, dto); }
  @Post(':id/skills') addSkills(@Param('id') id: string, @CurrentUser('id') uid: string, @Body() dto: AddSkillsDto) { return this.svc.addSkills(id, uid, dto); }
  @Delete(':id/skills/:skillId') removeSkill(@Param('id') id: string, @Param('skillId') sid: string, @CurrentUser('id') uid: string) { return this.svc.removeSkill(id, sid, uid); }
  @Post(':id/certifications') addCert(@Param('id') id: string, @CurrentUser('id') uid: string, @Body() dto: AddCertificationDto) { return this.svc.addCertification(id, uid, dto); }
  @Patch(':id/certifications/:certId') updateCert(@Param('id') id: string, @Param('certId') cid: string, @CurrentUser('id') uid: string, @Body() body: { documentUrl?: string }) { return this.svc.updateCertification(id, cid, uid, body); }
  @Delete(':id/certifications/:certId') removeCert(@Param('id') id: string, @Param('certId') cid: string, @CurrentUser('id') uid: string) { return this.svc.removeCertification(id, cid, uid); }
  @Post(':id/availability') setAvailability(@Param('id') id: string, @CurrentUser('id') uid: string, @Body() dto: SetAvailabilityDto) { return this.svc.setAvailability(id, uid, dto); }
  @Put(':id/availability') replaceAvailability(@Param('id') id: string, @CurrentUser('id') uid: string, @Body() dto: SetAvailabilityDto) { return this.svc.setAvailability(id, uid, dto); }
  @Public() @Get(':id/availability') getAvailability(@Param('id') id: string) { return this.svc.getAvailability(id); }
  @Public() @Get(':id/reviews') getReviews(@Param('id') id: string) { return this.svc.getReviews(id); }
  @Public() @Get(':id/organizations') getOrganizations(@Param('id') id: string) { return this.svc.getOrganizations(id); }
}
