# Módulo de administración (`/admin`)

Pantallas del sitio de la institución para el rol `administracion`. Cubre las tareas de
usuario de la sección 4.1.3 de la consigna y el escenario 8. Este módulo es dueño de
`web/src/admin/`; el esqueleto del sitio lo monta en `/admin`.

> **Estado actual: corte 3.** Login contra Flowable, sesión firmada, detección de rol,
> lista de tareas, reclamo de tareas candidatas y el **formulario de `Propuesta`**, que
> guarda los datos en la tabla `curso` y completa la tarea. Los demás formularios llegan en
> los cortes siguientes. No se genera el PDF de la propuesta: está fuera del alcance.

## Cómo se prueba (mientras no exista el esqueleto)

El arnés local vive en `dev-harness.js` y usa dependencias en `dev/`. **No se entrega**:
cuando aparezca `web/app.js` con `lib/flowable.js` y el layout EJS, se monta el router
desde ahí y se borran `dev-harness.js` y `dev/`.

```bash
# una sola vez, para instalar express y pg del arnés
cd web/src/admin/dev
npm install

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
| `NODE_ENV` | — | Con `production` exige `SESSION_SECRET` y marca la cookie `Secure`. |
| `SESSION_TTL_MS` | 8 horas | Duración de la sesión. |
| `INSTITUCION_DATABASE_URL` | `postgresql://institucion:institucion@localhost:5432/institucion` | Base de la institución (tabla `curso`). También acepta `DATABASE_URL`. |

### Pruebas automáticas

```bash
cd web/src/admin
node --test test/*.test.js
node --test --experimental-test-coverage test/*.test.js
```

Cobertura del corte 3: **98,52 % de líneas** y **88,42 % de ramas** (incluyendo archivos
de prueba en el reporte).

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

### Qué mirar a mano (resto del corte)

1. `GET /admin/login` muestra el formulario y una cookie `admin_sid` httpOnly firmada.
2. Login con `jefeAdmin` / `test` redirige a `/admin/` y lista las tareas asignadas y las
   candidatas al grupo `administracion`. El curso se resuelve con el `businessKey`.
3. Clave incorrecta: mensaje genérico, no se crea sesión.
4. `docente1` / `test`: 403 porque no pertenece a `administracion`. **Es esperado:** el
   módulo de docentes es otro router y todavía no existe.
5. Manipular la cookie o borrarla: vuelve al login.
6. `POST` sin `_csrf`: 403.
7. Abrir una tarea ajena por URL: 403, aunque el id exista.
8. El formulario de `Propuesta` rechaza campos vacíos, presupuesto cero y fecha de fin
   anterior a la de inicio sin llamar a Flowable.
9. Al guardar una propuesta válida, primero se actualiza la base y después se completa la
   tarea en Flowable. Si Flowable falla, la propuesta ya quedó guardada.
10. Cerrar sesión: destruye la sesión del servidor y borra la cookie.
11. Si Flowable está caído, la lista responde 502 sin filtrar credenciales.

## Qué pantalla cubre qué tarea

| Pantalla / ruta | Tarea de usuario | Estado |
|---|---|---|
| `/admin/login`, `/admin/logout` | — (autenticación contra Flowable) | Hecho |
| `/admin/` | Lista de tareas asignadas y candidatas al grupo `administracion` | Hecho |
| `POST /admin/tasks/:id/claim` | Reclamar una tarea candidata del grupo | Hecho |
| `GET /admin/tasks/:id` | Abrir una tarea asignada (formulario o aviso) | Hecho |
| `POST /admin/tasks/:id/complete` | Completar una tarea asignada | Hecho para `Propuesta` |
| `Propuesta` (Registrar y Elaborar propuesta, `jefeAdmin`) | Guarda nombre, programa, presupuesto y fechas en `curso` | Hecho |
| Próximo corte | `Revisar` (Revisar propuesta, `jefeAdmin`) | Pendiente |
| Próximo corte | `Archivar` (Archivar solicitud, `jefeAdmin`) | Pendiente |
| Próximo corte | `Lista` (Confeccionar lista definitiva, grupo `administracion`) | Pendiente |
| Próximo corte | `Activity_12i2hpf` (Evaluar Recursos, grupo `administracion`) | Pendiente |
| Próximo corte | `EnviarInforme` (Enviar informe, `jefeAdmin`) | Pendiente |
| UI de Flowable | `Material`, `Virtual`, `Equipo`, `Activity_1m08pcl` | Enlace desde el sitio |

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
- Todas las consultas a Flowable se validan del lado del servidor.

## Estructura

| Archivo | Rol |
|---|---|
| `index.js` | Exporta el `express.Router` y la fábrica `createAdminRouter` para pruebas. |
| `auth.js` | Login, logout, sesión y regla de rol `administracion`. |
| `session.js` | Store en memoria, cookie firmada y CSRF. |
| `flowable-rest.js` | Cliente REST con la firma de `lib/flowable.js`; se reemplaza por el del esqueleto. |
| `tasks.js` | Consulta, deduplicación, normalización, reclamo y completado de tareas. |
| `courses.js` | Acceso parametrizado a la tabla `curso`; el pool de `pg` se crea al primer uso. |
| `proposal.js` | Validación y normalización del formulario de `Propuesta`. |
| `views.js` | HTML mínimo con escape; se reemplaza por las vistas EJS del esqueleto. |
| `dev-harness.js`, `dev/` | Arnés local, **no entregable**. Incluye `dev/tarea-grupo-prueba.js` y `dev/propuesta-prueba.js`. |
| `test/` | Pruebas con `node:test` y cliente REST mockeado. |

Cuando aparezca el esqueleto del sitio, su `package.json` tiene que incluir `pg` (el
arnés ya lo instala en `dev/`). Alternativamente, `createAdminRouter({ courses })` acepta
un store compatible con `findById` y `saveProposal`, por ejemplo para reutilizar el acceso
a datos que provea el esqueleto.
