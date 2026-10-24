import { randomUUID } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';

import {
  deliveryDays,
  drivers,
  parcels,
  routes,
  stops,
  vehicles,
} from '../schema';
import { createTestDatabase } from './test-database';
import { expectPostgresError } from './expect-postgres-error';

describe('Database constraints (integration)', () => {
  const { db, pool } = createTestDatabase();

  afterAll(async () => {
    await pool.end();
  });

  it('rejects assigning the same driver to two routes on one day', async () => {
    const dayId = randomUUID();
    const driverId = randomUUID();

    await db.insert(deliveryDays).values({
      id: dayId,
      serviceDate: '2026-10-24',
      operatingArea: `test-area-${dayId}`,
    });

    await db.insert(drivers).values({
      id: driverId,
      name: 'Test Driver',
    });

    try {
      await db.insert(routes).values({
        deliveryDayId: dayId,
        driverId,
      });

      await expectPostgresError(
        db.insert(routes).values({
          deliveryDayId: dayId,
          driverId,
        }),
        '23505',
      );
    } finally {
      await db.delete(routes).where(eq(routes.deliveryDayId, dayId));
      await db.delete(drivers).where(eq(drivers.id, driverId));
      await db.delete(deliveryDays).where(eq(deliveryDays.id, dayId));
    }
  });

  it('rejects assigning a parcel to a stop from another delivery day', async () => {
    const dayA = randomUUID();
    const dayB = randomUUID();
    const routeId = randomUUID();
    const stopId = randomUUID();
    const parcelId = randomUUID();

    await db.insert(deliveryDays).values([
      {
        id: dayA,
        serviceDate: '2026-10-24',
        operatingArea: `test-area-${dayA}`,
      },
      {
        id: dayB,
        serviceDate: '2026-10-25',
        operatingArea: `test-area-${dayB}`,
      },
    ]);

    try {
      await db.insert(routes).values({
        id: routeId,
        deliveryDayId: dayA,
      });

      await db.insert(stops).values({
        id: stopId,
        routeId,
        deliveryDayId: dayA,
        sequence: 1,
        locationKey: 'helsinki-test-location',
        position: { x: 24.9384, y: 60.1699 },
      });

      await db.insert(parcels).values({
        id: parcelId,
        deliveryDayId: dayB,
        trackingNumber: `TEST-${parcelId}`,
        destination: 'Test destination, Helsinki',
        locationKey: 'helsinki-test-location',
        position: { x: 24.9384, y: 60.1699 },
      });

      await expectPostgresError(
        db.update(parcels).set({ stopId }).where(eq(parcels.id, parcelId)),
        '23503',
      );

      const [savedParcel] = await db
        .select({ stopId: parcels.stopId })
        .from(parcels)
        .where(eq(parcels.id, parcelId));

      expect(savedParcel.stopId).toBeNull();
    } finally {
      await db.delete(parcels).where(eq(parcels.id, parcelId));
      await db.delete(stops).where(eq(stops.id, stopId));
      await db.delete(routes).where(eq(routes.id, routeId));
      await db.delete(deliveryDays).where(eq(deliveryDays.id, dayA));
      await db.delete(deliveryDays).where(eq(deliveryDays.id, dayB));
    }
  });

  it('allows swapping stop sequences within a transaction', async () => {
    const dayId = randomUUID();
    const routeId = randomUUID();
    const stopAId = randomUUID();
    const stopBId = randomUUID();

    await db.insert(deliveryDays).values({
      id: dayId,
      serviceDate: '2026-10-26',
      operatingArea: `test-area-${dayId}`,
    });

    try {
      await db.insert(routes).values({
        id: routeId,
        deliveryDayId: dayId,
      });

      await db.insert(stops).values([
        {
          id: stopAId,
          routeId,
          deliveryDayId: dayId,
          sequence: 1,
          locationKey: 'stop-a',
          position: { x: 24.9384, y: 60.1699 },
        },
        {
          id: stopBId,
          routeId,
          deliveryDayId: dayId,
          sequence: 2,
          locationKey: 'stop-b',
          position: { x: 24.95, y: 60.18 },
        },
      ]);

      await db.transaction(async (tx) => {
        await tx.execute(
          sql`SET CONSTRAINTS stops_route_sequence_unique DEFERRED`,
        );

        await tx
          .update(stops)
          .set({ sequence: 2 })
          .where(eq(stops.id, stopAId));

        await tx
          .update(stops)
          .set({ sequence: 1 })
          .where(eq(stops.id, stopBId));
      });

      const updatedStops = await db
        .select({
          id: stops.id,
          sequence: stops.sequence,
        })
        .from(stops)
        .where(eq(stops.routeId, routeId));

      expect(updatedStops).toHaveLength(2);
      expect(updatedStops).toEqual(
        expect.arrayContaining([
          { id: stopAId, sequence: 2 },
          { id: stopBId, sequence: 1 },
        ]),
      );
    } finally {
      await db.delete(stops).where(eq(stops.routeId, routeId));
      await db.delete(routes).where(eq(routes.id, routeId));
      await db.delete(deliveryDays).where(eq(deliveryDays.id, dayId));
    }
  });

  it('rejects a point with an incorrect SRID', async () => {
    const dayId = randomUUID();
    const routeId = randomUUID();
    const stopId = randomUUID();

    await db.insert(deliveryDays).values({
      id: dayId,
      serviceDate: '2026-10-27',
      operatingArea: `test-area-${dayId}`,
    });

    try {
      await db.insert(routes).values({
        id: routeId,
        deliveryDayId: dayId,
      });

      // Keep this assertion generic until we verify PostGIS's SQLSTATE.
      await expect(
        db.execute(sql`
          INSERT INTO stops (
            id,
            route_id,
            delivery_day_id,
            sequence,
            location_key,
            position
          )
          VALUES (
            ${stopId},
            ${routeId},
            ${dayId},
            1,
            'invalid-srid-test',
            ST_SetSRID(ST_MakePoint(24.9384, 60.1699), 3857)
          )
        `),
      ).rejects.toThrow();

      const savedStops = await db
        .select({ id: stops.id })
        .from(stops)
        .where(eq(stops.id, stopId));

      expect(savedStops).toHaveLength(0);
    } finally {
      await db.delete(stops).where(eq(stops.id, stopId));
      await db.delete(routes).where(eq(routes.id, routeId));
      await db.delete(deliveryDays).where(eq(deliveryDays.id, dayId));
    }
  });

  it('enforces failure reasons based on parcel status', async () => {
    const dayId = randomUUID();
    const parcelId = randomUUID();

    await db.insert(deliveryDays).values({
      id: dayId,
      serviceDate: '2026-10-28',
      operatingArea: `test-area-${dayId}`,
    });

    try {
      await expectPostgresError(
        db.insert(parcels).values({
          id: parcelId,
          deliveryDayId: dayId,
          trackingNumber: `TEST-${parcelId}`,
          destination: 'Helsinki test address',
          locationKey: 'test-location',
          position: { x: 24.9384, y: 60.1699 },
          status: 'failed',
        }),
        '23514',
      );

      await db.insert(parcels).values({
        id: parcelId,
        deliveryDayId: dayId,
        trackingNumber: `TEST-${parcelId}`,
        destination: 'Helsinki test address',
        locationKey: 'test-location',
        position: { x: 24.9384, y: 60.1699 },
        status: 'failed',
        failureReason: 'Recipient unavailable',
      });

      await expectPostgresError(
        db
          .update(parcels)
          .set({ status: 'delivered' })
          .where(eq(parcels.id, parcelId)),
        '23514',
      );

      await db
        .update(parcels)
        .set({
          status: 'delivered',
          failureReason: null,
        })
        .where(eq(parcels.id, parcelId));

      const [savedParcel] = await db
        .select({
          status: parcels.status,
          failureReason: parcels.failureReason,
        })
        .from(parcels)
        .where(eq(parcels.id, parcelId));

      expect(savedParcel).toEqual({
        status: 'delivered',
        failureReason: null,
      });
    } finally {
      await db.delete(parcels).where(eq(parcels.id, parcelId));
      await db.delete(deliveryDays).where(eq(deliveryDays.id, dayId));
    }
  });

  it('rejects assigning the same vehicle to two routes on one day', async () => {
    const dayId = randomUUID();
    const vehicleId = randomUUID();

    await db.insert(deliveryDays).values({
      id: dayId,
      serviceDate: '2026-10-29',
      operatingArea: `test-area-${dayId}`,
    });

    await db.insert(vehicles).values({
      id: vehicleId,
      registrationNumber: `TEST-${vehicleId}`,
    });

    try {
      await db.insert(routes).values({
        deliveryDayId: dayId,
        vehicleId,
      });

      await expectPostgresError(
        db.insert(routes).values({
          deliveryDayId: dayId,
          vehicleId,
        }),
        '23505',
      );
    } finally {
      await db.delete(routes).where(eq(routes.deliveryDayId, dayId));
      await db.delete(vehicles).where(eq(vehicles.id, vehicleId));
      await db.delete(deliveryDays).where(eq(deliveryDays.id, dayId));
    }
  });
});
