import { boolean, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    registrationNumber: text('registration_number').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (table) => [
    unique('vehicles_registration_number_unique').on(table.registrationNumber),
  ],
);
