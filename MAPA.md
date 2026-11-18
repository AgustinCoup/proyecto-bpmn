# MAPA del proyecto

> **Para quién es este archivo:** para alguien que **no sabe nada** del proyecto y quiere, al terminar de leerlo y de seguir los pasos, **entender el programa completo**.
> Va de lo más básico a lo más complejo. Si solo querés los comandos de arranque, andá al [README.md](README.md).

---

## Índice

1. [De qué trata el proyecto](#1-de-qué-trata-el-proyecto)
2. [Cómo se conecta todo: la web, la app Java y el CLI](#2-cómo-se-conecta-todo-la-web-la-app-java-y-el-cli)
3. [Qué hay en cada carpeta](#3-qué-hay-en-cada-carpeta)
4. [Las personas (usuarios) y sus claves](#4-las-personas-usuarios-y-sus-claves)
5. [Arranque del entorno](#5-arranque-del-entorno) — **Windows** y **Ubuntu**, separados
6. [Recorrido completo paso a paso](#6-recorrido-completo-paso-a-paso) — simulando el flujo natural del programa
7. [Probar otros caminos (variantes)](#7-probar-otros-caminos-variantes)
8. [Tests automáticos](#8-tests-automáticos)
9. [Apagar y limpiar](#9-apagar-y-limpiar)
10. [Si algo falla](#10-si-algo-falla)
11. [Mapa de todos los archivos .md](#11-mapa-de-todos-los-archivos-md)

---

## 1. De qué trata el proyecto

### La idea en una frase

Una **institución de capacitación** vende cursos a **empresas**. Este proyecto automatiza, con un motor de procesos llamado **Flowable**, todo el camino de un curso: desde que la empresa lo pide hasta que se dicta y se archiva.

### El recorrido de un curso (versión corta)

```
La empresa pide un curso
        │
        ▼
¿Se puede hacer?  (regla automática: si ya hay 5 cursos en marcha → NO)
        │ sí
        ▼
La institución arma y envía una PROPUESTA (precio, programa, fechas)
        │
        ▼
La empresa responde:  ACEPTA  /  RECHAZA  /  PIDE CAMBIOS  /  no responde
        │ acepta
        ▼
Se le habilita un usuario a la empresa para seguir su curso
        │
        ▼
SE PREPARA EL CURSO (varias cosas a la vez):
   · la empresa manda la lista de participantes
   · se confirma la lista
   · se preparan materiales
   · se decide qué recursos hacen falta (aula, plataforma virtual, equipamiento)
        │
        ▼
Se avisa a la empresa que el curso está confirmado
        │
        ▼
Se elige un docente → llega la fecha → el docente dicta el curso
        │
        ▼
Se hace un informe de resultados (PDF) → se envía a la empresa → se archiva
        │
        ▼
Se liberan los recursos usados (aula, equipamiento)  → FIN
```

Además, la empresa puede **cancelar** mientras se prepara el curso, y el sistema devuelve los recursos ya reservados.

### Palabras que vas a ver (glosario mínimo)

| Palabra | Qué significa, sin vueltas |
|---|---|
| **Proceso** | La receta del recorrido de arriba. Se llama `Process_Curso`. Está dibujado en un archivo BPMN. |
| **BPMN** | Un "idioma" para dibujar procesos con cajitas y flechas. El archivo es `modelo/Proyecto_Organizacion_cursos.bpmn20.xml`. |
| **Flowable** | El programa (motor) que lee esa receta y la **ejecuta**: crea tareas, espera respuestas, avanza. |
| **Instancia** | Un curso concreto en marcha. Si hay 3 empresas pidiendo cursos, hay 3 instancias del mismo proceso. |
| **Tarea** | Algo que una **persona** tiene que hacer (ej. "Registrar y elaborar propuesta"). Aparece en una lista; al completarla, el proceso avanza. |
| **Reclamar una tarea** | Algunas tareas son "de un grupo" (cualquiera del grupo puede hacerla). Primero una persona la **reclama** (se la queda) y después la completa. Evita que dos personas hagan lo mismo. |
| **Mensaje / señal** | Algo que llega **desde afuera** al proceso (la empresa acepta, rechaza, manda la nómina…). |
| **DMN** | Una tabla de decisión. Acá decide si el curso es "viable" (`cursos en ejecución < 5`). |
| **API REST** | La "puerta" por la que otros programas hablan con Flowable usando direcciones web (URLs). |
| **Docker** | Programa que corre cosas (Flowable, la base de datos) en "cajas" aisladas, sin instalarlas a mano. |

---

## 2. Cómo se conecta todo: la web, la app Java y el CLI

Este es **el punto clave** para entender el proyecto. Hay **5 piezas** que se hablan entre sí.

### El dibujo

```
   TU NAVEGADOR                CLI (consola Java)           APP DE ESCRITORIO (Java)
   (Chrome, etc.)              "Simulador de la empresa"    "Preparar materiales"
        │                              │                              │
        │ HTTP :3000                   │ HTTP (API REST)              │ JDBC directo
        ▼                              │                              │ (API Java de Flowable,
   SITIO WEB (Node.js)                 │                              │  sin REST)
   carpeta web/                        │                              │
     │            │                    │                              │
     │            │ HTTP (API REST)    │                              │
     │            ▼                    ▼                              │
     │      ┌──────────────────────────────────────┐                  │
     │      │ FLOWABLE (el motor del proceso)      │                  │
     │      │   :8080  API REST                    │                  │
     │      │   :8081  interfaz web de Flowable    │                  │
     │      │ + nuestro JAR cursos-flowable.jar    │──── SMTP ───►  correo (opcional)
     │      │   (clases Java automáticas)          │
     │      └──────────────┬───────────────────────┘
     │ JDBC                │ JDBC                                      │
     ▼                     ▼                                           ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │ PostgreSQL :5432                                                       │
   │   · base "institucion"  → empresas, cursos, cuentas, informes          │
   │   · base "flowable"     → la memoria del motor (instancias, tareas)    │
   └───────────────────────────────────────────────────────────────────────┘
```

Cómo leerlo: cada flecha es "este habla con aquel". El **sitio** usa dos caminos: REST hacia Flowable (para el proceso) y JDBC directo a la base `institucion` (para guardar empresas, cursos e informes). La **app de escritorio** salta a Flowable y va directo a la base `flowable`. El **JAR** vive dentro de Flowable y usa la base `institucion` y el correo.

### Las 5 piezas, una por una

| # | Pieza | Qué es | Cómo se enciende | Con quién habla |
|---|---|---|---|---|
| 1 | **PostgreSQL** | La base de datos. Guarda **dos** bases: `flowable` (la memoria del motor: instancias, tareas) e `institucion` (empresas, cursos, cuentas). | `docker compose up -d` | Es hablada por todos los demás. |
| 2 | **Flowable** (REST en `:8080`, interfaz en `:8081`) | El **motor** que ejecuta el proceso. Trae una API REST y una interfaz web propia. Lleva **dentro** nuestro JAR con clases Java (las "reglas" automáticas del proceso). | `docker compose up -d` | Lee/escribe en PostgreSQL; recibe órdenes por REST. |
| 3 | **Sitio web** (`web/`, puerto `:3000`) | Lo que usan las personas con el navegador: empresas, administrativos, docentes. Hecho con Node.js. | `npm start` | **Flowable por REST** (iniciar cursos, listar/completar tareas) y **directo a la base `institucion`** (guardar empresas, cursos, informes). |
| 4 | **CLI "Simulador de la empresa"** | Programa Java de **consola** (texto). **Hace de empresa**: acepta, rechaza, pide cambios, manda la nómina, cancela. | `mvn exec:java …SimuladorMain` | **Flowable por REST** (envía mensajes y señales). |
| 5 | **App Java "Preparar materiales"** | Programa Java de **escritorio** (ventana). Sirve para completar **una** tarea: *Preparar materiales*. | `mvn exec:java …AppMateriales` | **Directo a la base `flowable`** usando la API Java de Flowable (no usa REST). |

### Por qué existe cada una (la lógica del diseño)

- **El sitio web** cubre lo que hacen las personas. No ejecuta el proceso: **le pide cosas a Flowable**.
- **El CLI** existe porque la **empresa** "responde" por fuera del sitio (en la vida real sería un mail o un sistema suyo). El CLI simula esas respuestas y **solo te muestra las que son válidas en ese momento**.
- **La app Java** existe porque la consigna pide que *una* tarea se haga con un programa distinto del sitio y usando la **API Java** (otra forma de hablar con Flowable, distinta de REST).
- **El JAR dentro de Flowable** contiene el código que corre **solo**, sin que nadie lo toque: contar cursos en marcha, crear la cuenta de la empresa, reservar aula, mandar correos, repartir tareas al administrativo con menos carga, etc.

### Quién ve qué (resumen de las pantallas)

| Quién | Dónde entra | Qué hace |
|---|---|---|
| Visitante / empresa nueva | http://localhost:3000/solicitar | Pide un curso. |
| Empresa con cuenta | http://localhost:3000/empresa/login | **Solo mira** sus cursos y su estado. (Responder se hace con el CLI.) |
| Administrativos | http://localhost:3000/admin/login | Tareas de administración. |
| Docentes | http://localhost:3000/docentes/login | Tareas de docencia. |
| Cualquier trabajador | http://localhost:8081/flowable-ui | Interfaz de Flowable: para las tareas que el sitio no cubre (aula virtual, equipamiento). |

---

## 3. Qué hay en cada carpeta

| Ruta | Qué contiene |
|---|---|
| `modelo/` | El dibujo del proceso (`.bpmn20.xml`), la regla de viabilidad (`viabilidadCurso.dmn`) y el registro de cambios al modelo. |
| `src/main/java/unrc/cursos/` | Las clases Java que corren **dentro** de Flowable (listeners y delegates). |
| `src/main/java/unrc/cursos/simulador/` | El **CLI** (simulador de la empresa). |
| `src/main/java/unrc/cursos/escritorio/` | La **app de escritorio** "Preparar materiales". |
| `src/test/` | Tests de Java (`mvn test`). |
| `web/` | El **sitio web** (Node.js + Express + EJS). `web/src/admin`, `web/src/docentes`, `web/src/empresa`, `web/src/publico`. |
| `db/` | Estructura de la base `institucion` (`schema.sql`), datos de prueba (`datos.sql`) y migraciones. |
| `scripts/` | Scripts de preparación (`crear-usuarios`, `crear-bd`, `desplegar-modelo`; `.ps1` para Windows, `.sh` para Ubuntu). |
| `scripts/escenarios/` | Recorrido **automático** de los escenarios de la defensa. |
| `docker-compose.yml` | Define las "cajas": PostgreSQL, Flowable REST, Flowable UI. |
| `pom.xml` | Configuración de Maven (compila el Java y arma el JAR). |
| `postman/` | Colección de Postman (opcional). |
| `informe/` | Informe, licencias respecto de la consigna y la lista de pruebas manuales. |

---

## 4. Las personas (usuarios) y sus claves

**Todas las claves son `test`.**

### Personal de la institución (usuarios de Flowable)

| Usuario | Rol | Grupo | Entra por |
|---|---|---|---|
| `jefeAdmin` | Jefe administrativo | `administracion` | `/admin/login` |
| `admin2` | Administrativo | `administracion` | `/admin/login` |
| `jefeDocente` | Jefe del equipo docente | `docentes` | `/docentes/login` |
| `docente1` | Docente | `docentes` | `/docentes/login` |
| `docente2` | Docente | `docentes` | `/docentes/login` |

Dato extra: el usuario `admin` / `test` es el administrador de la interfaz de Flowable (`:8081`), y `rest-admin` / `test` es el usuario de servicio de la API REST (`:8080`).

### Empresas (NO son usuarios de Flowable)

Están en la tabla `cuenta_empresa` de la base `institucion`. El usuario se arma como `emp_` + CUIT sin guiones.

| Empresa | CUIT | ¿Tiene cuenta al inicio? | Usuario / clave |
|---|---|---|---|
| 1 — Agropecuaria Río Cuarto S.A. | `30-71122334-3` | Sí | `emp_30711223343` / `test` |
| 2 — Metalúrgica del Sur S.R.L. | `30-72233445-7` | **No** (se crea sola cuando acepta una propuesta) | `emp_30722334457` / `test` (después de aceptar) |

### Reclamar tareas: la regla de oro

- Tareas **asignadas a una persona** (ej. las del `jefeAdmin`): se abren y se completan directo.
- Tareas **del grupo**: aparecen como *"Disponible para reclamar"*. Hay que apretar **Reclamar** primero y recién después se completan.

---

## 5. Arranque del entorno

Hacelo **una sola vez** antes de cualquier prueba. Los comandos de **Windows** y de **Ubuntu** están separados: seguí **solo** el de tu sistema.

### 5.0 Qué tiene que estar instalado

| Programa | Para qué | Cómo comprobar (en una terminal) |
|---|---|---|
| **Docker** (en Windows: Docker Desktop **abierto**, con el ícono de la ballena sin errores) | PostgreSQL y Flowable | `docker --version` y `docker compose version` |
| **Java 11 o más** | Compilar y correr el CLI y la app de escritorio | `java -version` |
| **Maven 3.8 o más** | Compilar Java | `mvn -version` |
| **Node.js 18 o más** | El sitio web | `node -v` |

Los puertos **5432, 8080, 8081 y 3000** tienen que estar libres.

> **Ubuntu:** tu usuario tiene que estar en el grupo `docker` (para usar `docker` sin `sudo`) y el `nodejs` de los repositorios suele ser viejo: instalá uno actual con NodeSource o `nvm`.

### 5.1 Windows (PowerShell)

Abrí **PowerShell** y andá a la carpeta del proyecto (la que contiene `docker-compose.yml`):

```powershell
cd "C:\Users\tutyb\UNI - 2026\Gestion\proyecto-bpmn"
```

Ahora, **en este orden**:

```powershell
# 1) Compilar el Java y armar el JAR (target\cursos-flowable.jar). Tarda un rato la primera vez.
mvn package -DskipTests

# 2) Encender PostgreSQL + Flowable REST + Flowable UI
docker compose up -d

# 3) Crear usuarios y grupos en Flowable
powershell -ExecutionPolicy Bypass -File scripts\crear-usuarios.ps1

# 4) Crear la base "institucion" y cargar datos de prueba
powershell -ExecutionPolicy Bypass -File scripts\crear-bd.ps1

# 5) Cargar en Flowable la regla DMN y el proceso (BPMN)
powershell -ExecutionPolicy Bypass -File scripts\desplegar-modelo.ps1
```

### 5.2 Ubuntu (Bash)

Abrí una **terminal** y andá a la carpeta del proyecto:

```bash
cd ~/ruta/al/proyecto-bpmn      # la carpeta que contiene docker-compose.yml
```

Ahora, **en este orden**:

```bash
# 1) Compilar el Java y armar el JAR (target/cursos-flowable.jar). Tarda un rato la primera vez.
mvn package -DskipTests

# 2) Encender PostgreSQL + Flowable REST + Flowable UI
docker compose up -d

# 3) Darle permiso de ejecución a los scripts (solo la primera vez)
chmod +x scripts/crear-usuarios.sh scripts/crear-bd.sh scripts/desplegar-modelo.sh

# 4) Crear usuarios y grupos en Flowable
./scripts/crear-usuarios.sh

# 5) Crear la base "institucion" y cargar datos de prueba
./scripts/crear-bd.sh

# 6) Cargar en Flowable la regla DMN y el proceso (BPMN)
./scripts/desplegar-modelo.sh
```

### 5.3 Qué hace cada paso (en una línea)

| Paso | Qué hace y por qué |
|---|---|
| `mvn package` | Convierte el código Java en `cursos-flowable.jar`. **Tiene que existir antes de `docker compose up`**, porque Docker lo "monta" dentro de Flowable. |
| `docker compose up -d` | Enciende las 3 cajas (PostgreSQL, Flowable REST, Flowable UI). `-d` = en segundo plano. |
| `crear-usuarios` | Crea en Flowable los 5 usuarios, los 2 grupos y sus permisos. Sin esto, nadie puede ingresar. |
| `crear-bd` | Crea la base `institucion` (empresas, cursos, cuentas, informes) y la llena con 2 empresas de ejemplo. |
| `desplegar-modelo` | Le entrega a Flowable la regla de viabilidad y el proceso. Sin esto, Flowable no sabe qué es un "curso". **Repetir cada vez que cambie el modelo.** |

### 5.4 Comprobar que quedó vivo

**Esperá 1 minuto** después del `docker compose up -d` y probá en el navegador:

| Dirección | Qué tenés que ver |
|---|---|
| http://localhost:8080/flowable-rest/docs/ | Una página "Swagger". Si pide usuario: `rest-admin` / `test`. |
| http://localhost:8081/flowable-ui/ | La pantalla de ingreso de Flowable (usuario `admin` / `test`). |

Y en la terminal (igual en Windows y Ubuntu):

```
docker compose ps
```

Tienen que aparecer **3** contenedores en estado `Up`: `flowable-postgres`, `flowable-rest`, `flowable-ui`.

> ⚠️ **Primer arranque desde cero:** es normal que `flowable-ui` aparezca `Exited (1)` (los dos Flowable crean las tablas a la vez y chocan). Solución: repetí `docker compose up -d` y esperá ~40 segundos. `flowable-rest` ya está bien, así que podés seguir con los pasos 3 a 5/6 mientras tanto.

### 5.5 Encender el sitio web

Abrí **otra terminal nueva** (la dejás abierta todo el tiempo), andá a la carpeta del proyecto y:

**Windows (PowerShell):**

```powershell
cd "C:\Users\tutyb\UNI - 2026\Gestion\proyecto-bpmn\web"
npm install
$env:SESSION_SECRET="cualquier-texto-largo"
npm start
```

**Ubuntu (Bash):**

```bash
cd ~/ruta/al/proyecto-bpmn/web
npm install
export SESSION_SECRET="cualquier-texto-largo"
npm start
```

Tiene que imprimir `Web institucion escuchando en http://localhost:3000`. **No cierres esa terminal.** Abrí http://localhost:3000 → tiene que verse la página "Bienvenido".

> `npm install` solo hace falta la primera vez. `SESSION_SECRET` es un texto cualquiera que el sitio usa para firmar cookies.

---

## 6. Recorrido completo paso a paso

Ahora vas a **hacer de todos los personajes** y ver nacer, avanzar y terminar un curso. Cada paso te dice **qué hacer**, **por qué** y **qué tenés que ver**.

### 6.0 Antes de empezar: qué vas a tener abierto

Para no marearte, vas a usar **4 terminales** y el **navegador**. Dales nombres en tu cabeza:

| Nombre | Qué es | ¿Cuándo se abre? |
|---|---|---|
| **T1 — Comandos** | Terminal en la **carpeta raíz** del proyecto. Para chequeos y limpieza. | Ya |
| **T2 — Sitio** | La que dejaste con `npm start` (5.5). | Ya |
| **T3 — CLI** | El simulador de la empresa. | Paso 6.4 |
| **T4 — Materiales** | La app de escritorio. | Paso 6.8 |

> ⚠️ **Toda terminal nueva se abre en tu carpeta de usuario, no en el proyecto.** En T1, T3 y T4 lo primero es ir a la raíz (la carpeta con `pom.xml`): *Windows:* `cd "C:\Users\tutyb\UNI - 2026\Gestion\proyecto-bpmn"` · *Ubuntu:* `cd ~/ruta/al/proyecto-bpmn`. Si no, `mvn exec:java` y `node scripts/...` fallan.

**Navegador:** para cambiar de usuario en `/admin` usá **Cerrar sesión** (botón arriba) o una **ventana privada** distinta. Las sesiones de `/admin`, `/docentes` y `/empresa` son independientes entre sí.

**Una sola vez, dejá todo limpio.** En **T1** (raíz del proyecto), borrá instancias viejas (cuentan para el límite de 5 cursos):

```
node scripts/escenarios/m-limpiar-instancias.js
```

*Por qué por terminal:* es un script de utilidad que borra por la API REST las instancias de prueba que hayan quedado. No hay botón en el sitio para eso.

**Para ver los resultados en la base de datos**, estos comandos (iguales en Windows y Ubuntu, en **T1**) los vas a usar varias veces:

```
docker compose exec -T postgres psql -U institucion -d institucion -c "select id, empresa_id, estado, process_instance_id from curso order by id"
docker compose exec -T postgres psql -U institucion -d institucion -c "select id, empresa_id, usuario from cuenta_empresa order by id"
```

*Por qué:* `docker compose exec` entra a la caja de PostgreSQL y `psql` ejecuta una consulta SQL. Así mirás lo que el sistema guardó.

---

### 6.1 La empresa pide un curso (sitio web)

**Personaje:** una empresa que todavía no tiene cuenta (usamos la empresa 2: Metalúrgica del Sur).

1. En el navegador abrí **http://localhost:3000**.
2. Apretá **Solicitar un curso**.
3. Completá el formulario **con estos valores**:

   | Campo | Valor |
   |---|---|
   | Nombre de la empresa | `Metalúrgica del Sur S.R.L.` |
   | CUIT | `30-72233445-7` |
   | Nombre de contacto | `Laura Fernández` |
   | Email de contacto | `lfernandez@metalsur.com.ar` |
   | Telefono de contacto | `+54 358 422-3344` |
   | Tematica | `Soldadura industrial` |
   | Descripcion | `Curso básico para operarios.` |
   | Cantidad estimada de participantes | `3` |
   | Descripcion de fechas preferidas | `Diciembre 2026` |

   Si ves un recuadro **"Modo desarrollo"** (plazoRespuesta, simularFaltaAulas): **dejalo vacío**.

4. Apretá **Enviar solicitud**.

**Qué tenés que ver:** la pantalla **"Solicitud recibida"** con un número (anotalo: es el **id del curso**; lo llamamos `CURSO`).

**Qué pasó por detrás (esto es lo importante):**
1. El sitio buscó la empresa por CUIT (existía → la reutilizó; si no, la crea).
2. Guardó el curso en la base `institucion` con estado `EN_PROCESO`.
3. Le dijo a Flowable (por REST): *"iniciá el proceso con el mensaje `Solicitud de curso`"*.
4. Flowable ejecutó solo la **regla de viabilidad** (DMN): contó los cursos en marcha (`< 5` = viable).
5. Como era viable, creó la primera tarea para el jefe administrativo.
6. El sitio guardó en el curso el id de la instancia (`process_instance_id`) para vincularlos.

**Comprobalo en T1:**

```
docker compose exec -T postgres psql -U institucion -d institucion -c "select id, empresa_id, estado, process_instance_id from curso order by id desc limit 1"
```

Tiene que mostrar `estado = EN_PROCESO` y `process_instance_id` **con un valor** (no vacío).

---

### 6.2 El jefe administrativo arma la propuesta (sitio web, `/admin`)

**Personaje:** `jefeAdmin`.

1. Abrí **http://localhost:3000/admin/login**.
2. Usuario `jefeAdmin`, Clave `test` → **Ingresar**.
3. Vas a ver **"Mis tareas"**. Tiene que haber una fila: **Registrar y Elaborar propuesta**, estado **"Asignada a vos"**, botón **Completar**. *(Está asignada a una persona, por eso no hay botón Reclamar.)*
4. Apretá **Completar** en esa fila.
5. Completá:

   | Campo | Valor |
   |---|---|
   | Nombre del curso | `Soldadura industrial básica` |
   | Programa | `Seguridad, tipos de soldadura, práctica.` |
   | Presupuesto (ARS) | `250000` |
   | Fecha de inicio | `2026-12-01` |
   | Fecha de fin | `2026-12-15` |

6. Apretá **Guardar propuesta y completar tarea**.

**Qué tenés que ver:** vuelve a "Mis tareas" con un mensaje verde ("Propuesta guardada…") y la fila vieja desapareció.

**Por qué:** el sitio guardó esos datos en la tabla `curso` y recién después le dijo a Flowable "completé la tarea". El proceso avanzó.

7. En "Mis tareas" ahora aparece **Enviar propuesta** (también de `jefeAdmin`). Apretá **Completar** en la fila y, en la pantalla siguiente, **Completar tarea**.

**Qué tenés que ver:** la tarea desaparece. **Ahora el proceso está esperando la respuesta de la empresa** y empezó a correr el plazo de 5 días.

**Por qué es una tarea aparte:** la consigna dice que el jefe es quien *envía* la propuesta; al completarla, el sistema manda el correo a la empresa (si no hay servidor de correo, queda anotado en el log y el proceso sigue igual).

**Opcional — ver el aviso de correo en el log (T1):**

*Windows:*
```powershell
docker logs flowable-rest 2>&1 | Select-String "Aviso"
```
*Ubuntu:*
```bash
docker logs flowable-rest 2>&1 | grep "Aviso"
```
Verás una línea `Aviso … NO enviado` (no hay servidor de correo) — **es normal y no es un error**.

---

### 6.3 Mirar la misma instancia "por dentro" (opcional pero muy recomendable)

Para entender qué es una instancia, miremos Flowable directamente.

1. Abrí **http://localhost:8080/flowable-rest/service/runtime/process-instances?businessKey=CURSO** (cambiá `CURSO` por tu número). Si pide credenciales: `rest-admin` / `test`.
2. Vas a ver un texto JSON con **una** instancia de `Process_Curso`. Su `businessKey` es el id del curso.

**Qué aprendés:** el curso de la base `institucion` y la instancia de Flowable son **dos cosas distintas** unidas por el `businessKey` / `process_instance_id`.

---

### 6.4 La empresa responde con el CLI (terminal)

**Personaje:** la empresa. Ahora usamos el **CLI**.

Abrí **T3**, ubicada en la **raíz** del proyecto, y ejecutá:

**Windows (PowerShell):**

```powershell
chcp 65001
$env:FLOWABLE_REST_USER="jefeAdmin"
$env:FLOWABLE_REST_PASSWORD="test"
mvn -q exec:java "-Dexec.mainClass=unrc.cursos.simulador.SimuladorMain"
```

**Ubuntu (Bash):**

```bash
export FLOWABLE_REST_USER=jefeAdmin
export FLOWABLE_REST_PASSWORD=test
mvn -q exec:java -Dexec.mainClass=unrc.cursos.simulador.SimuladorMain
```

*Por qué por terminal:* el simulador es un programa de consola. `chcp 65001` (solo Windows) hace que se vean bien las tildes. Las variables le dicen con qué usuario hablar con la API REST (cualquier usuario válido sirve; usamos `jefeAdmin`).

**Qué tenés que ver:**

```
== Simulador de comunicaciones de la empresa ==

Solicitudes activas:
  1) ...
Elegi una solicitud (numero, r para actualizar, q para salir):
```

1. Escribí el **número** de tu solicitud (si hay una sola: `1`) y Enter.
2. Verás algo así:

   ```
   Actividades activas: Esperar ...
   Mensajes esperando: Aceptación, Rechazo, Solicitud de modificaciones
   Comunicaciones habilitadas:
     1) Aceptar la propuesta (variable: fechaCurso)
     2) Rechazar la propuesta
     3) Pedir modificaciones (variable: observaciones)
   ```

   **Fijate:** el CLI **solo ofrece lo que el proceso está esperando ahora**. No te deja, por ejemplo, "Cancelar" todavía.

3. **Antes de aceptar, necesitás una fecha.** Es la fecha de inicio del curso, en formato internacional **UTC**. Generala en **T1**:

   *Windows:*
   ```powershell
   (Get-Date).ToUniversalTime().AddMinutes(5).ToString("yyyy-MM-ddTHH:mm:ssZ")
   ```
   *Ubuntu:*
   ```bash
   date -u -d '+5 minutes' +%Y-%m-%dT%H:%M:%SZ
   ```
   Copiá el resultado (ej. `2026-11-05T18:30:00Z`). *(Pusimos "5 minutos" para no esperar el día del curso; el proceso espera hasta esa fecha para habilitar el dictado.)*

4. En **T3** elegí **1** (Aceptar la propuesta), Enter. Pegá la fecha y Enter.

**Qué tenés que ver:** `Comunicacion enviada: Aceptar la propuesta.`. Apretá Enter para refrescar.

**Qué pasó por detrás:** el CLI le mandó a Flowable (REST) el **mensaje "Aceptación"** con la variable `fechaCurso`. El proceso salió de la espera y ejecutó solo la tarea **Habilitar acceso de la empresa** (código Java dentro del JAR).

**Comprobalo en T1:**

```
docker compose exec -T postgres psql -U institucion -d institucion -c "select id, empresa_id, usuario from cuenta_empresa order by id"
```

Ahora tiene que aparecer **una fila nueva**: empresa 2, usuario `emp_30722334457`. *(Antes la empresa 2 no tenía cuenta.)*

> Dejá **T3 abierta**: la vas a usar enseguida otra vez.

---

### 6.5 La empresa mira su curso (sitio web, `/empresa`)

**Personaje:** la empresa 2, con su flamante cuenta.

1. En el navegador (mejor en **ventana privada**) abrí **http://localhost:3000/empresa/login**.
2. Usuario `emp_30722334457`, Clave `test` → **Ingresar**.
3. Vas a ver **"Mis cursos"** con tu curso. En **Estado** dice algo como `EN_PREPARACION` y en **Actividades en curso** una lista de cosas que se hacen en paralelo.
4. Apretá **Ver detalle** para ver el curso completo.

**Importante:** esta pantalla es **solo de lectura**. Las respuestas de la empresa (aceptar, mandar nómina…) se hacen con el CLI.

**Probá la seguridad:** con la sesión de la empresa 2 abierta, escribí a mano en la barra de direcciones **http://localhost:3000/empresa/cursos/1** (el curso 1 es de la empresa 1). Tiene que decir **"No encontrado."** — una empresa nunca ve cursos ajenos.

---

### 6.6 Se prepara el curso: varias cosas a la vez

Ahora el proceso está en **"Preparar curso"**. Acá Flowable lanza **tareas en paralelo**. Mirá en la pantalla de la empresa (refrescá con F5): la lista de actividades incluye *Recibir nómina*, *Confeccionar lista definitiva*, *Preparar materiales*, *Evaluar Recursos*, etc.

Vamos una por una (el orden entre ellas no importa, pero *Lista* necesita la nómina primero).

#### 6.6.a La empresa manda la nómina (CLI)

En **T3** (el CLI sigue abierto; apretá `r` + Enter para refrescar):

1. Aparece **"Enviar nomina de participantes (variable: participantes)"** (y también "Cancelar durante la preparacion"). Elegí el número de la **nómina**.
2. Pegá este texto (una lista JSON de nombres) y Enter:

   ```
   ["Ana Perez","Beto Gomez","Carla Diaz"]
   ```

**Qué pasó:** el CLI mandó una **señal** (no un mensaje) a la tarea de recepción *Recibir nómina*. Esto crea la tarea **Confeccionar lista definitiva**.

#### 6.6.b Un administrativo confirma la lista (sitio, `/admin`)

Esta tarea **no la elegís vos**: un código Java la reparte solo al administrativo con **menos tareas asignadas**. Con todos en cero gana el primero por orden alfabético: **`admin2`**.

1. En `/admin`, **Cerrar sesión** y entrá como `admin2` / `test`.
2. Tiene que estar **Confeccionar lista definitiva** con estado **"Asignada a vos"**. *(Si entrás con `jefeAdmin` NO la ves: eso prueba que se asignó a uno solo.)*
3. Apretá **Abrir** en esa fila. Verás la nómina, un nombre **por línea**. Podés corregirla.
4. Apretá **Guardar lista definitiva**.

#### 6.6.c Evaluar qué recursos hacen falta (sitio, `/admin`)

Esta es una tarea **del grupo**: la ven los dos administrativos con estado **"Disponible para reclamar"**.

1. Entrá como `jefeAdmin` / `test`.
2. Buscá **Evaluar Recursos** → apretá **Reclamar**. Pasa a **"Asignada a vos"**.
3. Apretá **Abrir** en esa fila. Marcá las **tres** casillas: **Aula presencial**, **Plataforma virtual**, **Equipamiento especial**.
4. Apretá **Guardar recursos**.

**Probá la regla:** antes de guardar, si dejás las tres casillas vacías el sitio **rechaza** el envío (hace falta al menos un recurso). Si llegara vacío a Flowable, el motor fallaría con un error 500; por eso el sitio lo valida primero.

**Qué pasó:** se creó **Solicitar Aula Virtual** y **Contratar equipamiento**, y *Reservar aula* se ejecutó **sola** (código Java que "reserva" un aula simulada).

#### 6.6.d Preparar materiales (app de escritorio Java) ← la tarea especial

Esta tarea se completa **con el programa de escritorio**, no con el sitio. Abrí **T4** (raíz del proyecto):

**Windows (PowerShell):**

```powershell
chcp 65001
$env:FLOWABLE_DB_USER="flowable"
$env:FLOWABLE_DB_PASSWORD="flowable"
mvn -q exec:java "-Dexec.mainClass=unrc.cursos.escritorio.AppMateriales"
```

**Ubuntu (Bash):**

```bash
export FLOWABLE_DB_USER=flowable
export FLOWABLE_DB_PASSWORD=flowable
mvn -q exec:java -Dexec.mainClass=unrc.cursos.escritorio.AppMateriales
```

*Por qué estas variables:* esta app **no usa REST**: se conecta directo a la base de datos de Flowable, así que necesita el usuario y la clave **de la base** (`flowable`/`flowable`), no los de una persona.

Se abre una **ventana** "Preparar materiales":

1. Usuario `admin2`, Clave `test` → **Ingresar**.
2. En la tabla aparece **Preparar materiales** como disponible. Seleccionala con un clic.
3. Apretá **Reclamar tarea**.
4. Con la fila seleccionada, apretá **Completar tarea**.

#### 6.6.e Aula virtual y equipamiento (interfaz de Flowable)

Estas dos tareas **no tienen pantalla en el sitio** (la consigna permite hacerlas en la interfaz de Flowable).

1. Abrí **http://localhost:8081/flowable-ui** (ventana privada si querés).
2. Usuario `admin2`, Clave `test`. Elegí la aplicación **Tasks** (Tareas).
3. En la lista de tareas aparecen **Solicitar Aula Virtual** y **Contratar equipamiento** (por ser tareas de grupo suelen estar en la vista **Queued**/"En cola" de la izquierda).
4. Abrí cada una → **Claim** (Reclamar) → **Complete** (Completar).

**Qué tenés que ver:** cuando se completan **todas** las ramas (lista, materiales, aula virtual, equipamiento; el aula física ya corrió sola), el proceso **sale de "Preparar curso"**.

Qué pasa justo después, solo:
1. Se manda la **confirmación** a la empresa (correo o log).
2. Aparece la tarea **"Definir Docente que desarrolla el curso"** para `jefeDocente`.

---

### 6.7 Elegir al docente (sitio, `/docentes`)

**Personaje:** `jefeDocente`.

1. Abrí **http://localhost:3000/docentes/login** → `jefeDocente` / `test`.
2. En "Mis tareas" aparece **Definir Docente que desarrolla el curso**. Apretá **Definir docente** en esa fila.
3. Elegí a **`docente1`** (botón de opción) y apretá **Asignar docente**.

**Qué pasó:** el sitio le avisó a Flowable `docenteSeleccionado = docente1`. Ahora el proceso espera un **temporizador** hasta la fecha del curso (`fechaCurso`, la que le diste al CLI en 6.4).

> Si dijera que falta `fechaCurso`: significa que la aceptación se mandó sin fecha. Con el CLI no pasa (la pide obligatoriamente).

---

### 6.8 Se dicta el curso (sitio, `/docentes`)

**Esperá** hasta que pasen los ~5 minutos que pusiste en la fecha (mirá la hora actual).

1. Cerrá sesión y entrá a `/docentes/login` como **`docente1`** / `test`.
2. Tiene que aparecer **Desarrollar curso**, asignada a vos. *(`docente2` y `jefeDocente` NO la ven: solo el docente elegido.)*
3. Apretá **Desarrollar** en esa fila: ves la **lista definitiva** de participantes. Apretá **Marcar curso como dictado**.

**Qué pasó:** se creó **Elaborar informe de resultados** para `jefeDocente`.

---

### 6.9 El informe de resultados (sitio, `/docentes` y `/admin`)

1. Entrá a `/docentes/login` como `jefeDocente` / `test`. Apretá **Elaborar informe** en la fila de **Elaborar informe de resultados**.
2. Completá:

   | Campo | Valor |
   |---|---|
   | Resumen de resultados | `El curso se dictó sin inconvenientes.` |
   | Asistentes efectivos | `3` |
   | Observaciones | (podés dejarlo vacío) |

3. Apretá **Generar PDF y completar**.

**Qué pasó:** el **sitio generó un PDF** y lo guardó en la tabla `informe` de la base. No se sube ningún archivo.

4. Ahora entrá a `/admin/login` como **`jefeAdmin`**. Aparece **Enviar informe a empresa y Archivar expediente**. Apretá **Enviar informe** en la fila: hay un enlace para **descargar el PDF**; bajalo y abrilo para verificar que existe.
5. Apretá **Enviar informe a la empresa y archivar**.

**Qué pasó:** se manda el informe a la empresa (correo/log), el resultado queda `FINALIZADO` y aparece la tarea final **Liberar Equipamiento** (grupo `administracion`). **El proceso todavía NO terminó.**

---

### 6.10 Liberar el equipamiento y fin (interfaz de Flowable)

1. En **http://localhost:8081/flowable-ui** (app **Tasks**), entrá como `admin2` / `test`.
2. Abrí **Liberar Equipamiento** → **Claim** → **Complete**.

**Qué pasó (esto es lo más "avanzado" del proyecto):** al terminar el curso, el proceso dispara una **compensación**: corren solas las tareas *Liberar Aula* y *Liberar Aula Virtual* (devolver lo que se reservó). El proceso no termina hasta que se completa *Liberar Equipamiento*. Recién ahí la instancia finaliza y un listener Java escribe el resultado final en la base.

**Comprobalo en T1:**

```
docker compose exec -T postgres psql -U institucion -d institucion -c "select id, estado, process_instance_id from curso order by id"
```

Tu curso tiene que decir **`estado = FINALIZADO`**.

Y en la web de la empresa (6.5, refrescá con F5) el estado también es `FINALIZADO`.

🎉 **Si llegaste hasta acá, recorriste el proceso completo.**

---

### 6.11 Resumen del recorrido (para repasar)

| # | Quién | Con qué | Qué hizo |
|---|---|---|---|
| 6.1 | Empresa | Sitio `/solicitar` | Pidió el curso → se inició la instancia y corrió la regla DMN |
| 6.2 | `jefeAdmin` | Sitio `/admin` | Armó la propuesta y la envió |
| 6.4 | Empresa | **CLI** | Aceptó con fecha → se creó su cuenta |
| 6.5 | Empresa | Sitio `/empresa` | Siguió el estado (solo lectura) |
| 6.6.a | Empresa | **CLI** | Mandó la nómina |
| 6.6.b | `admin2` | Sitio `/admin` | Confirmó la lista (repartida sola) |
| 6.6.c | `jefeAdmin` | Sitio `/admin` | Reclamó y eligió recursos |
| 6.6.d | `admin2` | **App Java** | Preparó materiales |
| 6.6.e | `admin2` | Flowable UI | Aula virtual y equipamiento |
| 6.7 | `jefeDocente` | Sitio `/docentes` | Eligió docente |
| 6.8 | `docente1` | Sitio `/docentes` | Dictó el curso |
| 6.9 | `jefeDocente` + `jefeAdmin` | Sitio | Informe PDF y envío |
| 6.10 | `admin2` | Flowable UI | Liberó equipamiento → **FIN** |

---

## 7. Probar otros caminos (variantes)

Cada una se hace con una solicitud nueva (repetí 6.1 y 6.2 hasta "Enviar propuesta") y el CLI.

| Quiero probar… | Qué hacer | Resultado esperado |
|---|---|---|
| **La empresa pide cambios** | En el CLI elegí *Pedir modificaciones* y escribí una observación. Luego en `/admin` como `jefeAdmin` aparece **Revisar propuesta**: cambiá el presupuesto y apretá **Guardar cambios y enviar nueva versión**. | Vuelve a aparecer **Enviar propuesta** (versión 2). |
| **La empresa rechaza** | En el CLI elegí *Rechazar la propuesta* y confirmá con `s`. | Aparece **Archivar solicitud** para `jefeAdmin`; al archivar, `curso.estado = RECHAZADO`. |
| **La empresa no responde** | En 6.1, en "Modo desarrollo" poné `plazoRespuesta` = `PT20S` (20 segundos). No respondas en el CLI. | Tras 2 recordatorios: `curso.estado = SIN_RESPUESTA` y tarea **Archivar solicitud**. |
| **Cancelación** | Con el curso en preparación (después de aceptar), en el CLI elegí *Cancelar durante la preparacion*. | `curso.estado = CANCELADO`; se liberan recursos ya reservados. |
| **Falta de aulas** | En 6.1, en "Modo desarrollo" poné `simularFaltaAulas` = **si**. Avanzá hasta *Evaluar Recursos* con aula marcada. | El proceso se cancela solo con motivo `SIN_AULAS`. |
| **No viable (límite 5)** | Iniciá 6 solicitudes sin terminarlas. | La 6ª termina directo en `NO_VIABLE`. (Limpiá después con `node scripts/escenarios/m-limpiar-instancias.js`.) |

Para ver el estado de un curso en la base:

```
docker compose exec -T postgres psql -U institucion -d institucion -c "select id, estado, process_instance_id from curso order by id"
```

**Recorrido automático de estos escenarios** (sin hacer clic): ver [`scripts/escenarios/README.md`](scripts/escenarios/README.md). En resumen, desde la raíz y con el entorno levantado:

```
node scripts/escenarios/m-escenarios.js
```

Tarda unos 4 minutos y dice PASS/FAIL por escenario. **Al terminar borra los despliegues**: volvé a correr `scripts\desplegar-modelo.ps1` (Windows) o `./scripts/desplegar-modelo.sh` (Ubuntu) si querés seguir probando a mano. En Ubuntu el puerto 25 es privilegiado: usá un puerto libre, p. ej. `SMTP_PORT=2525 docker compose up -d` y `SMTP_PORT=2525 node scripts/escenarios/m-escenarios.js`.

La lista de pruebas **manuales** (escenarios 8, 9 y 10 de la defensa), con pasos literales, está en [`informe/checklist-manual.md`](informe/checklist-manual.md).

---

## 8. Tests automáticos

| Qué | Comando | Dónde | ¿Necesita Docker? |
|---|---|---|---|
| Tests de Java (45) | `mvn test` | raíz del proyecto | No |
| Tests del sitio (151) | `npm test` | carpeta `web` | La prueba de integración sí (usa Flowable real) |

Los mismos comandos sirven en Windows y Ubuntu.

---

## 9. Apagar y limpiar

Siempre desde la **raíz** del proyecto (mismo comando en Windows y Ubuntu):

| Quiero… | Comando | Efecto |
|---|---|---|
| Apagar todo **conservando** los datos | `docker compose down` | Se apagan las cajas; al volver a encender sigue todo. |
| Apagar y **borrar todo** | `docker compose down -v` | Borra la base. Hay que repetir los pasos de creación de usuarios, BD y despliegue (sección 5). |
| Borrar instancias de prueba | `node scripts/escenarios/m-limpiar-instancias.js` | Libera el límite de 5 cursos. |
| Cerrar el sitio | `Ctrl + C` en T2 | |

Si recompilás el Java (`mvn package -DskipTests`) con los contenedores encendidos, reinicialos: `docker compose restart flowable-rest flowable-ui`.

---

## 10. Si algo falla

| Síntoma | Qué pasa y cómo se arregla |
|---|---|
| `flowable-ui` aparece `Exited (1)` en el primer arranque | Choque al crear tablas. Repetir `docker compose up -d`. |
| `flowable-rest` no arranca y `target/cursos-flowable.jar` es una **carpeta** | Se hizo `up` antes de compilar. Borrá esa carpeta, ejecutá `mvn package -DskipTests` y `docker compose up -d`. |
| `http://localhost:3000` no abre | El sitio no está corriendo. Dejá `npm start` abierto en su terminal. En Ubuntu comprobá con `ss -ltnp \| grep ':3000'`. |
| "CUIT invalido" al solicitar | El CUIT no pasa el dígito verificador. Usá `30-72233445-7`. |
| Falla al iniciar la solicitud, en *Evaluar Viabilidad* | Falta la regla DMN: corré `desplegar-modelo`. |
| La solicitud nueva queda `NO_VIABLE` sin razón | Hay 5 o más instancias activas (viejas). `node scripts/escenarios/m-limpiar-instancias.js`. |
| El CLI dice que no hay instancias activas | No iniciaste ninguna solicitud, o ya terminó. Hacé 6.1 de nuevo. |
| La app de materiales no encuentra tareas | Todavía no llegó la nómina/lista (6.6.a-b) o el usuario no es del grupo `administracion`. Apretá **Actualizar**. |
| Ubuntu: `bad interpreter` o `$'\r': command not found` en un `.sh` | Finales de línea de Windows: `sed -i 's/\r$//' scripts/*.sh`. |
| Ubuntu: `Permission denied` en un `.sh` | `chmod +x scripts/*.sh` (o ejecutá con `bash scripts/archivo.sh`). |
| Se ven mal las tildes en Windows | Ejecutá `chcp 65001` en esa terminal antes del programa. |

---

## 11. Mapa de todos los archivos .md

| Archivo | Para qué sirve | Cuándo leerlo |
|---|---|---|
| **`MAPA.md`** (este) | Todo el proyecto explicado desde cero + recorrido paso a paso. | **Primero.** |
| [`README.md`](README.md) | Solo los comandos de arranque, cortos y directos (Windows / Ubuntu). | Cuando ya entendiste y solo querés arrancar. |
| [`informe/checklist-manual.md`](informe/checklist-manual.md) | Pasos literales de las pruebas manuales (escenarios 8, 9 y 10). | Para ensayar la defensa. |
| [`informe/guia-postman-devnull.md`](informe/guia-postman-devnull.md) | Qué es SMTP, cómo usar DevNull y Postman, y la app Java, escenario por escenario. | Para correr los escenarios a mano con Postman. |
| [`README-aplicaciones.md`](README-aplicaciones.md) | Detalle técnico del CLI y la app de escritorio (variables de entorno, verificaciones). | Si querés ajustar su configuración. |
| [`web/README.md`](web/README.md) | Detalle técnico del sitio (variables de entorno, seguridad). | Si vas a tocar el sitio. |
| [`web/src/admin/README.md`](web/src/admin/README.md) | Módulo `/admin`: pantallas por tarea, seguridad, pruebas con tareas de ejemplo. | Si vas a tocar el módulo de administración. |
| [`web/src/docentes/README.md`](web/src/docentes/README.md) | Módulo `/docentes`: pantallas por tarea. | Si vas a tocar el módulo docente. |
| [`scripts/escenarios/README.md`](scripts/escenarios/README.md) | Recorrido automático de los escenarios 1 a 7 y 11. | Para correr la verificación automática. |
| [`informe/informe.md`](informe/informe.md) | Informe académico: variables, listeners, decisiones, resultados. | Para la entrega / defensa. |
| [`informe/licencias-consigna.md`](informe/licencias-consigna.md) | Todo lo que se aparta de la consigna, con motivo. | Para justificar decisiones. |
| [`modelo/cambios-modelo.md`](modelo/cambios-modelo.md) | Registro de cada cambio al diagrama BPMN. | Si vas a tocar el modelo. |
