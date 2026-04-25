import { Module } from '@nestjs/common';
import { TranscriptsController } from './transcripts.controller';
import { TranscriptsService } from './transcripts.service';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [TranscriptsController],
  providers: [TranscriptsService, PrismaService],
  exports: [TranscriptsService],
})
export class TranscriptsModule {}
