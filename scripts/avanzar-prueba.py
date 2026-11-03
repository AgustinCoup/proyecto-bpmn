h#!/usr/bin/env python3
"""Avanza las tareas internas de una instancia de prueba.

Sirve solo para la copia ejecutable del modelo real. Completa las tareas que no
son de las apps (Propuesta, Lista, Evaluar Recursos, docente, informe, etc.) y
deja 'Preparar materiales' para la app Java. La nómina la manda el simulador.

Uso:
  ./scripts/avanzar-prueba.py <processInstanceId> [--incluir-material]

Variables opcionales:
  FLOWABLE_REST_URL       (por defecto http://localhost:8080/flowable-rest/service)
  FLOWABLE_ADMIN_USER     (por defecto jefeAdmin)
  FLOWABLE_ADMIN_PASSWORD (por defecto test)
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("FLOWABLE_REST_URL",
                      "http://localhost:8080/flowable-rest/service").rstrip("/")
ADMIN_USER = os.environ.get("FLOWABLE_ADMIN_USER", "jefeAdmin")
ADMIN_PASSWORD = os.environ.get("FLOWABLE_ADMIN_PASSWORD", "test")
CLAVE = "test"
USUARIOS = {"jefeAdmin", "admin2", "jefeDocente", "docente1", "docente2"}


def pedir(metodo, ruta, cuerpo=None, usuario=None, clave=None):
    url = BASE + ruta
    datos = None
    if cuerpo is not None:
        datos = json.dumps(cuerpo).encode("utf-8")
    req = urllib.request.Request(url, data=datos, method=metodo)
    req.add_header("Accept", "application/json")
    if datos is not None:
        req.add_header("Content-Type", "application/json; charset=UTF-8")
    credenciales = f"{usuario or ADMIN_USER}:{clave or ADMIN_PASSWORD}"
    req.add_header("Authorization", "Basic " +
                   base64.b64encode(credenciales.encode("utf-8")).decode("ascii"))
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            texto = resp.read().decode("utf-8")
            return json.loads(texto) if texto.strip() else {}
    except urllib.error.HTTPError as e:
        detalle = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} en {metodo} {ruta}: {detalle}") from e


def tareas(instancia):
    respuesta = pedir("GET", f"/runtime/tasks?processInstanceId={instancia}&size=100")
    return respuesta.get("data", [])


def reclamar(tarea):
    pedir("POST", f"/runtime/tasks/{tarea['id']}",
          {"action": "claim", "assignee": ADMIN_USER})


def completar(tarea, usuario, variables):
    cuerpo = {"action": "complete"}
    if variables:
        cuerpo["variables"] = [
            {"name": nombre, "value": valor, "type": tipo}
            for nombre, valor, tipo in variables
        ]
    pedir("POST", f"/runtime/tasks/{tarea['id']}", cuerpo, usuario=usuario)


def variables_para(tarea):
    clave = tarea.get("taskDefinitionKey")
    if clave == "Propuesta":
        return [("propuestaVersion", 1, "integer")]
    if clave == "Activity_12i2hpf":
        return [
            ("requiereAula", True, "boolean"),
            ("requierePlataforma", False, "boolean"),
            ("requiereEquipamiento", False, "boolean"),
        ]
    if clave == "Activity_1018bdz":
        return [("docenteSeleccionado", "docente1", "string")]
    if clave == "EnviarInforme":
        return [("resultado", "FINALIZADO", "string")]
    return []


def main():
    if len(sys.argv) < 2:
        print("Uso: avanzar-prueba.py <processInstanceId> [--incluir-material]",
              file=sys.stderr)
        return 2
    instancia = sys.argv[1]
    incluir_material = "--incluir-material" in sys.argv[2:]

    for vuelta in range(20):
        pendientes = tareas(instancia)
        if not pendientes:
            print("No quedan tareas internas. La instancia puede estar esperando "
                  "un mensaje de la empresa o un timer.")
            return 0

        hizo_algo = False
        for tarea in pendientes:
            nombre = (tarea.get("name") or "").replace("\n", " ")
            if nombre == "Preparar materiales" and not incluir_material:
                print(f"Salteo '{nombre}' (la completa la app Java).")
                continue

            asignado = tarea.get("assignee")
            if not asignado:
                reclamar(tarea)
                asignado = ADMIN_USER

            if asignado not in USUARIOS:
                print(f"Salteo '{nombre}': esta asignada a '{asignado}', "
                      "que no es un usuario de prueba conocido.")
                continue

            completar(tarea, asignado, variables_para(tarea))
            print(f"Complete '{nombre}' como {asignado}.")
            hizo_algo = True

        if not hizo_algo:
            print("No hay tareas internas que pueda completar.")
            return 0

    print("Corte por seguridad: quedaron tareas despues de 20 vueltas.",
          file=sys.stderr)
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
