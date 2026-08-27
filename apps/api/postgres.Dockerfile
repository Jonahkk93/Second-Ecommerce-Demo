FROM ghcr.io/pglayers/pgx-postgis:17 AS postgis
FROM postgres:17
COPY --from=postgis / /
