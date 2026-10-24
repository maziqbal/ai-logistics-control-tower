import { sql } from 'drizzle-orm';
import {
  check,
  geometry,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { routes } from './routes';

export const stopStatusEnum = pgEnum('stop_status', [
  'pending',
  'completed',
  'skipped',
]);

export const stops = pgTable(
  'stops',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    routeId: uuid('route_id').notNull(),

    deliveryDayId: uuid('delivery_day_id').notNull(),

    sequence: integer('sequence').notNull(),

    locationKey: text('location_key').notNull(),

    position: geometry('position', {
      type: 'point',
      mode: 'xy',
      srid: 4326,
    }).notNull(),

    status: stopStatusEnum('status').notNull().default('pending'),
  },
  (table) => [
    foreignKey({
      name: 'stops_route_delivery_day_fk',
      columns: [table.routeId, table.deliveryDayId],
      foreignColumns: [routes.id, routes.deliveryDayId],
    }),

    unique('stops_id_delivery_day_unique').on(table.id, table.deliveryDayId),

    unique('stops_route_sequence_unique').on(table.routeId, table.sequence),

    check('stops_sequence_positive', sql`${table.sequence} > 0`),
  ],
);
