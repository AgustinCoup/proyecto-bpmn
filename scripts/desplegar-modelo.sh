#!/usr/bin/env bash
# Despliega la regla DMN (viabilidadCurso) y el modelo BPMN real. Primero el DMN (Contrato.md 11.19).
# Cada corrida crea una version nueva del proceso. Uso: ./scripts/desplegar-modelo.sh
set -e
BASE="${FLOWABLE_BASE:-http://localhost:8080/flowable-rest}"
AUTH="rest-admin:test"
curl -sf -u "$AUTH" -F "file=@modelo/viabilidadCurso.dmn" "$BASE/dmn-api/dmn-repository/deployments" > /dev/null && echo "DMN desplegado"
curl -sf -u "$AUTH" -F "file=@modelo/Proyecto_Organizacion_cursos.bpmn20.xml" "$BASE/service/repository/deployments" > /dev/null && echo "Modelo desplegado (Process_Curso)"
