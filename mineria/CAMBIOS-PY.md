# Cambios a los scripts del profe

Los dos scripts originales quedan **sin tocar** en la raíz del repo, para poder compararlos:

| Original (raíz) | Versión adaptada (esta carpeta) |
|---|---|
| `exportar_history_168631741028.py` | `mineria/exportar_history.py` |
| `analizar_168631741022.py` | `mineria/analizar.py` |

Para ver todos los cambios: `diff exportar_history_168631741028.py mineria/exportar_history.py` (y lo mismo con `analizar`).
La lógica del profe (consulta paginada, exclusión de instancias borradas, orden estable, variantes, DFG, descubrimiento
inductivo) **no se modificó**; lo de abajo es todo lo que se cambió.

## `exportar_history.py`

| Qué | Antes | Ahora | Por qué |
|---|---|---|---|
| `BASE_URL` | `http://localhost:8080/flowable-ui/process-api` | `http://localhost:8080/flowable-rest/service` (se puede cambiar con la variable `FLOWABLE_REST`) | En este proyecto la API REST es el contenedor `flowable-rest` (8080, ruta `/flowable-rest/service`); `flowable-ui` está en el 8081. |
| `PROCESS_KEY` | `processxor` | `Process_Curso` | ID del `<process>` de nuestro modelo. |
| `ACTIVIDADES` | vacío (todo) | los 17 IDs de la etapa de negociación (de *Solicitud recibida* a la respuesta de la empresa, sin la preparación) | La consigna 4.4 pide analizar sólo la negociación. Incluye eventos y compuertas: el filtro por tipo lo hace `analizar.py`. |
| `ARCHIVO_SALIDA` | `eventos.csv` en el directorio actual | `eventos.csv` junto al script | Que no dependa de desde dónde se lo ejecute. |
| Credenciales | siempre se preguntan | se toman de `FLOWABLE_USER` / `FLOWABLE_PASSWORD` si existen; si no, se preguntan igual | Poder repetir el análisis sin teclear. Con la clave de desarrollo es `rest-admin` / `test`. |
| `import os` | — | agregado | Necesario para lo anterior. |

## `analizar.py`

| Qué | Antes | Ahora | Por qué |
|---|---|---|---|
| Rutas de `eventos.csv`, `recorridos.png`, `modelo_descubierto.png` y `modelo_descubierto.bpmn` | relativas al directorio actual | junto al script (función `ruta()`) | Igual que arriba. |
| Salida por consola | sólo consola | consola **y** `resultados.txt` (clase `Duplicar`) | La consigna pide entregar "una captura de los resultados"; así queda el texto de la corrida. |
| `import os`, `import sys` | — | agregados | Necesarios para lo anterior. |

**Sin cambios, a propósito:** el filtro `tipo in ["userTask", "serviceTask"]`. Con él las tareas y los eventos de
mensaje o temporizador (aceptación, rechazo, solicitud de modificaciones, plazo) no entran en los recorridos; las
consecuencias están en `conclusion.md`.
