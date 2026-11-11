# Análisis de las ejecuciones (consigna 4.3 y 4.4)

Dos partes independientes sobre el historial que Flowable guarda de `Process_Curso`:

- **4.3, consultas** (Java, API de Flowable contra la BD del motor): tabla de resultados, duración de las ramas de
  preparación y tareas por persona. Se ven en la app de escritorio y por consola.
- **4.4, minería de procesos** (Python con PM4Py): CSV con la negociación, los tres recorridos más frecuentes, grafo,
  modelo descubierto y la comparación con el BPMN (`conclusion.md`).

Ambas necesitan datos. `generar_historial.js` crea 55 instancias terminadas con recorridos variados (ver abajo).

## Requisitos

Los mismos que el recorrido de escenarios (`README.md` de la raíz: Docker arriba con el JAR actual, usuarios y BD
creados, Node 18+, Java 11+, Maven). Para 4.4 además:

```
# Ubuntu
sudo apt install python3-venv graphviz
python3 -m venv .venv
source .venv/bin/activate
pip install pm4py pandas requests
```

En Windows: Graphviz (`winget install --id Graphviz.Graphviz -e --source winget`, y abrir una terminal nueva) y
`python -m venv .venv`, `.venv\Scripts\activate`, `pip install pm4py pandas requests`.

## 1. Generar el historial

Desde la raíz del repo:

```
node mineria/generar_historial.js
```

Tarda unos 4 minutos. **Borra el historial previo de `Process_Curso`** (para que el CSV sea reproducible; con
`--conservar-historial` no lo hace) y deja el modelo desplegado y **ninguna instancia activa**. La mezcla de casos es fija y el orden sale de una semilla; como los plazos son de segundos, un caso puede
diferir en un recordatorio de más o de menos de una corrida a otra. Sin errores termina con `HISTORIAL GENERADO SIN ERRORES`.

| Caso | Instancias | Resultado |
|---|---|---|
| Rechazo directo / tras 1 modificación / tras 2 | 8 / 4 / 2 | `RECHAZADO` |
| Curso completo, directo / tras 1 modificación | 6 / 3 | `FINALIZADO` |
| Cancelación durante la preparación, directa / tras 1 modificación / tras un recordatorio | 4 / 3 / 4 | `CANCELADO` |
| Falta de aulas | 2 | `CANCELADO` |
| Sin respuesta, directa / tras 1 modificación | 8 / 2 | `SIN_RESPUESTA` |
| No viables (con 5 solicitudes activas retenidas, que luego se rechazan) | 4 (+5) | `NO_VIABLE` (+`RECHAZADO`) |

Los plazos de respuesta se acortan a 8 segundos (`plazoRespuesta`). Las tareas con grupo candidato se reclaman con
`jefeAdmin` o `admin2` en forma alternada y los docentes del dictado se alternan, así que 4.3.3 tiene datos de todos.

## 2. Consultas de 4.3

- **Por consola** (misma BD que usa la app Swing; variables `FLOWABLE_DB_*` de `Aplicaciones.md`):

  ```
  mvn -q package -DskipTests
  mvn -q dependency:build-classpath -Dmdep.outputFile=target/classpath.txt
  FLOWABLE_DB_USER=flowable FLOWABLE_DB_PASSWORD=flowable \
    java -cp "target/classes:$(cat target/classpath.txt)" unrc.cursos.analisis.AnalisisMain
  ```

  (en Windows el separador del classpath es `;`).
- **En la app de escritorio** (`unrc.cursos.escritorio.AppMateriales`): botón **Analisis del historial** de la
  pantalla de tareas.

Criterios: los porcentajes son sobre las instancias terminadas (se excluyen las borradas por administración). Las
ramas se miden sólo en los cursos que llegaron al fin normal de *Preparar curso* (`SubFin`); la de recursos termina
cuando se completa la última acción seleccionada (aula, plataforma o equipamiento). Las tareas se cuentan por
responsable cuando la tarea se completó (no las pendientes ni las interrumpidas o canceladas).
`resultados-4.3.txt` es la salida de la corrida entregada.

## 3. Minería de procesos (4.4)

```
cd mineria
python exportar_history.py        # pide usuario y clave de Flowable (rest-admin / test)
python analizar.py
```

Genera `eventos.csv` (actividades finalizadas de la negociación), `resultados.txt` (la salida por consola),
`recorridos.png` (grafo de sucesión directa) y `modelo_descubierto.png` / `.bpmn`. Para no teclear:
`FLOWABLE_USER=rest-admin FLOWABLE_PASSWORD=test python exportar_history.py`.

Los scripts son los del profe adaptados; todo lo que se cambió está en `CAMBIOS-PY.md`. La comparación con el modelo
y las conclusiones están en `conclusion.md`.
