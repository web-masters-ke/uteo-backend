import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto, AddMemberDto } from './dto/departments.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly svc: DepartmentsService) {}

  /** Create a new department — admins can pass firmId, trainers use their own */
  @Post()
  create(
    @CurrentUser('id') uid: string,
    @CurrentUser('role') role: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(role);
    const firmId = isAdmin && (dto as any).firmId ? (dto as any).firmId : uid;
    return this.svc.create(firmId, isAdmin ? firmId : uid, dto);
  }

  /** List departments — admins can query any org via ?firmId= */
  @Get()
  list(
    @CurrentUser('id') uid: string,
    @CurrentUser('role') role: string,
    @Query('firmId') queryFirmId?: string,
  ) {
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(role);
    const firmId = isAdmin && queryFirmId ? queryFirmId : uid;
    return this.svc.list(firmId);
  }

  /** Get department with members */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  getOne(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
  ) {
    return this.svc.getOne(id, uid);
  }

  /** Update department (name, description, leadId, isActive, sortOrder) */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  update(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.svc.update(id, uid, uid, dto);
  }

  /** Delete department */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  remove(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
  ) {
    return this.svc.remove(id, uid, uid);
  }

  /** Add a team member to a department */
  @Post(':id/members')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  addMember(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.svc.addMember(id, uid, uid, dto.memberId);
  }

  /** Remove a member from a department */
  @Delete(':id/members/:memberId')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') uid: string,
  ) {
    return this.svc.removeMember(id, uid, uid, memberId);
  }
}
