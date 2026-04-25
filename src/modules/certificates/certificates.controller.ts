import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  IssueCertificateDto,
  ListMyCertificatesDto,
  RevokeCertificateDto,
} from './dto/certificates.dto';

@Controller()
export class CertificatesController {
  constructor(private readonly svc: CertificatesService) {}

  @Get('certificates/my')
  listMy(
    @CurrentUser('id') uid: string,
    @Query() query: ListMyCertificatesDto,
  ) {
    return this.svc.listMy(uid, query);
  }

  // Public verification must be declared BEFORE the generic :id route so Nest
  // does not match the word "verify" as an :id param.
  @Public()
  @Get('certificates/verify/:code')
  verify(@Param('code') code: string) {
    return this.svc.getByCode(code);
  }

  @Get('certificates/:id')
  getOne(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.getById(id, uid);
  }

  @Post('courses/:courseId/certificates/issue/:userId')
  async issue(
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: IssueCertificateDto = {},
  ) {
    await this.svc.assertCanIssue(courseId, actorId);
    return this.svc.issue(courseId, userId, actorId, { force: dto?.force });
  }

  @Post('certificates/:id/revoke')
  revoke(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
    @Body() dto: RevokeCertificateDto,
  ) {
    return this.svc.revoke(id, uid, dto);
  }
}
