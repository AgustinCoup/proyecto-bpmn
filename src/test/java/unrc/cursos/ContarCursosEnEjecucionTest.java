package unrc.cursos;

import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.ProcessEngines;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class ContarCursosEnEjecucionTest {

    private ProcessEngine engine;

    @BeforeEach
    public void setUp() {
        ProcessEngines.destroy();
        engine = ProcessEngineConfiguration
                .createStandaloneInMemProcessEngineConfiguration()
                .setJdbcUrl("jdbc:h2:mem:flowable_test;DB_CLOSE_DELAY=-1")
                .setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_DROP_CREATE)
                .buildProcessEngine();
        ProcessEngines.registerProcessEngine(engine);
    }

    @AfterEach
    public void tearDown() {
        if (engine != null) {
            engine.close();
        }
        ProcessEngines.destroy();
    }

    @Test
    public void testContarCursosSinInstanciasDaCero() {
        ContarCursosEnEjecucionListener listener = new ContarCursosEnEjecucionListener();
        DelegateExecution execution = Mockito.mock(DelegateExecution.class);
        when(execution.getProcessInstanceId()).thenReturn("instancia-actual-1");

        listener.notify(execution);

        verify(execution).setVariable("cursosEnEjecucion", 0);
    }
}
