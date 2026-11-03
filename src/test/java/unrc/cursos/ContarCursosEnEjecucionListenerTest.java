package unrc.cursos;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.runtime.Execution;
import org.flowable.engine.runtime.ProcessInstance;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ContarCursosEnEjecucionListenerTest {

    private ProcessEngine engine;

    @BeforeEach
    void arrancarMotor() {
        engine = ProcessEngineConfiguration.createStandaloneInMemProcessEngineConfiguration()
                .setJdbcUrl("jdbc:h2:mem:conteo;DB_CLOSE_DELAY=-1")
                .setAsyncExecutorActivate(false)
                .buildProcessEngine();
        engine.getRepositoryService().createDeployment()
                .addClasspathResource("proceso-conteo.bpmn20.xml").deploy();
    }

    @AfterEach
    void cerrarMotor() {
        engine.close();
    }

    private long iniciarYLeer() {
        ProcessInstance pi = engine.getRuntimeService().startProcessInstanceByKey("Process_Curso");
        Object valor = engine.getRuntimeService().getVariable(pi.getId(), "cursosEnEjecucion");
        return (Long) valor;
    }

    @Test
    void cuentaCeroCuandoNoHayOtrasInstancias() {
        assertEquals(0L, iniciarYLeer());
    }

    @Test
    void noCuentaLaPropiaInstanciaSinRestarAciegas() {
        iniciarYLeer();
        iniciarYLeer();
        assertEquals(2L, iniciarYLeer());
    }

    @Test
    void noCuentaLasInstanciasYaTerminadas() {
        iniciarYLeer();
        ProcessInstance segunda = engine.getRuntimeService().startProcessInstanceByKey("Process_Curso");
        Execution espera = engine.getRuntimeService().createExecutionQuery()
                .processInstanceId(segunda.getId()).activityId("espera").singleResult();
        engine.getRuntimeService().trigger(espera.getId());
        assertEquals(1L, iniciarYLeer());
    }

    @Test
    void cuentaTodasLasVersionesDesplegadas() {
        iniciarYLeer();
        engine.getRepositoryService().createDeployment()
                .addClasspathResource("proceso-conteo.bpmn20.xml").deploy();
        iniciarYLeer();
        assertEquals(2L, iniciarYLeer());
    }
}
