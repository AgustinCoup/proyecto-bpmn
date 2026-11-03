package unrc.cursos.simulador;

/**
 * Comunicaciones que la empresa puede enviar al proceso.
 * 
 * Los nombres de mensajes coinciden con Contrato.md, seccion 5, y con el
 * modelo BPMN. La nomina no es un evento de mensaje: es una tarea de
 * recepcion (receive task) que se despierta con la accion "signal".
 */
public enum AccionEmpresa {

    ACEPTAR("Aceptar la propuesta", Tipo.MENSAJE, "Aceptación", "Aceptar", "fechaCurso"),
    RECHAZAR("Rechazar la propuesta", Tipo.MENSAJE, "Rechazo", "Rechazar", null),
    MODIFICAR("Pedir modificaciones", Tipo.MENSAJE, "Solicitud de modificaciones", "Modificar", "observaciones"),
    NOMINA("Enviar nomina de participantes", Tipo.SENAL, null, "Nomina", "participantes"),
    CANCELAR("Cancelar durante la preparacion", Tipo.MENSAJE, "Cancelación", "Event_1g4xmqo", null);

    public enum Tipo {
        MENSAJE,
        SENAL
    }

    private final String etiqueta;
    private final Tipo tipo;
    private final String nombreMensaje;
    private final String actividad;
    private final String variable;

    AccionEmpresa(String etiqueta, Tipo tipo, String nombreMensaje, String actividad, String variable) {
        this.etiqueta = etiqueta;
        this.tipo = tipo;
        this.nombreMensaje = nombreMensaje;
        this.actividad = actividad;
        this.variable = variable;
    }

    public String getEtiqueta() {
        return etiqueta;
    }

    public Tipo getTipo() {
        return tipo;
    }

    /** Nombre exacto del mensaje BPMN. Es null para la nomina. */
    public String getNombreMensaje() {
        return nombreMensaje;
    }

    /** ID de la actividad que espera: evento de captura o receive task. */
    public String getActividad() {
        return actividad;
    }

    /** Variable que lleva la comunicacion, o null si no lleva ninguna. */
    public String getVariable() {
        return variable;
    }
}
