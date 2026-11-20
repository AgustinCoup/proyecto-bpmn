# Registro de revisiones manuales

## Objetivo y alcance

Este documento registra la verificación de los escenarios de la defensa (consigna, §5) que dependen del sitio web y que no cubre el recorrido automático `scripts/escenarios/m-escenarios.js`: los escenarios **8, 9 y 10**. Los escenarios 1 a 7 y 11 se verifican con ese recorrido automático (`README.md`, sección 13).

## Condiciones de la ejecución

| Elemento | Valor |
|---|---|
| Fecha | 2026-11-20 |
| Versión del repositorio | commit `523a169` |
| Motor | Flowable REST y Flowable UI 6.8.0 (Docker), proceso `Process_Curso` desplegado |
| Base de datos | PostgreSQL 16.15; base `institucion` reiniciada con `scripts/crear-bd.sh` (datos de `db/datos.sql`) |
| Sitio web | Node.js 20.20.2 |
| Aplicación de escritorio | Java 21 (OpenJDK) |
| Navegador | Chromium (sin interfaz gráfica) |
| Correo | Servidor SMTP de prueba (`scripts/escenarios/m-smtp-sumidero.js`), puerto 2525 |
| Estado inicial | Sin instancias activas de `Process_Curso` |

## Método

- **Sitio web:** las acciones se ejecutaron en el navegador sobre las pantallas del sitio (formularios y botones), con las credenciales de cada usuario.
- **Comunicaciones de la empresa** (aceptación, nómina, cancelación): se enviaron por la API REST con las mismas llamadas que realiza el simulador de la empresa. El simulador se verifica en el escenario 11.
- **Preparar materiales:** se ejecutó la lógica de la aplicación de escritorio (clase `ServicioTareas`, API Java de Flowable) mediante `scripts/escenarios/m-MaterialesApiJava.java`, sin la ventana Swing.
- **Tareas de la interfaz de Flowable** (*Solicitar Aula Virtual*, *Contratar equipamiento*, *Liberar Equipamiento*): se reclamaron y completaron por la API REST con el usuario `admin2`.
- **Fecha del curso:** se acordó una fecha cuatro minutos posterior a la aceptación, para que el temporizador *Fecha programada* venciera durante la ejecución.
- Cada verificación se identifica con el número de escenario y un número de caso (9.x, 10.x, 8.x).

## Escenario 9 — Registro de una solicitud desde el sitio web e inicio de su instancia

Datos: solicitud A de la empresa 2 (CUIT 30-72233445-7) desde el formulario público.

| ID | Verificación | Resultado | Evidencia |
|---|---|---|---|
| 9.1 | Formulario vacío: no se envía y no se crea curso | Conforme | cursos antes=1, después=1 |
| 9.2 | CUIT inválido: error "CUIT invalido." y se conservan los datos | Conforme | mensaje mostrado y campos conservados |
| 9.3 | Solicitud correcta: página "Solicitud recibida" con número de curso | Conforme | curso 2 |
| 9.4 | BD: curso con empresa 2, estado EN_PROCESO, process_instance_id cargado; empresa no duplicada | Conforme | empresa_id=2, estado=EN_PROCESO, empresas=2 |
| 9.5 | Flowable: una instancia con businessKey = id del curso y el mismo id que en la BD | Conforme | instancias=1 |
| 9.6 | jefeAdmin ve "Registrar y Elaborar propuesta" asignada, con Completar y sin Reclamar | Conforme | — |
| 9.7 | admin2 y jefeDocente no ven la tarea del jefe administrativo | Conforme | — |

## Escenario 10 — Habilitación del acceso de la empresa y consulta exclusiva de sus cursos

Datos: solicitudes A y B de la misma empresa; aceptación de ambas y cancelación de A.

| ID | Verificación | Resultado | Evidencia |
|---|---|---|---|
| 10.1 | La empresa 2 no tiene cuenta al inicio | Conforme | — |
| 10.2 | Propuesta A completada y enviada; la instancia espera la respuesta de la empresa | Conforme | espera: Aceptación, Rechazo, Solicitud de modificaciones |
| 10.3 | Segunda solicitud (B) de la misma empresa: dos instancias esperando respuesta | Conforme | curso B = 3 |
| 10.4 | Hay solicitudes activas para que la empresa responda (A y B) | Conforme | instancias activas=2 (comunicaciones por API REST, mismas llamadas que el simulador) |
| 10.5 | Fecha de inicio futura en formato ISO 8601 UTC | Conforme | 2026-11-20T14:27:53Z |
| 10.6 | Aceptación de A: se crea la cuenta emp_30722334457 de la empresa 2 | Conforme | 2\|emp_30722334457 |
| 10.7 | Aceptación de B: la empresa 2 sigue con una sola cuenta (se reutiliza) | Conforme | — |
| 10.8 | La empresa 2 ve "Mis cursos" con exactamente sus dos cursos y no el curso 1 | Conforme | filas=2 |
| 10.9 | Detalle de B: datos del curso, estado EN_PREPARACION y varias actividades en paralelo | Conforme | Preparar materiales, Evaluar Recursos, Preparar curso, Recibir Cancelacion, Recibir nomina, Volver |
| 10.10 | La empresa 2 no puede ver el curso 1 de otra empresa por URL | Conforme | — |
| 10.11 | La empresa 1 solo ve su curso 1 | Conforme | — |
| 10.12 | Clave incorrecta y usuario inexistente: mismo mensaje genérico | Conforme | — |
| 10.13 | Un usuario del personal no entra a la zona de empresas | Conforme | — |
| 10.14 | Cancelación de A: la empresa ve A CANCELADO y B EN_PREPARACION; la BD registra CANCELADO | Conforme | A=CANCELADO |

## Escenario 8 — Asignación, reclamo y finalización de tareas según los responsables definidos

Datos: curso B desde la preparación hasta su finalización.

| ID | Verificación | Resultado | Evidencia |
|---|---|---|---|
| 8.1 | jefeAdmin: propuesta y envío de B ya no están; Evaluar Recursos y Preparar materiales disponibles para reclamar | Conforme | — |
| 8.2 | admin2 no ve tareas del jefe y sí ve las del grupo | Conforme | — |
| 8.3 | La empresa ve B en EN_PREPARACION | Conforme | — |
| 8.4 | La empresa envía la nómina; la recepción de la nómina deja de estar habilitada | Conforme | señal enviada por API REST |
| 8.5 | Confeccionar lista definitiva asignada a una sola persona por el listener (menos cargado) | Conforme | asignada a admin2 |
| 8.6 | Lista definitiva completada sin reclamar | Conforme | — |
| 8.7 | jefeAdmin reclama Evaluar Recursos; admin2 ya no puede reclamarla ni la ve | Conforme | respuesta a admin2: HTTP 403 |
| 8.8 | Evaluar Recursos sin ninguna opción: el sitio no avanza y la tarea sigue | Conforme | — |
| 8.9 | Con las tres opciones: se crean Aula Virtual y Equipamiento; Reservar aula corre sola (aulaAsignada) | Conforme | aulaAsignada=Aula Magna Principal |
| 8.10 | App de escritorio (ServicioTareas, API Java): lista la tarea, exige reclamar antes de completar, reclama y completa | Conforme | completar sin reclamar → ERROR IllegalStateException: Solo puede completar la tarea quien la ti |
| 8.11 | Solicitar Aula Virtual y Contratar equipamiento reclamadas y completadas por admin2 | Conforme | por API REST, mismas operaciones que la interfaz de Flowable |
| 8.12 | La empresa ve B CONFIRMADO_PENDIENTE_INICIO y se envía el aviso de confirmación | Conforme | correo "Confirmacion del curso" recibido por el SMTP de prueba |
| 8.13 | jefeDocente ve "Definir Docente" asignada, con botón Definir docente | Conforme | — |
| 8.14 | Docente asignado; el proceso espera la fecha programada; docente2 no ve tareas del curso | Conforme | actividad: Fecha programada (timer) |
| 8.15 | Vencida la fecha: Desarrollar curso asignada a docente1; docente2 y jefeDocente no la ven | Conforme | — |
| 8.16 | La empresa ve B EN_DESARROLLO | Conforme | — |
| 8.17 | Curso dictado: se crea Elaborar informe para jefeDocente y la empresa ve ELABORANDO_INFORME | Conforme | — |
| 8.18 | Informe elaborado: el sitio genera el PDF (sin subir archivos) | Conforme | — |
| 8.19 | Informe descargable en PDF y enviado; aparece Liberar Equipamiento; la instancia sigue activa | Conforme | B=EN_PROCESO, A=CANCELADO |
| 8.20 | Liberar Equipamiento completada: B FINALIZADO en BD y para la empresa; A sigue CANCELADO; sin instancia activa | Conforme | — |

## Resumen

| Escenario | Verificaciones | Conformes | No conformes |
|---|---|---|---|
| Escenario 9 | 7 | 7 | 0 |
| Escenario 10 | 14 | 14 | 0 |
| Escenario 8 | 20 | 20 | 0 |
| **Total** | **41** | **41** | **0** |

El servidor SMTP de prueba recibió 5 avisos del proceso dirigidos a la empresa.
