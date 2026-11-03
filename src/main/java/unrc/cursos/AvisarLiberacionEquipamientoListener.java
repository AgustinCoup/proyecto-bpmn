package unrc.cursos;

import org.flowable.engine.ProcessEngines;
import org.flowable.engine.delegate.TaskListener;
import org.flowable.engine.runtime.Execution;
import org.flowable.task.service.delegate.DelegateTask;

/**
 * Task Listener (evento complete) de "Liberar Equipamiento" (Activity_1m08pcl).
 * Si la instancia esta esperando en "EsperarLiberacion" (camino de cancelacion),
 * la destraba para que "Notificar Cierre" ocurra despues de liberar el equipamiento.
 * En el fin normal (CompensarFin) no hay nadie esperando y no hace nada.
 */
public class AvisarLiberacionEquipamientoListener implements TaskListener {

    static final String ESPERA = "EsperarLiberacion";

    @Override
    public void notify(DelegateTask task) {
        if (!TaskListener.EVENTNAME_COMPLETE.equals(task.getEventName())) {
            return;
        }
        Execution espera = ProcessEngines.getDefaultProcessEngine()
                .getRuntimeService()
                .createExecutionQuery()
                .processInstanceId(task.getProcessInstanceId())
                .activityId(ESPERA)
                .singleResult();
        if (espera != null) {
            ProcessEngines.getDefaultProcessEngine().getRuntimeService().trigger(espera.getId());
        }
    }
}
