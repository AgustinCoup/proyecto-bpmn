# Probar las dos apps (sin vueltas)

Dos apps de la sección 4.2 de la consigna, las que usan Flowable
por atrás. Con estos pasos se abre la ventana de Java y
también y la ventana para probar con la consola, sin tocar el modelo real del proyecto.

La de escritorio sirve para que un administrativo vea las tareas "Preparar
materiales" que tiene asignadas o que puede reclamar, reclame una y la complete.
La de consola simula a la empresa: aceptar la propuesta con una fecha,
rechazarla, pedir cambios, mandar la lista de participantes o cancelar. Solo te
deja hacer lo que el proceso está esperando en ese momento, así que no es un
menú fijo: si algo no corresponde, no aparece.

Todo lo de acá funciona con el proceso de ejemplo
(`src/test/resources/procesos/ejemplo-materiales.bpmn20.xml`). El modelo real
todavía no es ejecutable, así que con ese no va a andar hasta que el equipo lo
termine.

## Antes de arrancar

Se requiere andando y Java 11 o más. Después, desde la carpeta
`proyecto-bpmn`:

```bash
docker compose up -d
```

La primera vez puede tardar un poco. Fijate que respondan estas dos:

- http://localhost:8080/flowable-rest/docs/ (Swagger, usuario `rest-admin` / `test`)
- http://localhost:8081/flowable-ui (usuario `admin` / `test`)

Si la UI no abre a la primera, tirá otra vez `docker compose up -d`. A veces le
cuesta el primer arranque.

Los usuarios y grupos ya deberían estar creados, pero si estás con una base
nueva:

```bash
./scripts/crear-usuarios.sh
```

Si dice "omitido" en algunos, no pasa nada: ya existían. Los usuarios son
`jefeAdmin`, `admin2`, `jefeDocente`, `docente1` y `docente2`, todos con clave
`test`.

## Prueba rápida (dos instancias)

Si querés probar las dos apps sin pelear con curls, corré esto desde
`proyecto-bpmn`:

```bash
./scripts/preparar-demo.py
```

Deja dos instancias del proceso de ejemplo:

- **CLI**: esperando la respuesta de la empresa. Sirve para probar aceptar,
  rechazar, pedir modificaciones, mandar la nómina y cancelar.
- **GUI**: ya tiene la propuesta aceptada, así que tiene una tarea
  "Preparar materiales" disponible para la ventana de Java.

El script borra las instancias viejas que tengan businessKey `CLI` o `GUI` y
crea nuevas. No toca otras instancias. Si lo corrés de nuevo, empezás de cero.

Después seguí con **La consola** y **La ventana de Java** de más abajo. En la
consola elegí la que dice `businessKey CLI`; en la ventana, la que dice
`businessKey GUI`.

El proceso de ejemplo también tiene que estar desplegado (el script de arriba lo
hace si falta):

```bash
./scripts/desplegar-ejemplo.sh
```

Esto despliega el ejemplo, no el modelo real. El script te imprime al final
el curl para iniciar una instancia, pero te lo dejo acá también:

```bash
curl -u rest-admin:test -H 'Content-Type: application/json' -X POST \
  'http://localhost:8080/flowable-rest/service/runtime/process-instances' \
  -d '{"message":"Solicitud de curso (ejemplo)","businessKey":"101","variables":[{"name":"cursoId","value":101,"type":"integer"}]}'
```

Te devuelve un JSON con el id de la instancia. Si vas a crear varias, cambiá el
`businessKey` (102, 103...) así las distinguís de un vistazo. No hace falta que
sean únicos, pero ayuda.

## La consola

Primero las variables, en la misma terminal:

```bash
export FLOWABLE_REST_URL=http://localhost:8080/flowable-rest/service
export FLOWABLE_REST_USER=jefeAdmin
export FLOWABLE_REST_PASSWORD=test
```

Y arrancás:

```bash
mvn -q exec:java -Dexec.mainClass=unrc.cursos.simulador.SimuladorMain
```

Te muestra las solicitudes activas y elegís una por número. Después te lista las
actividades, los mensajes que está esperando y, abajo, las comunicaciones
habilitadas. Esas son las únicas que te deja mandar.

Cosas para probar:

- **Aceptar.** Elegí "Aceptar la propuesta" y poné una fecha con zona, por
  ejemplo `2026-12-01T09:00:00Z`. Si escribís cualquier cosa te la vuelve a
  pedir. Después de aceptar, la solicitud pasa a preparación y aparecen la
  nómina y la cancelación.
- **Mandar la nómina.** Escribí un array JSON, por ejemplo `["Ana","Beto"]`. Si
  el JSON está mal, te lo vuelve a pedir sin romperse.
- **Cancelar.** Solo aparece mientras el curso se está preparando. Te pide
  confirmar con `s`.
- **Rechazar o pedir modificaciones.** Para ver estas dos necesitás una
  solicitud nueva, porque la anterior ya avanzó. Creá otra con el curl de
  arriba y elegí "Rechazar" (te pide confirmar) o "Pedir modificaciones" (te
  pide un texto).

Con `r` refrescás y con `q` volvés o salís. Después de cada acción te pide Enter
para actualizar el estado. Si la instancia terminó, desaparece de la lista y te
lo dice.

## La ventana de Java

Acá van las variables de la base del motor, no las de la API REST:

```bash
export FLOWABLE_DB_URL=jdbc:postgresql://localhost:5432/flowable
export FLOWABLE_DB_USER=flowable
export FLOWABLE_DB_PASSWORD=flowable
```

Y la abrís:

```bash
mvn -q exec:java -Dexec.mainClass=unrc.cursos.escritorio.AppMateriales
```

Te aparece el login. Entrá con `jefeAdmin` / `test` (o `admin2` / `test`, los
dos son de administración). Adentro vas a ver la tabla con las tareas "Preparar
materiales". Si la tarea está disponible para tu grupo, se habilita "Reclamar
tarea"; una vez reclamada, se habilita "Completar tarea". "Actualizar" vuelve a
consultar y "Cambiar usuario" te devuelve al login.

Para que aparezca la tarea tenés que haber aceptado la propuesta antes, porque
"Preparar materiales" vive dentro de la parte de preparación del curso. Si
entrás y no hay nada, fijate que la instancia esté en preparación y que la tarea
no la haya reclamado o completado otro.

## Para chusmear

En la UI de Flowable (http://localhost:8081/flowable-ui, `admin` / `test`)
podés ver las tareas y el proceso corriendo. No hace falta para probar las apps,
pero está bueno para entender qué pasa por atrás.

Si querés ver las instancias activas desde la terminal:

```bash
curl -s -u rest-admin:test \
  'http://localhost:8080/flowable-rest/service/runtime/process-instances?size=50' \
  | python3 -m json.tool
```

Y si querés ver las tareas:

```bash
curl -s -u rest-admin:test \
  'http://localhost:8080/flowable-rest/service/runtime/tasks?size=50' \
  | python3 -m json.tool
```

## Si algo no anda

- **No aparece ninguna solicitud:** no iniciaste ninguna o ya terminó. Creá otra
  con el curl.
- **La consola dice 401 o 403:** el usuario no tiene `access-rest-api`, o la
  clave no es `test`. Corré `./scripts/crear-usuarios.sh`.
- **La app Java no conecta:** revisá que PostgreSQL esté arriba y que las tres
  variables `FLOWABLE_DB_*` estén bien.
- **No aparece "Preparar materiales":** la instancia no está en preparación, o
  la tarea ya está reclamada/completada.
- **No aparece "Cancelar" en la consola:** en el ejemplo sí aparece. En el
  modelo real todavía no, porque le falta asociar el mensaje de cancelación.
  Eso es un tema del `.bpmn`, no de la app.

## Limpiar

Si querés borrar todo y empezar de cero:

```bash
docker compose down -v
```

Eso borra también la base de datos. Si solo querés bajar los contenedores pero
conservar los datos, sacale el `-v`.
