package unrc.cursos.escritorio;

import unrc.cursos.analisis.ReporteAnalisis;
import unrc.cursos.analisis.ServicioAnalisis;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.ListSelectionModel;
import javax.swing.SwingUtilities;
import javax.swing.SwingWorker;
import javax.swing.UIManager;
import javax.swing.table.AbstractTableModel;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.function.Consumer;

/**
 * Aplicacion de escritorio para la tarea "Preparar materiales".
 *
 * Usa la API Java de Flowable directamente contra la base PostgreSQL del
 * motor. No usa la API REST.
 */
public final class AppMateriales {

    private AppMateriales() {
    }

    public static void main(String[] args) {
        try {
            UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        } catch (Exception ignored) {
            // Se usa el look and feel por defecto de Java.
        }
        SwingUtilities.invokeLater(() -> {
            try {
                ConfiguracionBd configuracion = ConfiguracionBd.desdeEntorno();
                ServicioTareas servicio = ServicioTareas.desdeConfiguracion(configuracion);
                new VentanaMateriales(servicio, configuracion).setVisible(true);
            } catch (Exception e) {
                e.printStackTrace(System.err);
                JOptionPane.showMessageDialog(null,
                        "No se pudo iniciar la aplicacion.\n\n" + mensajeError(e),
                        "Error de conexion", JOptionPane.ERROR_MESSAGE);
                System.exit(1);
            }
        });
    }

    private static String mensajeError(Throwable error) {
        Throwable causa = error;
        while (causa.getCause() != null && causa.getCause() != causa) {
            causa = causa.getCause();
        }
        String mensaje = causa.getMessage();
        return mensaje == null ? causa.getClass().getSimpleName() : mensaje;
    }

    private static final class VentanaMateriales extends JFrame {

        private static final String CARD_LOGIN = "login";
        private static final String CARD_TAREAS = "tareas";

        private final ServicioTareas servicio;
        private final CardLayout cardLayout = new CardLayout();
        private final JPanel contenedor = new JPanel(cardLayout);

        private JTextField campoUsuario;
        private JPasswordField campoClave;
        private JButton botonIngresar;

        private JLabel etiquetaSesion;
        private JLabel etiquetaEstado;
        private JTable tabla;
        private TareaTableModel modelo;
        private JButton botonActualizar;
        private JButton botonReclamar;
        private JButton botonCompletar;
        private JButton botonCambiarUsuario;
        private JButton botonAnalisis;

        private String usuario;

        VentanaMateriales(ServicioTareas servicio, ConfiguracionBd configuracion) {
            super("Preparar materiales - Flowable");
            this.servicio = servicio;
            setDefaultCloseOperation(JFrame.DO_NOTHING_ON_CLOSE);
            setMinimumSize(new Dimension(900, 480));
            setSize(980, 540);
            setLocationRelativeTo(null);
            addWindowListener(new WindowAdapter() {
                @Override
                public void windowClosing(WindowEvent e) {
                    cerrarAplicacion();
                }
            });

            contenedor.add(construirPanelLogin(configuracion), CARD_LOGIN);
            contenedor.add(construirPanelTareas(), CARD_TAREAS);
            setContentPane(contenedor);
            cardLayout.show(contenedor, CARD_LOGIN);
        }

        private JPanel construirPanelLogin(ConfiguracionBd configuracion) {
            JPanel panel = new JPanel(new GridBagLayout());
            panel.setBorder(BorderFactory.createEmptyBorder(40, 40, 40, 40));
            GridBagConstraints gbc = new GridBagConstraints();
            gbc.insets = new Insets(6, 6, 6, 6);
            gbc.anchor = GridBagConstraints.WEST;
            gbc.fill = GridBagConstraints.HORIZONTAL;

            JLabel titulo = new JLabel("Preparar materiales");
            titulo.setFont(titulo.getFont().deriveFont(Font.BOLD, 22f));
            gbc.gridx = 0;
            gbc.gridy = 0;
            gbc.gridwidth = 2;
            panel.add(titulo, gbc);

            JLabel subtitulo = new JLabel("Acceso de administrativos con usuario de Flowable");
            gbc.gridy = 1;
            gbc.insets = new Insets(0, 6, 18, 6);
            panel.add(subtitulo, gbc);

            gbc.insets = new Insets(6, 6, 6, 6);
            gbc.gridwidth = 1;
            gbc.gridy = 2;
            gbc.gridx = 0;
            panel.add(new JLabel("Usuario:"), gbc);
            gbc.gridx = 1;
            campoUsuario = new JTextField(22);
            panel.add(campoUsuario, gbc);

            gbc.gridy = 3;
            gbc.gridx = 0;
            panel.add(new JLabel("Clave:"), gbc);
            gbc.gridx = 1;
            campoClave = new JPasswordField(22);
            panel.add(campoClave, gbc);

            gbc.gridy = 4;
            gbc.gridx = 0;
            gbc.gridwidth = 2;
            gbc.anchor = GridBagConstraints.WEST;
            botonIngresar = new JButton("Ingresar");
            botonIngresar.addActionListener(e -> ingresar());
            panel.add(botonIngresar, gbc);

            JLabel conexion = new JLabel("Base del motor: " + configuracion.getUrl()
                    + " | usuario JDBC: " + configuracion.getUsuario());
            conexion.setFont(conexion.getFont().deriveFont(Font.PLAIN, 11f));
            gbc.gridy = 5;
            gbc.insets = new Insets(20, 6, 0, 6);
            panel.add(conexion, gbc);

            getRootPane().setDefaultButton(botonIngresar);
            return panel;
        }

        private JPanel construirPanelTareas() {
            JPanel panel = new JPanel(new BorderLayout(8, 8));
            panel.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));

            JPanel cabecera = new JPanel(new BorderLayout());
            etiquetaSesion = new JLabel(" ");
            etiquetaSesion.setFont(etiquetaSesion.getFont().deriveFont(Font.BOLD, 14f));
            cabecera.add(etiquetaSesion, BorderLayout.WEST);

            JPanel botonesCabecera = new JPanel(new FlowLayout(FlowLayout.RIGHT, 6, 0));
            botonActualizar = new JButton("Actualizar");
            botonActualizar.addActionListener(e -> actualizarTareas());
            botonAnalisis = new JButton("Analisis del historial");
            botonAnalisis.addActionListener(e -> mostrarAnalisis());
            botonCambiarUsuario = new JButton("Cambiar usuario");
            botonCambiarUsuario.addActionListener(e -> cerrarSesion());
            JButton botonSalir = new JButton("Salir");
            botonSalir.addActionListener(e -> cerrarAplicacion());
            botonesCabecera.add(botonActualizar);
            botonesCabecera.add(botonAnalisis);
            botonesCabecera.add(botonCambiarUsuario);
            botonesCabecera.add(botonSalir);
            cabecera.add(botonesCabecera, BorderLayout.EAST);
            panel.add(cabecera, BorderLayout.NORTH);

            modelo = new TareaTableModel();
            tabla = new JTable(modelo);
            tabla.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
            tabla.setRowHeight(24);
            tabla.getTableHeader().setReorderingAllowed(false);
            tabla.getSelectionModel().addListSelectionListener(e -> actualizarBotones());
            panel.add(new JScrollPane(tabla), BorderLayout.CENTER);

            JPanel pie = new JPanel(new BorderLayout(8, 8));
            JPanel botones = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
            botonReclamar = new JButton("Reclamar tarea");
            botonReclamar.addActionListener(e -> reclamarSeleccionada());
            botonCompletar = new JButton("Completar tarea");
            botonCompletar.addActionListener(e -> completarSeleccionada());
            botones.add(botonReclamar);
            botones.add(botonCompletar);
            pie.add(botones, BorderLayout.WEST);

            etiquetaEstado = new JLabel(" ");
            pie.add(etiquetaEstado, BorderLayout.SOUTH);
            panel.add(pie, BorderLayout.SOUTH);

            actualizarBotones();
            return panel;
        }

        private void ingresar() {
            String candidato = campoUsuario.getText() == null ? "" : campoUsuario.getText().trim();
            char[] clave = campoClave.getPassword();
            if (candidato.isEmpty()) {
                JOptionPane.showMessageDialog(this, "Ingresa tu usuario de Flowable.",
                        "Datos incompletos", JOptionPane.WARNING_MESSAGE);
                campoUsuario.requestFocus();
                return;
            }
            if (clave.length == 0) {
                JOptionPane.showMessageDialog(this, "Ingresa tu clave.",
                        "Datos incompletos", JOptionPane.WARNING_MESSAGE);
                campoClave.requestFocus();
                return;
            }

            botonIngresar.setEnabled(false);
            ejecutarEnSegundoPlano(() -> {
                if (!servicio.autenticar(candidato, clave)) {
                    throw new SecurityException("Usuario o clave incorrectos.");
                }
                return servicio.grupos(candidato);
            }, grupos -> {
                java.util.Arrays.fill(clave, '\0');
                campoClave.setText("");
                usuario = candidato;
                etiquetaSesion.setText("Usuario: " + usuario
                        + " | grupos: " + (grupos.isEmpty() ? "(ninguno)" : String.join(", ", grupos)));
                cardLayout.show(contenedor, CARD_TAREAS);
                actualizarTareas();
            }, error -> {
                java.util.Arrays.fill(clave, '\0');
                botonIngresar.setEnabled(true);
                mostrarError("No se pudo iniciar sesion", error);
            });
        }

        /** Consultas de la consigna 4.3 sobre el historial; se calculan en segundo plano al abrir la ventana. */
        private void mostrarAnalisis() {
            ejecutarEnSegundoPlano(
                    () -> ReporteAnalisis.generar(new ServicioAnalisis(servicio.getMotor())),
                    texto -> {
                        JTextArea area = new JTextArea(texto, 24, 60);
                        area.setEditable(false);
                        area.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 13));
                        JOptionPane.showMessageDialog(this, new JScrollPane(area),
                                "Analisis del historial (consigna 4.3)", JOptionPane.PLAIN_MESSAGE);
                    },
                    error -> mostrarError("No se pudo consultar el historial", error));
        }

        private void actualizarTareas() {
            if (usuario == null) {
                return;
            }
            deshabilitarBotones();
            etiquetaEstado.setText("Consultando tareas...");
            ejecutarEnSegundoPlano(
                    () -> servicio.listarTareasPrepararMateriales(usuario),
                    tareas -> {
                        modelo.setTareas(tareas);
                        etiquetaEstado.setText(tareas.isEmpty()
                                ? "No hay tareas 'Preparar materiales' asignadas ni disponibles para tus grupos."
                                : tareas.size() + " tarea(s) encontrada(s).");
                        actualizarBotones();
                    },
                    error -> {
                        etiquetaEstado.setText("Error al consultar tareas.");
                        mostrarError("No se pudieron consultar las tareas", error);
                        actualizarBotones();
                    });
        }

        private void reclamarSeleccionada() {
            TareaVista tarea = seleccionada();
            if (tarea == null) {
                return;
            }
            deshabilitarBotones();
            ejecutarEnSegundoPlano(
                    () -> {
                        servicio.reclamar(tarea.getId(), usuario);
                        return null;
                    },
                    ignorado -> {
                        JOptionPane.showMessageDialog(this,
                                "Tarea reclamada. Ahora podes completarla.",
                                "Tarea reclamada", JOptionPane.INFORMATION_MESSAGE);
                        actualizarTareas();
                    },
                    error -> {
                        mostrarError("No se pudo reclamar la tarea", error);
                        actualizarTareas();
                    });
        }

        private void completarSeleccionada() {
            TareaVista tarea = seleccionada();
            if (tarea == null) {
                return;
            }
            int respuesta = JOptionPane.showConfirmDialog(this,
                    "Completar la tarea \"" + tarea.getNombre() + "\"?\n"
                            + "Instancia: " + tarea.getProcessInstanceId(),
                    "Confirmar", JOptionPane.YES_NO_OPTION, JOptionPane.QUESTION_MESSAGE);
            if (respuesta != JOptionPane.YES_OPTION) {
                return;
            }
            deshabilitarBotones();
            ejecutarEnSegundoPlano(
                    () -> {
                        servicio.completar(tarea.getId(), usuario);
                        return null;
                    },
                    ignorado -> {
                        JOptionPane.showMessageDialog(this,
                                "Tarea completada.",
                                "Tarea completada", JOptionPane.INFORMATION_MESSAGE);
                        actualizarTareas();
                    },
                    error -> {
                        mostrarError("No se pudo completar la tarea", error);
                        actualizarTareas();
                    });
        }

        private void cerrarSesion() {
            usuario = null;
            modelo.setTareas(Collections.emptyList());
            etiquetaSesion.setText(" ");
            etiquetaEstado.setText(" ");
            campoUsuario.setText("");
            campoClave.setText("");
            botonIngresar.setEnabled(true);
            actualizarBotones();
            cardLayout.show(contenedor, CARD_LOGIN);
            campoUsuario.requestFocus();
        }

        private TareaVista seleccionada() {
            int fila = tabla.getSelectedRow();
            if (fila < 0) {
                return null;
            }
            return modelo.getTarea(tabla.convertRowIndexToModel(fila));
        }

        private void actualizarBotones() {
            TareaVista tarea = seleccionada();
            boolean haySeleccion = tarea != null;
            botonReclamar.setEnabled(haySeleccion && tarea.estaDisponible());
            botonCompletar.setEnabled(haySeleccion && !tarea.estaDisponible()
                    && usuario != null && usuario.equals(tarea.getAsignadaA()));
        }

        private void deshabilitarBotones() {
            botonReclamar.setEnabled(false);
            botonCompletar.setEnabled(false);
        }

        private <T> void ejecutarEnSegundoPlano(Callable<T> tarea,
                                                Consumer<T> alExito,
                                                Consumer<Throwable> alError) {
            setCursor(Cursor.getPredefinedCursor(Cursor.WAIT_CURSOR));
            new SwingWorker<T, Void>() {
                @Override
                protected T doInBackground() throws Exception {
                    return tarea.call();
                }

                @Override
                protected void done() {
                    setCursor(Cursor.getDefaultCursor());
                    try {
                        alExito.accept(get());
                    } catch (java.util.concurrent.ExecutionException e) {
                        alError.accept(e.getCause() == null ? e : e.getCause());
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        alError.accept(e);
                    }
                }
            }.execute();
        }

        private void mostrarError(String titulo, Throwable error) {
            JOptionPane.showMessageDialog(this,
                    titulo + ".\n\n" + mensajeError(error),
                    "Error", JOptionPane.ERROR_MESSAGE);
        }

        private void cerrarAplicacion() {
            try {
                servicio.cerrar();
            } catch (RuntimeException e) {
                JOptionPane.showMessageDialog(this,
                        "No se pudo cerrar el motor limpiamente: " + mensajeError(e),
                        "Aviso", JOptionPane.WARNING_MESSAGE);
            }
            dispose();
            System.exit(0);
        }
    }

    private static final class TareaTableModel extends AbstractTableModel {

        private static final String[] COLUMNAS = {
                "Tarea", "Estado", "Creada", "Business key", "Instancia"
        };
        private static final DateTimeFormatter FORMATO_FECHA =
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.systemDefault());

        private final List<TareaVista> tareas = new ArrayList<>();

        void setTareas(List<TareaVista> nuevas) {
            tareas.clear();
            tareas.addAll(nuevas);
            fireTableDataChanged();
        }

        TareaVista getTarea(int fila) {
            return tareas.get(fila);
        }

        @Override
        public int getRowCount() {
            return tareas.size();
        }

        @Override
        public int getColumnCount() {
            return COLUMNAS.length;
        }

        @Override
        public String getColumnName(int column) {
            return COLUMNAS[column];
        }

        @Override
        public Object getValueAt(int rowIndex, int columnIndex) {
            TareaVista tarea = tareas.get(rowIndex);
            switch (columnIndex) {
                case 0:
                    return tarea.getNombre();
                case 1:
                    return tarea.descripcionEstado();
                case 2:
                    return tarea.getCreada() == null ? ""
                            : FORMATO_FECHA.format(tarea.getCreada().toInstant());
                case 3:
                    return tarea.getBusinessKey() == null ? "" : tarea.getBusinessKey();
                case 4:
                    return tarea.getProcessInstanceId();
                default:
                    return "";
            }
        }
    }
}
