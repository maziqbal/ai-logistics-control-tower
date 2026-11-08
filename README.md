# AI Logistics Control Tower

A portfolio-grade last-mile delivery operations platform demonstrating modern full-stack development, backend architecture, real-time communication, and logistics simulation.

The platform enables dispatchers to manage delivery operations, visualize routes on an interactive map, simulate vehicle movement along real roads, and monitor live GPS updates.

The project is being developed incrementally, with machine learning and AI-assisted dispatch planned for future phases.

## Project Status

**Active development — MVP implementation in progress.**

### Implemented Features

- NestJS REST API with TypeScript.
- React and TypeScript frontend using Vite.
- PostgreSQL and PostGIS infrastructure.
- Database-backed route, stop, and delivery-related functionality.
- Interactive MapLibre map with route stops and markers.
- Road-based route geometry using OSRM and OpenStreetMap data.
- Deterministic GPS simulation with distance-based interpolation.
- In-memory simulation sessions with lifecycle controls.
- Automatic GPS movement using elapsed time.
- Pause, resume, stop, and manual advance operations.
- Socket.IO WebSocket gateway for route-specific GPS streaming.
- Automated tests, linting, formatting, and type checking.

### Planned Features

- Animated vehicle markers on the dispatcher map.
- Live delivery execution and operational status updates.
- ETA prediction and delay detection.
- Rule-based operational alerts.
- AI-assisted dispatch recommendations with human approval.
- Additional monitoring and analytics capabilities.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Maps | MapLibre GL JS, OpenStreetMap |
| Backend | NestJS, Node.js, TypeScript |
| Database | PostgreSQL, PostGIS |
| Routing | OSRM |
| Real-time communication | Socket.IO |
| Simulation | Custom deterministic GPS simulation engine |
| Infrastructure | Docker, Docker Compose |
| Package management | pnpm workspaces |
| Testing | Jest |
| Code quality | Prettier, Oxlint, TypeScript |

## Architecture Overview

The current application follows a modular backend architecture.

```text
React Dispatcher Dashboard
          |
          | REST API / WebSocket
          |
      NestJS API
          |
          +-- Routes and Stops
          |
          +-- Route Geometry Service
          |         |
          |         +-- OSRM Routing Engine
          |
          +-- Simulation Module
          |         |
          |         +-- GPS Simulation Engine
          |         +-- Session Manager
          |         +-- Automatic Ticker
          |         +-- Runtime Coordinator
          |         +-- WebSocket Gateway
          |
          +-- PostgreSQL / PostGIS
```

The simulation engine calculates vehicle coordinates along OSRM-generated road geometry. The automatic ticker advances running simulations based on elapsed time, and the WebSocket gateway broadcasts updated position snapshots to subscribed clients.

The frontend currently provides route visualization. Animated vehicle tracking on the map is a planned integration.

## Quick Start — Local Development

### Prerequisites

- Node.js 24
- pnpm 10
- Docker Desktop (Windows/macOS) or Docker Engine with Compose (Linux)
- Git

### 1. Install Dependencies

From the repository root:

```bash
pnpm install --frozen-lockfile
```

### 2. Start PostgreSQL/PostGIS

Follow [Local Database Infrastructure](infra/README.md) to configure the local environment and start PostgreSQL.

The database is exposed on:

```text
localhost:5432
```

Keep local credentials in `infra/.env`. Never commit this file.

### 3. Start OSRM

The route geometry and GPS simulation features depend on the locally configured OSRM routing service.

Ensure the OSRM container is running and accessible at:

```text
http://localhost:5000
```

The backend uses `OSRM_BASE_URL` when configured, otherwise it defaults to `http://localhost:5000`.

OSRM routing data must be prepared before requesting road-based route geometry.

### 4. Start the Backend

From the repository root:

```bash
pnpm --filter api start:dev
```

The API runs at:

```text
http://localhost:3000
```

Health endpoint:

```text
GET http://localhost:3000/api/v1/health
```

### 5. Start the Frontend

Open another terminal:

```bash
pnpm --filter web dev
```

Vite will display the development URL, typically:

```text
http://localhost:5173
```

## GPS Simulation

The backend supports simulated vehicle movement along road-based route geometry.

Each simulation is associated with a route ID.

### Simulation Lifecycle

```text
Start
  |
  v
Running <---- Resume
  |             ^
  v             |
Paused ---------+
  |
  v
Stopped

Running --> Completed
```

Simulations advance automatically while running. Paused simulations remain stationary, and completed simulations stop advancing.

### REST API

Base path:

```text
/api/v1/simulations
```

| Method | Endpoint | Description |
|---|---|---|
| POST | `/:routeId/start` | Start a simulation |
| GET | `/:routeId` | Retrieve the current GPS snapshot |
| POST | `/:routeId/advance` | Manually advance simulation time |
| POST | `/:routeId/pause` | Pause movement |
| POST | `/:routeId/resume` | Resume movement |
| POST | `/:routeId/stop` | Stop the simulation |

### Start a Simulation

Example request:

```http
POST /api/v1/simulations/{routeId}/start
Content-Type: application/json

{
  "speedMetersPerSecond": 2
}
```

The route must exist and have usable road geometry.

### GPS Snapshot

A simulation snapshot includes:

```json
{
  "routeId": "c0f26946-c6f0-47e0-806d-810a1e67090e",
  "longitude": 24.940158,
  "latitude": 60.171864,
  "distanceTraveledMeters": 0,
  "totalDistanceMeters": 1699.4,
  "progress": 0,
  "completed": false,
  "status": "running",
  "elapsedSeconds": 0,
  "speedMetersPerSecond": 2
}
```

These values illustrate the snapshot format using a local demonstration route.

## Real-Time GPS Streaming

The backend provides a Socket.IO gateway for subscribing to live route updates.

### Connection

Local Socket.IO namespace:

```text
http://localhost:3000/simulations
```

### WebSocket Events

| Event | Direction | Purpose |
|---|---|---|
| `simulation:subscribe` | Client → Server | Subscribe to a route |
| `simulation:subscribed` | Server → Client | Confirm subscription |
| `simulation:unsubscribe` | Client → Server | Unsubscribe from a route |
| `simulation:unsubscribed` | Server → Client | Confirm unsubscription |
| `simulation:position` | Server → Client | Receive updated GPS snapshot |

### Subscribe to a Route

Send:

```json
{
  "routeId": "c0f26946-c6f0-47e0-806d-810a1e67090e"
}
```

using the `simulation:subscribe` event.

After subscribing, the client receives `simulation:position` events for that route when its simulation progresses or its lifecycle state changes.

Route-specific Socket.IO rooms prevent clients from receiving broadcasts intended for unrelated routes.

### Manual WebSocket Smoke Test

A development-only Socket.IO client is available at:

```text
apps/api/test/manual-simulation-socket.mjs
```

Run it from the repository root:

```bash
pnpm --filter api exec node test/manual-simulation-socket.mjs
```

The script connects to the local WebSocket namespace, subscribes to the demonstration route, and logs GPS position updates.

Start an active simulation for the matching route to observe live movement.

The client uses the API package's `socket.io-client` development dependency.

## Testing and Code Quality

### Repository Quality Checks

From the repository root:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

### Backend Tests

```bash
pnpm --filter api test --runInBand --ci
```

### Backend End-to-End Tests

```bash
pnpm --filter api test:e2e --runInBand --ci
```

The backend includes tests covering GPS interpolation, simulation lifecycle management, REST service operations, controller delegation, ticker behavior, WebSocket gateway events, and runtime coordination.

Automated tests are complemented by manual checks against a running PostgreSQL, OSRM, and NestJS development environment.


## Live Vehicle Tracking (ALT-033)

The Operations Overview dashboard supports real-time vehicle tracking
on an interactive MapLibre map.

### Implemented Features

- Displays a live vehicle marker on the selected delivery route.
- Receives GPS updates through Socket.IO.
- Smoothly animates the vehicle between GPS positions.
- Shows vehicle speed, simulation status, distance, and progress.
- Supports running, paused, stopped, and completed states.
- Reconnects and retrieves the latest GPS position.
- Cleans up subscriptions when switching routes.
- Preserves OSRM road geometry and numbered delivery stops.

### Running the Demo

1. Start PostgreSQL/PostGIS and OSRM.
2. Start the NestJS API:

   `pnpm --filter api start:dev`

3. Start the React frontend:

   `pnpm --filter web dev`

4. Open the Operations Overview dashboard and select a route.
5. Start a GPS simulation using the REST API.

Example API request:

```http
POST /api/v1/simulations/{routeId}/start
Content-Type: application/json

{
  "speedMetersPerSecond": 5
}
```

The truck marker moves automatically while the simulation is running.

**Current limitation:** Vehicle animation interpolates between
consecutive GPS updates rather than following every intermediate
road segment.


## Current Limitations

- Simulation sessions are stored in application memory and are lost when the API restarts.
- The automatic ticker runs within the NestJS API process.
- WebSocket route subscriptions currently use route ID validation without production-grade authentication and authorization.
- Simulation vehicles do not yet appear as animated markers on the frontend map.
- The live simulation is a development and demonstration feature, not a production fleet tracking system.
- ETA prediction, delay alerts, and AI-assisted dispatch remain future work.

## MVP Roadmap

The initial MVP aims to demonstrate a practical last-mile delivery operations workflow:

1. Route planning and delivery management.
2. Interactive route visualization.
3. Deterministic, road-based vehicle simulation.
4. Real-time GPS streaming and live map tracking.
5. Delivery execution and status monitoring.
6. ETA and delay detection.
7. Operational alerts and dispatch recommendations.

AI-assisted workflows will be introduced incrementally, with human oversight for operational decisions.

## Documentation

Architecture decisions and implementation notes are maintained in the `docs/` directory.

Local infrastructure instructions are maintained in [infra/README.md](infra/README.md).

## License

No license has been selected yet.
