'use strict';

/**
 * Escenario 8 de punta a punta contra el entorno real. NO SE ENTREGA.
 *
 * Usa el sitio (arnés en SITE_URL) para todo lo que es de administración y de
 * docentes. REST directo, solo para lo que no es del sitio: iniciar la solicitud,
 * los mensajes de la empresa (lo que hace el simulador) y las tareas que se hacen
 * desde la UI de Flowable (Material, Equipo, Liberar Equipamiento).
 *
 *   PORT=3100 node dev-harness.js      (en otra terminal)
 *   node dev/escenario8-e2e.js
 *
 * Al terminar borra las instancias y restaura db/datos.sql.
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const SITE = (process.env.SITE_URL || 'http://localhost:3100').replace(/\/$/, '');
const REST = 'http://localhost:8080/flowable-rest/service';
const ADMIN = 'Basic ' + Buffer.from('rest-admin:test').toString('base64');
const DATOS = path.resolve(__dirname, '../../../../db/datos.sql');

let failures = 0;
function check(label, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures += 1;
}

async function rest(method, route, body, user = 'rest-admin') {
  const auth = user === 'rest-admin' ? ADMIN : 'Basic ' + Buffer.from(`${user}:test`).toString('base64');
  const res = await fetch(REST + route, {
    method,
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* sin cuerpo */ }
  return { status: res.status, json };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(label, fn, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    const value = await fn();
    if (value) return value;
    await sleep(250);
  }
  throw new Error(`Timeout esperando: ${label}`);
}

/** Cliente HTTP con cookie jar mínimo para un módulo del sitio. */
class Site {
  constructor(prefix) { this.prefix = prefix; this.cookies = new Map(); this.csrf = null; }

  async fetch(route, { method = 'GET', form } = {}) {
    const headers = {};
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    let body;
    if (form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    }
    const res = await fetch(`${SITE}${this.prefix}${route}`, {
      method, headers, body, redirect: 'manual',
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = buffer.toString('utf8');
    const match = /name="_csrf" value="([^"]+)"/.exec(text);
    if (match) this.csrf = match[1];
    return { status: res.status, text, buffer, headers: res.headers };
  }

  async login(usuario) {
    await this.fetch('/login');
    const res = await this.fetch('/login', { method: 'POST', form: { _csrf: this.csrf, usuario, clave: 'test' } });
    if (res.status !== 303) throw new Error(`Login de ${usuario}: ${res.status}`);
    await this.fetch('/');
    return this;
  }

  async post(route, form = {}) {
    return this.fetch(route, { method: 'POST', form: { _csrf: this.csrf, ...form } });
  }
}

async function cleanup() {
  const list = await rest('GET', '/runtime/process-instances?size=200');
  for (const instance of (list.json && list.json.data) || []) {
    if (instance.processDefinitionKey === 'Process_Curso' || String(instance.processDefinitionId).startsWith('Process_Curso')) {
      await rest('DELETE', `/runtime/process-instances/${instance.id}`);
    }
  }
  const history = await rest('GET', '/history/historic-process-instances?size=200&processDefinitionKey=Process_Curso');
  for (const h of (history.json && history.json.data) || []) {
    await rest('DELETE', `/history/historic-process-instances/${h.id}`);
  }
  execFileSync('docker', ['exec', '-i', 'flowable-postgres', 'psql', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'institucion', '-d', 'institucion'], {
    input: require('node:fs').readFileSync(DATOS), stdio: ['pipe', 'ignore', 'inherit'],
  });
}

function psql(sql) {
  return execFileSync('docker', ['exec', 'flowable-postgres', 'psql', '-At', '-U', 'institucion', '-d', 'institucion', '-c', sql]).toString().trim();
}

async function openTask(pid, key) {
  return waitFor(`tarea ${key}`, async () => {
    const res = await rest('GET', `/runtime/tasks?processInstanceId=${pid}&taskDefinitionKey=${key}`);
    return res.json && res.json.data && res.json.data[0];
  });
}

(async () => {
  await cleanup();

  const start = await rest('POST', '/runtime/process-instances', {
    processDefinitionKey: 'Process_Curso',
    businessKey: '1',
    variables: [{ name: 'cursoId', value: 1, type: 'integer' }, { name: 'empresaId', value: 1, type: 'integer' }],
  });
  const pid = start.json.id;
  check('solicitud iniciada', start.status === 201, pid);
  // Lo que hace el sitio público al crear la solicitud: enlazar el curso con su instancia.
  psql(`update curso set process_instance_id='${pid}' where id=1`);

  // --- Propuesta (jefeAdmin, por el sitio) ---------------------------------
  const jefeAdmin = await new Site('/admin').login('jefeAdmin');
  const propuesta = await openTask(pid, 'Propuesta');
  const formProp = await jefeAdmin.fetch(`/tasks/${propuesta.id}`);
  check('GET Propuesta muestra el formulario', formProp.status === 200 && /Nombre del curso/.test(formProp.text));
  const savedProp = await jefeAdmin.post(`/tasks/${propuesta.id}/complete`, {
    nombre: 'Seguridad e Higiene E2E', programa: 'Módulo 1\nMódulo 2', presupuesto: '150000.50',
    fecha_inicio: '2026-12-21', fecha_fin: '2026-12-22',
  });
  check('POST Propuesta completa la tarea', savedProp.status === 303);
  check('Propuesta quedó en la tabla curso', psql('select nombre from curso where id=1') === 'Seguridad e Higiene E2E');

  // --- Empresa (simulador): aceptación con fecha y nómina -------------------
  const exec = await waitFor('Aceptación habilitada', async () => {
    const r = await rest('GET', `/runtime/executions?processInstanceId=${pid}&messageEventSubscriptionName=${encodeURIComponent('Aceptación')}`);
    return r.json && r.json.data && r.json.data[0];
  });
  const acepta = await rest('PUT', `/runtime/executions/${exec.id}`, {
    action: 'messageEventReceived', messageName: 'Aceptación',
    variables: [{ name: 'fechaCurso', type: 'string', value: '2026-12-21T09:00:00-03:00' }],
  });
  check('Aceptación con fecha', acepta.status === 204);
  const nomina = await waitFor('Nomina', async () => {
    const r = await rest('GET', `/runtime/executions?processInstanceId=${pid}&activityId=Nomina`);
    return r.json && r.json.data && r.json.data[0];
  });
  const signal = await rest('PUT', `/runtime/executions/${nomina.id}`, {
    action: 'signal', variables: [{ name: 'participantes', type: 'string', value: JSON.stringify(['Ana', 'Beto']) }],
  });
  check('Nómina enviada', signal.status === 200);

  // --- Lista (la asigna el listener a quien menos tiene) --------------------
  const lista = await openTask(pid, 'Lista');
  check('Lista asignada por el listener', ['jefeAdmin', 'admin2'].includes(lista.assignee), lista.assignee);
  const adminLista = lista.assignee === 'jefeAdmin' ? jefeAdmin : await new Site('/admin').login(lista.assignee);
  const formLista = await adminLista.fetch(`/tasks/${lista.id}`);
  check('GET Lista muestra la nómina', formLista.status === 200 && /Ana\nBeto/.test(formLista.text));
  const otroSite = await new Site('/admin').login(lista.assignee === 'jefeAdmin' ? 'admin2' : 'jefeAdmin');
  const ajena = await otroSite.fetch(`/tasks/${lista.id}`);
  check('otra persona de administración NO puede abrir la Lista (403)', ajena.status === 403);
  const savedLista = await adminLista.post(`/tasks/${lista.id}/complete`, { participantes: 'Ana\nBeto\nCarla' });
  check('POST Lista completa la tarea', savedLista.status === 303);
  const listaVar = await rest('GET', `/runtime/process-instances/${pid}/variables`);
  const listaDefinitiva = (listaVar.json || []).find((v) => v.name === 'listaDefinitiva');
  check('Lista definitiva guardada', listaDefinitiva && listaDefinitiva.value === '["Ana","Beto","Carla"]', listaDefinitiva && listaDefinitiva.value);

  // --- Evaluar Recursos (grupo: reclamar y completar) ------------------------
  const recursos = await openTask(pid, 'Activity_12i2hpf');
  const claimable = await jefeAdmin.fetch('/');
  check('Evaluar Recursos aparece para reclamar', claimable.text.includes(`/tasks/${recursos.id}/claim`));
  const sinReclamar = await jefeAdmin.fetch(`/tasks/${recursos.id}`);
  check('sin reclamar no se puede abrir (403)', sinReclamar.status === 403);
  const sinReclamarPost = await jefeAdmin.post(`/tasks/${recursos.id}/complete`, { requiereAula: 'on' });
  check('sin reclamar no se puede completar (403)', sinReclamarPost.status === 403);
  check('claim OK', (await jefeAdmin.post(`/tasks/${recursos.id}/claim`)).status === 303);
  await jefeAdmin.fetch(`/tasks/${recursos.id}`);
  const vacio = await jefeAdmin.post(`/tasks/${recursos.id}/complete`, {});
  check('Evaluar Recursos sin casillas: 400 y la tarea sigue abierta', vacio.status === 400
    && (await rest('GET', `/runtime/tasks/${recursos.id}`)).status === 200);
  const recOk = await jefeAdmin.post(`/tasks/${recursos.id}/complete`, { requiereAula: 'on', requiereEquipamiento: 'on' });
  check('Evaluar Recursos completa', recOk.status === 303);

  // --- Material y Equipo: UI de Flowable (acá, REST como administración) -----
  const material = await openTask(pid, 'Material');
  const uiPage = await jefeAdmin.fetch('/');
  const uiLink = await (async () => {
    await jefeAdmin.post(`/tasks/${material.id}/claim`);
    return jefeAdmin.fetch(`/tasks/${material.id}`);
  })();
  check('Material enlaza a la UI de Flowable', uiPage.status === 200 && /Abrir Flowable UI/.test(uiLink.text));
  await rest('POST', `/runtime/tasks/${material.id}`, { action: 'complete' }, 'jefeAdmin');
  const equipo = await openTask(pid, 'Equipo');
  await rest('POST', `/runtime/tasks/${equipo.id}`, { action: 'claim', assignee: 'jefeAdmin' }, 'jefeAdmin');
  await rest('POST', `/runtime/tasks/${equipo.id}`, { action: 'complete' }, 'jefeAdmin');

  // --- Definir Docente (jefeDocente, sitio de docentes) ----------------------
  const jefeDocente = await new Site('/docentes').login('jefeDocente');
  const definir = await openTask(pid, 'Activity_1018bdz');
  const noAdmin = await new Site('/docentes').fetch('/login');
  check('login de docentes disponible', noAdmin.status === 200);
  const adminEnDocentes = new Site('/docentes');
  await adminEnDocentes.fetch('/login');
  const intruso = await adminEnDocentes.fetch('/login', { method: 'POST', form: { _csrf: adminEnDocentes.csrf, usuario: 'jefeAdmin', clave: 'test' } });
  check('jefeAdmin no entra a /docentes (403)', intruso.status === 403);
  const selForm = await jefeDocente.fetch(`/tasks/${definir.id}`);
  check('GET Definir Docente lista a los 3 docentes', (selForm.text.match(/type="radio"/g) || []).length === 3);
  const mala = await jefeDocente.post(`/tasks/${definir.id}/complete`, { docenteSeleccionado: 'admin2' });
  check('docente fuera del grupo rechazado (400)', mala.status === 400);
  const sel = await jefeDocente.post(`/tasks/${definir.id}/complete`, { docenteSeleccionado: 'docente1' });
  check('Definir Docente completa con docente1', sel.status === 303);

  // El timer "Fecha" espera hasta fechaCurso: se adelanta para la prueba.
  const timer = await waitFor('timer Fecha', async () => {
    const r = await rest('GET', `/management/timer-jobs?processInstanceId=${pid}`);
    return r.json && r.json.data && r.json.data[0];
  });
  await rest('POST', `/management/timer-jobs/${timer.id}`, { action: 'move' });
  // Tras el `move` el motor lo ejecuta solo; un `execute` manual puede chocar (500, bloqueo optimista).
  await rest('POST', `/management/jobs/${timer.id}`, { action: 'execute' });

  // --- Dictar (solo docente1) ------------------------------------------------
  const dictar = await openTask(pid, 'Dictar');
  check('Dictar asignada a docente1', dictar.assignee === 'docente1', dictar.assignee);
  const ajenaDictar = await jefeDocente.fetch(`/tasks/${dictar.id}`);
  check('jefeDocente NO ve la tarea Dictar de docente1 (403)', ajenaDictar.status === 403);
  const docente1 = await new Site('/docentes').login('docente1');
  const dictarForm = await docente1.fetch(`/tasks/${dictar.id}`);
  check('docente1 ve la lista definitiva', dictarForm.status === 200 && /Carla/.test(dictarForm.text));
  const dictarOk = await docente1.post(`/tasks/${dictar.id}/complete`);
  check('docente1 completa Dictar', dictarOk.status === 303);

  // --- Informe (jefeDocente) + PDF -------------------------------------------
  const informe = await openTask(pid, 'Informe');
  check('Informe asignado a jefeDocente', informe.assignee === 'jefeDocente');
  const infMal = await jefeDocente.post(`/tasks/${informe.id}/complete`, { resumen: '', asistentes: '-3' });
  check('Informe inválido: 400', infMal.status === 400);
  const infOk = await jefeDocente.post(`/tasks/${informe.id}/complete`, {
    resumen: 'Curso dictado sin inconvenientes. Evaluación satisfactoria.', asistentes: '3', observaciones: 'Ninguna',
  });
  check('Informe completa y genera el PDF', infOk.status === 303);
  const row = psql('select i.id, length(i.contenido), c.informe_pdf from informe i join curso c on c.id=i.curso_id');
  const [reportId, size, linked] = row.split('|');
  check('informe guardado en la BD y enlazado en curso.informe_pdf', reportId && linked === reportId && Number(size) > 500, row);
  const pdfDocentes = await jefeDocente.fetch(`/informes/${reportId}.pdf`);
  check('descarga desde docentes', pdfDocentes.status === 200 && pdfDocentes.buffer.subarray(0, 5).toString() === '%PDF-');

  // --- EnviarInforme (jefeAdmin) ---------------------------------------------
  const enviar = await openTask(pid, 'EnviarInforme');
  const enviarForm = await jefeAdmin.fetch(`/tasks/${enviar.id}`);
  check('EnviarInforme ofrece el PDF', enviarForm.status === 200 && enviarForm.text.includes(`/informes/${reportId}.pdf`));
  const pdfAdmin = await jefeAdmin.fetch(`/informes/${reportId}.pdf`);
  check('descarga desde administración', pdfAdmin.status === 200
    && pdfAdmin.headers.get('content-type') === 'application/pdf'
    && /attachment/.test(pdfAdmin.headers.get('content-disposition')));
  const enviado = await jefeAdmin.post(`/tasks/${enviar.id}/complete`);
  check('EnviarInforme completa', enviado.status === 303);

  // --- Compensación y cierre ---------------------------------------------------
  const liberar = await waitFor('Liberar Equipamiento o fin', async () => {
    const t = await rest('GET', `/runtime/tasks?processInstanceId=${pid}&taskDefinitionKey=Activity_1m08pcl`);
    if (t.json && t.json.data && t.json.data[0]) return { task: t.json.data[0] };
    const i = await rest('GET', `/runtime/process-instances/${pid}`);
    return i.status === 404 ? { ended: true } : null;
  }, 60);
  if (liberar.task) {
    await rest('POST', `/runtime/tasks/${liberar.task.id}`, { action: 'claim', assignee: 'jefeAdmin' }, 'jefeAdmin');
    await rest('POST', `/runtime/tasks/${liberar.task.id}`, { action: 'complete' }, 'jefeAdmin');
  }
  await waitFor('fin del proceso', async () => (await rest('GET', `/runtime/process-instances/${pid}`)).status === 404, 60);
  check('proceso terminado', true);
  await waitFor('estado FINALIZADO', async () => psql('select estado from curso where id=1') === 'FINALIZADO', 20)
    .then(() => check('curso.estado = FINALIZADO', true))
    .catch(() => check('curso.estado = FINALIZADO', false, psql('select estado from curso where id=1')));

  await cleanup();
  console.log(failures ? `\n${failures} chequeo(s) FALLARON` : '\nTODO OK');
  process.exit(failures ? 1 : 0);
})().catch(async (error) => {
  console.error('ERROR:', error);
  try { await cleanup(); } catch { /* limpieza de mejor esfuerzo */ }
  process.exit(2);
});
