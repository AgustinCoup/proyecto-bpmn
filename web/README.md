# Sitio web - Institucion de capacitacion

Stack: Node 18+, Express, EJS (server-side), `pg`. Sin frameworks de frontend.

## Instalacion

```powershell
cd web
npm install
```

## Variables de entorno

| Variable | Default | Descripcion |
|---|---|---|
| `PORT` | 3000 | Puerto HTTP |
| `NODE_ENV` | development | `production` activa cookie segura |
| `DEV_MODE` | true | Habilita campos de desarrollo en el formulario |
| `FLOWABLE_REST_URL` | http://localhost:8080/flowable-rest/service | Base de Flowable REST |
| `INSTITUCION_DB_URL` | postgresql://institucion:institucion@localhost:5432/institucion | BD institucion |
| `SESSION_SECRET` | dev-session-secret-change-me | Secreto de sesion (las tres partes del sitio; obligatorio en `production`) |
| `FLOWABLE_SERVICE_USER` / `FLOWABLE_SERVICE_PASS` | rest-admin / test | Credenciales de servicio contra Flowable REST |
| `PLAZO_RESPUESTA` | (vacio) | Valor por defecto para `plazoRespuesta` en modo dev |
| `SIMULAR_FALTA_AULAS` | false | Activa `simularFaltaAulas` por defecto en modo dev |
| `LOGIN_MAX_ATTEMPTS` | 5 | Intentos de login por ventana |
| `LOGIN_WINDOW_MS` | 900000 | Ventana de bloqueo (ms) |

Compatibilidad: `admin/` y `docentes/` aceptan tambien los nombres viejos `FLOWABLE_URL` e `INSTITUCION_DATABASE_URL`. La tabla `informe` la crea `scripts/crear-bd` (migracion `db/migraciones/001-informe.sql`).

## Ejecucion

```powershell
npm start
# o en desarrollo:
npm run dev
```

Abrir http://localhost:3000

## Uso del cliente Flowable REST

`src/lib/flowable.js` exporta:

```js
const { flowableRest } = require('./lib/flowable');
const r = await flowableRest('GET', '/runtime/process-instances/' + id, { auth: { usuario, clave } });
```

Parametros: `flowableRest(method, path, { body, query, auth })`. Si `auth` se omite, usa las credenciales de servicio de configuracion.

## Pruebas

```powershell
npm test
npm run test:coverage
```

Prueba de integracion (requiere entorno levantado):

```powershell
node --test tests/integration.test.js
```

## Demostracion escenario 10

1. Levantar entorno y sitio.
2. Empresa 1 (ya tiene cuenta): usuario `emp_30711223345`, clave `test`.
3. Crear una solicitud publica (empresa 2) y avanzar el proceso con el simulador hasta "Aceptacion".
4. Al aceptar, `HabilitarAccesoEmpresaDelegate` crea la cuenta `emp_<cuit>` con clave `test`.
5. Ingresar con esa cuenta y verificar que solo se ven los cursos de esa empresa.
   El detalle de un curso de otra empresa responde 404.

## Seguridad

- Consultas SQL parametrizadas (`pg`).
- Plantillas EJS escapan HTML por defecto.
- Cookie de sesion httpOnly; token CSRF en formularios POST.
- Limitador de intentos de login.
- Helmet para cabeceras basicas.
- Sin secretos en el codigo (todo por variables de entorno).
