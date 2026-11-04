# Licencias tomadas respecto de la consigna

Único registro de todo lo que la implementación hace distinto de lo que dice `ProyectoCursos_V2_168448775197.pdf` (o de su Figura 1), con el motivo y dónde está la evidencia. La consigna permite "extender o realizar modificaciones menores, siempre que se respeten los requisitos del enunciado y se justifiquen los cambios" (§1.5), y deja a criterio del grupo lo celeste (texto azul). Ninguna entrada contradice un requisito: cuando el enunciado y el diagrama discrepaban, se siguió el enunciado.

Última actualización: 2026-11-04. Detalle fino de cada cambio al diagrama: `modelo/cambios-modelo.md` (63 entradas). Comportamiento de Flowable que lo motiva: `Contrato.md` §11.

**Leyenda de tipo:** **D** = cambio al diagrama de referencia; **I** = decisión de implementación (el enunciado no la fija); **A** = alcance (se omite algo opcional); **S** = simulación permitida o necesaria para la demostración; **C** = el cliente (sitio o app) cumple el requisito porque el motor no lo hace.

## A. Cambios al diagrama de referencia (Figura 1)

| # | Tipo | Consigna / Figura 1 | Qué hicimos | Por qué | Evidencia |
|---|---|---|---|---|---|
| 1 | D | §3.1: "decision task de flowable". La Figura 1 usa una tarea de regla de negocio. | `Evaluar Viabilidad` es `serviceTask flowable:type="dmn"` (la *decision task* de Flowable), con la DMN `viabilidadCurso`. | `businessRuleTask` no despliega en esta imagen (la ejecuta con Drools, que no está). La decision task cumple literalmente lo pedido. | `Contrato.md` §11.11; cambios 15, 34 a 36 |
| 2 | D | Figura 1: varias actividades automáticas son tareas de script. | `Habilitar acceso de la empresa` y `Liberar Aula Virtual` pasaron a tarea de servicio con su clase Java. Después, `Enviar recordatorio`, `Notificar Desición`, `Notificar Cierre` y `Enviar confirmación` también (envían correo). No queda ninguna tarea de script. | Una tarea de script no puede invocar un `JavaDelegate`. Los IDs y el diagrama visual no cambian. | cambios 37, 41, 58 a 61 |
| 3 | D | Figura 1 y §3.5: `Enviar propuesta` (el diagrama la dibujaba automática). §1.1 y §2: la envía el jefe administrativo. | Es tarea de usuario de `jefeAdmin`; al completarse reinicia el contador de recordatorios y avisa por correo. | El enunciado manda sobre el dibujo. | cambio 57; decisión del usuario 2026-11-04 |
| 4 | D | Figura 1: la cancelación lanza una compensación y termina con error; el fin normal es un "fin con compensación". §1.3 y §1.4 piden esas compensaciones. | Rediseño: subprocesos de eventos de cancelación y de falta de aulas dentro de `Preparar` (el segundo con fin de terminación); se quita el borde de error de `Preparar`; compuertas `GwCancelado` y `GwHayEquipo`; lanzamientos de compensación `CompensarCancelacion` y `CompensarFin` fuera de `Preparar`; tarea de recepción `EsperarLiberacion`; `Fin` pasa a fin simple. | El diseño original no funciona en Flowable 6.8.0: no compensa nada, traba la instancia, ignora el fin con compensación y no espera las tareas de usuario. El rediseño cumple §1.3 (compensa sólo lo gestionado y notifica el cierre al final) y §1.4 (el proceso concluye al liberar). | `Contrato.md` §11.1 a 11.7, 11.32 a 11.34; cambios 45 a 56 |
| 5 | D | — | Se quitaron 12 mensajes sin uso (restos de otra versión del enunciado). | Nadie los referenciaba. | cambio 4 |
| 6 | D | — | Se conservan los tres objetos de datos del diagrama, con `name` (Flowable no despliega sin él). Crean variables nulas sin uso. | Fidelidad a la Figura 1. | cambio 28 |
| 7 | D | §3.5: plazos de recordatorio de 5 días; "reducir los plazos" para pruebas. | El timer `Plazo` usa la variable opcional `plazoRespuesta` (5 días por defecto). | Probar en segundos sin editar el modelo. | cambio 25; escenario 4 |
| 8 | D | §4.1.2: la empresa ve el estado del curso. | Variable nueva `estadoCurso`, escrita por listeners por expresión en 8 puntos del modelo. | El sitio la lee en vez de derivarla de las tareas. | cambio 63 |
| 9 | D | — | `isExecutable="true"`, asignaciones y grupos candidatos, condiciones de las compuertas, `resultado` en cada cierre. | Es lo que hace ejecutable al modelo conceptual. | cambios 2, 6 a 24 |

## B. Decisiones de implementación que el enunciado no fija

| # | Tipo | Tema | Qué hicimos | Por qué |
|---|---|---|---|---|
| 10 | I | Despliegue de las clases Java | Un JAR único montado en los dos contenedores Flowable. | Cada imagen trae su motor y su ejecutor de jobs: los timers los corre cualquiera. Se descartó un servicio propio (habría que reimplementar la API REST). |
| 11 | I | Avisos a la empresa | `NotificarEmpresaDelegate` envía correo al `contacto_email` de la empresa por SMTP (`SMTP_HOST`, `SMTP_PORT`; por defecto el SMTP falso de la máquina, `host.docker.internal:25`). Si no hay servidor o la empresa no tiene correo, **el aviso falla sin afectar al proceso** y queda en el log. Sin adjuntos: el informe no viaja en el correo. | La consigna lista DevNullSmtp como tecnología y pide "comunicar", "enviar" y "notificar". Un fallo de correo no debe trabar un curso. |
| 12 | I | Cierre `NO_VIABLE` | `ActualizarEstadoCursoListener` busca el curso por `process_instance_id` y, si no lo encuentra, por `cursoId` (sólo si el curso aún no tiene instancia). | Esa instancia termina dentro del propio `POST` de inicio, antes de que el sitio pueda guardar el vínculo. Cumple §3.4. |
| 13 | I | Variables de prueba al iniciar | `plazoRespuesta` y `simularFaltaAulas` (opcionales). | Permiten los escenarios 4 y 7 sin editar el modelo. No cambian el comportamiento normal. |
| 15 | I | Espera de la liberación | `AvisarLiberacionEquipamientoListener` destraba `EsperarLiberacion` al completarse *Liberar Equipamiento*. | Para que *Notificar Cierre* ocurra después de todas las compensaciones (§1.3). |

## C. Alcance: lo opcional que no se hizo

| # | Tipo | Consigna | Qué hicimos | Por qué |
|---|---|---|---|---|
| 16 | A | §4.1.3 (texto azul): completar *Registrar y elaborar propuesta* y *Revisar propuesta* con formulario y **generar el PDF**. | No se genera PDF de la propuesta ni de su revisión. Se completan con un formulario (datos en la BD). | Texto azul = opcional (confirmado por el usuario el 2026-11-03). |
| 17 | A | §4.1.2, §4.1.4 y §4.2.2 (texto azul): acceso de empresas, funciones del docente que desarrolla, interfaz gráfica para el simulador en grupos de hasta 3. | Se mantiene el acceso de las empresas (el escenario 10 lo exige); el simulador es de línea de comandos. | Lo azul es el título de §4.1.2, no el contenido que usan los escenarios. Si el usuario quiere recortarlo, se pregunta. |
| 18 | A | §4.1.3: el PDF del **informe de resultados** sí es obligatorio. | Se mantiene: el informe se adjunta como PDF y su ID va en `informePdf` / `curso.informe_pdf`. | No es celeste. |

## D. Simulaciones

| # | Tipo | Consigna | Qué hicimos |
|---|---|---|---|
| 19 | S | §4.1.2: "la comunicación de las credenciales podrá simularse". | `Habilitar acceso de la empresa` crea el usuario `emp_<cuit>` con clave de desarrollo `test`; no se envía por correo. La columna se llama `clave_hash` pero hoy guarda texto plano: **el sitio debe guardarla con hash al crear cuentas reales**. |
| 20 | S | §4.1.3: "simular una supuesta conexión con un web service" para el aula física. | `ReservarAulaDelegate` devuelve siempre el aula "Aula Magna Principal" (o la excepción `SIN_AULAS` si `simularFaltaAulas`); `LiberarAulaDelegate` sólo marca la liberación. |
| 21 | S | §4.2.2: el simulador de la empresa puede ser de línea de comandos (grupos de hasta 3). | `SimuladorMain` (CLI). **Suposición: el grupo es de 3 o menos; confirmar.** |

## E. Requisitos que cumplen el sitio y las apps porque el motor no los hace (C)

| # | Tipo | Consigna | Qué pasa en el motor | Qué hay que hacer |
|---|---|---|---|---|
| 22 | C | §2: reclamar antes de completar; las asignadas sólo las completa su titular. | Flowable completa una tarea de grupo sin reclamarla y deja a cualquier usuario con acceso REST completar tareas ajenas. | El sitio usa las credenciales del propio usuario (no `rest-admin`) y bloquea "completar" si la tarea no está asignada a quien la completa. La app Swing ya lo hace. |
| 23 | C | §1.2: *Evaluar recursos* debe seleccionar al menos una alternativa. | Con las tres banderas en `false` (o si falta alguna) el motor responde 500 y deshace todo. | El sitio valida antes de enviar (decisión del usuario 2026-11-04: no se agrega un flujo por defecto al modelo). |
| 24 | C | §3.5: la fecha acordada debe estar definida antes del timer. | Una "Aceptación" sin `fechaCurso` se acepta y falla (500) recién al completar *Definir docente*. | El simulador y el sitio obligan a enviar la fecha (opción A elegida por el usuario el 2026-11-04; el modelo no se toca). |
| 25 | C | §4.1.4 / §1.4: "Definir docente" mediante "la aplicación móvil". | No hay aplicación móvil en el alcance. | Se hace desde el sitio (§4.1.4) y la UI de Flowable. Aclararlo en la defensa. |

## Cómo mantener este archivo

Cada vez que algo se aparte de la consigna, agregar una fila acá (no en otro documento) y, si toca el diagrama, también una entrada en `modelo/cambios-modelo.md`.
