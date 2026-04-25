import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto, UpdateJobDto, JobFilterDto, InteractJobDto } from './dto/jobs.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('jobs')
export class JobsController {
  constructor(private readonly svc: JobsService) {}

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateJobDto) {
    return this.svc.create(user.id, dto);
  }

  @Public()
  @Get()
  findAll(@Query() dto: JobFilterDto) {
    return this.svc.findAll(dto);
  }

  // Saved jobs route must come BEFORE :id to avoid param collision
  @Get('saved')
  getSavedJobs(@CurrentUser() user: JwtUser) {
    return this.svc.getSavedJobs(user.id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateJobDto,
  ) {
    return this.svc.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.remove(id, user.id, user.role);
  }

  @Post(':id/save')
  saveJob(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.saveJob(id, user.id);
  }

  @Delete(':id/save')
  unsaveJob(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.unsaveJob(id, user.id);
  }

  @Post(':id/interact')
  interact(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: InteractJobDto,
  ) {
    return this.svc.interact(id, user.id, dto);
  }
}
