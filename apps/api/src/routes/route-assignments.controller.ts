import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { UpdateRouteAssignmentDto } from './dto/update-route-assignment.dto';
import { RoutesService } from './routes.service';

@ApiTags('Routes')
@Controller('api/v1/routes')
export class RouteAssignmentsController {
  constructor(private readonly routesService: RoutesService) {}

  @Patch(':routeId/assignment')
  @ApiOperation({
    summary: 'Assign or change a driver and vehicle on a draft route',
  })
  @ApiOkResponse({
    description: 'Route assignment updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID, request body, or empty assignment',
  })
  @ApiNotFoundResponse({
    description: 'Route, driver, or vehicle not found',
  })
  @ApiConflictResponse({
    description:
      'Route is not draft, resource is inactive, assignment conflicts, or route was modified concurrently',
  })
  updateAssignment(
    @Param('routeId', new ParseUUIDPipe()) routeId: string,
    @Body() dto: UpdateRouteAssignmentDto,
  ) {
    return this.routesService.updateAssignment(routeId, dto);
  }
}
