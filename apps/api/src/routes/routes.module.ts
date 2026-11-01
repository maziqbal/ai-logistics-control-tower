import { Module } from '@nestjs/common';

import { RouteAssignmentsController } from './route-assignments.controller';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  controllers: [RoutesController, RouteAssignmentsController],
  providers: [RoutesService],
})
export class RoutesModule {}