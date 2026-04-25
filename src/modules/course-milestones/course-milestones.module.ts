import { forwardRef, Module } from '@nestjs/common';
import { CourseMilestonesController } from './course-milestones.controller';
import { CourseMilestonesService } from './course-milestones.service';
import { PrismaService } from '../../common/services/prisma.service';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [forwardRef(() => CertificatesModule)],
  controllers: [CourseMilestonesController],
  providers: [CourseMilestonesService, PrismaService],
  exports: [CourseMilestonesService],
})
export class CourseMilestonesModule {}
