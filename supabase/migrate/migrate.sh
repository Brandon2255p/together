#!/bin/sh
# Applies /migrations/*.sql in order, each in its own transaction, and records it in
# supabase_migrations.schema_migrations: the table `supabase db push` uses, so the two can be mixed.
#
# Then it stays running. Coolify reads an exited container as a crash, so this one idles instead. It's healthy
# (/tmp/migrated exists) only once every migration is applied. If one fails, it stays unhealthy, and the app,
# which waits for it, doesn't start against a half-migrated database. Fix the migration and redeploy.
#
# Connection: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE.
set -u
rm -f /tmp/migrated

trap 'exit 0' TERM INT
idle() { while :; do sleep 3600 & wait $!; done; }

psql_() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

apply() {
  psql_ -c 'create schema if not exists supabase_migrations;
            create table if not exists supabase_migrations.schema_migrations
              (version text primary key, statements text[], name text);' || return 1
  for f in /migrations/*.sql; do
    [ -e "$f" ] || continue
    base=$(basename "$f" .sql)
    version=${base%%_*}
    name=${base#*_}
    case "$version$name" in *[!a-zA-Z0-9_]*) echo "migrate: bad file name $base" >&2; return 1 ;; esac
    done_=$(psql_ -tA -c "select 1 from supabase_migrations.schema_migrations where version = '$version'") || return 1
    [ "$done_" = 1 ] && continue
    echo "migrate: applying $base"
    { cat "$f"; printf '\ninsert into supabase_migrations.schema_migrations (version, name) values (%s, %s);\n' \
        "'$version'" "'$name'"; } | psql_ --single-transaction -f - || { echo "migrate: $base failed" >&2; return 1; }
  done
}

until pg_isready -q; do echo "migrate: waiting for $PGHOST:${PGPORT:-5432}"; sleep 2; done

# a few tries, in case another service is still setting up the database it depends on
tries=0
until apply; do
  tries=$((tries + 1))
  if [ "$tries" -ge 5 ]; then
    echo "migrate: FAILED, the database is unchanged by the failing migration. Fix it and redeploy." >&2
    idle
  fi
  sleep 5
done

touch /tmp/migrated
echo "migrate: up to date ($(ls /migrations/*.sql 2>/dev/null | wc -l | tr -d ' ') migrations)"
idle
