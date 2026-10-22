
# AI Logistics Control Tower — Delivery Roadmap

**Project:** AI Logistics Control Tower  
**Baseline:** Implementation Blueprint v1.0  
**Delivery approach:** Incremental vertical slices  
**Team:** Solo Lead Full-Stack Engineer with AI-assisted PM,
Scrum Master, architecture and review support  
**Capacity:** Approximately 10–15 hours per week

## Product Goal

Build a portfolio-quality last-mile logistics operations
platform for simulated parcel deliveries in Helsinki.

The MVP will demonstrate realistic road routing,
dispatch planning, deterministic GPS simulation,
real-time tracking, delivery execution, and monitoring.

The system must be reproducible, testable, maintainable,
and affordable to deploy.

See [Blueprint](./BLUEPRINT.md) and
[Project Decisions](./PROJECT_DECISIONS.md).

## Delivery Principles

1. Build working vertical slices.
2. Keep changes small and reviewable.
3. Preserve approved architecture decisions.
4. Validate uncertain technical choices through spikes.
5. Include tests and documentation during development.
6. Prioritize working software over unnecessary abstraction.
7. Keep infrastructure and hosting costs controlled.
8. Do not represent simulated or rule-based features as AI.

## Completed Planning

- [x] Step 1: Product discovery and MVP definition
- [x] Step 2A: Logistics domain modeling
- [x] Step 2B: System architecture
- [x] Step 2C: Implementation Blueprint v1.0 approval

## Phase 0 — Engineering Foundation

**Status:** In progress

**Goal:** Establish a reproducible, professional
development environment and repository.

### Tasks

- [x] Verify Windows development prerequisites
- [x] Configure Git and new GitHub identity
- [x] Create public GitHub repository
- [x] Initialize pnpm workspace
- [x] Commit and push initial repository files
- [x] Add approved Blueprint documentation
- [x] Establish project decision log
- [ ] Establish delivery roadmap
- [ ] Add ADR structure and initial records
- [ ] Set up GitHub Issues and lightweight project board
- [ ] Scaffold NestJS backend
- [ ] Scaffold React frontend
- [ ] Configure local PostgreSQL/PostGIS with Docker
- [ ] Establish linting, formatting, and TypeScript checks
- [ ] Add initial tests and GitHub Actions CI
- [ ] Verify clean setup from repository instructions

### Exit Criteria

- Backend and frontend start locally.
- Database starts through Docker Compose.
- Basic health endpoint works.
- Linting, type checks, tests, and builds pass.
- CI runs on pull requests.
- README contains reproducible setup instructions.

## Phase 1 — Dispatch Planning

**Goal:** Complete the first end-to-end vertical slice.

### Scope

- Seed a small Helsinki delivery scenario.
- Create/load delivery days.
- Manage drivers, vehicles, parcels, routes, and stops.
- Assign parcels to routes.
- Manually sequence stops.
- Calculate road geometry and baseline ETAs.
- Display planned routes using MapLibre.
- Persist and reload plans.
- Validate assignment and route-state rules.

### Technical Spikes

- Validate Drizzle ORM with PostgreSQL/PostGIS.
- Validate routing provider capabilities, terms, and cost.

### Exit Criteria

A dispatcher can prepare, save, reload, and view a
valid road-based delivery plan through the UI.

Main workflows have automated tests and OpenAPI docs.

## Phase 2 — Deterministic Simulation

**Goal:** Execute frozen delivery plans reproducibly.

### Scope

- Freeze plans for execution.
- Create isolated simulation runs.
- Implement controllable simulation clock.
- Generate road-aligned vehicle movement.
- Support seeded scenarios and injected delays.
- Persist run-specific execution state.
- Support start, pause, resume, and stop.

### Exit Criteria

The same frozen plan, seed, and scenario produce
equivalent simulated outcomes.

Runs cannot overwrite one another.

## Phase 3 — Real-Time Tracking

**Goal:** Show live simulated operations.

### Scope

- Implement tracking ingestion and validation.
- Persist latest vehicle positions and selected history.
- Broadcast updates using WebSockets.
- Animate vehicle markers on the map.
- Handle stale and out-of-order position events.
- Support reconnection and authoritative state refresh.

### Exit Criteria

The dispatcher can monitor a controlled 8-driver
scenario with consistent state after reconnection.

Performance is measured against defined targets.

## Phase 4 — Delivery Execution

**Goal:** Support operational delivery workflows.

### Scope

- Build minimal responsive driver portal.
- Show assigned route and stops.
- Record arrival and parcel outcomes.
- Record successful and failed delivery attempts.
- Support skipped stops without false attempts.
- Enforce transactional and idempotent completion.
- Support route closure with unresolved deliveries.

### Exit Criteria

Driver actions correctly update run-specific state.

Concurrent or repeated commands cannot create
duplicate successful completions.

## Phase 5 — Alerts and Reporting

**Goal:** Make operational exceptions visible.

### Scope

- Rule-based lateness-risk detection.
- Alert acknowledgement and resolution.
- Audit trail for important actions.
- Route and delivery completion metrics.
- End-of-day operational summary.

### Exit Criteria

Alerts are explainable and tied to actual
simulation state.

Operational summaries reconcile with stored outcomes.

## Phase 6 — Hardening and Deployment

**Goal:** Publish a reliable portfolio demonstration.

### Scope

- Complete authentication and role authorization.
- Add critical end-to-end tests.
- Test concurrency and failure handling.
- Improve structured logging and health checks.
- Validate security configuration.
- Deploy frontend, backend, and database.
- Verify routing and map-provider usage limits.
- Publish screenshots, architecture, and demo instructions.

### Exit Criteria

The public demonstration works reliably,
within the approved cost target.

The README accurately describes implemented
features, limitations, and architecture.

## Post-MVP — Traditional Machine Learning

**Status:** Deferred

Candidate scope:

- ETA or delivery-delay prediction.
- Baseline comparisons.
- Reproducible datasets and experiments.
- Time-aware evaluation.
- Model versioning and inference integration.

ML work begins only after the operational MVP
provides credible data and evaluation requirements.

## Post-MVP — Agentic AI

**Status:** Deferred

Candidate scope:

- Operational analysis assistant.
- Read-only tools for querying run state.
- Explainable delay and exception summaries.
- Recommendations requiring human approval.
- Structured tool contracts and authorization.
- Audit trails, safety checks, and evaluations.

AI agents must not autonomously mutate
operational state without explicit approval.

## Engineering Workflow

- Iteration length: approximately one week.
- Planning based on 10–15 hours of capacity.
- Track work through GitHub Issues.
- Use short-lived feature branches.
- Open pull requests for meaningful changes.
- Run automated CI checks.
- Review implementation against acceptance criteria.
- Maintain Conventional Commit history.
- Perform lightweight sprint reviews and retrospectives.

## Definition of Done

A task is Done when:

- Acceptance criteria are satisfied.
- Relevant tests pass.
- Linting, type checks, and builds pass where applicable.
- Security and error handling have been considered.
- Documentation is updated where necessary.
- Code has been reviewed.
- Changes are merged into main.
- No known blocking regression remains.

## Current Iteration

**Phase:** 0 — Engineering Foundation  
**Current task:** ALT-002 — Establish delivery roadmap  
**Next task:** Create ADR structure and initial records

## Change Management

Approved decisions are documented in
[Project Decisions](./PROJECT_DECISIONS.md).

Material changes require discussion, justification,
approval, and documentation before implementation.
