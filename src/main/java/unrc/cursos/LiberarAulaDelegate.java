package unrc.cursos;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;

public class LiberarAulaDelegate implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        execution.setVariable("aulaLiberada", true);
    }
}