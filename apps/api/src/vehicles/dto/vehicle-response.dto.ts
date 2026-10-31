import { ApiProperty } from '@nestjs/swagger';

export class VehicleResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the vehicle',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Vehicle registration number',
    example: 'ABC-123',
  })
  registrationNumber!: string;

  @ApiProperty({
    description: 'Whether the vehicle is active',
    example: true,
  })
  active!: boolean;
}
