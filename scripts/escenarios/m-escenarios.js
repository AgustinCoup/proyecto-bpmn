// Recorrido automatizado de los escenarios de la defensa 1 a 7 y 11 (consigna §5) contra el entorno real.
// Los escenarios 8, 9 y 10 dependen del sitio web: ver informe/checklist-manual.md.
//
// Requisitos: Docker arriba con el JAR actual, usuarios (crear-usuarios) y BD (crear-bd) creados, mvn package hecho,
// y el classpath de dependencias: mvn -q dependency:build-classpath -Dmdep.outputFile=<resultados>/classpath.txt
// (si falta, este script lo genera). Node 18+, Java 11+.
// Uso (desde la raíz del repo):
//   node scripts/escenarios/m-escenarios.js [--solo=1,3,11] [--conservar]   (o scripts/escenarios/m-escenarios.js)
// Al final deja Flowable con sólo "Demo processes" (borra los despliegues de Process_Curso y de la DMN), salvo --conservar.
// Código de salida: 0 si todo PASS, 1 si algún escenario falla.
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const J = require('./proceso');

const RAIZ = J.RAIZ;
const CP_ARCHIVO = path.join(J.RESULTADOS, 'classpath.txt');
const SOLO = (process.argv.find((a) => a.startsWith('--solo=')) || '').replace('--solo=', '').split(',').filter(Boolean).map(Number);
const CONSERVAR = process.argv.includes('--conservar');
const CURSOS = [];

const sql = (q) => execSync('docker compose exec -T postgres psql -U institucion -d institucion -tA', { cwd: RAIZ, input: q }).toString('utf8').trim();

// ---------- verificación por escenario ----------
let actual = null;
function check(desc, real, esperado) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  J.log(`  ${ok ? '✔' : '✘'} ${desc}: esperado ${JSON.stringify(esperado)}, real ${JSON.stringify(real)}`);
  if (!ok) actual.fallos.push(desc);
}
const nota = (k, v) => { actual.evidencia[k] = v; };

// ---------- SMTP falso (equivale a DevNullSmtp): recoge los avisos por correo del proceso ----------
const { iniciar: iniciarSumidero, correos } = require('./m-smtp-sumidero');
let smtpActivo = false;
const iniciarSmtp = async () => { smtpActivo = await iniciarSumidero(25); return smtpActivo; };
// Verifica que desde la marca hayan llegado correos con estos asuntos (sólo si el sumidero está activo).
async function checkCorreos(desc, desde, asuntos) {
  if (!smtpActivo) return;
  const hay = () => correos.slice(desde).map((c) => c.asunto);
  try { await J.esperarHasta('correos recibidos: ' + asuntos.join(' | '), async () => asuntos.every((a) => hay().some((x) => x.includes(a))), 10); } catch { /* se informa abajo */ }
  check(desc, asuntos.map((a) => hay().some((x) => x.includes(a))), asuntos.map(() => true));
}

// ---------- utilidades ----------
async function iniciarCurso(cursoId, empresaId, extras = []) {
  CURSOS.push(cursoId);
  sql(`delete from curso where id=${cursoId}; insert into curso (id, empresa_id, tematica, descripcion, cantidad_participantes, fechas_preferidas)
       values (${cursoId}, ${empresaId}, 'Prueba escenarios', 'x', 10, 'pronto');`);
  const r = await J.rest('POST', '/runtime/process-instances', {
    message: 'Solicitud de curso', businessKey: String(cursoId),
    variables: [J.int('cursoId', cursoId), J.int('empresaId', empresaId), ...extras],
  });
  if (r.status !== 201) throw new Error('No se pudo iniciar el curso ' + cursoId + ': ' + r.texto);
  sql(`update curso set process_instance_id='${r.json.id}' where id=${cursoId};`);
  return r.json.id;
}
const estadoCurso = (id) => sql(`select estado from curso where id=${id};`);
const fechaEn = (seg) => new Date(Date.now() + seg * 1000).toISOString().slice(0, 19) + 'Z';
const completarPropuesta = async (pid) => {
  await J.completar(pid, 'Propuesta');
  check('Enviar propuesta está asignada a jefeAdmin', (await J.tarea(pid, 'Enviar')).assignee, 'jefeAdmin');
  await J.completar(pid, 'Enviar');
  await J.esperarHasta('espera respuesta (timer Plazo)', async () => (await J.timers(pid)).length === 1, 20);
};
async function aceptar(pid, seg) {
  await completarPropuesta(pid);
  await J.enviarMensaje(pid, 'Aceptación', [J.str('fechaCurso', fechaEn(seg))]);
}
async function ejecucionEn(pid, act) {
  const { json } = await J.rest('GET', `/runtime/executions?processInstanceId=${pid}&activityId=${act}`, undefined, { quiet: true });
  return json.data[0];
}
const enviarNomina = async (pid, lista) =>
  J.rest('PUT', `/runtime/executions/${(await ejecucionEn(pid, 'Nomina')).id}`, { action: 'signal', variables: [J.str('participantes', lista)] });
const recursos = (aula, virt, equipo) => [J.bool('requiereAula', aula), J.bool('requierePlataforma', virt), J.bool('requiereEquipamiento', equipo)];
const idsActividades = async (pid) => (await J.actividades(pid)).map((a) => a.activityId);
async function tareasActivas(pid) {
  const { json } = await J.rest('GET', `/runtime/tasks?processInstanceId=${pid}`, undefined, { quiet: true });
  return json.data;
}
const borrar = (pid) => J.rest('DELETE', `/runtime/process-instances/${pid}`, undefined, { quiet: true });

function classpath() {
  if (!fs.existsSync(CP_ARCHIVO)) {
    execSync(`mvn -q dependency:build-classpath -Dmdep.outputFile="${CP_ARCHIVO}"`, { cwd: RAIZ, stdio: 'inherit' });
  }
  // M_CP_EXTRA: jars adicionales para el lanzador Java (diagnóstico; diagnóstico; ya no hace falta).
  return ['target/classes', fs.readFileSync(CP_ARCHIVO, 'utf8').trim(), process.env.M_CP_EXTRA].filter(Boolean).join(path.delimiter);
}
function java(args, { env = {}, input } = {}) {
  const r = spawnSync('java', ['-Dfile.encoding=UTF-8', '-Dstdout.encoding=UTF-8', '-cp', classpath(), ...args],
    { cwd: RAIZ, input, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 120000 });
  return { codigo: r.status, salida: (r.stdout || '') + (r.stderr || '') };
}
function materiales(accion, usuario, clave, tareaId) {
  const r = java([path.join(__dirname, 'm-MaterialesApiJava.java'), accion, usuario, clave, ...(tareaId ? [tareaId] : [])],
    { env: { FLOWABLE_DB_USER: 'flowable', FLOWABLE_DB_PASSWORD: 'flowable' } });
  const lineas = r.salida.split(/\r?\n/).filter((l) => /^(OK|ERROR|TAREA) /.test(l));
  J.log(`  [app Java] ${accion} ${usuario}${tareaId ? ' ' + tareaId : ''} → ${lineas.join(' | ') || r.salida.slice(-300)}`);
  return { ok: lineas.some((l) => l.startsWith('OK ')) && r.codigo === 0, lineas };
}

// ---------- escenarios ----------
async function e1() {
  const marca = correos.length;
  sql('delete from cuenta_empresa where empresa_id=2;');
  const pid = await iniciarCurso(801, 2);
  await aceptar(pid, 40);
  check('estadoCurso al entrar a Preparar', await J.valor(pid, 'estadoCurso'), 'EN_PREPARACION');
  check('Habilitar acceso creó la cuenta de la empresa 2', sql('select usuario from cuenta_empresa where empresa_id=2;'), 'emp_30722334456');
  await enviarNomina(pid, '["Ana","Beto"]');
  await J.esperarHasta('Lista creada', () => J.hayTarea(pid, 'Lista'), 20);
  check('Lista asignada al administrativo menos cargado (empate → alfabético)', (await J.tarea(pid, 'Lista')).assignee, 'admin2');
  await J.completar(pid, 'Lista');
  await J.completar(pid, 'Material');
  await J.completar(pid, 'Activity_12i2hpf', recursos(true, true, true));
  await J.esperarHasta('Virtual y Equipo creadas', async () => (await J.hayTarea(pid, 'Virtual')) && (await J.hayTarea(pid, 'Equipo')), 20);
  check('aula reservada por el delegate', await J.valor(pid, 'aulaAsignada'), 'Aula Magna Principal');
  await J.completar(pid, 'Virtual');
  await J.completar(pid, 'Equipo');
  const docente = await J.completar(pid, 'Activity_1018bdz', [J.str('docenteSeleccionado', 'docente1')]);
  check('Definir docente responde 200', docente.status, 200);
  check('estadoCurso tras confirmar', await J.valor(pid, 'estadoCurso'), 'CONFIRMADO_PENDIENTE_INICIO');
  await J.esperarHasta('Dictar creada al llegar la fecha acordada', () => J.hayTarea(pid, 'Dictar'), 90);
  check('Dictar asignada al docente elegido', (await J.tarea(pid, 'Dictar')).assignee, 'docente1');
  check('estadoCurso en el dictado', await J.valor(pid, 'estadoCurso'), 'EN_DESARROLLO');
  await J.completar(pid, 'Dictar');
  check('estadoCurso tras el dictado', await J.valor(pid, 'estadoCurso'), 'ELABORANDO_INFORME');
  check('Informe asignado a jefeDocente', (await J.tarea(pid, 'Informe')).assignee, 'jefeDocente');
  await J.completar(pid, 'Informe');
  check('Enviar informe asignado a jefeAdmin', (await J.tarea(pid, 'EnviarInforme')).assignee, 'jefeAdmin');
  await J.completar(pid, 'EnviarInforme');
  await J.esperarHasta('Liberar Equipamiento (compensación)', () => J.hayTarea(pid, 'Activity_1m08pcl'), 20);
  check('el proceso NO terminó antes de liberar el equipamiento', await J.terminada(pid), false);
  await J.completar(pid, 'Activity_1m08pcl');
  await J.esperarHasta('proceso terminado', () => J.terminada(pid), 20);
  const v = await J.variables(pid, 'fin');
  check('Liberar Aula corrió', v.aulaLiberada, true);
  check('Liberar Aula Virtual corrió', v.aulaVirtualLiberada, true);
  check('estadoCurso final', v.estadoCurso, 'FINALIZADO');
  await checkCorreos('avisos por correo a la empresa 2', marca, ['Propuesta de curso (version 1)', 'Confirmacion del curso', 'Informe de resultados']);
  check('resultado', v.resultado, 'FINALIZADO');
  check('curso.estado', estadoCurso(801), 'FINALIZADO');
  nota('resultado', v.resultado); nota('curso.estado', estadoCurso(801));
}

async function e2() {
  const marca = correos.length;
  const pid = await iniciarCurso(802, 1);
  await completarPropuesta(pid);
  check('propuestaVersion inicial', await J.valor(pid, 'propuestaVersion'), 1);
  await J.enviarMensaje(pid, 'Solicitud de modificaciones', [J.str('observaciones', 'Reducir el presupuesto')]);
  await J.esperarHasta('Revisar creada', () => J.hayTarea(pid, 'Revisar'), 20);
  check('Revisar asignada a jefeAdmin', (await J.tarea(pid, 'Revisar')).assignee, 'jefeAdmin');
  check('observaciones guardadas', await J.valor(pid, 'observaciones'), 'Reducir el presupuesto');
  await J.completar(pid, 'Revisar');
  check('propuestaVersion tras revisar (antes de reenviar)', await J.valor(pid, 'propuestaVersion'), 2);
  check('Enviar propuesta vuelve a ser tarea de jefeAdmin', (await J.tarea(pid, 'Enviar')).assignee, 'jefeAdmin');
  await J.completar(pid, 'Enviar');
  await J.esperarHasta('nueva espera de respuesta (timer nuevo)', async () => (await J.timers(pid)).length === 1, 20);
  const v = await J.variables(pid, 'tras reenviar');
  check('propuestaVersion tras revisar', v.propuestaVersion, 2);
  check('recordatorios reiniciado', v.recordatorios, 0);
  const subs = (await J.suscripciones(pid)).map((s) => s.eventName).sort();
  check('mensajes habilitados otra vez', subs, ['Aceptación', 'Rechazo', 'Solicitud de modificaciones']);
  check('Enviar corrió una vez por versión', (await idsActividades(pid)).filter((a) => a === 'Enviar').length, 2);
  nota('propuestaVersion', v.propuestaVersion);
  await checkCorreos('la empresa recibió las versiones 1 y 2 de la propuesta', marca, ['Propuesta de curso (version 1)', 'Propuesta de curso (version 2)']);
  await borrar(pid); // la instancia queda esperando; se borra para no contar en el límite de 5
}

async function e3() {
  const pid = await iniciarCurso(803, 1);
  await completarPropuesta(pid);
  await J.enviarMensaje(pid, 'Rechazo');
  await J.esperarHasta('Archivar creada', () => J.hayTarea(pid, 'Archivar'), 20);
  check('Archivar asignada a jefeAdmin', (await J.tarea(pid, 'Archivar')).assignee, 'jefeAdmin');
  check('resultado ya es RECHAZADO antes de archivar', await J.valor(pid, 'resultado'), 'RECHAZADO');
  await J.completar(pid, 'Archivar');
  await J.esperarHasta('proceso terminado', () => J.terminada(pid), 20);
  check('no pasó por Recordatorio ni Preparar', (await idsActividades(pid)).some((a) => ['Recordatorio', 'Preparar'].includes(a)), false);
  check('curso.estado', estadoCurso(803), 'RECHAZADO');
  nota('curso.estado', estadoCurso(803));
}

async function e4() {
  const marca = correos.length;
  const pid = await iniciarCurso(804, 1, [J.str('plazoRespuesta', 'PT20S')]);
  await J.completar(pid, 'Propuesta');
  await J.completar(pid, 'Enviar');
  await J.esperarHasta('Archivar creada tras 2 recordatorios y un 3er vencimiento', () => J.hayTarea(pid, 'Archivar'), 120);
  const v = await J.variables(pid, 'antes de archivar');
  check('recordatorios', v.recordatorios, 2);
  check('resultado', v.resultado, 'SIN_RESPUESTA');
  check('Recordatorio corrió 2 veces', (await idsActividades(pid)).filter((a) => a === 'Recordatorio').length, 2);
  await J.completar(pid, 'Archivar');
  await J.esperarHasta('proceso terminado', () => J.terminada(pid), 20);
  check('curso.estado', estadoCurso(804), 'SIN_RESPUESTA');
  await checkCorreos('la empresa recibió la propuesta y los recordatorios', marca, ['Propuesta de curso (version 1)', 'Recordatorio']);
  if (smtpActivo) check('2 recordatorios por correo', correos.slice(marca).filter((c) => c.asunto.includes('Recordatorio')).length, 2);
  nota('curso.estado', estadoCurso(804));
}

async function e5() {
  const marca = correos.length;
  const pids = [];
  for (let i = 1; i <= 5; i++) pids.push(await iniciarCurso(810 + i, 1));
  check('la 5ª (4 otras activas) es viable', await J.valor(pids[4], 'viable'), true);
  const sexta = await iniciarCurso(816, 1);
  check('la 6ª ve 5 otras en ejecución', await J.valor(sexta, 'cursosEnEjecucion'), 5);
  check('la 6ª no es viable', await J.valor(sexta, 'viable'), false);
  await J.esperarHasta('6ª terminada', () => J.terminada(sexta), 20);
  check('terminó sin pasar por Propuesta', (await idsActividades(sexta)).includes('Propuesta'), false);
  check('resultado', await J.valor(sexta, 'resultado'), 'NO_VIABLE');
  check('curso.estado (curso vinculado después de terminar la instancia)', estadoCurso(816), 'NO_VIABLE');
  await checkCorreos('la empresa recibió el aviso de no viable', marca, ['no es posible desarrollarlo']);
  nota('curso.estado', estadoCurso(816));
  for (const p of pids) await borrar(p);
}

async function e6() {
  const marca = correos.length;
  const pid = await iniciarCurso(806, 1);
  await aceptar(pid, 3600);
  await J.completar(pid, 'Activity_12i2hpf', recursos(true, true, true));
  await J.esperarHasta('Virtual y Equipo creadas', async () => (await J.hayTarea(pid, 'Virtual')) && (await J.hayTarea(pid, 'Equipo')), 20);
  await J.completar(pid, 'Equipo'); // gestionados: aula (automática) y equipamiento. Virtual queda pendiente.
  await J.enviarMensaje(pid, 'Cancelación');
  await J.esperarHasta('Liberar Equipamiento creada', () => J.hayTarea(pid, 'Activity_1m08pcl'), 20);
  const v = await J.variables(pid, 'tras cancelar');
  check('Liberar Aula corrió (aula gestionada)', v.aulaLiberada, true);
  check('Liberar Aula Virtual NO corrió (nunca se completó)', v.aulaVirtualLiberada, undefined);
  check('motivoCancelacion', v.motivoCancelacion, 'EMPRESA');
  check('estadoCurso', v.estadoCurso, 'CANCELADO');
  check('la tarea Virtual pendiente fue interrumpida', await J.hayTarea(pid, 'Virtual'), false);
  check('Notificar Cierre espera a Liberar Equipamiento', (await idsActividades(pid)).includes('Activity_12e0et1'), false);
  await J.completar(pid, 'Activity_1m08pcl');
  await J.esperarHasta('proceso terminado', () => J.terminada(pid), 20);
  check('Notificar Cierre corrió después', (await idsActividades(pid)).includes('Activity_12e0et1'), true);
  check('curso.estado', estadoCurso(806), 'CANCELADO');
  await checkCorreos('aviso de cierre por correo', marca, ['Cierre de la solicitud']);
  nota('curso.estado', estadoCurso(806));
}

async function e7() {
  const marca = correos.length;
  const pid = await iniciarCurso(807, 1, [J.bool('simularFaltaAulas', true)]);
  await aceptar(pid, 3600);
  const r = await J.completar(pid, 'Activity_12i2hpf', recursos(true, true, false));
  check('completar Evaluar recursos responde 200 (el error se atrapa)', r.status, 200);
  await J.esperarHasta('proceso terminado', () => J.terminada(pid), 20);
  const acts = await idsActividades(pid);
  check('se disparó el subproceso de eventos de error', acts.includes('InicioFaltaAulas'), true);
  check('pasó por Notificar Cierre', acts.includes('Activity_12e0et1'), true);
  const v = await J.variables(pid, 'fin');
  check('motivoCancelacion', v.motivoCancelacion, 'SIN_AULAS');
  check('resultado', v.resultado, 'CANCELADO');
  check('no se liberó nada que no se gestionó', [v.aulaLiberada, v.aulaVirtualLiberada], [undefined, undefined]);
  check('curso.estado', estadoCurso(807), 'CANCELADO');
  check('estadoCurso', v.estadoCurso, 'CANCELADO');
  await checkCorreos('aviso de cierre por correo', marca, ['Cierre de la solicitud']);
  nota('curso.estado', estadoCurso(807)); nota('motivo', v.motivoCancelacion);
}

async function e11() {
  const pid = await iniciarCurso(811, 1);
  await J.completar(pid, 'Propuesta');
  await J.completar(pid, 'Enviar');
  await J.esperarHasta('espera respuesta', async () => (await J.timers(pid)).length === 1, 20);
  // Simulador de la empresa: el CLI real, con la entrada estándar guionada.
  const entorno = { FLOWABLE_REST_USER: 'jefeAdmin', FLOWABLE_REST_PASSWORD: 'test' };
  const entrada = ['1', '1', fechaEn(3600), '', '1', '["Ana","Beto","Carla"]', '', 'q', 'q', ''].join('\n');
  const cli = java(['unrc.cursos.simulador.SimuladorMain'], { env: entorno, input: entrada });
  fs.writeFileSync(path.join(J.RESULTADOS, 'm-escenario11-simulador.log'), cli.salida);
  const primera = cli.salida.split('Comunicaciones habilitadas:')[1] || '';
  const antes = primera.split('Elegi una accion')[0];
  check('CLI antes de aceptar ofrece Aceptar, Rechazar y Pedir modificaciones', ['Aceptar la propuesta', 'Rechazar la propuesta', 'Pedir modificaciones'].every((t) => antes.includes(t)), true);
  check('CLI antes de aceptar NO ofrece Nómina ni Cancelar', ['nomina', 'Cancelar'].some((t) => antes.includes(t)), false);
  const despues = cli.salida.split('Comunicaciones habilitadas:')[2] || '';
  const bloque = despues.split('Elegi una accion')[0];
  check('CLI tras aceptar ofrece Nómina y Cancelar, y ya no Aceptar', [bloque.includes('Enviar nomina'), bloque.includes('Cancelar durante'), bloque.includes('Aceptar la propuesta')], [true, true, false]);
  check('CLI informó los dos envíos', (cli.salida.match(/Comunicacion enviada/g) || []).length, 2);
  check('fechaCurso llegó a la instancia', typeof await J.valor(pid, 'fechaCurso'), 'string');
  check('participantes llegaron a la instancia', await J.valor(pid, 'participantes'), '["Ana","Beto","Carla"]');
  await J.esperarHasta('Lista creada', () => J.hayTarea(pid, 'Lista'), 20);
  await J.completar(pid, 'Lista');
  await J.completar(pid, 'Activity_12i2hpf', recursos(false, true, false));
  await J.esperarHasta('Virtual creada', () => J.hayTarea(pid, 'Virtual'), 20);
  await J.completar(pid, 'Virtual'); // sólo queda Preparar materiales: la completa la app Java
  // App Java (API Java contra la BD del motor).
  check('docente1 (otro grupo) no ve la tarea', materiales('listar', 'docente1', 'test').lineas[0], 'OK 0 tareas');
  const lista = materiales('listar', 'admin2', 'test');
  const linea = lista.lineas.find((l) => l.startsWith('TAREA '));
  check('admin2 ve 1 tarea Preparar materiales', lista.lineas[0], 'OK 1 tareas');
  const tareaId = linea.split(' ')[1];
  check('no se puede completar sin reclamar', materiales('completar', 'admin2', 'test', tareaId).ok, false);
  check('docente1 no puede reclamarla', materiales('reclamar', 'docente1', 'test', tareaId).ok, false);
  check('clave incorrecta rechazada', materiales('listar', 'admin2', 'mala').ok, false);
  check('admin2 reclama', materiales('reclamar', 'admin2', 'test', tareaId).ok, true);
  check('jefeAdmin ya no la ve como disponible', materiales('listar', 'jefeAdmin', 'test').lineas[0], 'OK 0 tareas');
  check('jefeAdmin no puede completar la de otro', materiales('completar', 'jefeAdmin', 'test', tareaId).ok, false);
  check('admin2 completa', materiales('completar', 'admin2', 'test', tareaId).ok, true);
  await J.esperarHasta('la preparación terminó y el proceso llegó a Definir docente', () => J.hayTarea(pid, 'Activity_1018bdz'), 20);
  check('Confirmar corrió dentro del motor de la app Java', (await idsActividades(pid)).includes('Confirmar'), true);
  await borrar(pid);
}

// ---------- ejecución ----------
const ESCENARIOS = [
  [1, 'Aceptación y finalización normal con liberación de recursos', e1],
  [2, 'Solicitud de modificaciones y nueva propuesta', e2],
  [3, 'Rechazo de la propuesta', e3],
  [4, 'Cierre por falta de respuesta (recordatorios)', e4],
  [5, 'Límite de cursos en ejecución (no viable)', e5],
  [6, 'Cancelación durante la preparación con compensaciones', e6],
  [7, 'Falta de aulas y excepción', e7],
  [11, 'Materiales por API Java + comunicaciones por API REST (CLI)', e11],
];

async function limpiezaFinal() {
  sql(`delete from curso where id in (${CURSOS.join(',') || 0});`);
  sql('delete from cuenta_empresa where empresa_id=2;');
  if (CONSERVAR) return;
  const dep = (await J.rest('GET', '/repository/deployments?size=100', undefined, { quiet: true })).json.data;
  for (const d of dep.filter((x) => x.name !== 'Demo processes')) await J.rest('DELETE', `/repository/deployments/${d.id}?cascade=true`, undefined, { quiet: true });
  const dmn = (await J.rest('GET', '/../dmn-api/dmn-repository/deployments?size=100', undefined, { quiet: true })).json;
  for (const d of (dmn && dmn.data) || []) await J.rest('DELETE', `/../dmn-api/dmn-repository/deployments/${d.id}`, undefined, { quiet: true });
  const quedan = (await J.rest('GET', '/repository/deployments?size=100', undefined, { quiet: true })).json.data.map((x) => x.name);
  J.log(`Limpieza: despliegues que quedan en Flowable: ${JSON.stringify(quedan)}`);
  fs.writeFileSync(path.join(J.RESULTADOS, 'despliegues.json'), '[]');
  fs.writeFileSync(path.join(J.RESULTADOS, 'despliegues-dmn.json'), '[]');
}

(async () => {
  J.log('===== Despliegue: DMN y modelo =====');
  await J.desplegarTodo();
  J.log(`SMTP de prueba en el puerto 25: ${(await iniciarSmtp()) ? 'activo' : 'NO disponible'}`);
  const resumen = [];
  for (const [n, titulo, fn] of ESCENARIOS) {
    if (SOLO.length && !SOLO.includes(n)) continue;
    J.log(`\n===== ESCENARIO ${n}: ${titulo} =====`);
    actual = { n, titulo, fallos: [], evidencia: {}, error: null };
    const t0 = Date.now();
    try {
      await J.limpiarActivas(`escenario ${n}`);
      await fn();
    } catch (e) {
      actual.error = e.message + (e.cause ? ' (' + e.cause.message + ')' : '');
      J.log('  ✘ EXCEPCIÓN: ' + (e.stack || e.message) + (e.cause ? ' | causa: ' + e.cause.stack : ''));
    }
    actual.seg = Math.round((Date.now() - t0) / 1000);
    resumen.push(actual);
  }
  await J.limpiarActivas('final').catch(() => {});
  await limpiezaFinal();

  J.log('\n================ RESUMEN ================');
  for (const r of resumen) {
    const ok = !r.error && r.fallos.length === 0;
    const ev = Object.entries(r.evidencia).map(([k, v]) => `${k}=${v}`).join(', ');
    J.log(`${ok ? 'PASS' : 'FAIL'}  Escenario ${String(r.n).padStart(2)}  ${r.titulo}  (${r.seg} s)${ev ? '  [' + ev + ']' : ''}`);
    if (!ok) J.log(`      ${r.error ? 'Excepción: ' + r.error : 'Fallaron: ' + r.fallos.join(' | ')}`);
  }
  if (smtpActivo) J.log(`Correos recibidos en total: ${correos.length}`);
  J.log('Escenarios 8, 9 y 10: manuales (informe/checklist-manual.md).');
  process.exit(resumen.every((r) => !r.error && r.fallos.length === 0) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
