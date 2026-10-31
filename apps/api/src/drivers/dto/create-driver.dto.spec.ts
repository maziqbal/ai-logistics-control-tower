import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateDriverDto } from './create-driver.dto';

describe('CreateDriverDto', () => {
  async function validateInput(input: Record<string, unknown>) {
    const dto = plainToInstance(CreateDriverDto, input);
    const errors = await validate(dto);

    return { dto, errors };
  }

  it('accepts a valid driver name', async () => {
    const { errors } = await validateInput({
      name: 'Alex Driver',
    });

    expect(errors).toHaveLength(0);
  });

  it('trims surrounding whitespace from the name', async () => {
    const { dto, errors } = await validateInput({
      name: '  Alex Driver  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Alex Driver');
  });

  it('rejects an empty name', async () => {
    const { errors } = await validateInput({
      name: '',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a whitespace-only name', async () => {
    const { errors } = await validateInput({
      name: '   ',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-string name', async () => {
    const { errors } = await validateInput({
      name: 123,
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts an optional boolean active flag', async () => {
    const { errors } = await validateInput({
      name: 'Alex Driver',
      active: false,
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean active flag', async () => {
    const { errors } = await validateInput({
      name: 'Alex Driver',
      active: 'false',
    });

    expect(errors.length).toBeGreaterThan(0);
  });
});
