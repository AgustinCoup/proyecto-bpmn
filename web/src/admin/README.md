# Módulo de administración (`/admin`)

Pantallas del sitio de la institución para el rol `administracion`. Cubre las tareas de
usuario de la sección 4.1.3 de la consigna y el escenario 8. Este módulo es dueño de
`web/src/admin/`; el esqueleto del sitio lo monta en `/admin`.

> **Estado actual: completo para `/admin`.** Login contra Flowable, sesión firmada, rol, lista
> de tareas, reclamo y los formularios de `Propuesta`, `Revisar`, `Archivar`, `Lista`,
> `Evaluar Recursos` y `EnviarInforme` (con descarga del PDF). Las tareas del equipo docente
> viven en [`../docentes/`](../docentes/README.md). No se genera el PDF de la propuesta
> (fuera de alcance); sí el del informe de resultados.

## Cómo se prueba (mientras no exista el esqueleto)

El arnés local vive en `dev-harness.js` y usa dependencias en `dev/`. **No se entrega**:
cuando aparezca `web/app.js` con `lib/flowable.js` y el layout EJS, se monta el router
desde ahí y se borran `dev-harness.js` y `dev/`.

```bash
# una sola vez, para instalar express, pg y pdfkit del arnés
cd web/src/admin/dev
npm install

# una sola vez, la tabla `informe` (no toca schema.sql ni datos.sql)
docker exec -i flowable-postgres psql -U institucion -d institucion < db/migraciones/001-informe.sql

# levantar el arnés (Flowable ya tiene que estar arriba)
cd web/src/admin
node dev-harness.js
# o en otro puerto:
PORT=3100 node dev-harness.js
```

Luego abrir <http://localhost:3000/admin/login> y entrar con un usuario de Flowable del
grupo `administracion` (por ejemplo `jefeAdmin` / `test`).

Variables de entorno:

| Variable | Default | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto del arnés. |
| `FLOWABLE_URL` | `http://localhost:8080/flowable-rest/service` | Base de la API REST. |
| `SESSION_SECRET` | aleatorio en desarrollo | Firma de la cookie. En producción es obligatorio. |
| `FLOWABLE_UI_URL` | `http://localhost:8081/flowable-ui` | Enlace para las tareas que se hacen desde la UI de Flowable. |
| `NODE_ENV` | — | Con `production` exige `SESSION_SECRET` y marca la cookie `Secure`. |
| `SESSION_TTL_MS` | 8 horas | Duración de la sesión. |
| `INSTITUCION_DATABASE_URL` | `postgresql://institucion:institucion@localhost:5432/institucion` | Base de la institución (tabla `curso`). También acepta `DATABASE_URL`. |

### Pruebas automáticas

```bash
cd web/src
node --test admin/test/*.test.js docentes/test/*.test.js
node --test --experimental-test-coverage admin/test/*.test.js docentes/test/*.test.js
```

128 pruebas con el cliente REST simulado. Cobertura: **97,7 % de líneas, 87,7 % de ramas**
(el reporte incluye los archivos de prueba).

### Escenario 8 contra el entorno real

Con Docker arriba, el modelo y la BD desplegados y el arnés levantado
(`PORT=3100 node dev-harness.js`):

```bash
cd web/src/admin
node dev/escenario8-e2e.js
```

Recorre solicitud → `Propuesta` → aceptación con fecha → nómina → `Lista` → `Evaluar Recursos`
→ `Material`/`Equipo` → `Definir Docente` → `Dictar` → `Informe` (PDF) → `EnviarInforme` →
cierre con `curso.estado = FINALIZADO`, usando el sitio para todo lo de administración y
docentes y REST solo para la empresa (lo que hace el simulador) y la UI de Flowable. También
verifica los permisos (403 a quien no es el asignado o no reclamó, 400 a entradas inválidas).
Al terminar borra las instancias y restaura `db/datos.sql` (**borra los datos locales de
`institucion`**).

Requisito: la fila del curso tiene que tener `process_instance_id` igual a la instancia para
que el listener de fin de proceso actualice el estado; el script lo asigna (lo hace el sitio
público al crear la solicitud).

### Probar el reclamo con una tarea de verdad

El modelo real no tiene tareas de grupo disponibles ahora mismo. Para no tocar las
instancias del escenario 8, hay un proceso temporal de prueba:

```bash
cd web/src/admin
node dev/tarea-grupo-prueba.js
```

Ese comando:

1. Borra pruebas anteriores del mismo tipo.
2. Despliega un proceso temporal llamado `TareaGrupoPrueba`.
3. Inicia una instancia con una tarea candidata al grupo `administracion`.
4. Imprime el id de la tarea y la URL del sitio.

Después, en el navegador:

1. Entrá a <http://localhost:3000/admin/> con `jefeAdmin` / `test`.
2. Buscá la fila **“Tarea de prueba”**. Debe decir **“Disponible para reclamar”** y tener
   el botón **“Reclamar”**.
3. Hacé clic en **“Reclamar”**.
4. Esperado: volvés a `/admin/`, ves el mensaje verde **“Tarea reclamada. Ahora está
   asignada a vos.”** y la tarea pasa a **“Asignada a vos”** con el botón **“Abrir”**.
   Como la tarea de prueba no es `Propuesta`, al abrirla avisa que todavía no tiene
   formulario.
5. Para limpiar todo:

```bash
node dev/tarea-grupo-prueba.js borrar
```

Si el sitio está en otro puerto, pasá `ADMIN_URL`, por ejemplo
`ADMIN_URL=http://localhost:3100/admin/ node dev/tarea-grupo-prueba.js`.

### Probar el formulario de Propuesta con una tarea de verdad

Para no completar las instancias del escenario 8, hay otro proceso temporal que crea un
curso de prueba en la base `institucion`:

```bash
cd web/src/admin
node dev/propuesta-prueba.js
```

Ese comando:

1. Borra cursos, instancias y deployments de pruebas anteriores del mismo tipo.
2. Crea un curso temporal en la tabla `curso`.
3. Despliega un proceso temporal llamado `PropuestaPrueba`.
4. Inicia una instancia con una tarea `Propuesta` asignada a `jefeAdmin`.
5. Imprime el id del curso, de la tarea y la URL del sitio.

Después, en el navegador:

1. Entrá a <http://localhost:3000/admin/> con `jefeAdmin` / `test`.
2. Buscá **“Registrar y Elaborar propuesta”** para el curso de prueba.
3. Hacé clic en **“Completar”**.
4. Completá, por ejemplo:
   - Nombre: `Curso de prueba desde el sitio`.
   - Programa: `Contenido del curso de prueba.`
   - Presupuesto: `123456.78`.
   - Inicio: `2026-12-01`.
   - Fin: `2026-12-15`.
5. Guardá. Esperado: volvés a `/admin/`, ves el mensaje verde **“Propuesta guardada. La
   tarea se completó y el proceso continuó.”** y la tarea desaparece de la lista.
6. Verificá la base:

```bash
docker exec flowable-postgres psql -U institucion -d institucion \
  -c "select id, nombre, programa, presupuesto, fecha_inicio, fecha_fin from curso order by id;"
```

7. Para borrar todo:

```bash
node dev/propuesta-prueba.js borrar
```

Si querés probar con el curso real `1`, abrí su tarea `Propuesta` desde la lista. El
formulario muestra los datos que ya tenga el curso y, al guardar, actualiza esa fila.
Eso **sí avanza el proceso real**; el script temporal evita tocarlo.

### Probar el formulario de Revisar con una tarea de verdad

La tarea `Revisar` aparece cuando la empresa pide modificaciones. Para no esperar ese
mensaje ni tocar las instancias del escenario 8, hay un proceso temporal que crea el
pedido y la tarea:

```bash
cd web/src/admin
node dev/revision-prueba.js
```

Ese comando:

1. Borra cursos, instancias y deployments de pruebas anteriores del mismo tipo.
2. Crea un curso temporal con una propuesta ya cargada en la tabla `curso`.
3. Despliega un proceso temporal llamado `RevisionPrueba` que deja `observaciones` y
   `propuestaVersion = 1`.
4. Inicia una instancia con una tarea `Revisar` asignada a `jefeAdmin`.
5. Imprime el id del curso, de la tarea y la URL del sitio.

Después, en el navegador:

1. Entrá a <http://localhost:3000/admin/> con `jefeAdmin` / `test`.
2. Buscá **“Revisar propuesta”** para el curso de prueba y hacé clic en **“Revisar”**.
3. Esperado: ves el pedido de la empresa, la **versión actual 1** y el aviso de que al
   guardar se enviará la **versión 2**, con los datos actuales de la propuesta editables.
4. Cambiá, por ejemplo, el presupuesto a `175000.00` y guardá.
5. Esperado: volvés a `/admin/`, ves el mensaje verde **“Revisión guardada. La tarea se
   completó y se envió una nueva versión a la empresa.”** y la tarea desaparece.
6. Verificá la base:

```bash
docker exec flowable-postgres psql -U institucion -d institucion \
  -c "select id, nombre, presupuesto from curso order by id;"
```

7. Para borrar todo:

```bash
node dev/revision-prueba.js borrar
```

`observaciones` y `propuestaVersion` se leen de las variables de la instancia
(`GET /runtime/process-instances/{id}/variables`). El sitio no las envía de vuelta: el
task listener del modelo incrementa la versión al completar la tarea.

### Probar el formulario de Archivar con una tarea de verdad

`Archivar` se alcanza cuando la empresa rechaza la propuesta (`RECHAZADO`) o no responde
después de dos recordatorios (`SIN_RESPUESTA`). El proceso temporal deja ese resultado y
la tarea lista:

```bash
cd web/src/admin
node dev/archivar-prueba.js                    # RECHAZADO
node dev/archivar-prueba.js crear SIN_RESPUESTA
```

Ese comando:

1. Borra cursos, instancias y deployments de pruebas anteriores del mismo tipo.
2. Crea un curso temporal con una propuesta cargada.
3. Despliega un proceso temporal llamado `ArchivarPrueba` que setea `resultado`.
4. Inicia una instancia con una tarea `Archivar` asignada a `jefeAdmin`.
5. Imprime el id del curso, de la tarea y la URL del sitio.

Después, en el navegador:

1. Entrá a <http://localhost:3000/admin/> con `jefeAdmin` / `test`.
2. Buscá **“Archivar solicitud”** y hacé clic en **“Archivar”**.
3. Esperado: ves el resultado (`RECHAZADO` o `SIN_RESPUESTA`), su explicación, el resumen
   de la propuesta y el botón **“Archivar solicitud y cerrar”**.
4. Confirmá. Esperado: volvés a `/admin/`, ves **“Solicitud archivada. El expediente quedó
   cerrado.”** y la tarea desaparece.
5. Para borrar todo:

```bash
node dev/archivar-prueba.js borrar
```

Si `resultado` no es `RECHAZADO` ni `SIN_RESPUESTA`, el sitio muestra el resultado pero no
ofrece completar la tarea (responde 409 si se intenta por `POST`). El estado final del
curso lo escribe el Execution Listener de fin de proceso, no el sitio.

### Qué mirar a mano (resto del corte)

1. `GET /admin/login` muestra el formulario y una cookie `admin_sid` httpOnly firmada.
2. Login con `jefeAdmin` / `test` redirige a `/admin/` y lista las tareas asignadas y las
   candidatas al grupo `administracion`. El curso se resuelve con el `businessKey`.
3. Clave incorrecta: mensaje genérico, no se crea sesión.
4. `docente1` / `test`: 403 porque no pertenece a `administracion` (los docentes entran por
   `/docentes`).
5. Manipular la cookie o borrarla: vuelve al login.
6. `POST` sin `_csrf`: 403.
7. Abrir una tarea ajena por URL: 403, aunque el id exista.
8. El formulario de `Propuesta` rechaza campos vacíos, presupuesto cero y fecha de fin
   anterior a la de inicio sin llamar a Flowable.
9. El formulario de `Revisar` muestra `observaciones` y `propuestaVersion` escapados, y
   aplica las mismas validaciones antes de guardar o completar.
10. El formulario de `Archivar` muestra `resultado` y solo permite completar si vale
    `RECHAZADO` o `SIN_RESPUESTA`; no escribe en la base.
11. Al guardar una propuesta o una revisión válida, primero se actualiza la base y después
    se completa la tarea en Flowable. Si Flowable falla, los datos ya quedaron guardados.
12. Cerrar sesión: destruye la sesión del servidor y borra la cookie.
13. Si Flowable está caído, la lista responde 502 sin filtrar credenciales.

## Qué pantalla cubre qué tarea

| Pantalla / ruta | Tarea de usuario | Estado |
|---|---|---|
| `/admin/login`, `/admin/logout` | — (autenticación contra Flowable) | Hecho |
| `/admin/` | Lista de tareas asignadas y candidatas al grupo `administracion` | Hecho |
| `POST /admin/tasks/:id/claim` | Reclamar una tarea candidata del grupo | Hecho |
| `GET /admin/tasks/:id` | Abrir una tarea asignada (formulario o aviso) | Hecho |
| `POST /admin/tasks/:id/complete` | Completar una tarea asignada | Hecho para `Propuesta`, `Revisar`, `Lista`, `Evaluar Recursos` y `Archivar` |
| `Propuesta` (Registrar y Elaborar propuesta, `jefeAdmin`) | Guarda nombre, programa, presupuesto y fechas en `curso` | Hecho |
| `Revisar` (Revisar propuesta, `jefeAdmin`) | Muestra `observaciones`/`propuestaVersion` y guarda los cambios en `curso` | Hecho |
| `Archivar` (Archivar solicitud, `jefeAdmin`) | Muestra `resultado` y confirma el cierre; no escribe en la base | Hecho |
| `Lista` (Confeccionar lista definitiva, grupo `administracion`) | Guarda la variable `listaDefinitiva` (JSON) al completar | Hecho |
| `Activity_12i2hpf` (Evaluar Recursos, grupo `administracion`) | Envía siempre `requiereAula`, `requierePlataforma` y `requiereEquipamiento`; exige al menos una | Hecho |
| `EnviarInforme` (Enviar informe, `jefeAdmin`) | Muestra el curso, enlaza al PDF y completa (el listener del modelo pone `resultado = FINALIZADO`) | Hecho |
| `GET /admin/informes/:id.pdf` | Descarga del PDF del informe (adjunto, nombre fijo derivado del id del curso) | Hecho |
| UI de Flowable | `Material`, `Virtual`, `Equipo`, `Activity_1m08pcl` | El sitio las lista y la pantalla de la tarea enlaza a la UI |
| `/docentes/…` | `Activity_1018bdz`, `Dictar`, `Informe` | Ver [`../docentes/README.md`](../docentes/README.md) |

Las tareas `Material`, `Virtual`, `Equipo` y `Activity_1m08pcl` se completan desde la UI
de Flowable (la consigna lo permite). El sitio solo las lista y enlaza.

## Seguridad implementada en este corte

- Cada llamada a Flowable viaja con Basic Auth **del usuario logueado**; nunca con
  `rest-admin`.
- La clave no se guarda en la cookie: la cookie solo lleva un `sid` aleatorio firmado con
  HMAC; usuario, clave y grupos viven en memoria del servidor.
- Rotación del `sid` al iniciar sesión (evita fijación de sesión).
- Cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción.
- CSRF por sesión en todos los `POST`.
- Escape de HTML en todas las vistas.
- Reclamar valida contra `identitylinks` que la tarea sea candidata del usuario o de su
  grupo; no alcanza con que el botón esté en la pantalla. Si otra persona la reclamó,
  responde 403 o muestra un aviso.
- Tareas candidatas ya reclamadas por otra persona se descartan; no se exponen por URL.
- Completar exige que la tarea esté asignada al usuario logueado. No alcanza con el id ni
  con pertenecer al grupo.
- El `businessKey` de la instancia se valida como id de curso numérico y la base se
  consulta con SQL parametrizado.
- El formulario se valida en el servidor antes de tocar la base o Flowable.
- Las variables `observaciones`, `propuestaVersion` y `resultado` se leen de Flowable, se
  validan, se acotan y se escapan antes de mostrarlas; el sitio no las envía.
- `Archivar` solo completa la tarea si el resultado es `RECHAZADO` o `SIN_RESPUESTA`.
- Todas las consultas a Flowable se validan del lado del servidor.
- Las variables viajan **en la misma llamada que completa la tarea** (`POST /runtime/tasks/{id}`
  con `variables`), no con un `POST …/variables` previo: así el motor las escribe y avanza en una
  sola transacción. Antes, un fallo a mitad dejaba la variable creada y el reintento recibía 409
  («la tarea ya había sido completada»): era la causa de que la lista definitiva «fallara».
- Límite de intentos de login: 5 fallos por (IP, usuario) en 10 minutos → 429 (en memoria).
- Descarga de informes: solo con sesión del grupo, id numérico validado con regex, se comprueba
  que el contenido empiece con `%PDF-`, `Content-Disposition: attachment` con nombre derivado
  solo de números, `nosniff` y `Content-Security-Policy: sandbox`.
- No se aceptan archivos subidos: el PDF lo genera el servidor con pdfkit a partir de campos de
  texto validados (largo, tipo, caracteres de control). No hay superficie de *upload*.

## Estructura

| Archivo | Rol |
|---|---|
| `index.js` | Exporta el `express.Router` y la fábrica `createAdminRouter` para pruebas. |
| `auth.js` | Login, logout, sesión y regla de rol `administracion`. |
| `session.js` | Store en memoria, cookie firmada y CSRF. |
| `flowable-rest.js` | Cliente REST con la firma de `lib/flowable.js`; se reemplaza por el del esqueleto. |
| `tasks.js` | Consulta, deduplicación, normalización, reclamo, variables y completado de tareas. |
| `courses.js` | Acceso parametrizado a la tabla `curso`; el pool de `pg` se crea al primer uso. |
| `proposal.js` | Validación y normalización de los formularios de `Propuesta` y `Revisar`. |
| `review.js` | Normaliza `observaciones` y `propuestaVersion` de la tarea `Revisar`. |
| `archive.js` | Normaliza `resultado` y decide si la solicitud se puede archivar. |
| `participants.js` | Lee la nómina y valida/serializa la `listaDefinitiva`. |
| `resources.js` | Valida las salidas booleanas de `Evaluar Recursos`. |
| `views.js`, `views-report.js`, `layout.js` | HTML mínimo con escape; se reemplaza por las vistas EJS del esqueleto. |
| `claim.js`, `router-common.js`, `db.js` | Reclamo, cabeceras/404/errores, curso de la tarea y pool de `pg`: se comparten con `docentes/`. |
| `reports.js`, `report.js`, `pdf.js` | Tabla `informe`, validación del formulario del informe y generación del PDF. |
| `dev-harness.js`, `dev/` | Arnés local, **no entregable**. Incluye `dev/tarea-grupo-prueba.js`, `dev/propuesta-prueba.js`, `dev/revision-prueba.js` y `dev/archivar-prueba.js`. |
| `test/` | Pruebas con `node:test` y cliente REST mockeado. |

Cuando aparezca el esqueleto del sitio, su `package.json` tiene que incluir `pg` y `pdfkit` (el
arnés ya lo instala en `dev/`). Alternativamente, `createAdminRouter({ courses })` acepta
un store compatible con `findById` y `saveProposal`, por ejemplo para reutilizar el acceso
a datos que provea el esqueleto.
