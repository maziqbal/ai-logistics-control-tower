import { randomUUID } from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import {
  DATABASE,
  DATABASE_URL,
  type AppDatabase,
} from '../src/db/database.types';
import { deliveryDays, drivers, routes, vehicles } from '../src/db/schema';

type RouteResponse = {
  id: string;
  deliveryDayId: string;
  driverId: string | null;
  vehicleId: string | null;
  status: string;
  version: number;
};

describe('Routes API (e2e)', () => {
  let app: INestApplication;
  let db: AppDatabase;

  const createdDayIds = new Set<string>();
  const createdDriverIds = new Set<string>();
  const createdVehicleIds = new Set<string>();
  const createdRouteIds = new Set<string>();

  beforeAll(async () => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;

    if (!testDatabaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for E2E tests');
    }

    if (new URL(testDatabaseUrl).pathname !== '/logistics_test') {
      throw new Error('E2E tests must use the logistics_test database');
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE_URL)
      .useValue(testDatabaseUrl)
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    db = moduleFixture.get<AppDatabase>(DATABASE);
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
      await app?.close();
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

    createdDayIds.add(day.id);
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

    createdDriverIds.add(driver.id);
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

    createdVehicleIds.add(vehicle.id);
    return vehicle;
  }

  async function createRoute(
    dayId: string,
    payload: Record<string, unknown> = {},
  ) {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${dayId}/routes`)
      .send(payload)
      .expect(201);

    const route = response.body as RouteResponse;
    createdRouteIds.add(route.id);

    return route;
  }

  it('POST creates an unassigned draft route', async () => {
    const day = await createDay();

    const route = await createRoute(day.id);

    expect(route).toMatchObject({
      deliveryDayId: day.id,
      driverId: null,
      vehicleId: null,
      status: 'draft',
      version: 1,
    });

    expect(route.id).toEqual(expect.any(String));
  });

  it('POST creates a route with an active driver and vehicle', async () => {
    const day = await createDay();
    const driver = await createDriver();
    const vehicle = await createVehicle();

    const route = await createRoute(day.id, {
      driverId: driver.id,
      vehicleId: vehicle.id,
    });

    expect(route).toMatchObject({
      deliveryDayId: day.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
      status: 'draft',
      version: 1,
    });
  });

  it('POST rejects an invalid delivery day UUID', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/delivery-days/not-a-uuid/routes')
      .send({})
      .expect(400);
  });

  it('POST returns 404 for an unknown delivery day', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${randomUUID()}/routes`)
      .send({})
      .expect(404);
  });

  it('POST rejects an invalid driver UUID', async () => {
    const day = await createDay();

    await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${day.id}/routes`)
      .send({ driverId: 'not-a-uuid' })
      .expect(400);
  });

  it('POST rejects an invalid vehicle UUID', async () => {
    const day = await createDay();

    await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${day.id}/routes`)
      .send({ vehicleId: 'not-a-uuid' })
      .expect(400);
  });

  it('POST rejects unexpected fields', async () => {
    const day = await createDay();

    await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${day.id}/routes`)
      .send({ unknownField: 'not allowed' })
      .expect(400);
  });

  it('POST returns 404 for an unknown driver', async () => {
    const day = await createDay();

    await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${day.id}/routes`)
      .send({ driverId: randomUUID() })
      .expect(404);
  });

  it('POST returns 404 for an unknown vehicle', async () => {
    const day = await createDay();

    await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${day.id}/routes`)
      .send({ vehicleId: randomUUID() })
      .expect(404);
  });

  it('POST rejects an inactive driver', async () => {
    const day = await createDay();
    const driver = await createDriver(false);

    await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${day.id}/routes`)
      .send({ driverId: driver.id })
      .expect(409);
  });

  it('POST rejects an inactive vehicle', async () => {
    const day = await createDay();
    const vehicle = await createVehicle(false);

    await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${day.id}/routes`)
      .send({ vehicleId: vehicle.id })
      .expect(409);
  });

  it('POST rejects duplicate driver assignments on the same day', async () => {
    const day = await createDay();
    const driver = await createDriver();

    await createRoute(day.id, { driverId: driver.id });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${day.id}/routes`)
      .send({ driverId: driver.id })
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
    });
  });

  it('POST rejects duplicate vehicle assignments on the same day', async () => {
    const day = await createDay();
    const vehicle = await createVehicle();

    await createRoute(day.id, { vehicleId: vehicle.id });

    await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${day.id}/routes`)
      .send({ vehicleId: vehicle.id })
      .expect(409);
  });

  it('POST allows the same driver on different delivery days', async () => {
    const dayA = await createDay();
    const dayB = await createDay();
    const driver = await createDriver();

    const routeA = await createRoute(dayA.id, { driverId: driver.id });
    const routeB = await createRoute(dayB.id, { driverId: driver.id });

    expect(routeA.driverId).toBe(driver.id);
    expect(routeB.driverId).toBe(driver.id);
  });

  it('GET lists routes for a delivery day', async () => {
    const day = await createDay();
    const otherDay = await createDay();

    const routeA = await createRoute(day.id);
    const routeB = await createRoute(day.id);
    const otherRoute = await createRoute(otherDay.id);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/delivery-days/${day.id}/routes`)
      .expect(200);

    const result = response.body as RouteResponse[];

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: routeA.id }),
        expect.objectContaining({ id: routeB.id }),
      ]),
    );

    expect(result.some((route) => route.id === otherRoute.id)).toBe(false);
  });

  it('GET returns an empty array for a day without routes', async () => {
    const day = await createDay();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/delivery-days/${day.id}/routes`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('GET rejects an invalid delivery day UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/delivery-days/not-a-uuid/routes')
      .expect(400);
  });

  it('GET returns 404 for an unknown delivery day', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/delivery-days/${randomUUID()}/routes`)
      .expect(404);
  });

  it('PATCH assigns a driver and vehicle to a draft route', async () => {
    const day = await createDay();
    const driver = await createDriver();
    const vehicle = await createVehicle();
    const route = await createRoute(day.id);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/routes/${route.id}/assignment`)
      .send({
        driverId: driver.id,
        vehicleId: vehicle.id,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: route.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
      status: 'draft',
      version: 2,
    });
  });

  it('PATCH clears an existing driver assignment', async () => {
    const day = await createDay();
    const driver = await createDriver();
    const vehicle = await createVehicle();
    const route = await createRoute(day.id, {
      driverId: driver.id,
      vehicleId: vehicle.id,
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/routes/${route.id}/assignment`)
      .send({ driverId: null })
      .expect(200);

    expect(response.body).toMatchObject({
      driverId: null,
      vehicleId: vehicle.id,
      version: 2,
    });
  });

  it('PATCH rejects an empty request', async () => {
    const day = await createDay();
    const route = await createRoute(day.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/routes/${route.id}/assignment`)
      .send({})
      .expect(400);
  });

  it('PATCH rejects invalid driver UUID', async () => {
    const day = await createDay();
    const route = await createRoute(day.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/routes/${route.id}/assignment`)
      .send({ driverId: 'invalid-uuid' })
      .expect(400);
  });

  it('PATCH rejects unknown route UUID', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/routes/${randomUUID()}/assignment`)
      .send({ driverId: null })
      .expect(404);
  });

  it('PATCH rejects an unknown driver', async () => {
    const day = await createDay();
    const route = await createRoute(day.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/routes/${route.id}/assignment`)
      .send({ driverId: randomUUID() })
      .expect(404);
  });

  it('PATCH rejects duplicate driver assignment on the same day', async () => {
    const day = await createDay();
    const driver = await createDriver();
    await createRoute(day.id, { driverId: driver.id });
    const route = await createRoute(day.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/routes/${route.id}/assignment`)
      .send({ driverId: driver.id })
      .expect(409);
  });

  it('PATCH rejects unexpected request fields', async () => {
    const day = await createDay();
    const route = await createRoute(day.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/routes/${route.id}/assignment`)
      .send({
        driverId: null,
        status: 'active',
      })
      .expect(400);
  });

  it.each(['ready', 'active', 'completed'] as const)(
    'PATCH rejects assignment changes when route status is %s',
    async (status) => {
      const day = await createDay();
      const driver = await createDriver();
      const route = await createRoute(day.id);

      // Simulate a route that has progressed beyond draft.
      await db.update(routes).set({ status }).where(eq(routes.id, route.id));

      await request(app.getHttpServer())
        .patch(`/api/v1/routes/${route.id}/assignment`)
        .send({ driverId: driver.id })
        .expect(409);

      // Verify the rejected request did not change the assignment.
      const [unchangedRoute] = await db
        .select()
        .from(routes)
        .where(eq(routes.id, route.id));

      expect(unchangedRoute).toMatchObject({
        driverId: null,
        status,
        version: 1,
      });
    },
  );
});
