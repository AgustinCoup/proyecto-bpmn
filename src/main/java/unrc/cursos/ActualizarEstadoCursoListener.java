package unrc.cursos;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.ExecutionListener;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;

public class ActualizarEstadoCursoListener implements ExecutionListener {
    @Override
    public void notify(DelegateExecution execution) {
        String resultado = (String) execution.getVariable("resultado");
        if (resultado == null) {
            resultado = "FINALIZADO";
        }
        resultado = resultado.toUpperCase();

        String processInstanceId = execution.getProcessInstanceId();
        Object cursoId = execution.getVariable("cursoId");

        try (Connection conn = abrirConexion()) {
            int actualizadas = actualizar(conn,
                    "UPDATE curso SET estado = ? WHERE process_instance_id = ?", resultado, processInstanceId);
            // Una instancia "no viable" termina dentro del propio POST de inicio, antes de que quien la inició pueda
            // guardar process_instance_id en el curso: en ese caso se busca el curso por su ID (variable cursoId),
            // sólo si todavía no está vinculado a ninguna instancia.
            if (actualizadas == 0 && cursoId instanceof Number) {
                actualizar(conn, "UPDATE curso SET estado = ? WHERE id = ? AND process_instance_id IS NULL",
                        resultado, ((Number) cursoId).intValue());
            }
        } catch (Exception e) {
            throw new RuntimeException("Error al actualizar el estado del curso en la BD", e);
        }
    }

    private static int actualizar(Connection conn, String sql, String estado, Object clave) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, estado);
            ps.setObject(2, clave);
            return ps.executeUpdate();
        }
    }

    /**
     * Punto de extensión para los tests: permite apuntar a una base en memoria.
     * En producción usa las variables de entorno del motor.
     */
    protected Connection abrirConexion() throws SQLException {
        String url = System.getenv().getOrDefault("INSTITUCION_DB_URL", "jdbc:postgresql://localhost:5432/institucion");
        String user = System.getenv().getOrDefault("INSTITUCION_DB_USER", "institucion");
        String pass = System.getenv().getOrDefault("INSTITUCION_DB_PASS", "institucion");
        return DriverManager.getConnection(url, user, pass);
    }
}