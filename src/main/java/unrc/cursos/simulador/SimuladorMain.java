package unrc.cursos.simulador;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.Console;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Simulador de comunicaciones de la empresa por linea de comandos.
 *
 * Uso: exportar FLOWABLE_REST_USER / FLOWABLE_REST_PASSWORD (o ingresarlos
 * cuando se pidan) y ejecutar la clase main.
 */
public final class SimuladorMain {

    private static final String URL_POR_DEFECTO = "http://localhost:8080/flowable-rest/service";

    private SimuladorMain() {
    }

    public static void main(String[] args) {
        if (args.length > 0 && ("-h".equals(args[0]) || "--help".equals(args[0]))) {
            mostrarAyuda();
            return;
        }
        try {
            new SimuladorConsola().ejecutar();
        } catch (FlowableRestException e) {
            System.err.println("ERROR: " + e.getMessage());
            System.exit(1);
        } catch (RuntimeException e) {
            System.err.println("ERROR inesperado: " + e.getMessage());
            e.printStackTrace(System.err);
            System.exit(1);
        }
    }

    private static void mostrarAyuda() {
        System.out.println("Simulador de comunicaciones de la empresa (API REST de Flowable)");
        System.out.println();
        System.out.println("Variables de entorno:");
        System.out.println("  FLOWABLE_REST_URL       URL base (por defecto " + URL_POR_DEFECTO + ")");
        System.out.println("  FLOWABLE_REST_USER      usuario con acceso a la API REST");
        System.out.println("  FLOWABLE_REST_PASSWORD  clave del usuario");
        System.out.println();
        System.out.println("Si usuario o clave no estan definidos, se piden por consola.");
        System.out.println("Ejecucion con Maven:");
        System.out.println("  mvn -q exec:java -Dexec.mainClass=unrc.cursos.simulador.SimuladorMain");
    }

    private static final class SimuladorConsola {

        private final BufferedReader entrada;
        private final PrintStream salida;
        private final ObjectMapper mapper = new ObjectMapper();
        private final DetectorAcciones detector = new DetectorAcciones();
        private final ClienteFlowableRest cliente;

        SimuladorConsola() {
            this.entrada = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
            this.salida = System.out;
            String url = valorEntorno("FLOWABLE_REST_URL", URL_POR_DEFECTO);
            String usuario = valorEntorno("FLOWABLE_REST_USER", null);
            String clave = valorEntorno("FLOWABLE_REST_PASSWORD", null);
            if (usuario == null) {
                usuario = leerObligatorio("Usuario de Flowable: ", "El usuario no puede estar vacio.");
            }
            if (clave == null) {
                clave = leerPassword("Clave de Flowable: ");
                if (clave == null) {
                    throw new IllegalStateException("No se pudo leer la clave.");
                }
            }
            this.cliente = new ClienteFlowableRest(url, usuario, clave);
        }

        void ejecutar() {
            salida.println("== Simulador de comunicaciones de la empresa ==");
            while (true) {
                List<InstanciaResumen> instancias = cliente.listarInstancias();
                salida.println();
                salida.println("Solicitudes activas:");
                if (instancias.isEmpty()) {
                    salida.println("  (no hay instancias de proceso activas)");
                    salida.println("Inicia una desde el sitio web o con la API REST y volve a ejecutar.");
                    return;
                }
                for (int i = 0; i < instancias.size(); i++) {
                    InstanciaResumen instancia = instancias.get(i);
                    salida.printf("  %d) %s%n", i + 1, instancia.descripcionCorta());
                    if (instancia.getProcessDefinitionName() != null) {
                        salida.printf("     proceso: %s | iniciada: %s%n",
                                instancia.getProcessDefinitionName(),
                                instancia.getStartTime() == null ? "?" : instancia.getStartTime());
                    }
                }
                String seleccion = leer("Elegi una solicitud (numero, r para actualizar, q para salir): ");
                if (seleccion == null || "q".equalsIgnoreCase(seleccion.trim())) {
                    return;
                }
                if (seleccion.trim().isEmpty() || "r".equalsIgnoreCase(seleccion.trim())) {
                    continue;
                }
                Integer indice = parsearEntero(seleccion, 1, instancias.size());
                if (indice == null) {
                    salida.println("Opcion invalida.");
                    continue;
                }
                gestionarInstancia(instancias.get(indice - 1));
            }
        }

        private void gestionarInstancia(InstanciaResumen instancia) {
            salida.println();
            salida.println("Solicitud: " + instancia.descripcionCorta());
            while (true) {
                EstadoInstancia estado = cliente.obtenerEstado(instancia.getId());
                List<AccionHabilitada> acciones = detector.detectar(estado);
                mostrarEstado(estado, acciones);

                if (acciones.isEmpty()) {
                    String opcion = leer("No hay comunicaciones habilitadas. "
                            + "Enter para actualizar, q para volver: ");
                    if (opcion == null || "q".equalsIgnoreCase(opcion.trim())) {
                        return;
                    }
                    continue;
                }

                String opcion = leer("Elegi una accion (numero, r para actualizar, q para volver): ");
                if (opcion == null || "q".equalsIgnoreCase(opcion.trim())) {
                    return;
                }
                if (opcion.trim().isEmpty() || "r".equalsIgnoreCase(opcion.trim())) {
                    continue;
                }
                Integer indice = parsearEntero(opcion, 1, acciones.size());
                if (indice == null) {
                    salida.println("Opcion invalida.");
                    continue;
                }
                try {
                    ejecutarAccion(acciones.get(indice - 1));
                } catch (FlowableRestException e) {
                    salida.println("No se pudo enviar la comunicacion.");
                    salida.println(e.getMessage());
                } catch (RuntimeException e) {
                    salida.println("No se pudo enviar la comunicacion: " + e.getMessage());
                }
                leer("Enter para actualizar el estado...");
            }
        }

        private void mostrarEstado(EstadoInstancia estado, List<AccionHabilitada> acciones) {
            salida.println();
            List<String> actividades = new ArrayList<>();
            for (EjecucionActiva ejecucion : estado.getEjecuciones()) {
                if (ejecucion.getActivityId() != null && !actividades.contains(ejecucion.getActivityId())) {
                    actividades.add(ejecucion.getActivityId());
                }
            }
            salida.println("  Actividades activas: "
                    + (actividades.isEmpty() ? "(ninguna)" : String.join(", ", actividades)));
            List<String> mensajes = estado.nombresMensajesEsperando();
            salida.println("  Mensajes esperando: "
                    + (mensajes.isEmpty() ? "(ninguno)" : String.join(", ", mensajes)));
            salida.println("  Comunicaciones habilitadas:");
            for (int i = 0; i < acciones.size(); i++) {
                AccionEmpresa accion = acciones.get(i).getAccion();
                salida.printf("    %d) %s", i + 1, accion.getEtiqueta());
                if (accion.getVariable() != null) {
                    salida.print(" (variable: " + accion.getVariable() + ")");
                }
                salida.println();
            }
        }

        private void ejecutarAccion(AccionHabilitada accionHabilitada) {
            AccionEmpresa accion = accionHabilitada.getAccion();
            Map<String, Object> variables = new LinkedHashMap<>();

            switch (accion) {
                case ACEPTAR:
                    variables.put("fechaCurso", leerFecha());
                    break;
                case RECHAZAR:
                    if (!confirmar("Confirmas el rechazo de la propuesta? (s/N): ")) {
                        salida.println("Operacion cancelada.");
                        return;
                    }
                    break;
                case MODIFICAR:
                    variables.put("observaciones",
                            leerObligatorio("Observaciones para la institucion: ",
                                    "Las observaciones no pueden estar vacias."));
                    break;
                case NOMINA:
                    variables.put("participantes", leerNominaJson());
                    break;
                case CANCELAR:
                    if (!confirmar("Confirmas la cancelacion del curso mientras se prepara? (s/N): ")) {
                        salida.println("Operacion cancelada.");
                        return;
                    }
                    break;
                default:
                    throw new IllegalStateException("Accion no contemplada: " + accion);
            }

            if (accion.getTipo() == AccionEmpresa.Tipo.MENSAJE) {
                cliente.enviarMensaje(accionHabilitada.getExecutionId(),
                        accion.getNombreMensaje(), variables);
            } else {
                cliente.enviarSenal(accionHabilitada.getExecutionId(), variables);
            }
            salida.println("Comunicacion enviada: " + accion.getEtiqueta() + ".");
        }

        private String leerFecha() {
            while (true) {
                String texto = leerObligatorio(
                        "Fecha acordada (ISO 8601 con zona, ej. 2026-12-01T09:00:00Z): ",
                        "La fecha no puede estar vacia.");
                try {
                    return DateTimeFormatter.ISO_INSTANT.format(Instant.parse(texto.trim()));
                } catch (DateTimeParseException e1) {
                    try {
                        return DateTimeFormatter.ISO_INSTANT.format(
                                OffsetDateTime.parse(texto.trim()).toInstant());
                    } catch (DateTimeParseException e2) {
                        salida.println("Fecha invalida. Usa el formato 2026-12-01T09:00:00Z.");
                    }
                }
            }
        }

        private String leerNominaJson() {
            while (true) {
                String texto = leerObligatorio(
                        "Nomina de participantes (JSON array, ej. [\"Ana\",\"Beto\"]): ",
                        "La nomina no puede estar vacia.");
                try {
                    JsonNode nodo = mapper.readTree(texto);
                    if (nodo == null || !nodo.isArray()) {
                        salida.println("La nomina debe ser un array JSON.");
                        continue;
                    }
                    return mapper.writeValueAsString(nodo);
                } catch (JsonProcessingException e) {
                    salida.println("JSON invalido: " + e.getOriginalMessage());
                }
            }
        }

        private boolean confirmar(String mensaje) {
            String respuesta = leer(mensaje);
            return respuesta != null && ("s".equalsIgnoreCase(respuesta.trim())
                    || "si".equalsIgnoreCase(respuesta.trim()));
        }

        private String leerObligatorio(String mensaje, String error) {
            while (true) {
                String valor = leer(mensaje);
                if (valor == null) {
                    throw new IllegalStateException("Entrada terminada por el usuario.");
                }
                if (!valor.trim().isEmpty()) {
                    return valor.trim();
                }
                salida.println(error);
            }
        }

        private String leerPassword(String mensaje) {
            Console consola = System.console();
            if (consola != null) {
                char[] clave = consola.readPassword(mensaje);
                return clave == null ? null : new String(clave);
            }
            salida.print(mensaje);
            salida.flush();
            return leerLinea();
        }

        private String leer(String mensaje) {
            salida.print(mensaje);
            salida.flush();
            return leerLinea();
        }

        private String leerLinea() {
            try {
                return entrada.readLine();
            } catch (Exception e) {
                throw new IllegalStateException("No se pudo leer la entrada estandar.", e);
            }
        }

        private Integer parsearEntero(String texto, int minimo, int maximo) {
            try {
                int valor = Integer.parseInt(texto.trim());
                return valor >= minimo && valor <= maximo ? valor : null;
            } catch (NumberFormatException e) {
                return null;
            }
        }

        private static String valorEntorno(String nombre, String porDefecto) {
            String valor = System.getenv(nombre);
            if (valor == null || valor.trim().isEmpty()) {
                return porDefecto;
            }
            return valor;
        }
    }
}
