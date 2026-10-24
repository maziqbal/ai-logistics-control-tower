import { date, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';

export const deliveryDays = pgTable(
  'delivery_days',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceDate: date('service_date', { mode: 'string' }).notNull(),
    operatingArea: text('operating_area').notNull(),
  },
  (table) => [
    unique('delivery_days_service_date_area_unique').on(
      table.serviceDate,
      table.operatingArea,
    ),
  ],
);
