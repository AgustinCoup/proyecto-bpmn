// Ejecuta la lógica de la app de escritorio "Preparar materiales" SIN la interfaz Swing, usando la misma clase
// ServicioTareas (API Java de Flowable contra la BD del motor). Lo llama m-escenarios.js (escenario 11).
// Uso (Java 11+, modo "archivo fuente"):
//   java -cp "target/classes;<dependencias>" m-MaterialesApiJava.java <accion> <usuario> <clave> [tareaId]
// Acciones: listar | reclamar | completar. Salida: líneas "OK ..." o "ERROR ..." (código de salida 0 / 1).
// Requiere FLOWABLE_DB_USER y FLOWABLE_DB_PASSWORD en el entorno (igual que la app).
import java.util.List;
import unrc.cursos.escritorio.ConfiguracionBd;
import unrc.cursos.escritorio.ServicioTareas;
import unrc.cursos.escritorio.TareaVista;

public class MaterialesApiJava {
    public static void main(String[] args) {
        if (args.length < 3) {
            System.out.println("ERROR uso: <listar|reclamar|completar> <usuario> <clave> [tareaId]");
            System.exit(1);
        }
        String accion = args[0];
        String usuario = args[1];
        ServicioTareas servicio = ServicioTareas.desdeConfiguracion(ConfiguracionBd.desdeEntorno());
        int codigo = 0;
        try {
            if (!servicio.autenticar(usuario, args[2].toCharArray())) {
                System.out.println("ERROR autenticacion rechazada para " + usuario);
                codigo = 1;
            } else if ("listar".equals(accion)) {
                List<TareaVista> tareas = servicio.listarTareasPrepararMateriales(usuario);
                System.out.println("OK " + tareas.size() + " tareas");
                for (TareaVista t : tareas) {
                    System.out.println("TAREA " + t.getId() + " instancia=" + t.getProcessInstanceId()
                            + " asignada=" + t.getAsignadaA());
                }
            } else if (args.length < 4) {
                System.out.println("ERROR falta tareaId");
                codigo = 1;
            } else if ("reclamar".equals(accion)) {
                servicio.reclamar(args[3], usuario);
                System.out.println("OK reclamada " + args[3]);
            } else if ("completar".equals(accion)) {
                servicio.completar(args[3], usuario);
                System.out.println("OK completada " + args[3]);
            } else {
                System.out.println("ERROR accion desconocida " + accion);
                codigo = 1;
            }
        } catch (RuntimeException e) {
            System.out.println("ERROR " + e.getClass().getSimpleName() + ": " + e.getMessage());
            codigo = 1;
        } finally {
            servicio.cerrar();
        }
        System.exit(codigo);
    }
}
