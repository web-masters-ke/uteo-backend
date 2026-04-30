import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { DashboardController } from './dashboard.controller';
import { AdminService } from './admin.service';
import { S3Service } from '../../common/services/s3.service';
@Module({ controllers: [AdminController, DashboardController], providers: [AdminService, S3Service], exports: [AdminService] })
export class AdminModule {}
