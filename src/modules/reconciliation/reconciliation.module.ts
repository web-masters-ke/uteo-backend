import { Module } from '@nestjs/common';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [ReconciliationController],
  providers: [ReconciliationService, PrismaService],
})
export class ReconciliationModule {}
