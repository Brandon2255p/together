# Together: just commands

# The database schema is declarative: edit supabase/schemas, then generate a migration from the difference.
# Never write files in supabase/migrations by hand.

default:
    @just --list

# Install dependencies
install:
    pnpm install

# Run the app (stub backend by default)
dev:
    pnpm dev

# Lint, typecheck, unit tests and database tests
ci:
    pnpm run ci

# Run the database tests (schemas on PGlite, no Docker)
test-db:
    pnpm test:db

# Start the local Supabase stack (needs Docker)
db-start:
    supabase start

# Stop the local Supabase stack
db-stop:
    supabase stop

# Generate a migration from supabase/schemas: diffs them against a shadow database built from the migrations so far.
# Doesn't touch your local database. `just create-migration add_notes` -> supabase/migrations/<timestamp>_add_notes.sql
create-migration name:
    supabase db schema declarative sync --name {{ name }} --no-apply

# Rebuild the local database from the migrations (and seed)
db-reset:
    supabase db reset

# Apply pending migrations to the linked Supabase project
db-push:
    supabase db push

# Link this folder to a Supabase project
db-link ref:
    supabase link --project-ref {{ ref }}

# Generate TypeScript types from the local database
gen-types:
    supabase gen types typescript --local > lib/supabase/database.types.ts
