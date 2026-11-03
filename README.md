# Proyecto BPMN: organización de cursos de capacitación

Proyecto final de Gestión y Tecnologías de Procesos de Negocio. Implementa en Flowable el proceso de la consigna (`ProyectoCursos_V2_168448775197.pdf`).

## Qué hay

| Pieza | Dónde |
|---|---|
| Modelo BPMN ejecutable (`Process_Curso`) y su registro de cambios | `modelo/Proyecto_Organizacion_cursos.bpmn20.xml`, `modelo/cambios-modelo.md` |
| Regla DMN de viabilidad (`< 5` viable) | `modelo/viabilidadCurso.dmn` |
| Clases Java dentro del motor (listeners y delegates) | `src/main/java/unrc/cursos/` |
| BD de la institución (empresas, cuentas, cursos) | `db/schema.sql`, `db/datos.sql` |
| Simulador de la empresa por consola (API REST) | `src/main/java/unrc/cursos/simulador/` |
| App de escritorio "Preparar materiales" (API Java) | `src/main/java/unrc/cursos/escritorio/` |
| Scripts de preparación | `scripts/` |
| Colección de Postman | `postman/` |

Las dos apps se explican en [`README-aplicaciones.md`](README-aplicaciones.md) y [`Probar-Apps.md`](Probar-Apps.md).

## Requisitos

- Docker Desktop (abierto y con el motor corriendo)
- Java 11 o más y Maven
- Postman (opcional)

## Puesta en marcha (en este orden)

Desde la carpeta del repo. En Windows, PowerShell; donde dice `.sh` se puede usar Git Bash.

```
# 1. Compilar las clases Java. Genera target/cursos-flowable.jar, que montan los dos contenedores.
mvn package -DskipTests

# 2. Levantar PostgreSQL + Flowable REST + Flowable UI
docker compose up -d

# 3. Usuarios y grupos de Flowable (5 usuarios, 2 grupos, privilegios). Se puede repetir.
powershell -ExecutionPolicy Bypass -File scripts\crear-usuarios.ps1      # o ./scripts/crear-usuarios.sh

# 4. BD de la institución (crea la base "institucion" y carga datos de prueba). Se puede repetir.
powershell -ExecutionPolicy Bypass -File scripts\crear-bd.ps1            # o ./scripts/crear-bd.sh

# 5. Desplegar la regla DMN y el modelo BPMN. Cada vez que cambie el modelo, repetir.
powershell -ExecutionPolicy Bypass -File scripts\desplegar-modelo.ps1    # o ./scripts/desplegar-modelo.sh
```

Esperá un minuto después del `up` hasta que respondan las dos URLs. Si `flowable-ui` falla en el primer arranque, repetí `docker compose up -d`.

| Servicio | URL | Usuario / contraseña |
|---|---|---|
| Interfaz de Flowable | http://localhost:8081/flowable-ui | `admin` / `test` (o `jefeAdmin`, `admin2`, `jefeDocente`, `docente1`, `docente2` / `test`) |
| API REST (Swagger) | http://localhost:8080/flowable-rest/docs/ | `rest-admin` / `test` |
| PostgreSQL | `localhost:5432`, bases `flowable` y `institucion` | `flowable` / `flowable` · `institucion` / `institucion` |

Reglas del JAR (por qué el orden importa):
- Si `target/cursos-flowable.jar` no existe cuando se hace `docker compose up`, Docker crea un **directorio** con ese nombre y el contenedor no arranca. Borrá el directorio, compilá y repetí.
- Si recompilás con los contenedores arriba, reinicialos: `docker compose restart flowable-rest flowable-ui`.
- `docker compose down` conserva los datos. `docker compose down -v` borra todo: hay que repetir los pasos 3, 4 y 5.

## Probar el proceso real

1. **Iniciar una solicitud.** Es un inicio por mensaje; el curso tiene que existir en la BD y la instancia lleva `cursoId` y `empresaId` (empresas de prueba: 1, que ya tiene cuenta, y 2, que no):
   ```
   curl -u rest-admin:test -H "Content-Type: application/json" -X POST http://localhost:8080/flowable-rest/service/runtime/process-instances -d "{\"message\":\"Solicitud de curso\",\"businessKey\":\"1\",\"variables\":[{\"name\":\"cursoId\",\"value\":1,\"type\":\"integer\"},{\"name\":\"empresaId\",\"value\":2,\"type\":\"integer\"}]}"
   ```
   Con esa instancia ya se evalúa la viabilidad (DMN) y queda la tarea **Registrar y Elaborar propuesta** de `jefeAdmin`.
2. **Tareas de la institución:** en Flowable UI (`jefeAdmin` / `test`, app *Tasks*) o con la app de escritorio para *Preparar materiales*.
3. **Respuestas de la empresa:** con el simulador por consola (acepta, rechaza, pide modificaciones, envía la nómina). Ver [`README-aplicaciones.md`](README-aplicaciones.md).
4. **Estado final del curso:** al terminar la instancia, el Execution Listener de fin escribe el resultado en `curso.estado`:
   ```
   docker compose exec postgres psql -U institucion -d institucion -c "select id, estado, process_instance_id from curso"
   ```
   (La columna `process_instance_id` la completa quien crea el curso, que será el sitio web; con una instancia iniciada a mano hay que hacer `update curso set process_instance_id='<id>' where id=1`.)

## Evidencia de integración del Día 2

Verificación realizada el 2026-11-03 contra Docker, PostgreSQL y Flowable REST:

- `mvn test`: todos los tests unitarios pasaron.
- `mvn package -DskipTests`: generó `target/cursos-flowable.jar`.
- `docker compose up -d`: PostgreSQL, Flowable REST y Flowable UI quedaron activos.
- `scripts/crear-usuarios.sh`, `scripts/crear-bd.sh` y `scripts/desplegar-modelo.sh`: usuarios, grupos, BD institucional, DMN y `Process_Curso` preparados correctamente.
- Instancia `6467fea6-d7b7-11f1-84f7-5e61841db8c5`: después de aceptar y enviar la nómina, la tarea `Lista` quedó asignada automáticamente a `admin2` por `AsignarMenosCargadoListener`.
- Instancia `2295de2b-d7b7-11f1-84f7-5e61841db8c5`: al completar `Archivar solicitud` después de los dos recordatorios, `ActualizarEstadoCursoListener` actualizó `curso.estado` a `SIN_RESPUESTA`.

## Tests

```
mvn test      # unitarios (H2 en memoria); no necesita Docker
```

Las pruebas de proceso contra el entorno levantado (carpeta `pruebas-flowable/`) son evidencia local y no se versionan.

## Estado y límites conocidos

- **Probado de punta a punta:** viabilidad y acuerdo; el curso completo (preparación, confirmación, dictado, informe y fin con compensación; `FINALIZADO`); falta de aulas; cancelación de la empresa con espera de la liberación del equipamiento; rechazo; y los cierres `NO_VIABLE`, `SIN_RESPUESTA`, `CANCELADO` y `RECHAZADO` reflejados en `curso.estado`.
- Las notificaciones a la empresa (propuesta, recordatorio, confirmación, cierre) son logs en el contenedor: el envío real se simula.
- Falta el sitio web (formulario público, pantallas de administración y docentes) y el informe.
