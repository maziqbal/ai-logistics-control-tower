
# ADR-0001: Use a NestJS Modular Monolith

**Status:** Accepted  
**Date:** 2026-10-22

## Context

AI Logistics Control Tower requires backend capabilities
for dispatch planning, routing, delivery execution,
simulation, tracking, and operational monitoring.

The project is developed by one engineer with
approximately 10–15 hours per week available.

The MVP targets a controlled demonstration with
approximately 8 drivers and 60 parcels.

We need clear domain boundaries without introducing
unnecessary distributed-system complexity.

## Decision

Use a NestJS modular monolith written in TypeScript.

All backend domain modules will initially run within
one deployable application.

Modules will maintain clear responsibilities and
communicate through defined application services.

PostgreSQL will be the authoritative database.

## Alternatives Considered

### Microservices

Advantages:
- Independent deployment and scaling.
- Strong service-level isolation.

Disadvantages:
- More infrastructure and operational overhead.
- Distributed transactions and failure handling.
- Additional monitoring and deployment complexity.
- Unnecessary for the MVP scale.

### Unstructured Express Application

Advantages:
- Lightweight and flexible.
- Minimal framework overhead.

Disadvantages:
- Requires more conventions to maintain consistency.
- Easier for domain boundaries to become unclear.
- Less built-in structure for dependency injection
  and application organization.

## Consequences

Positive:
- Simpler local development and deployment.
- Clear module ownership.
- Easier transactional consistency.
- Lower hosting and maintenance costs.
- Good support for automated testing.

Tradeoffs:
- Modules share a deployment lifecycle.
- Poor boundaries could create tight coupling.
- Independent scaling is limited.

## Review Triggers

Reconsider only if measurable requirements justify
independent deployment or scaling.

Any change requires explicit approval and a
superseding ADR.

## References

- [Approved Blueprint](../BLUEPRINT.md)
- [Project Decisions](../PROJECT_DECISIONS.md)
