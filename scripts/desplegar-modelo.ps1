# Despliega la regla DMN (viabilidadCurso) y el modelo BPMN real. Primero el DMN.
# Cada corrida crea una version nueva del proceso. Uso (desde la raiz del repo):
#   powershell -ExecutionPolicy Bypass -File scripts\desplegar-modelo.ps1
$base = 'http://localhost:8080/flowable-rest'
curl.exe -sf -u rest-admin:test -F 'file=@modelo/viabilidadCurso.dmn' "$base/dmn-api/dmn-repository/deployments" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falló el despliegue del DMN' } else { Write-Host 'DMN desplegado' }
curl.exe -sf -u rest-admin:test -F 'file=@modelo/Proyecto_Organizacion_cursos.bpmn20.xml' "$base/service/repository/deployments" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falló el despliegue del modelo' } else { Write-Host 'Modelo desplegado (Process_Curso)' }
