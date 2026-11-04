# Módulo de administración (`/admin`)

Pantallas del sitio de la institución para el rol `administracion`. Cubre las tareas de
usuario de la sección 4.1.3 de la consigna y el escenario 8. Este módulo es dueño de
`web/src/admin/`; el esqueleto del sitio lo monta en `/admin`.

> **Estado actual: corte 1.** Login contra Flowable, sesión firmada, detección de rol y
> lista de tareas. Reclamar, completar y los formularios llegan en los cortes siguientes.

## Cómo se prueba (mientras no exista el esqueleto)

El arnés local vive en `dev-harness.js` y usa dependencias en `dev/`. **No se entrega**:
cuando aparezca `web/app.js` con `lib/flowable.js` y el layout EJS, se monta el router
desde ahí y se borran `dev-harness.js` y `dev/`.

```bash
# una sola vez, para instalar express del arnés
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

### Pruebas automáticas

```bash
cd web/src/admin
node --test test/*.test.js
node --test --experimental-test-coverage test/*.test.js
```

Cobertura del corte 1: **98,38 % de líneas** y **85,71 % de ramas** (incluyendo archivos
de prueba en el reporte).

### Qué mirar a mano

1. `GET /admin/login` muestra el formulario y una cookie `admin_sid` httpOnly firmada.
2. Login con `jefeAdmin` / `test` redirige a `/admin/` y lista las tareas asignadas y las
   candidatas al grupo `administracion`. El curso se resuelve con el `businessKey`.
3. Clave incorrecta: mensaje genérico, no se crea sesión.
4. `docente1` / `test`: 403 porque no pertenece a `administracion`.
5. Manipular la cookie o borrarla: vuelve al login.
6. `POST` sin `_csrf`: 403.
7. Cerrar sesión: destruye la sesión del servidor y borra la cookie.
8. Si Flowable está caído, la lista responde 502 sin filtrar credenciales.

## Qué pantalla cubre qué tarea

| Pantalla / ruta | Tarea de usuario | Estado |
|---|---|---|
| `/admin/login`, `/admin/logout` | — (autenticación contra Flowable) | Hecho |
| `/admin/` | Lista de tareas asignadas y candidatas al grupo `administracion` | Hecho |
| Próximo corte | `Propuesta` (Registrar y Elaborar propuesta, `jefeAdmin`) | Pendiente |
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
- Tareas candidatas ya reclamadas por otra persona se descartan; no se exponen por URL.
- Todas las consultas a Flowable se validan del lado del servidor.

## Estructura

| Archivo | Rol |
|---|---|
| `index.js` | Exporta el `express.Router` y la fábrica `createAdminRouter` para pruebas. |
| `auth.js` | Login, logout, sesión y regla de rol `administracion`. |
| `session.js` | Store en memoria, cookie firmada y CSRF. |
| `flowable-rest.js` | Cliente REST con la firma de `lib/flowable.js`; se reemplaza por el del esqueleto. |
| `tasks.js` | Consulta, deduplicación y normalización de tareas. |
| `views.js` | HTML mínimo con escape; se reemplaza por las vistas EJS del esqueleto. |
| `dev-harness.js`, `dev/` | Arnés local, **no entregable**. |
| `test/` | Pruebas con `node:test` y cliente REST mockeado. |
