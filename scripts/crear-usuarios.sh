#!/usr/bin/env bash
# Crea los 5 usuarios y 2 grupos en Flowable.
# Equivalente Linux/macOS de scripts/crear-usuarios.ps1.
#
# Uso:
#   ./scripts/crear-usuarios.sh
#
# Variables opcionales:
#   FLOWABLE_REST_URL       (por defecto http://localhost:8080/flowable-rest/service)
#   FLOWABLE_ADMIN_USER     (por defecto rest-admin)
#   FLOWABLE_ADMIN_PASSWORD (por defecto test)
#   DOCKER_COMPOSE          (por defecto docker compose -f docker-compose.yml)
set -euo pipefail

BASE="${FLOWABLE_REST_URL:-http://localhost:8080/flowable-rest/service}"
ADMIN_USER="${FLOWABLE_ADMIN_USER:-rest-admin}"
ADMIN_PASSWORD="${FLOWABLE_ADMIN_PASSWORD:-test}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$RAIZ/docker-compose.yml}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-flowable}"
POSTGRES_DB="${POSTGRES_DB:-flowable}"

post() {
  local ruta="$1"
  local cuerpo="$2"
  local codigo
  codigo=$(curl -sS -o /tmp/crear-usuarios-respuesta.json -w '%{http_code}' \
    -u "$ADMIN_USER:$ADMIN_PASSWORD" \
    -H 'Content-Type: application/json; charset=UTF-8' \
    -X POST "$BASE$ruta" --data-binary "$cuerpo" || true)
  if [[ "$codigo" == 2* ]]; then
    echo "ok       $ruta"
  else
    echo "omitido  $ruta (HTTP $codigo)"
  fi
}

post /identity/groups '{"id":"administracion","name":"Administracion","type":"assignment"}'
post /identity/groups '{"id":"docentes","name":"Docentes","type":"assignment"}'

while read -r usuario grupo; do
  post /identity/users "{\"id\":\"$usuario\",\"firstName\":\"$usuario\",\"email\":\"$usuario@institucion.test\",\"password\":\"test\"}"
  post "/identity/groups/$grupo/members" "{\"userId\":\"$usuario\"}"
done <<'USUARIOS'
jefeAdmin administracion
admin2 administracion
jefeDocente docentes
docente1 docentes
docente2 docentes
USUARIOS

# La API REST no asigna privilegios: se insertan directamente en las tablas
# de identidad del motor, igual que hace el script de PowerShell.
if docker compose -f "$COMPOSE_FILE" ps "$POSTGRES_SERVICE" >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
insert into act_id_priv_mapping (id_, priv_id_, user_id_)
select gen_random_uuid()::text, p.id_, u.id
from act_id_priv p
cross join (values ('jefeAdmin'),('admin2'),('jefeDocente'),('docente1'),('docente2')) u(id)
where p.name_ in ('access-rest-api','access-task')
and not exists (
  select 1 from act_id_priv_mapping m
  where m.priv_id_ = p.id_ and m.user_id_ = u.id
);
SQL
else
  echo "Aviso: no se pudo ejecutar docker compose para asignar access-rest-api/access-task."
  echo "Los usuarios existen, pero el simulador REST puede rechazarlos hasta asignar esos privilegios."
fi

echo "Listo. Usuarios de desarrollo: jefeAdmin, admin2, jefeDocente, docente1, docente2 (clave test)."
