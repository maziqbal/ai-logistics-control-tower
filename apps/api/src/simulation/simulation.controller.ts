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

import { SimulationRuntimeService } from './simulation-runtime.service';

@ApiTags('Simulations')
@Controller('api/v1/simulations')
export class SimulationController {
  constructor(private readonly simulationRuntime: SimulationRuntimeService) {}

  @Post(':routeId/start')
  @ApiOperation({
    summary: 'Start a live GPS simulation for a delivery route',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['speedMetersPerSecond'],
      properties: {
        speedMetersPerSecond: {
          type: 'number',
          example: 10,
          description: 'Simulated speed in meters per second',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid route ID or speed',
  })
  @ApiConflictResponse({
    description: 'A simulation already exists for this route',
  })
  start(
    @Param('routeId', new ParseUUIDPipe()) routeId: string,
    @Body('speedMetersPerSecond') speedMetersPerSecond: number,
  ) {
    return this.simulationRuntime.start(routeId, speedMetersPerSecond);
  }

  @Get(':routeId')
  @ApiOperation({
    summary: 'Get the current live GPS simulation snapshot',
  })
  @ApiNotFoundResponse({
    description: 'Simulation session not found',
  })
  get(@Param('routeId', new ParseUUIDPipe()) routeId: string) {
    return this.simulationRuntime.get(routeId);
  }

  @Post(':routeId/advance')
  @ApiOperation({
    summary: 'Manually advance the simulation',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['seconds'],
      properties: {
        seconds: {
          type: 'number',
          example: 5,
          description: 'Additional simulated seconds',
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
    return this.simulationRuntime.advance(routeId, seconds);
  }

  @Post(':routeId/pause')
  @ApiOperation({
    summary: 'Pause a running GPS simulation',
  })
  pause(@Param('routeId', new ParseUUIDPipe()) routeId: string) {
    return this.simulationRuntime.pause(routeId);
  }

  @Post(':routeId/resume')
  @ApiOperation({
    summary: 'Resume a paused GPS simulation',
  })
  resume(@Param('routeId', new ParseUUIDPipe()) routeId: string) {
    return this.simulationRuntime.resume(routeId);
  }

  @Post(':routeId/stop')
  @ApiOperation({
    summary: 'Stop an active GPS simulation',
  })
  stop(@Param('routeId', new ParseUUIDPipe()) routeId: string) {
    return this.simulationRuntime.stop(routeId);
  }
}
