package unrc.cursos.escritorio;

import org.flowable.engine.IdentityService;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.idm.api.Group;
import org.flowable.idm.api.User;
import org.flowable.identitylink.api.IdentityLink;
import org.flowable.identitylink.api.IdentityLinkType;
import org.flowable.task.api.Task;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Operaciones de la app de escritorio usando la API Java de Flowable.
 * La instancia del motor apunta directamente a la base PostgreSQL del
 * motor; no se usa la API REST.
 */
public final class ServicioTareas {

    public static final String TAREA_MATERIALES = "Preparar materiales";

    private final ProcessEngine motor;
    private final IdentityService identityService;
    private final TaskService taskService;
    private final RuntimeService runtimeService;

    public ServicioTareas(ProcessEngine motor) {
        this.motor = motor;
        this.identityService = motor.getIdentityService();
        this.taskService = motor.getTaskService();
        this.runtimeService = motor.getRuntimeService();
    }

    public static ServicioTareas desdeConfiguracion(ConfiguracionBd configuracion) {
        return new ServicioTareas(configuracion.crearMotor());
    }

    public boolean autenticar(String usuario, char[] clave) {
        if (usuario == null || usuario.trim().isEmpty() || clave == null) {
            return false;
        }
        String id = usuario.trim();
        User user = identityService.createUserQuery().userId(id).singleResult();
        if (user == null) {
            return false;
        }
        return identityService.checkPassword(id, new String(clave));
    }

    public List<String> grupos(String usuario) {
        List<Group> grupos = identityService.createGroupQuery()
                .groupMember(usuario)
                .list();
        return grupos.stream().map(Group::getId).collect(Collectors.toList());
    }

    /**
     * Tareas "Preparar materiales" asignadas al usuario o disponibles para
     * reclamar por alguno de sus grupos. Las tareas ya asignadas a otra
     * persona no se muestran.
     */
    public List<TareaVista> listarTareasPrepararMateriales(String usuario) {
        Map<String, Task> encontradas = new LinkedHashMap<>();

        for (Task tarea : taskService.createTaskQuery()
                .taskName(TAREA_MATERIALES)
                .taskAssignee(usuario)
                .orderByTaskCreateTime().asc()
                .list()) {
            encontradas.put(tarea.getId(), tarea);
        }

        List<String> grupos = grupos(usuario);
        if (!grupos.isEmpty()) {
            for (Task tarea : taskService.createTaskQuery()
                    .taskName(TAREA_MATERIALES)
                    .taskUnassigned()
                    .taskCandidateGroupIn(grupos)
                    .orderByTaskCreateTime().asc()
                    .list()) {
                encontradas.put(tarea.getId(), tarea);
            }
        }

        for (Task tarea : taskService.createTaskQuery()
                .taskName(TAREA_MATERIALES)
                .taskUnassigned()
                .taskCandidateUser(usuario)
                .orderByTaskCreateTime().asc()
                .list()) {
            encontradas.put(tarea.getId(), tarea);
        }

        List<TareaVista> resultado = new ArrayList<>();
        for (Task tarea : encontradas.values()) {
            resultado.add(new TareaVista(
                    tarea.getId(),
                    tarea.getName(),
                    tarea.getAssignee(),
                    tarea.getCreateTime(),
                    tarea.getProcessInstanceId(),
                    businessKey(tarea.getProcessInstanceId())));
        }
        return resultado;
    }

    public void reclamar(String tareaId, String usuario) {
        Task tarea = buscarTarea(tareaId);
        if (!estaDisponible(tarea)) {
            throw new IllegalStateException(
                    "La tarea ya esta reclamada por " + tarea.getAssignee() + ".");
        }
        if (!esCandidato(tareaId, usuario)) {
            throw new IllegalStateException(
                    "La tarea no esta disponible para el usuario " + usuario
                            + " ni para sus grupos.");
        }
        taskService.claim(tareaId, usuario);
    }

    public void completar(String tareaId, String usuario) {
        Task tarea = buscarTarea(tareaId);
        if (tarea.getAssignee() == null || !usuario.equals(tarea.getAssignee())) {
            throw new IllegalStateException(
                    "Solo puede completar la tarea quien la tiene asignada. "
                            + "Reclamala primero.");
        }
        taskService.complete(tareaId);
    }

    public void cerrar() {
        motor.close();
    }

    /** Visible para tests: el motor Java en uso. */
    public ProcessEngine getMotor() {
        return motor;
    }

    private Task buscarTarea(String tareaId) {
        if (tareaId == null || tareaId.trim().isEmpty()) {
            throw new IllegalArgumentException("El ID de tarea no puede estar vacio.");
        }
        Task tarea = taskService.createTaskQuery().taskId(tareaId).singleResult();
        if (tarea == null) {
            throw new IllegalStateException("La tarea " + tareaId + " no existe o ya fue completada.");
        }
        return tarea;
    }

    private boolean esCandidato(String tareaId, String usuario) {
        List<String> grupos = grupos(usuario);
        List<IdentityLink> enlaces = taskService.getIdentityLinksForTask(tareaId);
        for (IdentityLink enlace : enlaces) {
            if (!IdentityLinkType.CANDIDATE.equals(enlace.getType())) {
                continue;
            }
            if (usuario.equals(enlace.getUserId()) || grupos.contains(enlace.getGroupId())) {
                return true;
            }
        }
        return false;
    }

    private String businessKey(String processInstanceId) {
        ProcessInstance instancia = runtimeService.createProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult();
        return instancia == null ? null : instancia.getBusinessKey();
    }

    private static boolean estaDisponible(Task tarea) {
        return tarea.getAssignee() == null || tarea.getAssignee().trim().isEmpty();
    }
}
