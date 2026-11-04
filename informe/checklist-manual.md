# Checklist manual de la defensa: escenarios 8, 9 y 10

Estos tres escenarios dependen del sitio web (`web/`, en construcción por otras dos personas), así que no están en `scripts/escenarios/m-escenarios.js`. Los escenarios 1 a 7 y 11 se ensayan con `node scripts/escenarios/m-escenarios.js` (ver `README.md`).

Las pantallas y rutas del sitio son las que debe tener según la consigna §4.1; **ajustar los nombres de los menús cuando el sitio esté terminado** (marcados con ◻).

## Preparación (una vez, antes de ensayar)

1. Entorno levantado según `README.md` ("Puesta en marcha", pasos 1 a 5) y sitio web en marcha (`TODO web`: comando de arranque, ver `README.md` §"Sitio web").
2. Sin instancias activas de `Process_Curso` (cuentan para el límite de 5): `node scripts/escenarios/m-limpiar-instancias.js`.
3. Credenciales de Flowable (clave `test`): `jefeAdmin`, `admin2` (grupo `administracion`); `jefeDocente`, `docente1`, `docente2` (grupo `docentes`).
4. Una terminal con el simulador de la empresa (`README-aplicaciones.md` §3) y otra con la app Swing (`README-aplicaciones.md` §4) para los pasos que las usan.
5. BD de prueba cargada (`scripts/crear-bd`): empresa 1 con cuenta, empresa 2 sin cuenta.
6. DevNullSmtp (u otro SMTP falso) abierto en el puerto 25 para ver los correos a la empresa. Es opcional: sin él, los avisos quedan en el log de `flowable-rest` y el proceso sigue.

---

## Escenario 9: registro de una solicitud desde el sitio e inicio de su instancia

| # | Quién | Dónde | Acción | Qué se debe ver |
|---|---|---|---|---|
| 1 | Visitante (sin ingresar) | sitio, sección pública "Solicitar capacitación" ◻ | Completar empresa (nombre, CUIT), contacto (nombre, mail, teléfono), temática, descripción, cantidad de participantes y fechas preferidas; enviar | Mensaje de confirmación de la solicitud |
| 2 | — | BD: `docker compose exec -T postgres psql -U institucion -d institucion -c "select id, empresa_id, estado, process_instance_id from curso order by id desc limit 1"` | Mirar la última fila | `estado = EN_PROCESO` y `process_instance_id` **no nulo** |
| 3 | — | Flowable REST: `GET /flowable-rest/service/runtime/process-instances?businessKey=<id del curso>` (usuario `rest-admin`/`test`) | Buscar la instancia con ese ID | Una instancia de `Process_Curso` con `businessKey = cursoId`; mismo ID que la columna de la BD |
| 4 | `jefeAdmin` | sitio, "Mis tareas" ◻ (o Flowable UI `http://localhost:8081/flowable-ui`, app *Tasks*) | Abrir la lista | Tarea **Registrar y Elaborar propuesta** asignada a `jefeAdmin`, sin botón de reclamar |
| 5 | `jefeDocente` | sitio, "Mis tareas" ◻ | Abrir la lista | No ve esa tarea |

Variantes que conviene ensayar: mandar el formulario vacío (debe validar y **no** crear instancia ni fila); mandar una empresa con CUIT repetido (debe reutilizar la empresa, no duplicarla).

---

## Escenario 8: asignación, reclamo y finalización según los responsables

Precondición: una solicitud viable con la propuesta aceptada. Atajo para llegar rápido: completar *Registrar y Elaborar propuesta* como `jefeAdmin` y usar el simulador (acción **Aceptar**, fecha cercana, y luego **Enviar nómina**).

| # | Quién | Dónde | Acción | Qué se debe ver |
|---|---|---|---|---|
| 1 | `jefeAdmin` | sitio, tarea *Registrar y Elaborar propuesta* ◻ | Completarla | Se completa sin reclamar (está asignada a él). Aparece la tarea **Enviar propuesta**, también de `jefeAdmin` |
| 1b | `jefeAdmin` | sitio ◻ | Completar *Enviar propuesta* | Llega un correo a la empresa (si DevNullSmtp está abierto) y la solicitud queda esperando la respuesta |
| 2 | `admin2` | sitio, "Mis tareas" ◻ | Mirar la lista | **No** ve *Registrar y Elaborar propuesta* ni *Revisar* |
| 3 | Simulador (empresa) | CLI | Aceptar con fecha cercana (p. ej. dentro de 2 minutos) | Pasa a *Preparar curso*. En `cuenta_empresa` hay una cuenta para la empresa (creada o reutilizada) |
| 4 | Simulador | CLI | Enviar nómina | Se crea **Confeccionar lista definitiva** |
| 5 | `jefeAdmin` y `admin2` | sitio, "Mis tareas" ◻ | Mirar la tarea *Confeccionar lista definitiva* | Está **asignada** a uno solo: el administrativo con menos tareas asignadas (con carga pareja, `admin2` por orden alfabético). El otro no la ve como disponible |
| 6 | `admin2` | sitio | Completarla | Se completa sin reclamar |
| 7 | `jefeAdmin` | sitio, tareas disponibles para su grupo ◻ | Ver *Evaluar Recursos* y *Preparar materiales* | Aparecen como **disponibles para el grupo** (con botón *Reclamar*) |
| 8 | `jefeAdmin` | sitio | Reclamar *Evaluar Recursos* | Pasa a asignada a `jefeAdmin`; `admin2` ya no la ve como disponible |
| 9 | `admin2` | sitio | Intentar reclamarla / completarla | Error: ya reclamada. (El motor sólo impide el segundo reclamo, 409; la regla "reclamar antes de completar" la hace cumplir el sitio.) |
| 10 | `jefeAdmin` | sitio, *Evaluar Recursos* ◻ | Dejar las tres opciones sin marcar y enviar | El sitio **rechaza** el envío (al menos una alternativa). Si llegara al motor daría 500 |
| 11 | `jefeAdmin` | sitio | Marcar aula física, aula virtual y equipamiento; completar | Se crea *Solicitar Aula Virtual* y *Contratar equipamiento*; *Reservar aula* corre sola (queda `aulaAsignada`) |
| 12 | `admin2` | Flowable UI (app *Tasks*) | Reclamar y completar *Solicitar Aula Virtual* y *Contratar equipamiento* | Se completan. Estas tareas no necesitan pantalla en el sitio |
| 13 | `jefeDocente` | sitio, "Mis tareas" ◻ | Mirar la lista cuando termina la preparación | Aparece **Definir Docente…** asignada a `jefeDocente` (la confirmación a la empresa ya salió, ver log de `flowable-rest`) |
| 14 | `jefeDocente` | sitio | Elegir `docente1` y completar | Se crea *Fecha programada* (timer). `docente2` no ve nada |
| 15 | `docente1` | sitio, "Mis tareas" ◻ | Esperar la fecha acordada y mirar la lista | Aparece **Desarrollar curso** asignada a `docente1`; `docente2` y `jefeDocente` no la ven |
| 16 | `docente1` | sitio | Completarla | Se crea *Elaborar informe de resultados* para `jefeDocente` |
| 17 | `jefeDocente` | Flowable UI o sitio | Completar el informe adjuntando un PDF | La tarea *Enviar informe a empresa y archivar expediente* queda asignada a `jefeAdmin` |
| 18 | `jefeAdmin` | sitio | Consultar el informe (PDF) y completar la tarea | Se crea **Liberar Equipamiento** para el grupo `administracion`; la instancia **no** termina todavía |
| 19 | `admin2` | Flowable UI | Reclamar y completar *Liberar Equipamiento* | La instancia termina. `curso.estado = FINALIZADO` |

---

## Escenario 10: habilitación del acceso de la empresa y consulta exclusiva de sus cursos

Precondición: dos empresas con cursos propios, por ejemplo la empresa 2 (sin cuenta) y la empresa 1 (con cuenta `emp_...`). Conviene tener un curso de cada una avanzado hasta distintos estados.

| # | Quién | Dónde | Acción | Qué se debe ver |
|---|---|---|---|---|
| 1 | — | BD: `select * from cuenta_empresa` | Antes de aceptar un curso de la empresa 2 | No hay fila para `empresa_id = 2` |
| 2 | Simulador | CLI | Aceptar la propuesta de ese curso | Se crea la cuenta (`usuario = emp_<cuit sin guiones>`, clave simulada `test`): **una sola** fila para la empresa 2 |
| 3 | — | BD | Aceptar un **segundo** curso de la empresa 2 | Sigue habiendo **una** cuenta; el segundo curso se vincula a ella (no se duplica) |
| 4 | Empresa 2 | sitio, sección de acceso ◻ | Ingresar con `emp_<cuit>` / `test` | Ingresa; ve sólo **sus** cursos (los dos) |
| 5 | Empresa 2 | sitio | Abrir el detalle de un curso en preparación | Estado **en preparación** y la lista de actividades **pendientes o en ejecución en paralelo** (p. ej. *Recibir nómina*, *Preparar materiales*, *Evaluar Recursos* a la vez) |
| 6 | Empresa 2 | sitio | Pedir directamente la URL de un curso de la empresa 1 (cambiar el ID en la dirección) | **Acceso denegado** o no encontrado; no se muestran datos de la otra empresa |
| 7 | Empresa 1 | sitio | Ingresar y mirar la lista | Sólo sus cursos |
| 8 | Empresa 2 | sitio | Ver un curso en cada etapa (ir avanzando el proceso) | Estado correcto: *en preparación* → *confirmado y pendiente de inicio* → *en desarrollo* → *en elaboración del informe* → *finalizado*; y *cancelado* para uno cancelado |
| 9 | Empresa 2 | sitio | Credenciales incorrectas | Rechazadas, sin revelar si existe el usuario |
| 10 | Persona de la institución (`jefeAdmin`) | sitio, acceso de empresas ◻ | Intentar ingresar con su usuario de Flowable en la zona de empresas | No debe ver los cursos de una empresa (las cuentas son distintas) |

Nota para el que construye el sitio: el estado del curso para la empresa está en la variable de proceso `estadoCurso` (`EN_ACUERDO`, `EN_PREPARACION`, `CONFIRMADO_PENDIENTE_INICIO`, `EN_DESARROLLO`, `ELABORANDO_INFORME`, `FINALIZADO`, `CANCELADO`); los cierres sin curso (`NO_VIABLE`, `RECHAZADO`, `SIN_RESPUESTA`) están en `curso.estado`. Las actividades paralelas de `Preparar` salen de `/runtime/tasks` y `/runtime/executions`. Ver `informe/decisiones-pendientes.md`, "Reglas para el sitio web".

---

## Cierre del ensayo

- Borrar las instancias activas que hayan quedado (`node scripts/escenarios/m-limpiar-instancias.js`), para que no cuenten en el límite de 5 del próximo ensayo.
- Si algún paso no coincide con lo escrito, anotar el paso y la pantalla acá mismo antes de la defensa.
