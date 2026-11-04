# Applies supabase/migrations to the self-hosted database, then stays up (see migrate.sh).
# Built from ./supabase. It uses the database's own image, so psql matches the server and nothing extra is pulled.
FROM supabase/postgres:15.8.1.085
COPY migrations /migrations
COPY migrate/migrate.sh /usr/local/bin/migrate.sh
RUN chmod 755 /usr/local/bin/migrate.sh
# unhealthy after ~5 minutes without success, so a failed migration fails the deploy instead of hanging it
HEALTHCHECK --interval=5s --timeout=3s --start-period=30s --retries=60 CMD test -f /tmp/migrated
ENTRYPOINT ["/usr/local/bin/migrate.sh"]
