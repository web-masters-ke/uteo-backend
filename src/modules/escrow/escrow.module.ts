import { Module } from '@nestjs/common';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { PrismaService } from '../../common/services/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CommissionsModule } from '../commissions/commissions.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [CommissionsModule, PaymentsModule],
  controllers: [EscrowController],
  providers: [EscrowService, PrismaService, WalletService],
  exports: [EscrowService],
})
export class EscrowModule {}
