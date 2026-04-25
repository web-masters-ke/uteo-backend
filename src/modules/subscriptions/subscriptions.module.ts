import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionBillingService } from './subscription-billing.service';
import { PrismaService } from '../../common/services/prisma.service';
import { WalletModule } from '../wallet/wallet.module';
@Module({
  imports: [WalletModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionBillingService, PrismaService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
