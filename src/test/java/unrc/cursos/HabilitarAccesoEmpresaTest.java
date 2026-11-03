package unrc.cursos;

import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

public class HabilitarAccesoEmpresaTest {

    private DelegateExecution execution;
    private HabilitarAccesoEmpresaDelegate delegate;

    @BeforeEach
    public void setUp() {
        execution = Mockito.mock(DelegateExecution.class);
        delegate = new HabilitarAccesoEmpresaDelegate();
    }

    @Test
    public void testEmpresaIdNuloLanzaExcepcion() {
        when(execution.getVariable("empresaId")).thenReturn(null);

        Exception exception = assertThrows(IllegalArgumentException.class, () -> {
            delegate.execute(execution);
        });

        assertEquals("La variable empresaId es obligatoria", exception.getMessage());
    }
}