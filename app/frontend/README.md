# DataPulse Frontend

Astro 5 serves the active DataPulse frontend from this package.

## Local Development

- `bun run dev` starts Astro on `http://127.0.0.1:3031`
- `bun run preview` previews the built frontend on `http://127.0.0.1:3031`
- `/api` and `/health` are proxied locally to the Hono backend on `http://127.0.0.1:8031`

## Build

- `bun run build` outputs static assets into `dist/`
- Production should serve `dist/` and reverse-proxy `/api` to the backend

## Notes

- Interactive islands live under `src/components/`
- Route pages live under `src/pages/`
- Shared API types come from `../shared`
