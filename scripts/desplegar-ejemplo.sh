#!/usr/bin/env bash
# Despliega el proceso de ejemplo usado por el simulador y la app Java.
# No despliega el modelo real.
#
# Uso:
#   ./scripts/desplegar-ejemplo.sh [archivo.bpmn20.xml]
#
# Variables opcionales:
#   FLOWABLE_REST_URL       (por defecto http://localhost:8080/flowable-rest/service)
#   FLOWABLE_ADMIN_USER     (por defecto rest-admin)
#   FLOWABLE_ADMIN_PASSWORD (por defecto test)
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVO="${1:-$RAIZ/src/test/resources/procesos/ejemplo-materiales.bpmn20.xml}"
BASE="${FLOWABLE_REST_URL:-http://localhost:8080/flowable-rest/service}"
ADMIN_USER="${FLOWABLE_ADMIN_USER:-rest-admin}"
ADMIN_PASSWORD="${FLOWABLE_ADMIN_PASSWORD:-test}"

if [[ ! -f "$ARCHIVO" ]]; then
  echo "No existe el archivo: $ARCHIVO" >&2
  exit 1
fi

respuesta=$(curl -sS -u "$ADMIN_USER:$ADMIN_PASSWORD" \
  -F "file=@$ARCHIVO" \
  "$BASE/repository/deployments" \
  -w '\n%{http_code}')
codigo=$(printf '%s\n' "$respuesta" | tail -n1)
cuerpo=$(printf '%s\n' "$respuesta" | sed '$d')

if [[ "$codigo" != 2* ]]; then
  echo "Falló el despliegue (HTTP $codigo):" >&2
  echo "$cuerpo" >&2
  exit 1
fi

echo "Desplegado $ARCHIVO"
printf '%s\n' "$cuerpo" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$cuerpo"
echo
echo "Para iniciar una instancia de ejemplo:"
echo "curl -u $ADMIN_USER:$ADMIN_PASSWORD -H 'Content-Type: application/json' -X POST \\"
echo "  '$BASE/runtime/process-instances' \\"
echo "  -d '{\"message\":\"Solicitud de curso (ejemplo)\",\"businessKey\":\"101\",\"variables\":[{\"name\":\"cursoId\",\"value\":101,\"type\":\"integer\"}]}'"
