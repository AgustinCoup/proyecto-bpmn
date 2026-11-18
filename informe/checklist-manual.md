# Checklist manual de la defensa: escenarios 8, 9 y 10

Guía **paso a paso y literal** para probar a mano los tres escenarios que dependen del sitio web.
Los escenarios 1 a 7 y 11 se prueban solos con `node scripts/escenarios/m-escenarios.js` (ver [`scripts/escenarios/README.md`](../scripts/escenarios/README.md)).

> ¿No conocés el proyecto? Antes leé [`MAPA.md`](../MAPA.md): explica qué es cada cosa.

---

## Cómo usar este documento

- Cada paso tiene tres partes: **Hacé** (lo que tenés que tocar), **Tiene que pasar** (lo que debés ver) y una casilla **☐** para tildar.
- Si algo no coincide con lo escrito: **frená**, anotá el número de paso y qué viste en la sección [Notas del ensayo](#notas-del-ensayo) del final.
- Los comandos de terminal vienen con la versión **Windows (PowerShell)** y **Ubuntu (Bash)** cuando son distintos. Si no se aclara, el comando es igual en ambos.
- Las claves de todos los usuarios son `test`.

### Orden recomendado: 9 → 10 → 8

Los escenarios tienen números salteados, pero conviene hacerlos en este orden porque se alimentan entre sí:

| Orden | Escenario | Qué prueba | Por qué en ese lugar |
|---|---|---|---|
| 1º | **9** | Crear una solicitud desde el sitio y que se inicie su instancia | Deja lista la solicitud **A** de la empresa 2. |
| 2º | **10** | Cuenta de la empresa y que solo vea sus cursos | Necesita que la empresa 2 **todavía no tenga cuenta** (por eso va antes que el 8). |
| 3º | **8** | Asignación, reclamo y finalización según responsables | Es el recorrido largo; usa la solicitud **B** de la empresa 2 y de paso muestra los estados del escenario 10. |

---

## Preparación (una sola vez, antes de empezar)

### P1. Tener el entorno levantado

Si todavía no lo hiciste, seguí la sección 5 de [`MAPA.md`](../MAPA.md) (o la sección 2 y 3 del [`README.md`](../README.md)). Al terminar debe cumplirse:

- ☐ `docker compose ps` (en la raíz del proyecto) muestra 3 contenedores en `Up`.
- ☐ El sitio responde: abrir http://localhost:3000 muestra "Bienvenido".

### P2. Borrar instancias viejas

**Por qué:** las instancias viejas cuentan para el límite de 5 cursos en marcha y pueden hacer que tu solicitud salga "no viable".

**Hacé** (en la raíz del proyecto):

```
node scripts/escenarios/m-limpiar-instancias.js
```

**Tiene que pasar:** termina sin errores.  ☐

### P3. Dejar la base con los datos originales

**Por qué:** el escenario 10 necesita que la empresa 2 **no tenga cuenta** al empezar.

**Hacé** (en la raíz del proyecto):

*Windows (PowerShell):*
```powershell
powershell -ExecutionPolicy Bypass -File scripts\crear-bd.ps1
```
*Ubuntu (Bash):*
```bash
./scripts/crear-bd.sh
```

**Tiene que pasar:** el último mensaje es `BD institucion lista.`  ☐

Comprobá el punto de partida con:

```
docker compose exec -T postgres psql -U institucion -d institucion -c "select id, empresa_id, usuario from cuenta_empresa"
```

**Tiene que pasar:** **una sola fila**: `empresa_id = 1`, `usuario = emp_30711223343`.  ☐

### P4. Abrir las terminales y ventanas

Vas a necesitar:

| Nombre | Qué es | Ya está abierta |
|---|---|---|
| **T1** | Terminal en la **raíz** del proyecto, para comandos sueltos | Abrila ahora |
| **T2** | El sitio (`npm start`), no cerrar | Sí, del paso P1 |
| **T3** | Simulador de la empresa (CLI) | Se abre en el escenario 10 |
| **T4** | App de escritorio "Preparar materiales" | Se abre en el escenario 8 |

> ⚠️ **Toda terminal nueva se abre en tu carpeta de usuario, NO en el proyecto.** T1, T3 y T4 tienen que estar en la **raíz del proyecto** (la carpeta que contiene `pom.xml` y `docker-compose.yml`); si no, `mvn exec:java` y `node scripts/...` no encuentran nada. Lo primero que hacés en cada una:
>
> *Windows (PowerShell):*
> ```powershell
> cd "C:\Users\tutyb\UNI - 2026\Gestion\proyecto-bpmn"
> ```
> *Ubuntu (Bash):*
> ```bash
> cd ~/ruta/al/proyecto-bpmn
> ```
> Comprobá con `dir pom.xml` (Windows) o `ls pom.xml` (Ubuntu): tiene que listar el archivo.

Del navegador vas a usar:

| Nombre | Qué es |
|---|---|
| **Ventana 1** | Ventana normal del navegador |
| **Ventana 2** | Ventana **privada / incógnito** (para ser dos usuarios a la vez) |

☐ Listo.

### P5. (Opcional) Servidor de correo falso

El proceso manda correos a la empresa. **No hace falta tener un servidor**: sin él, el aviso queda escrito en el log y todo sigue igual.
Para ver los avisos en el log:

*Windows (PowerShell):*
```powershell
docker logs flowable-rest 2>&1 | Select-String "Aviso"
```
*Ubuntu (Bash):*
```bash
docker logs flowable-rest 2>&1 | grep "Aviso"
```

Cada vez que este documento diga "mirá el aviso en el log", usá ese comando. Si tenés DevNullSmtp abierto en el puerto 25 (Windows), el correo llegará ahí.

---
---

# Escenario 9: registrar una solicitud desde el sitio e iniciar su instancia

**Qué se prueba:** que al enviar el formulario público se crea el curso en la base, se inicia una instancia en Flowable y las dos quedan vinculadas; y que la tarea le llega **solo** al jefe administrativo.

**Datos que vas a usar** (solicitud **A**, empresa 2):

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

### 9.1 — Mandar el formulario vacío (debe rechazarlo)

**Hacé:**
1. En la Ventana 1 abrí **http://localhost:3000/solicitar**.
2. No escribas nada. Apretá **Enviar solicitud**.

**Tiene que pasar:** el navegador o el sitio marcan los campos obligatorios y **no** aparece "Solicitud recibida".  ☐

**Comprobá que no se creó nada** (T1):

```
docker compose exec -T postgres psql -U institucion -d institucion -c "select count(*) from curso"
```

Anotá el número: **N = ______** (debería ser `1`, el curso de ejemplo). Más adelante tiene que aumentar de a 1.  ☐

### 9.2 — Mandar un CUIT inválido (debe rechazarlo)

**Hacé:**
1. En **http://localhost:3000/solicitar** completá todos los campos con los datos de arriba, **pero** en CUIT escribí `11-11111111-1`.
2. Apretá **Enviar solicitud**.

**Tiene que pasar:** vuelve el formulario con el texto **"CUIT invalido."** en rojo y los demás campos conservan lo que escribiste. No se crea curso.  ☐

### 9.3 — Mandar la solicitud correcta (solicitud A)

**Hacé:**
1. En el mismo formulario corregí el CUIT: `30-72233445-7`.
2. Si ves un recuadro **"Modo desarrollo"**, dejalo **vacío**.
3. Apretá **Enviar solicitud**.

**Tiene que pasar:**
- Aparece **"Solicitud recibida"** con un número. Anotalo: **CURSO_A = ______**.  ☐

### 9.4 — Mirar la base de datos

**Hacé** (T1):

```
docker compose exec -T postgres psql -U institucion -d institucion -c "select id, empresa_id, estado, process_instance_id from curso order by id desc limit 1"
```

**Tiene que pasar:**
- `id` = tu CURSO_A.
- `empresa_id` = `2`.
- `estado` = `EN_PROCESO`.
- `process_instance_id` **tiene un valor** (un texto largo tipo `3f2a…`, NO vacío).  ☐

Comprobá que la empresa **no se duplicó** (T1):

```
docker compose exec -T postgres psql -U institucion -d institucion -c "select id, nombre, cuit from empresa order by id"
```

**Tiene que pasar:** sigue habiendo **2 empresas** (ids 1 y 2). El CUIT ya existía, se reutilizó.  ☐

### 9.5 — Mirar la instancia en Flowable

**Hacé:**
1. En el navegador abrí (cambiando `CURSO_A` por tu número):
   `http://localhost:8080/flowable-rest/service/runtime/process-instances?businessKey=CURSO_A`
2. Si pide usuario: `rest-admin` / clave `test`.

**Tiene que pasar:** se ve un texto JSON con **una** instancia. Su `businessKey` es tu `CURSO_A` y su `id` es **igual** al `process_instance_id` del paso 9.4.  ☐

**Si el resultado viene vacío (`"total":0`)**, la instancia ya no está activa. Las causas posibles, en orden de probabilidad:

1. **Se borró**: corriste `m-limpiar-instancias.js` o `m-escenarios.js` **después** de crear la solicitud. Esos scripts borran todas las instancias activas, y `m-escenarios.js` además borra el modelo desplegado. **No los corras en medio del checklist**; si lo hiciste, volvé a desplegar el modelo y repetí desde el 9.3.
2. **Terminó sola por no viable**: si en el paso 9.4 el curso dice `estado = NO_VIABLE` en vez de `EN_PROCESO`, había 5 o más instancias activas. Repetí el paso P2.
3. **Consultaste otro número**: usá el `businessKey` = el número que mostró "Solicitud recibida".

Para saber cuál fue, pedí el historial (incluye instancias terminadas o borradas). Reemplazá `CURSO_A` por tu número:

`http://localhost:8080/flowable-rest/service/history/historic-process-instances?businessKey=CURSO_A`

Si aparece con `endTime` y `deleteReason`, se borró (causa 1); si aparece con `endTime` y sin `deleteReason`, terminó sola (causa 2).

### 9.6 — El jefe administrativo ve su tarea

**Hacé:**
1. En la Ventana 1 abrí **http://localhost:3000/admin/login**.
2. Usuario `jefeAdmin`, Clave `test`, **Ingresar**.

**Tiene que pasar:** en "Mis tareas" hay una fila **Registrar y Elaborar propuesta** con el curso `CURSO_A`, estado **"Asignada a vos"** y botón **Completar** (**no** hay botón Reclamar).  ☐

### 9.7 — Otros usuarios NO ven esa tarea

**Hacé:**
1. En la **Ventana 2 (privada)** abrí **http://localhost:3000/admin/login** e ingresá como `admin2` / `test`.
   - **Tiene que pasar:** `admin2` **no** ve *Registrar y Elaborar propuesta*.  ☐
2. En la Ventana 2 abrí **http://localhost:3000/docentes/login** e ingresá como `jefeDocente` / `test`.
   - **Tiene que pasar:** `jefeDocente` no ve esa tarea (su lista está vacía o sin ella).  ☐
3. En la Ventana 2 apretá **Cerrar sesión** en cada sitio.

> **Dejá la solicitud A así**, pendiente de propuesta. La vas a usar en el escenario 10.

**✅ Escenario 9 terminado.** ☐

---
---

# Escenario 10: acceso de la empresa y consulta exclusiva de sus cursos

**Qué se prueba:**
(a) la cuenta de la empresa se crea **una sola vez** al aceptar, aunque acepte dos cursos;
(b) la empresa ve **solo sus cursos**, con su estado y las actividades en paralelo;
(c) no puede ver cursos de otra empresa, ni entrar con credenciales del personal.

**Precondición:** hiciste el escenario 9 (existe la solicitud **A**) y la empresa 2 **no** tiene cuenta (paso P3).

### 10.1 — Confirmar que la empresa 2 no tiene cuenta

**Hacé** (T1):

```
docker compose exec -T postgres psql -U institucion -d institucion -c "select id, empresa_id, usuario from cuenta_empresa order by id"
```

**Tiene que pasar:** solo la fila de la `empresa_id = 1`. **No hay fila** con `empresa_id = 2`.  ☐

### 10.2 — Armar y enviar la propuesta de la solicitud A

**Hacé:**
1. En la Ventana 1 (sesión `jefeAdmin` en `/admin/`) apretá **Completar** en la fila *Registrar y Elaborar propuesta* de CURSO_A.
2. Completá:

   | Campo | Valor |
   |---|---|
   | Nombre del curso | `Soldadura A` |
   | Programa | `Programa del curso A.` |
   | Presupuesto (ARS) | `100000` |
   | Fecha de inicio | `2026-12-01` |
   | Fecha de fin | `2026-12-15` |

3. Apretá **Guardar propuesta y completar tarea**.
4. Volvé a "Mis tareas", apretá **Completar** en la fila **Enviar propuesta** y luego **Completar tarea**.

**Tiene que pasar:** la fila desaparece. El proceso queda esperando la respuesta de la empresa.  ☐

### 10.3 — Crear una segunda solicitud de la misma empresa (solicitud B)

**Hacé:**
1. Abrí **http://localhost:3000/solicitar** y completá **los mismos datos de la empresa 2** (nombre, CUIT `30-72233445-7`, contacto, email, teléfono), pero con:

   | Campo | Valor |
   |---|---|
   | Tematica | `Soldadura B` |
   | Descripcion | `Segundo curso de la misma empresa.` |
   | Cantidad estimada de participantes | `3` |
   | Descripcion de fechas preferidas | `Enero 2027` |

2. Enviá. Anotá el número: **CURSO_B = ______**.
3. En `/admin/` como `jefeAdmin`: **Completar** en *Registrar y Elaborar propuesta* de CURSO_B → completá con los valores que quieras (nombre `Soldadura B`, programa, presupuesto `100000`, fechas `2026-12-01` / `2026-12-15`) → **Guardar propuesta y completar tarea**.
4. **Completar** → **Completar tarea** en *Enviar propuesta* de CURSO_B.

**Tiene que pasar:** hay **dos** instancias esperando respuesta (A y B).  ☐

### 10.4 — Abrir el CLI (la empresa responde)

**Hacé:** abrí una terminal nueva (**T3**), **andá a la raíz del proyecto** (`cd`, ver el aviso de P4) y ejecutá:

*Windows (PowerShell):*
```powershell
chcp 65001
$env:FLOWABLE_REST_USER="jefeAdmin"
$env:FLOWABLE_REST_PASSWORD="test"
mvn -q exec:java "-Dexec.mainClass=unrc.cursos.simulador.SimuladorMain"
```
*Ubuntu (Bash):*
```bash
export FLOWABLE_REST_USER=jefeAdmin
export FLOWABLE_REST_PASSWORD=test
mvn -q exec:java -Dexec.mainClass=unrc.cursos.simulador.SimuladorMain
```

**Tiene que pasar:** el programa imprime `== Simulador de comunicaciones de la empresa ==` y una lista de "Solicitudes activas" (2 por lo menos: A y B).  ☐

### 10.5 — Generar una fecha de inicio

El CLI exige una fecha en formato UTC. Generala en **T1**:

*Windows (PowerShell):*
```powershell
(Get-Date).ToUniversalTime().AddMinutes(5).ToString("yyyy-MM-ddTHH:mm:ssZ")
```
*Ubuntu (Bash):*
```bash
date -u -d '+5 minutes' +%Y-%m-%dT%H:%M:%SZ
```

Copiá el resultado. Ejemplo: `2026-11-05T18:30:00Z`. **FECHA = ______**  ☐

> Cada vez que el CLI pida una fecha usá una **parecida y futura**; si pasa más de ~5 minutos, generá otra.

### 10.6 — Aceptar la propuesta de la solicitud A

**Hacé** (en **T3**):
1. En la lista escribí el **número** de la solicitud que corresponde al curso A y Enter. *(Cada línea dice `businessKey N | cursoId N`: ese N es el id del curso.)*
2. Verás "Comunicaciones habilitadas". Escribí el número de **Aceptar la propuesta** y Enter.
3. Cuando pida la fecha, pegá FECHA y Enter.
4. Apretá Enter cuando diga "Enter para actualizar el estado...".

**Tiene que pasar:** el CLI dice `Comunicacion enviada: Aceptar la propuesta.`  ☐

**Comprobá en T1:**

```
docker compose exec -T postgres psql -U institucion -d institucion -c "select id, empresa_id, usuario from cuenta_empresa order by id"
```

**Tiene que pasar:** apareció **una fila nueva**: `empresa_id = 2`, `usuario = emp_30722334457`. Total: 2 filas.  ☐

### 10.7 — Aceptar un segundo curso de la misma empresa (solicitud B)

**Hacé** (en **T3**):
1. Escribí `q` y Enter para volver a la lista de solicitudes (o `r` y Enter para refrescar).
2. Elegí el número de la solicitud del curso B.
3. Elegí **Aceptar la propuesta**, pegá una fecha (la misma FECHA sirve) y Enter. Enter para actualizar.

**Tiene que pasar:** `Comunicacion enviada: Aceptar la propuesta.`  ☐

**Comprobá en T1:**

```
docker compose exec -T postgres psql -U institucion -d institucion -c "select id, empresa_id, usuario from cuenta_empresa order by id"
```

**Tiene que pasar:** **sigue habiendo 2 filas**. La empresa 2 tiene **una sola** cuenta (no se duplicó).  ☐

### 10.8 — La empresa 2 entra y ve **solo sus** cursos

**Hacé:**
1. En la **Ventana 2 (privada)** abrí **http://localhost:3000/empresa/login**.
2. Usuario `emp_30722334457`, Clave `test`, **Ingresar**.

**Tiene que pasar:**
- Se abre **"Mis cursos"** con "Empresa: Metalúrgica del Sur S.R.L.".  ☐
- La tabla muestra **exactamente dos cursos**: CURSO_A y CURSO_B.  ☐
- **No** aparece el curso `1` (es de la empresa 1).  ☐

### 10.9 — Detalle de un curso en preparación

**Hacé:** apretá **Ver detalle** en CURSO_B.

**Tiene que pasar:**
- Se ve "Curso #CURSO_B" con temática, descripción, cantidad y fechas.  ☐
- **Estado** = `EN_PREPARACION`.  ☐
- Hay una sección **"Actividades pendientes o en curso"** con **varias a la vez**: por ejemplo *Recibir nomina*, *Preparar materiales*, *Evaluar Recursos*.  ☐

### 10.10 — Intentar ver un curso de otra empresa (debe fallar)

**Hacé:** con la sesión de la empresa 2 abierta, en la barra de direcciones escribí **http://localhost:3000/empresa/cursos/1** y Enter.

**Tiene que pasar:** aparece **"No encontrado."** (no se muestra ningún dato del curso 1).  ☐

### 10.11 — La empresa 1 solo ve lo suyo

**Hacé:**
1. En la Ventana 2 apretá **Salir**.
2. Entrá a **http://localhost:3000/empresa/login** con `emp_30711223343` / `test`.

**Tiene que pasar:** "Mis cursos" muestra **solo el curso 1**. No aparecen CURSO_A ni CURSO_B.  ☐

Apretá **Salir** de nuevo.

### 10.12 — Credenciales incorrectas

**Hacé:** en **http://localhost:3000/empresa/login** probá, una por una:

| Usuario | Clave |
|---|---|
| `emp_30722334457` | `clavemala` |
| `emp_99999999999` | `test` |

**Tiene que pasar:** en ambos casos el **mismo** mensaje genérico **"Usuario o clave incorrectos."**. El sitio **no** dice si el usuario existe o no.  ☐

### 10.13 — Un usuario del personal no entra a la zona de empresas

**Hacé:** en **http://localhost:3000/empresa/login** escribí Usuario `jefeAdmin`, Clave `test`.

**Tiene que pasar:** **"Usuario o clave incorrectos."** (las cuentas de empresa y las del personal son distintas).  ☐

### 10.14 — Un curso cancelado se ve como cancelado

**Hacé:**
1. En **T3** (CLI) elegí la solicitud del curso **A** (`q` si estás en otra, luego su número).
2. Elegí **Cancelar durante la preparacion**.
3. Cuando pregunte `(s/N)`, escribí `s` y Enter. Enter para actualizar.
4. En la Ventana 2 entrá otra vez como `emp_30722334457` / `test` y mirá "Mis cursos".

**Tiene que pasar:** CURSO_A aparece con estado **`CANCELADO`**. CURSO_B sigue `EN_PREPARACION`.  ☐

Comprobá en T1:

```
docker compose exec -T postgres psql -U institucion -d institucion -c "select id, estado from curso order by id"
```

**Tiene que pasar:** el curso A tiene `estado = CANCELADO`.  ☐

> **Dejá abiertos T3 y la solicitud B**: el escenario 8 sigue con CURSO_B.

**✅ Escenario 10 (puntos de acceso y aislamiento) terminado.** Los estados siguientes de la empresa (confirmado, en desarrollo, etc.) los verificás dentro del escenario 8, en los pasos marcados **[E10]**.  ☐

---
---

# Escenario 8: asignación, reclamo y finalización según los responsables

**Qué se prueba:** que cada tarea le aparece a quien corresponde, que las tareas de grupo se **reclaman** antes de completarse, que una tarea reclamada ya no está disponible para otro, y que el curso llega hasta el final.

**Precondición:** la solicitud **B** (CURSO_B) está **aceptada** y en preparación (viene del escenario 10). Si no, hacé primero los pasos 10.2 a 10.7 con una solicitud nueva.

**Para tener a mano:**
- Sesiones: **Ventana 1 = `jefeAdmin`** (en `/admin`). **Ventana 2 = `admin2`** (en `/admin`).
- T3 con el CLI abierto en la solicitud B.

### 8.1 — Ya está hecho el tramo `jefeAdmin`: propuesta y envío

Esto se comprobó en 10.2/10.3. Verificá la regla principal:

**Hacé:** en la Ventana 1 (`jefeAdmin`), mirá "Mis tareas".

**Tiene que pasar:**
- *Registrar y Elaborar propuesta* y *Enviar propuesta* de CURSO_B ya **no** están (las completaste sin reclamar, porque estaban asignadas a `jefeAdmin`).  ☐
- Aparecen **Evaluar Recursos** y **Preparar materiales** como **"Disponible para reclamar"**, con botón **Reclamar** (tareas del grupo).  ☐

*(Este es el paso 7 del guion original: tareas de grupo → botón Reclamar.)*

### 8.2 — `admin2` no ve las tareas del jefe

**Hacé:**
1. En la Ventana 2 abrí **http://localhost:3000/admin/login** → `admin2` / `test`.
2. Mirá "Mis tareas".

**Tiene que pasar:** `admin2` **no** ve *Registrar y Elaborar propuesta* ni *Revisar propuesta*. Sí ve *Evaluar Recursos* y *Preparar materiales* como disponibles (son del grupo).  ☐

### 8.3 — [E10] Estado actual del curso

**Hacé:** consultá el curso B en la web de la empresa (si cerraste sesión, entrá a **http://localhost:3000/empresa/login** con `emp_30722334457` / `test`; luego **Ver detalle** del curso B).

**Tiene que pasar:** Estado **`EN_PREPARACION`**.  ☐

### 8.4 — La empresa envía la nómina (CLI)

**Hacé** (en **T3**):
1. Elegí la solicitud del curso B. Si hace falta, `r` + Enter.
2. Elegí **Enviar nomina de participantes (variable: participantes)**.
3. Cuando pida la nómina, pegá exactamente:

   ```
   ["Ana Perez","Beto Gomez","Carla Diaz"]
   ```
   y Enter. Enter para actualizar.

**Tiene que pasar:** `Comunicacion enviada: Enviar nomina de participantes.` En el CLI la acción de nómina ya no está disponible.  ☐

### 8.5 — La lista definitiva queda asignada a UNA sola persona

**Por qué:** un código Java reparte esta tarea a quien tenga **menos tareas asignadas** (si empatan, gana el primero por orden alfabético).

**Hacé:**
1. En la Ventana 1 (`jefeAdmin`) apretá F5 (refrescar) en "Mis tareas".
2. En la Ventana 2 (`admin2`) apretá F5.

**Tiene que pasar:** la tarea **Confeccionar lista definitiva** aparece **en una sola** de las dos listas, con estado **"Asignada a vos"** y botón **Abrir**. Con la carga pareja es `admin2`. Anotá quién la tiene: **LISTA = ______**.  ☐
La otra persona **no** la ve ni siquiera como "Disponible para reclamar".  ☐

### 8.6 — Completar la lista **sin reclamar**

**Hacé:** con el usuario que la tiene (LISTA), en su ventana:
1. Apretá **Abrir** en *Confeccionar lista definitiva*.
2. Verás tres nombres, uno por línea. No cambies nada.
3. Apretá **Guardar lista definitiva**.

**Tiene que pasar:** vuelve a "Mis tareas" con mensaje verde y la tarea desapareció. No hizo falta reclamar (ya estaba asignada).  ☐

### 8.7 — Reclamar *Evaluar Recursos* (y probar que otro ya no puede)

**Hacé, en orden:**
1. En la Ventana 2 (`admin2`) dejá abierta la lista de tareas **sin refrescar**: ahí se ve *Evaluar Recursos* con botón **Reclamar**.
2. En la Ventana 1 (`jefeAdmin`) apretá **Reclamar** en la fila *Evaluar Recursos*.
   - **Tiene que pasar:** la fila pasa a **"Asignada a vos"** con botón **Abrir**.  ☐
3. Volvé a la Ventana 2 (`admin2`) y, **sin refrescar**, apretá **Reclamar** en la misma fila *Evaluar Recursos* (el botón viejo sigue en pantalla).
   - **Tiene que pasar:** el sitio **no** te la da: muestra un aviso o error de que **ya fue reclamada** (o 403).  ☐
4. Apretá F5 en la Ventana 2.
   - **Tiene que pasar:** *Evaluar Recursos* **ya no aparece** para `admin2`.  ☐

*(Este paso prueba el punto 9 del guion original: el motor solo impide el segundo reclamo; el sitio es quien exige reclamar antes de completar.)*

### 8.8 — *Evaluar Recursos* con las tres casillas vacías (debe rechazar)

**Hacé** (Ventana 1, `jefeAdmin`):
1. Apretá **Abrir** en *Evaluar Recursos*.
2. Dejá **sin marcar** Aula presencial, Plataforma virtual y Equipamiento especial.
3. Apretá **Guardar recursos**.

**Tiene que pasar:** el sitio **no avanza** y muestra un error (hace falta marcar al menos una alternativa). La tarea sigue en la lista.  ☐

### 8.9 — *Evaluar Recursos* con las tres marcadas

**Hacé** (Ventana 1):
1. Marcá las **tres** casillas: **Aula presencial**, **Plataforma virtual**, **Equipamiento especial**.
2. Apretá **Guardar recursos**.

**Tiene que pasar:**
- Mensaje verde y la tarea desaparece.  ☐
- Se crearon **Solicitar Aula Virtual** y **Contratar equipamiento** (las vas a completar en el paso 8.11).  ☐
- *Reservar aula* corrió **sola** (no ves tarea para eso). Comprobalo en T1:

  ```
  curl -s -u rest-admin:test "http://localhost:8080/flowable-rest/service/history/historic-variable-instances?variableName=aulaAsignada&size=5"
  ```
  *(En Windows PowerShell usá `curl.exe` en lugar de `curl`.)*
  **Tiene que pasar:** el texto devuelto incluye `aulaAsignada`.  ☐

### 8.10 — Preparar materiales con la app de escritorio

**Hacé:** abrí una terminal nueva (**T4**), **andá a la raíz del proyecto** (`cd`, ver el aviso de P4) y ejecutá:

*Windows (PowerShell):*
```powershell
chcp 65001
$env:FLOWABLE_DB_USER="flowable"
$env:FLOWABLE_DB_PASSWORD="flowable"
mvn -q exec:java "-Dexec.mainClass=unrc.cursos.escritorio.AppMateriales"
```
*Ubuntu (Bash):*
```bash
export FLOWABLE_DB_USER=flowable
export FLOWABLE_DB_PASSWORD=flowable
mvn -q exec:java -Dexec.mainClass=unrc.cursos.escritorio.AppMateriales
```

**Tiene que pasar:** se abre una ventana titulada **"Preparar materiales - Flowable"** con campos Usuario y Clave.  ☐

Dentro de la ventana:
1. Usuario `admin2`, Clave `test`, apretá **Ingresar**.
2. En la tabla seleccioná (clic) la fila **Preparar materiales** disponible.
3. Mirá el botón **Completar tarea** **antes** de reclamar.
   - **Tiene que pasar:** está **deshabilitado (gris)**; solo está activo **Reclamar tarea**. La app exige reclamar primero.  ☐
4. Apretá **Reclamar tarea**.
   - **Tiene que pasar:** la fila pasa a estar asignada a `admin2`.  ☐
5. Con la fila seleccionada, apretá **Completar tarea**.
   - **Tiene que pasar:** la fila desaparece de la tabla.  ☐

### 8.11 — Aula virtual y equipamiento en Flowable UI

Estas tareas **no necesitan pantalla en el sitio**; se hacen en la interfaz de Flowable.

**Hacé:**
1. En una pestaña abrí **http://localhost:8081/flowable-ui**.
2. Entrá con `admin2` / `test` y elegí la aplicación **Tasks**.
3. Buscá **Solicitar Aula Virtual** (puede estar en la lista **Queued / En cola**). Abrila y apretá **Claim** (Reclamar) y luego **Complete** (Completar).
4. Repetí con **Contratar equipamiento**.

**Tiene que pasar:** ambas se completan sin error.  ☐

### 8.12 — [E10] El curso pasa a "confirmado y pendiente de inicio"

**Hacé:** refrescá el detalle del curso B en la web de la empresa.

**Tiene que pasar:**
- Estado **`CONFIRMADO_PENDIENTE_INICIO`**.  ☐
- Mirá el aviso de confirmación en el log (T1, comando del paso P5): hay una línea `Aviso` nueva (la confirmación a la empresa). Si tenés un servidor de correo falso abierto, el correo llegó ahí en lugar de aparecer en el log.  ☐

### 8.13 — El jefe docente recibe su tarea

**Hacé:**
1. En la Ventana 2 apretá **Cerrar sesión** de `/admin` y abrí **http://localhost:3000/docentes/login** → `jefeDocente` / `test`.

**Tiene que pasar:** en "Mis tareas" aparece **Definir Docente que desarrolla el curso**, **"Asignada a vos"**, botón **Definir docente**.  ☐

### 8.14 — Elegir docente

**Hacé:**
1. Apretá **Definir docente**.
2. Marcá **`docente1`** (botón de opción).
3. Apretá **Asignar docente**.

**Tiene que pasar:**
- Mensaje de éxito y la tarea desaparece.  ☐
- El proceso queda esperando la fecha (temporizador "Fecha programada").  ☐
- `docente2` no ve nada: en la Ventana 1 cerrá sesión de `/admin`, entrá a **http://localhost:3000/docentes/login** como `docente2` / `test` → la lista está vacía. Cerrá sesión.  ☐

### 8.15 — Esperar la fecha y ver la tarea del docente

**Hacé:**
1. Esperá a que pase la hora **FECHA** que usaste al aceptar (los ~5 minutos).
2. Entrá a **http://localhost:3000/docentes/login** como `docente1` / `test` y refrescá con F5.

**Tiene que pasar:** aparece **Desarrollar curso**, asignada a `docente1` con botón **Desarrollar**.  ☐
- `docente2` y `jefeDocente` **no** la ven (probalo entrando con cada uno).  ☐

### 8.16 — [E10] El curso pasa a "en desarrollo"

**Hacé:** refrescá el detalle del curso B en la web de la empresa.

**Tiene que pasar:** Estado **`EN_DESARROLLO`**.  ☐

### 8.17 — El docente dicta el curso

**Hacé** (como `docente1`):
1. Apretá **Desarrollar**.
2. Verificá que se ven los 3 participantes.
3. Apretá **Marcar curso como dictado**.

**Tiene que pasar:** la tarea desaparece. Se crea *Elaborar informe de resultados* para `jefeDocente`.  ☐
**[E10]** Estado en la web de la empresa: **`ELABORANDO_INFORME`**.  ☐

### 8.18 — Elaborar el informe

**Hacé** (entrá a `/docentes/login` como `jefeDocente` / `test`):
1. Apretá **Elaborar informe** en *Elaborar informe de resultados*.
2. Completá:

   | Campo | Valor |
   |---|---|
   | Resumen de resultados | `El curso se dictó sin inconvenientes.` |
   | Asistentes efectivos | `3` |
   | Observaciones | (vacío) |

3. Apretá **Generar PDF y completar**.

**Tiene que pasar:** mensaje de éxito; el sitio generó el PDF (no subiste ningún archivo).  ☐

### 8.19 — Enviar y archivar el informe

**Hacé:**
1. Entrá a `/admin/login` como `jefeAdmin` / `test`.
2. Apretá **Enviar informe** en *Enviar informe a empresa y Archivar expediente*.
3. Apretá el enlace para **descargar el PDF**. Abrí el archivo.

**Tiene que pasar:** se descarga un PDF con el resumen. ☐

4. Apretá **Enviar informe a la empresa y archivar**.

**Tiene que pasar:**
- Mensaje de éxito.  ☐
- Aparece una tarea nueva: **Liberar Equipamiento** (en Flowable UI, para el grupo `administracion`).  ☐
- **La instancia todavía NO terminó**: en T1 mirá **todos** los cursos (así no hay que reemplazar ningún número):

  ```
  docker compose exec -T postgres psql -U institucion -d institucion -c "select id, estado from curso order by id"
  ```
  **Tiene que pasar**, fila por fila:

  | Curso | `estado` esperado | Por qué |
  |---|---|---|
  | `1` | `EN_PROCESO` | Curso de ejemplo. |
  | CURSO_A | `CANCELADO` | Lo cancelaste en el paso 10.14. |
  | **CURSO_B** | **`EN_PROCESO`** | Su instancia sigue activa, esperando *Liberar Equipamiento*. |

  Si **CURSO_B** dice `CANCELADO`, casi seguro estás mirando la fila del curso A: fijate en la columna `id`.  ☐

### 8.20 — Liberar equipamiento y fin

**Hacé:**
1. En **http://localhost:8081/flowable-ui** (app **Tasks**), entrá como `admin2` / `test`.
2. Abrí **Liberar Equipamiento** → **Claim** → **Complete**.
3. Esperá unos segundos y repetí la consulta del paso anterior (`select id, estado from curso order by id`).

**Tiene que pasar:**
- En la base, **CURSO_B** pasa a `estado = FINALIZADO` (CURSO_A sigue `CANCELADO`).  ☐
- **[E10]** En la web de la empresa el curso B está en **`FINALIZADO`**.  ☐
- En http://localhost:8080/flowable-rest/service/runtime/process-instances?businessKey=CURSO_B ya **no** hay instancia activa.  ☐

**✅ Escenario 8 terminado.** ☐

---
---

## Cierre del ensayo

**Hacé** (T1, raíz del proyecto):

```
node scripts/escenarios/m-limpiar-instancias.js
```

**Por qué:** borra las instancias activas que hayan quedado (cuentan para el límite de 5 del próximo ensayo).

Opcional, para dejar la base como al principio:

*Windows (PowerShell):* `powershell -ExecutionPolicy Bypass -File scripts\crear-bd.ps1`
*Ubuntu (Bash):* `./scripts/crear-bd.sh`

Cerrá T3 (`q` y Enter) y T4 (cerrar la ventana). El sitio (T2) se apaga con `Ctrl + C`.

---

## Resumen de la lista completa

| Escenario | Pasos | ✔ |
|---|---|---|
| **9** — Solicitud desde el sitio | 9.1 a 9.7 | ☐ |
| **10** — Cuenta y acceso de la empresa | 10.1 a 10.14 (+ pasos **[E10]** dentro del 8) | ☐ |
| **8** — Asignación, reclamo y finalización | 8.1 a 8.20 | ☐ |

## Notas del ensayo

Anotá acá cualquier paso que no coincida con lo escrito (número de paso, qué viste, qué esperabas):

- 
- 
- 
