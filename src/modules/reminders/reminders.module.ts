import { Module } from '@nestjs/common';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { BrevoService } from '../../common/services/brevo.service';
import { BongaSmsService } from '../../common/services/bonga-sms.service';

@Module({
  controllers: [RemindersController],
  providers: [RemindersService, BrevoService, BongaSmsService],
  exports: [RemindersService],
})
export class RemindersModule {}
