# ALT-011 — Drizzle ORM + PostGIS Technical Spike

## Objective

Evaluate Drizzle ORM as the PostgreSQL persistence layer for the AI Logistics Control Tower.

The evaluation focuses on spatial data, typed queries, transactions, concurrency, and migration generation.

## Environment

- PostgreSQL 17 with PostGIS 3.5
- Drizzle ORM 0.45.4
- Drizzle Kit 0.31.11
- `pg` (node-postgres)
- NestJS 12 / TypeScript 6 / Node.js 24
- Local PostgreSQL container managed by Docker Compose

## Experiments and Results

| Capability                   | Result  | Evidence                                                                          |
| ---------------------------- | ------- | --------------------------------------------------------------------------------- |
| PostgreSQL connection        | Passed  | Connected and retrieved database/PostGIS version                                  |
| Spatial distance calculation | Passed  | Calculated approximately 630 m between two Helsinki locations using `ST_Distance` |
| Typed spatial schema         | Passed  | Inserted and retrieved a typed PostGIS point                                      |
| Transaction rollback         | Passed  | Simulated failure rolled back table creation and insertion                        |
| Row-level locking            | Passed  | Executed `SELECT ... FOR UPDATE`                                                  |
| Concurrent transactions      | Passed  | Second transaction waited for the first and observed its committed update         |
| Migration generation         | Partial | Generated spatial table SQL, but omitted the requested SRID constraint            |

## Key Finding — Spatial SRID Constraint

The experimental Drizzle schema specified:

```typescript
geometry('position', {
  type: 'point',
  mode: 'xy',
  srid: 4326,
});
```

However, the generated migration contained:

```sql
"position" geometry(point) NOT NULL
```

The `getSQLType()` method also returned `geometry(point)`.

Therefore, the tested configuration did not generate a database-level SRID 4326 restriction.

A possible mitigation is an explicit migration constraint:

```sql
ALTER TABLE spike_locations
ADD CONSTRAINT spike_locations_position_srid_check
CHECK (ST_SRID(position) = 4326);
```

This mitigation must be tested before adoption in the production schema.

## Architectural Assessment

Drizzle is suitable for further implementation based on the capabilities tested.

Advantages:

- TypeScript schema definitions and typed queries.
- Integration with the PostgreSQL driver.
- Working PostGIS geometry mapping.
- PostgreSQL transactions and row-level locking.
- Ability to execute specialized PostGIS SQL.

Limitations and considerations:

- The tested migration generator omitted the expected SRID restriction.
- Specialized spatial operations may require raw SQL.
- Migration application and rollback were not tested end to end.
- Production transaction boundaries, connection management, and concurrency policies remain to be designed.

## Recommendation

Adopt Drizzle ORM as the provisional persistence solution for Phase 1.

Use Drizzle for ordinary relational operations and typed schema definitions, with explicit SQL for specialized PostGIS operations where justified.

Before production adoption:

1. Verify database-level SRID enforcement.
2. Validate generated migrations against a clean database.
3. Define transaction and concurrency patterns for parcel assignments.
4. Document the final ORM decision in an Architecture Decision Record.

## Scope and Cleanup

All experiments were performed against the local development database.

Experimental tables were removed and their absence was verified.

No production logistics tables or migrations were created.
