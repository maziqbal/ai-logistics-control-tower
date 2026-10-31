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
import { vehicles } from '../src/db/schema';

describe('Vehicles API (e2e)', () => {
  let app: INestApplication;
  let db: AppDatabase;

  const createdVehicleIds = new Set<string>();

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
        for (const id of createdVehicleIds) {
          await db.delete(vehicles).where(eq(vehicles.id, id));
        }
      }
    } finally {
      await app?.close();
    }
  });

  async function createVehicle(active?: boolean) {
    const payload = {
      registrationNumber: `TEST-${randomUUID()}`,
      ...(active !== undefined ? { active } : {}),
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send(payload)
      .expect(201);

    const vehicle = response.body as {
      id: string;
      registrationNumber: string;
      active: boolean;
    };

    createdVehicleIds.add(vehicle.id);

    return { vehicle, payload };
  }

  it('POST creates a vehicle with active=true by default', async () => {
    const { vehicle, payload } = await createVehicle();

    expect(vehicle.id).toEqual(expect.any(String));
    expect(vehicle.registrationNumber).toBe(payload.registrationNumber);
    expect(vehicle.active).toBe(true);
  });

  it('POST creates an inactive vehicle', async () => {
    const { vehicle } = await createVehicle(false);

    expect(vehicle.active).toBe(false);
  });

  it('POST trims the registration number', async () => {
    const registrationNumber = `TEST-${randomUUID()}`;

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({ registrationNumber: `  ${registrationNumber}  ` })
      .expect(201);

    const vehicle = response.body as {
      id: string;
      registrationNumber: string;
    };

    createdVehicleIds.add(vehicle.id);

    expect(vehicle.registrationNumber).toBe(registrationNumber);
  });

  it('POST rejects a duplicate registration number', async () => {
    const { vehicle } = await createVehicle();

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({ registrationNumber: vehicle.registrationNumber })
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
    });
  });

  it('POST rejects a whitespace-only registration number', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({ registrationNumber: '   ' })
      .expect(400);
  });

  it('POST rejects a missing registration number', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({})
      .expect(400);
  });

  it('POST rejects a non-boolean active value', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        registrationNumber: `TEST-${randomUUID()}`,
        active: 'false',
      })
      .expect(400);
  });

  it('POST rejects unexpected fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .send({
        registrationNumber: `TEST-${randomUUID()}`,
        unknownField: 'not allowed',
      })
      .expect(400);
  });

  it('GET lists vehicles', async () => {
    const { vehicle } = await createVehicle();

    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: vehicle.id })]),
    );
  });

  it('GET retrieves a vehicle by ID', async () => {
    const { vehicle } = await createVehicle();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/vehicles/${vehicle.id}`)
      .expect(200);

    expect(response.body).toMatchObject(vehicle);
  });

  it('GET rejects an invalid UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/vehicles/not-a-uuid')
      .expect(400);
  });

  it('GET returns 404 for an unknown vehicle', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/vehicles/${randomUUID()}`)
      .expect(404);
  });
});
