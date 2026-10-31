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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleResponseDto } from './dto/vehicle-response.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('Vehicles')
@Controller('api/v1/vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new vehicle' })
  @ApiCreatedResponse({
    description: 'Vehicle created successfully',
    type: VehicleResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid vehicle data',
  })
  @ApiConflictResponse({
    description: 'Vehicle registration number already exists',
  })
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all vehicles' })
  @ApiOkResponse({
    description: 'List of vehicles',
    type: VehicleResponseDto,
    isArray: true,
  })
  findAll() {
    return this.vehiclesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a vehicle by ID' })
  @ApiOkResponse({
    description: 'Vehicle found',
    type: VehicleResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid vehicle UUID',
  })
  @ApiNotFoundResponse({
    description: 'Vehicle not found',
  })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.vehiclesService.findOne(id);
  }
}
