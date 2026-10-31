import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { deliveryDays, parcels } from '../db/schema';
import { createTestDatabase } from '../db/testing/test-database';
import { ParcelsService } from './parcels.service';

describe('ParcelsService (integration)', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let pool: ReturnType<typeof createTestDatabase>['pool'];
  let service: ParcelsService;

  const createdDayIds: string[] = [];
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
        for (const id of createdParcelIds) {
          await db.delete(parcels).where(eq(parcels.id, id));
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
});
