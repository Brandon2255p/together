# Deploying

Together can run in two places:

- **Vercel**, from the GitHub repo.
- **Self-hosted**, with Docker: [`docker-compose.yml`](../docker-compose.yml) runs the app next to a self-hosted Supabase
  stack on Coolify.

## Docker image

The [`Dockerfile`](../Dockerfile) builds Next.js in `standalone` mode on `node:24-alpine`. It runs as a non-root user,
listens on port 3000, and reports health at `GET /api/health`.

```bash
docker build -t together --build-arg NEXT_PUBLIC_USE_STUB_DATABASE=true .
```

```bash
docker run -p 3000:3000 -e USE_STUB_DATABASE=true together
```

### Variables

| Variable | When | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **build arg** and runtime | Where the **browser** reaches Kong, e.g. `https://together-supabase.tail1234.ts.net` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **build arg** and runtime | The anon key |
| `SUPABASE_URL` | runtime | Where the **server** reaches Kong, e.g. `http://supabase-kong:8000`. Falls back to `NEXT_PUBLIC_SUPABASE_URL`. |
| `NEXT_PUBLIC_USE_STUB_DATABASE` | **build arg** and runtime | `false` in production |
| `USE_STUB_DATABASE` | runtime | `false` in production |

`NEXT_PUBLIC_*` values are compiled into the browser bundle, so changing them means **rebuilding**, not just
restarting. They're public by design. No secrets are needed at build time, and `.env*` files are excluded from the
build context.

The browser and the server can reach Supabase at different addresses. The auth cookie has a fixed name,
`sb-together-auth-token`, set in `lib/supabase/config.ts`, so both still share one session. `@supabase/ssr` would
otherwise name the cookie after the URL's hostname.

## Coolify (self-hosted Supabase) over Tailscale

`docker-compose.yml` is your Supabase stack, plus the app, plus two Tailscale sidecars. Together is private to your
tailnet: nothing is exposed with Funnel.

```
browser on the tailnet
  ├─ https://together.<tailnet>           → ts-together          → together:3000       (the app)
  └─ https://together-supabase.<tailnet>  → ts-together-supabase → supabase-kong:8000  (auth, REST, realtime, storage)

together (Next.js server) → http://supabase-kong:8000, on the compose network
```

A browser only needs those two addresses. Everything else stays on the compose network: Studio, Postgres, the pooler,
Meta, analytics and storage internals. The sidecars use the same serve setup as spacebot: TLS on 443 with a
`ts.net` certificate, and a proxy to the target. The difference is that each one proxies to another container by its
service name, not to `127.0.0.1`. That way `together` and Kong stay on the normal compose network, and Coolify's
own routes keep working if you also want public domains.

| Service | Does |
|---|---|
| `together` | The app, built from the `Dockerfile`. Starts once Kong and Auth are healthy. |
| `ts-together` | Tailscale node `together`. Serves the app on the tailnet. |
| `ts-together-supabase` | Tailscale node `together-supabase`. Serves Kong on the tailnet. |
| `supabase-auth` | `GOTRUE_SITE_URL` points at the app's tailnet URL and `API_EXTERNAL_URL` at Kong's, so auth links work from the tailnet. |

Tailscale variables:

| Variable | Value |
|---|---|
| `TS_AUTHKEY` | A **reusable** auth key, since both sidecars use it. Tag it (e.g. `tag:together`) so the nodes don't expire with your user. |
| `TS_TAILNET` | Your tailnet's MagicDNS suffix, e.g. `tail1234.ts.net`. The URLs above are built from it. |
| `PUBLIC_SUPABASE_URL`, `PUBLIC_APP_URL` | Optional. Set them to override the tailnet URLs, e.g. to use Coolify's public domains. |

Each sidecar keeps its node identity in `./ts/<name>/state`. That directory holds private keys, and it's gitignored.
HTTPS and MagicDNS must be on for the tailnet (in the Tailscale admin, under DNS).

Steps:

1. Create a Docker Compose resource in Coolify from this repository, using `docker-compose.yml`.
2. Make sure the Supabase support files the compose binds exist next to it:
   - `volumes/api/kong.yml` and `volumes/api/kong-entrypoint.sh`
   - `volumes/db/*.sql`
   - `volumes/logs/vector.yml`
   - `volumes/pooler/pooler.exs`
   - `volumes/functions/…`
   - `entrypoint.sh`

   Coolify's Supabase template provides these. They aren't in this repo.
3. Set `TS_AUTHKEY` and `TS_TAILNET`.
4. Set `USE_STUB_DATABASE=false`. Leave it unset to get the same default.
5. Configure SMTP (`SMTP_*`) so sign-in codes can be emailed. Make the magic-link template send `{{ .Token }}`
   (`MAILER_TEMPLATES_MAGIC_LINK`), so users get a 6-digit code.
6. Apply the schema to the database (below), then deploy.
7. Open `https://together.<tailnet>` from a device on the tailnet. The first request to each node can take a few
   seconds while it gets its certificate.

### Applying the schema

Migrations are generated from `supabase/schemas` (see [database.md](database.md)). Push them to the self-hosted
database over a direct Postgres connection:

```bash
supabase db push --db-url "postgresql://postgres:<SERVICE_PASSWORD_POSTGRES>@<db-host>:5432/postgres"
```

Postgres isn't exposed publicly by this compose file. Run the command from the server, or through an SSH tunnel.

## CI

| Workflow | Runs |
|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | lint + typecheck, then unit tests + database tests |
| [`docker.yml`](../.github/workflows/docker.yml) | Test-builds the image with layer caching (never pushes), runs it in stub mode, waits for the health check, and requests `/api/health`, `/sign-in`, `/home` and `/design-system`. Also validates `docker-compose.yml`. |
