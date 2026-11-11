package unrc.cursos.analisis;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/** Cantidad de instancias terminadas por resultado (consigna 4.3.1). */
public final class ResultadosSolicitudes {

    /** Instancias terminadas sin variable "resultado" (no debería ocurrir: cada cierre la fija). */
    public static final String SIN_RESULTADO = "SIN_RESULTADO";

    private final Map<String, Long> cantidades;
    private final long total;

    ResultadosSolicitudes(Map<String, Long> cantidades) {
        Map<String, Long> copia = new LinkedHashMap<>();
        long suma = 0;
        for (Map.Entry<String, Long> e : cantidades.entrySet()) {
            // SIN_RESULTADO sólo se muestra si hay casos; los cinco resultados de la consigna siempre.
            if (SIN_RESULTADO.equals(e.getKey()) && e.getValue() == 0) {
                continue;
            }
            copia.put(e.getKey(), e.getValue());
            suma += e.getValue();
        }
        this.cantidades = Collections.unmodifiableMap(copia);
        this.total = suma;
    }

    public Map<String, Long> cantidades() {
        return cantidades;
    }

    public long total() {
        return total;
    }

    /** Porcentaje sobre el total de instancias terminadas (0 si no hay ninguna). */
    public double porcentaje(String resultado) {
        if (total == 0) {
            return 0;
        }
        return 100.0 * cantidades.getOrDefault(resultado, 0L) / total;
    }
}
