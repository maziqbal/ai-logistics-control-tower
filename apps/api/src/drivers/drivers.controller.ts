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
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CreateDriverDto } from './dto/create-driver.dto';
import { DriverResponseDto } from './dto/driver-response.dto';
import { DriversService } from './drivers.service';

@ApiTags('Drivers')
@Controller('api/v1/drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  @ApiOperation({ summary: 'Create a driver' })
  @ApiCreatedResponse({
    description: 'Driver created successfully',
    type: DriverResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid driver data' })
  create(@Body() dto: CreateDriverDto) {
    return this.driversService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all drivers' })
  @ApiOkResponse({
    description: 'Drivers retrieved successfully',
    type: DriverResponseDto,
    isArray: true,
  })
  findAll() {
    return this.driversService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a driver by ID' })
  @ApiOkResponse({
    description: 'Driver retrieved successfully',
    type: DriverResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid driver UUID' })
  @ApiNotFoundResponse({ description: 'Driver not found' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.driversService.findOne(id);
  }
}
