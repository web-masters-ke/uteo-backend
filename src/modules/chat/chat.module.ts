import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaService } from '../../common/services/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({ imports: [NotificationsModule], controllers: [ChatController], providers: [ChatService, PrismaService], exports: [ChatService] })
export class ChatModule {}
