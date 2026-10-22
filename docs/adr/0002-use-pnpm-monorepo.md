
# ADR-0002: Use a pnpm Monorepo

**Status:** Accepted  
**Date:** 2026-10-22

## Context

The project includes:

- NestJS backend.
- React frontend.
- Shared API contracts.
- Infrastructure configuration.
- Architecture documentation.

These components will be maintained by one developer.

We want coordinated development and a straightforward
local setup without unnecessary tooling.

## Decision

Use a single GitHub repository managed with
pnpm workspaces.

The planned structure is:

- `apps/api`
- `apps/web`
- `packages/contracts`
- `infra`
- `docs`

Use short-lived feature branches and meaningful
Conventional Commits.

Do not introduce Nx or Turborepo initially.

## Alternatives Considered

### Separate Repositories

Advantages:
- Independent ownership and release cycles.
- Strong repository-level separation.

Disadvantages:
- More coordination for shared API changes.
- Multiple CI configurations.
- Additional maintenance for a solo developer.

### Monorepo with Nx or Turborepo

Advantages:
- Advanced task orchestration.
- Caching and dependency-aware builds.

Disadvantages:
- Additional configuration and tooling.
- Limited immediate benefit at MVP scale.

## Consequences

Positive:
- One place for code, documentation, and CI.
- Easier cross-application changes.
- Shared dependency and workspace management.
- Simple local onboarding.

Tradeoffs:
- CI must avoid unnecessary work as the project grows.
- Shared packages require careful boundaries.
- Frontend must not depend on backend persistence models.

## Review Triggers

Reconsider workspace tooling if build times,
dependency management, or CI complexity become
measurable problems.

## References

- [Approved Blueprint](../BLUEPRINT.md)
- [Project Decisions](../PROJECT_DECISIONS.md)
