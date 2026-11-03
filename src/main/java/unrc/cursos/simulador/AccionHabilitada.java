package unrc.cursos.simulador;

import java.util.Objects;

/** Accion concreta que puede enviarse ahora, con la ejecucion destino. */
public final class AccionHabilitada {

    private final AccionEmpresa accion;
    private final String executionId;

    public AccionHabilitada(AccionEmpresa accion, String executionId) {
        this.accion = Objects.requireNonNull(accion, "accion");
        this.executionId = Objects.requireNonNull(executionId, "executionId");
    }

    public AccionEmpresa getAccion() {
        return accion;
    }

    public String getExecutionId() {
        return executionId;
    }
}
