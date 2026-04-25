import { Module } from '@nestjs/common';
import { CommissionsController } from './commissions.controller';
import { CommissionsService } from './commissions.service';
import { PrismaService } from '../../common/services/prisma.service';
@Module({ controllers: [CommissionsController], providers: [CommissionsService, PrismaService], exports: [CommissionsService] })
export class CommissionsModule {}
