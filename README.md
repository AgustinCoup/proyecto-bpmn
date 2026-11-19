# Proyecto BPMN: organización de cursos de capacitación

Proyecto final de *Gestión y Tecnologías de Procesos de Negocio* (UNRC). Una institución de capacitación gestiona los cursos que le piden las empresas con un proceso ejecutable en **Flowable 6.8.0**: viabilidad, negociación de la propuesta, preparación en paralelo, dictado, informe y liberación de recursos. La consigna está en [`docs/consigna.pdf`](docs/consigna.pdf).

---

## 1. Cómo está armado

```
 Navegador ──HTTP :3000──► Sitio web (Node.js, web/) ──REST──┐
 CLI "empresa" (Java) ──────────────────────────────REST──┐  │
                                                          ▼  ▼
                                  Flowable (:8080 REST, :8081 UI) + cursos-flowable.jar ──► correo (SMTP)
                                                          │
 App "Preparar materiales" (Java, API Java de Flowable) ──┤ JDBC
 Sitio web ──JDBC────────────────────────────────────┐    │
                                                     ▼    ▼
                     PostgreSQL :5432 · base institucion (empresas, cursos, informes) · base flowable (motor)
```

| Pieza | Qué hace |
|---|---|
| **Modelo** (`modelo/`) | `Proyecto_Organizacion_cursos.bpmn20.xml` es el proceso `Process_Curso` que se despliega; `viabilidadCurso.dmn` es la regla de viabilidad (menos de 5 cursos en ejecución). |
| **JAR del motor** (`src/main/java/unrc/cursos/`) | Listeners y delegates que corren dentro de Flowable: contar cursos, habilitar el acceso de la empresa, reservar y liberar aulas, notificar por correo, asignar al administrativo menos cargado. |
| **Sitio web** (`web/`) | Solicitud pública, seguimiento para empresas y pantallas de administración y docentes. Habla con Flowable por REST. |
| **Simulador de la empresa** (`…/simulador/`) | CLI que envía las respuestas de la empresa por REST. Solo ofrece las acciones habilitadas en cada momento. |
| **App de escritorio** (`…/escritorio/`) | Ventana Swing para la tarea *Preparar materiales*. Usa la API Java de Flowable directamente contra la base del motor. |
| **Análisis** (`…/analisis/`, `mineria/`) | Consultas 4.3 sobre el historial y minería de procesos 4.4. |

Las tareas *Solicitar Aula Virtual*, *Contratar equipamiento* y *Liberar Equipamiento* no tienen pantalla en el sitio: se reclaman y completan en la interfaz de Flowable (app **Tasks**), como permite la consigna.

---

## 2. Puesta en marcha

**Requisitos:** Docker (en Windows, Docker Desktop abierto), Java 11+, Maven 3.8+, Node.js 18+ y los puertos 5432, 8080, 8081 y 3000 libres. En Ubuntu, tu usuario debe estar en el grupo `docker`.

Desde la raíz del repositorio, una sola vez y en este orden:

```bash
mvn package -DskipTests        # arma target/cursos-flowable.jar (antes de levantar Docker)
docker compose up -d           # PostgreSQL + Flowable REST + Flowable UI
./scripts/crear-usuarios.sh    # usuarios y grupos de Flowable
./scripts/crear-bd.sh          # base "institucion" con datos de prueba
./scripts/desplegar-modelo.sh  # regla DMN + proceso (repetir si cambia el modelo)
```

En Windows (PowerShell), los scripts son los `.ps1`: `powershell -ExecutionPolicy Bypass -File scripts\crear-usuarios.ps1`, y lo mismo con `crear-bd.ps1` y `desplegar-modelo.ps1`. En Ubuntu, la primera vez hace falta `chmod +x scripts/*.sh`.

Después de un minuto, `docker compose ps` debe mostrar 3 contenedores `Up`.

---

## 3. Sitio web

En otra terminal, que queda abierta mientras se usa el sitio:

```bash
cd web
npm install
export SESSION_SECRET="cualquier-texto-largo"     # PowerShell: $env:SESSION_SECRET="..."
npm start                                         # http://localhost:3000
```

Más detalle (variables, módulos, pruebas) en [`web/README.md`](web/README.md).

---

## 4. Usuarios y direcciones

Todas las claves son `test`.

| Quién | Usuario | Entra por |
|---|---|---|
| Jefe administrativo / administrativo (grupo `administracion`) | `jefeAdmin`, `admin2` | http://localhost:3000/admin/login |
| Jefe docente / docentes (grupo `docentes`) | `jefeDocente`, `docente1`, `docente2` | http://localhost:3000/docentes/login |
| Empresa 1 (ya tiene cuenta) | `emp_30711223343` | http://localhost:3000/empresa/login |
| Empresa 2 (la cuenta se crea al aceptar una propuesta) | `emp_30722334457` | http://localhost:3000/empresa/login |
| Cualquiera (pedir un curso) | — | http://localhost:3000/solicitar |
| Administrador de la interfaz de Flowable | `admin` (o cualquiera de arriba) | http://localhost:8081/flowable-ui |
| Usuario de servicio de la API REST | `rest-admin` | http://localhost:8080/flowable-rest/docs/ |

PostgreSQL en `localhost:5432`: `flowable`/`flowable` y `institucion`/`institucion`.

Las tareas asignadas a una persona se completan directamente. Las de grupo aparecen como *Disponible para reclamar*: primero se **reclaman** y después se completan.

---

## 5. Simulador de la empresa (CLI)

Hace de empresa: acepta (con fecha ISO 8601), rechaza, pide modificaciones, envía la nómina (array JSON) o cancela. Necesita una solicitud ya iniciada desde `/solicitar`.

```bash
export FLOWABLE_REST_USER=jefeAdmin FLOWABLE_REST_PASSWORD=test
mvn -q exec:java -Dexec.mainClass=unrc.cursos.simulador.SimuladorMain
```

Si faltan las credenciales, el programa las pide. `FLOWABLE_REST_URL` cambia el servidor (por defecto, `http://localhost:8080/flowable-rest/service`).

---

## 6. App de escritorio "Preparar materiales"

```bash
export FLOWABLE_DB_USER=flowable FLOWABLE_DB_PASSWORD=flowable
mvn -q exec:java -Dexec.mainClass=unrc.cursos.escritorio.AppMateriales
```

Se ingresa con `admin2` (o `jefeAdmin`). La tabla lista las tareas *Preparar materiales* del usuario y de sus grupos: **Reclamar tarea**, **Completar tarea**, **Actualizar** y **Cambiar usuario**. No deja completar tareas de otro usuario. Variables opcionales: `FLOWABLE_DB_URL` (por defecto `jdbc:postgresql://localhost:5432/flowable`), o un archivo de propiedades indicado en `FLOWABLE_DB_CONFIG`.

En PowerShell, las variables se definen con `$env:NOMBRE="valor"` y el `-D…` va entre comillas: `"-Dexec.mainClass=…"`. Si no se ven bien las tildes, ejecutar antes `chcp 65001`.

---

## 7. Análisis del historial (consigna 4.3 y 4.4)

Las dos partes necesitan historial. `node mineria/generar_historial.js` crea 55 instancias terminadas con recorridos variados (tarda unos 4 minutos y **borra el historial previo** de `Process_Curso`, salvo que se le pase `--conservar-historial`).

**4.3, consultas** (API Java): botón **Analisis del historial** en la app de escritorio, o por consola:

```bash
mvn -q dependency:build-classpath -Dmdep.outputFile=target/classpath.txt
java -cp "target/classes:$(cat target/classpath.txt)" unrc.cursos.analisis.AnalisisMain   # en Windows el separador es ;
```

Usa las mismas variables `FLOWABLE_DB_*` que la app. La salida entregada está en `mineria/resultados-4.3.txt`.

**4.4, minería de procesos** (Python + PM4Py; requiere Graphviz):

```bash
cd mineria
python3 -m venv .venv && source .venv/bin/activate && pip install pm4py pandas requests
FLOWABLE_USER=rest-admin FLOWABLE_PASSWORD=test python exportar_history.py   # genera eventos.csv
python analizar.py                  # resultados.txt, recorridos.png, modelo_descubierto.png/.bpmn
```

`exportar_history.py` y `analizar.py` son los scripts provistos por la cátedra, adaptados al proyecto sin cambiar su lógica:

- apuntan a `flowable-rest` y al proceso `Process_Curso`;
- filtran las 17 actividades de la negociación;
- leen las credenciales de variables de entorno, si están definidas;
- guardan sus archivos junto al script y copian la salida de consola en `resultados.txt`.

Se mantuvo el filtro original a `userTask`/`serviceTask`. El detalle de cada cambio está en [`docs/mineria-cambios-py.md`](docs/mineria-cambios-py.md); los resultados y la comparación con el modelo, en [`docs/mineria-conclusion.md`](docs/mineria-conclusion.md).

---

## 8. Pruebas

| Qué | Comando |
|---|---|
| Java (sin Docker) | `mvn test` |
| Sitio web | `cd web && npm test` (la prueba de integración necesita el entorno levantado) |
| Escenarios 1–7 y 11, automáticos (~4 min) | `node scripts/escenarios/m-escenarios.js` (ver [`scripts/escenarios/README.md`](scripts/escenarios/README.md)) |
| Escenarios 8, 9 y 10, manuales | [`docs/checklist-manual.md`](docs/checklist-manual.md) |
| Escenarios con Postman, DevNull y la app Java | [`docs/guia-postman-devnull.md`](docs/guia-postman-devnull.md) |
| Borrar instancias de prueba | `node scripts/escenarios/m-limpiar-instancias.js` |

Después de `m-escenarios.js` hay que volver a correr `desplegar-modelo` para seguir probando a mano. En Ubuntu el puerto 25 es privilegiado: usar `SMTP_PORT=2525` tanto en `docker compose up -d` como en el script.

---

## 9. Apagar

`docker compose down` apaga los contenedores y conserva los datos. `docker compose down -v` los borra; después hay que repetir la sección 2. El sitio web se cierra con `Ctrl + C`.

---

## 10. Si algo falla

| Síntoma | Solución |
|---|---|
| `flowable-ui` en `Exited (1)` en el primer arranque | Repetir `docker compose up -d` y esperar ~40 s. |
| `target/cursos-flowable.jar` es una **carpeta** | Se levantó Docker antes de compilar: borrarla, `mvn package -DskipTests` y `docker compose up -d`. |
| Se recompiló el Java con los contenedores arriba | `docker compose restart flowable-rest flowable-ui`. |
| `localhost:3000` no abre | Falta `npm start` corriendo (sección 3). |
| "CUIT invalido" al solicitar | Usar un CUIT válido, p. ej. `30-72233445-7`. |
| Falla en *Evaluar Viabilidad* | Falta la regla DMN: correr `desplegar-modelo`. |
| Una solicitud nueva queda `NO_VIABLE` sin razón | Hay 5 o más instancias viejas activas: `node scripts/escenarios/m-limpiar-instancias.js`. |
| La app de materiales no muestra tareas | Todavía no se confirmó la lista de participantes, o el usuario no es del grupo `administracion`. |
| Ubuntu: `bad interpreter` o `$'\r'` | `sed -i 's/\r$//' scripts/*.sh` |
| Tildes rotas en Windows | `chcp 65001` en esa terminal. |

---

## 11. Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `docs/` | Consigna, informe, licencias respecto de la consigna, cambios a los scripts de minería y su conclusión, guías de prueba manual. |
| `modelo/` | Modelo ejecutable (`.bpmn20.xml`), regla DMN, modelo conceptual original del equipo (`.conceptual.bpmn`, no ejecutable) y registro de cambios (`cambios-modelo.md`). |
| `src/` | Código Java (JAR del motor, CLI, app de escritorio, análisis 4.3) y sus pruebas. |
| `web/` | Sitio web (`src/`) y sus pruebas (`tests/`). |
| `db/` | Esquema, datos de prueba y migraciones de la base `institucion`. |
| `scripts/` | Preparación del entorno (`.sh` y `.ps1`) y recorrido automático de escenarios. |
| `mineria/` | Generador de historial, scripts de minería, datos y resultados de 4.3 y 4.4. |
| `postman/` | Colección de Postman. |
