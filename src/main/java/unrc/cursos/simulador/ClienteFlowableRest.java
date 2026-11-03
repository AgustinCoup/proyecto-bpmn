package unrc.cursos.simulador;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Cliente minimo de la API REST de Flowable usado por el simulador.
 *
 * Verificado contra Flowable 6.8.0: las acciones sobre una ejecucion se
 * envian con PUT (no POST), y las suscripciones se consultan en
 * /runtime/event-subscriptions.
 */
public final class ClienteFlowableRest {

    private static final String ACCION_MENSAJE = "messageEventReceived";
    private static final String ACCION_SENAL = "signal";

    private final String baseUrl;
    private final String authorization;
    private final HttpClient httpClient;
    private final ObjectMapper mapper;

    public ClienteFlowableRest(String baseUrl, String usuario, String clave) {
        if (baseUrl == null || baseUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("La URL de la API REST no puede estar vacia.");
        }
        if (usuario == null || usuario.trim().isEmpty()) {
            throw new IllegalArgumentException("El usuario de la API REST no puede estar vacio.");
        }
        if (clave == null) {
            throw new IllegalArgumentException("La clave de la API REST no puede ser null.");
        }
        this.baseUrl = quitarBarraFinal(baseUrl.trim());
        String credenciales = usuario + ":" + clave;
        this.authorization = "Basic " + Base64.getEncoder()
                .encodeToString(credenciales.getBytes(StandardCharsets.UTF_8));
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.mapper = new ObjectMapper();
    }

    public List<InstanciaResumen> listarInstancias() {
        List<InstanciaResumen> resultado = new ArrayList<>();
        int start = 0;
        while (true) {
            String ruta = "/runtime/process-instances?size=100&start=" + start
                    + "&includeProcessVariables=true";
            JsonNode respuesta = get(ruta);
            JsonNode datos = respuesta.path("data");
            if (!datos.isArray() || datos.size() == 0) {
                break;
            }
            for (JsonNode item : datos) {
                resultado.add(parsearInstancia(item));
            }
            start += datos.size();
            int total = respuesta.path("total").asInt(resultado.size());
            if (start >= total) {
                break;
            }
        }
        resultado.sort((a, b) -> {
            String sa = a.getStartTime() == null ? "" : a.getStartTime();
            String sb = b.getStartTime() == null ? "" : b.getStartTime();
            return sb.compareTo(sa);
        });
        return resultado;
    }

    public EstadoInstancia obtenerEstado(String processInstanceId) {
        String pid = codificar(processInstanceId);
        JsonNode ejecucionesJson = get("/runtime/executions?size=200&processInstanceId=" + pid);
        List<EjecucionActiva> ejecuciones = new ArrayList<>();
        for (JsonNode item : ejecucionesJson.path("data")) {
            ejecuciones.add(new EjecucionActiva(
                    item.path("id").asText(),
                    item.hasNonNull("activityId") ? item.get("activityId").asText() : null));
        }

        JsonNode suscripcionesJson = get("/runtime/event-subscriptions?size=200&processInstanceId=" + pid);
        List<SuscripcionEvento> suscripciones = new ArrayList<>();
        for (JsonNode item : suscripcionesJson.path("data")) {
            suscripciones.add(new SuscripcionEvento(
                    item.path("eventType").asText(""),
                    item.hasNonNull("eventName") ? item.get("eventName").asText() : null,
                    item.hasNonNull("activityId") ? item.get("activityId").asText() : null,
                    item.path("executionId").asText()));
        }
        return new EstadoInstancia(processInstanceId, ejecuciones, suscripciones);
    }

    public void enviarMensaje(String executionId, String messageName, Map<String, Object> variables) {
        ObjectNode cuerpo = mapper.createObjectNode();
        cuerpo.put("action", ACCION_MENSAJE);
        cuerpo.put("messageName", messageName);
        cuerpo.set("variables", variablesJson(variables));
        put("/runtime/executions/" + codificar(executionId), cuerpo);
    }

    public void enviarSenal(String executionId, Map<String, Object> variables) {
        ObjectNode cuerpo = mapper.createObjectNode();
        cuerpo.put("action", ACCION_SENAL);
        cuerpo.set("variables", variablesJson(variables));
        put("/runtime/executions/" + codificar(executionId), cuerpo);
    }

    private ArrayNode variablesJson(Map<String, Object> variables) {
        ArrayNode array = mapper.createArrayNode();
        if (variables == null) {
            return array;
        }
        for (Map.Entry<String, Object> entrada : variables.entrySet()) {
            ObjectNode variable = array.addObject();
            variable.put("name", entrada.getKey());
            variable.put("type", "string");
            Object valor = entrada.getValue();
            variable.put("value", valor == null ? null : String.valueOf(valor));
        }
        return array;
    }

    private InstanciaResumen parsearInstancia(JsonNode item) {
        Map<String, Object> variables = new LinkedHashMap<>();
        JsonNode variablesJson = item.path("variables");
        if (variablesJson.isArray()) {
            for (JsonNode variable : variablesJson) {
                String nombre = variable.path("name").asText(null);
                if (nombre != null) {
                    variables.put(nombre, convertirValor(variable.get("value")));
                }
            }
        }
        return new InstanciaResumen(
                item.path("id").asText(),
                item.hasNonNull("businessKey") ? item.get("businessKey").asText() : null,
                item.hasNonNull("processDefinitionName") ? item.get("processDefinitionName").asText() : null,
                item.hasNonNull("startTime") ? item.get("startTime").asText() : null,
                variables);
    }

    private Object convertirValor(JsonNode nodo) {
        if (nodo == null || nodo.isNull()) {
            return null;
        }
        if (nodo.isBoolean()) {
            return nodo.asBoolean();
        }
        if (nodo.isInt() || nodo.isLong()) {
            return nodo.asLong();
        }
        if (nodo.isNumber()) {
            return nodo.asDouble();
        }
        return nodo.asText();
    }

    private JsonNode get(String ruta) {
        HttpRequest request = solicitud(ruta).GET().build();
        return ejecutar(request);
    }

    private JsonNode put(String ruta, JsonNode cuerpo) {
        try {
            HttpRequest request = solicitud(ruta)
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .PUT(HttpRequest.BodyPublishers.ofString(
                            mapper.writeValueAsString(cuerpo), StandardCharsets.UTF_8))
                    .build();
            return ejecutar(request);
        } catch (IOException e) {
            throw new FlowableRestException("No se pudo serializar el cuerpo de la peticion.", e);
        }
    }

    private HttpRequest.Builder solicitud(String ruta) {
        return HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + ruta))
                .timeout(Duration.ofSeconds(30))
                .header("Accept", "application/json; charset=UTF-8")
                .header("Authorization", authorization);
    }

    private JsonNode ejecutar(HttpRequest request) {
        try {
            HttpResponse<String> response = httpClient.send(
                    request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int status = response.statusCode();
            if (status < 200 || status >= 300) {
                throw new FlowableRestException(
                        "La API REST respondio HTTP " + status + " en "
                                + request.method() + " " + request.uri().getPath(),
                        status, response.body());
            }
            String cuerpo = response.body();
            if (cuerpo == null || cuerpo.trim().isEmpty()) {
                return mapper.createObjectNode();
            }
            return mapper.readTree(cuerpo);
        } catch (IOException e) {
            throw new FlowableRestException(
                    "No se pudo comunicar con " + request.uri() + ". "
                            + "Verifica que Flowable REST este levantado y la URL sea correcta.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new FlowableRestException("La peticion a Flowable fue interrumpida.", e);
        }
    }

    private static String codificar(String valor) {
        return URLEncoder.encode(valor, StandardCharsets.UTF_8);
    }

    private static String quitarBarraFinal(String valor) {
        String resultado = valor;
        while (resultado.endsWith("/")) {
            resultado = resultado.substring(0, resultado.length() - 1);
        }
        return resultado;
    }
}
