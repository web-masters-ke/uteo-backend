import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../common/services/prisma.service';
import { BrevoService } from '../../common/services/brevo.service';
import { BongaSmsService } from '../../common/services/bonga-sms.service';
import { FcmService } from '../../common/services/fcm.service';
@Module({ controllers: [NotificationsController], providers: [NotificationsService, PrismaService, BrevoService, BongaSmsService, FcmService], exports: [NotificationsService] })
export class NotificationsModule {}
