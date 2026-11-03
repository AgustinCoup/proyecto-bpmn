# Aplicaciones auxiliares: simulador CLI y app Java de materiales

Este documento explica cómo ejecutar las dos aplicaciones de la Tarea 3 y qué se
verificó contra Flowable 6.8.0. No reemplaza al `README.md` general.

## Qué hay en el repositorio

| Ruta | Contenido |
|---|---|
| `src/main/java/unrc/cursos/simulador/` | Simulador de comunicaciones de la empresa por consola, usando la API REST. |
| `src/main/java/unrc/cursos/escritorio/` | App de escritorio Swing que usa la API Java de Flowable contra PostgreSQL. |
| `src/test/resources/procesos/ejemplo-materiales.bpmn20.xml` | Proceso mínimo de ejemplo. **No es el modelo real.** |
| `scripts/crear-usuarios.sh` | Crea usuarios/grupos y sus privilegios REST (equivalente Linux del `.ps1`). |
| `scripts/desplegar-ejemplo.sh` | Despliega el proceso de ejemplo por REST. |
| `src/test/java/unrc/cursos/simulador/DetectorAccionesTest.java` | Tests sin red de qué acciones están habilitadas. |
| `src/test/java/unrc/cursos/escritorio/ServicioTareasTest.java` | Tests de la app Java contra H2. |
| `src/test/java/unrc/cursos/escritorio/ServicioTareasPostgresIT.java` | Test opcional contra la PostgreSQL real. |

## Requisitos

- Docker con `docker compose up -d` funcionando.
- Java 11 o superior y Maven.
- El entorno de `docker-compose.yml` levanta PostgreSQL, Flowable REST en
  `http://localhost:8080/flowable-rest/service` y Flowable UI en
  `http://localhost:8081/flowable-ui`.

## 1. Usuarios y grupos

Si todavía no existen los 5 usuarios de `Contrato.md`:

```bash
./scripts/crear-usuarios.sh
```

El script es idempotente: lo que ya existe se informa como `omitido`. También se
puede seguir usando `scripts/crear-usuarios.ps1` en Windows.

Usuarios: `jefeAdmin`, `admin2`, `jefeDocente`, `docente1`, `docente2`.
Clave de desarrollo: `test`. Grupos: `administracion` y `docentes`.

## 2. Desplegar y usar el proceso de ejemplo

```bash
./scripts/desplegar-ejemplo.sh
```

El ejemplo tiene una tarea de usuario **Preparar materiales** con grupo candidato
`administracion`, un evento de inicio por mensaje, eventos de captura para
Aceptación/Rechazo/Solicitud de modificaciones, una receive task `Nomina` y un
evento de borde de mensaje **Cancelación** dentro de la preparación.

Iniciar una instancia:

```bash
curl -u rest-admin:test -H 'Content-Type: application/json' -X POST \
  'http://localhost:8080/flowable-rest/service/runtime/process-instances' \
  -d '{
        "message": "Solicitud de curso (ejemplo)",
        "businessKey": "101",
        "variables": [
          {"name": "cursoId", "value": 101, "type": "integer"},
          {"name": "empresaId", "value": 7, "type": "integer"}
        ]
      }'
```

> El mensaje de inicio del ejemplo es **"Solicitud de curso (ejemplo)"** a
> propósito: evita chocar con el mensaje **"Solicitud de curso"** del modelo real
> cuando esté desplegado. Los mensajes de las acciones sí tienen los nombres
> exactos del contrato (con acentos), para probar el simulador.

Esa sección usa el proceso de ejemplo. Para el proceso real, ver la sección 7 y el `README.md`.

Para probar la app de escritorio alcanza con iniciar la instancia y aceptar la
propuesta (o directamente desde el simulador). La tarea **Preparar materiales**
queda disponible para el grupo `administracion`.

## 3. Simulador de comunicaciones por CLI

Variables de entorno:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `FLOWABLE_REST_URL` | No | Por defecto `http://localhost:8080/flowable-rest/service`. |
| `FLOWABLE_REST_USER` | Sí, o se pide por consola | Usuario con acceso a la API REST, por ejemplo `jefeAdmin`. |
| `FLOWABLE_REST_PASSWORD` | Sí, o se pide por consola | Clave del usuario. |

Ejecución:

```bash
export FLOWABLE_REST_URL=http://localhost:8080/flowable-rest/service
export FLOWABLE_REST_USER=jefeAdmin
export FLOWABLE_REST_PASSWORD=test
mvn -q exec:java -Dexec.mainClass=unrc.cursos.simulador.SimuladorMain
```

Uso:

1. Muestra las instancias activas; se elige una por número.
2. Consulta las ejecuciones activas y las suscripciones a eventos de la instancia.
3. Muestra **solo** las comunicaciones habilitadas en ese estado:
   - Aceptar la propuesta, pidiendo `fechaCurso` en ISO 8601 con zona horaria.
   - Rechazar la propuesta.
   - Pedir modificaciones, pidiendo `observaciones`.
   - Enviar la nómina, pidiendo un array JSON para `participantes`.
   - Cancelar durante la preparación.
4. Después de cada envío refresca el estado; si la instancia terminó, lo informa.
5. Valida fechas, JSON y textos obligatorios, y muestra los errores HTTP de
   Flowable sin ocultarlos.

Los nombres de mensajes usados son los de `Contrato.md`, sección 5:
`Aceptación`, `Rechazo`, `Solicitud de modificaciones` y `Cancelación`. La nómina
se envía con la acción `signal` sobre la ejecución de la receive task `Nomina`.

## 4. App de escritorio: Preparar materiales

La app usa directamente la **API Java de Flowable** contra la misma base
PostgreSQL del motor. No usa la API REST.

Configuración por variables de entorno:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `FLOWABLE_DB_URL` | No | Por defecto `jdbc:postgresql://localhost:5432/flowable`. |
| `FLOWABLE_DB_USER` | **Sí** | Usuario JDBC de la base del motor. |
| `FLOWABLE_DB_PASSWORD` | **Sí** | Clave JDBC. |
| `FLOWABLE_DB_DRIVER` | No | Por defecto `org.postgresql.Driver`. |
| `FLOWABLE_DB_SCHEMA_UPDATE` | No | Por defecto `false` (no modifica el esquema existente). |

No hay credenciales de base hardcodeadas en el código. También se puede usar un
archivo de propiedades apuntado por `FLOWABLE_DB_CONFIG`:

```properties
flowable.db.url=jdbc:postgresql://localhost:5432/flowable
flowable.db.user=CAMBIAR
flowable.db.password=CAMBIAR
flowable.db.driver=org.postgresql.Driver
flowable.db.schemaUpdate=false
```

```bash
export FLOWABLE_DB_CONFIG=/ruta/a/flowable-app.properties
```

Ejecución:

```bash
export FLOWABLE_DB_URL=jdbc:postgresql://localhost:5432/flowable
export FLOWABLE_DB_USER=flowable
export FLOWABLE_DB_PASSWORD=flowable
mvn -q exec:java -Dexec.mainClass=unrc.cursos.escritorio.AppMateriales
```

Uso:

1. Ingresar con un usuario de Flowable (por ejemplo `jefeAdmin` / `test`).
2. La tabla muestra las tareas **Preparar materiales** asignadas al usuario o
   disponibles para reclamar por sus grupos.
3. Seleccionar una tarea disponible y usar **Reclamar tarea**. El motor valida
   que el usuario sea candidato (por usuario o por grupo).
4. Seleccionar una tarea reclamada por el usuario y usar **Completar tarea**.
5. **Actualizar** vuelve a consultar; **Cambiar usuario** permite ingresar con
   otro usuario de Flowable.

La app no permite reclamar tareas de otros grupos ni completar tareas que no
estén asignadas al usuario que ingresó.

## 5. Tests

```bash
mvn test
```

Incluye los tests de detección de acciones (sin red) y los tests de la app Java
contra H2. El test contra PostgreSQL real es opcional y se salta si no se define
`FLOWABLE_DB_URL`:

```bash
FLOWABLE_DB_URL=jdbc:postgresql://localhost:5432/flowable \
FLOWABLE_DB_USER=flowable \
FLOWABLE_DB_PASSWORD=flowable \
mvn -Dtest=ServicioTareasPostgresIT test
```

Ese test requiere que el proceso de ejemplo esté desplegado y que existan los
usuarios del contrato. Crea una instancia, acepta la propuesta, lista/reclama/
completa **Preparar materiales** y borra la instancia al terminar.

## 6. Qué se verificó contra Flowable 6.8.0

- **Inicio por mensaje por REST**: funciona con `POST /runtime/process-instances`
  y el campo `"message"`. Se probó con el nombre exacto `"Solicitud de curso"` y
  también con `"Solicitud de curso (ejemplo)"`; acepta `businessKey` y `variables`.
- **Acciones sobre una ejecución**: deben enviarse con **`PUT`**, no `POST`, a
  `/runtime/executions/{executionId}`. El `POST` que figura hoy en el contrato y
  en la colección Postman devuelve HTTP 500 con
  `Request method 'POST' not supported`.
- **Consulta de suscripciones**: `GET /runtime/event-subscriptions?processInstanceId={id}`
  devuelve `eventType` (`message`), `eventName` (por ejemplo `"Aceptación"`),
  `activityId` y `executionId`. Es la forma más directa de saber qué mensajes
  están habilitados. El parámetro `messageEventSubscriptionName` de
  `/runtime/executions` también existe y funciona.
- **Nombres con acentos y espacios**: Flowable los acepta tal cual, tanto para
  iniciar por mensaje como para `messageName` en `messageEventReceived`.
- **Recepción de nómina**: la receive task `Nomina` se despierta con
  `{"action":"signal","variables":[{"name":"participantes",...}]}` sobre la
  ejecución que tiene `activityId = "Nomina"`. Funciona y guarda la variable.
- **Cancelación**: el mensaje `Cancelación` se recibe porque el modelo asocia
  `Msg_cancel` al inicio del subproceso de eventos de cancelación (hecho en la fase X2).
- **Fecha y participantes**: se enviaron como texto ISO/JSON y quedaron guardados
  como variables de tipo string.
- **App Java contra PostgreSQL real**: se probó autenticación con usuario de
  Flowable, listado de tareas candidatas/asignadas, reclamo y finalización,
  contra la base del `docker-compose.yml`.

### Correcciones sugeridas a `Contrato.md`

1. Sección 5: cambiar
   `POST /service/runtime/executions/{executionId}` por
   `PUT /service/runtime/executions/{executionId}`.
2. Sección 5: agregar que las acciones habilitadas se pueden obtener de
   `GET /service/runtime/event-subscriptions?processInstanceId={id}`. El endpoint
   actual de ejecuciones con `messageEventSubscriptionName` sirve, pero obliga a
   consultar mensaje por mensaje.
3. Sección 2: el ⚠ del inicio por mensaje queda resuelto: se usa el campo
   `message`; no es necesario `processDefinitionKey`.
4. Sección 5: los ⚠ sobre nombres con acentos/espacios y sobre `Nomina` con
   `signal` quedan resueltos favorablemente.
5. La colección `postman/proyecto-bpmn.postman_collection.json` tenía el mismo
   problema: las llamadas de los mensajes y de la nómina usaban `POST`. En este
   repositorio ya quedaron cambiadas a `PUT` (el `Contrato.md` se deja como está
   hasta que el equipo decida actualizarlo).
6. (Resuelto en la fase X2: `Msg_cancel` ya está asociado y el simulador ofrece **Cancelar**.)

## 7. Contra el modelo real (probado el 2026-11-03)

Con el entorno completo levantado (ver `README.md`, pasos 1 a 5) las dos apps funcionan con el proceso real `Process_Curso`:

- **Simulador:** con la solicitud esperando respuesta ofrece *Aceptar*, *Rechazar* y *Pedir modificaciones*. Al aceptar (`Aceptación` con `fechaCurso`) pasa a `Preparar` y ofrece *Enviar nómina* y *Cancelar durante la preparación* (probado: la cancelación libera lo gestionado y cierra la solicitud).
- **App de escritorio:** el administrativo ve *Preparar materiales* (grupo candidato `administracion`), la reclama y la completa contra la PostgreSQL real. `docente1` no la ve. Verificado con `admin2`.
- La instancia debe llevar `empresaId` de una empresa que exista en la BD de la institución (1 o 2 con los datos de prueba): *Habilitar acceso de la empresa* falla con 500 si no existe.
- En consolas de Windows las tildes pueden verse mal: ejecutar antes `chcp 65001`.
- Si la app de escritorio se queda sin conectar con `invalid value for parameter "TimeZone"`: ya está resuelto en el código (Windows en Argentina informa un alias de zona que PostgreSQL 16 rechaza).

La cancelación, la falta de aulas y el fin del curso con compensación están probados contra el modelo real (fase X2, 2026-11-03).
