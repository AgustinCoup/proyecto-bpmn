package unrc.cursos.simulador;

/** Error devuelto por la API REST o fallo de comunicacion con ella. */
public class FlowableRestException extends RuntimeException {

    private final int status;

    public FlowableRestException(String mensaje, int status, String cuerpoRespuesta) {
        super(mensaje + (cuerpoRespuesta == null || cuerpoRespuesta.isEmpty()
                ? "" : "\nRespuesta del servidor: " + cuerpoRespuesta));
        this.status = status;
    }

    public FlowableRestException(String mensaje, Throwable causa) {
        super(mensaje, causa);
        this.status = -1;
    }

    public int getStatus() {
        return status;
    }
}
