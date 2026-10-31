import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateRouteDto {
  @ApiPropertyOptional({
    description: 'Driver to assign to the route',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({
    description: 'Vehicle to assign to the route',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}
