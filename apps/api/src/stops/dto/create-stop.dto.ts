import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateStopDto {
  @ApiProperty({
    description: 'Stop position within the route, starting at 1',
    example: 1,
    minimum: 1,
    type: Number,
  })
  @IsInt()
  @Min(1)
  sequence!: number;

  @ApiProperty({
    description: 'Nonempty identifier for the delivery location',
    example: 'helsinki-stop-001',
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
