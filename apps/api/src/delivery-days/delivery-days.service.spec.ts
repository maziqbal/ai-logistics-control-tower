import { randomUUID } from 'node:crypto';

import { ConflictException, NotFoundException } from '@nestjs/common';

import { createTestDatabase } from '../db/testing/test-database';
import { DeliveryDaysService } from './delivery-days.service';

describe('DeliveryDaysService integration', () => {
  const { db, pool } = createTestDatabase();
  const service = new DeliveryDaysService(db);

  afterAll(async () => {
    await pool.end();
  });

  it('creates and retrieves a delivery day', async () => {
    const operatingArea = `test-area-${randomUUID()}`;

    const created = await service.create({
      serviceDate: '2026-11-02',
      operatingArea,
    });

    expect(created.id).toBeDefined();
    expect(created.serviceDate).toBe('2026-11-02');
    expect(created.operatingArea).toBe(operatingArea);

    const found = await service.findOne(created.id);

    expect(found).toEqual(created);
  });

  it('rejects a duplicate date and operating area', async () => {
    const dto = {
      serviceDate: '2026-11-03',
      operatingArea: `test-area-${randomUUID()}`,
    };

    await service.create(dto);

    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 404 when a delivery day does not exist', async () => {
    await expect(service.findOne(randomUUID())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists persisted delivery days', async () => {
    const operatingArea = `test-area-${randomUUID()}`;

    const created = await service.create({
      serviceDate: '2026-11-04',
      operatingArea,
    });

    const result = await service.findAll();

    expect(result).toContainEqual(created);
  });
});
