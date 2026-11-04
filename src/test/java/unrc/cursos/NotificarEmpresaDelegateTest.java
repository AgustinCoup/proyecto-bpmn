package unrc.cursos;

import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.common.engine.api.variable.VariableContainer;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.ServerSocket;
import java.net.Socket;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

class NotificarEmpresaDelegateTest {

    private static final String URL = "jdbc:h2:mem:institucion_mail;DB_CLOSE_DELAY=-1";

    private DelegateExecution execution;
    private ServerSocket servidor;
    private CompletableFuture<String> correoRecibido;

    @BeforeEach
    void setUp() throws Exception {
        try (Connection c = DriverManager.getConnection(URL, "sa", ""); Statement s = c.createStatement()) {
            s.execute("DROP TABLE IF EXISTS empresa");
            s.execute("CREATE TABLE empresa (id INT PRIMARY KEY, nombre VARCHAR(100), contacto_email VARCHAR(100))");
            s.execute("INSERT INTO empresa VALUES (1, 'Acme SA', 'contacto@acme.test')");
            s.execute("INSERT INTO empresa VALUES (2, 'Sin Correo SA', NULL)");
        }
        execution = Mockito.mock(DelegateExecution.class);
        when(execution.getProcessInstanceId()).thenReturn("pi-1");
        when(execution.getVariable("empresaId")).thenReturn(1);
        when(execution.getVariable("propuestaVersion")).thenReturn(2);
        when(execution.getVariable("recordatorios")).thenReturn(1);
        when(execution.getVariable("motivoCancelacion")).thenReturn("SIN_AULAS");
        servidor = new ServerSocket(0);
        correoRecibido = new CompletableFuture<>();
        Thread hilo = new Thread(this::atenderUnaConexion);
        hilo.setDaemon(true);
        hilo.start();
    }

    @AfterEach
    void tearDown() throws IOException {
        servidor.close();
    }

    @Test
    void enviaLaPropuestaAlCorreoDeContactoDeLaEmpresa() throws Exception {
        notificador("PROPUESTA", servidor.getLocalPort()).execute(execution);

        String correo = correoRecibido.get(10, TimeUnit.SECONDS);
        assertTrue(correo.contains("RCPT TO:<contacto@acme.test>"), correo);
        assertTrue(correo.contains("Subject: Propuesta de curso (version 2)"), correo);
        assertTrue(correo.contains("Acme SA"), correo);
    }

    @Test
    void elAvisoDeCierreIncluyeElMotivo() throws Exception {
        notificador("CIERRE", servidor.getLocalPort()).notify(execution);

        assertTrue(correoRecibido.get(10, TimeUnit.SECONDS).contains("SIN_AULAS"));
    }

    @Test
    void sinServidorSmtpNoHaceFallarElProceso() throws IOException {
        int puertoCerrado = servidor.getLocalPort();
        servidor.close();

        assertDoesNotThrow(() -> notificador("RECORDATORIO", puertoCerrado).execute(execution));
    }

    @Test
    void siLaEmpresaNoTieneCorreoNoEnviaNada() {
        when(execution.getVariable("empresaId")).thenReturn(2);

        assertDoesNotThrow(() -> notificador("CONFIRMACION", servidor.getLocalPort()).execute(execution));
        assertFalse(correoRecibido.isDone());
    }

    @Test
    void sinEmpresaIdNoFallaNiEnvia() {
        when(execution.getVariable("empresaId")).thenReturn(null);

        assertDoesNotThrow(() -> notificador("NO_VIABLE", servidor.getLocalPort()).execute(execution));
        assertFalse(correoRecibido.isDone());
    }

    private NotificarEmpresaDelegate notificador(String tipo, int puerto) {
        NotificarEmpresaDelegate delegate = new NotificarEmpresaDelegate() {
            @Override
            protected Connection abrirConexion() throws SQLException {
                return DriverManager.getConnection(URL, "sa", "");
            }

            @Override
            protected String smtpHost() {
                return "localhost";
            }

            @Override
            protected int smtpPort() {
                return puerto;
            }
        };
        delegate.setTipo(new Expression() {
            @Override
            public Object getValue(VariableContainer contenedor) {
                return tipo;
            }

            @Override
            public void setValue(Object valor, VariableContainer contenedor) {
                throw new UnsupportedOperationException();
            }

            @Override
            public String getExpressionText() {
                return tipo;
            }
        });
        return delegate;
    }

    /** SMTP mínimo: acepta una conexión, responde lo justo y entrega el diálogo completo. */
    private void atenderUnaConexion() {
        try (Socket socket = servidor.accept();
             BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream(), "UTF-8"));
             PrintWriter out = new PrintWriter(socket.getOutputStream(), true)) {
            StringBuilder dialogo = new StringBuilder();
            out.print("220 prueba\r\n");
            out.flush();
            boolean enDatos = false;
            String linea;
            while ((linea = in.readLine()) != null) {
                dialogo.append(linea).append('\n');
                if (enDatos) {
                    if (".".equals(linea)) {
                        enDatos = false;
                        responder(out, "250 ok");
                    }
                } else if (linea.startsWith("EHLO") || linea.startsWith("HELO")) {
                    responder(out, "250 prueba");
                } else if (linea.startsWith("DATA")) {
                    enDatos = true;
                    responder(out, "354 siga");
                } else if (linea.startsWith("QUIT")) {
                    responder(out, "221 chau");
                    break;
                } else {
                    responder(out, "250 ok");
                }
            }
            correoRecibido.complete(dialogo.toString());
        } catch (IOException e) {
            correoRecibido.completeExceptionally(e);
        }
    }

    private static void responder(PrintWriter out, String texto) {
        out.print(texto + "\r\n");
        out.flush();
    }
}
