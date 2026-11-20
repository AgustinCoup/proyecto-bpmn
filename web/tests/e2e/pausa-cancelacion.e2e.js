// Recorrido real (no corre con `npm test`): cancelación de un curso y confirmación de la pausa "Confirmar
// liberación de recursos" desde el sitio, contra Flowable y la BD levantados (modelo desplegado, SMTP opcional).
// Uso: cd web && node tests/e2e/pausa-cancelacion.e2e.js
process.env.SESSION_SECRET = 'x';
const request = require('supertest');
const db = require('../../src/lib/db');
const app = require('../../src/app');
const B = 'http://localhost:8080/flowable-rest/service';
const A = 'Basic ' + Buffer.from('rest-admin:test').toString('base64');
async function r(m, p, b) {
  const x = await fetch(B + p, { method: m, headers: { Authorization: A, 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const t = await x.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { s: x.status, j };
}
const task = async (pid, key) => (await r('GET', `/runtime/tasks?processInstanceId=${pid}&taskDefinitionKey=${key}`)).j.data[0];
const esperar = async (f, ms = 20000) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout'); await new Promise((q) => setTimeout(q, 300)); } };
let fallas = 0;
const check = (n, ok, extra = '') => { console.log((ok ? '  OK  ' : '  FAIL ') + n + (extra ? ' -> ' + extra : '')); if (!ok) fallas++; };
const token = (html) => (html.match(/name="_csrf" value="([^"]+)"/) || [])[1];

(async () => {
  const agent = request.agent(app);
  const g = await agent.get('/solicitar');
  const res = await agent.post('/solicitar').type('form').send({
    _csrf: token(g.text), nombreEmpresa: 'Empresa E2E Pausa', cuit: '20-12345678-6', contacto: 'Test', email: 'e2e@test.com',
    cantidadParticipantes: 3, tematica: 'Tema', descripcion: 'Desc', fechasPreferidas: 'Diciembre',
  });
  const cursoId = Number(res.headers.location.match(/cursoId=(\d+)/)[1]);
  const pid = (await db.query('SELECT process_instance_id FROM curso WHERE id=$1', [cursoId])).rows[0].process_instance_id;
  console.log('curso', cursoId, 'instancia', pid);

  await r('POST', `/runtime/tasks/${(await esperar(() => task(pid, 'Propuesta'))).id}`, { action: 'complete' });
  await r('POST', `/runtime/tasks/${(await esperar(() => task(pid, 'Enviar'))).id}`, { action: 'complete' });
  const ex = await esperar(async () => (await r('GET', `/runtime/executions?processInstanceId=${pid}&messageEventSubscriptionName=Aceptaci%C3%B3n`)).j.data[0]);
  await r('PUT', `/runtime/executions/${ex.id}`, { action: 'messageEventReceived', messageName: 'Aceptación', variables: [{ name: 'fechaCurso', value: new Date(Date.now() + 3600e3).toISOString().replace(/\.\d+Z/, 'Z'), type: 'string' }] });
  await r('POST', `/runtime/tasks/${(await esperar(() => task(pid, 'Activity_12i2hpf'))).id}`, { action: 'complete', variables: [
    { name: 'requiereAula', value: false, type: 'boolean' }, { name: 'requierePlataforma', value: false, type: 'boolean' }, { name: 'requiereEquipamiento', value: true, type: 'boolean' }] });
  await r('POST', `/runtime/tasks/${(await esperar(() => task(pid, 'Equipo'))).id}`, { action: 'complete' });
  const cx = await esperar(async () => (await r('GET', `/runtime/executions?processInstanceId=${pid}&messageEventSubscriptionName=Cancelaci%C3%B3n`)).j.data[0]);
  await r('PUT', `/runtime/executions/${cx.id}`, { action: 'messageEventReceived', messageName: 'Cancelación' });
  const pausa = await esperar(() => task(pid, 'Pausa_C'));
  await esperar(() => task(pid, 'Activity_1m08pcl'));
  console.log('cancelada: existen Pausa_C y Liberar Equipamiento');

  const a = request.agent(app);
  const lg = await a.get('/admin/login');
  const li = await a.post('/admin/login').type('form').send({ _csrf: token(lg.text), usuario: 'jefeAdmin', clave: 'test' });
  check('login jefeAdmin', li.status === 302 || li.status === 303, String(li.status));
  let home = await a.get('/admin/');
  check('la lista de jefeAdmin muestra la pausa', home.text.includes('Confirmar liberación de recursos'));
  check('botón "Confirmar" en la lista', home.text.includes('>Confirmar</a>'));
  let det = await a.get('/admin/tasks/' + pausa.id);
  check('detalle bloqueado mientras falta Liberar Equipamiento', det.status === 200 && det.text.includes('sigue abierta') && det.text.includes('<button type="submit" disabled>'));
  let c1 = await a.post(`/admin/tasks/${pausa.id}/complete`).type('form').send({ _csrf: token(det.text) });
  check('POST antes de tiempo: redirige sin error 500', c1.status === 303, String(c1.status));
  check('la pausa sigue abierta', !!(await task(pid, 'Pausa_C')));
  home = await a.get('/admin/');
  check('flash de aviso', home.text.includes('Todavía hay recursos por liberar'));

  await r('POST', `/runtime/tasks/${(await task(pid, 'Activity_1m08pcl')).id}`, { action: 'complete' });
  det = await a.get('/admin/tasks/' + pausa.id);
  check('detalle habilitado tras liberar', det.status === 200 && !det.text.includes('<button type="submit" disabled>') && det.text.includes('Confirmar liberación'));
  const c2 = await a.post(`/admin/tasks/${pausa.id}/complete`).type('form').send({ _csrf: token(det.text) });
  check('POST confirma', c2.status === 303, String(c2.status));
  const h = await esperar(async () => { const x = (await r('GET', `/history/historic-process-instances/${pid}`)).j; return x.endTime ? x : null; });
  check('la instancia terminó', !!h.endTime);
  const estado = (await db.query('SELECT estado FROM curso WHERE id=$1', [cursoId])).rows[0].estado;
  check('curso.estado en la BD = CANCELADO', estado === 'CANCELADO', estado);
  await db.query('DELETE FROM curso WHERE id=$1', [cursoId]);
  console.log(fallas ? `FALLAS: ${fallas}` : 'TODO OK');
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
