import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../../common/services/prisma.service';
import { BrevoService } from '../../common/services/brevo.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, PrismaService, BrevoService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
