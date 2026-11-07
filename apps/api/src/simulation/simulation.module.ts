import { Module } from '@nestjs/common';

import { RoutesModule } from '../routes/routes.module';
import { SimulationController } from './simulation.controller';
import { SimulationService } from './simulation.service';
import { SimulationSessionManager } from './simulation-session.manager';

@Module({
  imports: [RoutesModule],
  controllers: [SimulationController],
  providers: [SimulationService, SimulationSessionManager],
})
export class SimulationModule {}
