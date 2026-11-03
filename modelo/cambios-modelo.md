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
| 15 | `Activity_1xw400l` "Evaluar Viabilidad" | `businessRuleTask` → `serviceTask` (primero con una expresión provisoria `viable = true`; **la entrada 34 la reemplaza por la regla DMN**). **El ícono cambia** de tabla de reglas a engranaje. Decidido con el usuario el 2026-11-03. | 1) En esta imagen, `businessRuleTask` no despliega: Flowable lo ejecuta con Drools, que no está (500 `NoClassDefFoundError: org/kie/api/runtime/rule/AgendaFilter`). Pasa lo mismo vacío, con listener o con `flowable:type="dmn"`. 2) La consigna (§3.1) pide una *decision task de flowable*, que en el XML de Flowable es `serviceTask flowable:type="dmn"`. Se probó: con 2 cursos dio `viable=true` y con 7, `viable=false`. Pasarla hoy a `serviceTask` deja el ícono definitivo, y en la fase 3 sólo cambia la implementación. | No: la provisoriedad terminó en la fase 3 (entrada 34). | `businessRuleTask`: `f-paso0.log:3-11`, `:24-27`. Con clase: `:13-16`. Decision task: `:29-49` (sin la variable de entrada da 500: `:50-52`). En el modelo: `g-camino-acuerdo.log:64`, `:23` (`viable: true`). |
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

### Fase 3: regla DMN de viabilidad (2026-11-03)

| # | Elemento | Qué cambió | Por qué | Provisorio | Evidencia |
|---|---|---|---|---|---|
| 34 | `Activity_1xw400l` "Evaluar Viabilidad" | Pasa a `flowable:type="dmn"`, con el campo `decisionTableReferenceKey = viabilidadCurso` y un Execution Listener `start` con la clase `unrc.cursos.ContarCursosEnEjecucionListener`. Se quitaron la expresión provisoria y su comentario `PROVISORIO`. **El tipo de elemento y el diagrama no cambian** (sigue siendo `serviceTask`, mismo ícono). | Consigna §3.1: decision task de Flowable. Su entrada la calcula el motor (el listener, antes de evaluar la tabla) y nunca se ingresa a mano. | No | Casos 1 a 4: `i-viabilidad.log:20`, `:83`, `:100`, `:116`. |
| 35 | `modelo/viabilidadCurso.dmn` (archivo nuevo) | Decisión `viabilidadCurso`: entrada `cursosEnEjecucion` (número), salida `viable` (booleano); `< 5` → `true`, `>= 5` → `false` (política `FIRST`). Sin comentario antes del elemento raíz. | Es la regla de negocio de la consigna §3.1. Se despliega aparte por la API DMN, antes de iniciar instancias. | No | Despliegue: `i-viabilidad.log:3`. |
| 36 | `src/main/java/unrc/cursos/ContarCursosEnEjecucionListener.java`, `pom.xml` (`finalName`), `docker-compose.yml` (volumen del JAR en `flowable-rest` y `flowable-ui`) | Clase nueva que cuenta las instancias sin finalizar de `Process_Curso` (todas las versiones) y excluye la propia por id. El JAR se monta en los dos contenedores. | La consigna exige que el motor obtenga la cantidad. Resuelve las decisiones abiertas 1 y 4 del Contrato (§9). Se descartó un script Groovy porque usaba una clase interna del motor. | No | 4 tests JUnit (`mvn test`). Montaje: `Contrato.md` §11.23. |

Pruebas por REST (`pruebas-flowable/i-viabilidad.js`, desde Flowable limpio, iniciando por el mensaje "Solicitud de curso"): 0 otras → `cursosEnEjecucion = 0`, sigue a `Propuesta` (`:20`); 4 otras en dos versiones desplegadas, con una terminada que no cuenta → `4`, sigue (`:83`); 5 otras → `5`, `NO_VIABLE` y fin en `Event_18edb9q` (`:100`); 5 otras con `cursosEnEjecucion = 0` pasado a mano → se ignora, `5` y `NO_VIABLE` (`:116`). La instancia propia no aparece en la consulta (por eso se excluye por id y no se resta 1): `Contrato.md` §11.21.

### Integración con las clases Java y la BD (2026-11-03)

| # | Elemento | Qué cambió | Por qué | Provisorio | Evidencia |
|---|---|---|---|---|---|
| 37 | `Activity_1eg7zcl` "Habilitar acceso de la empresa" | De `scriptTask` (sólo un log) a `serviceTask flowable:class="unrc.cursos.HabilitarAccesoEmpresaDelegate"`. Cambia el tipo de elemento; el diagrama y los IDs no. | Consigna 4.1.2: crea o reutiliza la cuenta en `cuenta_empresa`. Una tarea de script no puede invocar un `JavaDelegate` (`Contrato.md` §8). Modificación menor a mencionar en el informe. | No | `k-integracion.log`: cuenta `emp_30722334456` creada para la empresa 2; la empresa 1 conserva su única cuenta. |
| 38 | `Lista` "Confeccionar lista definitiva" | Task Listener `create`: `unrc.cursos.AsignarMenosCargadoListener`. Conserva `candidateGroups="administracion"`. Se quitó el comentario `PROVISORIO`. | Consigna 3.2: la asigna al administrativo con menos tareas asignadas pendientes. | No | `k-integracion.log`: con 2 tareas asignadas a `jefeAdmin`, `Lista` queda en `admin2`. |
| 39 | `Aula` | `flowable:expression="${true}"` → `flowable:class="unrc.cursos.ReservarAulaDelegate"`. | Lanza `BpmnError("SIN_AULAS")` si `simularFaltaAulas` (escenario 7); si no, guarda `aulaAsignada`. | No | `aulaAsignada = Aula Magna Principal`; con `simularFaltaAulas=true` llega a `Activity_12e0et1`. |
| 40 | `Activity_16zz91p` "Liberar Aula" | `flowable:expression="${true}"` → `flowable:class="unrc.cursos.LiberarAulaDelegate"`. | Manejador de compensación de `Aula`. | **Sí, fase X2:** no se probó porque la compensación no se alcanza aún (§11.5). | — |
| 41 | `Activity_02hrooc` "Liberar Aula Virtual" | De `scriptTask` (log) a `serviceTask flowable:class="unrc.cursos.LiberarAulaVirtualDelegate"`. | Ídem para `Virtual`. | **Sí, fase X2:** ídem. | — |
| 42 | Proceso `Process_Curso` | Execution Listener `end`: `unrc.cursos.ActualizarEstadoCursoListener`. | Consigna 3.3: al terminar la instancia pasa `resultado` a `curso.estado`. | No | `NO_VIABLE` no se probó en esta tanda (sí en la fase 4); `CANCELADO` y `RECHAZADO` actualizan `curso.estado`. |
| 43 | `Activity_12e0et1` "Notificar Cierre" | El script setea además `resultado = 'CANCELADO'`. | Cada camino de cierre debe setear `resultado` (consigna 3.3). Este camino hoy sólo lo recorre la falta de aulas. | **Sí, fase X2:** al llegar `GwCancelado` lo setearán los inicios de los subprocesos de eventos. | `k-integracion.log` (B): `resultado = CANCELADO`, `curso.estado = CANCELADO`. |
| 44 | `EnviarInforme` | Task Listener `complete`: `${task.setVariable('resultado', 'FINALIZADO')}`. | Cierre normal (`Contrato.md` §6). | No | Sin probar de punta a punta: depende de que `Preparar` termine (fase X2). |

Pruebas (`pruebas-flowable/k-integracion.js`, contra el entorno completo): A) empresa sin cuenta, hasta `Preparar`: cuenta creada, `Lista` a `admin2`, aula reservada; B) falta de aulas con empresa que ya tiene cuenta: reutiliza la cuenta, `CANCELADO`; C) rechazo: `RECHAZADO`.

**Hallazgo (fase X2, ya documentado en `Contrato.md` §11.5):** al completarse todas las tareas de `Preparar`, la instancia llega a `SubFin` pero `Preparar` no termina y el proceso queda detenido (sin tareas ni jobs). Es el efecto de tener un evento de borde (`Event_0farfur`) y un subproceso de eventos (`Activity_048d5em`) en el mismo subproceso. No se tocó: es el rediseño X2, a hacer con el OK explícito del usuario.

### Fase X2: cancelación, falta de aulas y fin con compensación (2026-11-03)

Con el OK explícito del usuario. Diseño X2 + opción B de `Contrato.md` §4. Pruebas: `pruebas-flowable/k-integracion.js` (escenarios A, B y D).

| # | Elemento | Qué cambió | Por qué | Provisorio | Evidencia |
|---|---|---|---|---|---|
| 45 | `Msg_pendienteX2` (mensaje) | Borrado. `Event_1g4xmqo` ahora referencia `Msg_cancel` ("Cancelación"). | El mensaje provisorio sólo existía porque Flowable no despliega un evento de mensaje sin `messageRef`. | No | D: el simulador ofrece "Cancelar durante la preparacion" y la instancia lo recibe. |
| 46 | `Activity_048d5em` "Cancelación" (subproceso de eventos) | Se quitó el lanzamiento de compensación `Event_1rvo4k6`; `Event_0snigbc` pasa de fin con error a **fin simple**. El inicio `Event_1g4xmqo` suma dos Execution Listeners `end` (expresión): `resultado = CANCELADO` y `motivoCancelacion = EMPRESA`. | Un lanzamiento de compensación sin `activityRef` dentro del subproceso de eventos no compensa nada (§11.1) y el fin con error dependía del borde que se quita. Las compensaciones pasan a lanzarse fuera de `Preparar`. | No | D: `motivoCancelacion = EMPRESA`, `resultado = CANCELADO`. |
| 47 | `Event_0farfur` (borde de error de `Preparar`) y flujo `Flow_1ymw5qe` | Eliminados. | Un borde sobre `Preparar` con un subproceso de eventos adentro impide que `Preparar` termine por su camino normal (§11.5): era el bloqueante hallado en la integración. | No | A: `Preparar` termina y el curso llega a `Fin`. |
| 48 | `FaltaAulas` (nuevo, subproceso de eventos de error dentro de `Preparar`) con `InicioFaltaAulas` (`errorRef="Err_sinAulas"`) y `FinFaltaAulas`; nuevo `<error id="Err_sinAulas" errorCode="SIN_AULAS"/>` | Atrapa el `BpmnError("SIN_AULAS")` de `ReservarAulaDelegate`. El inicio setea `resultado = CANCELADO` y `motivoCancelacion = SIN_AULAS`. **`FinFaltaAulas` es un fin de terminación** (`terminateEventDefinition`). | El camino de falta de aulas debe liberar lo ya gestionado como la cancelación. Sin la terminación, el subproceso de error atrapa el error pero deja vivas las ramas paralelas de `Preparar` (`Nomina`, `Material`) y la instancia queda colgada (probado). | No | B: la instancia llega a `Notificar Cierre` y termina `CANCELADO`. |
| 49 | `GwCancelado` (nuevo, compuerta exclusiva) | Sale de `Preparar` (`Preparado` ahora apunta acá). "Sí" (`SiCancelado`, `resultado == 'CANCELADO'`) → `CompensarCancelacion`; "No" (`NoCancelado`, por defecto) → `Confirmar`. | Separa el cierre normal del cancelado. | No | A (por "No") y B/D (por "Sí"). |
| 50 | `CompensarCancelacion` (nuevo, lanzamiento intermedio de compensación sin `activityRef`) → `GwHayEquipo` | Compensa los recursos de `Preparar` que terminaron. | Consigna: la cancelación compensa sólo los recursos ya gestionados. | No | D: corre *Liberar Aula Virtual* (no *Liberar Aula*, que no se reservó) y crea la tarea *Liberar Equipamiento*. |
| 51 | `GwHayEquipo` (nuevo), `EsperarLiberacion` (nuevo, tarea de recepción), flujos `ConEquipo`, `SinEquipo`, `LiberacionLista` | "Sí" (`equipamientoContratado == true`) → `EsperarLiberacion` → `Activity_12e0et1`; "No" (por defecto) → `Activity_12e0et1`. | Opción B elegida por el usuario: *Notificar Cierre* debe ocurrir después de *Liberar Equipamiento*, y el lanzamiento de compensación no espera a una tarea de usuario (§11.3). | No | D: *Notificar Cierre* no corre hasta completar *Liberar Equipamiento*; entonces termina. |
| 52 | `Activity_1m08pcl` "Liberar Equipamiento" | Task Listener `complete`: `unrc.cursos.AvisarLiberacionEquipamientoListener` (clase nueva, 3 tests). | Destraba `EsperarLiberacion` (`runtimeService.trigger`). En el fin normal no hay nadie esperando y no hace nada. | No | D, y `AvisarLiberacionEquipamientoListenerTest`. |
| 53 | `Equipo` "Contratar equipamiento" | Execution Listener `end` (expresión): `equipamientoContratado = true`. | Lo lee `GwHayEquipo`. | No | D (con equipamiento); A y B (sin la variable, el flujo por defecto). |
| 54 | `Activity_12e0et1` "Notificar Cierre" | Se quitó el `resultado = CANCELADO` del script (ahora lo setean los inicios, porque `GwCancelado` lo necesita antes); el log incluye `motivoCancelacion`. Se quitó el comentario `PROVISORIO`. Reemplaza al cambio 43. | `resultado` debe estar seteado antes de `GwCancelado`. | No | B y D. |
| 55 | `Fin` y `CompensarFin` (nuevo) | `Fin` pasa de fin con compensación a **fin simple** "Curso finalizado"; `InformeArchivar` va ahora a `CompensarFin` (lanzamiento intermedio de compensación sin `activityRef`) → `FinCompensado` → `Fin`. | Flowable ignora el fin con compensación (§11.2). | No | A: corren *Liberar Aula* y *Liberar Aula Virtual*, el proceso espera *Liberar Equipamiento* y termina con `curso.estado = FINALIZADO`. |
| 56 | `Confirmar` | Se quitó el comentario `PROVISORIO` (sólo log, decisión vigente: la confirmación se simula). | — | No | A. |

Con esto, los cambios 29 a 33 dejan de ser provisorios: `Aula`, `Activity_16zz91p` y `Activity_02hrooc` ya usan sus delegates (cambios 39 a 41); `Confirmar` y `Activity_12e0et1` quedan como logs por decisión (el envío real a la empresa se simula). La liberación del aula y del aula virtual en el fin normal se verificó en A. Cambio 43 reemplazado por el 54.

Diagrama: se agregaron formas y aristas para los elementos nuevos y se quitaron las de los eliminados; **no se abrió en Yaoqiang** todavía (regla de Yaoqiang: abrir sólo para ver).

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
