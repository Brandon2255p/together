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
| `NEXT_PUBLIC_SUPABASE_URL` | **build arg** and runtime | Kong's public URL, e.g. `https://supabase.example.com` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **build arg** and runtime | The anon key |
| `NEXT_PUBLIC_USE_STUB_DATABASE` | **build arg** and runtime | `false` in production |
| `USE_STUB_DATABASE` | runtime | `false` in production |

`NEXT_PUBLIC_*` values are compiled into the browser bundle, so changing them means **rebuilding**, not just
restarting. They're public by design. No secrets are needed at build time, and `.env*` files are excluded from the
build context.

The app talks to Supabase through Kong's **public** URL, both from the browser and from the server. The auth cookie's
name is derived from that URL, so the two sides have to agree on it.

## Coolify (self-hosted Supabase)

`docker-compose.yml` is your Supabase stack plus a `together` service:

- **`together`**:
  - Built from the repo's `Dockerfile`.
  - Gets its build args from Coolify's generated `SERVICE_URL_SUPABASEKONG` and `SERVICE_SUPABASEANON_KEY`.
  - Starts once Kong and Auth are healthy.
  - `SERVICE_URL_TOGETHER_3000` asks Coolify to route a domain to it. Set it to `https://together.openprocess.me` in
    the service's settings.
- **`supabase-auth`**: `GOTRUE_SITE_URL` now defaults to the app's URL (`SERVICE_URL_TOGETHER`) instead of Kong's, so
  auth emails point at Together.
- **Named volumes** are declared at the bottom, so the file is valid for plain Docker Compose too.

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
3. Set the domains:
   - `together` → `https://together.openprocess.me`
   - `supabase-kong` → your Supabase API domain
4. Set `USE_STUB_DATABASE=false`. Leave it unset to get the same default.
5. Configure SMTP (`SMTP_*`) so sign-in codes can be emailed. Make the magic-link template send `{{ .Token }}`
   (`MAILER_TEMPLATES_MAGIC_LINK`), so users get a 6-digit code.
6. Apply the schema to the database (below), then deploy.

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
