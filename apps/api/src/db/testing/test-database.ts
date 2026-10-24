import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../schema';

export function createTestDatabase() {
  const databaseUrl = process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL is required');
  }

  const url = new URL(databaseUrl);

  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('Expected a PostgreSQL connection URL');
  }

  if (url.pathname !== '/logistics_test') {
    throw new Error('Integration tests must use the logistics_test database');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const db = drizzle(pool, { schema });

  return { db, pool };
}
