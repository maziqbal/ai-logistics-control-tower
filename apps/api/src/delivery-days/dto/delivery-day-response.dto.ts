import { ApiProperty } from '@nestjs/swagger';

export class DeliveryDayResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the delivery day',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Delivery service date',
    format: 'date',
    example: '2026-11-02',
  })
  serviceDate!: string;

  @ApiProperty({
    description: 'Operating area for the delivery day',
    example: 'Helsinki',
  })
  operatingArea!: string;
}
