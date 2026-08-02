# hetzner-api-ui

A single-page web UI for the [Hetzner Cloud API](https://docs.hetzner.cloud/) built with Vite, Vue 3, TypeScript and shadcn-vue (Tailwind CSS v4).

## Features

- **Multiple projects** — a project is a name + Hetzner Cloud API token. Projects are stored only in the browser's `localStorage`; nothing is sent anywhere except `https://api.hetzner.cloud` directly from your browser.
- **Full API coverage**, driven by a fully typed client generated from the official OpenAPI spec:
  - **Compute**: servers (all 20+ actions: power, rescue, console, rebuild, change type, images, backups, ISO, networks, placement groups, DNS PTR, protection, metrics charts), images, server types, SSH keys, placement groups, ISOs
  - **Storage**: volumes (attach/detach/resize)
  - **Network**: networks (subnets, routes), firewalls (rule editor, resource assignment), floating IPs, primary IPs, load balancers (services, targets, metrics), load balancer types, certificates (managed + uploaded)
  - **DNS**: zones (primary/secondary, zonefile import/export, TSIG primaries) and rrsets (full record management)
  - **Meta**: locations, datacenters, pricing, actions
- Server list and creation flow show **hourly/monthly prices** per location and **CPU architecture (x86/arm)**.
- Light/dark theme toggle (persisted).
- Toasted error handling with normalized API error messages.

## Tech stack

- Vite 8 + Vue 3.5 (`<script setup>`) + TypeScript
- Tailwind CSS v4 + [shadcn-vue](https://shadcn-vue.com/) (reka-ui)
- Pinia (projects store, localStorage-persisted), Vue Router
- [openapi-fetch](https://openapi-ts.dev/) + [openapi-typescript](https://openapi-ts.dev/) types generated from `https://docs.hetzner.cloud/cloud.spec.json` (`src/api/schema.d.ts`)
- [Bun](https://bun.sh/) as the package manager

## Development

```bash
bun install
bun dev
```

Type check + production build:

```bash
bun run build      # vue-tsc -b && vite build
bunx vite preview  # serve the production build locally
```

Regenerate API types when the spec changes:

```bash
curl -s https://docs.hetzner.cloud/cloud.spec.json -o /tmp/cloud.spec.json
bunx openapi-typescript /tmp/cloud.spec.json -o src/api/schema.d.ts
```

## Docker

Multi-stage build (Bun build → nginx static):

```bash
docker compose up --build   # serves on http://localhost:8080
```

or manually:

```bash
docker build -t hetzner-api-ui .
docker run -p 8080:80 hetzner-api-ui
```

nginx serves the built assets with SPA fallback (`try_files … /index.html`) and long-lived caching for hashed assets.

## Notes

- API tokens never leave the browser — requests go straight to `api.hetzner.cloud` (which allows CORS).
- Prices are shown in EUR (the Hetzner Cloud billing currency); the API returns net/gross amounts without a currency code.
