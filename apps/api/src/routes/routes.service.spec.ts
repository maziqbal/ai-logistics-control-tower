import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { deliveryDays, drivers, routes, vehicles } from '../db/schema';
import { createTestDatabase } from '../db/testing/test-database';
import { RoutesService } from './routes.service';

describe('RoutesService (integration)', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let pool: ReturnType<typeof createTestDatabase>['pool'];
  let service: RoutesService;

  const createdDayIds: string[] = [];
  const createdDriverIds: string[] = [];
  const createdVehicleIds: string[] = [];
  const createdRouteIds: string[] = [];

  beforeAll(() => {
    const testDatabase = createTestDatabase();

    db = testDatabase.db;
    pool = testDatabase.pool;

    service = new RoutesService(db);
  });

  afterAll(async () => {
    try {
      if (db) {
        for (const id of createdRouteIds) {
          await db.delete(routes).where(eq(routes.id, id));
        }

        for (const id of createdDriverIds) {
          await db.delete(drivers).where(eq(drivers.id, id));
        }

        for (const id of createdVehicleIds) {
          await db.delete(vehicles).where(eq(vehicles.id, id));
        }

        for (const id of createdDayIds) {
          await db.delete(deliveryDays).where(eq(deliveryDays.id, id));
        }
      }
    } finally {
      await pool?.end();
    }
  });

  async function createDay() {
    const [day] = await db
      .insert(deliveryDays)
      .values({
        serviceDate: '2026-11-02',
        operatingArea: `test-area-${randomUUID()}`,
      })
      .returning();

    createdDayIds.push(day.id);
    return day;
  }

  async function createDriver(active = true) {
    const [driver] = await db
      .insert(drivers)
      .values({
        name: `Test Driver ${randomUUID()}`,
        active,
      })
      .returning();

    createdDriverIds.push(driver.id);
    return driver;
  }

  async function createVehicle(active = true) {
    const [vehicle] = await db
      .insert(vehicles)
      .values({
        registrationNumber: `TEST-${randomUUID()}`,
        active,
      })
      .returning();

    createdVehicleIds.push(vehicle.id);
    return vehicle;
  }

  it('creates an unassigned draft route with version 1', async () => {
    const day = await createDay();

    const route = await service.create(day.id, {});
    createdRouteIds.push(route.id);

    expect(route).toMatchObject({
      deliveryDayId: day.id,
      driverId: null,
      vehicleId: null,
      status: 'draft',
      version: 1,
    });
  });

  it('creates a draft route with an active driver and vehicle', async () => {
    const day = await createDay();
    const driver = await createDriver();
    const vehicle = await createVehicle();

    const route = await service.create(day.id, {
      driverId: driver.id,
      vehicleId: vehicle.id,
    });

    createdRouteIds.push(route.id);

    expect(route).toMatchObject({
      deliveryDayId: day.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
      status: 'draft',
      version: 1,
    });
  });

  it('rejects an unknown delivery day', async () => {
    await expect(service.create(randomUUID(), {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects an unknown driver', async () => {
    const day = await createDay();

    await expect(
      service.create(day.id, { driverId: randomUUID() }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects an unknown vehicle', async () => {
    const day = await createDay();

    await expect(
      service.create(day.id, { vehicleId: randomUUID() }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects an inactive driver', async () => {
    const day = await createDay();
    const driver = await createDriver(false);

    await expect(
      service.create(day.id, { driverId: driver.id }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects an inactive vehicle', async () => {
    const day = await createDay();
    const vehicle = await createVehicle(false);

    await expect(
      service.create(day.id, { vehicleId: vehicle.id }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects assigning the same driver twice on one day', async () => {
    const day = await createDay();
    const driver = await createDriver();

    const route = await service.create(day.id, {
      driverId: driver.id,
    });

    createdRouteIds.push(route.id);

    await expect(
      service.create(day.id, { driverId: driver.id }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects assigning the same vehicle twice on one day', async () => {
    const day = await createDay();
    const vehicle = await createVehicle();

    const route = await service.create(day.id, {
      vehicleId: vehicle.id,
    });

    createdRouteIds.push(route.id);

    await expect(
      service.create(day.id, { vehicleId: vehicle.id }),
    ).rejects.toThrow(ConflictException);
  });

  it('allows the same driver on different delivery days', async () => {
    const dayA = await createDay();
    const dayB = await createDay();
    const driver = await createDriver();

    const routeA = await service.create(dayA.id, {
      driverId: driver.id,
    });

    createdRouteIds.push(routeA.id);

    const routeB = await service.create(dayB.id, {
      driverId: driver.id,
    });

    createdRouteIds.push(routeB.id);

    expect(routeA.driverId).toBe(driver.id);
    expect(routeB.driverId).toBe(driver.id);
  });

  it('lists routes belonging to a delivery day', async () => {
    const day = await createDay();
    const otherDay = await createDay();

    const routeA = await service.create(day.id, {});
    const routeB = await service.create(day.id, {});
    const otherRoute = await service.create(otherDay.id, {});

    createdRouteIds.push(routeA.id, routeB.id, otherRoute.id);

    const result = await service.findByDeliveryDay(day.id);

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: routeA.id }),
        expect.objectContaining({ id: routeB.id }),
      ]),
    );

    expect(result.some((route) => route.id === otherRoute.id)).toBe(false);
  });

  it('returns an empty array when a delivery day has no routes', async () => {
    const day = await createDay();

    const result = await service.findByDeliveryDay(day.id);

    expect(result).toEqual([]);
  });

  it('rejects listing routes for an unknown delivery day', async () => {
    await expect(service.findByDeliveryDay(randomUUID())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('assigns a driver and vehicle to an existing draft route', async () => {
    const day = await createDay();
    const driver = await createDriver();
    const vehicle = await createVehicle();

    const route = await service.create(day.id, {});
    createdRouteIds.push(route.id);

    const updated = await service.updateAssignment(route.id, {
      driverId: driver.id,
      vehicleId: vehicle.id,
    });

    expect(updated).toMatchObject({
      id: route.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
      status: 'draft',
      version: 2,
    });
  });

  it('updates only the supplied assignment field', async () => {
    const day = await createDay();
    const driver = await createDriver();
    const vehicle = await createVehicle();

    const route = await service.create(day.id, {
      driverId: driver.id,
    });
    createdRouteIds.push(route.id);

    const updated = await service.updateAssignment(route.id, {
      vehicleId: vehicle.id,
    });

    expect(updated).toMatchObject({
      driverId: driver.id,
      vehicleId: vehicle.id,
      version: 2,
    });
  });

  it('clears a driver assignment without changing the vehicle', async () => {
    const day = await createDay();
    const driver = await createDriver();
    const vehicle = await createVehicle();

    const route = await service.create(day.id, {
      driverId: driver.id,
      vehicleId: vehicle.id,
    });
    createdRouteIds.push(route.id);

    const updated = await service.updateAssignment(route.id, {
      driverId: null,
    });

    expect(updated).toMatchObject({
      driverId: null,
      vehicleId: vehicle.id,
      version: 2,
    });
  });

  it('does not increment version when assignments are unchanged', async () => {
    const day = await createDay();
    const driver = await createDriver();

    const route = await service.create(day.id, {
      driverId: driver.id,
    });
    createdRouteIds.push(route.id);

    const updated = await service.updateAssignment(route.id, {
      driverId: driver.id,
    });

    expect(updated.version).toBe(1);
  });

  it('rejects an empty assignment update', async () => {
    const day = await createDay();

    const route = await service.create(day.id, {});
    createdRouteIds.push(route.id);

    await expect(service.updateAssignment(route.id, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an unknown route', async () => {
    await expect(
      service.updateAssignment(randomUUID(), { driverId: null }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects assigning an inactive driver', async () => {
    const day = await createDay();
    const driver = await createDriver(false);

    const route = await service.create(day.id, {});
    createdRouteIds.push(route.id);

    await expect(
      service.updateAssignment(route.id, { driverId: driver.id }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects assigning an inactive vehicle', async () => {
    const day = await createDay();
    const vehicle = await createVehicle(false);

    const route = await service.create(day.id, {});
    createdRouteIds.push(route.id);

    await expect(
      service.updateAssignment(route.id, { vehicleId: vehicle.id }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects assigning a driver already used on another route that day', async () => {
    const day = await createDay();
    const driver = await createDriver();

    const routeA = await service.create(day.id, {
      driverId: driver.id,
    });
    const routeB = await service.create(day.id, {});

    createdRouteIds.push(routeA.id, routeB.id);

    await expect(
      service.updateAssignment(routeB.id, { driverId: driver.id }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects assigning a vehicle already used on another route that day', async () => {
    const day = await createDay();
    const vehicle = await createVehicle();

    const routeA = await service.create(day.id, {
      vehicleId: vehicle.id,
    });
    const routeB = await service.create(day.id, {});

    createdRouteIds.push(routeA.id, routeB.id);

    await expect(
      service.updateAssignment(routeB.id, { vehicleId: vehicle.id }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects assignment changes on a non-draft route', async () => {
    const day = await createDay();
    const driver = await createDriver();

    const route = await service.create(day.id, {});
    createdRouteIds.push(route.id);

    await db
      .update(routes)
      .set({ status: 'ready' })
      .where(eq(routes.id, route.id));

    await expect(
      service.updateAssignment(route.id, { driverId: driver.id }),
    ).rejects.toThrow(ConflictException);
  });
});
