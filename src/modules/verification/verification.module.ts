import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { PrismaService } from '../../common/services/prisma.service';
@Module({ controllers: [VerificationController], providers: [VerificationService, PrismaService], exports: [VerificationService] })
export class VerificationModule {}
