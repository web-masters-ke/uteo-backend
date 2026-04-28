import { Module } from '@nestjs/common';
import { SessionRecordingsController } from './session-recordings.controller';
import { JaasWebhookController } from './jaas-webhook.controller';
import { SessionRecordingsService } from './session-recordings.service';

@Module({
  controllers: [SessionRecordingsController, JaasWebhookController],
  providers: [SessionRecordingsService],
  exports: [SessionRecordingsService],
})
export class SessionRecordingsModule {}
