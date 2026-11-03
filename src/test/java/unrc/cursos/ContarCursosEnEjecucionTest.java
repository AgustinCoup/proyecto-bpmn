package unrc.cursos;

import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.ProcessEngines;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.TaskListener;
import org.flowable.idm.api.Group;
import org.flowable.idm.api.User;
import org.flowable.task.api.Task;
import org.flowable.task.service.delegate.DelegateTask;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.mockito.Mockito.*;

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
    public void testAsignarMenosCargadoConDesempateAlfabetico() {
        // Creamos el grupo administracion y los dos usuarios del contrato
        Group grp = engine.getIdentityService().newGroup("administracion");
        engine.getIdentityService().saveGroup(grp);

        User u1 = engine.getIdentityService().newUser("jefeAdmin");
        User u2 = engine.getIdentityService().newUser("admin2");
        engine.getIdentityService().saveUser(u1);
        engine.getIdentityService().saveUser(u2);
        engine.getIdentityService().createMembership("jefeAdmin", "administracion");
        engine.getIdentityService().createMembership("admin2", "administracion");

        AsignarMenosCargadoListener listener = new AsignarMenosCargadoListener();

        // Caso 1: Empate en 0 tareas -> gana "admin2" por orden alfabético ("admin2" < "jefeAdmin")
        DelegateTask tareaNueva1 = Mockito.mock(DelegateTask.class);
        when(tareaNueva1.getEventName()).thenReturn(TaskListener.EVENTNAME_CREATE);
        listener.notify(tareaNueva1);
        verify(tareaNueva1).setAssignee("admin2");

        // Caso 2: Le asignamos 1 tarea pendiente a "admin2" -> ahora gana "jefeAdmin" (0 vs 1)
        Task tPendiente = engine.getTaskService().newTask();
        tPendiente.setAssignee("admin2");
        engine.getTaskService().saveTask(tPendiente);

        DelegateTask tareaNueva2 = Mockito.mock(DelegateTask.class);
        when(tareaNueva2.getEventName()).thenReturn(TaskListener.EVENTNAME_CREATE);
        listener.notify(tareaNueva2);
        verify(tareaNueva2).setAssignee("jefeAdmin");
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