import { boolean, pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
});
