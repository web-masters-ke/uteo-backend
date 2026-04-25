import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { DarajaService } from './daraja.service';
import { PrismaService } from '../../common/services/prisma.service';
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, DarajaService, PrismaService],
  exports: [PaymentsService, DarajaService],
})
export class PaymentsModule {}
