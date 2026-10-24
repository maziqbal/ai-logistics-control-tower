import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { geometry, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';

const locations = pgTable('spike_locations', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  position: geometry('position', {
    type: 'point',
    mode: 'xy',
    srid: 4326,
  }).notNull(),
});

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool, schema: { locations } });

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS spike_locations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        position geometry(Point, 4326) NOT NULL
      )
    `);

    await db
      .insert(locations)
      .values({
        id: 1,
        name: 'Helsinki Central Station',
        position: { x: 24.941, y: 60.1719 },
      })
      .onConflictDoNothing();

    const result = await db.select().from(locations).where(eq(locations.id, 1));

    console.log('Typed Drizzle result:', result);
  } finally {
    await db.execute(sql`DROP TABLE IF EXISTS spike_locations`);
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
