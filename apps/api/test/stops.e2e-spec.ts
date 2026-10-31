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
import { deliveryDays, routes, stops } from '../src/db/schema';

describe('Stops API (e2e)', () => {
  let app: INestApplication;
  let db: AppDatabase;

  const createdDayIds: string[] = [];
  const createdRouteIds: string[] = [];
  const createdStopIds: string[] = [];

  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL must be configured');
  }

  if (new URL(testDatabaseUrl).pathname !== '/logistics_test') {
    throw new Error('E2E tests must use logistics_test database');
  }

  beforeAll(async () => {
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
  }, 15000);

  afterAll(async () => {
    try {
      if (db) {
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
      if (app) {
        await app.close();
      }
    }
  }, 15000);

  async function createRoute() {
    const [day] = await db
      .insert(deliveryDays)
      .values({
        serviceDate: '2026-11-02',
        operatingArea: `stops-e2e-${randomUUID()}`,
      })
      .returning();

    createdDayIds.push(day.id);

    const [route] = await db
      .insert(routes)
      .values({
        deliveryDayId: day.id,
      })
      .returning();

    createdRouteIds.push(route.id);

    return route;
  }

  const validStop = {
    sequence: 1,
    locationKey: 'helsinki-stop-001',
    latitude: 60.1699,
    longitude: 24.9384,
  };

  it('POST creates a stop and returns 201', async () => {
    const route = await createRoute();

    const response = await request(app.getHttpServer())
      .post(`/api/v1/routes/${route.id}/stops`)
      .send(validStop)
      .expect(201);

    createdStopIds.push(response.body.id);

    expect(response.body).toMatchObject({
      routeId: route.id,
      deliveryDayId: route.deliveryDayId,
      sequence: 1,
      locationKey: 'helsinki-stop-001',
      status: 'pending',
    });
  });

  it('GET returns stops in ascending sequence order', async () => {
    const route = await createRoute();

    for (const sequence of [3, 1, 2]) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/routes/${route.id}/stops`)
        .send({
          ...validStop,
          sequence,
          locationKey: `stop-${sequence}`,
        })
        .expect(201);

      createdStopIds.push(response.body.id);
    }

    const response = await request(app.getHttpServer())
      .get(`/api/v1/routes/${route.id}/stops`)
      .expect(200);

    expect(response.body).toHaveLength(3);
    expect(
      response.body.map((stop: { sequence: number }) => stop.sequence),
    ).toEqual([1, 2, 3]);
  });

  it('GET returns an empty array for a route without stops', async () => {
    const route = await createRoute();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/routes/${route.id}/stops`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('POST returns 404 for an unknown route', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/routes/${randomUUID()}/stops`)
      .send(validStop)
      .expect(404);
  });

  it('GET returns 404 for an unknown route', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/routes/${randomUUID()}/stops`)
      .expect(404);
  });

  it('POST rejects an invalid route UUID', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/routes/not-a-uuid/stops')
      .send(validStop)
      .expect(400);
  });

  it('GET rejects an invalid route UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/routes/not-a-uuid/stops')
      .expect(400);
  });

  it('POST rejects zero and negative sequences', async () => {
    const route = await createRoute();

    for (const sequence of [0, -1]) {
      await request(app.getHttpServer())
        .post(`/api/v1/routes/${route.id}/stops`)
        .send({ ...validStop, sequence })
        .expect(400);
    }
  });

  it('POST rejects non-integer sequences', async () => {
    const route = await createRoute();

    await request(app.getHttpServer())
      .post(`/api/v1/routes/${route.id}/stops`)
      .send({ ...validStop, sequence: 1.5 })
      .expect(400);
  });

  it('POST rejects invalid coordinates', async () => {
    const route = await createRoute();

    const invalidCoordinates = [
      { latitude: 91 },
      { latitude: -91 },
      { longitude: 181 },
      { longitude: -181 },
    ];

    for (const invalid of invalidCoordinates) {
      await request(app.getHttpServer())
        .post(`/api/v1/routes/${route.id}/stops`)
        .send({ ...validStop, ...invalid })
        .expect(400);
    }
  });

  it('POST rejects missing required fields', async () => {
    const route = await createRoute();

    const invalidBodies = [
      { locationKey: 'test', latitude: 60, longitude: 24 },
      { sequence: 1, latitude: 60, longitude: 24 },
      { sequence: 1, locationKey: 'test', longitude: 24 },
      { sequence: 1, locationKey: 'test', latitude: 60 },
    ];

    for (const body of invalidBodies) {
      await request(app.getHttpServer())
        .post(`/api/v1/routes/${route.id}/stops`)
        .send(body)
        .expect(400);
    }
  });

  it('POST rejects unknown request fields', async () => {
    const route = await createRoute();

    await request(app.getHttpServer())
      .post(`/api/v1/routes/${route.id}/stops`)
      .send({ ...validStop, status: 'completed' })
      .expect(400);
  });

  it('POST rejects duplicate sequences on the same route', async () => {
    const route = await createRoute();

    const first = await request(app.getHttpServer())
      .post(`/api/v1/routes/${route.id}/stops`)
      .send(validStop)
      .expect(201);

    createdStopIds.push(first.body.id);

    await request(app.getHttpServer())
      .post(`/api/v1/routes/${route.id}/stops`)
      .send({
        ...validStop,
        locationKey: 'another-stop',
      })
      .expect(409);
  });

  it('POST rejects creating stops on a non-draft route', async () => {
    const route = await createRoute();

    await db
      .update(routes)
      .set({ status: 'ready' })
      .where(eq(routes.id, route.id));

    await request(app.getHttpServer())
      .post(`/api/v1/routes/${route.id}/stops`)
      .send(validStop)
      .expect(409);
  });

  it('POST rejects latitude and longitude supplied as strings', async () => {
    const route = await createRoute();

    for (const invalid of [{ latitude: '60.1699' }, { longitude: '24.9384' }]) {
      await request(app.getHttpServer())
        .post(`/api/v1/routes/${route.id}/stops`)
        .send({ ...validStop, ...invalid })
        .expect(400);
    }
  });

  it('POST rejects whitespace-only location keys', async () => {
    const route = await createRoute();

    await request(app.getHttpServer())
      .post(`/api/v1/routes/${route.id}/stops`)
      .send({
        ...validStop,
        locationKey: '   ',
      })
      .expect(400);
  });
});
