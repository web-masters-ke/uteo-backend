import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateCategoryDto, UpdateCategoryDto, ListCategoriesDto } from './dto/categories.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: ListCategoriesDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 100;
    const skip = (page - 1) * limit;
    const where: Prisma.CategoryWhereInput = {};
    if (dto.search) where.name = { contains: dto.search, mode: 'insensitive' };
    if (dto.trainerType) where.trainerType = dto.trainerType;
    const [items, total] = await Promise.all([
      this.prisma.category.findMany({ where, skip, take: limit, orderBy: { sortOrder: 'asc' } }),
      this.prisma.category.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async findOne(id: string) {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }

  async create(dto: CreateCategoryDto) {
    const ex = await this.prisma.category.findUnique({ where: { name: dto.name } });
    if (ex) throw new ConflictException('Category exists');
    return this.prisma.category.create({
      data: { name: dto.name, description: dto.description, icon: dto.icon, isActive: dto.isActive ?? true, sortOrder: dto.sortOrder ?? 0, trainerType: dto.trainerType },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Category not found');
    if (dto.name && dto.name !== c.name) {
      const ex = await this.prisma.category.findUnique({ where: { name: dto.name } });
      if (ex) throw new ConflictException('Category name exists');
    }
    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name, description: dto.description, icon: dto.icon, isActive: dto.isActive, sortOrder: dto.sortOrder, trainerType: dto.trainerType },
    });
  }

  async delete(id: string) {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Category not found');
    await this.prisma.category.delete({ where: { id } });
    return { message: 'Category deleted' };
  }
}
