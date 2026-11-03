#!/usr/bin/env bash
# Crea la BD "institucion" (usuario institucion) con db/schema.sql y db/datos.sql.
# Idempotente en la creacion; datos.sql REINICIA las tablas (TRUNCATE) con los datos de prueba.
# Uso: ./scripts/crear-bd.sh      (desde la raiz del repo, con "docker compose up -d" andando)
set -e
psql_pg() { docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U flowable "$@"; }

psql_pg -d flowable -tc "select 1 from pg_roles where rolname='institucion'" | grep -q 1 \
  || psql_pg -d flowable -c "create role institucion login password 'institucion'"
psql_pg -d flowable -tc "select 1 from pg_database where datname='institucion'" | grep -q 1 \
  || psql_pg -d flowable -c "create database institucion owner institucion"

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U institucion -d institucion < db/schema.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U institucion -d institucion < db/datos.sql
echo "BD institucion lista."
