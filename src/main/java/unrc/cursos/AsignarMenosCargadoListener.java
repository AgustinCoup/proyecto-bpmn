package unrc.cursos;

import org.flowable.engine.IdentityService;
import org.flowable.engine.TaskService;
import org.flowable.engine.delegate.TaskListener;
import org.flowable.engine.impl.cfg.ProcessEngineConfigurationImpl;
import org.flowable.engine.impl.util.CommandContextUtil;
import org.flowable.engine.impl.util.TaskHelper;
import org.flowable.task.service.delegate.DelegateTask;
import org.flowable.task.service.impl.persistence.entity.TaskEntity;
import org.flowable.idm.api.User;
import java.util.List;

public class AsignarMenosCargadoListener implements TaskListener {
    @Override
    public void notify(DelegateTask task) {
        if (!TaskListener.EVENTNAME_CREATE.equals(task.getEventName())) {
            return;
        }

        // Conserva una asignacion previa definida en el modelo.
        if (task.getAssignee() != null && !task.getAssignee().trim().isEmpty()) {
            return;
        }

        // Reutiliza el motor que esta ejecutando el listener: no crea otro motor ni otra conexion a la BD.
        ProcessEngineConfigurationImpl configuracion = CommandContextUtil.getProcessEngineConfiguration();
        IdentityService identityService = configuracion.getIdentityService();
        TaskService taskService = configuracion.getTaskService();

        List<User> admins = identityService.createUserQuery()
                .memberOfGroup("administracion")
                .orderByUserId().asc()
                .list();

        if (admins == null || admins.isEmpty()) {
            return;
        }

        User elegido = null;
        long minCarga = Long.MAX_VALUE;

        for (User admin : admins) {
            String adminId = admin.getId();
            long carga = taskService.createTaskQuery()
                    .taskAssignee(adminId)
                    .count();

            if (carga < minCarga) {
                minCarga = carga;
                elegido = admin;
            } else if (carga == minCarga) {
                if (elegido == null || adminId.compareTo(elegido.getId()) < 0) {
                    elegido = admin;
                }
            }
        }

        if (elegido != null) {
            asignar(task, elegido.getId());
        }
    }

    /**
     * Con setAssignee directo la tarea queda asignada en tiempo de ejecucion, pero la tarea historica (que ya
     * se registro antes de correr este listener) sigue sin responsable y las consultas del historial no la
     * atribuyen a nadie. TaskHelper.changeTaskAssignee actualiza las dos cosas.
     */
    private static void asignar(DelegateTask task, String usuario) {
        if (task instanceof TaskEntity) {
            TaskHelper.changeTaskAssignee((TaskEntity) task, usuario);
        } else {
            task.setAssignee(usuario);
        }
    }
}
