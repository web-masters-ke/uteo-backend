import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { BrevoService } from '../../common/services/brevo.service';

@Module({
  controllers: [TeamController],
  providers: [TeamService, BrevoService],
  exports: [TeamService],
})
export class TeamModule {}
