# Crea la BD "institucion" (usuario institucion) con db/schema.sql, db/datos.sql y las migraciones de db/migraciones/.
# datos.sql REINICIA las tablas con los datos de prueba. Correr con "docker compose up -d" andando.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\crear-bd.ps1
$ErrorActionPreference = 'Stop'
function Pg($db, $sql) { $sql | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U flowable -d $db -tA }

if (-not (Pg 'flowable' "select 1 from pg_roles where rolname='institucion'")) { Pg 'flowable' "create role institucion login password 'institucion'" | Out-Null }
if (-not (Pg 'flowable' "select 1 from pg_database where datname='institucion'")) { Pg 'flowable' "create database institucion owner institucion" | Out-Null }

foreach ($f in 'db/schema.sql', 'db/datos.sql', 'db/migraciones/001-informe.sql') {
    Get-Content -Raw -Encoding UTF8 $f | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U institucion -d institucion
    if ($LASTEXITCODE -ne 0) { throw "Falló $f" }
}
Write-Host 'BD institucion lista.'
