// Nombres legibles de las actividades del modelo (ver modelo).
const NOMBRES = {
  Inicio: 'Solicitud recibida',
  Activity_1xw400l: 'Evaluar Viabilidad',
  Propuesta: 'Registrar y Elaborar propuesta',
  Enviar: 'Enviar propuesta',
  Esperar: 'Esperar respuesta',
  Modificar: 'Modificaciones',
  Rechazar: 'Rechazo',
  Aceptar: 'Aceptacion',
  Plazo: '5 dias',
  Limite: 'Ya se enviaron 2 recordatorios?',
  Recordatorio: 'Enviar recordatorio',
  Revisar: 'Revisar propuesta',
  Archivar: 'Archivar solicitud',
  Activity_1eg7zcl: 'Habilitar acceso de la empresa',
  Nomina: 'Recibir nomina',
  Lista: 'Confeccionar lista definitiva',
  Material: 'Preparar materiales',
  Activity_12i2hpf: 'Evaluar Recursos',
  OrInicio: 'Recursos necesarios',
  Aula: 'Reservar aula',
  Virtual: 'Solicitar Aula Virtual',
  Equipo: 'Contratar equipamiento',
  Activity_16zz91p: 'Liberar Aula',
  Activity_02hrooc: 'Liberar Aula Virtual',
  Activity_1m08pcl: 'Liberar Equipamiento',
  Confirmar: 'Enviar confirmacion',
  Activity_1018bdz: 'Definir Docente que desarrolla el curso',
  Fecha: 'Fecha programada',
  Dictar: 'Desarrollar curso',
  Informe: 'Elaborar informe de resultados',
  EnviarInforme: 'Enviar informe a empresa y Archivar expediente',
};

function nombreActividad(id) {
  if (!id) return '';
  return NOMBRES[id] || id;
}

module.exports = { NOMBRES, nombreActividad };
