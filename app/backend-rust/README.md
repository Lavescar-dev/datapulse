# DataPulse Rust Backend Bootstrap

This package is the first Rust migration slice for DataPulse.

## Purpose

The goal is to replace the current Hono/Bun backend incrementally, not to rewrite the entire product in one step.

This bootstrap currently provides:

- `GET /health`
- `POST /api/session/start`
- `GET /api/session/status`
- `POST /api/admin/login`

These endpoints cover the first migration layer:

- health and deployment checks
- demo session bootstrap
- cookie-based auth boundary
- admin login contract

## Run

```bash
cargo run
```

Default address:

- `http://127.0.0.1:8031`

Override with env vars:

- `HOST`
- `PORT`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `DEMO_SESSIONS_PER_IP`
- `DEMO_SESSION_DURATION_MINUTES`

## Migration Intent

Recommended next Rust slices:

1. session decrement/update helpers
2. monitor endpoints
3. crypto/news/social read endpoints
4. SEO and price tracking APIs
5. scraper orchestration and worker split
