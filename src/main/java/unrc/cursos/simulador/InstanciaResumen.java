package unrc.cursos.simulador;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/** Datos minimos de una instancia para mostrarla en el menu. */
public final class InstanciaResumen {

    private final String id;
    private final String businessKey;
    private final String processDefinitionName;
    private final String startTime;
    private final Map<String, Object> variables;

    public InstanciaResumen(String id, String businessKey, String processDefinitionName,
                            String startTime, Map<String, Object> variables) {
        this.id = id;
        this.businessKey = businessKey;
        this.processDefinitionName = processDefinitionName;
        this.startTime = startTime;
        this.variables = Collections.unmodifiableMap(new LinkedHashMap<>(variables));
    }

    public String getId() {
        return id;
    }

    public String getBusinessKey() {
        return businessKey;
    }

    public String getProcessDefinitionName() {
        return processDefinitionName;
    }

    public String getStartTime() {
        return startTime;
    }

    public Map<String, Object> getVariables() {
        return variables;
    }

    public Object getVariable(String nombre) {
        return variables.get(nombre);
    }

    public String descripcionCorta() {
        StringBuilder sb = new StringBuilder();
        sb.append("instancia ").append(id);
        if (businessKey != null && !businessKey.trim().isEmpty()) {
            sb.append(" | businessKey ").append(businessKey);
        }
        Object cursoId = variables.get("cursoId");
        if (cursoId != null) {
            sb.append(" | cursoId ").append(cursoId);
        }
        Object empresaId = variables.get("empresaId");
        if (empresaId != null) {
            sb.append(" | empresaId ").append(empresaId);
        }
        Object estado = variables.get("estadoCurso");
        if (estado != null) {
            sb.append(" | estado ").append(estado);
        }
        return sb.toString();
    }
}
