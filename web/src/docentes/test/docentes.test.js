'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

require('../../admin/test/setup');
const express = require('express');
const {
  FlowableError, createTestStore, csrfFrom, fakeClient, request,
} = require('../../admin/test/helpers');
const { createDocentesRouter } = require('..');
const {
  fetchTeachers, hasCourseDate, parseTeacherSelection,
} = require('../teachers');
const { isPdf } = require('../../admin/reports');

const TEACHERS = [
  { id: 'jefeDocente', firstName: 'Jefe', lastName: 'Docente' },
  { id: 'docente1', firstName: 'Docente', lastName: 'Uno' },
  { id: 'docente2' },
];

const TASKS = {
  sel: { id: 'sel', name: 'Definir Docente', taskDefinitionKey: 'Activity_1018bdz', assignee: 'jefeDocente', processInstanceId: 'pi1' },
  dic: { id: 'dic', name: 'Desarrollar curso', taskDefinitionKey: 'Dictar', assignee: 'docente1', processInstanceId: 'pi1' },
  inf: { id: 'inf', name: 'Elaborar informe de resultados', taskDefinitionKey: 'Informe', assignee: 'jefeDocente', processInstanceId: 'pi1' },
  otra: { id: 'otra', name: 'Otra', taskDefinitionKey: 'Material', assignee: 'jefeDocente', processInstanceId: 'pi1' },
};

const VARIABLES = [
  { name: 'fechaCurso', value: '2026-12-20T09:00:00-03:00' },
  { name: 'participantes', value: '["Ana","Beto"]' },
  { name: 'listaDefinitiva', value: '["Ana","Beto","Carla"]' },
  { name: 'docenteSeleccionado', value: 'docente1' },
];

function flowable({ user = 'jefeDocente', groups = ['docentes'], variables = VARIABLES } = {}) {
  return fakeClient((method, path, options) => {
    if (method === 'GET' && path.startsWith('/identity/users/')) return { id: user };
    if (method === 'GET' && path === '/identity/groups') return { data: groups.map((id) => ({ id })) };
    if (method === 'GET' && path === '/identity/users') return { data: TEACHERS };
    if (method === 'GET' && path === '/runtime/tasks') return { data: [] };
    const task = path.match(/^\/runtime\/tasks\/([^/]+)$/);
    if (task && method === 'GET') {
      if (!TASKS[task[1]]) throw new FlowableError('no existe', { status: 404 });
      return TASKS[task[1]];
    }
    if (task && method === 'POST') return null;
    if (method === 'GET' && path === '/runtime/process-instances/pi1') return { businessKey: '1' };
    if (method === 'GET' && path === '/runtime/process-instances/pi1/variables') return variables;
    throw new Error(`Llamada no mockeada: ${method} ${path} ${JSON.stringify(options.query || {})}`);
  });
}

function fakeReports(saved = []) {
  return {
    saved,
    async save(input) {
      saved.push(input);
      return 42;
    },
    async findById(id) {
      return id === 42 ? { id: 42, curso_id: 1, contenido: saved.length ? saved[0].content : Buffer.from('%PDF-1.4\nx\n%%EOF') } : null;
    },
  };
}

const courses = {
  async findById(id) {
    return id === 1 ? { id: 1, nombre: 'Curso X', tematica: 'Seguridad', informe_pdf: null } : null;
  },
};

async function start(t, { client = flowable(), reports = fakeReports(), user = 'jefeDocente' } = {}) {
  const router = createDocentesRouter({
    client,
    sessions: createTestStore({ cookieName: 'docente_sid' }),
    courses,
    reports,
    config: { cookieSecure: false, sessionSecret: 'test-only-session-secret-0123456789' },
  });
  const app = express();
  app.use('/docentes', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const page = await request(base, '/docentes/login');
  const posted = await request(base, '/docentes/login', {
    method: 'POST',
    cookie: page.cookie,
    form: { usuario: user, clave: 'test', _csrf: csrfFrom(page.text) },
  });
  const home = posted.status === 303
    ? await request(base, '/docentes/', { cookie: posted.cookie })
    : null;
  return {
    base, client, reports, posted, cookie: posted.cookie, csrf: home ? csrfFrom(home.text) : null,
  };
}

const completeCall = (client, id) => client.calls.find((c) => c.method === 'POST' && c.path === `/runtime/tasks/${id}`);

test('un docente entra y ve la pantalla de docentes', async (t) => {
  const s = await start(t);
  assert.equal(s.posted.status, 303);
  const home = await request(s.base, '/docentes/', { cookie: s.cookie });
  assert.equal(home.status, 200);
  assert.match(home.text, /Docentes de cursos/);
  assert.match(home.text, /Mis tareas/);
});

test('un usuario que no es docente recibe 403 al ingresar', async (t) => {
  const s = await start(t, { client: flowable({ user: 'jefeAdmin', groups: ['administracion'] }), user: 'jefeAdmin' });
  assert.equal(s.posted.status, 403);
  assert.match(s.posted.text, /grupo docentes/);
});

test('sin sesión se redirige al login y la cookie propia es docente_sid', async (t) => {
  const s = await start(t);
  const anon = await request(s.base, '/docentes/');
  assert.equal(anon.status, 303);
  assert.equal(anon.location, '/docentes/login');
  assert.match(s.cookie, /^docente_sid=/);
});

test('Definir Docente: GET lista a los docentes y POST completa con docenteSeleccionado', async (t) => {
  const s = await start(t);
  const form = await request(s.base, '/docentes/tasks/sel', { cookie: s.cookie });
  assert.equal(form.status, 200);
  assert.equal((form.text.match(/type="radio"/g) || []).length, 3);
  assert.match(form.text, /Docente Uno/);

  const res = await request(s.base, '/docentes/tasks/sel/complete', {
    method: 'POST', cookie: s.cookie, form: { _csrf: s.csrf, docenteSeleccionado: 'docente2' },
  });
  assert.equal(res.status, 303);
  assert.deepEqual(completeCall(s.client, 'sel').options.body, {
    action: 'complete',
    variables: [{ name: 'docenteSeleccionado', type: 'string', value: 'docente2' }],
  });
});

test('Definir Docente rechaza un docente que no es del grupo y no completa', async (t) => {
  const s = await start(t);
  for (const bad of ['admin2', '', 'docente1; DROP', '../x']) {
    const res = await request(s.base, '/docentes/tasks/sel/complete', {
      method: 'POST', cookie: s.cookie, form: { _csrf: s.csrf, docenteSeleccionado: bad },
    });
    assert.equal(res.status, 400, bad);
  }
  assert.equal(completeCall(s.client, 'sel'), undefined);
});

test('Definir Docente sin fechaCurso avisa y no completa (evita el 500 de Flowable)', async (t) => {
  const s = await start(t, { client: flowable({ variables: [] }) });
  const get = await request(s.base, '/docentes/tasks/sel', { cookie: s.cookie });
  assert.match(get.text, /sin indicar la fecha/);
  assert.doesNotMatch(get.text, /type="radio"/);
  const res = await request(s.base, '/docentes/tasks/sel/complete', {
    method: 'POST', cookie: s.cookie, form: { _csrf: s.csrf, docenteSeleccionado: 'docente1' },
  });
  assert.equal(res.status, 409);
  assert.equal(completeCall(s.client, 'sel'), undefined);
});

test('Dictar: solo el docente asignado la ve y la completa', async (t) => {
  const other = await start(t); // jefeDocente, pero la tarea es de docente1
  const denied = await request(other.base, '/docentes/tasks/dic', { cookie: other.cookie });
  assert.equal(denied.status, 403);
  const deniedPost = await request(other.base, '/docentes/tasks/dic/complete', {
    method: 'POST', cookie: other.cookie, form: { _csrf: other.csrf },
  });
  assert.equal(deniedPost.status, 403);
  assert.equal(completeCall(other.client, 'dic'), undefined);

  const mine = await start(t, { client: flowable({ user: 'docente1' }), user: 'docente1' });
  const form = await request(mine.base, '/docentes/tasks/dic', { cookie: mine.cookie });
  assert.equal(form.status, 200);
  assert.match(form.text, /Lista definitiva \(3\)/);
  assert.match(form.text, /Carla/);
  const done = await request(mine.base, '/docentes/tasks/dic/complete', {
    method: 'POST', cookie: mine.cookie, form: { _csrf: mine.csrf },
  });
  assert.equal(done.status, 303);
  assert.deepEqual(completeCall(mine.client, 'dic').options.body, { action: 'complete' });
});

test('Informe: valida, genera el PDF, lo guarda y manda informePdf entero', async (t) => {
  const s = await start(t);
  const form = await request(s.base, '/docentes/tasks/inf', { cookie: s.cookie });
  assert.equal(form.status, 200);
  assert.match(form.text, /Docente a cargo: docente1/);

  const bad = await request(s.base, '/docentes/tasks/inf/complete', {
    method: 'POST', cookie: s.cookie, form: { _csrf: s.csrf, resumen: '', asistentes: 'x' },
  });
  assert.equal(bad.status, 400);
  assert.equal(s.reports.saved.length, 0);
  assert.equal(completeCall(s.client, 'inf'), undefined);

  const ok = await request(s.base, '/docentes/tasks/inf/complete', {
    method: 'POST',
    cookie: s.cookie,
    form: { _csrf: s.csrf, resumen: 'Salió muy bien <b>x</b>', asistentes: '3', observaciones: '' },
  });
  assert.equal(ok.status, 303);
  assert.equal(s.reports.saved.length, 1);
  assert.equal(isPdf(s.reports.saved[0].content), true);
  assert.equal(s.reports.saved[0].fileName, 'informe-curso-1.pdf');
  assert.equal(s.reports.saved[0].createdBy, 'jefeDocente');
  assert.deepEqual(completeCall(s.client, 'inf').options.body, {
    action: 'complete',
    variables: [{ name: 'informePdf', type: 'integer', value: 42 }],
  });
});

test('Informe: si el PDF no se puede guardar no se completa la tarea', async (t) => {
  const reports = { async save() { return null; }, async findById() { return null; } };
  const s = await start(t, { reports });
  const res = await request(s.base, '/docentes/tasks/inf/complete', {
    method: 'POST', cookie: s.cookie, form: { _csrf: s.csrf, resumen: 'ok', asistentes: '1' },
  });
  assert.equal(res.status, 404);
  assert.equal(completeCall(s.client, 'inf'), undefined);
});

test('POST sin CSRF, con tarea inexistente o sin formulario no completa nada', async (t) => {
  const s = await start(t);
  const noCsrf = await request(s.base, '/docentes/tasks/sel/complete', {
    method: 'POST', cookie: s.cookie, form: { docenteSeleccionado: 'docente1' },
  });
  assert.equal(noCsrf.status, 403);
  const missing = await request(s.base, '/docentes/tasks/nada/complete', {
    method: 'POST', cookie: s.cookie, form: { _csrf: s.csrf },
  });
  assert.equal(missing.status, 404);
  const unsupported = await request(s.base, '/docentes/tasks/otra/complete', {
    method: 'POST', cookie: s.cookie, form: { _csrf: s.csrf },
  });
  assert.equal(unsupported.status, 400);
  const badId = await request(s.base, '/docentes/tasks/a.b/complete', {
    method: 'POST', cookie: s.cookie, form: { _csrf: s.csrf },
  });
  assert.equal(badId.status, 400);
  assert.equal(s.client.calls.some((c) => c.method === 'POST' && c.path.startsWith('/runtime/tasks/')), false);
});

test('descarga de informes: solo docentes con sesión, id válido, como adjunto', async (t) => {
  const s = await start(t);
  await request(s.base, '/docentes/tasks/inf/complete', {
    method: 'POST', cookie: s.cookie, form: { _csrf: s.csrf, resumen: 'ok', asistentes: '1' },
  });
  const ok = await request(s.base, '/docentes/informes/42.pdf', { cookie: s.cookie });
  assert.equal(ok.status, 200);
  assert.equal(ok.response.headers.get('content-type'), 'application/pdf');
  assert.match(ok.response.headers.get('content-disposition'), /^attachment; filename="informe-curso-1\.pdf"$/);
  assert.equal((await request(s.base, '/docentes/informes/x.pdf', { cookie: s.cookie })).status, 400);
  assert.equal((await request(s.base, '/docentes/informes/43.pdf', { cookie: s.cookie })).status, 404);
  assert.equal((await request(s.base, '/docentes/informes/42.pdf')).status, 303);
});

test('una tarea de otra persona no se puede reclamar ni abrir por URL', async (t) => {
  const s = await start(t);
  const open = await request(s.base, '/docentes/tasks/dic', { cookie: s.cookie });
  assert.equal(open.status, 403);
});

test('teachers: lista desde Flowable, validación y fecha', async () => {
  const client = fakeClient(() => ({
    data: [...TEACHERS, { id: 'bad id!' }, null, { id: 5 }],
  }));
  const list = await fetchTeachers(client, { user: 'x', password: 'y' });
  assert.deepEqual(list.map((u) => u.id), ['docente1', 'docente2', 'jefeDocente']);
  assert.equal(list.find((u) => u.id === 'docente2').label, 'docente2');
  assert.equal(parseTeacherSelection({ docenteSeleccionado: 'docente1' }, list).valid, true);
  assert.equal(parseTeacherSelection({}, list).valid, false);
  assert.equal(parseTeacherSelection({ docenteSeleccionado: ['docente1'] }, list).valid, false);
  assert.equal(hasCourseDate(new Map([['fechaCurso', '2026-01-01']])), true);
  assert.equal(hasCourseDate(new Map([['fechaCurso', ' ']])), false);
  assert.equal(hasCourseDate(null), false);
  const empty = await fetchTeachers(fakeClient(() => null), {});
  assert.deepEqual(empty, []);
});
