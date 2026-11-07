import { Module } from '@nestjs/common';

import { RoutesModule } from '../routes/routes.module';
import { SimulationController } from './simulation.controller';
import { SimulationGateway } from './simulation.gateway';
import { SimulationRuntimeService } from './simulation-runtime.service';
import { SimulationService } from './simulation.service';
import { SimulationSessionManager } from './simulation-session.manager';
import { SimulationTickerService } from './simulation-ticker.service';

@Module({
  imports: [RoutesModule],
  controllers: [SimulationController],
  providers: [
    SimulationService,
    SimulationSessionManager,
    SimulationTickerService,
    SimulationGateway,
    SimulationRuntimeService,
  ],
})
export class SimulationModule {}
