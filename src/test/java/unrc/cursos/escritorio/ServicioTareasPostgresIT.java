package unrc.cursos.escritorio;

import org.flowable.engine.RuntimeService;
import org.flowable.engine.runtime.Execution;
import org.flowable.engine.runtime.ProcessInstance;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Prueba de integracion OPCIONAL contra la PostgreSQL real del motor.
 *
 * Se salta salvo que se defina FLOWABLE_DB_URL. Requiere que el proceso de
 * ejemplo este desplegado (src/test/resources/procesos/ejemplo-materiales.bpmn20.xml)
 * y que existan los usuarios de Contrato.md seccion 3.
 *
 * Ejemplo:
 *   FLOWABLE_DB_URL=jdbc:postgresql://localhost:5432/flowable \
 *   FLOWABLE_DB_USER=flowable FLOWABLE_DB_PASSWORD=flowable \
 *   mvn -Dtest=ServicioTareasPostgresIT test
 */
@EnabledIfEnvironmentVariable(named = "FLOWABLE_DB_URL", matches = ".+")
class ServicioTareasPostgresIT {

    private static ServicioTareas servicio;
    private static String usuario;
    private static String clave;

    @BeforeAll
    static void conectar() {
        ConfiguracionBd configuracion = ConfiguracionBd.desdeEntorno();
        servicio = ServicioTareas.desdeConfiguracion(configuracion);
        usuario = valor("FLOWABLE_TEST_USER", "jefeAdmin");
        clave = valor("FLOWABLE_TEST_PASSWORD", "test");

        long definiciones = servicio.getMotor().getRepositoryService()
                .createProcessDefinitionQuery()
                .processDefinitionKey("ProcesoEjemploMateriales")
                .count();
        if (definiciones == 0) {
            servicio.cerrar();
            servicio = null;
            assumeTrue(false, "El proceso de ejemplo no esta desplegado en la base indicada.");
        }
    }

    @AfterAll
    static void cerrar() {
        if (servicio != null) {
            servicio.cerrar();
        }
    }

    @Test
    void listaReclamaYCompletaUnaTareaContraPostgres() {
        RuntimeService runtimeService = servicio.getMotor().getRuntimeService();
        ProcessInstance instancia = null;
        try {
            instancia = runtimeService.startProcessInstanceByMessage(
                    "Solicitud de curso (ejemplo)",
                    "IT-" + System.currentTimeMillis(),
                    Collections.<String, Object>singletonMap("cursoId", 999));

            Execution espera = runtimeService.createExecutionQuery()
                    .processInstanceId(instancia.getId())
                    .messageEventSubscriptionName("Aceptación")
                    .singleResult();
            assertNotNull(espera);
            runtimeService.messageEventReceived("Aceptación", espera.getId());

            assertTrue(servicio.autenticar(usuario, clave.toCharArray()),
                    "No se pudo autenticar " + usuario + " con la clave indicada.");

            List<TareaVista> tareas = servicio.listarTareasPrepararMateriales(usuario);
            TareaVista tarea = null;
            for (TareaVista candidata : tareas) {
                if (instancia.getId().equals(candidata.getProcessInstanceId())) {
                    tarea = candidata;
                    break;
                }
            }
            assertNotNull(tarea, "No aparecio la tarea 'Preparar materiales'.");
            assertTrue(tarea.estaDisponible());
            assertEquals(instancia.getBusinessKey(), tarea.getBusinessKey());

            servicio.reclamar(tarea.getId(), usuario);
            List<TareaVista> reclamadas = servicio.listarTareasPrepararMateriales(usuario);
            TareaVista reclamada = buscar(reclamadas, tarea.getId());
            assertNotNull(reclamada);
            assertFalse(reclamada.estaDisponible());
            assertEquals(usuario, reclamada.getAsignadaA());

            servicio.completar(tarea.getId(), usuario);
            assertTrue(buscar(servicio.listarTareasPrepararMateriales(usuario), tarea.getId()) == null);
        } finally {
            if (instancia != null && runtimeService.createProcessInstanceQuery()
                    .processInstanceId(instancia.getId()).count() > 0) {
                runtimeService.deleteProcessInstance(instancia.getId(), "fin de test de integracion");
            }
        }
    }

    private static TareaVista buscar(List<TareaVista> tareas, String id) {
        for (TareaVista tarea : tareas) {
            if (id.equals(tarea.getId())) {
                return tarea;
            }
        }
        return null;
    }

    private static String valor(String nombre, String porDefecto) {
        String valor = System.getenv(nombre);
        return valor == null || valor.trim().isEmpty() ? porDefecto : valor.trim();
    }
}
