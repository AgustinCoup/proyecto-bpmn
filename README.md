# Proyecto BPMN: organización de cursos de capacitación

Proyecto final de *Gestión y Tecnologías de Procesos de Negocio* (UNRC). Una institución de capacitación gestiona, con un proceso ejecutable en **Flowable 6.8.0**, los cursos que le solicitan las empresas: viabilidad, negociación de la propuesta, preparación en paralelo, dictado, informe y liberación de recursos.

**Documentación del proyecto**, en orden de lectura:

| # | Documento | Contenido |
|---|---|---|
| — | [`docs/consigna.pdf`](docs/consigna.pdf) | Enunciado del trabajo (versión 3) |
| 1 | [`docs/informe.md`](docs/informe.md) | Informe: arquitectura, variables, listeners y decisiones de implementación |
| 2 | [`docs/licencias-consigna.md`](docs/licencias-consigna.md) | Apartamientos respecto de la consigna y de su diagrama, con su justificación |
| 3 | [`docs/cambios-modelo.md`](docs/cambios-modelo.md) | Registro detallado de cada cambio al modelo BPMN |
| 4 | [`docs/mineria.md`](docs/mineria.md) | Minería de procesos (consigna 4.4): adaptación de los scripts, resultados y conclusión |
| 5 | [`docs/revisiones-manuales.md`](docs/revisiones-manuales.md) | Registro de verificación de los escenarios 8, 9 y 10 |
| — | Este `README.md` | Instalación, ejecución de cada módulo y pruebas |

**Contenido de este archivo:** 1. Resumen del proceso · 2. Arquitectura y módulos · 3. Requisitos · 4. Puesta en marcha · 5. Usuarios y direcciones · 6. Sitio web · 7. Simulador de la empresa · 8. App de escritorio · 9. Interfaz de Flowable · 10. Postman · 11. Correo de prueba · 12. Análisis del historial · 13. Pruebas · 14. Apagar y reiniciar · 15. Solución de problemas · 16. Estructura del repositorio

> Todos los comandos se ejecutan desde la **raíz del repositorio** (la carpeta que contiene `pom.xml` y `docker-compose.yml`), salvo que se indique otra carpeta. Cada bloque está en dos versiones: **Linux (Bash)** y **Windows (PowerShell)**.

---

## 1. Resumen del proceso

El proceso `Process_Curso` (`modelo/Proyecto_Organizacion_cursos.bpmn20.xml`) tiene cinco etapas:

| Etapa | Qué ocurre | Quién participa |
|---|---|---|
| **Viabilidad** | Al llegar la solicitud, un listener cuenta las otras instancias en curso y la regla DMN `viabilidadCurso.dmn` decide: con 5 o más, el curso no es viable | Automático |
| **Negociación** | El jefe administrativo elabora y envía la propuesta. La empresa acepta, rechaza o pide modificaciones; sin respuesta en 5 días se envía un recordatorio (máximo 2) | `jefeAdmin`, empresa |
| **Preparación** (subproceso, 3 ramas en paralelo) | Inscripciones (nómina → lista definitiva), materiales y recursos (aula física, aula virtual y/o equipamiento). La empresa puede cancelar: se compensan solo los recursos ya gestionados | Grupo `administracion`, empresa |
| **Desarrollo** | Confirmación a la empresa; el jefe docente elige al docente; al llegar la fecha acordada, el docente registra el dictado; el jefe docente elabora el informe (PDF) | `jefeDocente`, docente elegido |
| **Cierre** | El jefe administrativo envía el informe y archiva; se liberan los recursos (compensación) | `jefeAdmin`, grupo `administracion` |

Cada camino de cierre deja la variable `resultado`, y al terminar la instancia un listener la guarda en `curso.estado`: `FINALIZADO`, `CANCELADO`, `RECHAZADO`, `SIN_RESPUESTA` o `NO_VIABLE`. El detalle de variables y listeners está en el [informe](docs/informe.md).

---

## 2. Arquitectura y módulos

```
 Navegador ──HTTP :3000──► Sitio web (Node.js, web/) ──REST──┐
 Simulador de la empresa (Java, consola) ───────────REST──┐  │
 Postman / Newman ──────────────────────────────────REST──┤  │
                                                          ▼  ▼
                                  Flowable (:8080 REST, :8081 UI) + cursos-flowable.jar ──► correo (SMTP)
                                                          │
 App "Preparar materiales" (Java, API Java de Flowable) ──┤ JDBC
 Sitio web ──JDBC────────────────────────────────────┐    │
                                                     ▼    ▼
                     PostgreSQL :5432 · base institucion (empresas, cursos, informes) · base flowable (motor)
```

| Módulo | Ubicación | Tecnología | Función |
|---|---|---|---|
| Modelo y regla | `modelo/` | BPMN 2.0, DMN | Proceso `Process_Curso` y regla de viabilidad. `Proyecto_Organizacion_cursos.conceptual.bpmn` es el modelo conceptual original (no ejecutable) |
| Componentes del motor | `src/main/java/unrc/cursos/` | Java 11 | Listeners y delegates que Flowable ejecuta: conteo de cursos, asignación al administrativo menos cargado, actualización del estado del curso, cuenta de la empresa, reserva y liberación de aulas, avisos por correo. Se empaquetan en `target/cursos-flowable.jar` |
| Sitio web | `web/` | Node.js, Express, EJS | Solicitud pública, acceso de empresas, pantallas de administración y del equipo docente (API REST) |
| Simulador de la empresa | `src/main/java/unrc/cursos/simulador/` | Java (consola) | Comunicaciones de la empresa por API REST; muestra solo las habilitadas en el estado actual |
| App de escritorio | `src/main/java/unrc/cursos/escritorio/` | Java Swing | Tarea *Preparar materiales* mediante la API Java de Flowable |
| Consultas 4.3 | `src/main/java/unrc/cursos/analisis/` | Java | Resultados, duración de las ramas y tareas por persona, sobre el historial del motor |
| Minería 4.4 | `mineria/` | Node.js, Python (PM4Py) | Generación de historial, exportación a CSV y análisis de recorridos |
| Base de la institución | `db/` | PostgreSQL | Esquema, datos de prueba y migraciones |
| Scripts | `scripts/` | Bash, PowerShell, Node.js | Preparación del entorno y recorrido automático de los escenarios |
| Colección REST | `postman/` | Postman | Llamadas a la API REST de Flowable |

---

## 3. Requisitos

| Programa | Versión | Comprobar | Linux | Windows |
|---|---|---|---|---|
| Docker | reciente | `docker compose version` | Docker Engine o Docker Desktop; el usuario debe pertenecer al grupo `docker` | Docker Desktop **abierto** |
| Java | 11 o superior | `java -version` | `sudo apt install openjdk-17-jdk` | Instalador de Adoptium/OpenJDK |
| Maven | 3.8 o superior | `mvn -version` | `sudo apt install maven` | Instalador de Apache Maven (agregar al `PATH`) |
| Node.js | 18 o superior | `node -v` | NodeSource o `nvm` (la versión de los repositorios suele ser antigua) | Instalador de nodejs.org |
| Postman (opcional) | 10 o superior | — | `sudo snap install postman` | `winget install Postman.Postman` |
| Python 3 y Graphviz (solo 4.4) | — | `python3 --version` | `sudo apt install python3-venv graphviz` | Instalador de python.org y `winget install --id Graphviz.Graphviz -e` |

Puertos libres: **5432** (PostgreSQL), **8080** (Flowable REST), **8081** (Flowable UI), **3000** (sitio web) y el del correo de prueba (sección 11).

---

## 4. Puesta en marcha

Se hace una vez, en este orden. El JAR tiene que existir **antes** de levantar los contenedores, porque Docker lo monta dentro de Flowable.

**Linux (Bash):**

```bash
mvn package -DskipTests              # 1. compila y genera target/cursos-flowable.jar
SMTP_PORT=2525 docker compose up -d  # 2. PostgreSQL + Flowable REST + Flowable UI (correo al puerto 2525)
chmod +x scripts/*.sh                #    (solo la primera vez)
./scripts/crear-usuarios.sh          # 3. usuarios y grupos de Flowable
./scripts/crear-bd.sh                # 4. base "institucion" con datos de prueba
./scripts/desplegar-modelo.sh        # 5. regla DMN y proceso BPMN
```

**Windows (PowerShell):**

```powershell
mvn package -DskipTests
docker compose up -d                 # el correo usa el puerto 25 por defecto
powershell -ExecutionPolicy Bypass -File scripts\crear-usuarios.ps1
powershell -ExecutionPolicy Bypass -File scripts\crear-bd.ps1
powershell -ExecutionPolicy Bypass -File scripts\desplegar-modelo.ps1
```

| Paso | Qué hace | Cuándo repetirlo |
|---|---|---|
| `mvn package -DskipTests` | Compila el Java y arma `target/cursos-flowable.jar` | Cada vez que cambia el código Java (después, `docker compose restart flowable-rest flowable-ui`) |
| `docker compose up -d` | Levanta PostgreSQL 16, Flowable REST y Flowable UI | Cada vez que se enciende la máquina |
| `crear-usuarios` | Crea `jefeAdmin`, `admin2`, `jefeDocente`, `docente1`, `docente2` y los grupos `administracion` y `docentes` | Solo la primera vez (si ya existen, informa "omitido") |
| `crear-bd` | Crea la base `institucion` y **reinicia** sus datos de prueba | Para volver a los datos iniciales |
| `desplegar-modelo` | Despliega `viabilidadCurso.dmn` y el proceso | Si cambia el modelo o después de `m-escenarios.js` |

**Comprobación:** al minuto, `docker compose ps` debe mostrar los 3 contenedores `Up`. En el primer arranque, `flowable-ui` puede quedar en `Exited (1)`: se repite `docker compose up -d`.

---

## 5. Usuarios y direcciones

Todas las claves son `test`.

| Quién | Usuario | Grupo | Dónde ingresa |
|---|---|---|---|
| Jefe administrativo | `jefeAdmin` | `administracion` | http://localhost:3000/admin/login |
| Administrativo | `admin2` | `administracion` | http://localhost:3000/admin/login |
| Jefe del equipo docente | `jefeDocente` | `docentes` | http://localhost:3000/docentes/login |
| Docentes | `docente1`, `docente2` | `docentes` | http://localhost:3000/docentes/login |
| Empresa 1 (con cuenta desde el inicio) | `emp_30711223343` | — | http://localhost:3000/empresa/login |
| Empresa 2 (la cuenta se crea al aceptar una propuesta) | `emp_30722334457` | — | http://localhost:3000/empresa/login |
| Cualquier visitante | — | — | http://localhost:3000/solicitar |
| Administrador de la interfaz de Flowable | `admin` (también los usuarios de arriba) | — | http://localhost:8081/flowable-ui |
| Usuario de servicio de la API REST | `rest-admin` | — | http://localhost:8080/flowable-rest/docs/ (Swagger) |

PostgreSQL (`localhost:5432`): base `flowable` con `flowable`/`flowable` y base `institucion` con `institucion`/`institucion`.

**Reclamo de tareas:** las tareas asignadas a una persona (por ejemplo, las del jefe administrativo) se completan directamente. Las tareas de grupo aparecen como *Disponible para reclamar*: un integrante las reclama y recién entonces las completa.

---

## 6. Sitio web

Se ejecuta en una terminal propia, que queda abierta mientras se usa el sitio.

**Linux (Bash):**

```bash
cd web
npm install                                   # solo la primera vez
export SESSION_SECRET="un-texto-largo-cualquiera"
npm start                                     # http://localhost:3000
```

**Windows (PowerShell):**

```powershell
cd web
npm install
$env:SESSION_SECRET="un-texto-largo-cualquiera"
npm start
```

Debe mostrar `Web institucion escuchando en http://localhost:3000`.

| Sección | Dirección | Uso |
|---|---|---|
| Solicitud pública | `/solicitar` | Registra la empresa y el curso e inicia la instancia del proceso |
| Empresas | `/empresa` | Cursos de la empresa, estado y actividades en curso (incluidas las paralelas) |
| Administración | `/admin` | Tareas del grupo `administracion`: propuesta, envío, revisión, archivo, lista definitiva, evaluación de recursos, envío del informe |
| Equipo docente | `/docentes` | Definir docente, desarrollar curso, elaborar informe (genera el PDF) |

**Campos de prueba:** el formulario de solicitud muestra, en modo desarrollo (`DEV_MODE`, activo por defecto), dos campos opcionales:
- `plazoRespuesta`: duración ISO 8601 del plazo de respuesta, por ejemplo `PT30S` para 30 segundos en lugar de 5 días;
- `simularFaltaAulas`: provoca la excepción de falta de aulas.

Variables de configuración y estructura del sitio: [`web/README.md`](web/README.md).

---

## 7. Simulador de la empresa (CLI)

Programa de consola que actúa como la empresa sobre una instancia: aceptar la propuesta (con fecha), rechazarla, pedir modificaciones (con observaciones), enviar la nómina y cancelar durante la preparación. Lista las instancias activas y, para la elegida, ofrece solo las comunicaciones que el proceso espera en ese momento.

**Linux (Bash):**

```bash
export FLOWABLE_REST_USER=jefeAdmin FLOWABLE_REST_PASSWORD=test
mvn -q exec:java -Dexec.mainClass=unrc.cursos.simulador.SimuladorMain
```

**Windows (PowerShell):**

```powershell
chcp 65001                                    # para ver bien las tildes
$env:FLOWABLE_REST_USER="jefeAdmin"
$env:FLOWABLE_REST_PASSWORD="test"
mvn -q exec:java "-Dexec.mainClass=unrc.cursos.simulador.SimuladorMain"
```

| Variable | Obligatoria | Valor por defecto |
|---|---|---|
| `FLOWABLE_REST_USER`, `FLOWABLE_REST_PASSWORD` | Sí (si faltan, se piden por consola) | — |
| `FLOWABLE_REST_URL` | No | `http://localhost:8080/flowable-rest/service` |

**Formato de los datos:**
- Fecha acordada: ISO 8601 en UTC, por ejemplo `2026-12-01T09:00:00Z`. Para generar una fecha 5 minutos en el futuro:
  - Linux: `date -u -d '+5 minutes' +%Y-%m-%dT%H:%M:%SZ`
  - Windows: `(Get-Date).ToUniversalTime().AddMinutes(5).ToString("yyyy-MM-ddTHH:mm:ssZ")`
- Nómina: arreglo JSON, por ejemplo `["Ana","Beto","Carla"]`.

---

## 8. App de escritorio "Preparar materiales"

Ventana Java que usa la API Java de Flowable directamente contra la base del motor (no usa REST). Permite ingresar con un usuario de Flowable, ver las tareas *Preparar materiales* asignadas o disponibles para sus grupos, reclamarlas y completarlas. Incluye el botón **Analisis del historial** (consultas 4.3).

**Linux (Bash):**

```bash
export FLOWABLE_DB_USER=flowable FLOWABLE_DB_PASSWORD=flowable
mvn -q exec:java -Dexec.mainClass=unrc.cursos.escritorio.AppMateriales
```

**Windows (PowerShell):**

```powershell
chcp 65001
$env:FLOWABLE_DB_USER="flowable"
$env:FLOWABLE_DB_PASSWORD="flowable"
mvn -q exec:java "-Dexec.mainClass=unrc.cursos.escritorio.AppMateriales"
```

Se ingresa con `admin2` o `jefeAdmin`. Botones: **Reclamar tarea**, **Completar tarea** (solo una tarea asignada al usuario), **Actualizar**, **Cambiar usuario**.

| Variable | Obligatoria | Valor por defecto |
|---|---|---|
| `FLOWABLE_DB_USER`, `FLOWABLE_DB_PASSWORD` | Sí | — |
| `FLOWABLE_DB_URL` | No | `jdbc:postgresql://localhost:5432/flowable` |
| `FLOWABLE_DB_DRIVER` | No | `org.postgresql.Driver` |
| `FLOWABLE_DB_SCHEMA_UPDATE` | No | `false` (no modifica el esquema del motor) |
| `FLOWABLE_DB_CONFIG` | No | Ruta a un archivo `.properties` con las claves `flowable.db.url`, `flowable.db.user`, `flowable.db.password`, `flowable.db.driver` y `flowable.db.schemaUpdate` |

Si *Preparar materiales* es la última rama pendiente, al completarla el motor de la propia app continúa el proceso hasta *Enviar confirmación*.

---

## 9. Interfaz de Flowable

Las tareas *Solicitar Aula Virtual*, *Contratar equipamiento* y *Liberar Equipamiento* no tienen pantalla en el sitio; la consigna permite completarlas en la interfaz de Flowable. También puede usarse para *Preparar materiales* y *Elaborar informe de resultados*.

1. Abrir http://localhost:8081/flowable-ui e ingresar con un usuario del grupo correspondiente (por ejemplo `admin2` / `test`).
2. Entrar a la aplicación **Tasks**. Las tareas de grupo figuran en la lista de tareas en cola (*Queued*).
3. Abrir la tarea, **Claim** (reclamar) y **Complete** (completar).

---

## 10. Postman

`postman/proyecto-bpmn.postman_collection.json` reúne las llamadas a la API REST de Flowable que usa el proyecto. Sirve para ejecutar el proceso completo sin el sitio ni el simulador, y para consultar el estado del motor.

| Carpeta de la colección | Llamadas |
|---|---|
| 1. Identidad | Usuarios, grupos y sus miembros |
| 2. Despliegue | Desplegar BPMN o DMN; listar despliegues y definiciones |
| 3. Instancias | Iniciar (por clave o por el mensaje *Solicitud de curso*), listar, ver variables, borrar |
| 4. Tareas | Listar, buscar por clave, tareas propias y de grupo, reclamar, completar, completar *Evaluar Recursos* y *Definir docente* |
| 5. Comunicaciones de la empresa | Aceptar (con fecha), rechazar, pedir modificaciones, cancelar, enviar nómina |
| 6. Viabilidad y plazos | Regla DMN, plazo corto, conteo de cursos en ejecución, timers pendientes |

**Importación:** abrir Postman (`postman` en Linux; menú Inicio en Windows) → **Import** → elegir el archivo de la colección. La consola (*View → Show Postman Console*) muestra los identificadores que guardan los scripts y los motivos de error.

**Variables de la colección** (pestaña *Variables*):

| Variable | Valor por defecto | Uso |
|---|---|---|
| `baseUrl`, `dmnUrl` | `http://localhost:8080/flowable-rest/service`, `…/dmn-api` | Servidor REST de Flowable |
| `usuario`, `clave` | `jefeAdmin`, `test` | Credenciales de cada llamada; se cambian según quién hace la tarea |
| `processKey` | `Process_Curso` | Clave del proceso |
| `cursoId`, `empresaId` | `101`, `2` | Datos con los que se inicia una instancia (la empresa debe existir: 1 o 2) |
| `taskKey` | `Propuesta` | Clave de la tarea que se busca |
| `mensaje` | `Aceptación` | Mensaje genérico de la carpeta 5 |
| `processInstanceId`, `taskId`, `executionId` | — | Las asignan los scripts de la colección |

**Secuencia de una tarea:** *Buscar tarea por clave* (guarda `taskId`) → *Reclamar tarea* (solo tareas de grupo) → *Completar tarea*.

| `taskKey` | Tarea | `usuario` | ¿Se reclama? |
|---|---|---|---|
| `Propuesta`, `Enviar`, `Revisar`, `Archivar`, `EnviarInforme` | Tareas del jefe administrativo | `jefeAdmin` | No |
| `Lista` | Confeccionar lista definitiva | el que asignó el listener | No |
| `Material`, `Activity_12i2hpf`, `Virtual`, `Equipo`, `Activity_1m08pcl` | Materiales, evaluar recursos, aula virtual, equipamiento, liberar equipamiento | `admin2` o `jefeAdmin` | Sí |
| `Activity_1018bdz`, `Informe` | Definir docente, elaborar informe | `jefeDocente` | No |
| `Dictar` | Desarrollar curso | el docente elegido | No |

Las comunicaciones de la empresa responden `204` cuando se aplican y `404` cuando la instancia no espera esa comunicación. *Completar tarea* no debe ejecutarse con `taskId` vacío: Flowable interpreta ese pedido como la creación de una tarea nueva.

**Ejecución por línea de comandos (Newman)**, igual en Linux y Windows:

```bash
npm install -g newman
newman run postman/proyecto-bpmn.postman_collection.json --folder "1. Identidad"
```

---

## 11. Correo de prueba (SMTP)

El proceso envía avisos por correo a la empresa (propuesta, recordatorio, no viable, confirmación, cierre, informe). Si no hay un servidor de correo escuchando, el aviso queda registrado en el log y el proceso continúa igual. Para ver los correos se usa un servidor SMTP de prueba: DevNullSmtp, o el incluido en el repositorio.

| Sistema | Puerto | Contenedores | Servidor de prueba |
|---|---|---|---|
| Linux | **2525** (los puertos menores a 1024 requieren `root`) | `SMTP_PORT=2525 docker compose up -d` | `node scripts/escenarios/m-smtp-sumidero.js 2525` o `java -jar DevNullSmtp.jar` con puerto 2525 |
| Windows | **25** (valor por defecto) | `docker compose up -d` | `node scripts\escenarios\m-smtp-sumidero.js 25` o `java -jar DevNullSmtp.jar` con puerto 25 |

`SMTP_PORT` se lee al crear los contenedores: si se cambia, hay que volver a ejecutar `docker compose up -d` con la variable definida.

**Log de avisos:**
- Linux: `docker logs flowable-rest 2>&1 | grep Aviso`
- Windows: `docker logs flowable-rest 2>&1 | Select-String Aviso`

---

## 12. Análisis del historial (consigna 4.3 y 4.4)

Las dos partes necesitan instancias terminadas. El generador crea 55, con recorridos variados (unos 4 minutos). **Borra el historial previo** de `Process_Curso`, salvo que se use `--conservar-historial`.

```bash
node mineria/generar_historial.js
```

### 4.3 — Consultas (Java, API de Flowable)

En la app de escritorio, con el botón **Analisis del historial**, o por consola:

**Linux (Bash):**

```bash
mvn -q dependency:build-classpath -Dmdep.outputFile=target/classpath.txt
FLOWABLE_DB_USER=flowable FLOWABLE_DB_PASSWORD=flowable \
  java -cp "target/classes:$(cat target/classpath.txt)" unrc.cursos.analisis.AnalisisMain
```

**Windows (PowerShell):**

```powershell
mvn -q dependency:build-classpath "-Dmdep.outputFile=target/classpath.txt"
$env:FLOWABLE_DB_USER="flowable"; $env:FLOWABLE_DB_PASSWORD="flowable"
java -cp "target/classes;$(Get-Content target/classpath.txt)" unrc.cursos.analisis.AnalisisMain
```

La salida de la corrida entregada está en `mineria/resultados-4.3.txt`.

### 4.4 — Minería de procesos (Python, PM4Py)

**Linux (Bash):**

```bash
cd mineria
python3 -m venv .venv && source .venv/bin/activate
pip install pm4py pandas requests
FLOWABLE_USER=rest-admin FLOWABLE_PASSWORD=test python exportar_history.py   # genera eventos.csv
python analizar.py         # resultados.txt, recorridos.png, modelo_descubierto.png y .bpmn
```

**Windows (PowerShell):**

```powershell
cd mineria
python -m venv .venv; .venv\Scripts\activate
pip install pm4py pandas requests
$env:FLOWABLE_USER="rest-admin"; $env:FLOWABLE_PASSWORD="test"
python exportar_history.py
python analizar.py
```

Si no se definen `FLOWABLE_USER` y `FLOWABLE_PASSWORD`, `exportar_history.py` las pide por consola. La adaptación de los scripts, los resultados y la conclusión están en [`docs/mineria.md`](docs/mineria.md).

---

## 13. Pruebas

| Qué | Comando | Necesita el entorno levantado |
|---|---|---|
| Tests de Java (motor en memoria H2) | `mvn test` | No |
| Tests del sitio web | `cd web` y `npm test` (cobertura: `npm run test:coverage`) | Solo `tests/integration.test.js` |
| Escenarios 1 a 7 y 11, automáticos (~4 min) | `node scripts/escenarios/m-escenarios.js` | Sí |
| Escenarios 8, 9 y 10 | Verificación registrada en [`docs/revisiones-manuales.md`](docs/revisiones-manuales.md) | Sí |

**Recorrido automático de escenarios** (`scripts/escenarios/`):

```bash
node scripts/escenarios/m-escenarios.js               # escenarios 1 a 7 y 11
node scripts/escenarios/m-escenarios.js --solo=3,5    # solo algunos
node scripts/escenarios/m-escenarios.js --conservar   # no borra el modelo desplegado al terminar
node scripts/escenarios/m-limpiar-instancias.js       # borra las instancias activas de Process_Curso
node scripts/escenarios/m-aceptacion-sin-fecha.js     # reproduce el error de una aceptación sin fechaCurso
```

- En Windows se usan las mismas líneas, con `\` en las rutas.
- En Linux se antepone `SMTP_PORT=2525` (sección 11).
- Requiere el entorno de la sección 4 y `mvn package -DskipTests`. Las instancias activas previas se **borran**, porque cuentan para el límite de 5.
- Antes de ejecutarlo hay que cerrar el servidor SMTP de prueba, porque el script abre el suyo en el mismo puerto para verificar los correos.
- Al terminar deja en Flowable solo "Demo processes": hay que volver a ejecutar `desplegar-modelo` para seguir usando el proceso. Con `--conservar` no hace falta.
- **Resultado:**
  - código de salida 0 si todos los escenarios dan PASS;
  - log completo en `scripts/escenarios/resultados/m-escenarios.log`;
  - las líneas `✔`/`✘` son las verificaciones, y el bloque `RESUMEN` da el resultado por escenario.
- El escenario 11 ejecuta el simulador real con entrada guionada y la lógica de la app de escritorio (`ServicioTareas`) sin interfaz, mediante `m-MaterialesApiJava.java`.

---

## 14. Apagar y reiniciar

| Acción | Comando |
|---|---|
| Cerrar el sitio, el simulador o el servidor SMTP | `Ctrl + C` en su terminal |
| Apagar los contenedores conservando los datos | `docker compose down` |
| Apagar y **borrar** todos los datos | `docker compose down -v` (después se repite la sección 4) |
| Volver a los datos de prueba sin borrar el motor | `crear-bd` (sección 4) y `node scripts/escenarios/m-limpiar-instancias.js` |

---

## 15. Solución de problemas

| Síntoma | Causa y solución |
|---|---|
| `flowable-ui` en `Exited (1)` en el primer arranque | Conflicto al crear las tablas. Repetir `docker compose up -d` y esperar ~40 s |
| `target/cursos-flowable.jar` es una **carpeta** | Docker se levantó antes de compilar. Borrarla, ejecutar `mvn package -DskipTests` y `docker compose up -d` |
| Los cambios en Java no se reflejan | `mvn package -DskipTests` y `docker compose restart flowable-rest flowable-ui` |
| `localhost:3000` no responde | El sitio no está en ejecución (sección 6). En Linux: `ss -ltnp \| grep ':3000'` |
| "CUIT invalido" al solicitar | El CUIT no pasa el dígito verificador; por ejemplo, `30-72233445-7` es válido |
| Error al solicitar, en *Evaluar Viabilidad* | La regla DMN no está desplegada: ejecutar `desplegar-modelo` |
| Una solicitud nueva queda `NO_VIABLE` | Hay 5 o más instancias activas: `node scripts/escenarios/m-limpiar-instancias.js` |
| *Definir docente* no se puede completar | La aceptación se envió sin `fechaCurso` |
| El temporizador de la fecha no vence | La fecha no está en UTC o está lejos; generarla como en la sección 7 |
| La app de escritorio no muestra tareas | El proceso aún no llegó a la preparación, o el usuario no es del grupo `administracion`; usar **Actualizar** |
| La app de escritorio no conecta (`TimeZone`) | Ya está resuelto en el código; verificar `FLOWABLE_DB_USER` y `FLOWABLE_DB_PASSWORD` |
| No llegan correos al servidor de prueba | Revisar que el puerto del servidor coincida con `SMTP_PORT` de los contenedores (sección 11) |
| Linux: `bad interpreter` o `$'\r'` en un `.sh` | Finales de línea de Windows: `sed -i 's/\r$//' scripts/*.sh` |
| Linux: `Permission denied` en un `.sh` | `chmod +x scripts/*.sh` |
| Windows: tildes mal mostradas | `chcp 65001` en esa terminal |
| Windows: el script `.ps1` no se ejecuta | Usar `powershell -ExecutionPolicy Bypass -File …` como en la sección 4 |

---

## 16. Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `docs/` | Consigna y documentación del proyecto (tabla del inicio) |
| `modelo/` | Modelo ejecutable (`.bpmn20.xml`), regla DMN (`.dmn`) y modelo conceptual original (`.conceptual.bpmn`) |
| `src/main/java/unrc/cursos/` | Componentes del motor; subpaquetes `simulador/`, `escritorio/` y `analisis/` |
| `src/test/` | Tests de Java y procesos BPMN de prueba |
| `web/` | Sitio web (`src/`) y sus pruebas (`tests/`) |
| `db/` | `schema.sql`, `datos.sql` y `migraciones/` de la base `institucion` |
| `scripts/` | `crear-usuarios`, `crear-bd`, `desplegar-modelo` (`.sh` y `.ps1`); `escenarios/` con el recorrido automático y el servidor SMTP de prueba |
| `mineria/` | Generador de historial, scripts de minería, CSV, resultados y gráficos |
| `postman/` | Colección de Postman |
| `docker-compose.yml`, `pom.xml` | Contenedores y compilación del Java |
