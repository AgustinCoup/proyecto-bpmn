# Crea los 5 usuarios y 2 grupos en Flowable.
# Se puede correr varias veces: lo que ya existe se informa y se sigue.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\crear-usuarios.ps1

$base = 'http://localhost:8080/flowable-rest/service/identity'
$auth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('rest-admin:test'))

function Post($ruta, $cuerpo) {
    try {
        Invoke-RestMethod -Method Post -Uri "$base$ruta" -Headers @{ Authorization = "Basic $auth" } `
            -ContentType 'application/json; charset=utf-8' `
            -Body ([Text.Encoding]::UTF8.GetBytes(($cuerpo | ConvertTo-Json))) | Out-Null
        Write-Host "ok      $ruta"
    } catch { Write-Host "omitido $ruta (ya existe o falló: $($_.Exception.Message))" }
}

Post '/groups' @{ id = 'administracion'; name = "Administracion"; type = 'assignment' }
Post '/groups' @{ id = 'docentes'; name = 'Docentes'; type = 'assignment' }

$usuarios = @{
    jefeAdmin = 'administracion'; admin2 = 'administracion'
    jefeDocente = 'docentes'; docente1 = 'docentes'; docente2 = 'docentes'
}
foreach ($id in $usuarios.Keys) {
    Post '/users' @{ id = $id; firstName = $id; email = "$id@institucion.test"; password = 'test' }
    Post "/groups/$($usuarios[$id])/members" @{ userId = $id }
}

# La API REST no maneja privilegios: se insertan en la BD (access-rest-api y access-task, por usuario).
$ids = ($usuarios.Keys | ForEach-Object { "('$_')" }) -join ','
"insert into act_id_priv_mapping (id_, priv_id_, user_id_)
 select gen_random_uuid()::text, p.id_, u.id from act_id_priv p cross join (values $ids) u(id)
 where p.name_ in ('access-rest-api','access-task')
 and not exists (select 1 from act_id_priv_mapping m where m.priv_id_ = p.id_ and m.user_id_ = u.id);" |
    docker compose exec -T postgres psql -U flowable -d flowable
