import { INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { DatabaseModule } from '../src/db/database.module';

import { Global } from '@nestjs/common';
import { DATABASE } from '../src/db/database.types';

// Keep your other existing imports.

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useValue: {},
    },
  ],
  exports: [DATABASE],
})
class MockDatabaseModule {}

describe('Health endpoint (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(MockDatabaseModule)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/v1/health returns HTTP 200', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
