package unrc.cursos.analisis;

import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.history.HistoricProcessInstance;
import org.flowable.engine.runtime.Execution;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.idm.api.Group;
import org.flowable.idm.api.User;
import org.flowable.task.api.Task;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ServicioAnalisisTest {

    private static ProcessEngine motor;
    private static RuntimeService runtime;
    private static TaskService tareas;
    private static ServicioAnalisis servicio;

    @BeforeAll
    static void prepararMotor() {
        motor = ProcessEngineConfiguration.createStandaloneInMemProcessEngineConfiguration()
                .setJdbcUrl("jdbc:h2:mem:analisis-test;DB_CLOSE_DELAY=-1")
                .setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_TRUE)
                .setAsyncExecutorActivate(false)
                .buildProcessEngine();
        motor.getRepositoryService().createDeployment()
                .addClasspathResource("proceso-analisis.bpmn20.xml").deploy();
        crearGrupo("administracion");
        crearGrupo("docentes");
        crearUsuario("admin1", "administracion");
        crearUsuario("admin2", "administracion");
        crearUsuario("docente1", "docentes");
        runtime = motor.getRuntimeService();
        tareas = motor.getTaskService();
        servicio = new ServicioAnalisis(motor);
    }

    @AfterAll
    static void cerrarMotor() {
        motor.close();
    }

    @BeforeEach
    void limpiar() {
        for (ProcessInstance i : runtime.createProcessInstanceQuery().list()) {
            runtime.deleteProcessInstance(i.getId(), "limpieza");
        }
        for (HistoricProcessInstance h : motor.getHistoryService().createHistoricProcessInstanceQuery().list()) {
            motor.getHistoryService().deleteHistoricProcessInstance(h.getId());
        }
    }

    @Test
    void resultados_sinInstancias_devuelveCerosYPorcentajeCero() {
        ResultadosSolicitudes r = servicio.resultadosSolicitudes();

        assertEquals(0, r.total());
        assertEquals(0.0, r.porcentaje("FINALIZADO"));
        assertEquals(ServicioAnalisis.RESULTADOS.size(), r.cantidades().size());
    }

    @Test
    void resultados_cursoFinalizado_cuentaSobreTerminadasSinBorradas() {
        completarPreparacion("admin1");
        ProcessInstance borrada = runtime.startProcessInstanceByKey("Process_Curso");
        runtime.deleteProcessInstance(borrada.getId(), "limpieza");

        ResultadosSolicitudes r = servicio.resultadosSolicitudes();

        assertEquals(1, r.total());
        assertEquals(1L, r.cantidades().get("FINALIZADO"));
        assertEquals(100.0, r.porcentaje("FINALIZADO"));
    }

    @Test
    void duracionRamas_preparacionCompleta_promediaYExcluyeInterrumpidas() {
        completarPreparacion("admin1");
        ProcessInstance interrumpida = runtime.startProcessInstanceByKey("Process_Curso");
        Task material = tareas.createTaskQuery().processInstanceId(interrumpida.getId())
                .taskDefinitionKey("Material").singleResult();
        tareas.complete(material.getId());
        runtime.deleteProcessInstance(interrumpida.getId(), "cancelada");

        DuracionRamas d = servicio.duracionRamas();

        assertEquals(1, d.cursos());
        assertTrue(d.inscripcionesMs() >= 0 && d.materialesMs() >= 0 && d.recursosMs() >= 0);
    }

    @Test
    void tareasPorUsuario_cuentaSoloCompletadasYListaATodos() {
        completarPreparacion("admin1");
        ProcessInstance pendiente = runtime.startProcessInstanceByKey("Process_Curso");
        Task tarea = tareas.createTaskQuery().processInstanceId(pendiente.getId())
                .taskDefinitionKey("Material").singleResult();
        tareas.claim(tarea.getId(), "admin2");
        runtime.deleteProcessInstance(pendiente.getId(), "cancelada");

        Map<String, Long> cantidades = servicio.tareasPorUsuario();

        assertEquals(4L, cantidades.get("admin1"));
        assertEquals(0L, cantidades.get("admin2"));
        assertEquals(0L, cantidades.get("docente1"));
        assertFalse(cantidades.containsKey("(sin responsable)"));
    }

    @Test
    void reporte_incluyeLasTresSecciones() {
        completarPreparacion("admin1");

        String texto = ReporteAnalisis.generar(servicio);

        assertTrue(texto.contains("4.3.1") && texto.contains("4.3.2") && texto.contains("4.3.3"));
        assertTrue(texto.contains("Curso finalizado"));
    }

    @Test
    void formatoDuracion_escalaSegunMagnitud() {
        assertEquals("500 ms", ReporteAnalisis.formatoDuracion(500));
        assertEquals("12.5 s", ReporteAnalisis.formatoDuracion(12_500));
        assertEquals("2 min 05 s", ReporteAnalisis.formatoDuracion(125_000));
        assertEquals("3 d 02 h", ReporteAnalisis.formatoDuracion(3 * 86_400_000.0 + 2 * 3_600_000.0));
    }

    /** Corre una instancia completa reclamando cada tarea con el usuario dado. */
    private static void completarPreparacion(String usuario) {
        ProcessInstance i = runtime.startProcessInstanceByKey("Process_Curso");
        Execution nomina = runtime.createExecutionQuery().processInstanceId(i.getId())
                .activityId("Nomina").singleResult();
        runtime.trigger(nomina.getId());
        for (String clave : new String[] {"Lista", "Material", "Activity_12i2hpf", "Virtual"}) {
            Task t = tareas.createTaskQuery().processInstanceId(i.getId()).taskDefinitionKey(clave).singleResult();
            tareas.claim(t.getId(), usuario);
            tareas.complete(t.getId());
        }
    }

    private static void crearGrupo(String id) {
        Group g = motor.getIdentityService().newGroup(id);
        motor.getIdentityService().saveGroup(g);
    }

    private static void crearUsuario(String id, String grupo) {
        User u = motor.getIdentityService().newUser(id);
        u.setPassword("test");
        motor.getIdentityService().saveUser(u);
        motor.getIdentityService().createMembership(id, grupo);
    }
}
