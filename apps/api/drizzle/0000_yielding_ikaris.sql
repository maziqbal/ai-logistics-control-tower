-- Enable PostGIS before creating geometry columns.
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint

CREATE TYPE "public"."route_status" AS ENUM('draft', 'ready', 'active', 'completed');
--> statement-breakpoint

CREATE TYPE "public"."stop_status" AS ENUM('pending', 'completed', 'skipped');
--> statement-breakpoint

CREATE TYPE "public"."parcel_status" AS ENUM('pending', 'delivered', 'failed', 'skipped');
--> statement-breakpoint

CREATE TABLE "delivery_days" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "service_date" date NOT NULL,
    "operating_area" text NOT NULL,
    CONSTRAINT "delivery_days_service_date_area_unique"
        UNIQUE("service_date", "operating_area")
);
--> statement-breakpoint

CREATE TABLE "drivers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint

CREATE TABLE "vehicles" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "registration_number" text NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "vehicles_registration_number_unique"
        UNIQUE("registration_number")
);
--> statement-breakpoint

CREATE TABLE "routes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "delivery_day_id" uuid NOT NULL,
    "driver_id" uuid,
    "vehicle_id" uuid,
    "status" "route_status" DEFAULT 'draft' NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,

    CONSTRAINT "routes_delivery_day_driver_unique"
        UNIQUE("delivery_day_id", "driver_id"),

    CONSTRAINT "routes_delivery_day_vehicle_unique"
        UNIQUE("delivery_day_id", "vehicle_id"),

    CONSTRAINT "routes_id_delivery_day_unique"
        UNIQUE("id", "delivery_day_id"),

    CONSTRAINT "routes_version_positive"
        CHECK ("routes"."version" > 0)
);
--> statement-breakpoint

CREATE TABLE "stops" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "route_id" uuid NOT NULL,
    "delivery_day_id" uuid NOT NULL,
    "sequence" integer NOT NULL,
    "location_key" text NOT NULL,

    -- Enforce Point geometry with SRID 4326.
    "position" geometry(Point,4326) NOT NULL,

    "status" "stop_status" DEFAULT 'pending' NOT NULL,

    CONSTRAINT "stops_id_delivery_day_unique"
        UNIQUE("id", "delivery_day_id"),

    -- Allows uniqueness checking at transaction commit when deferred.
    CONSTRAINT "stops_route_sequence_unique"
        UNIQUE("route_id", "sequence")
        DEFERRABLE INITIALLY IMMEDIATE,

    CONSTRAINT "stops_sequence_positive"
        CHECK ("stops"."sequence" > 0)
);
--> statement-breakpoint

CREATE TABLE "parcels" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "delivery_day_id" uuid NOT NULL,
    "stop_id" uuid,
    "tracking_number" text NOT NULL,
    "destination" text NOT NULL,
    "location_key" text NOT NULL,

    -- Enforce Point geometry with SRID 4326.
    "position" geometry(Point,4326) NOT NULL,

    "status" "parcel_status" DEFAULT 'pending' NOT NULL,
    "failure_reason" text,

    CONSTRAINT "parcels_tracking_number_unique"
        UNIQUE("tracking_number"),

    CONSTRAINT "parcels_failure_reason_consistency"
        CHECK (
            (
                "parcels"."status" = 'failed'
                AND "parcels"."failure_reason" IS NOT NULL
                AND length(trim("parcels"."failure_reason")) > 0
            )
            OR
            (
                "parcels"."status" <> 'failed'
                AND "parcels"."failure_reason" IS NULL
            )
        )
);
--> statement-breakpoint

ALTER TABLE "routes"
ADD CONSTRAINT "routes_delivery_day_id_delivery_days_id_fk"
FOREIGN KEY ("delivery_day_id")
REFERENCES "public"."delivery_days"("id")
ON DELETE no action
ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "routes"
ADD CONSTRAINT "routes_driver_id_drivers_id_fk"
FOREIGN KEY ("driver_id")
REFERENCES "public"."drivers"("id")
ON DELETE no action
ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "routes"
ADD CONSTRAINT "routes_vehicle_id_vehicles_id_fk"
FOREIGN KEY ("vehicle_id")
REFERENCES "public"."vehicles"("id")
ON DELETE no action
ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "stops"
ADD CONSTRAINT "stops_route_delivery_day_fk"
FOREIGN KEY ("route_id", "delivery_day_id")
REFERENCES "public"."routes"("id", "delivery_day_id")
ON DELETE no action
ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "parcels"
ADD CONSTRAINT "parcels_delivery_day_id_delivery_days_id_fk"
FOREIGN KEY ("delivery_day_id")
REFERENCES "public"."delivery_days"("id")
ON DELETE no action
ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "parcels"
ADD CONSTRAINT "parcels_stop_delivery_day_fk"
FOREIGN KEY ("stop_id", "delivery_day_id")
REFERENCES "public"."stops"("id", "delivery_day_id")
ON DELETE no action
ON UPDATE no action;
