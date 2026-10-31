import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { deliveryDays, parcels, routes, stops } from '../db/schema';
import { createTestDatabase } from '../db/testing/test-database';
import { ParcelsService } from './parcels.service';

describe('ParcelsService (integration)', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let pool: ReturnType<typeof createTestDatabase>['pool'];
  let service: ParcelsService;

  const createdDayIds: string[] = [];
  const createdRouteIds: string[] = [];
  const createdStopIds: string[] = [];
  const createdParcelIds: string[] = [];

  beforeAll(() => {
    const testDatabase = createTestDatabase();

    db = testDatabase.db;
    pool = testDatabase.pool;
    service = new ParcelsService(db);
  });

  afterAll(async () => {
    try {
      if (db) {
        // Delete children before parents.
        for (const id of createdParcelIds) {
          await db.delete(parcels).where(eq(parcels.id, id));
        }

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
        operatingArea: `parcels-test-${randomUUID()}`,
      })
      .returning();

    createdDayIds.push(day.id);
    return day;
  }

  async function createRoute(dayId: string) {
    const [route] = await db
      .insert(routes)
      .values({
        deliveryDayId: dayId,
      })
      .returning();

    createdRouteIds.push(route.id);
    return route;
  }

  async function createParcel(dayId: string) {
    const parcel = await service.create(dayId, {
      trackingNumber: `PKG-${randomUUID()}`,
      destination: 'Mannerheimintie 10, Helsinki',
      locationKey: `location-${randomUUID()}`,
      latitude: 60.1699,
      longitude: 24.9384,
    });

    createdParcelIds.push(parcel.id);
    return parcel;
  }

  async function createStop(dayId: string) {
    // Every stop must belong to a real route.
    const route = await createRoute(dayId);

    const [stop] = await db
      .insert(stops)
      .values({
        deliveryDayId: dayId,
        routeId: route.id,
        sequence: 1,
        locationKey: `stop-location-${randomUUID()}`,
        position: sql`ST_SetSRID(ST_MakePoint(24.9384, 60.1699), 4326)`,
      })
      .returning();

    createdStopIds.push(stop.id);
    return stop;
  }

  // --------------------------------------------------
  // ALT-020: Parcel creation and listing
  // --------------------------------------------------

  it('creates a pending unassigned parcel with correct PostGIS coordinates', async () => {
    const day = await createDay();

    const latitude = 60.1699;
    const longitude = 24.9384;

    const parcel = await service.create(day.id, {
      trackingNumber: `PKG-${randomUUID()}`,
      destination: 'Mannerheimintie 10, Helsinki',
      locationKey: 'helsinki-location-001',
      latitude,
      longitude,
    });

    createdParcelIds.push(parcel.id);

    expect(parcel).toMatchObject({
      deliveryDayId: day.id,
      stopId: null,
      destination: 'Mannerheimintie 10, Helsinki',
      locationKey: 'helsinki-location-001',
      status: 'pending',
      failureReason: null,
    });

    const [coordinates] = await db
      .select({
        longitude: sql<number>`ST_X(${parcels.position})`,
        latitude: sql<number>`ST_Y(${parcels.position})`,
        srid: sql<number>`ST_SRID(${parcels.position})`,
      })
      .from(parcels)
      .where(eq(parcels.id, parcel.id));

    expect(coordinates.longitude).toBeCloseTo(longitude, 5);
    expect(coordinates.latitude).toBeCloseTo(latitude, 5);
    expect(coordinates.srid).toBe(4326);
  });

  it('rejects creating a parcel for an unknown delivery day', async () => {
    await expect(
      service.create(randomUUID(), {
        trackingNumber: `PKG-${randomUUID()}`,
        destination: 'Helsinki',
        locationKey: 'location-001',
        latitude: 60.1699,
        longitude: 24.9384,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects duplicate tracking numbers across delivery days', async () => {
    const dayA = await createDay();
    const dayB = await createDay();

    const trackingNumber = `PKG-${randomUUID()}`;

    const firstParcel = await service.create(dayA.id, {
      trackingNumber,
      destination: 'Helsinki',
      locationKey: 'location-001',
      latitude: 60.1699,
      longitude: 24.9384,
    });

    createdParcelIds.push(firstParcel.id);

    await expect(
      service.create(dayB.id, {
        trackingNumber,
        destination: 'Espoo',
        locationKey: 'location-002',
        latitude: 60.2,
        longitude: 24.7,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('trims parcel text fields before saving', async () => {
    const day = await createDay();
    const trackingNumber = `PKG-${randomUUID()}`;

    const parcel = await service.create(day.id, {
      trackingNumber: `  ${trackingNumber}  `,
      destination: '  Mannerheimintie 10, Helsinki  ',
      locationKey: '  helsinki-location-001  ',
      latitude: 60.1699,
      longitude: 24.9384,
    });

    createdParcelIds.push(parcel.id);

    expect(parcel).toMatchObject({
      trackingNumber,
      destination: 'Mannerheimintie 10, Helsinki',
      locationKey: 'helsinki-location-001',
    });
  });

  it('lists parcels for a delivery day in tracking-number order', async () => {
    const day = await createDay();
    const otherDay = await createDay();

    const prefix = `PKG-${randomUUID()}`;

    for (const suffix of ['C', 'A', 'B']) {
      const parcel = await service.create(day.id, {
        trackingNumber: `${prefix}-${suffix}`,
        destination: `Helsinki destination ${suffix}`,
        locationKey: `location-${suffix}`,
        latitude: 60.1699,
        longitude: 24.9384,
      });

      createdParcelIds.push(parcel.id);
    }

    const otherParcel = await service.create(otherDay.id, {
      trackingNumber: `${prefix}-OTHER`,
      destination: 'Espoo',
      locationKey: 'other-location',
      latitude: 60.2,
      longitude: 24.7,
    });

    createdParcelIds.push(otherParcel.id);

    const result = await service.findByDeliveryDay(day.id);

    expect(result).toHaveLength(3);
    expect(result.map((parcel) => parcel.trackingNumber)).toEqual([
      `${prefix}-A`,
      `${prefix}-B`,
      `${prefix}-C`,
    ]);

    expect(result.every((parcel) => parcel.deliveryDayId === day.id)).toBe(
      true,
    );
  });

  it('returns an empty array when a delivery day has no parcels', async () => {
    const day = await createDay();

    const result = await service.findByDeliveryDay(day.id);

    expect(result).toEqual([]);
  });

  it('rejects listing parcels for an unknown delivery day', async () => {
    await expect(service.findByDeliveryDay(randomUUID())).rejects.toThrow(
      NotFoundException,
    );
  });

  // --------------------------------------------------
  // ALT-021: Parcel-to-stop assignment
  // --------------------------------------------------

  it('assigns a parcel to a stop on the same delivery day', async () => {
    const day = await createDay();
    const parcel = await createParcel(day.id);
    const stop = await createStop(day.id);

    const updated = await service.assignToStop(day.id, parcel.id, {
      stopId: stop.id,
    });

    expect(updated).toMatchObject({
      id: parcel.id,
      deliveryDayId: day.id,
      stopId: stop.id,
      status: 'pending',
      failureReason: null,
    });

    const [saved] = await db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcel.id));

    expect(saved.stopId).toBe(stop.id);
  });

  it('reassigns a parcel to another stop on the same day', async () => {
    const day = await createDay();
    const parcel = await createParcel(day.id);
    const firstStop = await createStop(day.id);
    const secondStop = await createStop(day.id);

    await service.assignToStop(day.id, parcel.id, {
      stopId: firstStop.id,
    });

    const updated = await service.assignToStop(day.id, parcel.id, {
      stopId: secondStop.id,
    });

    expect(updated.stopId).toBe(secondStop.id);

    const [saved] = await db
      .select({ stopId: parcels.stopId })
      .from(parcels)
      .where(eq(parcels.id, parcel.id));

    expect(saved.stopId).toBe(secondStop.id);
  });

  it('allows multiple parcels to share one stop', async () => {
    const day = await createDay();
    const stop = await createStop(day.id);
    const firstParcel = await createParcel(day.id);
    const secondParcel = await createParcel(day.id);

    const first = await service.assignToStop(day.id, firstParcel.id, {
      stopId: stop.id,
    });

    const second = await service.assignToStop(day.id, secondParcel.id, {
      stopId: stop.id,
    });

    expect(first.stopId).toBe(stop.id);
    expect(second.stopId).toBe(stop.id);
  });

  it('rejects assignment to a stop from another delivery day', async () => {
    const dayA = await createDay();
    const dayB = await createDay();

    const parcel = await createParcel(dayA.id);
    const stop = await createStop(dayB.id);

    await expect(
      service.assignToStop(dayA.id, parcel.id, {
        stopId: stop.id,
      }),
    ).rejects.toThrow(BadRequestException);

    const [saved] = await db
      .select({ stopId: parcels.stopId })
      .from(parcels)
      .where(eq(parcels.id, parcel.id));

    expect(saved.stopId).toBeNull();
  });

  it('rejects assignment for an unknown delivery day', async () => {
    await expect(
      service.assignToStop(randomUUID(), randomUUID(), {
        stopId: randomUUID(),
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects assignment for a missing parcel or a parcel from another day', async () => {
    const dayA = await createDay();
    const dayB = await createDay();

    const stop = await createStop(dayA.id);
    const otherParcel = await createParcel(dayB.id);

    await expect(
      service.assignToStop(dayA.id, randomUUID(), {
        stopId: stop.id,
      }),
    ).rejects.toThrow(NotFoundException);

    await expect(
      service.assignToStop(dayA.id, otherParcel.id, {
        stopId: stop.id,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects assignment to a nonexistent stop', async () => {
    const day = await createDay();
    const parcel = await createParcel(day.id);

    await expect(
      service.assignToStop(day.id, parcel.id, {
        stopId: randomUUID(),
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
