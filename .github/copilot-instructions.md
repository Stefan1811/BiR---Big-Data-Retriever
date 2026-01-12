# Copilot instructions for BiR - Big Data Retriever

Summary
- Short goal: help code agents reason about architecture, dev flows, and project-specific patterns so changes are correct and minimal.

Big picture
- Architecture: a small microservice stack (Flask services) + a React frontend. See `docker-compose.yml` for wiring.
- Key services: `frontend` (Vite), `gateway` (API gateway on 8000), `sparql-service` (8001), `analytics-service` (8002),
  `recommendation-service` (8003), `art-service` (8004), and `spark-etl` (ETL job). Data stores: `redis` and `fuseki`.

Primary data flow (fine-arts domain)
- `spark-etl` extracts from Wikidata, transforms with PySpark and then:
  - loads RDF triples to Fuseki (POST to Fuseki `/bir/update`, auth `admin/admin`) and
  - writes search-friendly objects to Redis list `art:all` and precomputed stats to `art:stats`.
  See `backend/spark-etl/app/etl_job.py` for the exact transform/load logic.
- Services (e.g. `sparql-service`, `art-service`) do NOT re-download Wikidata; they sync Redis from Fuseki and expose search/analytics endpoints (look for `sync_*_from_fuseki` patterns).

Service communication and conventions
- Services communicate via internal Docker hostnames (e.g. `sparql-service`, `analytics-service`, `redis`, `fuseki`). Check `docker-compose.yml` for exact hostnames and ports.
- Redis keys and shapes:
  - `art:all` — Redis list of JSON objects (rpush used everywhere). Search routines call `cache.lrange("art:all", 0, -1)` and filter client-side.
  - `music:all`, `art:stats` used similarly.
- Sync pattern: pipeline waits for Fuseki, polls until Fuseki has >100 artworks, then `cache.delete(...)` before repopulating. Follow this pattern when modifying ingestion or cache code.

Developer workflows & commands
- Start everything locally (recommended):

  docker-compose up --build

- Frontend dev (hot reload):

  cd frontend
  npm install
  npm run dev

- To run only ETL locally (without Docker cluster), read `backend/spark-etl/app/etl_job.py` and run with a configured Python environment that has PySpark and `SPARQLWrapper` installed. Services expect `REDIS_HOST` and `FUSEKI_HOST` env vars.

Important implementation patterns
- Use HTTP endpoints internal to the compose network (e.g. `http://sparql-service:8001/search/art`). Do not replace these with localhost when editing services running in Docker.
- Always delete old Redis keys before loading new data (`cache.delete('art:all')`) — ETL and sync jobs rely on that to avoid duplicates.
- Fuseki loads use batch `INSERT DATA { ... }` with chunking (chunk_size ~500). Keep chunking for large datasets to avoid timeouts.
- Health checks: services expose `/health` endpoints (see `art-service` and many others). Use them in CI or orchestration scripts.

Files to read first when making changes
- `docker-compose.yml` — service wiring, env vars, volumes.
- `backend/spark-etl/app/etl_job.py` — ETL control flow, loading behavior, Redis/Fuseki interactions.
- `backend/sparql-service/app/main.py` and `backend/art-service/app/main.py` — search and sync implementations, cache keys, example SPARQL queries.
- `backend/api-gateway/app/main.py` — how external routes map to internal services.

Tips for code-generating edits
- Preserve existing cache keys and HTTP routes unless intentionally evolving the API — many components (and the frontend) assume them.
- For changes affecting ETL or Fuseki schema, update both `spark-etl` and the sync logic in services (`sparql-service`, `art-service`).
- When adding new long-running queries or batches, follow existing threading / background patterns used in `*_cache_sync_pipeline()`.

If anything is unclear or you need deeper examples (SPARQL snippets, exact Redis JSON schema, or service startup logs), tell me which area to expand and I will update this file.
