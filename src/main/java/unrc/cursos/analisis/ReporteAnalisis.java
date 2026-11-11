package unrc.cursos.analisis;

import java.util.Locale;
import java.util.Map;

/** Arma el texto de las tres consultas de 4.3, igual para la consola y para la app Swing. */
public final class ReporteAnalisis {

    private static final long SEGUNDO = 1000L;
    private static final long MINUTO = 60 * SEGUNDO;
    private static final long HORA = 60 * MINUTO;
    private static final long DIA = 24 * HORA;

    private ReporteAnalisis() {
    }

    public static String generar(ServicioAnalisis servicio) {
        StringBuilder sb = new StringBuilder();
        sb.append(resultados(servicio.resultadosSolicitudes())).append('\n');
        sb.append(ramas(servicio.duracionRamas())).append('\n');
        sb.append(tareas(servicio.tareasPorUsuario()));
        return sb.toString();
    }

    static String resultados(ResultadosSolicitudes r) {
        StringBuilder sb = new StringBuilder("4.3.1 Resultados de las solicitudes\n");
        sb.append(String.format(Locale.ROOT, "%-18s %9s %11s%n", "Resultado", "Cantidad", "Porcentaje"));
        for (Map.Entry<String, Long> e : r.cantidades().entrySet()) {
            sb.append(String.format(Locale.ROOT, "%-18s %9d %10.1f%%%n", nombre(e.getKey()), e.getValue(), r.porcentaje(e.getKey())));
        }
        sb.append(String.format(Locale.ROOT, "%-18s %9d %10.1f%%%n", "Total terminadas", r.total(), r.total() == 0 ? 0.0 : 100.0));
        return sb.toString();
    }

    static String ramas(DuracionRamas d) {
        StringBuilder sb = new StringBuilder("4.3.2 Preparación paralela (cursos con preparación completa: " + d.cursos() + ")\n");
        if (d.cursos() == 0) {
            return sb.append("Sin cursos que hayan completado la preparación.\n").toString();
        }
        sb.append(String.format(Locale.ROOT, "%-14s %s%n", "Inscripciones", formatoDuracion(d.inscripcionesMs())));
        sb.append(String.format(Locale.ROOT, "%-14s %s%n", "Materiales", formatoDuracion(d.materialesMs())));
        sb.append(String.format(Locale.ROOT, "%-14s %s%n", "Recursos", formatoDuracion(d.recursosMs())));
        return sb.toString();
    }

    static String tareas(Map<String, Long> cantidades) {
        StringBuilder sb = new StringBuilder("4.3.3 Tareas de usuario completadas\n");
        sb.append(String.format(Locale.ROOT, "%-18s %s%n", "Usuario", "Tareas"));
        for (Map.Entry<String, Long> e : cantidades.entrySet()) {
            sb.append(String.format(Locale.ROOT, "%-18s %d%n", e.getKey(), e.getValue()));
        }
        return sb.toString();
    }

    static String nombre(String resultado) {
        switch (resultado) {
            case "FINALIZADO":
                return "Curso finalizado";
            case "CANCELADO":
                return "Cancelación";
            case "RECHAZADO":
                return "Rechazo";
            case "NO_VIABLE":
                return "No viable";
            case "SIN_RESPUESTA":
                return "Falta de respuesta";
            default:
                return resultado;
        }
    }

    /** Duración legible: milisegundos si es muy corta, y de segundos a días según la magnitud. */
    static String formatoDuracion(double ms) {
        if (ms < SEGUNDO) {
            return String.format(Locale.ROOT, "%.0f ms", ms);
        }
        if (ms < MINUTO) {
            return String.format(Locale.ROOT, "%.1f s", ms / SEGUNDO);
        }
        if (ms < HORA) {
            return String.format(Locale.ROOT, "%d min %02d s", (long) (ms / MINUTO), (long) (ms % MINUTO / SEGUNDO));
        }
        if (ms < DIA) {
            return String.format(Locale.ROOT, "%d h %02d min", (long) (ms / HORA), (long) (ms % HORA / MINUTO));
        }
        return String.format(Locale.ROOT, "%d d %02d h", (long) (ms / DIA), (long) (ms % DIA / HORA));
    }
}
