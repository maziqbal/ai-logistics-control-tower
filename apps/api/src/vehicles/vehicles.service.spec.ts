import { randomUUID } from 'node:crypto';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { vehicles } from '../db/schema';
import { createTestDatabase } from '../db/testing/test-database';
import { VehiclesService } from './vehicles.service';

describe('VehiclesService (integration)', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let pool: ReturnType<typeof createTestDatabase>['pool'];

  let service: VehiclesService;

  const createdVehicleIds: string[] = [];

  beforeAll(() => {
    const testDatabase = createTestDatabase();

    db = testDatabase.db;
    pool = testDatabase.pool;

    service = new VehiclesService(db);
  });

  afterAll(async () => {
    try {
      if (db) {
        for (const id of createdVehicleIds) {
          await db.delete(vehicles).where(eq(vehicles.id, id));
        }
      }
    } finally {
      await pool?.end();
    }
  });

  it('creates a vehicle with active=true by default', async () => {
    const vehicle = await service.create({
      registrationNumber: `TEST-${randomUUID()}`,
    });

    createdVehicleIds.push(vehicle.id);

    expect(vehicle.id).toEqual(expect.any(String));
    expect(vehicle.active).toBe(true);
  });

  it('creates an inactive vehicle when active=false', async () => {
    const vehicle = await service.create({
      registrationNumber: `TEST-${randomUUID()}`,
      active: false,
    });

    createdVehicleIds.push(vehicle.id);

    expect(vehicle.active).toBe(false);
  });

  it('retrieves a vehicle by ID', async () => {
    const registrationNumber = `TEST-${randomUUID()}`;

    const created = await service.create({
      registrationNumber,
    });

    createdVehicleIds.push(created.id);

    const found = await service.findOne(created.id);

    expect(found).toMatchObject({
      id: created.id,
      registrationNumber,
      active: true,
    });
  });

  it('lists vehicles', async () => {
    const created = await service.create({
      registrationNumber: `TEST-${randomUUID()}`,
    });

    createdVehicleIds.push(created.id);

    const result = await service.findAll();

    expect(result).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id })]),
    );
  });

  it('rejects duplicate registration numbers with ConflictException', async () => {
    const registrationNumber = `TEST-${randomUUID()}`;

    const created = await service.create({
      registrationNumber,
    });

    createdVehicleIds.push(created.id);

    await expect(service.create({ registrationNumber })).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws NotFoundException for an unknown vehicle', async () => {
    await expect(service.findOne(randomUUID())).rejects.toThrow(
      NotFoundException,
    );
  });
});
