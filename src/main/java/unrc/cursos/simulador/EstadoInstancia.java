package unrc.cursos.simulador;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Estado observable de una instancia: ejecuciones activas y suscripciones
 * a eventos. Es inmutable para que la deteccion de acciones sea facil de
 * testear sin red.
 */
public final class EstadoInstancia {

    private final String processInstanceId;
    private final List<EjecucionActiva> ejecuciones;
    private final List<SuscripcionEvento> suscripciones;

    public EstadoInstancia(String processInstanceId,
                           List<EjecucionActiva> ejecuciones,
                           List<SuscripcionEvento> suscripciones) {
        this.processInstanceId = processInstanceId;
        this.ejecuciones = Collections.unmodifiableList(new ArrayList<>(ejecuciones));
        this.suscripciones = Collections.unmodifiableList(new ArrayList<>(suscripciones));
    }

    public String getProcessInstanceId() {
        return processInstanceId;
    }

    public List<EjecucionActiva> getEjecuciones() {
        return ejecuciones;
    }

    public List<SuscripcionEvento> getSuscripciones() {
        return suscripciones;
    }

    public Optional<SuscripcionEvento> buscarSuscripcionMensaje(String nombreMensaje) {
        return suscripciones.stream()
                .filter(SuscripcionEvento::esMensaje)
                .filter(s -> nombreMensaje != null && nombreMensaje.equals(s.getEventName()))
                .findFirst();
    }

    public Optional<EjecucionActiva> buscarEjecucionEnActividad(String activityId) {
        return ejecuciones.stream()
                .filter(e -> activityId != null && activityId.equals(e.getActivityId()))
                .findFirst();
    }

    /** Nombres de mensajes esperando, utiles para mostrar el estado al usuario. */
    public List<String> nombresMensajesEsperando() {
        List<String> nombres = new ArrayList<>();
        for (SuscripcionEvento s : suscripciones) {
            if (s.esMensaje() && s.getEventName() != null && !nombres.contains(s.getEventName())) {
                nombres.add(s.getEventName());
            }
        }
        return nombres;
    }
}
