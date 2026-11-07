import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SimulationService } from './simulation.service';

@ApiTags('Simulations')
@Controller('api/v1/simulations')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post(':routeId/start')
  @ApiOperation({
    summary: 'Start a GPS simulation for a delivery route',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['speedMetersPerSecond'],
      properties: {
        speedMetersPerSecond: {
          type: 'number',
          example: 10,
          description: 'Simulated vehicle speed in meters per second',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid route ID or speed',
  })
  @ApiConflictResponse({
    description: 'Simulation already exists for this route',
  })
  start(
    @Param('routeId', new ParseUUIDPipe()) routeId: string,
    @Body('speedMetersPerSecond') speedMetersPerSecond: number,
  ) {
    return this.simulationService.start(routeId, speedMetersPerSecond);
  }

  @Get(':routeId')
  @ApiOperation({
    summary: 'Get the current GPS simulation snapshot',
  })
  @ApiNotFoundResponse({
    description: 'Simulation session not found',
  })
  get(@Param('routeId', new ParseUUIDPipe()) routeId: string) {
    return this.simulationService.get(routeId);
  }

  @Post(':routeId/advance')
  @ApiOperation({
    summary: 'Advance the simulation by a number of seconds',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['seconds'],
      properties: {
        seconds: {
          type: 'number',
          example: 5,
          description: 'Simulation time to advance, in seconds',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid advance duration',
  })
  @ApiConflictResponse({
    description: 'Simulation is not running',
  })
  advance(
    @Param('routeId', new ParseUUIDPipe()) routeId: string,
    @Body('seconds') seconds: number,
  ) {
    return this.simulationService.advance(routeId, seconds);
  }

  @Post(':routeId/pause')
  @ApiOperation({ summary: 'Pause a running simulation' })
  pause(@Param('routeId', new ParseUUIDPipe()) routeId: string) {
    return this.simulationService.pause(routeId);
  }

  @Post(':routeId/resume')
  @ApiOperation({ summary: 'Resume a paused simulation' })
  resume(@Param('routeId', new ParseUUIDPipe()) routeId: string) {
    return this.simulationService.resume(routeId);
  }

  @Post(':routeId/stop')
  @ApiOperation({ summary: 'Stop an active simulation' })
  stop(@Param('routeId', new ParseUUIDPipe()) routeId: string) {
    return this.simulationService.stop(routeId);
  }
}
