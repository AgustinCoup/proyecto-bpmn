package unrc.cursos.analisis;

import org.flowable.engine.HistoryService;
import org.flowable.engine.IdentityService;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.history.HistoricActivityInstance;
import org.flowable.engine.history.HistoricProcessInstance;
import org.flowable.idm.api.User;
import org.flowable.task.api.history.HistoricTaskInstance;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Consultas de la consigna 4.3 sobre el historial de Flowable (API Java, sin REST).
 * Todas son de solo lectura y se calculan al momento de pedirlas.
 */
public final class ServicioAnalisis {

    public static final String PROCESO = "Process_Curso";

    /** Valores de la variable "resultado", en el orden en que se muestran. */
    public static final List<String> RESULTADOS = Collections.unmodifiableList(java.util.Arrays.asList(
            "FINALIZADO", "CANCELADO", "RECHAZADO", "NO_VIABLE", "SIN_RESPUESTA"));

    private static final String RAMA_FIN = "SubFin";
    private static final String INSCRIPCIONES_INICIO = "Nomina";
    private static final String INSCRIPCIONES_FIN = "Lista";
    private static final String MATERIALES = "Material";
    private static final String RECURSOS_INICIO = "Activity_12i2hpf";
    private static final List<String> RECURSOS_ACCIONES = java.util.Arrays.asList("Aula", "Virtual", "Equipo");
    private static final List<String> GRUPOS_PERSONAL = java.util.Arrays.asList("administracion", "docentes");
    private static final String TAREA_COMPLETADA = "completed";
    private static final String SIN_RESPONSABLE = "(sin responsable)";

    private final HistoryService historia;
    private final IdentityService identidad;

    public ServicioAnalisis(ProcessEngine motor) {
        this.historia = motor.getHistoryService();
        this.identidad = motor.getIdentityService();
    }

    /** 4.3.1: cantidad de instancias terminadas por resultado (las borradas por administración no cuentan). */
    public ResultadosSolicitudes resultadosSolicitudes() {
        Map<String, Long> cantidades = new LinkedHashMap<>();
        for (String resultado : RESULTADOS) {
            cantidades.put(resultado, 0L);
        }
        for (HistoricProcessInstance instancia : historia.createHistoricProcessInstanceQuery()
                .processDefinitionKey(PROCESO).finished().includeProcessVariables().list()) {
            if (instancia.getDeleteReason() != null) {
                continue;
            }
            Object valor = instancia.getProcessVariables().get("resultado");
            String clave = valor == null ? ResultadosSolicitudes.SIN_RESULTADO : valor.toString();
            cantidades.merge(clave, 1L, Long::sum);
        }
        return new ResultadosSolicitudes(cantidades);
    }

    /**
     * 4.3.2: duración promedio de cada rama de Preparar curso, sobre los cursos que llegaron al fin normal del
     * subproceso (las preparaciones interrumpidas por cancelación o por falta de aulas no llegan a ese fin).
     */
    public DuracionRamas duracionRamas() {
        Set<String> instancias = new LinkedHashSet<>();
        for (HistoricActivityInstance fin : historia.createHistoricActivityInstanceQuery()
                .activityId(RAMA_FIN).finished().list()) {
            instancias.add(fin.getProcessInstanceId());
        }
        List<Long> inscripciones = new ArrayList<>();
        List<Long> materiales = new ArrayList<>();
        List<Long> recursos = new ArrayList<>();
        for (String id : instancias) {
            if (!esInstanciaVigente(id)) {
                continue;
            }
            Map<String, List<HistoricActivityInstance>> porActividad = actividadesPorId(id);
            Long insc = duracion(primeraInicio(porActividad, INSCRIPCIONES_INICIO), ultimoFin(porActividad, INSCRIPCIONES_FIN));
            Long mat = duracion(primeraInicio(porActividad, MATERIALES), ultimoFin(porActividad, MATERIALES));
            Long rec = duracion(primeraInicio(porActividad, RECURSOS_INICIO), finRecursos(porActividad));
            if (insc != null && mat != null && rec != null) {
                inscripciones.add(insc);
                materiales.add(mat);
                recursos.add(rec);
            }
        }
        return new DuracionRamas(inscripciones.size(), promedio(inscripciones), promedio(materiales), promedio(recursos));
    }

    /** 4.3.3: tareas de usuario completadas por persona (sin pendientes, interrumpidas ni canceladas). */
    public Map<String, Long> tareasPorUsuario() {
        Map<String, Long> cantidades = new LinkedHashMap<>();
        for (String grupo : GRUPOS_PERSONAL) {
            for (User usuario : identidad.createUserQuery().memberOfGroup(grupo).orderByUserId().asc().list()) {
                cantidades.putIfAbsent(usuario.getId(), 0L);
            }
        }
        long sinResponsable = 0;
        for (HistoricTaskInstance tarea : historia.createHistoricTaskInstanceQuery().finished().list()) {
            if (!fueCompletada(tarea)) {
                continue;
            }
            String responsable = tarea.getAssignee();
            if (responsable == null || responsable.trim().isEmpty()) {
                sinResponsable++;
            } else {
                cantidades.merge(responsable, 1L, Long::sum);
            }
        }
        if (sinResponsable > 0) {
            cantidades.put(SIN_RESPONSABLE, sinResponsable);
        }
        return cantidades;
    }

    /**
     * Flowable 6 deja deleteReason en null al completar una tarea ("completed" en versiones viejas); cualquier otro
     * valor indica que la tarea se eliminó o se interrumpió (cancelación, terminación, borrado de la instancia).
     */
    private static boolean fueCompletada(HistoricTaskInstance tarea) {
        String motivo = tarea.getDeleteReason();
        return motivo == null || TAREA_COMPLETADA.equals(motivo);
    }

    private boolean esInstanciaVigente(String id) {
        HistoricProcessInstance instancia = historia.createHistoricProcessInstanceQuery().processInstanceId(id).singleResult();
        return instancia != null && instancia.getDeleteReason() == null;
    }

    private Map<String, List<HistoricActivityInstance>> actividadesPorId(String instanciaId) {
        Map<String, List<HistoricActivityInstance>> mapa = new LinkedHashMap<>();
        for (HistoricActivityInstance actividad : historia.createHistoricActivityInstanceQuery()
                .processInstanceId(instanciaId).list()) {
            mapa.computeIfAbsent(actividad.getActivityId(), k -> new ArrayList<>()).add(actividad);
        }
        return mapa;
    }

    private static Date primeraInicio(Map<String, List<HistoricActivityInstance>> actividades, String id) {
        Date menor = null;
        for (HistoricActivityInstance a : actividades.getOrDefault(id, Collections.emptyList())) {
            if (menor == null || a.getStartTime().before(menor)) {
                menor = a.getStartTime();
            }
        }
        return menor;
    }

    private static Date ultimoFin(Map<String, List<HistoricActivityInstance>> actividades, String id) {
        Date mayor = null;
        for (HistoricActivityInstance a : actividades.getOrDefault(id, Collections.emptyList())) {
            if (a.getEndTime() != null && (mayor == null || a.getEndTime().after(mayor))) {
                mayor = a.getEndTime();
            }
        }
        return mayor;
    }

    /** La rama de recursos termina cuando se completa la última de las acciones seleccionadas. */
    private static Date finRecursos(Map<String, List<HistoricActivityInstance>> actividades) {
        Date mayor = null;
        for (String accion : RECURSOS_ACCIONES) {
            Date fin = ultimoFin(actividades, accion);
            if (fin != null && (mayor == null || fin.after(mayor))) {
                mayor = fin;
            }
        }
        return mayor;
    }

    private static Long duracion(Date inicio, Date fin) {
        if (inicio == null || fin == null) {
            return null;
        }
        return Math.max(0L, fin.getTime() - inicio.getTime());
    }

    private static double promedio(List<Long> valores) {
        if (valores.isEmpty()) {
            return 0;
        }
        long suma = 0;
        for (long v : valores) {
            suma += v;
        }
        return (double) suma / valores.size();
    }
}
