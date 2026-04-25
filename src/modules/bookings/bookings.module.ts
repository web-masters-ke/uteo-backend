import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../../common/services/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { EscrowModule } from '../escrow/escrow.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({
  imports: [EscrowModule, WalletModule, NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService, PrismaService, RedisService],
  exports: [BookingsService],
})
export class BookingsModule {}
