import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  pgEnum,
  pgTable,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { deliveryDays } from './delivery-days';
import { drivers } from './drivers';
import { vehicles } from './vehicles';

export const routeStatusEnum = pgEnum('route_status', [
  'draft',
  'ready',
  'active',
  'completed',
]);

export const routes = pgTable(
  'routes',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    deliveryDayId: uuid('delivery_day_id')
      .notNull()
      .references(() => deliveryDays.id),

    driverId: uuid('driver_id').references(() => drivers.id),

    vehicleId: uuid('vehicle_id').references(() => vehicles.id),

    status: routeStatusEnum('status').notNull().default('draft'),

    version: integer('version').notNull().default(1),
  },
  (table) => [
    unique('routes_delivery_day_driver_unique').on(
      table.deliveryDayId,
      table.driverId,
    ),

    unique('routes_delivery_day_vehicle_unique').on(
      table.deliveryDayId,
      table.vehicleId,
    ),

    unique('routes_id_delivery_day_unique').on(table.id, table.deliveryDayId),

    check('routes_version_positive', sql`${table.version} > 0`),
  ],
);
