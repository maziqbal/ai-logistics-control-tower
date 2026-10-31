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
import { drivers } from '../src/db/schema';

describe('Drivers API (e2e)', () => {
  let app: INestApplication;
  let db: AppDatabase;

  const createdDriverIds = new Set<string>();

  beforeAll(async () => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;

    if (!testDatabaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for E2E tests');
    }

    const databaseName = new URL(testDatabaseUrl).pathname;

    if (databaseName !== '/logistics_test') {
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
        for (const id of createdDriverIds) {
          await db.delete(drivers).where(eq(drivers.id, id));
        }
      }
    } finally {
      await app?.close();
    }
  });

  const createDriver = async (active?: boolean) => {
    const payload = {
      name: `E2E Driver ${randomUUID()}`,
      ...(active !== undefined ? { active } : {}),
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/drivers')
      .send(payload)
      .expect(201);

    const driver = response.body as {
      id: string;
      name: string;
      active: boolean;
    };

    createdDriverIds.add(driver.id);

    return { driver, payload };
  };

  it('POST creates a driver with active=true by default', async () => {
    const { driver, payload } = await createDriver();

    expect(driver.id).toEqual(expect.any(String));
    expect(driver.name).toBe(payload.name);
    expect(driver.active).toBe(true);
  });

  it('POST creates an inactive driver', async () => {
    const { driver } = await createDriver(false);

    expect(driver.active).toBe(false);
  });

  it('POST trims the driver name', async () => {
    const name = `E2E Driver ${randomUUID()}`;

    const response = await request(app.getHttpServer())
      .post('/api/v1/drivers')
      .send({ name: `  ${name}  ` })
      .expect(201);

    const driver = response.body as {
      id: string;
      name: string;
    };

    createdDriverIds.add(driver.id);

    expect(driver.name).toBe(name);
  });

  it('POST rejects an empty driver name', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/drivers')
      .send({ name: '   ' })
      .expect(400);
  });

  it('POST rejects a non-boolean active value', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/drivers')
      .send({
        name: `E2E Driver ${randomUUID()}`,
        active: 'false',
      })
      .expect(400);
  });

  it('POST rejects unexpected fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/drivers')
      .send({
        name: `E2E Driver ${randomUUID()}`,
        unknownField: 'not allowed',
      })
      .expect(400);
  });

  it('GET lists drivers', async () => {
    const { driver } = await createDriver();

    const response = await request(app.getHttpServer())
      .get('/api/v1/drivers')
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: driver.id })]),
    );
  });

  it('GET retrieves a driver by ID', async () => {
    const { driver } = await createDriver();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/drivers/${driver.id}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: driver.id,
      name: driver.name,
      active: driver.active,
    });
  });

  it('GET rejects an invalid UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/drivers/not-a-uuid')
      .expect(400);
  });

  it('GET returns 404 for an unknown driver', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/drivers/${randomUUID()}`)
      .expect(404);
  });
});
