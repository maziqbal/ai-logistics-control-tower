import { geometry, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const spikeLocations = pgTable('spike_locations', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  position: geometry('position', {
    type: 'point',
    srid: 4326,
  }).notNull(),
});
