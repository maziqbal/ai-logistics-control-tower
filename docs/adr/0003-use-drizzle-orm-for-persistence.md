# ADR-0003: Use Drizzle ORM for PostgreSQL Persistence

**Status:** Accepted for Phase 1 (provisional)

## Context

AI Logistics Control Tower requires a persistence layer supporting PostgreSQL, PostGIS spatial data, transactional operations, and concurrent parcel assignments.

The application uses a NestJS modular monolith with TypeScript.

We evaluated Drizzle ORM through technical spike ALT-011.

## Decision

Use **Drizzle ORM** as the primary TypeScript database access layer for Phase 1.

- Use Drizzle schemas and typed queries for standard relational operations.
- Use PostgreSQL transactions for operations that must succeed or fail together.
- Use row-level locking where concurrent updates require serialization.
- Use parameterized SQL for specialized PostGIS operations where Drizzle abstractions are insufficient.
- Manage database schema changes through version-controlled migrations.

Drizzle does not replace PostgreSQL constraints, transaction design, or application-level business validation.

## Rationale

ALT-011 successfully demonstrated:

- PostgreSQL connectivity.
- Typed PostGIS point insertion and retrieval.
- Spatial distance calculations using SQL.
- Transaction rollback.
- Row-level locking and concurrent transaction behavior.
- SQL migration generation.

Drizzle fits the existing TypeScript backend and allows us to use PostgreSQL features directly.

## Alternatives Considered

**Prisma:** A mature ORM with a broad ecosystem, but specialized spatial operations can require additional raw SQL and schema considerations.

**TypeORM:** Offers entity-oriented ORM patterns and PostgreSQL integration, but introduces a different abstraction style.

**node-postgres (`pg`) alone:** Provides direct SQL control with minimal abstraction, but requires more manual work for typed relational queries and schema management.

These alternatives were considered architecturally; ALT-011 did not benchmark or experimentally compare them.

## Limitations and Follow-up

The tested Drizzle ORM 0.45.4 / Drizzle Kit 0.31.11 configuration generated `geometry(point)` without enforcing the requested SRID 4326.

Before production spatial schema adoption:

1. Test explicit database-level SRID enforcement.
2. Apply and verify migrations against a clean database.
3. Establish transactional parcel-assignment rules and concurrency tests.
4. Revisit the ORM decision if material integration problems emerge.

## Consequences

**Positive:** Type-safe database operations, straightforward TypeScript integration, direct access to PostgreSQL capabilities.

**Trade-offs:** Specialized spatial SQL and explicit constraints may be necessary. The team must maintain migration discipline and verify database invariants independently of ORM types.

## Evidence

See `docs/spikes/ALT-011-drizzle-postgis.md` and the reproducible experiments under `apps/api/src/spikes/`.
