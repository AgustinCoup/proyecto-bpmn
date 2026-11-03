package unrc.cursos.simulador;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DetectorAccionesTest {

    private final DetectorAcciones detector = new DetectorAcciones();

    @Test
    void enEsperaDePropuestaSoloHabilitaAceptarRechazarYModificar() {
        EstadoInstancia estado = new EstadoInstancia("pi-1",
                Collections.singletonList(new EjecucionActiva("exec-1", "Esperar")),
                Arrays.asList(
                        mensaje("Aceptación", "Aceptar", "exec-aceptar"),
                        mensaje("Rechazo", "Rechazar", "exec-rechazar"),
                        mensaje("Solicitud de modificaciones", "Modificar", "exec-modificar")));

        List<AccionEmpresa> acciones = acciones(detector.detectar(estado));

        assertEquals(Arrays.asList(
                AccionEmpresa.ACEPTAR,
                AccionEmpresa.RECHAZAR,
                AccionEmpresa.MODIFICAR), acciones);
    }

    @Test
    void duranteLaPreparacionHabilitaNominaYCancelacion() {
        EstadoInstancia estado = new EstadoInstancia("pi-2",
                Arrays.asList(
                        new EjecucionActiva("exec-nomina", "Nomina"),
                        new EjecucionActiva("exec-material", "Material")),
                Collections.singletonList(mensaje("Cancelación", "Event_1g4xmqo", "exec-cancelar")));

        List<AccionHabilitada> habilitadas = detector.detectar(estado);

        assertEquals(Arrays.asList(AccionEmpresa.NOMINA, AccionEmpresa.CANCELAR), acciones(habilitadas));
        assertEquals("exec-nomina", habilitadas.get(0).getExecutionId());
        assertEquals("exec-cancelar", habilitadas.get(1).getExecutionId());
    }

    @Test
    void noHabilitaAccionesCuandoLaInstanciaYaNoEsperaNada() {
        EstadoInstancia estado = new EstadoInstancia("pi-3",
                Collections.emptyList(), Collections.emptyList());

        assertTrue(detector.detectar(estado).isEmpty());
    }

    @Test
    void ignoraSuscripcionesQueNoSonDeMensaje() {
        EstadoInstancia estado = new EstadoInstancia("pi-4",
                Collections.emptyList(),
                Arrays.asList(
                        new SuscripcionEvento("signal", "Aceptación", "Aceptar", "exec-senal"),
                        new SuscripcionEvento("timer", "Cancelación", "Event_1g4xmqo", "exec-timer")));

        assertTrue(detector.detectar(estado).isEmpty());
    }

    @Test
    void noDuplicaUnaAccionSiHayMasDeUnaSuscripcionConElMismoNombre() {
        EstadoInstancia estado = new EstadoInstancia("pi-5",
                Collections.emptyList(),
                Arrays.asList(
                        mensaje("Aceptación", "Aceptar", "exec-1"),
                        mensaje("Aceptación", "Aceptar", "exec-2")));

        List<AccionHabilitada> habilitadas = detector.detectar(estado);

        assertEquals(Collections.singletonList(AccionEmpresa.ACEPTAR), acciones(habilitadas));
        assertEquals("exec-1", habilitadas.get(0).getExecutionId());
    }

    @Test
    void muestraLosNombresDeMensajesEsperandoSinRepetir() {
        EstadoInstancia estado = new EstadoInstancia("pi-6",
                Collections.emptyList(),
                Arrays.asList(
                        mensaje("Aceptación", "Aceptar", "exec-1"),
                        mensaje("Aceptación", "Aceptar", "exec-2"),
                        new SuscripcionEvento("signal", "Otra", "Otra", "exec-3")));

        assertEquals(Collections.singletonList("Aceptación"), estado.nombresMensajesEsperando());
    }

    private static SuscripcionEvento mensaje(String nombre, String actividad, String ejecucion) {
        return new SuscripcionEvento("message", nombre, actividad, ejecucion);
    }

    private static List<AccionEmpresa> acciones(List<AccionHabilitada> habilitadas) {
        return habilitadas.stream()
                .map(AccionHabilitada::getAccion)
                .collect(Collectors.toList());
    }
}
