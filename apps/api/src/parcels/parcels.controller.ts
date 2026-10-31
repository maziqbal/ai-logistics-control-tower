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

import { CreateParcelDto } from './dto/create-parcel.dto';
import { ParcelsService } from './parcels.service';

@ApiTags('Parcels')
@Controller('api/v1/delivery-days/:dayId/parcels')
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a parcel for a delivery day',
  })
  @ApiCreatedResponse({
    description: 'Parcel created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid delivery day UUID or request body',
  })
  @ApiNotFoundResponse({
    description: 'Delivery day not found',
  })
  @ApiConflictResponse({
    description: 'Tracking number already exists',
  })
  create(
    @Param('dayId', new ParseUUIDPipe()) dayId: string,
    @Body() dto: CreateParcelDto,
  ) {
    return this.parcelsService.create(dayId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List parcels for a delivery day',
  })
  @ApiOkResponse({
    description: 'Parcels retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid delivery day UUID',
  })
  @ApiNotFoundResponse({
    description: 'Delivery day not found',
  })
  findByDeliveryDay(@Param('dayId', new ParseUUIDPipe()) dayId: string) {
    return this.parcelsService.findByDeliveryDay(dayId);
  }
}
