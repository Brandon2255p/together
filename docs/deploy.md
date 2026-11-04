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
| `GOOGLE_MAPS_API_KEY` | runtime, optional | A Google Cloud API key with the **Places API (New)** enabled. Matches a place saved from a Maps link, and shows its Google rating, today's hours and photo. Server only, never sent to the browser. In the Cloud console, restrict it to the Places API (New) and to the server's outgoing IP. A key restricted to **websites** is refused, because server requests carry no referrer. Without it, places keep what the link says. |

| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | runtime, optional | Chore reminders (Web Push). Make a key pair once with `pnpm dlx web-push generate-vapid-keys`; the subject is a `mailto:` address. Without them the Reminders card says reminders aren't set up. |
| `CRON_SECRET` | runtime, optional | A long random string. The reminder job only runs for requests with `Authorization: Bearer <CRON_SECRET>`. |
| `SUPABASE_SECRET_KEY` | runtime, optional | The service role key, for the reminder job only (`lib/supabase/admin.ts`). In the compose file it's `SERVICE_SUPABASESERVICE_KEY`. |

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
| `PUBLIC_APP_URL` | **Required.** The app's tailnet URL, e.g. `https://together.tail1234.ts.net`. Auth uses it as the site URL. |
| `PUBLIC_SUPABASE_URL` | **Required.** Kong's tailnet URL, e.g. `https://together-supabase.tail1234.ts.net`. Compiled into the app, and used by Auth, Studio, Storage and Functions as the public URL. |

Write both as literal URLs. Coolify copies compose defaults into its `.env`, and Compose doesn't expand a variable
inside another variable's default there. That's why these aren't built from a tailnet name. If either is missing,
the deploy stops with `set PUBLIC_APP_URL` or `set PUBLIC_SUPABASE_URL`.

Each sidecar sets its node name with `TS_HOSTNAME`, not a compose `hostname:`. Docker maps a container's own hostname
to itself. A sidecar with `hostname: together` would resolve `together` to itself and get "connection refused" on port
3000, when it should reach the app.

Each sidecar keeps its node identity in `./ts/<name>/state`. That directory holds private keys, and it's gitignored.
HTTPS and MagicDNS must be on for the tailnet (in the Tailscale admin, under DNS).

Steps:

1. Create a Docker Compose resource in Coolify from this repository, using `docker-compose.yml`.
2. The Supabase support files are written inline in `docker-compose.yml`, under each bind mount's `content:`:
   - Kong config
   - database init SQL
   - Vector
   - the pooler
   - the edge-function runtime
   - the MinIO bucket script

   These are the files from [Coolify's Supabase template](https://github.com/coollabsio/coolify/blob/v4.x/templates/compose/supabase.yaml),
   unchanged. They use this compose's service names (`supabase-analytics`, `supabase-auth`…), where upstream
   Supabase's use `analytics`, `auth` and so on. Coolify doesn't copy the repo to the server. It writes each `content:`
   to `/data/coolify/applications/<uuid>/…`, and a bind source with no content becomes an empty directory, which made
   Vector crash. CI fails if any `./` file mount is missing its `content:`.
3. Set `TS_AUTHKEY`, `PUBLIC_APP_URL` and `PUBLIC_SUPABASE_URL`. Delete any `TS_TAILNET`, `API_EXTERNAL_URL` or
   `GOTRUE_SITE_URL` lines Coolify copied in earlier, since the compose no longer reads them.
4. Set `USE_STUB_DATABASE=false`. Leave it unset to get the same default.
5. Configure SMTP (`SMTP_*`) so sign-in codes can be emailed. Make the magic-link template send `{{ .Token }}`
   (`MAILER_TEMPLATES_MAGIC_LINK`), so users get a 6-digit code.
6. Apply the schema to the database (below), then deploy.
7. Open `https://together.<tailnet>` from a device on the tailnet. The first request to each node can take a few
   seconds while it gets its certificate.

### Applying the schema

Migrations are generated from `supabase/schemas` (see [database.md](database.md)). On every deploy, the
`supabase-migrate` service applies any new ones:

- **How it runs:** it's built from [`supabase/migrate`](../supabase/migrate) on the database's own image. It waits for
  Postgres and Auth, then applies each new file in `supabase/migrations` in its own transaction.
- **What it records:** each applied migration goes in `supabase_migrations.schema_migrations`, the same table
  `supabase db push` uses, so the two can be mixed.
- **Then it idles,** because Coolify reads an exited container as a crash. It's healthy once the database is up to
  date, and `together` waits for that.
- **If a migration fails,** nothing from that migration is applied. The container goes unhealthy after about 5 minutes
  and the deploy fails. Check its logs, fix the schema, generate a new migration and redeploy.

The production database runs **Postgres 15** (`supabase/postgres:15.8.1.085`), so `supabase/config.toml` sets
`major_version = 15`. Migrations generated against a newer version can contain grants that 15 rejects, such as
`MAINTAIN` from 17. CI applies every migration to the production image to catch that.

You can still push by hand over a direct connection, from the server or through an SSH tunnel. Postgres isn't exposed
publicly.

```bash
supabase db push --db-url "postgresql://postgres:<SERVICE_PASSWORD_POSTGRES>@<db-host>:5432/postgres"
```

## CI

| Workflow | Runs |
|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | lint + typecheck, then unit tests + database tests |
| [`docker.yml`](../.github/workflows/docker.yml) | Test-builds the image with layer caching (never pushes), runs it in stub mode, waits for the health check, and requests `/api/health`, `/sign-in`, `/home` and `/design-system`. Applies every migration to the production Postgres image with the `supabase-migrate` container. Also validates `docker-compose.yml`. |
| [`migrate.yml`](../.github/workflows/migrate.yml) | On every push to `main`: runs the database tests, then `supabase db push` to the hosted project `hskdrgvuexlapwqfeomg`. Only migrations the project hasn't recorded are applied. Needs the `SUPABASE_ACCESS_TOKEN` secret (and optionally `SUPABASE_DB_PASSWORD`), see [Hosted Supabase](#hosted-supabase). |

## Hosted Supabase

[`migrate.yml`](../.github/workflows/migrate.yml) pushes `supabase/migrations` to the hosted project
`https://hskdrgvuexlapwqfeomg.supabase.co` on every push to `main`. Set its secrets once:

```bash
gh secret set SUPABASE_ACCESS_TOKEN
```

```bash
gh secret set SUPABASE_DB_PASSWORD
```

- `SUPABASE_ACCESS_TOKEN` (required) is an access token from https://supabase.com/dashboard/account/tokens. A scoped
  token needs `projects_read`, `database_pooling_config_read` and `branching_production_read`, plus
  `database_write` if you don't set the password.
- `SUPABASE_DB_PASSWORD` (optional) is the project's database password, from Project Settings > Database.

Each command prompts for the value, so it never lands in your shell history. The workflow links the project first
because that connects through the pooler over IPv4: GitHub runners can't reach the direct IPv6 address.
`supabase/config.toml` targets Postgres 15 to match the Docker stack. Migrations written for 15 also run on a newer
hosted project.

## Chore reminders

People turn reminders on from **You** (`/profile`). Each device's push subscription is saved in
`push_subscriptions`. Once a day `GET /api/cron/chore-reminders` sends "due today" to every device whose owner has
chores due or overdue in their Together's time zone, and forgets devices the push service says are gone.

- **Vercel:** `vercel.json` schedules it at 05:00 UTC (07:00 in South Africa). Set `CRON_SECRET` in the project and
  Vercel sends it with the request.
- **Coolify:** add a Scheduled Task on the `together` service, `0 5 * * *`, running:

  ```bash
  wget -qO- --header "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/chore-reminders
  ```

On iPhone, push only works once Together is added to the Home Screen (Safari → Share → Add to Home Screen); the
Reminders card says so.
