import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { BrevoService } from '../../common/services/brevo.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [NotificationsModule, TasksModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, BrevoService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
