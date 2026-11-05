#!/usr/bin/env bash
# Despliega la regla DMN (viabilidadCurso) y el modelo BPMN real. Primero el DMN (Contrato.md 11.19).
# Cada corrida crea una version nueva del proceso. Uso: ./scripts/desplegar-modelo.sh
set -e
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${FLOWABLE_BASE:-http://localhost:8080/flowable-rest}"
AUTH="rest-admin:test"
curl -sf -u "$AUTH" -F "file=@$RAIZ/modelo/viabilidadCurso.dmn" "$BASE/dmn-api/dmn-repository/deployments" > /dev/null && echo "DMN desplegado"
curl -sf -u "$AUTH" -F "file=@$RAIZ/modelo/Proyecto_Organizacion_cursos.bpmn20.xml" "$BASE/service/repository/deployments" > /dev/null && echo "Modelo desplegado (Process_Curso)"
