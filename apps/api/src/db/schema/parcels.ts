import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  geometry,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { deliveryDays } from './delivery-days';
import { stops } from './stops';

export const parcelStatusEnum = pgEnum('parcel_status', [
  'pending',
  'delivered',
  'failed',
  'skipped',
]);

export const parcels = pgTable(
  'parcels',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    deliveryDayId: uuid('delivery_day_id')
      .notNull()
      .references(() => deliveryDays.id),

    stopId: uuid('stop_id'),

    trackingNumber: text('tracking_number').notNull(),

    destination: text('destination').notNull(),

    locationKey: text('location_key').notNull(),

    position: geometry('position', {
      type: 'point',
      mode: 'xy',
      srid: 4326,
    }).notNull(),

    status: parcelStatusEnum('status').notNull().default('pending'),

    failureReason: text('failure_reason'),
  },
  (table) => [
    unique('parcels_tracking_number_unique').on(table.trackingNumber),

    foreignKey({
      name: 'parcels_stop_delivery_day_fk',
      columns: [table.stopId, table.deliveryDayId],
      foreignColumns: [stops.id, stops.deliveryDayId],
    }),

    check(
      'parcels_failure_reason_consistency',
      sql`(${table.status} = 'failed' AND ${table.failureReason} IS NOT NULL AND length(trim(${table.failureReason})) > 0)
          OR (${table.status} <> 'failed' AND ${table.failureReason} IS NULL)`,
    ),
  ],
);
