# AI Logistics Control Tower

A last-mile delivery operations platform featuring
road-based fleet simulation, dispatch planning,
live tracking, and operational monitoring.

## Project Status

Phase 0 — Engineering Foundation (in progress).

## Quick Start (Local Development)

### Prerequisites

- Node.js 24
- pnpm 10
- Docker Desktop (Windows/macOS) or Docker Engine with Compose (Linux)
- Git

### 1. Install dependencies

From the repository root:

```bash
pnpm install --frozen-lockfile
```

### 2. Start PostgreSQL/PostGIS

Follow the instructions in [Local Database Infrastructure](infra/README.md) to create your local environment file and start PostgreSQL.

The database runs on `localhost:5432`.

### 3. Start the backend

Open a terminal at the repository root:

```bash
pnpm --filter api start:dev
```

The NestJS API runs at `http://localhost:3000`.

Health endpoint: `http://localhost:3000/api/v1/health`

### 4. Start the frontend

Open another terminal at the repository root:

```bash
pnpm --filter web dev
```

Vite will display the frontend's local URL, typically `http://localhost:5173`.

### 5. Run quality checks

From the repository root:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

Run backend tests:

```bash
pnpm --filter api test --runInBand --ci
pnpm --filter api test:e2e --runInBand --ci
```

### Notes

- Keep local passwords in `infra/.env`. Never commit this file.
- PostgreSQL uses a named Docker volume, so data survives normal container restarts.
- The current frontend and backend are independent scaffolds; database-backed application features and frontend API integration will be added in later phases.

## Planned Tech Stack

- NestJS, TypeScript
- React, TypeScript
- PostgreSQL, PostGIS
- MapLibre GL JS
- OpenStreetMap-based routing
- Docker
- pnpm workspaces

## MVP Scope

The initial release will support manual route planning,
deterministic GPS simulation, live tracking,
delivery execution, and rule-based alerts.

Machine learning and AI agents are planned for later phases.

## Documentation

Architecture decisions and implementation documentation
will be maintained in the `docs/` directory.

## License

No license has been selected yet.
