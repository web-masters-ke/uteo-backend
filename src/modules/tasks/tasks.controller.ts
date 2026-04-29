import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, ListTasksDto } from './dto/tasks.dto';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('tasks')
export class TasksController {
  constructor(private readonly svc: TasksService) {}

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateTaskDto) {
    return this.svc.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query() dto: ListTasksDto) {
    return this.svc.findAll(user.id, user.role, dto);
  }

  @Get('me')
  findMine(@CurrentUser() user: JwtUser, @Query() dto: ListTasksDto) {
    return this.svc.findAll(user.id, user.role, { ...dto, mine: true });
  }

  @Get('stats')
  stats(@CurrentUser() user: JwtUser) {
    return this.svc.stats(user.id, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.svc.update(id, user.id, user.role, dto);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.complete(id, user.id, user.role);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.cancel(id, user.id, user.role);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.remove(id, user.id, user.role);
  }
}
