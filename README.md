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

Las dos apps se explican en [`README-aplicaciones.md`](README-aplicaciones.md).

## Requisitos

- Docker Desktop (Windows) o Docker Engine con Docker Compose (Ubuntu), con el motor corriendo y los puertos 5432, 8080 y 8081 libres
- Java 11 o más y Maven 3.8+ (verificado con JDK 21 y Maven 3.9; el JAR sale con bytecode de Java 11)
- Node.js 18 o más (sólo para el recorrido automatizado de escenarios, `scripts/escenarios/`)
- Postman (opcional)
- DevNullSmtp u otro SMTP falso en el puerto 25 de la máquina (opcional): recibe los correos que el proceso manda a la empresa. Sin él, el aviso queda en el log y el proceso sigue

## Puesta en marcha (en este orden)

Desde la carpeta del repo. Los comandos siguientes están separados por sistema operativo.

### Windows (PowerShell)

```
# 1. Compilar las clases Java. Genera target/cursos-flowable.jar, que montan los dos contenedores.
mvn package -DskipTests

# 2. Levantar PostgreSQL + Flowable REST + Flowable UI
docker compose up -d

# 3. Usuarios y grupos de Flowable (5 usuarios, 2 grupos, privilegios). Se puede repetir.
powershell -ExecutionPolicy Bypass -File scripts\crear-usuarios.ps1

# 4. BD de la institución (crea la base "institucion" y carga datos de prueba). Se puede repetir.
powershell -ExecutionPolicy Bypass -File scripts\crear-bd.ps1

# 5. Desplegar la regla DMN y el modelo BPMN. Cada vez que cambie el modelo, repetir.
powershell -ExecutionPolicy Bypass -File scripts\desplegar-modelo.ps1
```

### Ubuntu (Bash)

Desde una terminal ubicada en la raíz del repositorio:

```
# 1. Compilar las clases Java. Genera target/cursos-flowable.jar, que montan los dos contenedores.
mvn package -DskipTests

# 2. Levantar PostgreSQL + Flowable REST + Flowable UI.
docker compose up -d

# 3. Dar permiso de ejecución a los scripts .sh (sólo hace falta la primera vez).
chmod +x scripts/crear-usuarios.sh scripts/crear-bd.sh scripts/desplegar-modelo.sh

# 4. Usuarios y grupos de Flowable (5 usuarios, 2 grupos, privilegios). Se puede repetir.
./scripts/crear-usuarios.sh

# 5. BD de la institución (crea la base "institucion" y carga datos de prueba). Se puede repetir.
./scripts/crear-bd.sh

# 6. Desplegar la regla DMN y el modelo BPMN. Cada vez que cambie el modelo, repetir.
./scripts/desplegar-modelo.sh
```

En Ubuntu, si los scripts todavía no tienen permiso de ejecución, se pueden invocar sin modificar permisos:

```
bash scripts/crear-usuarios.sh
bash scripts/crear-bd.sh
bash scripts/desplegar-modelo.sh
```

Esperá un minuto después del `up` hasta que respondan las dos URLs.

**Primer arranque desde cero (verificado el 2026-11-04 tras `docker compose down -v`):** los dos contenedores de Flowable crean el esquema a la vez y `flowable-ui` se cae (`docker compose ps -a` lo muestra `Exited (1)`; en su log: `duplicate key ... act_ge_property`). Es una carrera de arranque, no un error de configuración: ejecutá `docker compose up -d` una segunda vez y en unos 40 s responde (`http://localhost:8081/flowable-ui/` devuelve 401 sin credenciales). `flowable-rest` ya está bien y se puede seguir con los pasos 3 a 5 mientras tanto.

| Servicio | URL | Usuario / contraseña |
|---|---|---|
| Interfaz de Flowable | http://localhost:8081/flowable-ui | `admin` / `test` (o `jefeAdmin`, `admin2`, `jefeDocente`, `docente1`, `docente2` / `test`) |
| API REST (Swagger) | http://localhost:8080/flowable-rest/docs/ | `rest-admin` / `test` |
| PostgreSQL | `localhost:5432`, bases `flowable` y `institucion` | `flowable` / `flowable` · `institucion` / `institucion` |

### Usuarios y grupos de Flowable

Los crea `scripts/crear-usuarios` (se puede repetir: lo que existe se informa como `omitido`). Clave de todos: `test`.

| Usuario | Rol | Grupo |
|---|---|---|
| `jefeAdmin` | Jefe administrativo | `administracion` |
| `admin2` | Administrativo | `administracion` |
| `jefeDocente` | Jefe del equipo docente | `docentes` |
| `docente1`, `docente2` | Docentes | `docentes` |

- Los grupos se llaman `administracion` y `docentes` (ids sin acentos; coinciden con los carriles "Administración" y "Docentes" del modelo).
- El script también da a cada usuario los privilegios `access-rest-api` (necesario para entrar a la API REST con su usuario) y `access-task` (Flowable UI); por grupo no alcanza para la API REST.
- Tareas exclusivas de un jefe: asignadas a su usuario, no se reclaman. Tareas del grupo: hay que **reclamarlas** antes de completarlas. El motor no obliga a reclamar (completa igual por REST): lo exigen el sitio y las apps.
- Para entrar a Flowable UI con un usuario del personal: `http://localhost:8081/flowable-ui`, app *Tasks*. El administrador de la UI es `admin` / `test`. La API REST se usa con `rest-admin` / `test` o con el usuario del personal.
- Las empresas **no** son usuarios de Flowable: sus cuentas están en la tabla `cuenta_empresa` de la BD `institucion` y las crea la tarea automática *Habilitar acceso de la empresa* (usuario `emp_<cuit sin guiones>`, clave simulada `test`).

Reglas del JAR (por qué el orden importa):
- Si `target/cursos-flowable.jar` no existe cuando se hace `docker compose up`, Docker crea un **directorio** con ese nombre y el contenedor no arranca. Borrá el directorio, compilá y repetí.
- Si recompilás con los contenedores arriba, reinicialos: `docker compose restart flowable-rest flowable-ui`.
- `docker compose down` conserva los datos. `docker compose down -v` borra todo: hay que repetir los pasos 3, 4 y 5.

## Probar el proceso real

1. **Iniciar una solicitud.** Es un inicio por mensaje; el curso tiene que existir en la BD y la instancia lleva `cursoId` y `empresaId` (empresas de prueba: 1, que ya tiene cuenta, y 2, que no):
   ```
   curl -u rest-admin:test -H "Content-Type: application/json" -X POST http://localhost:8080/flowable-rest/service/runtime/process-instances -d "{\"message\":\"Solicitud de curso\",\"businessKey\":\"1\",\"variables\":[{\"name\":\"cursoId\",\"value\":1,\"type\":\"integer\"},{\"name\":\"empresaId\",\"value\":2,\"type\":\"integer\"}]}"
   ```
   Con esa instancia ya se evalúa la viabilidad (DMN) y queda la tarea **Registrar y Elaborar propuesta** de `jefeAdmin`; al completarla aparece **Enviar propuesta**, también de `jefeAdmin`, y recién al completarla se manda la propuesta y empieza a correr el plazo de respuesta.
2. **Tareas de la institución:** en Flowable UI (`jefeAdmin` / `test`, app *Tasks*) o con la app de escritorio para *Preparar materiales*.
3. **Respuestas de la empresa:** con el simulador por consola (acepta, rechaza, pide modificaciones, envía la nómina). Ver [`README-aplicaciones.md`](README-aplicaciones.md).
4. **Estado final del curso:** al terminar la instancia, el Execution Listener de fin escribe el resultado en `curso.estado`:
   ```
   docker compose exec postgres psql -U institucion -d institucion -c "select id, estado, process_instance_id from curso"
   ```
   (La columna `process_instance_id` la completa quien crea el curso, que será el sitio web; con una instancia iniciada a mano hay que hacer `update curso set process_instance_id='<id>' where id=1`.)

## Avisos por correo a la empresa

El proceso manda correo al `contacto_email` de la empresa al enviar la propuesta, enviar un recordatorio, cerrar por no viable, confirmar el curso, cerrar por cancelación y enviar el informe (`NotificarEmpresaDelegate`). Los contenedores usan `SMTP_HOST` (por defecto `host.docker.internal`), `SMTP_PORT` (25) y `SMTP_FROM`, que se pueden cambiar al levantar: `SMTP_PORT=1025 docker compose up -d`.

1. Abrir DevNullSmtp (o cualquier SMTP falso) escuchando en el puerto 25 de la máquina. Solo con eso ya se ven los correos.
2. Si no hay servidor, el aviso queda en el log (`docker logs flowable-rest`, línea `Aviso ... NO enviado`) y el proceso continúa sin error.
3. Los correos de prueba de `scripts/escenarios/m-escenarios.js` los recoge un SMTP propio en el puerto 25: cerrar DevNullSmtp antes de correrlo (o usar `--solo` con escenarios que no lo necesiten; sin el puerto libre se omiten sólo las verificaciones de correo).

## Sitio web

Requisitos: Node 18 o superior. Con el entorno ya levantado (pasos 1 a 5 de "Puesta en marcha"; el paso 4 crea también la tabla `informe`), desde la raíz del repo:

### Windows (PowerShell)

```
cd web
npm install
$env:SESSION_SECRET="cualquier-texto-largo"
npm start          # http://localhost:3000
npm test           # 149 pruebas; la de integración usa el Flowable real y limpia lo que crea
```

### Ubuntu (Bash)

```
cd web
npm install
export SESSION_SECRET="cualquier-texto-largo"
npm start          # http://localhost:3000
npm test           # 149 pruebas; la de integración usa el Flowable real y limpia lo que crea
```

| Entrada | URL | Quién |
|---|---|---|
| Solicitud pública | `/solicitar` | cualquiera |
| Acceso de empresas | `/empresa/login` | cuenta de `cuenta_empresa` |
| Administración | `/admin/login` | `jefeAdmin`, `admin2` (clave `test`) |
| Equipo docente | `/docentes/login` | `jefeDocente`, `docente1`, `docente2` (clave `test`) |

Variables de entorno (todas con valor por defecto de desarrollo; tabla completa en [`web/README.md`](web/README.md)): `FLOWABLE_REST_URL`, `INSTITUCION_DB_URL`, `SESSION_SECRET`, `PORT`, `PLAZO_RESPUESTA` (acorta el plazo de respuesta en las demostraciones) y `SIMULAR_FALTA_AULAS`. Las tres partes del sitio (pública/empresa, administración y docentes) leen las mismas. En producción `SESSION_SECRET` es obligatorio. El guion de los escenarios 8, 9 y 10 está en [`informe/checklist-manual.md`](informe/checklist-manual.md).

## Simulador de la empresa y app de materiales

Detalle completo, variables de entorno y verificaciones en [`README-aplicaciones.md`](README-aplicaciones.md). Resumen, con el entorno ya levantado y desde la raíz del repo:

### Windows (PowerShell)

Antes de ejecutar las aplicaciones, cambiar la página de códigos para visualizar correctamente las tildes:

```
chcp 65001

# Simulador de la empresa por consola (API REST). Muestra sólo las comunicaciones habilitadas.
$env:FLOWABLE_REST_USER="jefeAdmin"
$env:FLOWABLE_REST_PASSWORD="test"
mvn -q exec:java -Dexec.mainClass=unrc.cursos.simulador.SimuladorMain

# App de escritorio "Preparar materiales" (API Java de Flowable contra la BD del motor).
$env:FLOWABLE_DB_USER="flowable"
$env:FLOWABLE_DB_PASSWORD="flowable"
mvn -q exec:java -Dexec.mainClass=unrc.cursos.escritorio.AppMateriales
```

### Ubuntu (Bash)

Ubuntu normalmente ya utiliza UTF-8, por lo que no hace falta ejecutar un equivalente de `chcp 65001`:

```
# Simulador de la empresa por consola (API REST). Muestra sólo las comunicaciones habilitadas.
export FLOWABLE_REST_USER=jefeAdmin
export FLOWABLE_REST_PASSWORD=test
mvn -q exec:java -Dexec.mainClass=unrc.cursos.simulador.SimuladorMain

# App de escritorio "Preparar materiales" (API Java de Flowable contra la BD del motor).
export FLOWABLE_DB_USER=flowable
export FLOWABLE_DB_PASSWORD=flowable
mvn -q exec:java -Dexec.mainClass=unrc.cursos.escritorio.AppMateriales
```

Nota (2026-11-04): la app puede completar *Preparar materiales* aunque sea la última rama de *Preparar curso*. El motor local de la app sigue el flujo hasta *Enviar confirmación*; el modelo ya no tiene tareas de script, así que no hace falta Groovy.

## Recorrido automatizado de los escenarios de la defensa

`scripts/escenarios/m-escenarios.js` ejecuta contra el entorno real los escenarios 1 a 7 y 11 y emite PASS/FAIL con evidencia (ver [`scripts/escenarios/README.md`](scripts/escenarios/README.md)). Los 8, 9 y 10 (dependen del sitio) están en [`informe/checklist-manual.md`](informe/checklist-manual.md).

```
node scripts/escenarios/m-escenarios.js        # tarda unos 4 minutos; al final deja Flowable con sólo "Demo processes"
```

Después de correrlo hay que volver a desplegar el modelo (`scripts/desplegar-modelo`) si se va a usar a mano. Informe y decisiones pendientes: [`informe/`](informe/).

## Solución de problemas

| Síntoma | Causa y arreglo |
|---|---|
| `flowable-ui` sale con `Exited (1)` en el primer arranque | Carrera al crear el esquema; repetir `docker compose up -d`. |
| `flowable-rest` no arranca y `target/cursos-flowable.jar` es una carpeta | Se hizo `up` antes de compilar. Borrar la carpeta, `mvn package -DskipTests`, `docker compose up -d`. |
| Errores `No data available` al leer el JAR dentro del contenedor | Se recompiló con los contenedores arriba: `docker compose restart flowable-rest flowable-ui`. |
| Falla al iniciar una solicitud, en *Evaluar Viabilidad* | La DMN no está desplegada; correr `scripts/desplegar-modelo` (despliega la DMN **antes** que el modelo). |
| 500 en *Habilitar acceso de la empresa* | `empresaId` no existe en la BD; usar 1 o 2 con los datos de prueba, o correr `scripts/crear-bd`. |
| La solicitud nueva queda `NO_VIABLE` sin motivo aparente | Hay 5 o más instancias activas de `Process_Curso` (incluidas las de pruebas viejas). Borrarlas: `node scripts/escenarios/m-limpiar-instancias.js`. |
| `PKIX path building failed` al bajar dependencias con Maven | Proxy/antivirus con certificado propio en la red. Las dependencias del proyecto ya están en `~/.m2` si se compiló antes; sólo falla al bajar artefactos nuevos. |

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
mvn test      # 45 tests unitarios (H2 en memoria); no necesita Docker
```

Las pruebas de proceso contra el entorno levantado son `scripts/escenarios/m-escenarios.js`.

## Estado y límites conocidos

- **Probado de punta a punta:** viabilidad y acuerdo; el curso completo (preparación, confirmación, dictado, informe y fin con compensación; `FINALIZADO`); falta de aulas; cancelación de la empresa con espera de la liberación del equipamiento; rechazo; y los cierres `NO_VIABLE`, `SIN_RESPUESTA`, `CANCELADO` y `RECHAZADO` reflejados en `curso.estado`.
- Los avisos a la empresa son correos al SMTP falso de la máquina (sección "Avisos por correo"); sin servidor quedan en el log. Credenciales de las cuentas de empresa: simuladas.
- Todo lo que se aparta de la consigna, con su motivo, está en [`informe/licencias-consigna.md`](informe/licencias-consigna.md).
- El sitio web (`web/`) está construido; los escenarios 8, 9 y 10 se ensayan a mano con `informe/checklist-manual.md`. El informe breve está en `informe/informe.md`.
- Reglas que debe cumplir el sitio porque el motor no las hace (reclamar antes de completar, validar *Evaluar recursos* y la fecha de aceptación, vincular el curso, informe en PDF): `informe/licencias-consigna.md` (filas 23 y 24).
