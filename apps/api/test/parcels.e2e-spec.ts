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
import { deliveryDays, parcels } from '../src/db/schema';

describe('Parcels API (e2e)', () => {
  let app: INestApplication;
  let db: AppDatabase;

  const createdDayIds: string[] = [];
  const createdParcelIds: string[] = [];

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
        for (const id of createdParcelIds) {
          await db.delete(parcels).where(eq(parcels.id, id));
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

  async function createDay() {
    const [day] = await db
      .insert(deliveryDays)
      .values({
        serviceDate: '2026-11-02',
        operatingArea: `parcels-e2e-${randomUUID()}`,
      })
      .returning();

    createdDayIds.push(day.id);

    return day;
  }

  function validParcel() {
    return {
      trackingNumber: `PKG-${randomUUID()}`,
      destination: 'Mannerheimintie 10, Helsinki',
      locationKey: 'helsinki-location-001',
      latitude: 60.1699,
      longitude: 24.9384,
    };
  }

  it('POST creates a pending, unassigned parcel', async () => {
    const day = await createDay();
    const body = validParcel();

    const response = await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${day.id}/parcels`)
      .send(body)
      .expect(201);

    createdParcelIds.push(response.body.id);

    expect(response.body).toMatchObject({
      deliveryDayId: day.id,
      trackingNumber: body.trackingNumber,
      destination: body.destination,
      locationKey: body.locationKey,
      stopId: null,
      status: 'pending',
      failureReason: null,
    });
  });

  it('POST trims text fields', async () => {
    const day = await createDay();
    const body = validParcel();

    const response = await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${day.id}/parcels`)
      .send({
        ...body,
        trackingNumber: `  ${body.trackingNumber}  `,
        destination: `  ${body.destination}  `,
        locationKey: `  ${body.locationKey}  `,
      })
      .expect(201);

    createdParcelIds.push(response.body.id);

    expect(response.body).toMatchObject({
      trackingNumber: body.trackingNumber,
      destination: body.destination,
      locationKey: body.locationKey,
    });
  });

  it('GET returns parcels in tracking-number order', async () => {
    const day = await createDay();
    const prefix = `PKG-${randomUUID()}`;

    for (const suffix of ['C', 'A', 'B']) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/delivery-days/${day.id}/parcels`)
        .send({
          ...validParcel(),
          trackingNumber: `${prefix}-${suffix}`,
        })
        .expect(201);

      createdParcelIds.push(response.body.id);
    }

    const response = await request(app.getHttpServer())
      .get(`/api/v1/delivery-days/${day.id}/parcels`)
      .expect(200);

    expect(response.body).toHaveLength(3);

    expect(
      response.body.map(
        (parcel: { trackingNumber: string }) => parcel.trackingNumber,
      ),
    ).toEqual([`${prefix}-A`, `${prefix}-B`, `${prefix}-C`]);
  });

  it('GET returns an empty array for a day without parcels', async () => {
    const day = await createDay();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/delivery-days/${day.id}/parcels`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('GET only returns parcels belonging to the requested day', async () => {
    const dayA = await createDay();
    const dayB = await createDay();

    const bodyA = validParcel();
    const bodyB = validParcel();

    const first = await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${dayA.id}/parcels`)
      .send(bodyA)
      .expect(201);

    createdParcelIds.push(first.body.id);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${dayB.id}/parcels`)
      .send(bodyB)
      .expect(201);

    createdParcelIds.push(second.body.id);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/delivery-days/${dayA.id}/parcels`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].trackingNumber).toBe(bodyA.trackingNumber);
    expect(response.body[0].deliveryDayId).toBe(dayA.id);
  });

  it('POST returns 404 for an unknown delivery day', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${randomUUID()}/parcels`)
      .send(validParcel())
      .expect(404);
  });

  it('GET returns 404 for an unknown delivery day', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/delivery-days/${randomUUID()}/parcels`)
      .expect(404);
  });

  it('POST rejects an invalid delivery day UUID', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/delivery-days/not-a-uuid/parcels')
      .send(validParcel())
      .expect(400);
  });

  it('GET rejects an invalid delivery day UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/delivery-days/not-a-uuid/parcels')
      .expect(400);
  });

  it('POST rejects duplicate tracking numbers across days', async () => {
    const dayA = await createDay();
    const dayB = await createDay();
    const body = validParcel();

    const first = await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${dayA.id}/parcels`)
      .send(body)
      .expect(201);

    createdParcelIds.push(first.body.id);

    await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${dayB.id}/parcels`)
      .send(body)
      .expect(409);
  });

  it('POST rejects missing required fields', async () => {
    const day = await createDay();
    const body = validParcel();

    for (const field of [
      'trackingNumber',
      'destination',
      'locationKey',
      'latitude',
      'longitude',
    ] as const) {
      const invalidBody: Record<string, unknown> = { ...body };
      delete invalidBody[field];

      await request(app.getHttpServer())
        .post(`/api/v1/delivery-days/${day.id}/parcels`)
        .send(invalidBody)
        .expect(400);
    }
  });

  it('POST rejects whitespace-only text fields', async () => {
    const day = await createDay();

    for (const field of [
      'trackingNumber',
      'destination',
      'locationKey',
    ] as const) {
      await request(app.getHttpServer())
        .post(`/api/v1/delivery-days/${day.id}/parcels`)
        .send({
          ...validParcel(),
          [field]: '   ',
        })
        .expect(400);
    }
  });

  it('POST rejects coordinates outside valid ranges', async () => {
    const day = await createDay();

    for (const invalid of [
      { latitude: 91 },
      { latitude: -91 },
      { longitude: 181 },
      { longitude: -181 },
    ]) {
      await request(app.getHttpServer())
        .post(`/api/v1/delivery-days/${day.id}/parcels`)
        .send({
          ...validParcel(),
          ...invalid,
        })
        .expect(400);
    }
  });

  it('POST rejects coordinates supplied as strings', async () => {
    const day = await createDay();

    for (const invalid of [{ latitude: '60.1699' }, { longitude: '24.9384' }]) {
      await request(app.getHttpServer())
        .post(`/api/v1/delivery-days/${day.id}/parcels`)
        .send({
          ...validParcel(),
          ...invalid,
        })
        .expect(400);
    }
  });

  it('POST rejects unknown request fields', async () => {
    const day = await createDay();

    await request(app.getHttpServer())
      .post(`/api/v1/delivery-days/${day.id}/parcels`)
      .send({
        ...validParcel(),
        status: 'delivered',
      })
      .expect(400);
  });
});
