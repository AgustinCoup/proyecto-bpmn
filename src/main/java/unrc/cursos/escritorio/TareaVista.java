package unrc.cursos.escritorio;

import java.util.Date;

/** Fila de la tabla de tareas "Preparar materiales". */
public final class TareaVista {

    private final String id;
    private final String nombre;
    private final String asignadaA;
    private final Date creada;
    private final String processInstanceId;
    private final String businessKey;

    public TareaVista(String id, String nombre, String asignadaA, Date creada,
                      String processInstanceId, String businessKey) {
        this.id = id;
        this.nombre = nombre;
        this.asignadaA = asignadaA;
        this.creada = creada;
        this.processInstanceId = processInstanceId;
        this.businessKey = businessKey;
    }

    public String getId() {
        return id;
    }

    public String getNombre() {
        return nombre;
    }

    public String getAsignadaA() {
        return asignadaA;
    }

    public Date getCreada() {
        return creada;
    }

    public String getProcessInstanceId() {
        return processInstanceId;
    }

    public String getBusinessKey() {
        return businessKey;
    }

    public boolean estaDisponible() {
        return asignadaA == null || asignadaA.trim().isEmpty();
    }

    public String descripcionEstado() {
        return estaDisponible() ? "Disponible para reclamar" : "Asignada a " + asignadaA;
    }
}
