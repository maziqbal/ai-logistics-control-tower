import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateVehicleDto } from './create-vehicle.dto';

describe('CreateVehicleDto', () => {
  async function validateInput(input: Record<string, unknown>) {
    const dto = plainToInstance(CreateVehicleDto, input);
    return validate(dto);
  }

  it('accepts a valid registration number', async () => {
    const errors = await validateInput({
      registrationNumber: 'ABC-123',
    });

    expect(errors).toHaveLength(0);
  });

  it('trims whitespace from the registration number', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      registrationNumber: '  ABC-123  ',
    });

    expect(dto.registrationNumber).toBe('ABC-123');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty registration number', async () => {
    const errors = await validateInput({
      registrationNumber: '',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a whitespace-only registration number', async () => {
    const errors = await validateInput({
      registrationNumber: '   ',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing registration number', async () => {
    const errors = await validateInput({});

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-string registration number', async () => {
    const errors = await validateInput({
      registrationNumber: 123,
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts active=false', async () => {
    const errors = await validateInput({
      registrationNumber: 'ABC-123',
      active: false,
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects active as a string', async () => {
    const errors = await validateInput({
      registrationNumber: 'ABC-123',
      active: 'false',
    });

    expect(errors.length).toBeGreaterThan(0);
  });
});
