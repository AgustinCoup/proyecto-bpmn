// Genera un historial de ejecuciones de Process_Curso con recorridos variados, para el análisis de la consigna 4.4
// (y para mostrar las consultas de 4.3 con datos). Todo por REST, contra el entorno real.
//
// Requisitos: igual que scripts/escenarios (Docker arriba con el JAR actual, usuarios y BD creados; Node 18+).
// Uso (desde la raíz del repo):
//   node mineria/generar_historial.js              # borra el historial previo de Process_Curso y genera 55 instancias
//   node mineria/generar_historial.js --conservar-historial   # no borra lo que ya había
//
// Es reproducible: la mezcla de casos es fija y el orden de ejecución sale de una semilla (SEMILLA). Los plazos de
// respuesta se acortan con la variable plazoRespuesta (PT8S) para que el cierre por falta de respuesta tarde segundos.
// Deja en Flowable el modelo desplegado y las instancias terminadas en el historial; no deja instancias activas.
const { execSync } = require('child_process');
const path = require('path');
const J = require('../scripts/escenarios/proceso');

const CONSERVAR = process.argv.includes('--conservar-historial');
const SEMILLA = 42;
const PARALELO = 3; // con 3 instancias a la vez, ninguna ve cinco o más "otras" y todas son viables
const PLAZO = 'PT8S';
const PLAZO_LARGO = 'PT1H';
const EMPRESAS = [1, 2];
const ADMINISTRATIVOS = ['jefeAdmin', 'admin2'];
const DOCENTES = ['docente1', 'docente2'];
const COMBOS_RECURSOS = [[true, false, false], [true, true, false], [false, true, false], [true, false, true], [true, true, true]];

const sql = (q) => execSync('docker compose exec -T postgres psql -U institucion -d institucion -tA', { cwd: J.RAIZ, input: q }).toString('utf8').trim();
const quiet = { quiet: true };
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const fallos = [];
let contador = 0;
let siguienteCurso = 9000;
const turno = (lista) => lista[contador++ % lista.length];

// ---------- utilidades REST silenciosas (hay varias instancias en paralelo; el log general sería ilegible) ----------
async function esperar(desc, condicion, maxSeg) {
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < maxSeg) {
    if (await condicion()) return;
    await pausa(1000);
  }
  throw new Error(`No ocurrió en ${maxSeg} s: ${desc}`);
}
const hayTarea = async (pid, clave) =>
  (await J.rest('GET', `/runtime/tasks?processInstanceId=${pid}&taskDefinitionKey=${clave}`, undefined, quiet)).json.data.length === 1;
const terminada = async (pid) =>
  !!(await J.rest('GET', `/history/historic-process-instances/${pid}`, undefined, quiet)).json.endTime;
const timersPendientes = async (pid) =>
  (await J.rest('GET', `/management/timer-jobs?processInstanceId=${pid}`, undefined, quiet)).json.data.length;
const contarActividad = async (pid, id) =>
  (await J.rest('GET', `/history/historic-activity-instances?processInstanceId=${pid}&activityId=${id}&size=50`, undefined, quiet)).json.data.length;

async function completar(pid, clave, variables = []) {
  const t = await J.tarea(pid, clave);
  if (!t.assignee) {
    await J.rest('POST', `/runtime/tasks/${t.id}`, { action: 'claim', assignee: turno(ADMINISTRATIVOS) }, quiet);
  }
  const r = await J.rest('POST', `/runtime/tasks/${t.id}`, { action: 'complete', variables }, quiet);
  if (r.status !== 200) throw new Error(`No se pudo completar ${clave}: ${r.status} ${r.texto}`);
}
async function mensaje(pid, nombre, variables = []) {
  const { json } = await J.rest('GET', `/runtime/executions?processInstanceId=${pid}&messageEventSubscriptionName=${encodeURIComponent(nombre)}`, undefined, quiet);
  if (json.data.length !== 1) throw new Error(`Mensaje "${nombre}" no habilitado en ${pid}`);
  const r = await J.rest('PUT', `/runtime/executions/${json.data[0].id}`, { action: 'messageEventReceived', messageName: nombre, variables }, quiet);
  if (r.status !== 204 && r.status !== 200) throw new Error(`Falló el mensaje ${nombre}: ${r.status} ${r.texto}`);
}
async function iniciar(plazo = PLAZO) {
  const cursoId = siguienteCurso++;
  const empresaId = turno(EMPRESAS);
  sql(`delete from curso where id=${cursoId}; insert into curso (id, empresa_id, tematica, descripcion, cantidad_participantes, fechas_preferidas)
       values (${cursoId}, ${empresaId}, 'Historial 4.4', 'x', 10, 'pronto');`);
  const r = await J.rest('POST', '/runtime/process-instances', {
    message: 'Solicitud de curso', businessKey: String(cursoId),
    variables: [J.int('cursoId', cursoId), J.int('empresaId', empresaId), J.str('plazoRespuesta', plazo)],
  }, quiet);
  if (r.status !== 201) throw new Error('No se pudo iniciar el curso ' + cursoId + ': ' + r.texto);
  sql(`update curso set process_instance_id='${r.json.id}' where id=${cursoId};`);
  return r.json.id;
}

// ---------- tramos del recorrido ----------
async function proponer(pid) {
  await completar(pid, 'Propuesta');
  await completar(pid, 'Enviar');
  await esperar('espera de respuesta', async () => (await timersPendientes(pid)) === 1, 30);
}
async function pedirModificacion(pid) {
  await mensaje(pid, 'Solicitud de modificaciones', [J.str('observaciones', 'Ajustar el presupuesto')]);
  await esperar('Revisar propuesta', () => hayTarea(pid, 'Revisar'), 30);
  await completar(pid, 'Revisar');
  await completar(pid, 'Enviar');
  await esperar('nueva espera de respuesta', async () => (await timersPendientes(pid)) === 1, 30);
}
async function rechazar(pid) {
  await mensaje(pid, 'Rechazo');
  await esperar('Archivar solicitud', () => hayTarea(pid, 'Archivar'), 30);
  await completar(pid, 'Archivar');
  await esperar('instancia terminada', () => terminada(pid), 30);
}
async function aceptar(pid, segundos) {
  const fecha = new Date(Date.now() + segundos * 1000).toISOString().slice(0, 19) + 'Z';
  await mensaje(pid, 'Aceptación', [J.str('fechaCurso', fecha)]);
  await esperar('Preparar curso', async () => (await hayTarea(pid, 'Material')), 30);
}
async function enviarNomina(pid) {
  const { json } = await J.rest('GET', `/runtime/executions?processInstanceId=${pid}&activityId=Nomina`, undefined, quiet);
  await J.rest('PUT', `/runtime/executions/${json.data[0].id}`, { action: 'signal', variables: [J.str('participantes', '["Ana","Beto","Carla"]')] }, quiet);
}
const recursos = ([aula, virtual, equipo]) => [J.bool('requiereAula', aula), J.bool('requierePlataforma', virtual), J.bool('requiereEquipamiento', equipo)];

async function cursoCompleto(pid) {
  const combo = turno(COMBOS_RECURSOS);
  await aceptar(pid, 20);
  await enviarNomina(pid);
  await esperar('Lista creada', () => hayTarea(pid, 'Lista'), 30);
  await completar(pid, 'Lista');
  await completar(pid, 'Material');
  await completar(pid, 'Activity_12i2hpf', recursos(combo));
  if (combo[1]) { await esperar('Virtual', () => hayTarea(pid, 'Virtual'), 30); await completar(pid, 'Virtual'); }
  if (combo[2]) { await esperar('Equipo', () => hayTarea(pid, 'Equipo'), 30); await completar(pid, 'Equipo'); }
  await J.rest('POST', `/runtime/tasks/${(await J.tarea(pid, 'Activity_1018bdz')).id}`,
    { action: 'complete', variables: [J.str('docenteSeleccionado', turno(DOCENTES))] }, quiet);
  await esperar('Desarrollar curso', () => hayTarea(pid, 'Dictar'), 120);
  await completar(pid, 'Dictar');
  await completar(pid, 'Informe');
  await completar(pid, 'EnviarInforme');
  if (combo[2]) { await esperar('Liberar equipamiento', () => hayTarea(pid, 'Activity_1m08pcl'), 30); await completar(pid, 'Activity_1m08pcl'); }
  await esperar('instancia terminada', () => terminada(pid), 60);
}

async function cursoCancelado(pid) {
  await aceptar(pid, 3600);
  if (turno([true, false])) {
    await completar(pid, 'Material');
    await completar(pid, 'Activity_12i2hpf', recursos([true, true, false]));
    await esperar('Virtual', () => hayTarea(pid, 'Virtual'), 30);
    if (turno([true, false])) await completar(pid, 'Virtual');
  }
  await mensaje(pid, 'Cancelación');
  await esperar('instancia terminada', () => terminada(pid), 60);
}

async function faltaDeAulas(pid) {
  await J.rest('POST', `/runtime/process-instances/${pid}/variables`, [J.bool('simularFaltaAulas', true)], quiet);
  await aceptar(pid, 3600);
  await completar(pid, 'Material');
  await completar(pid, 'Activity_12i2hpf', recursos([true, false, false]));
  await esperar('instancia terminada', () => terminada(pid), 60);
}

async function sinRespuesta(pid) {
  await esperar('Archivar tras 2 recordatorios', () => hayTarea(pid, 'Archivar'), 150);
  await completar(pid, 'Archivar');
  await esperar('instancia terminada', () => terminada(pid), 30);
}

// ---------- casos: cada uno lleva una instancia de principio a fin ----------
const CASOS = {
  rechazo: async (pid) => { await proponer(pid); await rechazar(pid); },
  rechazoTrasUnaModificacion: async (pid) => { await proponer(pid); await pedirModificacion(pid); await rechazar(pid); },
  rechazoTrasDosModificaciones: async (pid) => { await proponer(pid); await pedirModificacion(pid); await pedirModificacion(pid); await rechazar(pid); },
  finalizado: async (pid) => { await proponer(pid); await cursoCompleto(pid); },
  finalizadoTrasModificacion: async (pid) => { await proponer(pid); await pedirModificacion(pid); await cursoCompleto(pid); },
  cancelado: async (pid) => { await proponer(pid); await cursoCancelado(pid); },
  canceladoTrasModificacion: async (pid) => { await proponer(pid); await pedirModificacion(pid); await cursoCancelado(pid); },
  sinRespuesta: async (pid) => { await completar(pid, 'Propuesta'); await completar(pid, 'Enviar'); await sinRespuesta(pid); },
  sinRespuestaTrasModificacion: async (pid) => { await proponer(pid); await pedirModificacion(pid); await sinRespuesta(pid); },
  faltaAulas: async (pid) => { await proponer(pid); await faltaDeAulas(pid); },
  aceptaTrasUnRecordatorio: async (pid) => {
    await completar(pid, 'Propuesta');
    await completar(pid, 'Enviar');
    await esperar('primer recordatorio', async () => (await contarActividad(pid, 'Recordatorio')) >= 1, 60);
    await cursoCancelado(pid);
  },
};
const PLAN = [
  ['rechazo', 8], ['rechazoTrasUnaModificacion', 4], ['rechazoTrasDosModificaciones', 2],
  ['finalizado', 6], ['finalizadoTrasModificacion', 3],
  ['cancelado', 4], ['canceladoTrasModificacion', 3],
  ['sinRespuesta', 8], ['sinRespuestaTrasModificacion', 2], ['aceptaTrasUnRecordatorio', 4], ['faltaAulas', 2],
];

// Orden pseudoaleatorio pero reproducible (semilla fija).
function mezclar(lista) {
  let x = SEMILLA;
  const azar = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

async function pool(trabajos, n) {
  const cola = [...trabajos];
  await Promise.all(Array.from({ length: n }, async () => {
    while (cola.length) {
      const { nombre, fn } = cola.shift();
      let pid = null;
      try {
        pid = await iniciar();
        await fn(pid);
        J.log(`  ✔ ${nombre} (${pid})`);
      } catch (e) {
        fallos.push(`${nombre} (${pid}): ${e.message}`);
        J.log(`  ✘ ${nombre} (${pid}): ${e.message}`);
      }
    }
  }));
}

// Cuatro solicitudes no viables: hacen falta cinco instancias activas, que después se cierran por rechazo.
async function noViables() {
  const retenidas = [];
  for (let i = 0; i < 5; i++) {
    const pid = await iniciar();
    await completar(pid, 'Propuesta');
    await completar(pid, 'Enviar');
    retenidas.push(pid);
  }
  for (let i = 0; i < 4; i++) {
    const pid = await iniciar();
    await esperar('instancia no viable terminada', () => terminada(pid), 30);
    J.log(`  ✔ noViable (${pid})`);
  }
  for (const pid of retenidas) {
    await esperar('Esperar respuesta', async () => (await timersPendientes(pid)) === 1, 30);
    await rechazar(pid);
    J.log(`  ✔ rechazo (retenida ${pid})`);
  }
}

async function limpiarHistorial() {
  const { json } = await J.rest('GET', '/history/historic-process-instances?processDefinitionKey=Process_Curso&size=1000', undefined, quiet);
  for (const i of json.data) {
    await J.rest('DELETE', `/runtime/process-instances/${i.id}`, undefined, quiet);
    await J.rest('DELETE', `/history/historic-process-instances/${i.id}`, undefined, quiet);
  }
  J.log(`  Historial previo de Process_Curso borrado: ${json.data.length} instancias`);
}

async function modeloDesplegado() {
  const { json } = await J.rest('GET', '/repository/process-definitions?key=Process_Curso&latest=true', undefined, quiet);
  return json.data.length > 0;
}

async function resumen() {
  const { json } = await J.rest('GET', '/history/historic-process-instances?processDefinitionKey=Process_Curso&finished=true&size=1000&includeProcessVariables=true', undefined, quiet);
  const conteo = {};
  for (const i of json.data) {
    const r = (i.variables || []).find((v) => v.name === 'resultado');
    const clave = r ? r.value : '(sin resultado)';
    conteo[clave] = (conteo[clave] || 0) + 1;
  }
  J.log(`\nInstancias terminadas en el historial: ${json.data.length}`);
  for (const [k, v] of Object.entries(conteo)) J.log(`  ${k}: ${v}`);
}

(async () => {
  const t0 = Date.now();
  J.log('Generador de historial para el análisis 4.3 / 4.4');
  if (!(await modeloDesplegado())) await J.desplegarTodo();
  await J.limpiarActivas('inicio');
  if (!CONSERVAR) await limpiarHistorial();

  J.log('\nFase 1: solicitudes no viables');
  await noViables();

  J.log('\nFase 2: resto de los casos, hasta ' + PARALELO + ' a la vez');
  const trabajos = mezclar(PLAN.flatMap(([nombre, cantidad]) => Array.from({ length: cantidad }, () => ({ nombre, fn: CASOS[nombre] }))));
  await pool(trabajos, PARALELO);

  await resumen();
  J.log(`\nTiempo total: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (fallos.length) {
    J.log(`\n===== ${fallos.length} CASOS FALLARON =====\n${fallos.join('\n')}`);
    process.exit(1);
  }
  J.log('\n===== HISTORIAL GENERADO SIN ERRORES =====');
})().catch((e) => { console.error(e); process.exit(1); });
