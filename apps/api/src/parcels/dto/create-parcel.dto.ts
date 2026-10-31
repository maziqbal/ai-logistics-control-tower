import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateParcelDto {
  @ApiProperty({
    description: 'Unique tracking number for the parcel',
    example: 'PKG-HEL-0001',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, {
    message: 'trackingNumber must contain a non-whitespace character',
  })
  trackingNumber!: string;

  @ApiProperty({
    description: 'Delivery destination address or description',
    example: 'Mannerheimintie 10, Helsinki',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, {
    message: 'destination must contain a non-whitespace character',
  })
  destination!: string;

  @ApiProperty({
    description: 'Identifier used to group parcels by delivery location',
    example: 'helsinki-location-001',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, {
    message: 'locationKey must contain a non-whitespace character',
  })
  locationKey!: string;

  @ApiProperty({
    description: 'Latitude in decimal degrees',
    example: 60.1699,
    minimum: -90,
    maximum: 90,
    type: Number,
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({
    description: 'Longitude in decimal degrees',
    example: 24.9384,
    minimum: -180,
    maximum: 180,
    type: Number,
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitude!: number;
}
