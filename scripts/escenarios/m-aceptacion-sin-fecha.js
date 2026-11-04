// Verifica el hallazgo Contrato §11.30: "Aceptación" sin fechaCurso se acepta (204) y el error (500) aparece recién al
// completar "Definir Docente…", cuando se intenta crear el timer Fecha (${fechaCurso}).
// Uso: node scripts/escenarios/m-aceptacion-sin-fecha.js   (deja el motor sin instancias activas; no toca despliegues)
const J = require('./proceso');
(async () => {
  await J.desplegarTodo();
  await J.limpiarActivas('aceptación sin fecha');
  const r0 = await J.rest('POST', '/runtime/process-instances', { message: 'Solicitud de curso', businessKey: '890',
    variables: [J.int('cursoId', 890), J.int('empresaId', 1)] });
  const pid = r0.json.id;
  await J.completar(pid, 'Propuesta');
  await J.esperarHasta('espera respuesta', async () => (await J.timers(pid)).length === 1, 20);
  const r = await J.enviarMensaje(pid, 'Aceptación'); // sin fechaCurso
  J.verificar('Aceptación sin fecha se acepta (204)', r.status, 204);
  const ej = (await J.rest('GET', `/runtime/executions?processInstanceId=${pid}&activityId=Nomina`, undefined, { quiet: true })).json.data[0];
  await J.rest('PUT', `/runtime/executions/${ej.id}`, { action: 'signal', variables: [J.str('participantes', '[]')] });
  await J.esperarHasta('Lista', () => J.hayTarea(pid, 'Lista'), 20);
  await J.completar(pid, 'Lista');
  await J.completar(pid, 'Material');
  await J.completar(pid, 'Activity_12i2hpf', [J.bool('requiereAula', false), J.bool('requierePlataforma', true), J.bool('requiereEquipamiento', false)]);
  await J.completar(pid, 'Virtual');
  await J.esperarHasta('Definir docente', () => J.hayTarea(pid, 'Activity_1018bdz'), 20);
  const f = await J.completar(pid, 'Activity_1018bdz', [J.str('docenteSeleccionado', 'docente1')]);
  J.verificar('Definir docente falla con 500 (no existe ${fechaCurso})', f.status, 500);
  J.verificar('mensaje del error', /fechaCurso/.test(f.texto), true);
  J.verificar('la tarea sigue abierta (se deshizo todo)', await J.hayTarea(pid, 'Activity_1018bdz'), true);
  await J.rest('DELETE', `/runtime/process-instances/${pid}`, undefined, { quiet: true });
  J.terminar();
})().catch((e) => { console.error(e); process.exit(1); });
