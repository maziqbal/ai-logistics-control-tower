Approved project decisions, domain rules, architecture, implementation blueprint and continuity record

Baseline v1.0 | Approved: 19 October 2026 | Status: Phase 0 next | Owner: solo developer | Time budget: 10–15 hours/week

# 1. Governance and decision policy

This document records the approved baseline. Do not silently change decisions, scope, technologies or business rules. Proposed revisions must state reason, alternatives, tradeoffs, impact and approval status. Provisional decisions remain provisional until tested and approved. Maintain docs/PROJECT_DECISIONS.md, docs/ROADMAP.md and Architecture Decision Records in GitHub as the durable source of truth. Chat memory is a helpful secondary aid, not a guarantee.

# 2. Product and MVP scope

Portfolio-quality last-mile parcel delivery operations platform for small/midsize fleets. Primary user: dispatcher; secondary user: simulated driver/mobile-friendly portal. Helsinki-region demo, 5–15 drivers and 30–100 parcels; showcase default 8 drivers, 8 vehicles, 60 parcels; first working slice 2 drivers and 8–12 parcels. Label all location and tracking data as simulated.

- Included v0.1: delivery-day plans, drivers/vehicles, parcels and stops, manual assignments and stop ordering, real road routing and baseline ETAs, seeded GPS simulation, WebSocket map, delivery outcomes, lateness-risk rules and acknowledgements, audit trail, summary, reconnect/resync, tests, Swagger, CI and affordable public demo.
- Excluded v0.1: automatic route optimization, dynamic reassignment, ML and agents, native mobile, full offline support, billing/multi-tenancy, Kubernetes/microservices, Redis/BullMQ by default.
Naming: “AI Logistics Control Tower” is aspirational; v0.1 README must explicitly disclose deterministic simulation and rule-based monitoring, not imply deployed ML/AI.

# 3. Domain definitions and invariant decisions


| Concept | Decision |
| --- | --- |
| DeliveryDay | Our operational grouping of planned deliveries/routes; not a universal logistics industry term. |
| Delivery | One parcel obligation; multiple outcomes possible across different runs/attempts. |
| Stop | One physical visit at a location; may contain multiple deliveries. |
| DeliveryAttempt | Actual visited attempt; success/failure with reason; immutable historical record. |
| Skipped stop | Driver did not visit: no DeliveryAttempt; deliveries unresolved/need follow-up. |
| Route | Driver/vehicle assignment, ordered stops, planned road geometry. |
| SimulationRun | Run-specific scenario, seed, clock and outcomes; independent of other runs. |
| LocationEvent | Run-tagged position and simulated timestamp; stale updates never overwrite latest. |
| Alert | Active, acknowledged and resolved are distinct; acknowledging does not fix underlying risk. |

- Stop with 3 parcels: two delivered and one failed recipient-unavailable attempt -> stop may be completed; unsuccessful parcel needs follow-up.
- Route assignments, stops and order editable during draft planning; frozen during execution. Closing a route requires every stop completed or skipped, not every parcel delivered.
- One delivery cannot belong to multiple active planned stops; no overlapping active routes per driver/vehicle; delivery completion idempotent.
- Plan snapshot/version frozen when a run starts. Run-specific route/stop/delivery state and attempts/alerts/positions must not overwrite other runs.
# 4. Lifecycle/state machines


| Object | States / permitted progression |
| --- | --- |
| Planning route | draft ↔ ready; execution uses frozen plan; run route: ready → in_progress → closed |
| Run stop | pending → en_route → arrived → completed; unvisited may be skipped |
| Run delivery | pending → assigned → out_for_delivery → delivered OR needs_follow_up; later retry permitted; delivered terminal normally |
| SimulationRun | created → running ↔ paused → completed; stopped/interrupted as applicable |
| Alert | active → acknowledged → resolved; active may resolve directly |

Execution-state naming and precise transitions are design targets and will be refined during implementation with tests; do not conflate planning status with run status.

# 5. Approved technical architecture


| Area | Baseline |
| --- | --- |
| Backend | NestJS modular monolith, TypeScript; no premature microservices |
| Frontend | React + TypeScript; dispatcher desktop and small responsive driver portal in same web app |
| Map | MapLibre GL JS; OpenStreetMap road data; separately licensed tile provider |
| Routing | OSRM-compatible provider adapter; calculate geometry/distance/baseline ETA; exact hosted provider not yet approved |
| Database | PostgreSQL + PostGIS |
| ORM | Drizzle provisionally preferred; verify spatial types, migrations and transaction ergonomics; Prisma alternative |
| Realtime | REST commands/queries; WebSockets for positions, status and alerts; reconnect fetches authoritative snapshot |
| Simulation | Backend deterministic seeded engine, controlled simulated clock, precomputed geometry; no routing API per GPS tick |
| Queues | Redis/BullMQ deferred until genuinely needed for background work; never use ordinary job queue as simulation clock |
| ML/AI | Traditional ML in Python later, compare to baseline; tool-using agent later with human approval |
| Deployment | Static frontend, small always-on backend, managed Postgres/PostGIS, controlled map/routing usage |

# 6. Routing and simulation details

- Dispatcher manually assigns parcels to drivers/vehicles and manually sequences stops. System computes drivable path on road network; no dispatcher road drawing. Auto stop-order optimization deferred.
- Use cumulative road distance and simulated elapsed time to interpolate vehicle position. Include bounded speed variation, dwell, seeded delays; no claim of real traffic prediction.
- Persist frozen route geometry and scenario config so replay is not affected by future routing data changes. Same plan, seed and config should reproduce same simulated outcomes.
- MVP one active run per backend instance; multiple completed runs retained; interrupted runs explicitly marked, not silently resumed.
- Two execution modes: automatic simulator outcomes vs manual driver outcomes; do not let both own completion for the same run. Simulator remains GPS source in both.
- Public demo should rely on cached/precomputed seeded routes; public OSRM demo endpoints are not production dependencies. Check map tiles, API quotas, licenses and pricing before deployment.
# 7. Database and transactional rules

Logical records: delivery_days, drivers, vehicles, routes, stops, deliveries, simulation_runs, run_route_states, run_stop_states, run_delivery_states, delivery_attempts, location_events, alerts; possible small scenario configuration. This is conceptual, not a frozen SQL schema.

- Foreign keys; unique (route_id, sequence), (run_id, delivery_id), (run_id, stop_id); scoped parcel reference uniqueness and command idempotency keys.
- Stop completion transaction: authorize run/driver; lock/validate execution state; insert parcel attempts; update delivery run states; complete stop; commit; then emit WebSocket event. Roll back on failure.
- Handle concurrent commands with execution-mode ownership, constraints, short row locks or optimistic versions, and idempotency keys. No network calls inside DB transactions.
- Run-scoped events carry runId, version/sequence and simulated timestamp; stale position updates cannot replace latest.
- PostGIS stores spatial data and supports spatial queries; routing engine separately computes drivable roads.
# 8. Repository and module blueprint

Single GitHub repository ai-logistics-control-tower using pnpm workspaces. Structure: apps/api (NestJS), apps/web (React), packages/contracts (API types only, no DB entities), infra/docker, docs/architecture, docs/adr, docs/api, .github/workflows, compose.yaml, README.md. No Nx/Turborepo initially.

NestJS logical modules: Auth, Dispatch, Delivery, Routing, Simulation, Tracking, Monitoring, Realtime. Scaffold when needed, not all as empty shells. Prefer controller/gateway → service → persistence; avoid generic base layers, premature CQRS/event sourcing.

Developer environment: Windows, comfortable with VS Code. Use VS Code as Phase 0 default; Cursor installed but optional to trial later. Windows Terminal/PowerShell, Git, Node.js, pnpm, Docker Desktop; check versions and Docker/WSL prerequisites before installation.

# 9. First vertical slice and acceptance

Small seed: 2 drivers, 8–12 parcels. Dispatcher loads plan, selects driver/vehicle, assigns parcels, groups by stop, manually orders stops, calculates road geometry, views route/distance/ETA in MapLibre, saves and marks route ready. Exclude simulator/WebSocket/alerts/driver portal from this slice.

- UI creates/edits draft routes; backend prevents invalid duplicate assignment/sequence; routing failure handled; saved route reloads; tests and Swagger available; CI green.
# 10. Preliminary REST and WebSocket contracts


| REST endpoint | Purpose |
| --- | --- |
| GET/POST /api/v1/delivery-days | List/create plans |
| GET /api/v1/delivery-days/:id | Plan detail |
| POST /api/v1/routes | Create draft route |
| PATCH /api/v1/routes/:id | Modify draft assignments/order |
| POST /api/v1/routes/:id/calculate | Road geometry and ETA |
| POST /api/v1/routes/:id/ready | Validate and ready route |
| POST /api/v1/simulation-runs | Create run |
| POST /api/v1/simulation-runs/:id/start|pause|resume | Control run |
| GET /api/v1/simulation-runs/:id/state | Authoritative snapshot |
| POST /api/v1/runs/:id/stops/:stopId/complete|skip | Run-specific execution commands |
| POST /api/v1/alerts/:id/acknowledge | Acknowledge alert |

Preliminary WebSocket events: vehicle.position.updated, stop.status.changed, delivery.status.changed, alert.created, alert.updated, simulation.status.changed. OpenAPI/Swagger for REST; separately document socket events, AsyncAPI optional later. Contracts may be refined during implementation with approval for material changes.

# 11. Phased delivery roadmap


| Phase | Target | Deliverable |
| --- | --- | --- |
| 0 | ~1 week | Workspace, Git, NestJS/React, Docker Postgres, lint, tests, CI, docs |
| 1 | ~2 weeks | Dispatch vertical slice with map/routing |
| 2 | ~2 weeks | Frozen plans and deterministic simulation |
| 3 | ~1–2 weeks | WebSocket tracking, reconnection, map |
| 4 | ~1–2 weeks | Driver portal, attempts, transactional completion |
| 5 | ~1 week | Risk alerts, acknowledgement, audit and reports |
| 6 | ~1–2 weeks | Auth, E2E/load tests, logging, hardening, deployment |

Estimated total ~9–12 weeks at 10–15 hours/week, subject to technical spikes and real pace; maintain an honest roadmap. Future phases: ML consumption/ETA forecasting as appropriate, agentic operational assistance with explicit human approval, route optimization, scale-out.

# 12. Testing, security and CI/CD

- Unit tests: domain transitions, skipped vs failed, idempotency, deterministic seed, risk rules. Integration tests: real Postgres/PostGIS, transactions, uniqueness, concurrent completion, spatial queries. E2E Playwright: route creation, tracking, driver outcome, alert acknowledgment.
- Target controlled 8-driver demo p95 position update ~2 seconds, measured and qualified; not a production SLA.
- CI GitHub Actions: frozen pnpm install, ESLint/Prettier, strict TS, unit/integration tests, build, OpenAPI checks; Playwright may run separately to manage runtime.
- Auth dispatcher/driver roles, scoped run access, input validation, CORS/security headers, no secrets in Git, .env.example, structured logs/correlation IDs, health endpoints, safe migrations.
- WebSocket after DB commit; clients resync on reconnect. Transactional outbox only if durable event delivery later required.
# 13. GitHub documentation and commits

README: problem statement, simulation disclosure, screenshots/live demo, architecture, stack, setup, reproducibility, API docs, tests/CI, decisions, roadmap, limitations. ADRs: modular monolith, monorepo, run-state isolation, fixed routes, routing adapter, queue deferral, ORM spike, deterministic simulator.

- Conventional Commits; small coherent changes; short-lived branches and meaningful PRs; main stable. Examples: chore(repo): initialize pnpm workspace; feat(dispatch): implement draft route creation; feat(routing): add routing provider adapter; test(dispatch): cover assignment rules.
# 14. Cost constraints and validation spikes

Local development: no infrastructure subscription required beyond hardware/internet. Public low-traffic portfolio target roughly USD 10–25/month (soft target USD 15), not a price quote. Verify current pricing, free-tier restrictions, PostGIS support, routing quotas and tile licensing. Do not deploy paid Redis or dedicated routing service by default.

- Spike A: Drizzle migrations, PostGIS types, spatial query and transaction/locking patterns; choose ORM based on evidence.
- Spike B: Routing provider geometry, matrix/duration, usage terms, availability and cache behavior; keep provider behind adapter.
# 15. Current status and immediate next action

Steps 1 (discovery), 2A (domain), 2B (architecture), 2C (blueprint) complete and approved as baseline. Phase 0 has not started. Next: inspect Windows tooling (Git, Node, pnpm, Docker Desktop, VS Code), create repository, add docs/PROJECT_DECISIONS.md and docs/ROADMAP.md, initialize pnpm workspace, make first atomic commit. Do not generate full application at once.
