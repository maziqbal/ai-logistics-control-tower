import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RouteGeometryService } from './route-geometry.service';

@ApiTags('Routes')
@Controller('api/v1/routes/:routeId/geometry')
export class RouteGeometryController {
  constructor(
    private readonly routeGeometryService: RouteGeometryService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get road-based geometry for a route',
  })
  @ApiOkResponse({
    description: 'Route geometry or insufficient-stops result',
  })
  @ApiBadRequestResponse({
    description: 'Invalid route UUID',
  })
  @ApiNotFoundResponse({
    description: 'Route not found',
  })
  @ApiBadGatewayResponse({
    description: 'OSRM routing service failed',
  })
  findByRoute(
    @Param('routeId', new ParseUUIDPipe()) routeId: string,
  ) {
    return this.routeGeometryService.findByRoute(routeId);
  }
}
