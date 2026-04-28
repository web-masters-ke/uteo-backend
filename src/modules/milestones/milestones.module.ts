import { Module } from '@nestjs/common';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';
import { WalletService } from '../wallet/wallet.service';
import { CommissionsModule } from '../commissions/commissions.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [CommissionsModule, PaymentsModule],
  controllers: [MilestonesController],
  providers: [MilestonesService, WalletService],
  exports: [MilestonesService],
})
export class MilestonesModule {}
