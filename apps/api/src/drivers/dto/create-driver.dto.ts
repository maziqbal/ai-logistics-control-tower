import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDriverDto {
  @ApiProperty({
    description: 'Full name of the driver',
    example: 'Alex Driver',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Whether the driver is active',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
