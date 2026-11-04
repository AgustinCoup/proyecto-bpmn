// Fase 4: helpers comunes de los scripts j-*.js (escenarios 2, 3, 4, 5 y aceptación).
// Reusa lib.js y agrega: despliegue de DMN + modelo, limpieza de instancias activas (trampa del límite de 5),
// envío de mensajes de la empresa, espera de condiciones y volcado de logs de los contenedores.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const L = require('./lib');

const MODELO = path.join(L.RAIZ, 'modelo', 'Proyecto_Organizacion_cursos.bpmn20.xml');
const DMN = path.join(L.RAIZ, 'modelo', 'viabilidadCurso.dmn');
const REGISTRO = path.join(L.RESULTADOS, 'despliegues.json');
const REGISTRO_DMN = path.join(L.RESULTADOS, 'despliegues-dmn.json');
const DMN_BASE = L.BASE.replace(/\/service$/, '/dmn-api');
const AUTH = 'Basic ' + Buffer.from('rest-admin:test').toString('base64');

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const int = (name, value) => ({ name, value, type: 'integer' });
const str = (name, value) => ({ name, value, type: 'string' });

function registrar(archivoRegistro, id, archivo) {
  let reg = [];
  try { reg = JSON.parse(fs.readFileSync(archivoRegistro, 'utf8')); } catch { /* vacío */ }
  fs.writeFileSync(archivoRegistro, JSON.stringify([...reg, { id, archivo }], null, 2));
}

async function desplegarArchivo(url, archivoLocal, nombre, archivoRegistro) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(archivoLocal)], { type: 'text/xml' }), nombre);
  const resp = await fetch(url, { method: 'POST', headers: { Authorization: AUTH }, body: form });
  const texto = await resp.text();
  L.log(`→ POST ${url.replace(/^.*localhost:8080/, '')} (multipart: ${nombre})`);
  L.log(`← ${resp.status} ${texto.slice(0, 400)}`);
  if (resp.status !== 201) throw new Error('Falló el despliegue de ' + nombre);
  registrar(archivoRegistro, JSON.parse(texto).id, nombre);
}

// DMN primero (Contrato §11.19) y después el modelo.
async function desplegarTodo() {
  await desplegarArchivo(DMN_BASE + '/dmn-repository/deployments', DMN, 'viabilidadCurso.dmn', REGISTRO_DMN);
  await desplegarArchivo(L.BASE + '/repository/deployments', MODELO, 'Proyecto_Organizacion_cursos.bpmn20.xml', REGISTRO);
}

// Instancias de Process_Curso sin finalizar (las que cuenta la regla DMN).
async function activas() {
  const { json } = await L.rest('GET', '/runtime/process-instances?processDefinitionKey=Process_Curso&size=100', undefined, { quiet: true });
  return json.data;
}

// Trampa del límite de 5: antes de cada escenario no debe haber instancias activas de Process_Curso.
async function limpiarActivas(titulo) {
  const act = await activas();
  for (const i of act) await L.rest('DELETE', `/runtime/process-instances/${i.id}`, undefined, { quiet: true });
  const despues = await activas();
  L.log(`  [${titulo}] instancias activas de Process_Curso: antes ${act.length}, borradas ${act.length}, ahora ${despues.length}`);
  if (despues.length !== 0) throw new Error('No se pudo dejar el motor sin instancias activas');
}

async function iniciar(cursoId, variablesExtra = []) {
  const r = await L.rest('POST', '/runtime/process-instances', {
    message: 'Solicitud de curso', businessKey: String(cursoId),
    variables: [int('cursoId', cursoId), int('empresaId', 7), ...variablesExtra],
  });
  if (r.status !== 201) throw new Error('No se pudo iniciar el curso ' + cursoId);
  const pid = r.json.id;
  const v = await variables(pid, `curso ${cursoId}`);
  L.log(`  >>> cursosEnEjecucion=${v.cursosEnEjecucion} viable=${v.viable}`);
  return pid;
}

async function variables(pid, titulo) {
  const { json, status } = await L.rest('GET', `/runtime/process-instances/${pid}/variables`, undefined, { quiet: true });
  if (status === 404) return L.variablesHistoricas(pid); // la instancia ya terminó
  const v = Object.fromEntries((json || []).map((x) => [x.name, x.value]));
  L.log(`  [${titulo}] variables: ${JSON.stringify(v)}`);
  return v;
}

async function enviarMensaje(pid, nombre, vars = []) {
  const { json } = await L.rest('GET', `/runtime/executions?processInstanceId=${pid}&messageEventSubscriptionName=${encodeURIComponent(nombre)}`);
  if (json.data.length !== 1) throw new Error(`Mensaje "${nombre}" no habilitado (${json.data.length} ejecuciones)`);
  return L.rest('PUT', `/runtime/executions/${json.data[0].id}`, { action: 'messageEventReceived', messageName: nombre, variables: vars });
}

async function suscripciones(pid) {
  const { json } = await L.rest('GET', `/runtime/event-subscriptions?processInstanceId=${pid}`, undefined, { quiet: true });
  L.log(`  Suscripciones: ${json.data.map((s) => `${s.eventType}:${s.activityId}(${s.eventName ?? ''})`).join(', ') || '(ninguna)'}`);
  return json.data;
}

async function timers(pid) {
  const { json } = await L.rest('GET', `/management/timer-jobs?processInstanceId=${pid}`, undefined, { quiet: true });
  L.log(`  Timers pendientes: ${json.data.map((j) => `${j.elementId} dueDate=${j.dueDate}`).join(', ') || '(ninguno)'}`);
  return json.data;
}

async function esperarHasta(desc, condicion, maxSeg) {
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < maxSeg) {
    if (await condicion()) { L.log(`  ✓ ${desc} (a los ${((Date.now() - t0) / 1000).toFixed(1)} s, sin intervención)`); return; }
    await espera(2000);
  }
  throw new Error(`No ocurrió en ${maxSeg} s: ${desc}`);
}

async function valor(pid, nombre) {
  const v = await variables(pid, 'consulta');
  return v[nombre];
}

// Verificación explícita: imprime ✔/✘ y acumula fallos para el código de salida.
const fallos = [];
function verificar(desc, real, esperado) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  L.log(`  ${ok ? '✔' : '✘'} ${desc}: esperado ${JSON.stringify(esperado)}, real ${JSON.stringify(real)}`);
  if (!ok) fallos.push(desc);
}

// Actividades distintas de flujos que corrieron en la instancia, en orden.
async function actividades(pid) {
  const { json } = await L.rest('GET', `/history/historic-activity-instances?processInstanceId=${pid}&size=300&sort=startTime&order=asc`, undefined, { quiet: true });
  return json.data.filter((a) => a.activityType !== 'sequenceFlow');
}

async function tareaHistorica(pid, clave) {
  const { json } = await L.rest('GET', `/history/historic-task-instances?processInstanceId=${pid}&taskDefinitionKey=${clave}&size=50`, undefined, { quiet: true });
  return json.data;
}

// Cierra con el usuario de la institución que corresponde (jefeAdmin) la tarea Archivar.
async function archivar(pid) {
  await esperarHasta('Archivar creada', () => hayTarea(pid, 'Archivar'), 60);
  const t = await L.tarea(pid, 'Archivar');
  return L.rest('POST', `/runtime/tasks/${t.id}`, { action: 'complete' });
}

async function hayTarea(pid, clave) {
  const { json } = await L.rest('GET', `/runtime/tasks?processInstanceId=${pid}&taskDefinitionKey=${clave}`, undefined, { quiet: true });
  return json.data.length === 1;
}

async function terminada(pid) {
  const { json } = await L.rest('GET', `/history/historic-process-instances/${pid}`, undefined, { quiet: true });
  return !!json.endTime;
}

// Vuelca las líneas "[Process_Curso <pid>]" de los logs de los DOS contenedores (Contrato §11.16).
function logsContenedor(pids, archivo) {
  const salida = [];
  for (const c of ['proyecto-bpmn-flowable-rest-1', 'proyecto-bpmn-flowable-ui-1']) {
    let texto = '';
    try { texto = execSync(`docker logs ${c} 2>&1`, { maxBuffer: 1 << 28 }).toString('utf8'); } catch (e) { texto = String(e); }
    for (const linea of texto.split('\n')) {
      if (pids.some((p) => linea.includes(p))) salida.push(`[${c.replace('proyecto-bpmn-', '')}] ${linea.trim()}`);
    }
  }
  fs.writeFileSync(archivo, salida.join('\n') + '\n');
  L.log(`  Logs de contenedor guardados en ${path.basename(archivo)} (${salida.length} líneas)`);
  return salida;
}

function terminar() {
  L.log(fallos.length ? `\n===== FALLARON ${fallos.length} VERIFICACIONES: ${fallos.join(' | ')} =====` : '\n===== TODAS LAS VERIFICACIONES OK =====');
  process.exit(fallos.length ? 1 : 0);
}

module.exports = {
  ...L, MODELO, DMN, espera, int, str, desplegarTodo, activas, limpiarActivas, iniciar, variables, enviarMensaje,
  suscripciones, timers, esperarHasta, valor, verificar, actividades, tareaHistorica, archivar, hayTarea,
  terminada, logsContenedor, terminar,
};
