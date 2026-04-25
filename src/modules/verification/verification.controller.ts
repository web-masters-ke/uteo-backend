import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { CreateVerificationRequestDto, ReviewVerificationDto, ListVerificationRequestsDto, SubmitCredentialVerificationDto, ReviewCredentialDto } from './dto/verification.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('verification')
export class VerificationController {
  constructor(private readonly svc: VerificationService) {}

  @Post('request') create(@CurrentUser('id') uid: string, @Body() dto: CreateVerificationRequestDto) { return this.svc.createRequest(uid, dto); }

  /** Trainer: list my own credentials + verification requests + stats */
  @Get('my/credentials') myCredentials(@CurrentUser('id') uid: string) { return this.svc.myCredentials(uid); }

  @Get('requests') @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN') list(@Query() dto: ListVerificationRequestsDto) { return this.svc.listRequests(dto); }
  @Patch('requests/:id') @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN') review(@Param('id') id: string, @Body() dto: ReviewVerificationDto, @CurrentUser('id') aid: string) { return this.svc.review(id, dto, aid); }

  // Credential verification endpoints
  @Post('credential/:certificationId') submitCredential(@Param('certificationId') certId: string, @CurrentUser('id') uid: string, @Body() dto: SubmitCredentialVerificationDto) { return this.svc.submitCredentialForVerification(certId, uid, dto); }
  @Patch('credential/:certificationId/review') @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN') reviewCredential(@Param('certificationId') certId: string, @Body() dto: ReviewCredentialDto, @CurrentUser('id') aid: string) { return this.svc.reviewCredential(certId, dto, aid); }
  @Get('credentials') @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN') listCredentials(@Query() dto: ListVerificationRequestsDto) { return this.svc.listPendingCredentials(dto); }
  @Get('credentials/all') @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN') listAllCredentials(@Query() dto: ListVerificationRequestsDto) { return this.svc.listAllCredentials(dto); }
  @Get('credentials/stats') @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN') credentialStats() { return this.svc.credentialStats(); }
}
