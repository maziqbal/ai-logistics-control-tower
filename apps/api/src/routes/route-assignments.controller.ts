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
    summary: 'Update driver and vehicle assignments on a draft route',
  })
  @ApiOkResponse({
    description: 'Route assignment updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID or assignment request',
  })
  @ApiNotFoundResponse({
    description: 'Route, driver, or vehicle not found',
  })
  @ApiConflictResponse({
    description: 'Assignment conflict or route cannot be modified',
  })
  updateAssignment(
    @Param('routeId', new ParseUUIDPipe()) routeId: string,
    @Body() dto: UpdateRouteAssignmentDto,
  ) {
    return this.routesService.updateAssignment(routeId, dto);
  }
}
