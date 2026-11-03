package unrc.cursos;

import org.flowable.engine.ProcessEngines;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.ExecutionListener;
import org.flowable.engine.runtime.ProcessInstance;
import java.util.List;

public class ContarCursosEnEjecucionListener implements ExecutionListener {
    @Override
    public void notify(DelegateExecution execution) {
        String currentId = execution.getProcessInstanceId();
        
        // Obtenemos el RuntimeService desde ProcessEngines de Flowable
        List<ProcessInstance> instances = ProcessEngines.getDefaultProcessEngine()
                .getRuntimeService()
                .createProcessInstanceQuery()
                .processDefinitionKey("Process_Curso")
                .list();
        
        long count = instances.stream()
                .filter(i -> !i.getId().equals(currentId))
                .count();

        execution.setVariable("cursosEnEjecucion", (int) count);
    }
}
