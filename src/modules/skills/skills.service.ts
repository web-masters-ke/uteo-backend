import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateSkillDto, UpdateSkillDto, ListSkillsDto } from './dto/skills.dto';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: ListSkillsDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 100;
    const skip = (page - 1) * limit;
    const where: Prisma.SkillWhereInput = {};
    if (dto.category) where.category = { contains: dto.category, mode: 'insensitive' };
    if (dto.search) where.name = { contains: dto.search, mode: 'insensitive' };
    if (dto.trainerType) where.trainerType = dto.trainerType;
    const [items, total] = await Promise.all([
      this.prisma.skill.findMany({ where, skip, take: limit, orderBy: { name: 'asc' }, include: { _count: { select: { trainers: true } } } }),
      this.prisma.skill.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async create(dto: CreateSkillDto) {
    const ex = await this.prisma.skill.findUnique({ where: { name: dto.name } });
    if (ex) throw new ConflictException('Skill already exists');
    return this.prisma.skill.create({ data: { name: dto.name, category: dto.category, trainerType: dto.trainerType, description: dto.description, icon: dto.icon, level: dto.level, isActive: dto.isActive ?? true, demand: dto.demand, tags: dto.tags || [] } });
  }

  async update(id: string, dto: UpdateSkillDto) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException('Skill not found');
    if (dto.name && dto.name !== skill.name) {
      const ex = await this.prisma.skill.findUnique({ where: { name: dto.name } });
      if (ex) throw new ConflictException('Skill name exists');
    }
    return this.prisma.skill.update({ where: { id }, data: { name: dto.name, category: dto.category, trainerType: dto.trainerType, description: dto.description, icon: dto.icon, level: dto.level, isActive: dto.isActive, demand: dto.demand, tags: dto.tags } });
  }

  async delete(id: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException('Skill not found');
    await this.prisma.trainerSkill.deleteMany({ where: { skillId: id } });
    await this.prisma.skill.delete({ where: { id } });
    return { message: 'Skill deleted' };
  }
}
