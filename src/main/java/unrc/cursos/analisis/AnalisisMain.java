package unrc.cursos.analisis;

import org.flowable.engine.ProcessEngine;
import unrc.cursos.escritorio.ConfiguracionBd;

/**
 * Consultas de la consigna 4.3 por consola (sin interfaz gráfica). Usa la API Java de Flowable contra la BD del
 * motor, con las mismas variables FLOWABLE_DB_* que la app de escritorio.
 */
public final class AnalisisMain {

    private AnalisisMain() {
    }

    public static void main(String[] args) {
        ProcessEngine motor = null;
        try {
            motor = ConfiguracionBd.desdeEntorno().crearMotor();
            System.out.print(ReporteAnalisis.generar(new ServicioAnalisis(motor)));
        } catch (RuntimeException e) {
            System.err.println("No se pudo consultar el historial: " + e.getMessage());
            System.exit(1);
        } finally {
            if (motor != null) {
                motor.close();
            }
        }
    }
}
