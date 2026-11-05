# Guía: correr los escenarios con Postman, DevNull y la app Java

Esta guía explica tres cosas que se usan juntas para ensayar la defensa **a mano**, sin el script `m-escenarios.js`:

1. **DevNull** (un servidor de correo falso) para ver los avisos que el proceso le manda a la empresa.
2. **Postman** para reemplazar al CLI y a las pantallas: manda las llamadas REST.
3. **La app Java** "Preparar materiales", que se prueba con ventana.

> Antes: entorno levantado (sección 5 de [`MAPA.md`](../MAPA.md) o sección 2 del [`README.md`](../README.md)).

---

## 1. Qué es SMTP

**SMTP** (*Simple Mail Transfer Protocol*) es el "idioma" que usan los programas para **enviar** correo electrónico. Funciona como una oficina de correos:

- Un programa (el **cliente**) llega y dice "quiero mandar este mensaje a tal dirección".
- Un **servidor SMTP** lo recibe y lo reenvía al destino.

En este proyecto, cuando el proceso tiene que avisar algo a la empresa (llegó la propuesta, no es viable, curso confirmado…), la clase `NotificarEmpresaDelegate` actúa de **cliente**: se conecta a un servidor SMTP en `SMTP_HOST:SMTP_PORT` (por defecto `host.docker.internal:25`, o sea **tu máquina, puerto 25**) y le entrega el correo.

Como en una demo no queremos mandar mails reales, usamos un **servidor SMTP falso**: **DevNull**. Recibe el correo, lo muestra en pantalla y **no lo reenvía a nadie**.

```
Flowable (dentro de Docker)  ──SMTP──►  DevNull (tu máquina, puerto 25)  ──► lo muestra en pantalla
```

Si no hay ningún servidor escuchando, **no pasa nada grave**: el aviso queda como línea `Aviso … NO enviado` en `docker logs flowable-rest` y el proceso sigue.

---

## 2. En qué escenarios se usa DevNull

No es obligatorio en ninguno, pero **sirve para comprobar los avisos** en estos:

| Escenario | Correos que tenés que ver en DevNull |
|---|---|
| **1** Aceptación y fin normal | `Propuesta de curso (version 1)` · `Confirmacion del curso` · `Informe de resultados del curso` |
| **2** Modificaciones | `Propuesta de curso (version 1)` y `Propuesta de curso (version 2)` |
| **3** Rechazo | `Propuesta de curso (version 1)` |
| **4** Sin respuesta | `Propuesta de curso (version 1)` + **2** `Recordatorio: propuesta de curso pendiente de respuesta` |
| **5** Límite de cursos | `Solicitud de curso: no es posible desarrollarlo` (solo la 6ª solicitud) |
| **6** Cancelación | `Propuesta de curso (version 1)` · `Cierre de la solicitud de curso` |
| **7** Falta de aulas | `Propuesta de curso (version 1)` · `Cierre de la solicitud de curso` |
| 8, 9, 10 | Opcional: mismos avisos que el escenario 1 |
| 11 | Opcional: `Confirmacion del curso`, que en este caso la manda **la app Java** (ver sección 5) |

> Todos los correos llegan a `contacto_email` de la empresa del curso (`mgomez@agroriocuarto.com.ar` para la empresa 1, `lfernandez@metalsur.com.ar` para la 2).

---

## 3. Preparar y usar DevNull

### 3.1 Conseguirlo

DevNullSmtp es un programa Java de ventana (un `.jar`). Bajalo de su página oficial y guardalo en cualquier carpeta. *(No lo incluyo en el repo; los nombres exactos de sus botones pueden variar según la versión.)*

### 3.2 Elegir el puerto

| Sistema | Puerto | Por qué |
|---|---|---|
| **Windows** | **25** (el valor por defecto de los contenedores) | Cualquier programa puede abrirlo. |
| **Ubuntu** | **2525** | En Linux los puertos menores a 1024 requieren `root`. |

Dos reglas que se olvidan fácil:

- **El puerto de DevNull y el de `SMTP_PORT` de los contenedores tienen que ser el mismo.**
- `SMTP_PORT` se lee **al crear** los contenedores. Si lo cambiás, hay que volver a ejecutar `docker compose up -d` con la variable puesta.

### 3.3 Windows, paso a paso

1. Abrí una terminal y ejecutá (cambiá la ruta por donde guardaste el jar):

   ```powershell
   java -jar C:\ruta\DevNullSmtp.jar
   ```
2. En la ventana de DevNull, dejá el puerto en **25** y apretá el botón de iniciar (*Start*).
3. Comprobá que escucha, en otra terminal:

   ```powershell
   netstat -ano | findstr ":25 "
   ```
   Tiene que aparecer una línea `LISTENING`.
4. Los contenedores ya usan el puerto 25 por defecto: **no hace falta cambiar nada**.
   (Si ya los tenías levantados antes de abrir DevNull, igual funciona: el puerto se resuelve en cada envío.)

### 3.4 Ubuntu, paso a paso

1. Abrí DevNull:

   ```bash
   java -jar ~/ruta/DevNullSmtp.jar
   ```
2. En su ventana poné el puerto **2525** y apretá iniciar.
3. Comprobá que escucha:

   ```bash
   ss -ltnp | grep ':2525'
   ```
4. **Recreá los contenedores avisando el puerto** (desde la raíz del proyecto):

   ```bash
   SMTP_PORT=2525 docker compose up -d
   ```
5. Si tenés `ufw` activo y los correos no llegan, permití la red de Docker hacia ese puerto, o probá desactivarlo un momento para descartar.

### 3.5 Usarlo

- Cada correo que manda el proceso **aparece como una fila** en la lista de DevNull. Hacé clic en la fila para ver el asunto y el cuerpo.
- Tildá en esta guía el asunto que esperabas (tabla de la sección 2).
- Para empezar de cero, usá el botón de borrar/limpiar de DevNull antes de cada escenario.
- **No corras `m-escenarios.js` mientras DevNull esté abierto en el mismo puerto**: el script abre su propio servidor en ese puerto y no puede (omite las verificaciones de correo). Cerrá DevNull antes, o usá otro puerto.

### 3.6 Si no podés conseguir DevNull: el sumidero del repo

El repo trae un servidor equivalente (Node.js, igual en Windows y Ubuntu). Imprime una línea por cada correo recibido:

*Windows (PowerShell), en la raíz del proyecto:*
```powershell
node scripts\escenarios\m-smtp-sumidero.js 25
```
*Ubuntu (Bash), en la raíz del proyecto:*
```bash
node scripts/escenarios/m-smtp-sumidero.js 2525
```

Dejá esa terminal abierta. Verás por ejemplo `[10:32:11] Correo para lfernandez@metalsur.com.ar | Propuesta de curso (version 1)`. Es lo mismo que mira el script automático.

### 3.7 Comprobar que funciona (antes de empezar)

1. Con DevNull abierto, hacé una solicitud desde http://localhost:3000/solicitar y, en `/admin` como `jefeAdmin`, completá *Registrar y Elaborar propuesta* y luego *Enviar propuesta*.
2. Tiene que aparecer en DevNull `Propuesta de curso (version 1)`.
3. Si no aparece, mirá el log del contenedor:

   *Windows:* `docker logs flowable-rest 2>&1 | Select-String "Aviso"`
   *Ubuntu:* `docker logs flowable-rest 2>&1 | grep "Aviso"`

   - Dice `enviado a …` → el problema es del lado de DevNull (puerto equivocado).
   - Dice `NO enviado (…Connection refused…)` → DevNull no escucha en el puerto que usan los contenedores.

---

## 4. Postman: importar y configurar

### 4.1 Importar

1. Abrí Postman → **Import** → elegí `postman/proyecto-bpmn.postman_collection.json`.
2. Abrí la colección → pestaña **Variables** y revisá:

   | Variable | Valor | Para qué |
   |---|---|---|
   | `usuario` / `clave` | `jefeAdmin` / `test` | Quién hace las llamadas. Cambiala según la tarea (ver tabla de abajo). |
   | `empresaId` | `2` | Tiene que existir en la BD (1 o 2). |
   | `cursoId` | `101` | Número de curso; cambialo en cada escenario. |
   | `processInstanceId`, `taskId`, `executionId` | (vacías) | **Se llenan solas.** No las toques. |
   | `taskKey` | `Propuesta` | Qué tarea buscar. Se cambia a mano. |

3. Abrí la **consola de Postman** (*View → Show Postman Console*). Ahí se imprimen avisos útiles (ids, tareas, por qué un mensaje no está habilitado).

### 4.2 Quién hace cada tarea (variable `usuario`)

El motor **no obliga** a que sea la persona correcta, pero para ensayar como en la defensa conviene cambiarla:

| Tarea (`taskKey`) | Usuario | ¿Reclamar? |
|---|---|---|
| `Propuesta`, `Enviar`, `Revisar`, `Archivar`, `EnviarInforme` | `jefeAdmin` | No (asignadas) |
| `Lista` | `admin2` (la reparte el listener) | No |
| `Material`, `Activity_12i2hpf` (Evaluar Recursos), `Virtual`, `Equipo`, `Activity_1m08pcl` (Liberar Equipamiento) | `admin2` o `jefeAdmin` | **Sí** |
| `Activity_1018bdz` (Definir docente), `Informe` | `jefeDocente` | No |
| `Dictar` | `docente1` (el elegido) | No |

### 4.3 Las 4 operaciones que vas a repetir

**A. Iniciar una instancia**

1. Antes, crear el curso en la base (si no vino del sitio):

   ```
   docker compose exec -T postgres psql -U institucion -d institucion -c "insert into curso (id, empresa_id, tematica, descripcion, cantidad_participantes, fechas_preferidas) values (101, 2, 'Prueba', 'x', 3, 'pronto')"
   ```
   (Cambiá `101` por tu `cursoId`.)
2. Postman: **3. Instancias → Iniciar por mensaje Solicitud de curso → Send**.
3. Tiene que responder **201** y `processInstanceId` se guarda solo.
4. Vincular el curso con la instancia, para que el estado final llegue a la base (copiá el `id` de la respuesta):

   ```
   docker compose exec -T postgres psql -U institucion -d institucion -c "update curso set process_instance_id='PEGAR_ID' where id=101"
   ```

**B. Completar una tarea**

1. Poné `taskKey` (ej. `Propuesta`).
2. **4. Tareas → Buscar tarea por clave (taskKey) → Send** (guarda `taskId`).
3. Si es de grupo: **Reclamar tarea (claim) → Send** (con el `usuario` correcto).
4. **Completar tarea → Send**. Responde **200**.

**C. Mandar una comunicación de la empresa**

**5. Comunicaciones de la empresa →** el request que corresponda → **Send**. Responde **204**. Ya no hay que buscar la ejecución: cada request la busca solo. Si la comunicación no está habilitada, devuelve **404** y la consola explica por qué.

**D. Ver el estado**

- **Listar tareas de la instancia** (consola: qué tareas hay y de quién).
- **Ver variables de una instancia** (valores como `estadoCurso`, `propuestaVersion`).
- **Instancias no finalizadas (historial)**.
- Base: `select id, estado from curso order by id` con el comando `psql` de arriba.

---

## 5. La app Java "Preparar materiales": cuándo y cómo probarla

### 5.1 ¿Hace falta probarla a mano?

- **La lógica** (listar tareas, reclamar, completar, permisos) ya la prueba el escenario 11 del script `m-escenarios.js` y `mvn test`, sin ventana.
- **La ventana** (lo que se muestra en la defensa) **solo se prueba a mano**. Ningún script la abre.

La consigna (§4.2.1) pide mostrarla funcionando, así que **sí, hay que ensayarla a mano** al menos una vez. Se usa en:

| Escenario | Para qué |
|---|---|
| **1** | Opcional: completar *Preparar materiales* con la app en vez de por REST/Postman. |
| **8** | Obligatoria: es parte de la asignación y reclamo (paso 8.10 del checklist). |
| **11** | Obligatoria: es el escenario. Se combina con el CLI. |

### 5.2 Pasos (sirven para los tres escenarios)

**Condición previa:** una instancia que **ya aceptó la propuesta** y está en *Preparar curso* (existe la tarea *Preparar materiales*, `taskKey=Material`). Para llegar rápido: iniciar → `Propuesta` → `Enviar` → **Aceptar propuesta** (todo con Postman).

1. En la raíz del proyecto, abrí una terminal nueva:

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
   *(Usa la base del motor directamente: por eso pide usuario y clave **de la base**, no de una persona.)*
2. Se abre la ventana **"Preparar materiales - Flowable"**.
3. **Prueba negativa 1 — clave mala:** Usuario `admin2`, Clave `mala` → **Ingresar**. Tiene que rechazar el ingreso.
4. **Prueba negativa 2 — otro grupo:** Usuario `docente1`, Clave `test` → **Ingresar**. La tabla **no** muestra la tarea (los docentes no son del grupo `administracion`). Apretá **Cambiar usuario**.
5. **Camino correcto:** Usuario `admin2`, Clave `test` → **Ingresar**. La tabla muestra **Preparar materiales** como disponible.
6. Seleccioná la fila con un clic. Mirá los botones: **Completar tarea** está **deshabilitado** (hay que reclamar primero).
7. Apretá **Reclamar tarea**. La fila pasa a estar asignada a `admin2`.
8. **Prueba negativa 3 — otro usuario:** apretá **Cambiar usuario**, entrá como `jefeAdmin` / `test`. La tarea reclamada **ya no** aparece como disponible ni se puede completar. Volvé a entrar como `admin2`.
9. Seleccioná la fila y apretá **Completar tarea**. La fila desaparece.
10. Verificación: en Postman, **Listar tareas de la instancia** ya no muestra `Material`.
11. Si era la **última** rama de *Preparar curso*, el proceso sigue solo hasta *Enviar confirmación* y *Definir Docente…*. El correo de confirmación lo manda **la app**, no Flowable: sale en la terminal de la app, y llega a DevNull porque la app usa por defecto `localhost:25` (Windows: no hay que hacer nada). En Ubuntu, con DevNull en 2525, exportá antes `export SMTP_PORT=2525` en la terminal de la app. Si no hay servidor, queda la línea `Aviso … NO enviado` en esa terminal y el proceso sigue igual.

---

## 6. Recetas por escenario (Postman + DevNull)

Convenciones: **[P]** = Postman · **[D]** = mirar DevNull · **[DB]** = comando `psql`. "Completar X" = operación **B** de la sección 4.3 con ese `taskKey`.
Antes de **cada** escenario: **[P]** *Borrar TODAS las instancias activas de Process_Curso*, limpiar DevNull y cambiar `cursoId`.

### Escenario 1 — Aceptación y fin normal

1. **[DB]** crear curso (4.3-A). **[P]** Iniciar. **[DB]** vincular.
2. Completar `Propuesta` → completar `Enviar`. **[D]** `Propuesta de curso (version 1)`.
3. **[P]** *Aceptar propuesta (con fecha)* → 204. **[DB]** `select * from cuenta_empresa` → cuenta `emp_30722334457` (si `empresaId=2`).
4. **[P]** *Enviar nomina*. Luego *Listar tareas de la instancia*: aparecen `Lista`, `Material` y `Activity_12i2hpf`.
5. Completar `Lista` (usuario `admin2`).
6. `Material`: reclamar y completar (usuario `admin2`) **o** usar la app Java (sección 5).
7. `Activity_12i2hpf`: reclamar y **Completar Evaluar Recursos (aula, virtual y equipamiento)**.
8. Completar `Virtual` y `Equipo` (reclamar primero). **[D]** `Confirmacion del curso`.
9. `usuario=jefeDocente` → **Completar Definir docente**.
10. Esperar a que pase la fecha (5 min). `usuario=docente1` → completar `Dictar`.
11. `usuario=jefeDocente` → completar `Informe`. `usuario=jefeAdmin` → completar `EnviarInforme`. **[D]** `Informe de resultados del curso`.
12. Aparece `Activity_1m08pcl`: reclamar y completar. La instancia termina.
13. **[DB]** `select estado from curso where id=…` → `FINALIZADO`.

### Escenario 2 — Modificaciones

1. Iniciar; completar `Propuesta` y `Enviar`. **[D]** versión 1.
2. **[P]** *Pedir modificaciones*. Aparece `Revisar`: completar `Revisar`.
3. Completar `Enviar` otra vez. **[D]** `Propuesta de curso (version 2)`.
4. **[P]** *Ver variables*: `propuestaVersion = 2`, `recordatorios = 0`.

### Escenario 3 — Rechazo

1. Iniciar; completar `Propuesta` y `Enviar`.
2. **[P]** *Rechazar propuesta*. Aparece `Archivar`: completar.
3. **[DB]** `estado = RECHAZADO`.

### Escenario 4 — Sin respuesta

1. **[P]** usar **6. Viabilidad y plazos → Iniciar solicitud con plazo corto** (plazo de 20 s).
2. Completar `Propuesta` y `Enviar`. **No respondas.**
3. Esperar unos 80 segundos. **[D]** propuesta + **2** recordatorios.
4. Aparece `Archivar`: completar. **[DB]** `estado = SIN_RESPUESTA`.

### Escenario 5 — Límite de cursos

1. **[DB]** crear 6 cursos de una vez:
   ```
   docker compose exec -T postgres psql -U institucion -d institucion -c "insert into curso (id, empresa_id, tematica, descripcion, cantidad_participantes, fechas_preferidas) select g, 2, 'Prueba', 'x', 3, 'pronto' from generate_series(201,206) g"
   ```
2. **[P]** Iniciar 6 veces cambiando `cursoId` de 201 a 206 (sin completar nada). La 5ª es viable.
3. En la 6ª: **Ver cursosEnEjecucion (historial)** → `5`; **Ver variables** → `viable=false`. La instancia termina sola.
4. **[D]** `Solicitud de curso: no es posible desarrollarlo`. **[DB]** curso 206 con `estado = NO_VIABLE`.

### Escenario 6 — Cancelación con recursos gestionados

1. Iniciar; `Propuesta`; `Enviar`; *Aceptar*.
2. Reclamar y completar `Activity_12i2hpf` con **Completar Evaluar Recursos**.
3. Reclamar y completar **solo `Equipo`** (dejá `Virtual` pendiente).
4. **[P]** *Cancelar curso*. Aparece `Activity_1m08pcl`: **todavía no** hay correo de cierre.
5. Reclamar y completar `Activity_1m08pcl`. **[D]** `Cierre de la solicitud de curso`.
6. **[P]** *Ver variables (historial)*: `aulaLiberada=true`, **sin** `aulaVirtualLiberada`. **[DB]** `estado = CANCELADO`.

### Escenario 7 — Falta de aulas

1. En el body de *Iniciar por mensaje* agregá a `variables` el elemento `{ "name": "simularFaltaAulas", "value": true, "type": "boolean" }`.
2. `Propuesta`; `Enviar`; *Aceptar*.
3. Completar `Activity_12i2hpf` marcando aula (el request de ejemplo sirve).
4. El proceso se cancela solo. **[D]** `Cierre de la solicitud de curso`. **[DB]** `estado = CANCELADO`; variable `motivoCancelacion = SIN_AULAS`.

### Escenarios 8, 9, 10 y 11

- **8, 9, 10**: se hacen en el sitio, con [`checklist-manual.md`](checklist-manual.md). Postman sirve para verificar (ver variables, listar tareas) y DevNull para los correos.
- **11**: CLI + app Java, sección 5 de esta guía y sección 6.4/6.6.d de [`MAPA.md`](../MAPA.md).

---

## 7. Errores típicos

| Síntoma | Causa |
|---|---|
| Un request de la carpeta 5 responde **404** | La comunicación no está habilitada ahora (mirá la consola de Postman). Ej.: aceptar antes de completar `Enviar`. |
| Iniciar responde **201** pero la instancia desaparece | Terminó sola: es `NO_VIABLE` (hay 5+ instancias activas). Borrá las activas. |
| Iniciar responde **500** o falla al aceptar | `empresaId` no existe en la BD (usá 1 o 2). |
| *Buscar tarea por clave* da 0 resultados | La tarea todavía no se creó (esperá y repetí) o `taskKey` está mal. |
| Completar `Activity_12i2hpf` responde **500** | Dejaste las tres banderas en `false`. |
| No llega ningún correo a DevNull | Puerto distinto entre DevNull y `SMTP_PORT`; o los contenedores no se recrearon con `SMTP_PORT` (Ubuntu). Ver 3.7. |
| `Definir docente` da **500** | La aceptación se envió sin `fechaCurso`. Con la colección ya no pasa (la calcula sola). |
