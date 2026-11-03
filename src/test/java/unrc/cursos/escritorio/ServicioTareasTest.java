package unrc.cursos.escritorio;

import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.Execution;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.idm.api.Group;
import org.flowable.idm.api.User;
import org.flowable.task.api.Task;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ServicioTareasTest {

    private static ProcessEngine motor;
    private static ServicioTareas servicio;
    private static RuntimeService runtimeService;
    private static TaskService taskService;

    private ProcessInstance instancia;
    private Task tareaMateriales;

    @BeforeAll
    static void prepararMotor() {
        motor = ProcessEngineConfiguration.createStandaloneInMemProcessEngineConfiguration()
                .setJdbcUrl("jdbc:h2:mem:materiales-test;DB_CLOSE_DELAY=-1")
                .setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_TRUE)
                .setAsyncExecutorActivate(false)
                .buildProcessEngine();

        RepositoryService repositoryService = motor.getRepositoryService();
        repositoryService.createDeployment()
                .addClasspathResource("procesos/ejemplo-materiales.bpmn20.xml")
                .deploy();

        crearGrupo("administracion");
        crearGrupo("docentes");
        crearUsuario("admin1", "administracion");
        crearUsuario("admin2", "administracion");
        crearUsuario("docente1", "docentes");

        servicio = new ServicioTareas(motor);
        runtimeService = motor.getRuntimeService();
        taskService = motor.getTaskService();
    }

    @AfterAll
    static void cerrarMotor() {
        if (motor != null) {
            motor.close();
        }
    }

    @BeforeEach
    void iniciarInstanciaYAceptarPropuesta() {
        for (ProcessInstance activa : runtimeService.createProcessInstanceQuery().list()) {
            runtimeService.deleteProcessInstance(activa.getId(), "limpieza entre tests");
        }
        instancia = runtimeService.startProcessInstanceByMessage(
                "Solicitud de curso (ejemplo)",
                "42",
                Collections.<String, Object>singletonMap("cursoId", 42));
        Execution espera = runtimeService.createExecutionQuery()
                .processInstanceId(instancia.getId())
                .messageEventSubscriptionName("Aceptación")
                .singleResult();
        runtimeService.messageEventReceived("Aceptación", espera.getId());
        tareaMateriales = taskService.createTaskQuery()
                .processInstanceId(instancia.getId())
                .taskName(ServicioTareas.TAREA_MATERIALES)
                .singleResult();
    }

    @Test
    void autenticaConUsuarioYClaveDeFlowable() {
        assertTrue(servicio.autenticar("admin1", "test".toCharArray()));
        assertFalse(servicio.autenticar("admin1", "incorrecta".toCharArray()));
        assertFalse(servicio.autenticar("noExiste", "test".toCharArray()));
    }

    @Test
    void listaLaTareaDisponibleParaLosAdministrativos() {
        List<TareaVista> deAdmin1 = servicio.listarTareasPrepararMateriales("admin1");
        List<TareaVista> deAdmin2 = servicio.listarTareasPrepararMateriales("admin2");
        List<TareaVista> deDocente = servicio.listarTareasPrepararMateriales("docente1");

        assertEquals(1, deAdmin1.size());
        assertEquals(1, deAdmin2.size());
        assertTrue(deAdmin1.get(0).estaDisponible());
        assertEquals("42", deAdmin1.get(0).getBusinessKey());
        assertTrue(deDocente.isEmpty());
    }

    @Test
    void reclamarAsignaLaTareaYDejaDeEstarDisponibleParaElOtro() {
        servicio.reclamar(tareaMateriales.getId(), "admin1");

        List<TareaVista> deAdmin1 = servicio.listarTareasPrepararMateriales("admin1");
        List<TareaVista> deAdmin2 = servicio.listarTareasPrepararMateriales("admin2");

        assertEquals(1, deAdmin1.size());
        assertEquals("admin1", deAdmin1.get(0).getAsignadaA());
        assertFalse(deAdmin1.get(0).estaDisponible());
        assertTrue(deAdmin2.isEmpty());
    }

    @Test
    void noPermiteReclamarAUnaPersonaDeOtroGrupo() {
        assertThrows(IllegalStateException.class,
                () -> servicio.reclamar(tareaMateriales.getId(), "docente1"));

        Task tarea = taskService.createTaskQuery().taskId(tareaMateriales.getId()).singleResult();
        assertTrue(tarea.getAssignee() == null);
    }

    @Test
    void noPermiteCompletarSinReclamar() {
        assertThrows(IllegalStateException.class,
                () -> servicio.completar(tareaMateriales.getId(), "admin1"));
        assertTrue(taskService.createTaskQuery().taskId(tareaMateriales.getId()).singleResult() != null);
    }

    @Test
    void completaLaTareaReclamada() {
        servicio.reclamar(tareaMateriales.getId(), "admin1");
        servicio.completar(tareaMateriales.getId(), "admin1");

        assertTrue(taskService.createTaskQuery().taskId(tareaMateriales.getId()).singleResult() == null);
        assertTrue(servicio.listarTareasPrepararMateriales("admin1").isEmpty());
    }

    @Test
    void soloQuienLaTieneAsignadaPuedeCompletarla() {
        servicio.reclamar(tareaMateriales.getId(), "admin1");

        assertThrows(IllegalStateException.class,
                () -> servicio.completar(tareaMateriales.getId(), "admin2"));
    }

    @Test
    void devuelveLosGruposDelUsuario() {
        List<String> grupos = servicio.grupos("admin1");
        assertEquals(Collections.singletonList("administracion"), grupos);
    }

    private static void crearGrupo(String id) {
        Group grupo = motor.getIdentityService().newGroup(id);
        grupo.setName(id);
        grupo.setType("assignment");
        motor.getIdentityService().saveGroup(grupo);
    }

    private static void crearUsuario(String id, String grupo) {
        User usuario = motor.getIdentityService().newUser(id);
        usuario.setPassword("test");
        usuario.setFirstName(id);
        motor.getIdentityService().saveUser(usuario);
        motor.getIdentityService().createMembership(id, grupo);
    }
}
