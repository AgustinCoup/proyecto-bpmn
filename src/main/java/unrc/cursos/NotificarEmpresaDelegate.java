package unrc.cursos;

import org.apache.commons.mail.Email;
import org.apache.commons.mail.SimpleEmail;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.ExecutionListener;
import org.flowable.engine.delegate.JavaDelegate;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Avisa por correo a la empresa de la instancia (contacto_email de su fila en la BD de la institución).
 *
 * Se usa de dos maneras con el mismo campo {@code tipo}: como tarea de servicio (JavaDelegate) en las tareas
 * automáticas de aviso, y como Execution Listener de fin en las tareas de usuario que implican un envío
 * (propuesta, informe). Tipos: PROPUESTA, RECORDATORIO, NO_VIABLE, CONFIRMACION, CIERRE, INFORME.
 *
 * El envío nunca hace fallar el proceso: si no hay servidor SMTP o la empresa no tiene correo, deja el motivo en
 * el log del contenedor ("[Process_Curso <id>] ...") y sigue. Servidor: SMTP_HOST (por defecto localhost),
 * SMTP_PORT (25) y SMTP_FROM; en Docker Desktop el SMTP falso de la máquina se ve como host.docker.internal.
 */
public class NotificarEmpresaDelegate implements JavaDelegate, ExecutionListener {

    private static final int TIMEOUT_MS = 5000;

    private Expression tipo;

    public void setTipo(Expression tipo) {
        this.tipo = tipo;
    }

    @Override
    public void execute(DelegateExecution execution) {
        notificar(execution);
    }

    @Override
    public void notify(DelegateExecution execution) {
        notificar(execution);
    }

    private void notificar(DelegateExecution execution) {
        String clase = String.valueOf(tipo.getValue(execution));
        String prefijo = "[Process_Curso " + execution.getProcessInstanceId() + "] ";
        Object empresaId = execution.getVariable("empresaId");
        if (!(empresaId instanceof Number)) {
            System.out.println(prefijo + "Aviso " + clase + " NO enviado: la instancia no tiene empresaId");
            return;
        }
        try {
            String[] empresa = buscarEmpresa(((Number) empresaId).intValue());
            if (empresa == null || empresa[1] == null || empresa[1].trim().isEmpty()) {
                System.out.println(prefijo + "Aviso " + clase + " NO enviado: la empresa no existe o no tiene correo");
                return;
            }
            String asunto = asunto(clase, execution);
            enviar(empresa[1], asunto, cuerpo(clase, empresa[0], execution));
            System.out.println(prefijo + "Aviso " + clase + " enviado a " + empresa[1] + ": " + asunto);
        } catch (Exception e) {
            System.out.println(prefijo + "Aviso " + clase + " NO enviado (" + e.getClass().getSimpleName()
                    + ": " + e.getMessage() + ")");
        }
    }

    static String asunto(String clase, DelegateExecution execution) {
        switch (clase) {
            case "PROPUESTA":
                return "Propuesta de curso (version " + execution.getVariable("propuestaVersion") + ")";
            case "RECORDATORIO":
                return "Recordatorio: propuesta de curso pendiente de respuesta";
            case "NO_VIABLE":
                return "Solicitud de curso: no es posible desarrollarlo";
            case "CONFIRMACION":
                return "Confirmacion del curso";
            case "CIERRE":
                return "Cierre de la solicitud de curso";
            case "INFORME":
                return "Informe de resultados del curso";
            default:
                throw new IllegalArgumentException("Tipo de aviso desconocido: " + clase);
        }
    }

    static String cuerpo(String clase, String nombreEmpresa, DelegateExecution execution) {
        String saludo = "Estimados de " + nombreEmpresa + ":\n\n";
        switch (clase) {
            case "PROPUESTA":
                return saludo + "Les enviamos la version " + execution.getVariable("propuestaVersion")
                        + " de la propuesta (programa, presupuesto y fechas). Esperamos su respuesta: aceptacion, rechazo"
                        + " o pedido de modificaciones.\n";
            case "RECORDATORIO":
                return saludo + "Recordatorio " + execution.getVariable("recordatorios")
                        + " de 2: la propuesta sigue pendiente de respuesta.\n";
            case "NO_VIABLE":
                return saludo + "Lamentablemente, por la cantidad de cursos en ejecucion, no es posible desarrollar"
                        + " el curso solicitado. Se da por finalizada la solicitud.\n";
            case "CONFIRMACION":
                return saludo + "Se completo la preparacion: el curso queda confirmado y pendiente de inicio.\n";
            case "CIERRE":
                return saludo + "Se cancelo el curso (motivo: " + execution.getVariable("motivoCancelacion")
                        + "). Los recursos gestionados fueron liberados y se cierra la solicitud.\n";
            default:
                return saludo + "Adjuntamos el informe de resultados del curso. Se archiva el expediente.\n";
        }
    }

    private void enviar(String destino, String asunto, String texto) throws Exception {
        Email correo = new SimpleEmail();
        correo.setHostName(smtpHost());
        correo.setSmtpPort(smtpPort());
        correo.setSocketConnectionTimeout(TIMEOUT_MS);
        correo.setSocketTimeout(TIMEOUT_MS);
        correo.setCharset("UTF-8");
        correo.setFrom(entorno("SMTP_FROM", "institucion@cursos.local"));
        correo.addTo(destino);
        correo.setSubject(asunto);
        correo.setMsg(texto);
        correo.send();
    }

    /** Devuelve {nombre, contacto_email} o null si la empresa no existe. */
    private String[] buscarEmpresa(int empresaId) throws SQLException {
        try (Connection conn = abrirConexion();
             PreparedStatement ps = conn.prepareStatement("SELECT nombre, contacto_email FROM empresa WHERE id = ?")) {
            ps.setInt(1, empresaId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? new String[] {rs.getString("nombre"), rs.getString("contacto_email")} : null;
            }
        }
    }

    /** Puntos de extensión para los tests. */
    protected Connection abrirConexion() throws SQLException {
        return DriverManager.getConnection(
                entorno("INSTITUCION_DB_URL", "jdbc:postgresql://localhost:5432/institucion"),
                entorno("INSTITUCION_DB_USER", "institucion"),
                entorno("INSTITUCION_DB_PASS", "institucion"));
    }

    protected String smtpHost() {
        return entorno("SMTP_HOST", "localhost");
    }

    protected int smtpPort() {
        return Integer.parseInt(entorno("SMTP_PORT", "25"));
    }

    private static String entorno(String nombre, String porDefecto) {
        String valor = System.getenv(nombre);
        return valor == null || valor.trim().isEmpty() ? porDefecto : valor;
    }
}
