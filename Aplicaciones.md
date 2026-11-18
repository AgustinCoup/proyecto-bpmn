# Aplicaciones auxiliares: simulador CLI y app Java de materiales

Cómo ejecutar las dos aplicaciones de la consigna §4.2 contra el proceso real `Process_Curso`. No reemplaza al `README.md` general: antes hay que tener el entorno levantado y el modelo desplegado (pasos 1 a 5 de "Puesta en marcha").

## Qué hay en el repositorio

| Ruta | Contenido |
|---|---|
| `src/main/java/unrc/cursos/simulador/` | Simulador de comunicaciones de la empresa por consola, usando la API REST. |
| `src/main/java/unrc/cursos/escritorio/` | App de escritorio Swing que usa la API Java de Flowable contra PostgreSQL. |
| `src/main/java/unrc/cursos/analisis/` | Consultas de la consigna 4.3 sobre el historial (API Java). En la app de escritorio: botón **Analisis del historial**; por consola: `unrc.cursos.analisis.AnalisisMain`. Ver `mineria/README.md`. |
| `src/test/java/unrc/cursos/simulador/DetectorAccionesTest.java` | Tests (sin red) de qué acciones están habilitadas. |
| `src/test/java/unrc/cursos/escritorio/ServicioTareasTest.java` | Tests de la app Java contra H2, con un proceso mínimo (`src/test/resources/procesos/ejemplo-materiales.bpmn20.xml`, **no es el modelo real**). |

Usuarios: `jefeAdmin`, `admin2`, `jefeDocente`, `docente1`, `docente2` (clave `test`); grupos `administracion` y `docentes` (se crean con `scripts/crear-usuarios`).

## 1. Simulador de comunicaciones por CLI

Variables de entorno:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `FLOWABLE_REST_URL` | No | Por defecto `http://localhost:8080/flowable-rest/service`. |
| `FLOWABLE_REST_USER` | Sí, o se pide por consola | Usuario con acceso a la API REST, por ejemplo `jefeAdmin`. |
| `FLOWABLE_REST_PASSWORD` | Sí, o se pide por consola | Clave del usuario. |

```bash
export FLOWABLE_REST_USER=jefeAdmin
export FLOWABLE_REST_PASSWORD=test
mvn -q exec:java -Dexec.mainClass=unrc.cursos.simulador.SimuladorMain
```

Uso:

1. Muestra las instancias activas; se elige una por número.
2. Consulta las ejecuciones activas y las suscripciones a eventos de la instancia.
3. Muestra **solo** las comunicaciones habilitadas en ese estado:
   - Aceptar la propuesta, pidiendo `fechaCurso` en ISO 8601 con zona horaria (obligatoria).
   - Rechazar la propuesta.
   - Pedir modificaciones, pidiendo `observaciones`.
   - Enviar la nómina, pidiendo un array JSON para `participantes`.
   - Cancelar durante la preparación.
4. Después de cada envío refresca el estado; si la instancia terminó, lo informa.
5. Valida fechas, JSON y textos obligatorios, y muestra los errores HTTP de Flowable sin ocultarlos.

Los mensajes son los del modelo: `Aceptación`, `Rechazo`, `Solicitud de modificaciones` y `Cancelación` (`PUT /runtime/executions/{id}` con `messageEventReceived`). La nómina se envía con la acción `signal` sobre la ejecución de la tarea de recepción `Nomina`. En consolas de Windows ejecutar antes `chcp 65001` para ver bien las tildes.

## 2. App de escritorio: Preparar materiales

Usa directamente la **API Java de Flowable** contra la misma base PostgreSQL del motor (no usa la API REST).

| Variable | Obligatoria | Descripción |
|---|---|---|
| `FLOWABLE_DB_URL` | No | Por defecto `jdbc:postgresql://localhost:5432/flowable`. |
| `FLOWABLE_DB_USER` | **Sí** | Usuario JDBC de la base del motor (`flowable`). |
| `FLOWABLE_DB_PASSWORD` | **Sí** | Clave JDBC (`flowable`). |
| `FLOWABLE_DB_DRIVER` | No | Por defecto `org.postgresql.Driver`. |
| `FLOWABLE_DB_SCHEMA_UPDATE` | No | Por defecto `false` (no modifica el esquema existente). |

Las credenciales no están en el código. También se puede usar un archivo de propiedades con `FLOWABLE_DB_CONFIG=/ruta/archivo.properties` (claves `flowable.db.url`, `flowable.db.user`, `flowable.db.password`, `flowable.db.driver`, `flowable.db.schemaUpdate`).

```bash
export FLOWABLE_DB_USER=flowable FLOWABLE_DB_PASSWORD=flowable
mvn -q exec:java -Dexec.mainClass=unrc.cursos.escritorio.AppMateriales
```

Uso:

1. Ingresar con un usuario de Flowable (por ejemplo `admin2` / `test`).
2. La tabla muestra las tareas **Preparar materiales** asignadas al usuario o disponibles para reclamar por sus grupos.
3. Seleccionar una disponible y **Reclamar tarea** (el motor valida que el usuario sea candidato).
4. Seleccionar una reclamada por el usuario y **Completar tarea**.
5. **Actualizar** vuelve a consultar; **Cambiar usuario** permite ingresar con otro.

La app no deja reclamar tareas de otros grupos ni completar tareas que no estén asignadas al usuario que ingresó. Si es la última rama de *Preparar curso*, el motor de la app sigue el flujo hasta *Enviar confirmación* y manda el correo a la empresa desde la JVM de la app (necesita `INSTITUCION_DB_*`/`SMTP_*` en su entorno; si no, el aviso queda en el log de la app y el proceso sigue).

## 3. Tests

```bash
mvn test      # no necesita Docker
```

El recorrido contra el entorno real (escenario 11: simulador CLI + app Java) está en `scripts/escenarios/m-escenarios.js`.

## 4. Verificado contra Flowable 6.8.0

- Inicio por mensaje por REST con el campo `"message"` (`"Solicitud de curso"`), `businessKey` y `variables`.
- Las acciones sobre una ejecución son `PUT`, no `POST`.
- Las comunicaciones habilitadas se leen de `GET /runtime/event-subscriptions?processInstanceId={id}`.
- Los nombres de mensajes con acentos y espacios se aceptan tal cual.
- La instancia debe llevar un `empresaId` que exista en la BD de la institución (1 o 2 con los datos de prueba).
- Si la app de escritorio no conecta con `invalid value for parameter "TimeZone"`: ya está resuelto en el código (Windows en Argentina informa un alias de zona que PostgreSQL 16 rechaza).
