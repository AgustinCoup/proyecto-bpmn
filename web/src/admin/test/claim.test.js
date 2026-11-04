'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FlowableError,
  csrfFrom,
  fakeClient,
  login,
  request,
  startApp,
} = require('./helpers');

function claimClient({ task = null, links = [], claimError = null } = {}) {
  return fakeClient((method, path) => {
    if (method === 'GET' && path.startsWith('/identity/users/')) return { id: 'jefeAdmin' };
    if (method === 'GET' && path === '/identity/groups') return { data: [{ id: 'administracion' }] };
    if (method === 'GET' && path === '/runtime/tasks') return { data: [] };
    if (method === 'GET' && path === '/runtime/tasks/t1') {
      if (!task) throw new FlowableError('not found', { status: 404 });
      return task;
    }
    if (method === 'GET' && path === '/runtime/tasks/t1/identitylinks') return links;
    if (method === 'POST' && path === '/runtime/tasks/t1') {
      if (claimError) throw claimError;
      return null;
    }
    throw new Error(`Llamada no mockeada: ${method} ${path}`);
  });
}

async function loginAndToken(app) {
  const { posted } = await login(app.base);
  const home = await request(app.base, '/admin/', { cookie: posted.cookie });
  assert.equal(home.status, 200);
  return { cookie: posted.cookie, csrf: csrfFrom(home.text) };
}

const CANDIDATE_TASK = {
  id: 't1',
  name: 'Evaluar Recursos',
  assignee: null,
  processInstanceId: 'pi1',
};

test('reclama una tarea candidata del grupo y muestra confirmación', async (t) => {
  const client = claimClient({
    task: CANDIDATE_TASK,
    links: [{ type: 'candidate', group: 'administracion', user: null }],
  });
  const app = await startApp({ client });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const claimed = await request(app.base, '/admin/tasks/t1/claim', {
    method: 'POST',
    cookie,
    form: { _csrf: csrf },
  });

  assert.equal(claimed.status, 303);
  assert.equal(claimed.location, '/admin/');

  const post = client.calls.find((call) => call.method === 'POST' && call.path === '/runtime/tasks/t1');
  assert.deepEqual(post.options.body, { action: 'claim', assignee: 'jefeAdmin' });
  assert.deepEqual(post.options.auth, { user: 'jefeAdmin', password: 'test' });

  const after = await request(app.base, '/admin/', { cookie });
  assert.match(after.text, /Tarea reclamada/);

  const refreshed = await request(app.base, '/admin/', { cookie });
  assert.ok(!refreshed.text.includes('Tarea reclamada'));
});

test('permite reclamar si la candidatura es por usuario', async (t) => {
  const client = claimClient({
    task: CANDIDATE_TASK,
    links: [{ type: 'candidate', user: 'jefeAdmin', group: null }],
  });
  const app = await startApp({ client });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const claimed = await request(app.base, '/admin/tasks/t1/claim', {
    method: 'POST',
    cookie,
    form: { _csrf: csrf },
  });

  assert.equal(claimed.status, 303);
  assert.ok(client.calls.some((call) => call.method === 'POST' && call.path === '/runtime/tasks/t1'));
});

test('rechaza una tarea candidata de otro grupo', async (t) => {
  const client = claimClient({
    task: CANDIDATE_TASK,
    links: [{ type: 'candidate', group: 'docentes', user: null }],
  });
  const app = await startApp({ client });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const claimed = await request(app.base, '/admin/tasks/t1/claim', {
    method: 'POST',
    cookie,
    form: { _csrf: csrf },
  });

  assert.equal(claimed.status, 403);
  assert.match(claimed.text, /no es candidata para tu usuario ni para tu grupo/);
  assert.ok(!client.calls.some((call) => call.method === 'POST' && call.path === '/runtime/tasks/t1'));
});

test('rechaza una tarea ya asignada a otra persona', async (t) => {
  const client = claimClient({
    task: { ...CANDIDATE_TASK, assignee: 'admin2' },
    links: [{ type: 'candidate', group: 'administracion', user: null }],
  });
  const app = await startApp({ client });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const claimed = await request(app.base, '/admin/tasks/t1/claim', {
    method: 'POST',
    cookie,
    form: { _csrf: csrf },
  });

  assert.equal(claimed.status, 403);
  assert.match(claimed.text, /asignada a otra persona/);
  assert.ok(!client.calls.some((call) => call.method === 'POST' && call.path === '/runtime/tasks/t1'));
});

test('si ya estaba asignada al usuario no vuelve a reclamar', async (t) => {
  const client = claimClient({
    task: { ...CANDIDATE_TASK, assignee: 'jefeAdmin' },
    links: [{ type: 'candidate', group: 'administracion', user: null }],
  });
  const app = await startApp({ client });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const claimed = await request(app.base, '/admin/tasks/t1/claim', {
    method: 'POST',
    cookie,
    form: { _csrf: csrf },
  });

  assert.equal(claimed.status, 303);
  assert.ok(!client.calls.some((call) => call.method === 'POST' && call.path === '/runtime/tasks/t1'));

  const after = await request(app.base, '/admin/', { cookie });
  assert.match(after.text, /ya estaba asignada a vos/);
});

test('tarea inexistente devuelve 404', async (t) => {
  const client = claimClient({ task: null });
  const app = await startApp({ client });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const claimed = await request(app.base, '/admin/tasks/t1/claim', {
    method: 'POST',
    cookie,
    form: { _csrf: csrf },
  });

  assert.equal(claimed.status, 404);
  assert.match(claimed.text, /La tarea no existe o ya fue completada/);
});

test('identificador de tarea inválido devuelve 400', async (t) => {
  const client = claimClient();
  const app = await startApp({ client });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const claimed = await request(app.base, '/admin/tasks/abc%24/claim', {
    method: 'POST',
    cookie,
    form: { _csrf: csrf },
  });

  assert.equal(claimed.status, 400);
  assert.match(claimed.text, /identificador de la tarea no es válido/);
  assert.ok(!client.calls.some((call) => call.path.startsWith('/runtime/tasks/')));
});

test('reclamar exige CSRF', async (t) => {
  const client = claimClient({ task: CANDIDATE_TASK });
  const app = await startApp({ client });
  t.after(() => app.close());

  const { cookie } = await loginAndToken(app);
  const claimed = await request(app.base, '/admin/tasks/t1/claim', {
    method: 'POST',
    cookie,
    form: {},
  });

  assert.equal(claimed.status, 403);
  assert.match(claimed.text, /token de seguridad/);
  assert.ok(!client.calls.some((call) => call.path.startsWith('/runtime/tasks/')));
});

test('si Flowable responde 409 avisa que otra persona la reclamó', async (t) => {
  const client = claimClient({
    task: CANDIDATE_TASK,
    links: [{ type: 'candidate', group: 'administracion', user: null }],
    claimError: new FlowableError('Conflict', { status: 409 }),
  });
  const app = await startApp({ client });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const claimed = await request(app.base, '/admin/tasks/t1/claim', {
    method: 'POST',
    cookie,
    form: { _csrf: csrf },
  });

  assert.equal(claimed.status, 303);

  const after = await request(app.base, '/admin/', { cookie });
  assert.match(after.text, /Otra persona reclamó la tarea antes que vos/);
});
