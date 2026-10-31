import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class UpdateRouteAssignmentDto {
  @ApiPropertyOptional({
    description:
      'Driver UUID to assign, or null to clear the existing assignment',
    format: 'uuid',
    nullable: true,
  })
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsUUID()
  driverId?: string | null;

  @ApiPropertyOptional({
    description:
      'Vehicle UUID to assign, or null to clear the existing assignment',
    format: 'uuid',
    nullable: true,
  })
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsUUID()
  vehicleId?: string | null;
}
