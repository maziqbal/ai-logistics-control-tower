import { randomUUID } from 'node:crypto';

import { NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';

import type { AppDatabase } from '../db/database.types';
import { drivers } from '../db/schema';
import { createTestDatabase } from '../db/testing/test-database';
import { DriversService } from './drivers.service';

describe('DriversService (integration)', () => {
  let db: AppDatabase;
  let pool: Pool;
  let service: DriversService;

  const createdDriverIds: string[] = [];

  beforeAll(async () => {
    const testDatabase = createTestDatabase();

    db = testDatabase.db;
    pool = testDatabase.pool;

    service = new DriversService(db);
  });

  afterAll(async () => {
    try {
      if (db) {
        for (const id of createdDriverIds) {
          await db.delete(drivers).where(eq(drivers.id, id));
        }
      }
    } finally {
      await pool?.end();
    }
  });

  it('creates a driver with active=true by default', async () => {
    const driver = await service.create({
      name: `Driver ${randomUUID()}`,
    });

    createdDriverIds.push(driver.id);

    expect(driver.id).toEqual(expect.any(String));
    expect(driver.active).toBe(true);
  });

  it('creates an inactive driver when active=false', async () => {
    const driver = await service.create({
      name: `Inactive ${randomUUID()}`,
      active: false,
    });

    createdDriverIds.push(driver.id);

    expect(driver.active).toBe(false);
  });

  it('retrieves a driver by ID', async () => {
    const name = `Driver ${randomUUID()}`;

    const created = await service.create({ name });
    createdDriverIds.push(created.id);

    const found = await service.findOne(created.id);

    expect(found).toMatchObject({
      id: created.id,
      name,
      active: true,
    });
  });

  it('lists drivers', async () => {
    const created = await service.create({
      name: `Driver ${randomUUID()}`,
    });

    createdDriverIds.push(created.id);

    const result = await service.findAll();

    expect(result).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id })]),
    );
  });

  it('throws NotFoundException for an unknown driver', async () => {
    await expect(service.findOne(randomUUID())).rejects.toThrow(
      NotFoundException,
    );
  });
});
