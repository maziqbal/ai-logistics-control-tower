import { Test, TestingModule } from '@nestjs/testing';
import { sql } from 'drizzle-orm';

import { DatabaseModule } from '../database.module';
import { DATABASE, type AppDatabase } from '../database.types';

describe('DatabaseModule integration', () => {
  let moduleRef: TestingModule;
  let db: AppDatabase;

  const originalDatabaseUrl = process.env.DATABASE_URL;

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
      throw new Error('Database integration tests must use logistics_test');
    }

    process.env.DATABASE_URL = testDatabaseUrl;

    try {
      moduleRef = await Test.createTestingModule({
        imports: [DatabaseModule],
      }).compile();

      await moduleRef.init();

      db = moduleRef.get<AppDatabase>(DATABASE);
    } catch (error) {
      process.env.DATABASE_URL = originalDatabaseUrl;
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await moduleRef?.close();
    } finally {
      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    }
  });

  it('injects a Drizzle client and executes a PostgreSQL query', async () => {
    const result = await db.execute(sql`SELECT 1 AS value`);

    expect(Number(result.rows[0]?.value)).toBe(1);
  });
});
