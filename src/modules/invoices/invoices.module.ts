import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { BrevoService } from '../../common/services/brevo.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, BrevoService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
