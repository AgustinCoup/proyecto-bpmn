package unrc.cursos;

import org.flowable.engine.impl.cfg.ProcessEngineConfigurationImpl;
import org.flowable.engine.impl.util.CommandContextUtil;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.ExecutionListener;
import org.flowable.engine.runtime.ProcessInstance;
import java.util.List;

public class ContarCursosEnEjecucionListener implements ExecutionListener {
    @Override
    public void notify(DelegateExecution execution) {
        String currentId = execution.getProcessInstanceId();
        
        // Reutiliza el motor que esta ejecutando el listener (no crea otro motor ni otra conexion a la BD).
        ProcessEngineConfigurationImpl configuracion = CommandContextUtil.getProcessEngineConfiguration();
        List<ProcessInstance> instances = configuracion.getRuntimeService()
                .createProcessInstanceQuery()
                .processDefinitionKey("Process_Curso")
                .list();
        
        long count = instances.stream()
                .filter(i -> !i.getId().equals(currentId))
                .count();

        execution.setVariable("cursosEnEjecucion", (int) count);
    }
}
