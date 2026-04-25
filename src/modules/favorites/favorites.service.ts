import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { AddFavoriteDto, ListFavoritesDto } from './dto/favorites.dto';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async add(userId: string, dto: AddFavoriteDto) {
    // Verify trainer exists
    const trainer = await this.prisma.user.findUnique({ where: { id: dto.trainerId } });
    if (!trainer) throw new NotFoundException('Trainer not found');

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_trainerId: { userId, trainerId: dto.trainerId } },
    });
    if (existing) throw new ConflictException('Trainer already in favorites');

    return this.prisma.favorite.create({
      data: { userId, trainerId: dto.trainerId },
    });
  }

  async remove(userId: string, trainerId: string) {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_trainerId: { userId, trainerId } },
    });
    if (!existing) throw new NotFoundException('Favorite not found');

    await this.prisma.favorite.delete({
      where: { userId_trainerId: { userId, trainerId } },
    });
    return { message: 'Removed from favorites' };
  }

  async findAll(userId: string, dto: ListFavoritesDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FavoriteWhereInput = { userId };

    const [items, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: false,
        },
      }).then(async (favs) => {
        // Fetch trainer details for each favorite
        const trainerIds = favs.map((f) => f.trainerId);
        const trainers = await this.prisma.user.findMany({
          where: { id: { in: trainerIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            avatar: true,
            trainerProfile: {
              select: {
                rating: true,
                specialization: true,
                hourlyRate: true,
                currency: true,
              },
            },
          },
        });
        const trainerMap = new Map(trainers.map((t) => [t.id, t]));
        return favs.map((f) => ({
          id: f.id,
          trainerId: f.trainerId,
          createdAt: f.createdAt,
          trainer: trainerMap.get(f.trainerId) || null,
        }));
      }),
      this.prisma.favorite.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async check(userId: string, trainerId: string) {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_trainerId: { userId, trainerId } },
    });
    return { isFavorite: !!existing };
  }
}
