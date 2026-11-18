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

// Cada línea se muestra por consola y se guarda en resultados/<nombre-del-script>.log (se reinicia en cada corrida).
// Funciona igual en Windows y Ubuntu: no depende de redirecciones del shell.
const NOMBRE = path.basename((require.main && require.main.filename) || 'escenarios', '.js');
const ARCHIVO_LOG = path.join(RESULTADOS, NOMBRE + '.log');
try { fs.writeFileSync(ARCHIVO_LOG, `# ${new Date().toISOString()} - ${NOMBRE}\n`); } catch { /* el log en archivo es auxiliar */ }
function log(...args) {
  console.log(...args);
  try { fs.appendFileSync(ARCHIVO_LOG, args.join(' ') + '\n'); } catch { /* el log en archivo es auxiliar */ }
}

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

async function variablesHistoricas(processInstanceId) {
  const { json } = await rest('GET', `/history/historic-variable-instances?processInstanceId=${processInstanceId}&size=100`, undefined, { quiet: true });
  const vars = Object.fromEntries(json.data.map((v) => [v.variable.name, v.variable.value]));
  log(`  Variables: ${JSON.stringify(vars)}`);
  return vars;
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
  RAIZ, RESULTADOS, ARCHIVO_LOG, BASE, rest, variablesHistoricas, tarea, completar, bool, str, log,
};
