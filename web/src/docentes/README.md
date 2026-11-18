# Módulo de equipo docente (`/docentes`)

Pantallas del grupo `docentes` (`jefeDocente`, `docente1`, `docente2`). Es un `express.Router`
exportado desde `index.js` (`createDocentesRouter(options)` para pruebas); el esqueleto lo monta
en `/docentes`. Reutiliza la infraestructura de [`../admin/`](../admin/README.md): cliente REST,
sesión firmada (cookie propia `docente_sid`), CSRF, reclamo, límite de intentos de login y layout.

El login es contra Flowable con el usuario y la clave reales; todas las llamadas posteriores van
con **ese** usuario, nunca con `rest-admin`. Quien no pertenece al grupo `docentes` recibe 403.

## Qué pantalla cubre qué tarea

| Tarea | Quién | Pantalla | Qué hace |
|---|---|---|---|
| `Activity_1018bdz` Definir Docente que desarrolla el curso | `jefeDocente` | `GET /docentes/tasks/:id` | Lista los miembros del grupo `docentes` (consulta a Flowable) y obliga a elegir **uno**; envía `docenteSeleccionado`. Si falta `fechaCurso` en la instancia lo avisa y no deja completar (sin esa variable Flowable responde 500). |
| `Dictar` Desarrollar curso | docente elegido (`${docenteSeleccionado}`) | idem | Muestra la lista definitiva (`listaDefinitiva`, y si no está, la nómina `participantes`) y completa. Solo la ve y completa el docente asignado; a cualquier otro, 403. |
| `Informe` Elaborar informe de resultados | `jefeDocente` | idem | Resumen, asistentes y observaciones → el servidor **genera el PDF** (pdfkit), lo guarda en `institucion.informe` y deja el id en `curso.informe_pdf`; completa con `informePdf` (entero). |
| `GET /docentes/informes/:id.pdf` | docentes con sesión | descarga | El PDF como adjunto. |
| `Material`, `Virtual`, `Equipo`, `Liberar Equipamiento` | administración | — | No son de docentes; se hacen en la UI de Flowable. |

El resto (lista de tareas, reclamo) es idéntico a `/admin`.

## Esquema nuevo

`db/migraciones/001-informe.sql` crea la tabla `informe` (`id`, `curso_id`, `nombre_archivo`,
`contenido BYTEA`, `creado_por`, `creado_en`). Es idempotente y no modifica `schema.sql` ni
`datos.sql`. **Si se recrea la BD con `scripts/crear-bd`, hay que volver a correr la migración**
(o incorporarla a ese script, decisión del dueño del esquema). `datos.sql` hace `TRUNCATE …
CASCADE` sobre `curso`, así que también vacía `informe`.

## Seguridad

- Rol por pertenencia a grupos; clave solo en memoria del servidor; cookie `httpOnly`,
  `SameSite=Lax`, firmada; CSRF en todos los `POST`; escape de HTML en todas las vistas.
- El docente elegido se valida contra la lista real del grupo (no se reenvía lo que mande el
  cliente) y a Flowable solo viajan variables armadas por el servidor.
- El PDF no se sube: se genera; el nombre del archivo sale de números, nunca de texto del usuario.
- Una tarea que no es del usuario no se abre ni se completa por URL (403).

## Pruebas

```bash
cd web/src
node --test docentes/test/*.test.js
```

13 pruebas propias (mocks del cliente REST) + el escenario 8 completo contra el motor real en
`../admin/dev/escenario8-e2e.js`.
