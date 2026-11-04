---
title: "Organización de cursos de capacitación en Flowable — Informe breve"
subtitle: "Gestión y Tecnologías de Procesos de Negocio (UNRC)"
---

# Informe: variables, listeners y decisiones de implementación

Este informe describe cómo quedó implementado el proceso `Process_Curso` en Flowable 6.8.0. Cada dato se puede rastrear al repositorio: el modelo (`modelo/Proyecto_Organizacion_cursos.bpmn20.xml`, que manda ante cualquier conflicto de nombres), la regla DMN (`modelo/viabilidadCurso.dmn`), las clases Java (`src/main/java/unrc/cursos/`), la BD (`db/`) y el registro de cada cambio al diagrama de referencia (`modelo/cambios-modelo.md`, 63 entradas); todo lo que se aparta de la consigna está reunido en `informe/licencias-consigna.md`. Cómo instalar y ejecutar todo está en `README.md`; las pruebas, en `pruebas-flowable/` y en la sección 5.

## 1. Arquitectura

```
                         ┌──────────────────────────────────────────────┐
  Sitio web (web/)  ───► │  Flowable REST   :8080/flowable-rest/service │ ◄─── Simulador CLI de la empresa
  (API REST)             │  (motor + DMN + ejecutor de jobs)            │      (API REST, SimuladorMain)
                         │       ▲  JAR propio: cursos-flowable.jar     │
                         ├───────┼──────────────────────────────────────┤
  Flowable UI  ────────► │  Flowable UI     :8081/flowable-ui           │      Tareas: Solicitar aula virtual,
  (tareas sin pantalla   │  (otro motor + ejecutor de jobs, mismo JAR)  │      Contratar y Liberar equipamiento
   propia en el sitio)   └───────┬───────────────────────────┬──────────┘
                                 │                           └──► SMTP falso (DevNullSmtp, :25 de la máquina):
                                 │                                avisos por correo a la empresa
                                 │ JDBC
              ┌──────────────────┴─────────────────────┐        App de escritorio (Swing)
              │ PostgreSQL 16 :5432                    │ ◄───── "Preparar materiales"
              │  · BD "flowable"    (esquema del motor)│        API Java de Flowable, directo
              │  · BD "institucion" (empresa,          │        a la BD "flowable"
              │    cuenta_empresa, curso)              │
              └────────────────────────────────────────┘
```

- **Dos motores sobre la misma BD.** La imagen `flowable-rest` y la `flowable-ui` traen cada una su motor y su ejecutor asíncrono. Los timers (y lo que corre después) los ejecuta cualquiera de los dos; por eso el JAR con nuestras clases se monta en **los dos** contenedores (`docker-compose.yml`). Comprobado: en una misma instancia, un recordatorio salió en un contenedor y el siguiente en el otro (`Contrato.md` §11.27).
- **BD de la institución** (`db/schema.sql`): `empresa`, `cuenta_empresa` y `curso` (nombre, descripción, programa, presupuesto, fechas, informe, `estado` y `process_instance_id`, que vincula el curso con su instancia). Participantes y recursos viven como variables del proceso.
- **Usuarios**: 5 usuarios y 2 grupos (`administracion`, `docentes`) creados en Flowable por `scripts/crear-usuarios`. El personal ingresa con sus credenciales de Flowable; la BD de la institución no tiene cuentas para ellos, sólo para las empresas.

## 2. Variables del proceso

Verificadas contra el modelo real. "Escribe" y "lee" indican el elemento del modelo o la aplicación externa.

| Variable | Escribe | Lee | Significado |
|---|---|---|---|
| `cursoId`, `empresaId` | quien inicia (sitio web) | `HabilitarAccesoEmpresaDelegate` (`empresaId`); el sitio | Curso y empresa en la BD de la institución |
| `cursosEnEjecucion` | `ContarCursosEnEjecucionListener` | tabla DMN `viabilidadCurso` | Otras instancias sin finalizar |
| `viable` | `Evaluar Viabilidad` (salida DMN) | `Gateway_10gftrn` | `true` si `cursosEnEjecucion < 5` |
| `propuestaVersion` | Task Listener de `Propuesta` (=1) y de `Revisar` (+1) | `Revisar`, aviso por correo | Versión vigente de la propuesta |
| `observaciones` | mensaje "Solicitud de modificaciones" | `Revisar` (el jefe las lee) | Pedido de cambios |
| `recordatorios` | `Enviar` al completarse (=0), `Recordatorio` (+1) | `Limite` (`>= 2` cierra) | Contador, reiniciado con cada versión enviada |
| `plazoRespuesta` | quien inicia (opcional) | timer `Plazo` (`${vars:getOrDefault('plazoRespuesta','P5D')}`) | Plazo de espera; permite probar con `PT20S` sin editar el modelo |
| `fechaCurso` | mensaje "Aceptación" | timer `Fecha` (`${fechaCurso}`) | Fecha acordada; el timer no tiene fecha fija |
| `participantes` | `Recibir nómina` (señal de la empresa) | sitio / `Lista` | Nómina en JSON |
| `requiereAula`, `requierePlataforma`, `requiereEquipamiento` | `Evaluar Recursos` | compuerta inclusiva `OrInicio` | Recursos a gestionar (al menos uno) |
| `aulaAsignada` | `ReservarAulaDelegate` | sitio | Aula reservada |
| `aulaLiberada`, `aulaVirtualLiberada` | `LiberarAulaDelegate`, `LiberarAulaVirtualDelegate` | pruebas | Marca de que corrió la compensación |
| `equipamientoContratado` | Execution Listener de fin de `Contratar equipamiento` | `GwHayEquipo` | Sólo existe si se contrató |
| `simularFaltaAulas` | quien inicia (opcional) | `ReservarAulaDelegate` | Fuerza el escenario 7 |
| `motivoCancelacion` | inicios de `Cancelación` (`EMPRESA`) y `FaltaAulas` (`SIN_AULAS`) | texto de `Notificar Cierre` | Causa del cierre |
| `docenteSeleccionado` | `Definir Docente…` | `Desarrollar curso` (`assignee="${docenteSeleccionado}"`) | Usuario que dicta |
| `informePdf` | `Elaborar informe de resultados` | sitio | ID del informe en la BD |
| `estadoCurso` | listeners por expresión en 8 puntos (abajo) | sitio (vista de la empresa) | Estado en vivo del curso |
| `resultado` | cada camino de cierre (abajo) | `GwCancelado`; `ActualizarEstadoCursoListener` | `FINALIZADO`, `CANCELADO`, `RECHAZADO`, `SIN_RESPUESTA` o `NO_VIABLE` |

Quién setea `resultado`: `Notificar Desición` (`NO_VIABLE`); el evento `Rechazo` (`RECHAZADO`); el flujo `SinRespuesta` de la compuerta `Limite` (`SIN_RESPUESTA`); los inicios de los subprocesos de eventos de cancelación y falta de aulas (`CANCELADO`); y `Enviar informe…` (`FINALIZADO`). Se hace en cada camino porque `Archivar` y el fin de cancelación son compartidos y no sabrían cuál fue el origen.

`estadoCurso` recorre `EN_ACUERDO` (al crearse `Propuesta`) → `EN_PREPARACION` (al entrar a `Preparar`) → `CONFIRMADO_PENDIENTE_INICIO` (al enviar la confirmación) → `EN_DESARROLLO` (al crearse `Desarrollar curso`) → `ELABORANDO_INFORME` (al completarla) → `FINALIZADO`; o `CANCELADO` en cuanto entra la cancelación o la falta de aulas. Los cierres `NO_VIABLE`, `RECHAZADO` y `SIN_RESPUESTA` se ven en `curso.estado` (BD).

Observaciones: (a) los tres `dataObject` del diagrama original se conservan, con `name` (Flowable no despliega sin él), y crean variables nulas sin uso; (b) las variables que escriben las aplicaciones externas (`cursoId`, `empresaId`, `fechaCurso`, `participantes`, `requiere*`, `docenteSeleccionado`, `informePdf`) no tienen formulario en el modelo: viajan al completar la tarea o al enviar el mensaje.

## 3. Listeners y delegates

Todas las clases están en `unrc.cursos` y van en un único JAR. Las que tocan la BD de la institución leen `INSTITUCION_DB_URL/USER/PASS` del entorno del contenedor.

| Clase | Qué hace | Dónde está conectada (evento) | Cómo se probó |
|---|---|---|---|
| `ContarCursosEnEjecucionListener` (Execution Listener) | Cuenta las instancias de `Process_Curso` (todas las versiones, por clave) sin finalizar, **excluyendo la propia por ID**, y guarda `cursosEnEjecucion`. Obtiene el servicio con `ProcessEngines.getDefaultProcessEngine()`: en `flowable-rest` no existe el bean `runtimeService` en las expresiones. | `Evaluar Viabilidad` (`Activity_1xw400l`), evento `start` | 4 tests unitarios (H2); `i-viabilidad.js`; escenario 5 |
| `AsignarMenosCargadoListener` (Task Listener) | Para cada miembro del grupo `administracion` cuenta las tareas **asignadas** pendientes (las que sólo tienen grupo candidato no cuentan) y asigna a quien tenga menos; empate: orden alfabético del ID. | `Confeccionar lista definitiva` (`Lista`), evento `create` | 6 tests (carga, empate, sólo-grupo, otros eventos); `k-integracion.js` A (con `jefeAdmin` cargado, va a `admin2`) |
| `ActualizarEstadoCursoListener` (Execution Listener) | Lee `resultado` y hace `UPDATE curso SET estado = ? WHERE process_instance_id = ?`; si no encuentra fila, busca el curso por `cursoId` (sólo si todavía no tiene instancia): un curso no viable termina dentro del `POST` de inicio, antes de que el sitio guarde el vínculo. Si falta `resultado` asume `FINALIZADO` (por eso cada cierre lo setea). | Proceso `Process_Curso`, evento `end` | 12 tests; escenarios 1 a 7 verifican `curso.estado` |
| `HabilitarAccesoEmpresaDelegate` (JavaDelegate) | Si la empresa ya tiene fila en `cuenta_empresa` la reutiliza; si no, crea usuario `emp_<cuit>` (clave simulada). Falla si `empresaId` no existe. | `Habilitar acceso de la empresa` (`Activity_1eg7zcl`) | `HabilitarAccesoEmpresaTest`; `k-integracion.js` A (crea) y B (reutiliza) |
| `ReservarAulaDelegate` | Simula el web service de aulas: guarda `aulaAsignada`; con `simularFaltaAulas=true` lanza `BpmnError("SIN_AULAS")`. | `Reservar aula` (`Aula`) | Escenario 7 |
| `LiberarAulaDelegate`, `LiberarAulaVirtualDelegate` | Manejadores de compensación: marcan `aulaLiberada` / `aulaVirtualLiberada`. | `Liberar Aula`, `Liberar Aula Virtual` (`isForCompensation`) | Escenarios 1 y 6 (sin test unitario) |
| `NotificarEmpresaDelegate` (JavaDelegate y Execution Listener, campo `tipo`) | Busca el `contacto_email` de la empresa (`empresaId`) y le manda un correo por SMTP (`SMTP_HOST`/`SMTP_PORT`). Tipos: `PROPUESTA`, `RECORDATORIO`, `NO_VIABLE`, `CONFIRMACION`, `CIERRE`, `INFORME`. Si no hay servidor o la empresa no tiene correo, **no falla el proceso**: lo deja en el log. | Como servicio en `Enviar recordatorio`, `Notificar Desición`, `Enviar confirmación` y `Notificar Cierre`; como listener `end` en `Enviar propuesta` y `Enviar informe…` | 5 tests con un SMTP simulado; escenarios 1, 2, 4, 5, 6 y 7 (15 correos recibidos) |
| `AvisarLiberacionEquipamientoListener` (Task Listener) | Si hay una ejecución esperando en `EsperarLiberacion`, la destraba con `runtimeService.trigger`; si no (fin normal), no hace nada. | `Liberar Equipamiento`, evento `complete` | 3 tests; escenario 6 |

Además hay listeners por **expresión** (sin clase): `propuestaVersion` en `Propuesta`/`Revisar`, `resultado` en `Rechazo`, `SinRespuesta` y los inicios de cancelación y falta de aulas, y `equipamientoContratado` en `Contratar equipamiento`.

Apps externas ya hechas: el **simulador CLI** (`simulador/`) muestra sólo las comunicaciones habilitadas (consulta `event-subscriptions` y ejecuciones de la instancia) y envía con `PUT /runtime/executions/{id}`; la **app Swing** (`escritorio/`) usa `ServicioTareas` (API Java): autentica con el usuario de Flowable, lista las tareas *Preparar materiales* propias o reclamables, y exige reclamar antes de completar.

## 4. Decisiones de implementación y modificaciones al diagrama

La consigna permite "modificaciones menores, siempre que se justifiquen". Agrupadas por tema (detalle y evidencia en `modelo/cambios-modelo.md`):

1. **Regla de viabilidad como *decision task* real.** El diagrama usa una `businessRuleTask`, pero en esta imagen no despliega (Flowable la ejecuta con Drools, que no está: 500 `NoClassDefFoundError`). Se reemplazó por `serviceTask flowable:type="dmn"` con `decisionTableReferenceKey = viabilidadCurso`, que es la *decision task* de Flowable. El `.dmn` se despliega aparte por `/dmn-api/` **antes** de iniciar instancias. La entrada la calcula el motor (listener), nunca se ingresa a mano; un valor pasado a mano se pisa. (Cambios 15, 34 a 36.)
2. **Tareas de script que pasaron a tarea de servicio.** Una tarea de script no puede invocar un `JavaDelegate`; `Habilitar acceso de la empresa` y `Liberar Aula Virtual` pasaron a `serviceTask` con su clase. El diagrama visual y los IDs no cambian. (37, 41.)
3. **`Enviar propuesta` es tarea del jefe administrativo.** El diagrama la dibuja automática, pero la consigna (§1.1 y §2) dice que la envía el jefe: es una tarea de usuario asignada a `jefeAdmin`. Al completarse reinicia `recordatorios` (es el único punto por donde pasan la primera versión y cada versión nueva) y avisa por correo a la empresa.
4. **Plazos configurables.** El timer `Plazo` usa `${vars:getOrDefault('plazoRespuesta','P5D')}`: 5 días por defecto, y las pruebas lo acortan sin tocar el modelo. El timer `Fecha` usa `${fechaCurso}` (sin fecha fija).
5. **Mensajes.** Se quitaron 12 mensajes que ningún elemento referenciaba (restos de otra versión del enunciado). Los mensajes de la empresa son `PUT … messageEventReceived` por nombre ("Aceptación", "Rechazo", "Solicitud de modificaciones", "Cancelación"); la nómina es una tarea de recepción que se completa con la señal `signal`.
6. **Cancelación, falta de aulas y fin con compensación (rediseño, fase "X2").** El diseño original no funciona en Flowable 6.8.0 (verificado con modelos mínimos, `Contrato.md` §11.1 a 11.7): el lanzamiento de compensación sin `activityRef` dentro de un subproceso de eventos no compensa nada; el subproceso de eventos interrumpiente borra los eventos de borde de su contenedor (la instancia se traba); un subproceso con borde y subproceso de eventos no termina por su camino normal; el *fin con compensación* se ejecuta como fin simple; y el lanzamiento de compensación no espera a las tareas de usuario. Diseño que sí funciona:
   - `Cancelación` (mensaje `Msg_cancel`) y `FaltaAulas` (error `SIN_AULAS`) son subprocesos de eventos **interrumpientes dentro de `Preparar`**; el segundo termina con un **fin de terminación** (sin él las ramas paralelas quedan vivas y la instancia se cuelga) y el primero con fin simple. Ambos setean `resultado = CANCELADO` y `motivoCancelacion`.
   - Se eliminó el borde de error sobre `Preparar`. Al terminar `Preparar` por su camino normal, la compuerta `GwCancelado` separa el cierre normal (`Confirmar`) del cancelado.
   - Cancelado: `CompensarCancelacion` (lanzamiento de compensación sin `activityRef`, a nivel de proceso) corre *Liberar Aula* y *Liberar Aula Virtual* **sólo si esos recursos terminaron**, y crea la tarea *Liberar Equipamiento*. Como el lanzamiento no la espera, `GwHayEquipo` ("¿se contrató equipamiento?") lleva a `EsperarLiberacion` (tarea de recepción) que destraba `AvisarLiberacionEquipamientoListener`; así *Notificar Cierre* ocurre **después** de todas las compensaciones, como pide la consigna §1.3. La falta de aulas usa el mismo camino y también libera lo ya gestionado.
   - Fin normal: `Fin` deja de ser un fin con compensación y pasa a ser `CompensarFin` (lanzamiento de compensación sobre `Preparar`, ya terminado) seguido de un fin simple. Verificado: el proceso no termina hasta completar *Liberar Equipamiento*, y el listener de fin corre después.
7. **Usuarios y asignaciones.** `Propuesta`, `Revisar`, `Archivar` y `Enviar informe…` asignadas a `jefeAdmin`; `Definir docente` e `Informe` a `jefeDocente`; `Desarrollar curso` a `${docenteSeleccionado}`; `Lista`, `Material`, `Evaluar Recursos`, `Virtual`, `Equipo` y `Liberar Equipamiento` con grupo candidato `administracion`. **El motor no obliga a reclamar** (cualquier usuario con acceso REST completa una tarea de grupo sin reclamarla); esa regla la hacen cumplir el sitio y las apps. *Evaluar Recursos* exige mandar las tres banderas y al menos una `true`: si no, el motor responde 500 y deshace todo, por lo que el sitio lo valida antes de enviar.
8. **Un JAR único en los dos contenedores.** Se descartó un servicio Spring Boot propio (habría que reimplementar la API REST que ya trae la imagen). `mvn package` genera `target/cursos-flowable.jar`; `docker-compose.yml` lo monta en `/app/WEB-INF/lib/` de `flowable-rest` y `flowable-ui`. Si el archivo no existe al hacer `up`, Docker crea un directorio con ese nombre; si se recompila con los contenedores arriba, hay que reiniciarlos.
9. **Yaoqiang.** El modelo se edita a mano. Yaoqiang conserva las extensiones `flowable:` pero deja el `<definitions>` sin namespace (el despliegue falla), borra los comentarios y cambia IDs, de modo que sólo se usa para ver.
10. **Fuera de alcance por ser opcional (texto azul de la consigna).** No se genera el PDF de la propuesta ni de su revisión; el informe de resultados sí lleva PDF. Se mantuvo el acceso de las empresas porque el escenario 10 de la defensa lo exige. Los avisos a la empresa (propuesta, recordatorio, no viable, confirmación, cierre, informe) son correos reales al SMTP falso de la máquina; el correo nunca hace fallar el proceso. Todas las tareas de script pasaron a servicio por eso. El resto de las licencias, con su motivo, está en `informe/licencias-consigna.md`.

## 5. Cómo se probó

- **Unitarias**: `mvn test` (JUnit 5, H2 en memoria; no necesita Docker). Cubren los listeners, el detector de acciones del simulador y el servicio de la app Swing. Resultado de la última corrida: sección 6.
- **Por REST contra el entorno real** (scripts de `scripts/escenarios/`): cada hallazgo de Flowable de `Contrato.md` §11 sale de una corrida con las llamadas y respuestas guardadas.
- **Recorrido de la defensa**: `scripts/escenarios/m-escenarios.js` ejecuta los escenarios 1 a 7 y 11 contra el entorno levantado desde cero y emite PASS/FAIL con evidencia (`resultado`, `curso.estado`, actividades recorridas). El escenario 11 usa el **simulador CLI real** (entrada estándar guionada) y la clase `ServicioTareas` de la app Swing a través de un lanzador sin interfaz. Los escenarios 8, 9 y 10 dependen del sitio web y tienen su guion manual en `informe/checklist-manual.md`.
- Resultado de la corrida: secciones 6 y 7.

## 6. Resultado de la corrida

`mvn test`: 45 tests, 0 fallas. `node scripts/escenarios/m-escenarios.js` (log: `scripts/escenarios/resultados/m-escenarios.log`), con el entorno levantado y un SMTP de prueba en el puerto 25:

| Escenario | Resultado | Evidencia mínima |
|---|---|---|
| 1 Aceptación y fin normal con liberación | PASS | `resultado` y `curso.estado` = `FINALIZADO`; `estadoCurso` recorre `EN_PREPARACION` → `CONFIRMADO_PENDIENTE_INICIO` → `EN_DESARROLLO` → `ELABORANDO_INFORME` → `FINALIZADO`; *Liberar Aula* y *Liberar Aula Virtual* corrieron; el proceso no terminó hasta completar *Liberar Equipamiento*; cuenta de la empresa 2 creada; `Lista` a `admin2`; correos de propuesta, confirmación e informe |
| 2 Modificaciones y nueva propuesta | PASS | `propuestaVersion` 1 → 2; *Enviar propuesta* vuelve a ser tarea de `jefeAdmin`; `recordatorios` en 0; correos de las versiones 1 y 2 |
| 3 Rechazo | PASS | `curso.estado=RECHAZADO`; sin pasar por `Recordatorio` ni `Preparar` |
| 4 Sin respuesta | PASS | 2 recordatorios (2 correos), `resultado=SIN_RESPUESTA`, `curso.estado=SIN_RESPUESTA` (plazo `PT20S`) |
| 5 Límite de cursos | PASS | La 5ª instancia (4 otras) es viable; la 6ª ve 5, termina `NO_VIABLE` sin pasar por `Propuesta`; `curso.estado=NO_VIABLE` aunque el curso se vinculó después de terminar; correo de aviso |
| 6 Cancelación con recursos gestionados | PASS | Corrió *Liberar Aula*, no *Liberar Aula Virtual* (pendiente); *Notificar Cierre* esperó a *Liberar Equipamiento*; `estadoCurso` y `curso.estado` = `CANCELADO` |
| 7 Falta de aulas | PASS | Se disparó `InicioFaltaAulas`, `motivoCancelacion=SIN_AULAS`, `CANCELADO`, correo de cierre |
| 11 Materiales (API Java) + comunicaciones (API REST) | PASS | Simulador CLI real: sólo ofrece las acciones habilitadas; la app respeta permisos (otro grupo no la ve, no se completa sin reclamar ni por otro usuario) y completa *Preparar materiales* como **última** rama |

Los escenarios 8, 9 y 10 se ensayan con `informe/checklist-manual.md`. Al terminar, Flowable queda sólo con "Demo processes".

## 7. Hallazgos del recorrido y cómo se resolvieron

La primera pasada (antes de los cambios del 2026-11-04) falló en dos escenarios, por defectos reales: (1) los cursos `NO_VIABLE` quedaban `EN_PROCESO`, porque la instancia termina dentro del `POST` que la inicia, antes de que el sitio guarde el vínculo con el curso; se resolvió con el respaldo por `cursoId` en `ActualizarEstadoCursoListener`; (2) la app de escritorio no podía completar la última rama de *Preparar*, porque su motor local ejecutaba *Enviar confirmación* (Groovy) sin tener Groovy; se agregó Groovy al `pom.xml` y, además, el modelo ya no tiene tareas de script. El detalle de cada decisión y las reglas que debe cumplir el sitio están en `informe/decisiones-pendientes.md`; las licencias respecto de la consigna, en `informe/licencias-consigna.md`; el comportamiento de Flowable, en `Contrato.md` §11.35 a 11.46.
