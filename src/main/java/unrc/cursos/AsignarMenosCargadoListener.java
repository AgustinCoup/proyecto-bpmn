package unrc.cursos;

import org.flowable.engine.ProcessEngines;
import org.flowable.engine.delegate.TaskListener;
import org.flowable.task.service.delegate.DelegateTask;
import org.flowable.idm.api.User;
import java.util.List;

public class AsignarMenosCargadoListener implements TaskListener {
    @Override
    public void notify(DelegateTask task) {
        if (!TaskListener.EVENTNAME_CREATE.equals(task.getEventName())) {
            return;
        }

        // Usamos getIdentityService() en lugar de getIdmService()
        List<User> admins = ProcessEngines.getDefaultProcessEngine()
                .getIdentityService()
                .createUserQuery()
                .memberOfGroup("administracion")
                .list();

        if (admins == null || admins.isEmpty()) {
            return;
        }

        User elegido = null;
        long minCarga = Long.MAX_VALUE;

        for (User admin : admins) {
            String adminId = admin.getId();
            long carga = ProcessEngines.getDefaultProcessEngine()
                    .getTaskService()
                    .createTaskQuery()
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
            task.setAssignee(elegido.getId());
        }
    }
}