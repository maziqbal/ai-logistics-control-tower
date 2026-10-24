# ALT-012 — Logistics Domain Model and Relationships

**Project:** AI Logistics Control Tower  
**Phase:** Phase 1 — Dispatch Planning  
**Status:** Approved design — pending implementation  
**Issue:** ALT-012  
**Scope:** Core logistics entities, relationships, database integrity, lifecycle rules, and concurrency boundaries

---

## 1. Purpose

This document defines the Phase 1 logistics domain model for the AI Logistics Control Tower.

The goal is to support a dispatcher preparing, validating, saving, and reloading delivery plans for a specific delivery day and operating area.

The initial implementation supports manual parcel assignment and stop ordering, with road geometry and travel estimates calculated using an OSRM-compatible routing service.

The design prioritizes:

- Clear ownership and relationships between domain entities.
- Strong PostgreSQL data integrity.
- Safe transactional updates.
- Explicit route and delivery lifecycles.
- Optimistic concurrency protection.
- Future extensibility for GPS simulation, ETA prediction, and agentic operational analysis.

This document describes the agreed domain model. It does not introduce production migrations or API contracts.

## 2. Core Domain Entities

### 2.1 Delivery Day

A delivery day represents a planning container for parcel deliveries in a specific operating area on a particular service date.

**Table:** `delivery_days`

| Field | Description |
|---|---|
| `id` | UUID primary key |
| `service_date` | Date on which deliveries are planned |
| `operating_area` | Identifier or name of the operating area |

A delivery day contains multiple routes and parcels.

A delivery day does not have its own lifecycle status. Its progress is derived from its associated routes and parcels.

The combination of service date and operating area should be unique, using a normalized operating-area identifier.

### 2.2 Driver

A driver is a person who can be assigned to a delivery route.

**Table:** `drivers`

| Field | Description |
|---|---|
| `id` | UUID primary key |
| `name` | Driver display name |
| `active` | Whether the driver is available for assignment |

A driver may serve different routes on different delivery days but cannot be assigned to multiple routes on the same delivery day.

Inactive drivers cannot be newly assigned to routes.

### 2.3 Vehicle

A vehicle represents a delivery vehicle used for route execution.

**Table:** `vehicles`

| Field | Description |
|---|---|
| `id` | UUID primary key |
| `registration_number` | Unique vehicle registration identifier |
| `active` | Whether the vehicle is available for assignment |

A vehicle may be reused across delivery days but cannot be assigned to multiple routes on the same delivery day.

Inactive vehicles cannot be newly assigned to routes.

### 2.4 Route

A route is an ordered collection of delivery stops assigned to a driver and vehicle for a particular delivery day.

**Table:** `routes`

| Field | Description |
|---|---|
| `id` | UUID primary key |
| `delivery_day_id` | Reference to the delivery day |
| `driver_id` | Nullable reference to a driver |
| `vehicle_id` | Nullable reference to a vehicle |
| `status` | Draft, Ready, Active, or Completed |
| `version` | Integer used for optimistic concurrency |

A route belongs to exactly one delivery day.

A Draft route may exist without a driver or vehicle.

Both assignments are required before a route becomes Ready.

Each route has an ordered collection of stops.

A route's version changes whenever its planning state changes, including assignments, stop order, parcel membership, routing data, or lifecycle transitions.

### 2.5 Stop

A stop represents one planned visit location within a route.

**Table:** `stops`

| Field | Description |
|---|---|
| `id` | UUID primary key |
| `route_id` | Reference to the owning route |
| `delivery_day_id` | Delivery day, consistent with the owning route |
| `sequence` | Position in the route, starting at 1 |
| `location_key` | Normalized delivery-location identifier |
| `latitude` | Geographic latitude |
| `longitude` | Geographic longitude |
| `status` | Pending, Completed, or Skipped |

A stop belongs to exactly one route and may contain multiple parcels.

All parcels assigned to a stop must have the same normalized location key and belong to the same delivery day.

Stops are ordered explicitly using their sequence values.

Stops must not remain empty after the last parcel is removed during Draft planning. Empty stops are automatically deleted and the remaining stops resequenced.

### 2.6 Parcel

A parcel represents an individual delivery item with its own destination, tracking identifier, and delivery outcome.

**Table:** `parcels`

| Field | Description |
|---|---|
| `id` | UUID primary key |
| `delivery_day_id` | Reference to the delivery day |
| `stop_id` | Nullable reference to its assigned stop |
| `tracking_number` | Unique human-readable tracking identifier |
| `destination` | Destination address and related details |
| `location_key` | Normalized destination identifier |
| `latitude` | Destination latitude |
| `longitude` | Destination longitude |
| `status` | Pending, Delivered, Failed, or Skipped |
| `failure_reason` | Nullable explanation for failed delivery |

A parcel belongs to exactly one delivery day.

A parcel may remain unassigned while the dispatcher prepares the plan.

A parcel can be assigned to at most one stop at a time.

Each parcel retains its own delivery status, even when several parcels share one stop.

## 3. Entity Relationships

The primary relationships are:

- One delivery day has many routes.
- One delivery day has many parcels.
- One route has many stops.
- One stop has many parcels.
- One driver may have many routes across different days.
- One vehicle may have many routes across different days.
- Each parcel may reference zero or one stop.

The resulting hierarchy is:

```text
Delivery Day
├── Routes
│   ├── Driver
│   ├── Vehicle
│   └── Stops (ordered)
│       └── Parcels (one or more)
└── Unassigned Parcels

Drivers and Vehicles
└── Reusable across different delivery days
```

A parcel's delivery day must always match the delivery day of its assigned stop and route.

A stop's delivery day must always match that of its owning route.

These relationships will be enforced through database constraints where practical.

## 4. Dispatch Planning Rules

### 4.1 Parcel Assignment

Parcels may be created before route planning.

Unassigned parcels have a `NULL` stop reference.

A dispatcher can assign parcels to a Draft route by placing them into an existing compatible stop or creating a new stop.

Parcels may be grouped at a stop only when their normalized location keys match.

Geographic proximity alone is insufficient to establish that two destinations represent the same delivery location.

### 4.2 Reassignment

Parcel assignments may be modified only while the affected routes are Draft.

A Ready route must first return to Draft before its parcel assignments or stop ordering can change.

Active and Completed routes cannot be modified through ordinary dispatch planning operations.

Moving parcels between routes is an atomic operation that validates both affected routes.

### 4.3 Empty Stops

When the last parcel is removed from a Draft stop:

1. The stop is deleted.
2. The remaining stops are resequenced.
3. The route version is incremented.
4. Any previously calculated routing results are invalidated.

All changes occur within one transaction.

### 4.4 Stop Ordering

Stops are ordered using consecutive positive integers beginning at 1.

For example, a route with four stops must have positions `1, 2, 3, 4`.

Duplicate positions, zero or negative positions, and gaps are invalid in the final saved route order.

Stop reordering must be atomic and concurrency-safe.

## 5. Route Lifecycle

A route supports the following states:

```text
Draft ──────> Ready ──────> Active ──────> Completed
  ^             |
  └─────────────┘
```

### Draft

A Draft route is editable.

Driver and vehicle assignments are optional.

Parcels may be assigned, reassigned, or removed.

Stops may be created, deleted, or reordered.

### Ready

A Ready route has passed all planning validations.

It has a valid driver, vehicle, parcel assignments, stop sequence, coordinates, and current road-based routing results.

A Ready route may return to Draft for editing.

Returning to Draft permits planning changes and requires revalidation before becoming Ready again.

### Active

An Active route represents a plan that has started execution.

The planned driver, vehicle, parcel assignments, stop order, and route geometry are immutable.

Operational status updates are allowed through the execution workflow.

### Completed

A Completed route has finished execution.

Every parcel on the route must have a final delivery outcome.

All stops must also be resolved.

Completed does not mean every parcel was successfully delivered. Failed and skipped outcomes are valid final results.

Completed routes are not editable through ordinary dispatcher planning operations.

## 6. Route Readiness Validation

A route may transition from Draft to Ready only when all required checks pass.

Validation includes:

1. A driver is assigned and eligible.
2. A vehicle is assigned and eligible.
3. Neither assignment conflicts with another route on the same delivery day.
4. The route contains at least one stop.
5. Every stop contains at least one parcel.
6. All assigned parcels belong to the route's delivery day.
7. Every parcel's normalized location key matches its stop.
8. Stop positions are consecutive, starting at 1.
9. Stop and parcel coordinates are valid.
10. Road geometry and travel estimates are available and current for the exact route plan.

Routing results must be invalidated when relevant planning inputs change, including stop order or locations.

Readiness validation and the status transition must be concurrency-safe.

The implementation must associate routing results with the planning inputs used to generate them, such as a route-plan version or fingerprint, to prevent stale results from being accepted.

## 7. Delivery Execution Outcomes

### 7.1 Parcel Statuses

A parcel supports:

| Status | Meaning |
|---|---|
| `pending` | Delivery has not received a final outcome |
| `delivered` | Parcel was delivered successfully |
| `failed` | Delivery was attempted but unsuccessful |
| `skipped` | Delivery was not attempted because the stop or parcel was skipped |

A failed parcel must include an appropriate failure reason.

Parcel statuses are tracked independently.

For example, a stop with three parcels may contain two delivered parcels and one failed parcel.

### 7.2 Stop Statuses

A stop supports:

| Status | Meaning |
|---|---|
| `pending` | Stop has not been resolved |
| `completed` | All parcels at the stop are delivered or failed |
| `skipped` | Stop was skipped during execution |

When a stop is marked Completed, all its parcels must have a final outcome of Delivered or Failed.

When a stop is skipped, all unresolved parcels at that stop are marked Skipped in the same transaction.

Already-final parcel outcomes must not be silently overwritten.

### 7.3 Route Completion

A route may become Completed only when:

- Every stop is Completed or Skipped.
- Every parcel has a final outcome of Delivered, Failed, or Skipped.
- No pending parcel remains.

Completion is validated transactionally.

## 8. Database Constraints and Integrity

### 8.1 Primary Keys and Tracking Numbers

Core entities use UUID primary keys.

Parcel tracking numbers are separate, human-readable identifiers with a unique constraint.

Vehicle registration numbers are also unique.

### 8.2 Delivery-Day Uniqueness

The combination of `service_date` and normalized `operating_area` is unique for delivery days.

This prevents duplicate planning containers for the same date and area.

### 8.3 Driver and Vehicle Assignments

Each driver and vehicle may be assigned to at most one route per delivery day.

Enforce this using:

```sql
UNIQUE (delivery_day_id, driver_id)
UNIQUE (delivery_day_id, vehicle_id)
```

Both assignment fields are nullable while a route is Draft.

PostgreSQL's default unique-constraint behavior allows multiple unassigned (`NULL`) values.

### 8.4 Parcel and Stop Delivery-Day Consistency

Each stop stores `delivery_day_id` in addition to `route_id`.

The following composite foreign keys enforce same-day consistency:

```sql
-- Required referenced uniqueness
UNIQUE (id, delivery_day_id) -- routes
UNIQUE (id, delivery_day_id) -- stops

-- Stops must match their parent route's day
FOREIGN KEY (route_id, delivery_day_id)
REFERENCES routes (id, delivery_day_id)

-- Parcels must match their assigned stop's day
FOREIGN KEY (stop_id, delivery_day_id)
REFERENCES stops (id, delivery_day_id)
```

The relevant delivery-day fields must be `NOT NULL`.

A nullable parcel `stop_id` allows the parcel to remain unassigned.

These constraints prevent assigning a parcel to a stop from another delivery day.

### 8.5 Stop Ordering

Enforce positive positions using:

```sql
CHECK (sequence > 0)
```

Enforce uniqueness within each route using:

```sql
UNIQUE (route_id, sequence)
DEFERRABLE INITIALLY IMMEDIATE
```

During reordering, the backend explicitly defers the uniqueness check within a transaction.

This allows intermediate duplicate positions while ensuring the final committed order is unique.

The backend also validates that positions are consecutive without gaps.

Route-level locking protects concurrent reorder operations.

### 8.6 Location Consistency

Each parcel stores its destination independently from the stop's planned visit location.

The backend must ensure that a parcel and its assigned stop have matching normalized location keys.

This cross-table business rule requires transactional application validation or a dedicated database enforcement mechanism. A simple foreign key on `stop_id` alone does not enforce it.

### 8.7 Spatial Integrity

Geographic coordinates use PostGIS with SRID 4326.

The production schema must explicitly enforce and verify the intended SRID.

ALT-011 identified that Drizzle's geometry configuration did not automatically produce the expected SRID restriction in the generated SQL.

Migrations must therefore be inspected and supplemented with explicit SQL constraints or appropriate PostGIS column definitions where required.

Coordinate ranges and geographic validity must also be checked.

### 8.8 Route Readiness

Route readiness is a multi-entity business invariant and cannot be fully guaranteed by ordinary column-level constraints.

The application must validate it inside a concurrency-safe workflow before changing the route status.

## 9. Concurrency and Transactions

### 9.1 Optimistic Concurrency

Routes contain a `version` integer.

Clients submit the version of the route they intend to modify.

If another operation has already changed the route, the stale request is rejected with HTTP `409 Conflict`.

Successful planning mutations increment the route version.

This includes changes to:

- Driver or vehicle assignments.
- Parcel assignments.
- Stop creation, deletion, or ordering.
- Relevant routing results.
- Route lifecycle state.

### 9.2 Row-Level Locking

Transactions that modify a route's planning structure lock the affected route row.

Operations involving multiple routes acquire locks in a deterministic order to reduce deadlock risk.

A stale-version check must occur within the concurrency-controlled transaction.

### 9.3 Atomic Operations

The following operations require transactions:

- Parcel assignment and reassignment.
- Stop reordering.
- Automatic empty-stop deletion and resequencing.
- Driver and vehicle reassignment when multiple routes are affected.
- Route deletion and parcel unassignment.
- Route readiness transitions.
- Stop completion and skipping.
- Route completion.

A partial update must not leave the delivery plan inconsistent.

## 10. Deletion Policy

Deletion is permitted only for Draft planning data through controlled application operations.

### Draft Stop Deletion

Deleting a Draft stop must preserve its parcels by unassigning them.

The remaining stops are resequenced atomically.

### Draft Route Deletion

Deleting a Draft route must:

1. Lock and validate the route.
2. Unassign its parcels without deleting them.
3. Remove its stops.
4. Remove the route.
5. Commit all changes atomically.

### Ready, Active, and Completed Routes

A Ready route must return to Draft before deletion.

Active and Completed routes cannot be deleted through ordinary dispatcher workflows.

The application must not rely on uncontrolled cascading deletes that could accidentally remove parcel records.

## 11. Routing Data and Invalidation

Phase 1 uses road-network routing to calculate route geometry and travel estimates.

The route plan remains manually ordered by the dispatcher.

The routing service calculates the road path for that chosen order; it does not automatically optimize or rearrange stops.

Routing data must be associated with the exact planning inputs used to calculate it.

Changes to stop order, coordinates, or other routing-relevant inputs invalidate previously calculated results.

The final persistence representation of road geometry, distances, durations, and routing metadata will be specified during the implementation issue.

## 12. Implementation Considerations

The initial production schema will be implemented using Drizzle ORM and PostgreSQL/PostGIS.

Implementation work must include:

- Drizzle table definitions and relationships.
- Generated and reviewed migrations.
- Explicit SQL migrations where Drizzle Kit cannot express required constraints.
- Foreign-key and uniqueness tests.
- SRID enforcement tests.
- Transaction and concurrency integration tests.
- Verification of stop reordering with deferred uniqueness checks.
- Verification of parcel-to-stop delivery-day consistency.

Database constraints protect structural integrity.

Application services protect lifecycle transitions, permissions, and multi-entity business rules.

These responsibilities should remain clearly separated.

## 13. Out of Scope for ALT-012

This issue does not implement:

- Production database migrations.
- REST endpoints or OpenAPI specifications.
- Dispatcher dashboard screens.
- OSRM integration.
- Live GPS simulation.
- Driver mobile applications.
- Redis or background job processing.
- ETA prediction models.
- Agentic AI workflows.
- Automatic route optimization.

These belong to subsequent implementation phases and issues.

## 14. Approved Design Decisions

The following decisions were agreed during ALT-012:

1. Parcels belong to a delivery day and may remain unassigned.
2. Stops are separate route entities and may contain multiple parcels.
3. Drivers and vehicles are unique per delivery day.
4. Draft routes may have missing driver or vehicle assignments.
5. Stop positions are consecutive and start at 1.
6. Parcel assignments change only while affected routes are Draft.
7. Empty Draft stops are automatically removed and remaining stops resequenced.
8. Ready routes require strict planning and routing validation.
9. Routes follow Draft, Ready, Active, and Completed lifecycles.
10. Parcels have Pending, Delivered, Failed, and Skipped outcomes.
11. Stops have Pending, Completed, and Skipped outcomes.
12. Route versions and transactions protect concurrent changes.
13. Parcels retain destinations; shared stops require matching normalized location keys.
14. Delivery days have no independent lifecycle status.
15. Core entities use UUIDs; parcels have separate tracking numbers.
16. Draft routes and stops support controlled deletion without deleting parcels.
17. Composite foreign keys enforce same-day consistency between routes, stops, and parcels.
18. Deferrable unique constraints support atomic stop reordering.

## 15. References

- `docs/BLUEPRINT.md`
- `docs/PROJECT_DECISIONS.md`
- `docs/ROADMAP.md`
- `docs/spikes/ALT-011-drizzle-postgis.md`
- `docs/adr/0003-use-drizzle-orm-for-persistence.md`

---

**ALT-012 design outcome:** A defined Phase 1 logistics domain model with agreed relationships, lifecycle rules, database constraints, and transactional boundaries, ready to guide initial Drizzle schema implementation.
