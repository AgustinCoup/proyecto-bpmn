package unrc.cursos.analisis;

/** Duración promedio, en milisegundos, de las tres ramas de Preparar curso (consigna 4.3.2). */
public final class DuracionRamas {

    private final int cursos;
    private final double inscripcionesMs;
    private final double materialesMs;
    private final double recursosMs;

    DuracionRamas(int cursos, double inscripcionesMs, double materialesMs, double recursosMs) {
        this.cursos = cursos;
        this.inscripcionesMs = inscripcionesMs;
        this.materialesMs = materialesMs;
        this.recursosMs = recursosMs;
    }

    /** Cantidad de cursos que completaron normalmente la preparación y entran en el promedio. */
    public int cursos() {
        return cursos;
    }

    public double inscripcionesMs() {
        return inscripcionesMs;
    }

    public double materialesMs() {
        return materialesMs;
    }

    public double recursosMs() {
        return recursosMs;
    }
}
