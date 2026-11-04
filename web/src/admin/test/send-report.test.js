'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  csrfFrom, fakeClient, login, request, startApp,
} = require('./helpers');
const {
  createReportStore, isPdf, parseReportId, reportFileName, sendReportPdf,
} = require('../reports');
const { buildReportPdf } = require('../pdf');
const { parseReportForm } = require('../report');

const PDF = Buffer.from('%PDF-1.4\n% contenido de prueba\n%%EOF\n');
const TASK = {
  id: 'te', name: 'Enviar informe', taskDefinitionKey: 'EnviarInforme', assignee: 'jefeAdmin', processInstanceId: 'pi1',
};

function flowable(variables) {
  return fakeClient((method, path) => {
    if (method === 'GET' && path.startsWith('/identity/users/')) return { id: 'jefeAdmin' };
    if (method === 'GET' && path === '/identity/groups') return { data: [{ id: 'administracion' }] };
    if (method === 'GET' && path === '/runtime/tasks') return { data: [] };
    if (method === 'GET' && path === '/runtime/tasks/te') return TASK;
    if (method === 'GET' && path === '/runtime/process-instances/pi1') return { businessKey: '1' };
    if (method === 'GET' && path === '/runtime/process-instances/pi1/variables') return variables;
    if (method === 'POST' && path === '/runtime/tasks/te') return null;
    throw new Error(`Llamada no mockeada: ${method} ${path}`);
  });
}

const fakeCourses = { async findById(id) { return { id, nombre: 'Curso X', tematica: 'T' }; } };
const fakeReports = (map = { 7: { id: 7, curso_id: 1, nombre_archivo: 'x', contenido: PDF } }) => ({
  async findById(id) { return map[id] || null; },
});

async function open(t, { variables = [{ name: 'informePdf', value: 7 }], reports = fakeReports() } = {}) {
  const client = flowable(variables);
  const app = await startApp({ client, courses: fakeCourses, reports });
  t.after(() => app.close());
  const { posted } = await login(app.base);
  const home = await request(app.base, '/admin/', { cookie: posted.cookie });
  return {
    client, app, cookie: posted.cookie, csrf: csrfFrom(home.text),
  };
}

test('GET de EnviarInforme ofrece la descarga y el botón cuando el informe existe', async (t) => {
  const { app, cookie } = await open(t);
  const res = await request(app.base, '/admin/tasks/te', { cookie });
  assert.equal(res.status, 200);
  assert.match(res.text, /href="\/admin\/informes\/7\.pdf"/);
  assert.match(res.text, /Enviar informe a la empresa y archivar/);
});

test('GET de EnviarInforme sin informePdf válido no deja completar', async (t) => {
  for (const value of [undefined, 'abc', '0', 99]) {
    const variables = value === undefined ? [] : [{ name: 'informePdf', value }];
    const { app, cookie } = await open(t, { variables });
    const res = await request(app.base, '/admin/tasks/te', { cookie });
    assert.equal(res.status, 200);
    assert.match(res.text, /No hay un informe guardado/);
    assert.doesNotMatch(res.text, /Enviar informe a la empresa y archivar/);
  }
});

test('POST de EnviarInforme completa la tarea sin variables', async (t) => {
  const {
    client, app, cookie, csrf,
  } = await open(t);
  const res = await request(app.base, '/admin/tasks/te/complete', { method: 'POST', cookie, form: { _csrf: csrf } });
  assert.equal(res.status, 303);
  const post = client.calls.find((c) => c.method === 'POST' && c.path === '/runtime/tasks/te');
  assert.deepEqual(post.options.body, { action: 'complete' });
});

test('un informe de OTRO curso no se acepta (ni se muestra ni se completa)', async (t) => {
  const reports = fakeReports({ 7: { id: 7, curso_id: 2, contenido: PDF } });
  const {
    client, app, cookie, csrf,
  } = await open(t, { reports });
  const get = await request(app.base, '/admin/tasks/te', { cookie });
  assert.match(get.text, /No hay un informe guardado/);
  const post = await request(app.base, '/admin/tasks/te/complete', { method: 'POST', cookie, form: { _csrf: csrf } });
  assert.equal(post.status, 409);
  assert.equal(client.calls.some((c) => c.method === 'POST'), false);
});

test('POST de EnviarInforme sin informe guardado responde 409 y no completa', async (t) => {
  const {
    client, app, cookie, csrf,
  } = await open(t, { variables: [] });
  const res = await request(app.base, '/admin/tasks/te/complete', { method: 'POST', cookie, form: { _csrf: csrf } });
  assert.equal(res.status, 409);
  assert.equal(client.calls.some((c) => c.method === 'POST'), false);
});

test('GET /informes/:id.pdf descarga el PDF como adjunto con cabeceras seguras', async (t) => {
  const { app, cookie } = await open(t);
  const res = await request(app.base, '/admin/informes/7.pdf', { cookie });
  assert.equal(res.status, 200);
  assert.equal(res.response.headers.get('content-type'), 'application/pdf');
  assert.equal(res.response.headers.get('content-disposition'), 'attachment; filename="informe-curso-1.pdf"');
  assert.equal(res.response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.response.headers.get('content-security-policy'), /sandbox/);
  assert.equal(res.text.startsWith('%PDF-'), true);
});

test('GET /informes valida el id, exige sesión y no sirve contenido que no sea PDF', async (t) => {
  const reports = fakeReports({
    7: { id: 7, curso_id: 1, contenido: PDF },
    8: { id: 8, curso_id: 1, contenido: Buffer.from('<script>alert(1)</script>----') },
  });
  const { app, cookie } = await open(t, { reports });
  assert.equal((await request(app.base, '/admin/informes/abc.pdf', { cookie })).status, 400);
  assert.equal((await request(app.base, '/admin/informes/0.pdf', { cookie })).status, 400);
  assert.equal((await request(app.base, '/admin/informes/..%2F7.pdf', { cookie })).status, 400);
  assert.equal((await request(app.base, '/admin/informes/99.pdf', { cookie })).status, 404);
  assert.equal((await request(app.base, '/admin/informes/8.pdf', { cookie })).status, 404);
  const anon = await request(app.base, '/admin/informes/7.pdf');
  assert.equal(anon.status, 303);
  assert.equal(anon.location, '/admin/login');
});

test('reports: ids, nombre de archivo y detección de PDF', () => {
  assert.equal(parseReportId('12'), 12);
  assert.equal(parseReportId(12), 12);
  for (const bad of ['', null, undefined, '0', '-1', '1.5', '1e3', '1234567890', 'a']) {
    assert.equal(parseReportId(bad), null, String(bad));
  }
  assert.equal(reportFileName(5), 'informe-curso-5.pdf');
  assert.equal(isPdf(PDF), true);
  assert.equal(isPdf(Buffer.from('hola')), false);
  assert.equal(isPdf('%PDF-1.4....'), false);
  assert.equal(sendReportPdf({}, null), false);
});

test('el almacén guarda con una sola sentencia parametrizada', async () => {
  const queries = [];
  const store = createReportStore({
    pool: {
      async query(sql, params) {
        queries.push({ sql, params });
        return { rows: [{ id: '9' }] };
      },
    },
  });
  const hostile = "x'; DROP TABLE informe;--";
  const id = await store.save({
    courseId: 1, fileName: 'informe-curso-1.pdf', content: PDF, createdBy: hostile,
  });
  assert.equal(id, 9);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /\$1/);
  assert.doesNotMatch(queries[0].sql, /DROP/);
  assert.equal(queries[0].params[3], hostile);

  const empty = createReportStore({ pool: { async query() { return { rows: [] }; } } });
  assert.equal(await empty.save({
    courseId: 1, fileName: 'a', content: PDF, createdBy: 'u',
  }), null);
  assert.equal(await empty.findById(1), null);
  await empty.close();
});

test('parseReportForm valida y limpia el formulario del informe', () => {
  const ok = parseReportForm({ resumen: ' Todo bien\u0000 ', asistentes: '12', observaciones: '' });
  assert.equal(ok.valid, true);
  assert.deepEqual(ok.report, { resumen: 'Todo bien', asistentes: 12, observaciones: '' });
  for (const body of [
    {}, { resumen: 'x', asistentes: '-1' }, { resumen: 'x', asistentes: '1.5' },
    { resumen: 'x', asistentes: '10001' }, { resumen: 'x'.repeat(5001), asistentes: '1' },
    { resumen: 'x', asistentes: '1', observaciones: 'y'.repeat(3001) },
  ]) {
    assert.equal(parseReportForm(body).valid, false, JSON.stringify(body).slice(0, 40));
  }
});

test('buildReportPdf genera un PDF válido, incluso con tildes y listas largas', async () => {
  const buffer = await buildReportPdf({
    course: {
      id: 1, nombre: 'Seguridad e Higiene — ñandú', fecha_inicio: '2026-12-01', fecha_fin: null,
    },
    teacher: 'docente1',
    participants: Array.from({ length: 150 }, (_, i) => `Participante ${i}`),
    report: { resumen: 'Resumen con acentos: áéíóú', asistentes: 20, observaciones: 'Ninguna' },
  });
  assert.equal(isPdf(buffer), true);
  assert.ok(buffer.length > 500);
  const small = await buildReportPdf({
    course: { id: 2 }, teacher: '', participants: [], report: { resumen: 'ok', asistentes: 0, observaciones: '' },
  });
  assert.equal(isPdf(small), true);
});
