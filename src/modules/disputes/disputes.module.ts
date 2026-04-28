import { Module } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { EscrowModule } from '../escrow/escrow.module';
import { SlaModule } from '../sla/sla.module';
@Module({ imports: [EscrowModule, SlaModule], controllers: [DisputesController], providers: [DisputesService], exports: [DisputesService] })
export class DisputesModule {}
