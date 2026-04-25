import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../common/services/prisma.service';
@Module({ controllers: [CategoriesController], providers: [CategoriesService, PrismaService], exports: [CategoriesService] })
export class CategoriesModule {}
