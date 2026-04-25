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
import { ApplicationsService } from './applications.service';
import {
  CreateApplicationDto,
  UpdateApplicationStatusDto,
  ListApplicationsDto,
} from './dto/applications.dto';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly svc: ApplicationsService) {}

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateApplicationDto) {
    return this.svc.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query() dto: ListApplicationsDto) {
    return this.svc.findAll(user.id, user.role, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.findOne(id, user.id, user.role);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.svc.updateStatus(id, user.id, dto);
  }

  @Delete(':id')
  withdraw(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.withdraw(id, user.id);
  }
}
