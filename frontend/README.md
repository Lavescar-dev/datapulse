# Legacy SvelteKit Frontend

This directory is no longer the default DataPulse application.

## Status

- State: archived reference surface
- Canonical app: [`../app`](../app)
- Default root commands: run from [`../package.json`](../package.json)

## Why It Was Retired

DataPulse had two parallel frontend stacks:

- `frontend/` -> SvelteKit legacy UI
- `app/frontend/` -> Astro 5 UI paired with the Hono/Bun backend

For lower memory overhead and less duplicated maintenance, the Astro + Hono stack is now the official path.

## If You Still Need This

Use only for migration or comparison work:

```bash
bun run legacy:dev
bun run legacy:build
bun run legacy:check
```

from [`../`](..).
