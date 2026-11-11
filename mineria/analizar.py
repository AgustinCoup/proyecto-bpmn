import os
import sys

import pandas as pd
import pm4py

# Todo se lee y se escribe junto a este script, sin importar desde dónde se
# lo ejecute.
CARPETA = os.path.dirname(os.path.abspath(__file__))


def ruta(nombre):
    return os.path.join(CARPETA, nombre)


class Duplicar:
    """Escribe en la consola y en resultados.txt (captura de resultados)."""

    def __init__(self, *destinos):
        self.destinos = destinos

    def write(self, texto):
        for destino in self.destinos:
            destino.write(texto)

    def flush(self):
        for destino in self.destinos:
            destino.flush()


salida = open(ruta("resultados.txt"), "w", encoding="utf-8")
sys.stdout = Duplicar(sys.stdout, salida)

# Leer el CSV. Mantener los identificadores como texto.
df = pd.read_csv(ruta("eventos.csv"), dtype=str)

# Conservar solamente tareas de usuario y automáticas.
df = df[df["tipo"].isin(["userTask", "serviceTask"])].copy()


# Convertir fechas y conservar el orden del CSV ante empates.
df["fecha_hora"] = pd.to_datetime(df["fecha_hora"], utc=True)
df = df.sort_values(
    ["instancia", "fecha_hora"], kind="stable"
)

# Adaptar las columnas al formato utilizado por PM4Py.
log = pm4py.format_dataframe(
    df,
    case_id="instancia",
    activity_key="actividad",
    timestamp_key="fecha_hora",
)

# 1. Recorridos o variantes más frecuentes.
variantes = pm4py.get_variants_as_tuples(log)
total = log["case:concept:name"].nunique()

print(f"\nInstancias analizadas: {total}")
print(f"Recorridos diferentes: {len(variantes)}")

print("\nLos tres recorridos más frecuentes:")
for recorrido, cantidad in sorted(
    variantes.items(),
    key=lambda elemento: elemento[1],
    reverse=True,
)[:3]:
    print(f"\n{cantidad} casos ({100 * cantidad / total:.1f} %)")
    print(" → ".join(recorrido))

# 2. Grafo de sucesión directa:
# cada flecha indica cuántas veces una tarea siguió a otra.
dfg, inicios, finales = pm4py.discover_dfg(log)
pm4py.save_vis_dfg(
    dfg, inicios, finales, ruta("recorridos.png")
)

# 3. Modelo BPMN descubierto a partir de las ejecuciones.
modelo = pm4py.discover_bpmn_inductive(log)
pm4py.save_vis_bpmn(modelo, ruta("modelo_descubierto.png"))
pm4py.write_bpmn(modelo, ruta("modelo_descubierto.bpmn"))

print("\nArchivos generados:")
print("- recorridos.png")
print("- modelo_descubierto.png")
print("- modelo_descubierto.bpmn")

sys.stdout = sys.__stdout__
salida.close()
