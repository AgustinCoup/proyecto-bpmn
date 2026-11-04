// Helper mínimo para las pruebas de la fase 1.
// Cada llamada se imprime con su método, ruta, cuerpo enviado, código HTTP y cuerpo recibido,
// para poder mostrar las llamadas y respuestas reales.
const fs = require('fs');
const path = require('path');

// Raíz del repo: la carpeta que contiene docker-compose.yml, buscando hacia arriba.
function buscarRaiz(dir) {
  for (let d = dir; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'docker-compose.yml'))) return d;
    if (path.dirname(d) === d) throw new Error('No se encontró docker-compose.yml hacia arriba de ' + dir);
  }
}
const RAIZ = buscarRaiz(__dirname);
const RESULTADOS = path.join(__dirname, 'resultados');
fs.mkdirSync(RESULTADOS, { recursive: true });

const BASE = process.env.FLOWABLE_REST || 'http://localhost:8080/flowable-rest/service';
const AUTH = 'Basic ' + Buffer.from(process.env.FLOWABLE_AUTH || 'rest-admin:test').toString('base64');

function log(...args) { console.log(...args); }

function recortar(texto, max = 1500) {
  return texto.length > max ? texto.slice(0, max) + ` …(${texto.length - max} caracteres más)` : texto;
}

async function rest(method, ruta, body, { quiet = false } = {}) {
  const opciones = { method, headers: { Authorization: AUTH } };
  if (body !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(body);
  }
  // Tras varios segundos sin tráfico (p. ej. mientras corre un proceso Java) Tomcat cierra el socket reutilizado y
  // fetch falla con "other side closed": se reintenta una vez con conexión nueva.
  let resp;
  try { resp = await fetch(BASE + ruta, opciones); } catch (e) { resp = await fetch(BASE + ruta, opciones); }
  const texto = await resp.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* respuesta no JSON */ }
  if (!quiet) {
    log(`→ ${method} ${ruta}${body !== undefined ? '\n  ' + JSON.stringify(body) : ''}`);
    log(`← ${resp.status} ${recortar(texto)}`);
  }
  return { status: resp.status, json, texto };
}

// Despliega un archivo .bpmn20.xml con nombre "pruebas-fase1-<archivo>".
async function desplegar(archivo) {
  const contenido = fs.readFileSync(path.join(__dirname, 'modelos', archivo));
  const form = new FormData();
  form.append('file', new Blob([contenido], { type: 'text/xml' }), archivo);
  const resp = await fetch(BASE + '/repository/deployments', { method: 'POST', headers: { Authorization: AUTH }, body: form });
  const texto = await resp.text();
  log(`→ POST /repository/deployments (multipart: ${archivo})`);
  log(`← ${resp.status} ${recortar(texto, 600)}`);
  if (resp.status !== 201) throw new Error('Falló el despliegue de ' + archivo);
  const dep = JSON.parse(texto);
  const registro = leerRegistro();
  fs.writeFileSync(REGISTRO, JSON.stringify([...registro, { id: dep.id, archivo }], null, 2));
  return dep;
}

const REGISTRO = path.join(RESULTADOS, 'despliegues.json');
function leerRegistro() {
  try { return JSON.parse(fs.readFileSync(REGISTRO, 'utf8')); } catch { return []; }
}

// Borra (en cascada: instancias, tareas e historial) sólo los despliegues registrados por estas pruebas.
async function borrarDesplieguesDePrueba() {
  for (const d of leerRegistro()) {
    await rest('DELETE', `/repository/deployments/${d.id}?cascade=true`);
  }
  fs.writeFileSync(REGISTRO, '[]');
}

// Recorrido real de la instancia según el historial: qué actividades corrieron, cuándo y si terminaron.
async function recorrido(processInstanceId) {
  const { json } = await rest('GET',
    `/history/historic-activity-instances?processInstanceId=${processInstanceId}&size=200&sort=startTime&order=asc`,
    undefined, { quiet: true });
  log(`  Recorrido (historial) de ${processInstanceId}:`);
  for (const a of json.data) {
    if (a.activityType === 'sequenceFlow') continue;
    const fin = a.endTime ? a.endTime.slice(11, 23) : 'ACTIVA';
    log(`    ${a.startTime.slice(11, 23)} → ${fin}  ${a.activityType.padEnd(28)} ${a.activityId}${a.activityName ? ' (' + a.activityName + ')' : ''}${a.deleteReason ? '  [deleteReason: ' + a.deleteReason + ']' : ''}`);
  }
  return json.data;
}

async function estadoInstancia(processInstanceId) {
  const { json } = await rest('GET', `/history/historic-process-instances/${processInstanceId}`, undefined, { quiet: true });
  log(`  Instancia ${processInstanceId}: ${json.endTime ? 'FINALIZADA ' + json.endTime + ' en ' + json.endActivityId : 'ACTIVA'}${json.deleteReason ? ' (deleteReason: ' + json.deleteReason + ')' : ''}`);
  return json;
}

async function variablesHistoricas(processInstanceId) {
  const { json } = await rest('GET', `/history/historic-variable-instances?processInstanceId=${processInstanceId}&size=100`, undefined, { quiet: true });
  const vars = Object.fromEntries(json.data.map((v) => [v.variable.name, v.variable.value]));
  log(`  Variables: ${JSON.stringify(vars)}`);
  return vars;
}

async function tareasActivas(processInstanceId) {
  const { json } = await rest('GET', `/runtime/tasks?processInstanceId=${processInstanceId}&size=50`, undefined, { quiet: true });
  log(`  Tareas activas: ${json.data.map((t) => `${t.taskDefinitionKey} (${t.name}, assignee=${t.assignee})`).join(', ') || '(ninguna)'}`);
  return json.data;
}

async function tarea(processInstanceId, taskDefinitionKey) {
  const { json } = await rest('GET', `/runtime/tasks?processInstanceId=${processInstanceId}&taskDefinitionKey=${taskDefinitionKey}`, undefined, { quiet: true });
  if (json.data.length !== 1) throw new Error(`Se esperaba 1 tarea ${taskDefinitionKey}, hay ${json.data.length}`);
  return json.data[0];
}

async function completar(processInstanceId, taskDefinitionKey, variables = []) {
  const t = await tarea(processInstanceId, taskDefinitionKey);
  return rest('POST', `/runtime/tasks/${t.id}`, { action: 'complete', variables });
}

function bool(name, value) { return { name, value, type: 'boolean' }; }
function str(name, value) { return { name, value, type: 'string' }; }

module.exports = {
  RAIZ, RESULTADOS, BASE, rest, desplegar, borrarDesplieguesDePrueba, recorrido, estadoInstancia,
  variablesHistoricas, tareasActivas, tarea, completar, bool, str, log,
};
