import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { PrismaService } from '../../common/services/prisma.service';
import { BrevoService } from '../../common/services/brevo.service';

@Module({
  controllers: [TeamController],
  providers: [TeamService, PrismaService, BrevoService],
  exports: [TeamService],
})
export class TeamModule {}
