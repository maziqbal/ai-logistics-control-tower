import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { deliveryDays, routes, stops } from '../db/schema';
import { createTestDatabase } from '../db/testing/test-database';
import { StopsService } from './stops.service';

describe('StopsService (integration)', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let pool: ReturnType<typeof createTestDatabase>['pool'];
  let service: StopsService;

  const createdDayIds: string[] = [];
  const createdRouteIds: string[] = [];
  const createdStopIds: string[] = [];

  beforeAll(() => {
    const testDatabase = createTestDatabase();

    db = testDatabase.db;
    pool = testDatabase.pool;

    service = new StopsService(db);
  });

  afterAll(async () => {
    try {
      if (db) {
        // Delete children before their parent records.
        for (const id of createdStopIds) {
          await db.delete(stops).where(eq(stops.id, id));
        }

        for (const id of createdRouteIds) {
          await db.delete(routes).where(eq(routes.id, id));
        }

        for (const id of createdDayIds) {
          await db.delete(deliveryDays).where(eq(deliveryDays.id, id));
        }
      }
    } finally {
      await pool?.end();
    }
  }, 15000);

  async function createDay() {
    const [day] = await db
      .insert(deliveryDays)
      .values({
        serviceDate: '2026-11-02',
        operatingArea: `test-stops-${randomUUID()}`,
      })
      .returning();

    createdDayIds.push(day.id);
    return day;
  }

  async function createRoute() {
    const day = await createDay();

    const [route] = await db
      .insert(routes)
      .values({
        deliveryDayId: day.id,
      })
      .returning();

    createdRouteIds.push(route.id);
    return route;
  }

  it('creates a pending stop with the correct delivery day and GPS coordinates', async () => {
    const route = await createRoute();

    const latitude = 60.1699;
    const longitude = 24.9384;

    const stop = await service.create(route.id, {
      sequence: 1,
      locationKey: 'helsinki-stop-001',
      latitude,
      longitude,
    });

    createdStopIds.push(stop.id);

    expect(stop).toMatchObject({
      routeId: route.id,
      deliveryDayId: route.deliveryDayId,
      sequence: 1,
      locationKey: 'helsinki-stop-001',
      status: 'pending',
    });

    // Verify coordinates directly in PostGIS.
    const [coordinates] = await db
      .select({
        longitude: sql<number>`ST_X(${stops.position})`,
        latitude: sql<number>`ST_Y(${stops.position})`,
        srid: sql<number>`ST_SRID(${stops.position})`,
      })
      .from(stops)
      .where(eq(stops.id, stop.id));

    expect(coordinates.longitude).toBeCloseTo(longitude, 5);
    expect(coordinates.latitude).toBeCloseTo(latitude, 5);
    expect(coordinates.srid).toBe(4326);
  });

  it('rejects creating a stop for an unknown route', async () => {
    await expect(
      service.create(randomUUID(), {
        sequence: 1,
        locationKey: 'unknown-route-stop',
        latitude: 60.1699,
        longitude: 24.9384,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it.each(['ready', 'active', 'completed'] as const)(
    'rejects creating stops on a %s route',
    async (status) => {
      const route = await createRoute();

      await db.update(routes).set({ status }).where(eq(routes.id, route.id));

      await expect(
        service.create(route.id, {
          sequence: 1,
          locationKey: 'non-draft-stop',
          latitude: 60.1699,
          longitude: 24.9384,
        }),
      ).rejects.toThrow(ConflictException);
    },
  );

  it('rejects duplicate stop sequences within the same route', async () => {
    const route = await createRoute();

    const firstStop = await service.create(route.id, {
      sequence: 1,
      locationKey: 'first-stop',
      latitude: 60.1699,
      longitude: 24.9384,
    });

    createdStopIds.push(firstStop.id);

    await expect(
      service.create(route.id, {
        sequence: 1,
        locationKey: 'duplicate-sequence',
        latitude: 60.1701,
        longitude: 24.939,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('allows the same sequence number on different routes', async () => {
    const routeA = await createRoute();
    const routeB = await createRoute();

    const stopA = await service.create(routeA.id, {
      sequence: 1,
      locationKey: 'route-a-stop',
      latitude: 60.1699,
      longitude: 24.9384,
    });

    createdStopIds.push(stopA.id);

    const stopB = await service.create(routeB.id, {
      sequence: 1,
      locationKey: 'route-b-stop',
      latitude: 60.1701,
      longitude: 24.939,
    });

    createdStopIds.push(stopB.id);

    expect(stopA.sequence).toBe(1);
    expect(stopB.sequence).toBe(1);
    expect(stopA.routeId).not.toBe(stopB.routeId);
  });

  it('lists stops in ascending sequence order', async () => {
    const route = await createRoute();

    // Deliberately insert stops out of sequence.
    for (const sequence of [3, 1, 2]) {
      const stop = await service.create(route.id, {
        sequence,
        locationKey: `stop-${sequence}`,
        latitude: 60.1699,
        longitude: 24.9384,
      });

      createdStopIds.push(stop.id);
    }

    const result = await service.findByRoute(route.id);

    expect(result).toHaveLength(3);
    expect(result.map((stop) => stop.sequence)).toEqual([1, 2, 3]);
    expect(result.every((stop) => stop.routeId === route.id)).toBe(true);
  });

  it('returns an empty array when a route has no stops', async () => {
    const route = await createRoute();

    const result = await service.findByRoute(route.id);

    expect(result).toEqual([]);
  });

  it('rejects listing stops for an unknown route', async () => {
    await expect(service.findByRoute(randomUUID())).rejects.toThrow(
      NotFoundException,
    );
  });
});
