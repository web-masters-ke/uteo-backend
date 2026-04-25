import { Module } from '@nestjs/common';
import { TrainersController } from './trainers.controller';
import { TrainersService } from './trainers.service';
import { PrismaService } from '../../common/services/prisma.service';
@Module({ controllers: [TrainersController], providers: [TrainersService, PrismaService], exports: [TrainersService] })
export class TrainersModule {}
