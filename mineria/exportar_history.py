import csv
import os
from datetime import datetime
from getpass import getpass

import requests


# Configuración
# API REST de Flowable de este proyecto (contenedor flowable-rest). Se puede cambiar con FLOWABLE_REST.
BASE_URL = os.environ.get(
    "FLOWABLE_REST", "http://localhost:8080/flowable-rest/service"
)

# ID del elemento <process id="..."> del BPMN.
PROCESS_KEY = "Process_Curso"

# IDs BPMN de los elementos de la etapa de negociación (de la solicitud
# hasta la respuesta de la empresa, antes de la preparación del curso).
ACTIVIDADES = {
    "Inicio",              # Solicitud recibida
    "Activity_1xw400l",    # Evaluar Viabilidad (regla DMN)
    "Gateway_10gftrn",     # ¿Viable?
    "Activity_0iibzwu",    # Notificar Desición (no viable)
    "Event_18edb9q",       # Fin: solicitud no viable
    "Propuesta",           # Registrar y Elaborar propuesta
    "Enviar",              # Enviar propuesta
    "Esperar",             # Espera de respuesta (compuerta por eventos)
    "Plazo",               # 5 días sin respuesta
    "Limite",              # ¿Se agotaron los recordatorios?
    "Recordatorio",        # Enviar recordatorio
    "Aceptar",             # Aceptación
    "Rechazar",            # Rechazo
    "Modificar",           # Solicitud de modificaciones
    "Revisar",             # Revisar propuesta
    "Archivar",            # Archivar solicitud
    "FinSinCurso",         # Fin: solicitud cerrada
}

# El CSV se guarda junto a este script, sin importar desde dónde se lo ejecute.
ARCHIVO_SALIDA = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "eventos.csv"
)


def consultar_todos(session, recurso, filtros):
    """Recupera todas las páginas de una consulta REST."""
    inicio = 0

    while True:
        respuesta = session.get(
            f"{BASE_URL}/{recurso}",
            params={
                **filtros,
                "start": inicio,
                "size": 100,
            },
            timeout=30,
        )
        respuesta.raise_for_status()
        pagina = respuesta.json()
        registros = pagina["data"]

        if not registros:
            break

        yield from registros
        inicio += len(registros)

        if inicio >= pagina["total"]:
            break


def fecha_iso(valor):
    return datetime.fromisoformat(valor.replace("Z", "+00:00"))


def main():
    # Para ejecutar sin preguntar: FLOWABLE_USER y FLOWABLE_PASSWORD.
    usuario = os.environ.get("FLOWABLE_USER") or input("Usuario de Flowable: ")
    clave = os.environ.get("FLOWABLE_PASSWORD") or getpass("Contraseña: ")

    eventos = []

    with requests.Session() as session:
        session.auth = (usuario, clave)

        instancias = consultar_todos(
            session,
            "history/historic-process-instances",
            {
                "processDefinitionKey": PROCESS_KEY,
                "finished": "true",
            },
        )

        for instancia in instancias:
            # Excluir instancias eliminadas administrativamente.
            if instancia.get("deleteReason"):
                continue

            actividades = consultar_todos(
                session,
                "history/historic-activity-instances",
                {"processInstanceId": instancia["id"]},
            )

            for actividad in actividades:
                # No exportar elementos sin fecha de finalización.
                if not actividad.get("endTime"):
                    continue

                if (
                    ACTIVIDADES
                    and actividad["activityId"] not in ACTIVIDADES
                ):
                    continue

                eventos.append({
                    "instancia": instancia["id"],
                    "definicion": actividad["processDefinitionId"],
                    "evento_id": actividad["id"],
                    "actividad_id": actividad["activityId"],
                    "actividad": (
                        actividad.get("activityName")
                        or actividad["activityId"]
                    ),
                    "tipo": actividad["activityType"],
                    "inicio": actividad["startTime"],
                    "fecha_hora": actividad["endTime"],
                    "recurso": actividad.get("assignee") or "",
                })

    # Ordenar por instancia y fecha de finalización.
    # El ID da un orden estable si coinciden las marcas temporales.
    eventos.sort(
        key=lambda evento: (
            evento["instancia"],
            fecha_iso(evento["fecha_hora"]),
            fecha_iso(evento["inicio"]),
            evento["evento_id"],
        )
    )

    columnas = [
        "instancia", "definicion", "evento_id",
        "actividad_id", "actividad", "tipo",
        "inicio", "fecha_hora", "recurso",
    ]

    with open(
        ARCHIVO_SALIDA, "w", newline="", encoding="utf-8"
    ) as archivo:
        escritor = csv.DictWriter(archivo, fieldnames=columnas)
        escritor.writeheader()
        escritor.writerows(eventos)

    cantidad_instancias = len({
        evento["instancia"] for evento in eventos
    })

    print(
        f"Generado {ARCHIVO_SALIDA}: "
        f"{len(eventos)} eventos de {cantidad_instancias} instancias."
    )


if __name__ == "__main__":
    main()
