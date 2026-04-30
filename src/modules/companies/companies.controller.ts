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
import { CompaniesService } from './companies.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  ListCompaniesDto,
  AddRecruiterDto,
  UpdateRecruiterDto,
} from './dto/companies.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly svc: CompaniesService) {}

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateCompanyDto) {
    return this.svc.create(user.id, dto, user.role);
  }

  @Public()
  @Get()
  findAll(@Query() dto: ListCompaniesDto) {
    return this.svc.findAll(dto);
  }

  @Get('mine')
  findMine(@CurrentUser() user: JwtUser) {
    return this.svc.findMine(user.id);
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
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.svc.update(id, user.id, dto, user.role);
  }

  @Post(':id/recruiters')
  addRecruiter(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: AddRecruiterDto,
  ) {
    return this.svc.addRecruiter(id, user.id, dto, user.role);
  }

  @Patch(':id/recruiters/:userId')
  updateRecruiter(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateRecruiterDto,
  ) {
    return this.svc.updateRecruiter(id, targetUserId, user.id, dto, user.role);
  }

  @Delete(':id/recruiters/:userId')
  removeRecruiter(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.svc.removeRecruiter(id, user.id, targetUserId, user.role);
  }
}
