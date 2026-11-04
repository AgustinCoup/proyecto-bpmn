package unrc.cursos;

import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mockito;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

class ActualizarEstadoCursoListenerTest {

    private static final String URL = "jdbc:h2:mem:institucion_estado;DB_CLOSE_DELAY=-1";

    private Connection conexion;
    private ActualizarEstadoCursoListener listener;
    private DelegateExecution execution;

    @BeforeEach
    void setUp() throws SQLException {
        conexion = DriverManager.getConnection(URL, "sa", "");
        try (Statement statement = conexion.createStatement()) {
            statement.execute("DROP TABLE IF EXISTS curso");
            statement.execute("CREATE TABLE curso ("
                    + "id INT PRIMARY KEY, "
                    + "estado VARCHAR(30) NOT NULL DEFAULT 'EN_PROCESO', "
                    + "process_instance_id VARCHAR(64))");
        }

        listener = new ActualizarEstadoCursoListener() {
            @Override
            protected Connection abrirConexion() throws SQLException {
                return DriverManager.getConnection(URL, "sa", "");
            }
        };
        execution = Mockito.mock(DelegateExecution.class);
    }

    @AfterEach
    void tearDown() throws SQLException {
        if (conexion != null) {
            conexion.close();
        }
    }

    @Test
    void actualizaSoloElCursoDeLaInstanciaIndicada() throws SQLException {
        insertarCurso(1, "pi-1", "EN_PROCESO");
        insertarCurso(2, "pi-2", "EN_PROCESO");

        ejecutar("pi-1", "CANCELADO");

        assertEquals("CANCELADO", estadoDe(1));
        assertEquals("EN_PROCESO", estadoDe(2));
    }

    @ParameterizedTest
    @ValueSource(strings = {"FINALIZADO", "CANCELADO", "RECHAZADO", "SIN_RESPUESTA", "NO_VIABLE"})
    void registraCadaEstadoFinal(String estado) throws SQLException {
        insertarCurso(1, "pi-1", "EN_PROCESO");

        ejecutar("pi-1", estado);

        assertEquals(estado, estadoDe(1));
    }

    @Test
    void normalizaElResultadoAMayusculas() throws SQLException {
        insertarCurso(1, "pi-1", "EN_PROCESO");

        ejecutar("pi-1", "rechazado");

        assertEquals("RECHAZADO", estadoDe(1));
    }

    @Test
    void sinResultadoAsumeFinalizado() throws SQLException {
        insertarCurso(1, "pi-1", "EN_PROCESO");

        ejecutar("pi-1", null);

        assertEquals("FINALIZADO", estadoDe(1));
    }

    @Test
    void sinVinculoBuscaElCursoPorSuIdSiNoTieneInstancia() throws SQLException {
        insertarCurso(7, null, "EN_PROCESO");
        when(execution.getVariable("cursoId")).thenReturn(7);

        ejecutar("pi-no-vinculada", "NO_VIABLE");

        assertEquals("NO_VIABLE", estadoDe(7));
    }

    @Test
    void elRespaldoPorIdNoTocaUnCursoYaVinculadoAOtraInstancia() throws SQLException {
        insertarCurso(8, "pi-otra", "EN_PROCESO");
        when(execution.getVariable("cursoId")).thenReturn(8);

        ejecutar("pi-no-vinculada", "NO_VIABLE");

        assertEquals("EN_PROCESO", estadoDe(8));
    }

    @Test
    void noFallaSiNoExisteElCursoDeLaInstancia() {
        ejecutar("pi-inexistente", "CANCELADO");
    }

    @Test
    void envuelveLosErroresDeBaseDeDatosEnRuntimeException() {
        ActualizarEstadoCursoListener conFalla = new ActualizarEstadoCursoListener() {
            @Override
            protected Connection abrirConexion() throws SQLException {
                throw new SQLException("sin conexión");
            }
        };
        when(execution.getProcessInstanceId()).thenReturn("pi-1");
        when(execution.getVariable("resultado")).thenReturn("CANCELADO");

        RuntimeException excepcion = assertThrows(RuntimeException.class, () -> conFalla.notify(execution));

        assertEquals("Error al actualizar el estado del curso en la BD", excepcion.getMessage());
        assertInstanceOf(SQLException.class, excepcion.getCause());
    }

    private void ejecutar(String processInstanceId, String resultado) {
        when(execution.getProcessInstanceId()).thenReturn(processInstanceId);
        when(execution.getVariable("resultado")).thenReturn(resultado);
        listener.notify(execution);
    }

    private void insertarCurso(int id, String processInstanceId, String estado) throws SQLException {
        try (PreparedStatement statement = conexion.prepareStatement(
                "INSERT INTO curso (id, process_instance_id, estado) VALUES (?, ?, ?)")) {
            statement.setInt(1, id);
            statement.setString(2, processInstanceId);
            statement.setString(3, estado);
            statement.executeUpdate();
        }
    }

    private String estadoDe(int id) throws SQLException {
        try (PreparedStatement statement = conexion.prepareStatement(
                "SELECT estado FROM curso WHERE id = ?")) {
            statement.setInt(1, id);
            try (ResultSet resultado = statement.executeQuery()) {
                resultado.next();
                return resultado.getString("estado");
            }
        }
    }
}
