import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateDeliveryDayDto } from './create-delivery-day.dto';

async function validateRequest(input: Record<string, unknown>) {
  const dto = plainToInstance(CreateDeliveryDayDto, input);
  const errors = await validate(dto);

  return { dto, errors };
}

describe('CreateDeliveryDayDto', () => {
  it('accepts a valid delivery day', async () => {
    const { errors } = await validateRequest({
      serviceDate: '2026-11-02',
      operatingArea: 'Helsinki',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects an impossible calendar date', async () => {
    const { errors } = await validateRequest({
      serviceDate: '2026-02-30',
      operatingArea: 'Helsinki',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid date format', async () => {
    const { errors } = await validateRequest({
      serviceDate: '02-11-2026',
      operatingArea: 'Helsinki',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a whitespace-only operating area', async () => {
    const { errors } = await validateRequest({
      serviceDate: '2026-11-02',
      operatingArea: '   ',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('trims the operating area', async () => {
    const { dto, errors } = await validateRequest({
      serviceDate: '2026-11-02',
      operatingArea: '  Helsinki  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.operatingArea).toBe('Helsinki');
  });

  it('rejects dates outside the supported range', async () => {
    const { errors } = await validateRequest({
      serviceDate: '1999-12-31',
      operatingArea: 'Helsinki',
    });

    expect(errors.length).toBeGreaterThan(0);
  });
});
