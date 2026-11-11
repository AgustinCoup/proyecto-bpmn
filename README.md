# Proyecto BPMN: organización de cursos de capacitación

Proyecto final de *Gestión y Tecnologías de Procesos de Negocio*. Una institución de capacitación gestiona cursos para empresas con un proceso ejecutable en **Flowable**.

> 📖 **¿Primera vez con el proyecto?** Leé [`MAPA.md`](MAPA.md): explica todo desde cero y guía un recorrido completo paso a paso.
> Este README es solo para **arrancar rápido**.

---

## 1. Requisitos

| Programa | Versión | Comprobar |
|---|---|---|
| Docker (Windows: Docker Desktop **abierto**) | cualquiera reciente | `docker compose version` |
| Java | 11 o más | `java -version` |
| Maven | 3.8 o más | `mvn -version` |
| Node.js | 18 o más | `node -v` |

Puertos libres: **5432**, **8080**, **8081**, **3000**.

Ubuntu: tu usuario debe estar en el grupo `docker`, y hace falta un Node actual (NodeSource o `nvm`; el de los repositorios suele ser viejo).

---

## 2. Arranque

Todos los comandos se ejecutan desde la **raíz del proyecto** (la carpeta con `docker-compose.yml`).
Hacelo **una vez**, **en este orden**.

### 🪟 Windows (PowerShell)

```powershell
cd "C:\Users\tutyb\UNI - 2026\Gestion\proyecto-bpmn"

mvn package -DskipTests
docker compose up -d
powershell -ExecutionPolicy Bypass -File scripts\crear-usuarios.ps1
powershell -ExecutionPolicy Bypass -File scripts\crear-bd.ps1
powershell -ExecutionPolicy Bypass -File scripts\desplegar-modelo.ps1
```

### 🐧 Ubuntu (Bash)

```bash
cd ~/ruta/al/proyecto-bpmn

mvn package -DskipTests
docker compose up -d
chmod +x scripts/*.sh        # solo la primera vez
./scripts/crear-usuarios.sh
./scripts/crear-bd.sh
./scripts/desplegar-modelo.sh
```

### Qué hace cada comando

| Comando | Para qué |
|---|---|
| `mvn package -DskipTests` | Arma `target/cursos-flowable.jar` (**antes** de `docker compose up`). |
| `docker compose up -d` | Enciende PostgreSQL y Flowable. |
| `crear-usuarios` | Crea usuarios y grupos en Flowable. |
| `crear-bd` | Crea la base `institucion` con datos de prueba. |
| `desplegar-modelo` | Carga la regla DMN y el proceso. Repetir si cambia el modelo. |

**Esperá 1 minuto** y comprobá con `docker compose ps`: deben verse 3 contenedores `Up`.

> ⚠️ **Primer arranque:** si `flowable-ui` queda `Exited (1)`, repetí `docker compose up -d` y esperá ~40 s. Es normal.

---

## 3. Encender el sitio web

En **otra terminal** (queda abierta mientras uses el sitio):

### 🪟 Windows (PowerShell)

```powershell
cd "C:\Users\tutyb\UNI - 2026\Gestion\proyecto-bpmn\web"
npm install
$env:SESSION_SECRET="cualquier-texto-largo"
npm start
```

### 🐧 Ubuntu (Bash)

```bash
cd ~/ruta/al/proyecto-bpmn/web
npm install
export SESSION_SECRET="cualquier-texto-largo"
npm start
```

Debe decir `Web institucion escuchando en http://localhost:3000`.

---

## 4. Direcciones y claves

| Qué | Dirección | Usuario / clave |
|---|---|---|
| Sitio (inicio) | http://localhost:3000 | — |
| Pedir un curso | http://localhost:3000/solicitar | — |
| Empresas | http://localhost:3000/empresa/login | `emp_30711223343` / `test` |
| Administración | http://localhost:3000/admin/login | `jefeAdmin` o `admin2` / `test` |
| Docentes | http://localhost:3000/docentes/login | `jefeDocente`, `docente1` o `docente2` / `test` |
| Interfaz de Flowable | http://localhost:8081/flowable-ui | `admin` o cualquiera de arriba / `test` |
| API REST (Swagger) | http://localhost:8080/flowable-rest/docs/ | `rest-admin` / `test` |
| PostgreSQL | `localhost:5432` | `flowable`/`flowable` · `institucion`/`institucion` |

---

## 5. Simulador de la empresa (CLI)

Programa de consola que hace de **empresa**: acepta, rechaza, pide cambios, manda la nómina, cancela. Necesita que ya haya una solicitud iniciada (desde `/solicitar`).

### 🪟 Windows (PowerShell)

```powershell
chcp 65001
$env:FLOWABLE_REST_USER="jefeAdmin"
$env:FLOWABLE_REST_PASSWORD="test"
mvn -q exec:java "-Dexec.mainClass=unrc.cursos.simulador.SimuladorMain"
```

### 🐧 Ubuntu (Bash)

```bash
export FLOWABLE_REST_USER=jefeAdmin
export FLOWABLE_REST_PASSWORD=test
mvn -q exec:java -Dexec.mainClass=unrc.cursos.simulador.SimuladorMain
```

---

## 6. App de escritorio "Preparar materiales"

Ventana Java para completar la tarea *Preparar materiales*. Ingresás con `admin2` / `test`.

### 🪟 Windows (PowerShell)

```powershell
chcp 65001
$env:FLOWABLE_DB_USER="flowable"
$env:FLOWABLE_DB_PASSWORD="flowable"
mvn -q exec:java "-Dexec.mainClass=unrc.cursos.escritorio.AppMateriales"
```

### 🐧 Ubuntu (Bash)

```bash
export FLOWABLE_DB_USER=flowable
export FLOWABLE_DB_PASSWORD=flowable
mvn -q exec:java -Dexec.mainClass=unrc.cursos.escritorio.AppMateriales
```

---

## 7. Pruebas

| Qué | Comando | Dónde |
|---|---|---|
| Tests de Java (52, sin Docker) | `mvn test` | raíz |
| Tests del sitio (151) | `npm test` | carpeta `web` |
| Escenarios 1–7 y 11 automáticos (~4 min) | `node scripts/escenarios/m-escenarios.js` | raíz |
| Escenarios 8, 9 y 10 manuales | seguir [`informe/checklist-manual.md`](informe/checklist-manual.md) | — |
| Escenarios con Postman + DevNull + app Java | seguir [`informe/guia-postman-devnull.md`](informe/guia-postman-devnull.md) | — |
| Historial de 55 instancias para 4.3 y 4.4 (~4 min; borra el historial previo) | `node mineria/generar_historial.js` | raíz |
| Consultas 4.3 y minería de procesos 4.4 | seguir [`mineria/README.md`](mineria/README.md) | — |
| Borrar instancias de prueba | `node scripts/escenarios/m-limpiar-instancias.js` | raíz |

Los comandos son iguales en Windows y Ubuntu. `m-escenarios.js` guarda su log solo en `scripts/escenarios/resultados/m-escenarios.log` (ver [`scripts/escenarios/README.md`](scripts/escenarios/README.md)). Tras `m-escenarios.js` hay que volver a correr `desplegar-modelo` si querés seguir a mano. En Ubuntu el puerto 25 es privilegiado: usá `SMTP_PORT=2525` tanto en `docker compose up -d` como en el script.

---

## 8. Apagar

| Acción | Comando |
|---|---|
| Apagar conservando datos | `docker compose down` |
| Apagar y borrar todo | `docker compose down -v` (después repetir la sección 2) |
| Cerrar el sitio | `Ctrl + C` en su terminal |

---

## 9. Si algo falla

| Síntoma | Solución |
|---|---|
| `flowable-ui` en `Exited (1)` | Repetir `docker compose up -d`. |
| `target/cursos-flowable.jar` es una **carpeta** | Borrarla, correr `mvn package -DskipTests` y `docker compose up -d`. |
| Recompilé con los contenedores arriba | `docker compose restart flowable-rest flowable-ui`. |
| `localhost:3000` no abre | Falta `npm start` corriendo (ver sección 3). |
| "CUIT invalido" al solicitar | Usar un CUIT válido, p. ej. `30-72233445-7`. |
| Falla en *Evaluar Viabilidad* | Correr `desplegar-modelo`. |
| La solicitud queda `NO_VIABLE` sin razón | Hay 5+ instancias viejas: `node scripts/escenarios/m-limpiar-instancias.js`. |
| Ubuntu: `bad interpreter` / `$'\r'` | `sed -i 's/\r$//' scripts/*.sh` |
| Ubuntu: `Permission denied` | `chmod +x scripts/*.sh` |
| Tildes rotas en Windows | `chcp 65001` en esa terminal. |

Más casos y explicaciones: sección 10 de [`MAPA.md`](MAPA.md).

---

## 10. Dónde está cada cosa

| Documento | Contenido |
|---|---|
| [`MAPA.md`](MAPA.md) | **Todo el proyecto desde cero + recorrido paso a paso.** |
| [`informe/checklist-manual.md`](informe/checklist-manual.md) | Pruebas manuales, paso a paso. |
| [`informe/guia-postman-devnull.md`](informe/guia-postman-devnull.md) | Postman, DevNull y app Java escenario por escenario. |
| [`Aplicaciones.md`](Aplicaciones.md) | Detalle del CLI y la app de escritorio. |
| [`mineria/README.md`](mineria/README.md) | Consultas 4.3 y minería de procesos 4.4 (scripts, datos, conclusión). |
| [`web/README.md`](web/README.md) | Detalle del sitio web. |
| [`informe/informe.md`](informe/informe.md) | Informe académico. |
| [`informe/licencias-consigna.md`](informe/licencias-consigna.md) | Decisiones que se apartan de la consigna. |
| [`modelo/cambios-modelo.md`](modelo/cambios-modelo.md) | Registro de cambios al modelo BPMN. |
