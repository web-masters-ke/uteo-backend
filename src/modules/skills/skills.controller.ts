import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { CreateSkillDto, UpdateSkillDto, ListSkillsDto } from './dto/skills.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
@Controller('skills')
export class SkillsController {
  constructor(private readonly svc: SkillsService) {}
  @Public() @Get() findAll(@Query() dto: ListSkillsDto) { return this.svc.findAll(dto); }
  @Post() create(@Body() dto: CreateSkillDto) { return this.svc.create(dto); }
  @Patch(':id') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN') update(@Param('id') id: string, @Body() dto: UpdateSkillDto) { return this.svc.update(id, dto); }
  @Delete(':id') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN') remove(@Param('id') id: string) { return this.svc.delete(id); }
}
