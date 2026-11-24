# Deploying

Together runs on **Vercel**, deployed from the GitHub repo's `main` branch, with a **hosted Supabase** project for the
database and sign-in. Shared photos, videos and documents are kept in an **S3 bucket**, made with OpenTofu: see
[`infra/README.md`](../infra/README.md). There's no Docker image or self-hosted stack.

## Variables

Set these in the Vercel project.

| Variable | When | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | build and runtime | The Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | build and runtime | The publishable (anon) key |
| `SUPABASE_URL` | runtime, optional | Where the **server** reaches Supabase, if that differs from the browser's address. Falls back to `NEXT_PUBLIC_SUPABASE_URL`. |
| `NEXT_PUBLIC_USE_STUB_DATABASE` | build and runtime | `false` in production |
| `USE_STUB_DATABASE` | runtime | `false` in production |
| `GOOGLE_MAPS_API_KEY` | runtime, optional | A Google Cloud API key with the **Places API (New)** enabled. Matches a place saved from a Maps link, and shows its Google rating, today's hours and photo. Server only, never sent to the browser. In the Cloud console, restrict it to the Places API (New). A key restricted to **websites** is refused, because server requests carry no referrer. Without it, places keep what the link says. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | runtime, optional | Chore reminders (Web Push). Make a key pair once with `pnpm dlx web-push generate-vapid-keys`; the subject is a `mailto:` address. Without them the Reminders card says reminders aren't set up. |
| `CRON_SECRET` | runtime, optional | A long random string. The reminder job only runs for requests with `Authorization: Bearer <CRON_SECRET>`. |
| `FILES_BUCKET`, `FILES_REGION` | runtime | The S3 bucket for shared files and its region. **Set by OpenTofu** (`infra/storage/vercel.tf`), not by hand. Without them, uploads and downloads in Gallery and Files fail. |
| `AWS_ROLE_ARN` | runtime | The role Vercel's functions assume with their OIDC token to sign S3 requests. **Set by OpenTofu**, which also turns on OIDC with the team issuer. |
| `SUPABASE_SECRET_KEY` | runtime, optional | The service role key, for the reminder job only (`lib/supabase/admin.ts`). The calendar feed doesn't need it. |

`NEXT_PUBLIC_*` values are compiled into the browser bundle, so changing them means **redeploying**. They're public by
design. No secrets are needed at build time.

The auth cookie has a fixed name, `sb-together-auth-token` (`lib/supabase/config.ts`), so the browser and the server
share one session even when they reach Supabase at different addresses.

## CI

Every pull request and every push to `main` must pass these before merging.

| Workflow | Runs |
|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | **Lint & typecheck.** **Tests:** unit tests, then the database tests (`supabase/schemas` on PGlite). **Build & smoke test:** `pnpm build` and `pnpm start` on the stub backend, then requests `/api/health`, `/sign-in`, `/home`, `/design-system`, `/sw.js` and `/manifest.webmanifest`. **Migrations apply to Supabase Postgres:** `supabase db start` applies every file in `supabase/migrations` to Supabase's Postgres image, with the same CLI version `migrate.yml` uses, and checks each one is recorded. |
| [`infra.yml`](../.github/workflows/infra.yml) | When `infra/` changes: `tofu fmt` and `validate`; on pull requests a read-only `tofu plan` of `infra/storage`; on `main` `tofu apply` (AWS and the Vercel project's file-storage settings). See [`infra/README.md`](../infra/README.md). |
| [`migrate.yml`](../.github/workflows/migrate.yml) | On every push to `main`: runs the database tests, then `supabase db push` to the hosted project `hskdrgvuexlapwqfeomg`. Only migrations the project hasn't recorded are applied. Needs the `SUPABASE_ACCESS_TOKEN` secret (and optionally `SUPABASE_DB_PASSWORD`), see [Hosted Supabase](#hosted-supabase). |

Vercel also builds a preview deployment for every pull request.

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
`supabase/config.toml` targets Postgres 15 (`major_version`), so CI checks migrations on the oldest version they
need to run on. Migrations written for 15 also run on a newer hosted project.

## Chore reminders

People turn reminders on from **You** (`/profile`). Each device's push subscription is saved in
`push_subscriptions`. Once a day `GET /api/cron/chore-reminders` sends "due today" to every device whose owner has
chores due or overdue in their Together's time zone, and forgets devices the push service says are gone.

`vercel.json` schedules it at 05:00 UTC (07:00 in South Africa). Set `CRON_SECRET` in the project and Vercel sends it
with the request.

On iPhone, push only works once Together is added to the Home Screen (Safari → Share → Add to Home Screen); the
Reminders card says so.
