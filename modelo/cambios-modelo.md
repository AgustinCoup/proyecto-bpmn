# Registro de cambios al modelo

Modelo ejecutable: `modelo/Proyecto_Organizacion_cursos.bpmn20.xml`. Parte de `Proyecto_Organizacion_cursos.bpmn` (modelo conceptual del equipo, que no se modifica).

Cada entrada indica el elemento, qué cambió, por qué, si es provisorio y hasta qué fase, y la evidencia. La evidencia está en `pruebas-flowable/resultados/` (carpeta local, no versionada), con el formato `archivo.log:línea`. Ahí está cada llamada REST con su respuesta real.

**Lo que no cambió:** el diagrama (`BPMNDiagram`) es idéntico al del original, y se conservan todos los IDs salvo los 12 mensajes quitados (entrada 4). Lo comprueba una comparación automática de los dos archivos, hecha el 2026-11-03.

## Fase "camino de viabilidad y acuerdo" (2026-11-03)

Alcance: `Inicio`, `Activity_1xw400l`, `Gateway_10gftrn`, `Activity_0iibzwu`, `Event_18edb9q`, `Propuesta`, `Enviar`, `Esperar`, `Modificar`, `Rechazar`, `Aceptar`, `Plazo`, `Limite`, `Recordatorio`, `Revisar`, `Archivar`, `FinSinCurso` y `Activity_1eg7zcl`. El resto del modelo sólo recibió asignaciones (que son atributos) y los arreglos mínimos sin los cuales no despliega (entradas 25 a 30).

### Definiciones y proceso

| # | Elemento | Qué cambió | Por qué | Provisorio | Evidencia |
|---|---|---|---|---|---|
| 1 | `Definitions_Cursos` | Se agregó `xmlns:flowable="http://flowable.org/bpmn"`. | Para escribir las extensiones de Flowable (asignaciones, listeners, expresiones). | No | Despliega: `g-camino-acuerdo.log:3` (201). |
| 2 | `Process_Curso` | `isExecutable="false"` → `"true"`. | Flowable sólo despliega procesos ejecutables. | No | `g-camino-acuerdo.log:3-5` (definición `Process_Curso` versión 1). |
| 3 | `Process_Curso` (documentación) | Se quitó la oración sobre encuestas y "Modelo conceptual, no ejecutable" pasó a "Modelo ejecutable en Flowable 6.8.0". | Las encuestas no son parte de esta consigna, y el modelo ya no es conceptual. | No | — |

### Mensajes

| # | Elemento | Qué cambió | Por qué | Provisorio | Evidencia |
|---|---|---|---|---|---|
| 4 | `Msg_prop`, `Msg_record`, `Msg_nom`, `Msg_corr`, `Msg_pedcorr`, `Msg_consulta`, `Msg_resp`, `Msg_cierre`, `Msg_conf`, `Msg_enc`, `Msg_resenc`, `Msg_informe` | Quitados. | Ningún elemento los referencia: son restos de otra versión del enunciado. Quedan `Msg_sol`, `Msg_acepta`, `Msg_rechaza`, `Msg_mod` y `Msg_cancel`. | No | — |
| 5 | `Msg_pendienteX2` (nuevo) y `Event_1g4xmqo` "Recibir Cancelación" | Mensaje nuevo, "Cancelación (pendiente fase X2)", referenciado desde la definición de mensaje de `Event_1g4xmqo`. | Flowable no despliega un evento de mensaje sin `messageRef` (`flowable-message-event-missing-message-ref`), y en esta fase no se asocia `Msg_cancel`. Nadie envía este mensaje, así que la cancelación queda **desactivada**. Con el diseño actual, la cancelación dejaría la instancia trabada (fase 1). | **Sí, fase X2:** `Event_1g4xmqo` pasa a `Msg_cancel` y se borra `Msg_pendienteX2`. | Error: `f-sonda-original.log:3`. Suscripción inerte en `Preparar`: `g-camino-acuerdo.log:35`. |

### Asignaciones (sólo atributos)

| # | Elemento | Qué cambió | Por qué | Provisorio | Evidencia |
|---|---|---|---|---|---|
| 6 | `Propuesta` "Registrar y Elaborar propuesta" | `flowable:assignee="jefeAdmin"`. | Consigna §2: tarea exclusiva del jefe administrativo, asignada directamente y sin reclamo. | No | jefeAdmin la ve asignada: `g-camino-acuerdo.log:15-16`. admin2 no la ve: `:18-19`. |
| 7 | `Revisar` "Revisar propuesta" | `flowable:assignee="jefeAdmin"`. | Ídem. | No | `g-camino-acuerdo.log:118`. |
| 8 | `Archivar` "Archivar solicitud" | `flowable:assignee="jefeAdmin"`. | Ídem. | No | `g-camino-acuerdo.log:167`, `:198`. |
| 9 | `EnviarInforme` | `flowable:assignee="jefeAdmin"`. | Ídem (enviar el informe y archivar el expediente). | No | Despliega; fuera del camino probado. |
| 10 | `Activity_1018bdz` "Definir Docente…" | `flowable:assignee="jefeDocente"`. | Consigna §2: exclusiva del jefe del equipo docente. | No | Despliega; fuera del camino probado. |
| 11 | `Informe` "Elaborar informe de resultados" | `flowable:assignee="jefeDocente"`. | Ídem. | No | Despliega; fuera del camino probado. |
| 12 | `Dictar` "Desarrollar curso" | `flowable:assignee="${docenteSeleccionado}"`. | Consigna §1.4 y §2: la tarea queda asignada al docente que eligió el jefe. | No | Despliega; fuera del camino probado. |
| 13 | `Material`, `Activity_12i2hpf`, `Virtual`, `Equipo`, `Activity_1m08pcl` | `flowable:candidateGroups="administracion"`. | Consigna §2: las puede hacer cualquiera de los dos administrativos, con reclamo previo. | No | `Material`: grupo candidato `:41-42`, reclamo `:44-46`, segundo reclamo rechazado con 409 `:48-50`. |
| 14 | `Lista` "Confeccionar lista definitiva" | `flowable:candidateGroups="administracion"`. | Que no quede sin responsable hasta que exista el Task Listener. | **Sí, fase de listeners Java:** `AsignarMenosCargadoListener` (evento `create`) la asigna al administrativo con menos tareas. | Despliega; fuera del camino probado. |

### Camino de viabilidad

| # | Elemento | Qué cambió | Por qué | Provisorio | Evidencia |
|---|---|---|---|---|---|
| 15 | `Activity_1xw400l` "Evaluar Viabilidad" | `businessRuleTask` → `serviceTask` con `flowable:expression="${execution.setVariable('viable', true)}"`. **El ícono cambia** de tabla de reglas a engranaje. Decidido con el usuario el 2026-11-03. | 1) En esta imagen, `businessRuleTask` no despliega: Flowable lo ejecuta con Drools, que no está (500 `NoClassDefFoundError: org/kie/api/runtime/rule/AgendaFilter`). Pasa lo mismo vacío, con listener o con `flowable:type="dmn"`. 2) La consigna (§3.1) pide una *decision task de flowable*, que en el XML de Flowable es `serviceTask flowable:type="dmn"`. Se probó: con 2 cursos dio `viable=true` y con 7, `viable=false`. Pasarla hoy a `serviceTask` deja el ícono definitivo, y en la fase 3 sólo cambia la implementación. | **Sí, fase 3 (regla DMN):** pasa a `flowable:type="dmn"` con la decisión `viabilidadCurso` y el listener `ContarCursosEnEjecucionListener`. Mientras tanto el camino "no viable" no se puede ejercitar. | `businessRuleTask`: `f-paso0.log:3-11`, `:24-27`. Con clase: `:13-16`. Decision task: `:29-49` (sin la variable de entrada da 500: `:50-52`). En el modelo: `g-camino-acuerdo.log:64`, `:23` (`viable: true`). |
| 16 | `Flow_0k38d9g` ("si") | Condición `${viable}`. | La compuerta exclusiva necesita una condición por flujo para elegir. | No | `g-camino-acuerdo.log:64-66`. |
| 17 | `Flow_0w8xn3l` ("no") | Condición `${!viable}`. | Ídem, el caso contrario. | No | No ejercitado: hoy `viable` siempre es `true` (entrada 15). |
| 18 | `Activity_0iibzwu` "Notificar Desición" | Script Groovy: `execution.setVariable('resultado', 'NO_VIABLE')` y un log. | El Execution Listener de fin necesita `resultado` en todo camino de cierre (§3.4). La notificación a la empresa se simula con el log. | No | No ejercitado (ver 17). Despliega. |

### Propuesta, envío y espera

| # | Elemento | Qué cambió | Por qué | Provisorio | Evidencia |
|---|---|---|---|---|---|
| 19 | `Propuesta` | Task Listener `complete` con expresión: `${task.setVariable('propuestaVersion', 1)}`. | Registra la primera versión al completarse la propuesta. `task.setVariable` sube hasta la instancia: la variable no queda local a la tarea. | No | `g-camino-acuerdo.log:23` (`propuestaVersion: 1`, a nivel instancia). |
| 20 | `Revisar` | Task Listener `complete`: `${task.setVariable('propuestaVersion', propuestaVersion + 1)}`. | Cada revisión es una versión nueva. | No | `g-camino-acuerdo.log:119` (1) → `:123` (2). |
| 21 | `Enviar` "Enviar propuesta" | `scriptFormat="groovy"`. Script: `execution.setVariable('recordatorios', 0)` y un log. | Consigna §1.1: el contador se reinicia con cada versión enviada. `Enviar` es el único punto por donde pasan la primera versión y todas las siguientes. | No | Pasa de 1 a 0: `g-camino-acuerdo.log:119` → `:123-124`. Log: `g-camino-acuerdo-logs-contenedor.log`. |
| 22 | `Recordatorio` "Enviar recordatorio" | `scriptFormat="groovy"`. Script: suma 1 a `recordatorios` y deja un log. | Lleva la cuenta que lee `Limite`. | No | `g-camino-acuerdo.log:110`, `:199` (`recordatorios: 2`). El log de algunas ejecuciones aparece en el contenedor `flowable-ui` (ver nota al final): `g-log-async-ui.log`. |
| 23 | `Rechazar` "Rechazo" | Execution Listener `end`: `${execution.setVariable('resultado', 'RECHAZADO')}`. | **Por qué en el evento:** es el único elemento exclusivo del camino de rechazo; `Archivar` es compartido con "sin respuesta" y no puede distinguirlos. **Por qué `end` y no `start`:** cuando el proceso llega a `Esperar`, Flowable **arranca los cuatro eventos de captura a la vez**, y `start` correría en todas las instancias aunque después gane otro evento. `end` corre sólo cuando llega el mensaje de rechazo: si gana otro evento, éste se cancela sin disparar `end`. | No | Los cuatro arrancan juntos: `g-camino-acuerdo.log:69-72`. Aceptación sin `resultado`: `:84`. Rechazo: `:168`, `:186`. |
| 24 | `SinRespuesta` (flujo "Sí" de `Limite`) | Execution Listener `take`: `${execution.setVariable('resultado', 'SIN_RESPUESTA')}`. | Es el único elemento exclusivo del camino "sin respuesta": `Plazo` y `Limite` también se recorren cuando sale un recordatorio. Se setea al tomar el flujo, es decir, después de que `Limite` decidió. | No | `g-camino-acuerdo.log:199`, `:232`. |
| 25 | `Plazo` "5 días" | Duración `P5D` → `${vars:getOrDefault('plazoRespuesta', 'P5D')}`. | Para probar sin editar el modelo. Con `${plazoRespuesta}` a secas, iniciar sin la variable da 500 (`Unknown property used in expression`). `vars:getOrDefault` usa la variable si existe y, si no, 5 días. Se eligió frente al ternario con `execution.getVariable`, que también funciona pero es menos legible. | No | `f-paso0.log:68-81` (directa), `:82-95` (getOrDefault). En el modelo: S3 sin variable vence a 5 días (`g-camino-acuerdo.log:161`); S4 con `PT10S` avanza solo (`:197`). |
| 26 | `Limite` (`SinRespuesta`, `OtroRecord`) | Sin cambios: ya tenían `${recordatorios >= 2}` y `${recordatorios < 2}`, y coinciden con el contrato. | — | — | `g-camino-acuerdo.log:215-229`. |
| 27 | `Activity_1eg7zcl` "Habilitar acceso de la empresa" | `scriptFormat="groovy"`. Script con un log. | Flowable no despliega una tarea de script sin script. Todavía no existe la BD de la institución. | **Sí, fase BD de la institución:** crea o reutiliza `cuenta_empresa` y vincula el curso. | `g-camino-acuerdo.log:73`. Log: `g-camino-acuerdo-logs-contenedor.log`. |

### Objetos de datos

| # | Elemento | Qué cambió | Por qué | Provisorio | Evidencia |
|---|---|---|---|---|---|
| 28 | `DatosPropuesta_Object`, `DatosInforme_Object`, `DatosLista_Object` | Se les dio `name`: "Propuesta y presupuesto", "Informe de resultados" y "Lista definitiva" (el de su referencia). Decidido con el usuario: se conservan, no se quitan. | Sin `name` no despliega (`flowable-data-object-missing-name`), y darles un nombre es el arreglo mínimo que conserva el diagrama. Efecto: crean variables nulas con ese nombre, las dos primeras al iniciar y "Lista definitiva" local a `Preparar`. Las asociaciones de datos y sus `__targetRef_placeholder` despliegan y no hacen nada; al desplegar, Flowable avisa que no las encuentra en el diagrama (warnings `flowable-di-invalid-reference`, no bloquean). | No | Error: `f-sonda-original.log:3`. Variables: `f-dataobjects.log:9`, `:20-24`; `g-camino-acuerdo.log:23`. Warnings: `g-warnings-despliegue.log`. |

### Arreglos mínimos fuera de alcance (sin ellos el modelo no despliega)

| # | Elemento | Qué cambió | Por qué | Provisorio | Evidencia |
|---|---|---|---|---|---|
| 29 | `Aula` "Reservar aula" | `flowable:expression="${true}"` (no hace nada). | Flowable exige una implementación en toda tarea de servicio (`flowable-servicetask-missing-implementation`). | **Sí, fase X2:** `ReservarAulaDelegate`. | `f-sonda-original.log:3`. |
| 30 | `Activity_16zz91p` "Liberar Aula" | `flowable:expression="${true}"`. | Ídem. | **Sí, fase X2:** `LiberarAulaDelegate`. | Ídem. |
| 31 | `Activity_02hrooc` "Liberar Aula Virtual" | `scriptFormat="groovy"` y un script que sólo deja un log. | No despliega una tarea de script sin script (`flowable-scripttask-missing-script`). | **Sí, fase X2.** | Ídem. |
| 32 | `Confirmar` "Enviar confirmación" | Ídem. | Ídem. | **Sí, fase X2.** | Ídem. |
| 33 | `Activity_12e0et1` "Notificar Cierre" | Ídem. | Ídem. | **Sí, fase X2.** | Ídem. |

Quedan sin tocar, como se pidió: `Event_0farfur`, `Event_1rvo4k6`, `Event_0snigbc`, `Fin` y la estructura de `Preparar`.

### Nota: dos motores toman los jobs

`flowable-ui` trae su propio motor y su propio ejecutor asíncrono sobre la misma base de datos. Los timers, y lo que corre después de ellos (por ejemplo, *Enviar recordatorio*), los ejecuta **cualquiera de los dos contenedores**. El proceso funciona igual, pero el log de esos scripts puede salir en `flowable-ui`. Cuando haya clases Java, tendrán que estar en los dos contenedores, o habrá que apagar el ejecutor de `flowable-ui`. Evidencia: `g-log-async.log` (`flowable-rest`) y `g-log-async-ui.log` (`flowable-ui`), mismo proceso y vueltas alternadas. Pendiente de decisión: implica cambiar `docker-compose.yml`.
