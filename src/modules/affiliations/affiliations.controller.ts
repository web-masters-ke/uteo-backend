import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AffiliationsService } from './affiliations.service';
import { CreateAffiliationDto, UpdateAffiliationDto, ListAffiliationsDto } from './dto/affiliations.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('affiliations')
export class AffiliationsController {
  constructor(private readonly svc: AffiliationsService) {}

  @Post()
  create(@CurrentUser('id') uid: string, @Body() dto: CreateAffiliationDto) {
    return this.svc.create(uid, dto);
  }

  @Get()
  findMine(@CurrentUser('id') uid: string, @Query() dto: ListAffiliationsDto) {
    return this.svc.findMine(uid, dto);
  }

  @Public()
  @Get('user/:userId')
  findByUser(@Param('userId') userId: string, @Query() dto: ListAffiliationsDto) {
    return this.svc.findByUser(userId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser('id') uid: string, @Body() dto: UpdateAffiliationDto) {
    return this.svc.update(id, uid, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.remove(id, uid);
  }

  @Patch(':id/verify')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  verify(@Param('id') id: string) {
    return this.svc.verify(id);
  }
}
