package unrc.cursos;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.flowable.engine.delegate.BpmnError;

public class ReservarAulaDelegate implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        Boolean simularFalta = (Boolean) execution.getVariable("simularFaltaAulas");
        if (simularFalta != null && simularFalta) {
            throw new BpmnError("SIN_AULAS", "No hay aulas físicas disponibles para las fechas requeridas.");
        }
        execution.setVariable("aulaAsignada", "Aula Magna Principal");
    }
}