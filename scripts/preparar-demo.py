#!/usr/bin/env python3
"""Deja dos instancias de ejemplo listas para probar las dos apps.

- businessKey CLI: queda esperando la respuesta de la empresa.
- businessKey GUI: ya tiene la propuesta aceptada, así que tiene una tarea
  "Preparar materiales" disponible para la app de escritorio.

Se puede correr las veces que quieras: borra las instancias CLI/GUI anteriores
y crea nuevas. No toca otras instancias ni el modelo real.
"""
import base64
import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://localhost:8080/flowable-rest/service"
USUARIO = "rest-admin"
CLAVE = "test"
FECHA = "2026-12-01T09:00:00Z"


def pedir(metodo, ruta, cuerpo=None):
    datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
    req = urllib.request.Request(BASE + ruta, data=datos, method=metodo)
    req.add_header("Accept", "application/json")
    if datos is not None:
        req.add_header("Content-Type", "application/json; charset=UTF-8")
    credenciales = f"{USUARIO}:{CLAVE}"
    req.add_header("Authorization", "Basic " +
                   base64.b64encode(credenciales.encode()).decode())
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            texto = resp.read().decode("utf-8")
            return json.loads(texto) if texto.strip() else {}
    except urllib.error.HTTPError as e:
        detalle = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} en {metodo} {ruta}: {detalle}") from e


def instancias():
    return pedir("GET", "/runtime/process-instances?size=100").get("data", [])


def borrar_viejas():
    for instancia in instancias():
        if instancia.get("businessKey") in ("CLI", "GUI"):
            pedir("DELETE", f"/runtime/process-instances/{instancia['id']}"
                             "?deleteReason=reinicio+demo")
            print(f"Borre la instancia vieja {instancia['businessKey']}.")


def iniciar(business_key, curso_id):
    respuesta = pedir("POST", "/runtime/process-instances", {
        "message": "Solicitud de curso (ejemplo)",
        "businessKey": business_key,
        "variables": [
            {"name": "cursoId", "value": curso_id, "type": "integer"}
        ],
    })
    return respuesta["id"]


def aceptar(instancia):
    suscripciones = pedir(
        "GET", f"/runtime/event-subscriptions?processInstanceId={instancia}"
    ).get("data", [])
    aceptar = [s for s in suscripciones if s.get("eventName") == "Aceptación"]
    if not aceptar:
        raise RuntimeError("La instancia GUI no quedo esperando la aceptacion.")
    pedir("PUT", "/runtime/executions/" + aceptar[0]["executionId"], {
        "action": "messageEventReceived",
        "messageName": "Aceptación",
        "variables": [
            {"name": "fechaCurso", "value": FECHA, "type": "string"}
        ],
    })


def main():
    try:
        definiciones = pedir(
            "GET",
            "/repository/process-definitions?key=ProcesoEjemploMateriales"
            "&latestVersion=true"
        ).get("data", [])
    except RuntimeError as e:
        print(f"No pude hablar con Flowable: {e}", file=sys.stderr)
        print("Fijate que los contenedores esten arriba: docker compose up -d",
              file=sys.stderr)
        return 1

    if not definiciones:
        print("Falta desplegar el proceso de ejemplo. Lo despliego...")
        script = Path(__file__).resolve().parent / "desplegar-ejemplo.sh"
        subprocess.run([str(script)], check=True)

    borrar_viejas()

    cli = iniciar("CLI", 901)
    gui = iniciar("GUI", 902)
    aceptar(gui)

    tareas = pedir("GET", f"/runtime/tasks?processInstanceId={gui}").get("data", [])
    if not any(t.get("name") == "Preparar materiales" for t in tareas):
        print("ERROR: la instancia GUI no tiene la tarea de materiales.",
              file=sys.stderr)
        return 1

    print()
    print("Listo. Quedaron dos instancias:")
    print(f"  CLI  {cli}  (esperando aceptar/rechazar/pedir cambios)")
    print(f"  GUI  {gui}  (ya aceptada, con 'Preparar materiales' disponible)")
    print()
    print("Consola: elegi la que dice businessKey CLI.")
    print("Ventana Java: entra con jefeAdmin / test y mira la que dice businessKey GUI.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
