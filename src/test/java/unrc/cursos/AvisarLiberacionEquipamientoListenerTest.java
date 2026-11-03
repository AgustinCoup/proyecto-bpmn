package unrc.cursos;

import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.ProcessEngines;
import org.flowable.engine.delegate.TaskListener;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.service.delegate.DelegateTask;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

public class AvisarLiberacionEquipamientoListenerTest {

    private ProcessEngine engine;

    @BeforeEach
    public void setUp() {
        ProcessEngines.destroy();
        engine = ProcessEngineConfiguration
                .createStandaloneInMemProcessEngineConfiguration()
                .setJdbcUrl("jdbc:h2:mem:flowable_liberacion;DB_CLOSE_DELAY=-1")
                .setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_DROP_CREATE)
                .buildProcessEngine();
        ProcessEngines.registerProcessEngine(engine);
        engine.getRepositoryService().createDeployment()
                .addClasspathResource("proceso-espera-liberacion.bpmn20.xml").deploy();
    }

    @AfterEach
    public void tearDown() {
        engine.close();
        ProcessEngines.destroy();
    }

    private DelegateTask tarea(String evento, String processInstanceId) {
        DelegateTask t = Mockito.mock(DelegateTask.class);
        when(t.getEventName()).thenReturn(evento);
        when(t.getProcessInstanceId()).thenReturn(processInstanceId);
        return t;
    }

    @Test
    public void destrabaLaEsperaAlCompletarse() {
        ProcessInstance pi = engine.getRuntimeService().startProcessInstanceByKey("esperaLiberacion");
        new AvisarLiberacionEquipamientoListener().notify(tarea(TaskListener.EVENTNAME_COMPLETE, pi.getId()));
        assertEquals(0, engine.getRuntimeService().createProcessInstanceQuery().processInstanceId(pi.getId()).count());
    }

    @Test
    public void sinEsperaNoHaceNada() {
        new AvisarLiberacionEquipamientoListener().notify(tarea(TaskListener.EVENTNAME_COMPLETE, "no-existe"));
    }

    @Test
    public void ignoraOtrosEventos() {
        ProcessInstance pi = engine.getRuntimeService().startProcessInstanceByKey("esperaLiberacion");
        new AvisarLiberacionEquipamientoListener().notify(tarea(TaskListener.EVENTNAME_CREATE, pi.getId()));
        assertEquals(1, engine.getRuntimeService().createProcessInstanceQuery().processInstanceId(pi.getId()).count());
    }
}
