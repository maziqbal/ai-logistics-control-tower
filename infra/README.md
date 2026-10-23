
# Local Database Infrastructure

PostgreSQL 17 with PostGIS 3.5, managed using Docker Compose.

## Prerequisites

- Docker Desktop with Docker Compose

## First-time setup

From the repository root:


1. Copy the environment template.

   **Windows (PowerShell):**

   ```powershell
   Copy-Item infra/.env.example infra/.env
   ```

   **Linux/macOS (Bash):**

   ```bash
   cp infra/.env.example infra/.env
   ```

2. Open `infra/.env` and set `POSTGRES_PASSWORD`.

3. Start PostgreSQL:

   ```powershell
   docker compose --env-file infra/.env -f infra/compose.yaml up -d
   ```

4. Verify container health:

   ```powershell
   docker compose --env-file infra/.env -f infra/compose.yaml ps
   ```

5. Verify PostGIS:

   ```powershell
   docker exec logistics-postgres psql -U logistics -d logistics_db -c "SELECT PostGIS_Version();"
   ```

## Stop the database

```powershell
docker compose --env-file infra/.env -f infra/compose.yaml down
```

The named Docker volume preserves database data.

**Warning:** Running `down -v` removes the database volume and its data.

## Connection details

- Host: `localhost`
- Port: `5432`
- Database: `logistics_db`
- Username: `logistics`
- Password: Configured in `infra/.env`

The database port is bound to localhost for local development only.
