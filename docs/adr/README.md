
# Architecture Decision Records

This directory contains the Architecture Decision Records
(ADRs) for AI Logistics Control Tower.

## Purpose

ADRs document significant architectural decisions,
their context, alternatives, and consequences.

The approved project baseline is documented in
[Blueprint v1.0](../BLUEPRINT.md).

The current decision register is maintained in
[Project Decisions](../PROJECT_DECISIONS.md).

## ADR Statuses

- **Proposed:** Under discussion; not approved.
- **Accepted:** Approved and active.
- **Superseded:** Replaced by a later ADR.

## Rules

1. Use sequential four-digit identifiers.
2. Keep each ADR focused on one significant decision.
3. Document alternatives and tradeoffs.
4. Do not silently change accepted decisions.
5. Record a superseding ADR when an accepted decision changes.
6. Update the project decision register when necessary.

## Decision Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-use-modular-monolith.md) | Use NestJS Modular Monolith | Accepted |
| [0002](0002-use-pnpm-monorepo.md) | Use pnpm Monorepo | Accepted |
