#!/usr/bin/env bash
# Crea la BD "institucion" (usuario institucion) con db/schema.sql, db/datos.sql y db/migraciones/.
# Idempotente en la creacion; datos.sql REINICIA las tablas (TRUNCATE) con los datos de prueba.
# Uso: ./scripts/crear-bd.sh      (con "docker compose up -d" andando)
set -e
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$RAIZ/docker-compose.yml}"
psql_pg() { docker compose -f "$COMPOSE_FILE" exec -T postgres psql -v ON_ERROR_STOP=1 -U flowable "$@"; }

psql_pg -d flowable -tc "select 1 from pg_roles where rolname='institucion'" | grep -q 1 \
  || psql_pg -d flowable -c "create role institucion login password 'institucion'"
psql_pg -d flowable -tc "select 1 from pg_database where datname='institucion'" | grep -q 1 \
  || psql_pg -d flowable -c "create database institucion owner institucion"

docker compose -f "$COMPOSE_FILE" exec -T postgres psql -v ON_ERROR_STOP=1 -U institucion -d institucion < "$RAIZ/db/schema.sql"
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -v ON_ERROR_STOP=1 -U institucion -d institucion < "$RAIZ/db/datos.sql"
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -v ON_ERROR_STOP=1 -U institucion -d institucion < "$RAIZ/db/migraciones/001-informe.sql"
echo "BD institucion lista."
