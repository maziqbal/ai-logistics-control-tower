import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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

import { CreateStopDto } from './dto/create-stop.dto';
import { StopsService } from './stops.service';

@ApiTags('Stops')
@Controller('api/v1/routes/:routeId/stops')
export class StopsController {
  constructor(private readonly stopsService: StopsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a delivery stop on a draft route',
  })
  @ApiCreatedResponse({
    description: 'Delivery stop created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid route UUID or request body',
  })
  @ApiNotFoundResponse({
    description: 'Route not found',
  })
  @ApiConflictResponse({
    description: 'Route is not draft or stop sequence already exists',
  })
  create(
    @Param('routeId', new ParseUUIDPipe()) routeId: string,
    @Body() dto: CreateStopDto,
  ) {
    return this.stopsService.create(routeId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List delivery stops for a route in sequence order',
  })
  @ApiOkResponse({
    description: 'Delivery stops retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid route UUID',
  })
  @ApiNotFoundResponse({
    description: 'Route not found',
  })
  findByRoute(@Param('routeId', new ParseUUIDPipe()) routeId: string) {
    return this.stopsService.findByRoute(routeId);
  }
}
