package unrc.cursos.simulador;

import java.util.Objects;

/** Ejecucion activa devuelta por GET /runtime/executions. */
public final class EjecucionActiva {

    private final String id;
    private final String activityId;

    public EjecucionActiva(String id, String activityId) {
        this.id = Objects.requireNonNull(id, "id");
        this.activityId = activityId;
    }

    public String getId() {
        return id;
    }

    public String getActivityId() {
        return activityId;
    }
}
