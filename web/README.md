# Sitio web de la institución

Aplicación web de la consigna §4.1, desarrollada en Node.js (Express y plantillas EJS). Se comunica con Flowable mediante su API REST y con la base `institucion` mediante `pg`. La ejecución está descrita en la sección 6 del [`README.md`](../README.md) principal.

## Módulos

| Ruta | Módulo | Función |
|---|---|---|
| `/solicitar` | `src/publico/` | Solicitud pública de capacitación: registra la empresa y el curso e inicia la instancia del proceso |
| `/empresa` | `src/empresa/` | Acceso de las empresas: consulta de sus cursos, estado y actividades en curso |
| `/admin` | `src/admin/` | Tareas del grupo Administración |
| `/docentes` | `src/docentes/` | Tareas del equipo docente; generación del PDF del informe de resultados |

`src/lib/` contiene la configuración, el cliente REST de Flowable, el acceso a la base de datos y las validaciones; `src/views/` y `src/public/`, las plantillas y estilos del sitio público; `tests/`, las pruebas (`npm test`); `tests/e2e/pausa-cancelacion.e2e.js` es un recorrido real contra Flowable (cancelación y pausa), que se ejecuta aparte.

## Tareas por pantalla

| Tarea | Responsable | Dónde se completa |
|---|---|---|
| Registrar y Elaborar propuesta, Enviar propuesta, Revisar propuesta, Archivar solicitud | `jefeAdmin` | `/admin` |
| Confeccionar lista definitiva | administrativo asignado por el listener | `/admin` |
| Evaluar Recursos (exige al menos una opción) | grupo `administracion` (con reclamo) | `/admin` |
| Enviar informe a empresa y Archivar expediente (con descarga del PDF) | `jefeAdmin` | `/admin` |
| Definir Docente que desarrolla el curso | `jefeDocente` | `/docentes` |
| Desarrollar curso | docente seleccionado | `/docentes` |
| Elaborar informe de resultados (genera el PDF) | `jefeDocente` | `/docentes` |
| Preparar materiales | grupo `administracion` | Aplicación de escritorio o interfaz de Flowable |
| Solicitar Aula Virtual, Contratar equipamiento, Liberar Equipamiento | grupo `administracion` | Interfaz de Flowable (el sitio las lista y enlaza) |
| Confirmar liberación de recursos (pausa que queda tras una cancelación o una falta de aulas) | `jefeAdmin` | `/admin` (si *Liberar Equipamiento* sigue abierta, el sitio avisa y no deja confirmar) |

## Configuración

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `NODE_ENV` | `development` | Con `production` exige `SESSION_SECRET` y marca la cookie de sesión como segura |
| `SESSION_SECRET` | valor de desarrollo | Secreto de firma de las sesiones |
| `FLOWABLE_REST_URL` | `http://localhost:8080/flowable-rest/service` | API REST de Flowable |
| `FLOWABLE_SERVICE_USER`, `FLOWABLE_SERVICE_PASS` | `rest-admin`, `test` | Usuario de servicio para la solicitud pública y el acceso de empresas |
| `FLOWABLE_UI_URL` | `http://localhost:8081/flowable-ui` | Enlace a la interfaz de Flowable |
| `INSTITUCION_DB_URL` | `postgresql://institucion:institucion@localhost:5432/institucion` | Base de datos de la institución |
| `SESSION_TTL_MS` | 8 horas | Duración de la sesión del personal |
| `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MS` | `5`, `900000` | Límite de intentos de ingreso |
| `DEV_MODE` | `true` | Muestra en la solicitud los campos de prueba `plazoRespuesta` y `simularFaltaAulas` |
| `PLAZO_RESPUESTA`, `SIMULAR_FALTA_AULAS` | vacío, `false` | Valores por defecto de esos campos de prueba |

Las variables deben definirse en la misma terminal en la que se ejecuta `npm start`. Los módulos `admin/` y `docentes/` aceptan también los nombres `FLOWABLE_URL` e `INSTITUCION_DATABASE_URL`.

## Seguridad

- El personal ingresa con su usuario de Flowable, y cada llamada al motor se realiza con esas credenciales, nunca con el usuario de servicio. La clave se conserva solo en la memoria del servidor.
- El sitio verifica que una tarea esté asignada a quien la completa y que sea candidata de su grupo antes de reclamarla, porque la API REST de Flowable no lo impide.
- Las credenciales viajan en cada llamada con autenticación HTTP Basic: fuera del entorno local el sitio y Flowable deben publicarse por HTTPS.
- Un usuario con la clave correcta pero sin el privilegio `access-rest-api` recibe un mensaje propio (403), distinto del de clave inválida.
- Consultas SQL parametrizadas, escape de HTML en las vistas, token CSRF en todos los formularios, cookies `httpOnly`, cabeceras de seguridad (Helmet) y límite de intentos de ingreso.
