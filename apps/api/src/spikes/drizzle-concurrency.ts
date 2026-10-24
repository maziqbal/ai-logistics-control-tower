import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  // Two connections allow two transactions to run concurrently.
  const pool = new Pool({
    connectionString,
    max: 2,
  });

  const db = drizzle({ client: pool });

  try {
    // Use a regular table because temporary tables are
    // visible only to the connection that created them.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS spike_concurrency_test (
        id INTEGER PRIMARY KEY,
        assigned_driver TEXT
      )
    `);

    await db.execute(sql`
      INSERT INTO spike_concurrency_test (id, assigned_driver)
      VALUES (101, NULL)
      ON CONFLICT (id)
      DO UPDATE SET assigned_driver = NULL
    `);

    const dispatcherA = db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT id
        FROM spike_concurrency_test
        WHERE id = 101
        FOR UPDATE
      `);

      console.log('A: Acquired parcel lock');

      await sleep(2000);

      await tx.execute(sql`
        UPDATE spike_concurrency_test
        SET assigned_driver = 'driver-a'
        WHERE id = 101
      `);

      console.log('A: Updated parcel');
    });

    const dispatcherB = db.transaction(async (tx) => {
      console.log('B: Attempting to lock parcel');

      const result = await tx.execute(sql`
        SELECT id, assigned_driver
        FROM spike_concurrency_test
        WHERE id = 101
        FOR UPDATE
      `);

      console.log('B: Lock acquired, saw:', result.rows);
    });

    await Promise.all([dispatcherA, dispatcherB]);

    const finalResult = await db.execute(sql`
      SELECT id, assigned_driver
      FROM spike_concurrency_test
      WHERE id = 101
    `);

    console.log('Final parcel:', finalResult.rows);
  } finally {
    await db.execute(sql`DROP TABLE IF EXISTS spike_concurrency_test`);
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
