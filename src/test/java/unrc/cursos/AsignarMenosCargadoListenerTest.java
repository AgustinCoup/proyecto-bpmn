package unrc.cursos;

import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.ProcessEngines;
import org.flowable.engine.delegate.TaskListener;
import org.flowable.idm.api.Group;
import org.flowable.idm.api.User;
import org.flowable.task.api.Task;
import org.flowable.task.service.delegate.DelegateTask;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AsignarMenosCargadoListenerTest {

    private ProcessEngine engine;
    private AsignarMenosCargadoListener listener;

    @BeforeEach
    void setUp() {
        ProcessEngines.destroy();
        engine = ProcessEngineConfiguration
                .createStandaloneInMemProcessEngineConfiguration()
                .setJdbcUrl("jdbc:h2:mem:asignar_menos_cargado;DB_CLOSE_DELAY=-1")
                .setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_DROP_CREATE)
                .setAsyncExecutorActivate(false)
                .buildProcessEngine();
        ProcessEngines.registerProcessEngine(engine);
        listener = new AsignarMenosCargadoListener();
    }

    @AfterEach
    void tearDown() {
        if (engine != null) {
            engine.close();
        }
        ProcessEngines.destroy();
    }

    @Test
    void asignaAlAdministrativoConMenosTareasAsignadas() {
        crearAdministrativos();
        asignarTareaPendiente("admin2");

        DelegateTask nueva = tarea(TaskListener.EVENTNAME_CREATE);
        listener.notify(nueva);

        verify(nueva).setAssignee("jefeAdmin");
    }

    @Test
    void enEmpateDesempataPorOrdenAlfabeticoDelId() {
        crearAdministrativos();

        DelegateTask nueva = tarea(TaskListener.EVENTNAME_CREATE);
        listener.notify(nueva);

        verify(nueva).setAssignee("admin2");
    }

    @Test
    void noCuentaLasTareasQueSoloTienenGrupoCandidato() {
        crearAdministrativos();
        Task candidata = engine.getTaskService().newTask();
        candidata.setName("Tarea sin reclamar");
        engine.getTaskService().saveTask(candidata);
        engine.getTaskService().addCandidateGroup(candidata.getId(), "administracion");

        assertEquals(0, engine.getTaskService().createTaskQuery().taskAssignee("admin2").count());
        assertEquals(0, engine.getTaskService().createTaskQuery().taskAssignee("jefeAdmin").count());

        DelegateTask nueva = tarea(TaskListener.EVENTNAME_CREATE);
        listener.notify(nueva);

        verify(nueva).setAssignee("admin2");
    }

    @Test
    void cuentaSoloLasTareasPendientes() {
        crearAdministrativos();
        Task pendiente = asignarTareaPendiente("admin2");

        DelegateTask primera = tarea(TaskListener.EVENTNAME_CREATE);
        listener.notify(primera);
        verify(primera).setAssignee("jefeAdmin");

        engine.getTaskService().deleteTask(pendiente.getId());

        DelegateTask segunda = tarea(TaskListener.EVENTNAME_CREATE);
        listener.notify(segunda);
        verify(segunda).setAssignee("admin2");
    }

    @Test
    void ignoraEventosDistintosDeCreate() {
        crearAdministrativos();

        DelegateTask completada = tarea(TaskListener.EVENTNAME_COMPLETE);
        listener.notify(completada);

        verify(completada, never()).setAssignee(anyString());
    }

    @Test
    void noAsignaSiNoHayUsuariosEnAdministracion() {
        DelegateTask nueva = tarea(TaskListener.EVENTNAME_CREATE);
        listener.notify(nueva);

        verify(nueva, never()).setAssignee(anyString());
    }

    private Task asignarTareaPendiente(String usuario) {
        Task tarea = engine.getTaskService().newTask();
        tarea.setName("Tarea pendiente");
        tarea.setAssignee(usuario);
        engine.getTaskService().saveTask(tarea);
        return tarea;
    }

    private void crearAdministrativos() {
        Group grupo = engine.getIdentityService().newGroup("administracion");
        grupo.setName("administracion");
        grupo.setType("assignment");
        engine.getIdentityService().saveGroup(grupo);

        crearUsuario("jefeAdmin");
        crearUsuario("admin2");
    }

    private void crearUsuario(String id) {
        User usuario = engine.getIdentityService().newUser(id);
        usuario.setPassword("test");
        usuario.setFirstName(id);
        engine.getIdentityService().saveUser(usuario);
        engine.getIdentityService().createMembership(id, "administracion");
    }

    private DelegateTask tarea(String evento) {
        DelegateTask tarea = Mockito.mock(DelegateTask.class);
        when(tarea.getEventName()).thenReturn(evento);
        return tarea;
    }
}
