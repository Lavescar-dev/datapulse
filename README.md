# DataPulse

DataPulse now treats the Astro + Hono + Bun stack in [`app/`](./app) as the canonical implementation.

## Active Architecture

- Frontend: Astro 5
- Interactive islands: SolidJS
- API/runtime: Hono on Bun
- Shared types: `app/shared`

This swap is intentional for lower operational overhead on constrained hosts. The older SvelteKit UI in [`frontend/`](./frontend) is retained only as a legacy reference surface and is no longer the default workflow.

## Default Commands

Run these from [`demos/datapulse`](./):

```bash
bun run dev
bun run build
bun run preview
bun run start:backend
```

Useful split commands:

```bash
bun run dev:frontend  # Astro on http://127.0.0.1:3031
bun run dev:backend   # Hono on http://127.0.0.1:8031
bun run dev:backend-rust  # Rust bootstrap backend on its configured port
bun run dev:backend-rust:replace-hono  # Rust backend on http://127.0.0.1:8321
```

## Rust Migration Bootstrap

A first Rust backend bootstrap now exists at `app/backend-rust`.

Current scope:

- `/health`
- `/api/session/start`
- `/api/session/status`
- `/api/admin/login`
- `/api/news`
- `/api/social`
- `/api/crypto/coins`
- `/api/price/products`
- `/api/price/products/:id`
- `/api/price/products/:id/stats`
- `/api/price/export/:id`
- `/api/monitor/endpoints`
- `/api/monitor/endpoints/:id`
- `/api/monitor/summary`
- `/api/notifications`
- `/api/notifications/count`
- `/api/notifications/:id/read`
- `/api/notifications/read-all`
- `/api/notifications/:id/archive`
- `/api/scraper/examples`
- `/api/scraper/examples/:exampleId`
- `/api/scraper/submit`
- `/api/scraper/status/:jobId`
- `/api/scraper/result/:jobId`
- `/api/seo/analyze`
- `/api/seo/status/:jobId`
- `/api/seo/result/:jobId`
- `/api/builder/templates`
- `/api/builder/templates/:id`
- `/api/builder/dashboards/from-template/:templateId`
- `/api/builder/widgets/data`

This now covers the first meaningful read-heavy migration seam for moving DataPulse backend responsibilities from Hono/Bun to Rust/Axum incrementally.

To point the Astro frontend at Rust during local development, set:

```bash
DATAPULSE_API_PROXY_TARGET=http://127.0.0.1:8423
DATAPULSE_API_BASE_URL=http://127.0.0.1:8423
```

Without overrides, the Astro frontend now defaults to the Hono backend at `http://127.0.0.1:8321`.

If you want the frontend to hit Rust without changing the frontend config, run the Rust backend on `8321` with:

```bash
bun run dev:backend-rust:replace-hono
```

That lets the Astro app keep its existing local proxy while Rust gradually takes over Hono responsibilities.

Legacy-only commands are still available, but explicitly namespaced:

```bash
bun run legacy:dev
bun run legacy:build
bun run legacy:check
```

## Deployment Shape

- Static assets should be served from `app/frontend/dist`
- The API should run from `app/backend`
- Bun should be started in `--smol` mode on low-memory hosts when practical

## Recommended Production Hosting

For the current Astro + Hono + Bun stack, the cleanest hosting split is:

- Frontend: Cloudflare Pages
- Backend: Google Cloud Run

Suggested public domains:

- `datapulse.your-domain.com` or `your-domain.com` for the frontend
- `api.your-domain.com` for the backend

Production notes:

- set `PUBLIC_DATAPULSE_API_BASE_URL` on the frontend so browser requests target the Cloud Run API directly
- set `CORS_ORIGINS` on the backend to your Pages domains
- set `COOKIE_SECURE=true` in production
- keep local dev on Astro proxy + Bun backend; no deployment-only rewrites are required

## Notes

- The nested repo already contains active work inside `app/`; this swap avoids rewriting those feature files.
- The generated payload from the retired SvelteKit surface can be removed locally if desired, but it is not required for the swap itself.
- Local development now targets `3031` for the frontend and `8131` for the backend; `3000` and `8080` are no longer part of the default flow.
