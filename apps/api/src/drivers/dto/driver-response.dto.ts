import { ApiProperty } from '@nestjs/swagger';

export class DriverResponseDto {
  @ApiProperty({
    description: 'Unique driver identifier',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    description: 'Driver name',
    example: 'Alex Driver',
  })
  name!: string;

  @ApiProperty({
    description: 'Whether the driver is active',
    example: true,
  })
  active!: boolean;
}
