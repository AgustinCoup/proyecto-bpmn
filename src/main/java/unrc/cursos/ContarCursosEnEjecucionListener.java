package unrc.cursos;

import org.flowable.engine.ProcessEngines;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.ExecutionListener;

/**
 * Calcula la entrada de la regla DMN de viabilidad (consigna 3.1): la cantidad de OTRAS
 * instancias del proceso de organización de cursos que todavía no finalizaron.
 *
 * Se engancha al evento "start" de la decision task "Evaluar Viabilidad", es decir, corre justo
 * antes de que Flowable evalúe la tabla de decisión, y deja el resultado en la variable
 * "cursosEnEjecucion". El valor lo obtiene el motor; nadie lo ingresa a mano.
 */
public class ContarCursosEnEjecucionListener implements ExecutionListener {

    /** Clave del proceso: al consultar por clave se cuentan todas las versiones desplegadas. */
    static final String CLAVE_PROCESO = "Process_Curso";
    static final String VARIABLE_SALIDA = "cursosEnEjecucion";

    @Override
    public void notify(DelegateExecution execution) {
        RuntimeService runtimeService = ProcessEngines.getDefaultProcessEngine().getRuntimeService();
        long enEjecucion = contarOtras(runtimeService, execution.getProcessInstanceId());
        execution.setVariable(VARIABLE_SALIDA, enEjecucion);
    }

    /**
     * Instancias sin finalizar de todas las versiones, sin la propia. La propia se excluye por id:
     * sólo se resta si realmente aparece en la consulta (depende del momento de la transacción).
     */
    static long contarOtras(RuntimeService runtimeService, String idInstanciaPropia) {
        long sinFinalizar = runtimeService.createProcessInstanceQuery()
                .processDefinitionKey(CLAVE_PROCESO)
                .count();
        long propiaVisible = runtimeService.createProcessInstanceQuery()
                .processDefinitionKey(CLAVE_PROCESO)
                .processInstanceId(idInstanciaPropia)
                .count();
        return sinFinalizar - propiaVisible;
    }
}
