# OSRM — Helsinki Road Routing

This directory supports road-based route visualization for the AI Logistics Control Tower.

## Overview

The project uses OSRM (Open Source Routing Machine) to calculate driving routes between delivery stops.

Architecture:

1. The dispatcher selects a delivery route.
2. The NestJS backend retrieves the route's ordered stops.
3. The backend requests driving directions from OSRM.
4. OSRM returns a road-following geometry, distance, and estimated duration.
5. The backend returns the geometry through its REST API.
6. The React frontend renders the GeoJSON route using MapLibre GL JS.

The initial demonstration uses Helsinki, Finland.

## Requirements

- Docker Desktop
- Docker Compose
- OpenStreetMap road data for the Helsinki region
- Node.js and pnpm for running the application

## Routing data

The OSRM container expects preprocessed routing data at:

`infra/osrm/data/helsinki/`

The primary dataset name is:

`helsinki-region.osrm`

The corresponding OpenStreetMap extract can be named:

`helsinki-region.osm.pbf`

The Helsinki-area extract must be prepared before OSRM preprocessing.

OpenStreetMap extracts can be obtained from Geofabrik:

https://download.geofabrik.de/europe/finland.html

For the development environment, a Helsinki-area subset was prepared from the Finland dataset to reduce processing and storage requirements.

## Prepare OSRM data

Run the following commands in PowerShell from the repository root.

First, ensure that the Helsinki OSM PBF extract is located at:

`infra/osrm/data/helsinki/helsinki-region.osm.pbf`

### 1. Extract routing information

```powershell
docker run --rm -v "${PWD}/infra/osrm/data/helsinki:/data" ghcr.io/project-osrm/osrm-backend:latest osrm-extract -p /opt/car.lua /data/helsinki-region.osm.pbf
```

### 2. Partition the routing graph

```powershell
docker run --rm -v "${PWD}/infra/osrm/data/helsinki:/data" ghcr.io/project-osrm/osrm-backend:latest osrm-partition /data/helsinki-region.osrm
```

### 3. Customize the routing graph

```powershell
docker run --rm -v "${PWD}/infra/osrm/data/helsinki:/data" ghcr.io/project-osrm/osrm-backend:latest osrm-customize /data/helsinki-region.osrm
```

These preprocessing steps generate OSRM routing files.

They only need to be repeated when the source map data or relevant routing configuration changes.

## Start OSRM

From the repository root:

```powershell
docker compose --env-file infra/.env -f infra/compose.yaml up -d osrm
```

OSRM runs at:

`http://localhost:5000`

The container name is:

`logistics-osrm`

The service uses the MLD algorithm.

## Backend configuration

The NestJS API uses the following environment variable:

```text
OSRM_BASE_URL=http://localhost:5000
```

The route geometry endpoint is:

```http
GET /api/v1/routes/:routeId/geometry
```

For routes with at least two valid stops, the endpoint can return:

- GeoJSON LineString geometry
- Driving distance in meters
- Estimated driving duration in seconds

Routes with insufficient stops return an appropriate status instead of a road geometry.

OSRM estimates do not represent live traffic conditions.

## Frontend integration

The frontend uses MapLibre GL JS to render:

- OpenStreetMap raster tiles
- Numbered delivery-stop markers
- A colored road-following line
- Driving distance and estimated duration

The MapLibre Web Worker is explicitly configured for Vite:

```typescript
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);
```

This configuration is necessary for reliable worker loading in the development environment.

## Data and repository hygiene

The generated OSRM data directory is excluded from Git:

```gitignore
infra/osrm/data/
```

Large OSM extracts and generated routing files must not be committed.

Only source code, infrastructure configuration, and documentation should be committed.

## Current MVP limitations

- Helsinki-area road data only
- Driving profile
- Stops are manually assigned and ordered
- No dynamic route optimization
- No live traffic integration
- No automatic rerouting during route execution

Dynamic routing and live simulation features are planned for later phases.
