import { Controller, Get, Param } from '@nestjs/common';
import { TranscriptsService } from './transcripts.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class TranscriptsController {
  constructor(private readonly svc: TranscriptsService) {}

  @Get('me/transcript')
  myTranscript(@CurrentUser('id') uid: string) {
    return this.svc.getTranscript(uid);
  }

  @Get('users/:id/transcript')
  userTranscript(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
    @CurrentUser('role') role: string,
  ) {
    return this.svc.getUserTranscript(id, uid, role);
  }
}
