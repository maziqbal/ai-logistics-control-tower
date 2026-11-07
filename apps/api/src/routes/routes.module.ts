import { Module } from '@nestjs/common';

import { StopsModule } from '../stops/stops.module';
import { RouteAssignmentsController } from './route-assignments.controller';
import { RouteGeometryController } from './route-geometry.controller';
import { RouteGeometryService } from './route-geometry.service';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  imports: [StopsModule],
  controllers: [
    RoutesController,
    RouteAssignmentsController,
    RouteGeometryController,
  ],
  providers: [RoutesService, RouteGeometryService],
})
export class RoutesModule {}