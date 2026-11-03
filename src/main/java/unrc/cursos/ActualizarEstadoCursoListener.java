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

        try (Connection conn = abrirConexion();
             PreparedStatement ps = conn.prepareStatement("UPDATE curso SET estado = ? WHERE process_instance_id = ?")) {
            ps.setString(1, resultado);
            ps.setString(2, processInstanceId);
            ps.executeUpdate();
        } catch (Exception e) {
            throw new RuntimeException("Error al actualizar el estado del curso en la BD", e);
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