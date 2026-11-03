package unrc.cursos.simulador;

import java.util.Objects;

/** Suscripcion activa devuelta por GET /runtime/event-subscriptions. */
public final class SuscripcionEvento {

    private final String eventType;
    private final String eventName;
    private final String activityId;
    private final String executionId;

    public SuscripcionEvento(String eventType, String eventName, String activityId, String executionId) {
        this.eventType = Objects.requireNonNull(eventType, "eventType");
        this.eventName = eventName;
        this.activityId = activityId;
        this.executionId = Objects.requireNonNull(executionId, "executionId");
    }

    public String getEventType() {
        return eventType;
    }

    public String getEventName() {
        return eventName;
    }

    public String getActivityId() {
        return activityId;
    }

    public String getExecutionId() {
        return executionId;
    }

    public boolean esMensaje() {
        return eventType != null && eventType.toLowerCase().startsWith("message");
    }
}
