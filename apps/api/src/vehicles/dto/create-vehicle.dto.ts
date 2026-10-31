import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({
    description: 'Unique registration number of the vehicle',
    example: 'ABC-123',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  registrationNumber!: string;

  @ApiPropertyOptional({
    description: 'Whether the vehicle is active',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
