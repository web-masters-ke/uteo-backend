import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { DashboardController } from './dashboard.controller';
import { AdminService } from './admin.service';
@Module({ controllers: [AdminController, DashboardController], providers: [AdminService], exports: [AdminService] })
export class AdminModule {}
