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

import { CreateDeliveryDayDto } from './dto/create-delivery-day.dto';
import { DeliveryDayResponseDto } from './dto/delivery-day-response.dto';
import { DeliveryDaysService } from './delivery-days.service';

@ApiTags('Delivery Days')
@Controller('api/v1/delivery-days')
export class DeliveryDaysController {
  constructor(private readonly deliveryDaysService: DeliveryDaysService) {}

  @Post()
  @ApiOperation({ summary: 'Create a delivery day' })
  @ApiCreatedResponse({
    description: 'Delivery day created',
    type: DeliveryDayResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request' })
  @ApiConflictResponse({ description: 'Delivery day already exists' })
  create(@Body() dto: CreateDeliveryDayDto) {
    return this.deliveryDaysService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List delivery days' })
  @ApiOkResponse({
    description: 'Delivery days retrieved',
    type: DeliveryDayResponseDto,
    isArray: true,
  })
  findAll() {
    return this.deliveryDaysService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a delivery day by ID' })
  @ApiOkResponse({
    description: 'Delivery day retrieved',
    type: DeliveryDayResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid UUID' })
  @ApiNotFoundResponse({ description: 'Delivery day not found' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.deliveryDaysService.findOne(id);
  }
}
