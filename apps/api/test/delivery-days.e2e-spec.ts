import { randomUUID } from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { DATABASE_URL } from '../src/db/database.types';

import { eq } from 'drizzle-orm';

import { DATABASE, type AppDatabase } from '../src/db/database.types';
import { deliveryDays } from '../src/db/schema';

describe('Delivery Days API (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let db: AppDatabase;

  const operatingArea = `e2e-${randomUUID()}`;
  const serviceDate = '2026-11-02';

  let createdId: string;

  beforeAll(async () => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;

    if (!testDatabaseUrl) {
      throw new Error('TEST_DATABASE_URL is required');
    }

    const url = new URL(testDatabaseUrl);

    if (
      (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') ||
      url.pathname !== '/logistics_test'
    ) {
      throw new Error('E2E tests must use logistics_test');
    }

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE_URL)
      .useValue(testDatabaseUrl)
      .compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    db = moduleRef.get<AppDatabase>(DATABASE);
  });

  afterAll(async () => {
    try {
      if (db && createdId) {
        await db.delete(deliveryDays).where(eq(deliveryDays.id, createdId));
      }
    } finally {
      await app?.close();
    }
  });

  it('POST /api/v1/delivery-days creates a delivery day', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/delivery-days')
      .send({ serviceDate, operatingArea })
      .expect(201);

    expect(response.body).toMatchObject({
      serviceDate,
      operatingArea,
    });

    expect(response.body.id).toEqual(expect.any(String));

    createdId = response.body.id;
  });

  it('POST returns 409 for a duplicate delivery day', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/delivery-days')
      .send({ serviceDate, operatingArea })
      .expect(409);
  });

  it('POST returns 400 for an impossible calendar date', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/delivery-days')
      .send({
        serviceDate: '2026-02-30',
        operatingArea,
      })
      .expect(400);
  });

  it('POST returns 400 for a blank operating area', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/delivery-days')
      .send({
        serviceDate,
        operatingArea: '   ',
      })
      .expect(400);
  });

  it('GET /api/v1/delivery-days lists delivery days', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/delivery-days')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: createdId })]),
    );
  });

  it('GET /api/v1/delivery-days/:id retrieves a delivery day', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/delivery-days/${createdId}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: createdId,
      serviceDate,
      operatingArea,
    });
  });

  it('GET returns 400 for an invalid UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/delivery-days/not-a-uuid')
      .expect(400);
  });

  it('GET returns 404 for a nonexistent delivery day', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/delivery-days/${randomUUID()}`)
      .expect(404);
  });
});
