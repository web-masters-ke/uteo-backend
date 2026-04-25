import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto, ListCategoriesDto } from './dto/categories.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
@Controller('categories')
export class CategoriesController {
  constructor(private readonly svc: CategoriesService) {}
  @Public() @Get() findAll(@Query() dto: ListCategoriesDto) { return this.svc.findAll(dto); }
  @Public() @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id); }
  @Post() @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN') create(@Body() dto: CreateCategoryDto) { return this.svc.create(dto); }
  @Patch(':id') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN') update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) { return this.svc.update(id, dto); }
  @Delete(':id') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN') remove(@Param('id') id: string) { return this.svc.delete(id); }
}
