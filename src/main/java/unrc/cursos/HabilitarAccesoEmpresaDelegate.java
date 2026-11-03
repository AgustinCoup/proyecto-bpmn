package unrc.cursos;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

public class HabilitarAccesoEmpresaDelegate implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        Integer empresaId = (Integer) execution.getVariable("empresaId");
        if (empresaId == null) {
            throw new IllegalArgumentException("La variable empresaId es obligatoria");
        }

        String url = System.getenv().getOrDefault("INSTITUCION_DB_URL", "jdbc:postgresql://localhost:5432/institucion");
        String user = System.getenv().getOrDefault("INSTITUCION_DB_USER", "institucion");
        String pass = System.getenv().getOrDefault("INSTITUCION_DB_PASS", "institucion");

        try (Connection conn = DriverManager.getConnection(url, user, pass)) {
            // Verificar si ya tiene cuenta
            try (PreparedStatement psCheck = conn.prepareStatement("SELECT id FROM cuenta_empresa WHERE empresa_id = ?")) {
                psCheck.setInt(1, empresaId);
                try (ResultSet rs = psCheck.executeQuery()) {
                    if (rs.next()) {
                        return; // Ya existe, se reutiliza
                    }
                }
            }

            // Obtener CUIT para armar el usuario por defecto
            String cuit = "";
            try (PreparedStatement psEmp = conn.prepareStatement("SELECT cuit FROM empresa WHERE id = ?")) {
                psEmp.setInt(1, empresaId);
                try (ResultSet rs = psEmp.executeQuery()) {
                    if (!rs.next()) {
                        throw new IllegalArgumentException("No existe la empresa " + empresaId + " en la BD de la institución");
                    }
                    cuit = rs.getString("cuit").replace("-", "");
                }
            }

            // Crear cuenta
            try (PreparedStatement psInsert = conn.prepareStatement(
                    "INSERT INTO cuenta_empresa (empresa_id, usuario, clave_hash) VALUES (?, ?, ?) ON CONFLICT (empresa_id) DO NOTHING")) {
                psInsert.setInt(1, empresaId);
                psInsert.setString(2, "emp_" + cuit);
                psInsert.setString(3, "test");
                psInsert.executeUpdate();
            }
        } catch (Exception e) {
            throw new RuntimeException("Error al habilitar acceso de empresa en BD", e);
        }
    }
}