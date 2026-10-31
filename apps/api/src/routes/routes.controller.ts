import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UpdateRouteAssignmentDto } from './dto/update-route-assignment.dto';

import { CreateRouteDto } from './dto/create-route.dto';
import { RoutesService } from './routes.service';

@ApiTags('Routes')
@Controller('api/v1/delivery-days/:dayId/routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  @ApiOperation({ summary: 'List routes for a delivery day' })
  @ApiOkResponse({ description: 'Routes retrieved successfully' })
  @ApiBadRequestResponse({ description: 'Invalid delivery day UUID' })
  @ApiNotFoundResponse({ description: 'Delivery day not found' })
  findByDeliveryDay(@Param('dayId', new ParseUUIDPipe()) dayId: string) {
    return this.routesService.findByDeliveryDay(dayId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft route for a delivery day' })
  @ApiCreatedResponse({ description: 'Draft route created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid request or UUID' })
  @ApiNotFoundResponse({
    description: 'Delivery day, driver, or vehicle not found',
  })
  @ApiConflictResponse({
    description: 'Driver or vehicle is inactive or already assigned',
  })
  create(
    @Param('dayId', new ParseUUIDPipe()) dayId: string,
    @Body() dto: CreateRouteDto,
  ) {
    return this.routesService.create(dayId, dto);
  }

  @Patch('/api/v1/routes/:routeId/assignment')
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
