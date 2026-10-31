import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateBy,
} from 'class-validator';

function isRealCalendarDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 2000 || year > 2099 || month < 1 || month > 12) {
    return false;
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return day >= 1 && day <= daysInMonth;
}

export class CreateDeliveryDayDto {
  @ApiProperty({
    example: '2026-11-02',
    description: 'Delivery service date in YYYY-MM-DD format',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @ValidateBy({
    name: 'isRealCalendarDate',
    validator: {
      validate: isRealCalendarDate,
      defaultMessage: () => 'serviceDate must be a real calendar date',
    },
  })
  serviceDate!: string;

  @ApiProperty({
    example: 'Helsinki',
    description: 'Operating area for the delivery day',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  operatingArea!: string;
}
