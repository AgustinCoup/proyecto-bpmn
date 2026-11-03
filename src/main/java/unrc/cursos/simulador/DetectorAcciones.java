package unrc.cursos.simulador;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Decide que comunicaciones estan habilitadas a partir del estado de la
 * instancia. No hace llamadas de red: es la parte que se prueba con tests.
 */
public final class DetectorAcciones {

    public List<AccionHabilitada> detectar(EstadoInstancia estado) {
        List<AccionHabilitada> habilitadas = new ArrayList<>();
        for (AccionEmpresa accion : AccionEmpresa.values()) {
            if (accion.getTipo() == AccionEmpresa.Tipo.MENSAJE) {
                Optional<SuscripcionEvento> suscripcion =
                        estado.buscarSuscripcionMensaje(accion.getNombreMensaje());
                suscripcion.ifPresent(s -> habilitadas.add(
                        new AccionHabilitada(accion, s.getExecutionId())));
            } else {
                Optional<EjecucionActiva> ejecucion =
                        estado.buscarEjecucionEnActividad(accion.getActividad());
                ejecucion.ifPresent(e -> habilitadas.add(
                        new AccionHabilitada(accion, e.getId())));
            }
        }
        return habilitadas;
    }
}
