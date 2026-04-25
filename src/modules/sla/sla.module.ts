import { Module } from '@nestjs/common';
import { SlaController } from './sla.controller';
import { SlaService } from './sla.service';
import { PrismaService } from '../../common/services/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SlaController],
  providers: [SlaService, PrismaService],
  exports: [SlaService],
})
export class SlaModule {}
