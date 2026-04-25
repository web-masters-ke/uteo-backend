import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../common/services/prisma.service';
import { BrevoService } from '../../common/services/brevo.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, PrismaService, BrevoService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
