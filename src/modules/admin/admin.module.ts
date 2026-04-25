import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { DashboardController } from './dashboard.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../../common/services/prisma.service';
@Module({ controllers: [AdminController, DashboardController], providers: [AdminService, PrismaService], exports: [AdminService] })
export class AdminModule {}
