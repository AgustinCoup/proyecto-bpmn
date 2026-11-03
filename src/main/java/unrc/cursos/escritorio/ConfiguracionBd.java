package unrc.cursos.escritorio;

import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

/**
 * Configuracion de conexion del motor Flowable a la base PostgreSQL.
 *
 * No contiene credenciales por defecto. Se leen de variables de entorno o
 * de un archivo de propiedades indicado con FLOWABLE_DB_CONFIG.
 *
 * Variables / claves:
 *   FLOWABLE_DB_URL        / flowable.db.url
 *   FLOWABLE_DB_USER       / flowable.db.user
 *   FLOWABLE_DB_PASSWORD   / flowable.db.password
 *   FLOWABLE_DB_DRIVER     / flowable.db.driver
 *   FLOWABLE_DB_SCHEMA_UPDATE / flowable.db.schemaUpdate  (true|false)
 */
public final class ConfiguracionBd {

    private static final String URL_POR_DEFECTO = "jdbc:postgresql://localhost:5432/flowable";
    private static final String DRIVER_POR_DEFECTO = "org.postgresql.Driver";

    private final String url;
    private final String usuario;
    private final String clave;
    private final String driver;
    private final boolean actualizarEsquema;

    private ConfiguracionBd(String url, String usuario, String clave,
                            String driver, boolean actualizarEsquema) {
        this.url = url;
        this.usuario = usuario;
        this.clave = clave;
        this.driver = driver;
        this.actualizarEsquema = actualizarEsquema;
    }

    public static ConfiguracionBd desdeEntorno() {
        Properties propiedades = cargarPropiedades();
        String config = System.getenv("FLOWABLE_DB_CONFIG");

        String url = resolver("FLOWABLE_DB_URL", "flowable.db.url", propiedades, URL_POR_DEFECTO);
        String usuario = resolver("FLOWABLE_DB_USER", "flowable.db.user", propiedades, null);
        String clave = resolver("FLOWABLE_DB_PASSWORD", "flowable.db.password", propiedades, null);
        String driver = resolver("FLOWABLE_DB_DRIVER", "flowable.db.driver", propiedades, DRIVER_POR_DEFECTO);
        String actualizar = resolver("FLOWABLE_DB_SCHEMA_UPDATE", "flowable.db.schemaUpdate",
                propiedades, "false");

        if (usuario == null || usuario.trim().isEmpty()) {
            throw new IllegalStateException(
                    "Falta FLOWABLE_DB_USER (o flowable.db.user en " + descripcionConfig(config) + ").");
        }
        if (clave == null) {
            throw new IllegalStateException(
                    "Falta FLOWABLE_DB_PASSWORD (o flowable.db.password en " + descripcionConfig(config) + ").");
        }
        return new ConfiguracionBd(url, usuario, clave, driver, Boolean.parseBoolean(actualizar));
    }

    public ProcessEngine crearMotor() {
        ProcessEngineConfiguration configuracion =
                ProcessEngineConfiguration.createStandaloneProcessEngineConfiguration();
        configuracion.setJdbcUrl(url);
        configuracion.setJdbcUsername(usuario);
        configuracion.setJdbcPassword(clave);
        configuracion.setJdbcDriver(driver);
        configuracion.setDatabaseSchemaUpdate(actualizarEsquema
                ? ProcessEngineConfiguration.DB_SCHEMA_UPDATE_TRUE
                : ProcessEngineConfiguration.DB_SCHEMA_UPDATE_FALSE);
        configuracion.setAsyncExecutorActivate(false);
        return configuracion.buildProcessEngine();
    }

    public String getUrl() {
        return url;
    }

    public String getUsuario() {
        return usuario;
    }

    public String getDriver() {
        return driver;
    }

    public boolean isActualizarEsquema() {
        return actualizarEsquema;
    }

    private static Properties cargarPropiedades() {
        Properties propiedades = new Properties();
        String archivo = System.getenv("FLOWABLE_DB_CONFIG");
        if (archivo == null || archivo.trim().isEmpty()) {
            return propiedades;
        }
        try (InputStream entrada = new FileInputStream(archivo)) {
            propiedades.load(entrada);
            return propiedades;
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer FLOWABLE_DB_CONFIG=" + archivo, e);
        }
    }

    private static String resolver(String variableEntorno, String clavePropiedad,
                                   Properties propiedades, String porDefecto) {
        String valor = System.getenv(variableEntorno);
        if (valor == null || valor.trim().isEmpty()) {
            valor = propiedades.getProperty(clavePropiedad);
        }
        if (valor == null || valor.trim().isEmpty()) {
            return porDefecto;
        }
        return valor.trim();
    }

    private static String descripcionConfig(String config) {
        return (config == null || config.trim().isEmpty())
                ? "un archivo apuntado por FLOWABLE_DB_CONFIG"
                : config;
    }
}
