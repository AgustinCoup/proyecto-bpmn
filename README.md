# Proyecto BPMN: organización de cursos de capacitación

Proyecto final de Gestión y Tecnologías de Procesos de Negocio. Implementa en Flowable el proceso de la consigna (`ProyectoCursos_V2_168448775197.pdf`).

## Requisitos

- Docker Desktop (abierto y con el motor corriendo)
- Java 11 y Maven
- Postman (opcional, para probar la API REST)

## Levantar el entorno

```
mvn package -DskipTests   # genera target/unrc-cursos.jar (clases Java propias); antes del primer "up"
docker compose up -d
```

El JAR se monta en `flowable-rest` y `flowable-ui`. Si no existe al hacer `up`, Docker crea un directorio con ese nombre y el contenedor no arranca. Si se recompila con los contenedores arriba, reiniciarlos: `docker compose restart flowable-rest flowable-ui`.

| Servicio | URL | Usuario / contraseña |
|---|---|---|
| Interfaz de Flowable | http://localhost:8081/flowable-ui | `admin` / `test` |
| API REST (Swagger) | http://localhost:8080/flowable-rest/docs/ | `rest-admin` / `test` |
| PostgreSQL | `localhost:5432`, base `flowable` | `flowable` / `flowable` |

Si `flowable-ui` falla en el primer arranque, volvé a ejecutar `docker compose up -d`.

Para bajar el entorno conservando los datos: `docker compose down`. Para borrar también los datos: `docker compose down -v`.

## Aplicaciones auxiliares

Las instrucciones del simulador de comunicaciones por consola y de la app Java
de escritorio para **Preparar materiales** están en
[`README-aplicaciones.md`](README-aplicaciones.md). Incluye el proceso de ejemplo,
la configuración por variables de entorno y los tests.
