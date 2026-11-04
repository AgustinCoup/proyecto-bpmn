'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FlowableError,
  csrfFrom,
  fakeClient,
  identityClient,
  login,
  request,
  setCookies,
  startApp,
} = require('./helpers');

test('login exitoso: sesión firmada y lista de tareas', async (t) => {
  const tasks = [{
    id: 't1',
    name: 'Archivar solicitud',
    taskDefinitionKey: 'Archivar',
    assignee: 'jefeAdmin',
    createTime: '2026-11-04T13:03:00.080Z',
    processInstanceId: 'pi-1',
  }];

  const client = fakeClient((method, path, options) => {
    if (method === 'GET' && path === '/identity/users/jefeAdmin') return { id: 'jefeAdmin' };
    if (method === 'GET' && path === '/identity/groups') {
      assert.equal(options.query.member, 'jefeAdmin');
      return { data: [{ id: 'administracion' }, { id: 'docentes' }] };
    }
    if (method === 'GET' && path === '/runtime/tasks') {
      return { data: options.query.assignee === 'jefeAdmin' ? tasks : [] };
    }
    if (method === 'GET' && path === '/runtime/process-instances/pi-1') return { businessKey: '1' };
    throw new Error(`Llamada no mockeada: ${method} ${path}`);
  });

  const app = await startApp({ client });
  t.after(() => app.close());

  const { page, posted } = await login(app.base);
  assert.equal(page.status, 200);
  assert.match(page.text, /Acceso al módulo de administración/);

  assert.equal(posted.status, 303);
  assert.equal(posted.location, '/admin/');
  const cookieValue = posted.cookie.split(';')[0].slice('admin_sid='.length);
  assert.match(cookieValue, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.ok(!posted.cookie.includes('jefeAdmin'));
  assert.ok(!posted.cookie.includes('test'));

  const home = await request(app.base, '/admin/', { cookie: posted.cookie });
  assert.equal(home.status, 200);
  assert.match(home.text, /Archivar solicitud/);
  assert.match(home.text, /<code>Archivar<\/code>/);
  assert.match(home.text, /<td>1<\/td>/);
  assert.match(home.text, /Asignada a vos/);
  assert.match(home.text, /jefeAdmin · administracion, docentes/);

  const flowableCalls = client.calls.filter((call) => call.path !== '/identity/users/jefeAdmin' && call.path !== '/identity/groups');
  assert.ok(flowableCalls.length > 0);
  for (const call of flowableCalls) {
    assert.deepEqual(call.options.auth, { user: 'jefeAdmin', password: 'test' });
  }
});

test('credenciales inválidas no crean sesión', async (t) => {
  const client = fakeClient((method, path) => {
    if (path.startsWith('/identity/users/')) throw new FlowableError('Unauthorized', { status: 401 });
    throw new Error(`No debería llamarse: ${method} ${path}`);
  });

  const app = await startApp({ client });
  t.after(() => app.close());

  const { page, posted } = await login(app.base, { clave: 'incorrecta' });
  assert.equal(posted.status, 401);
  assert.match(posted.text, /Usuario o clave inválidos/);

  const home = await request(app.base, '/admin/', { cookie: page.cookie });
  assert.equal(home.status, 303);
  assert.equal(home.location, '/admin/login');
});

test('usuario fuera de administracion recibe 403', async (t) => {
  const client = identityClient({ groups: ['docentes'] });
  const app = await startApp({ client });
  t.after(() => app.close());

  const { page, posted } = await login(app.base, { usuario: 'docente1' });
  assert.equal(posted.status, 403);
  assert.match(posted.text, /no pertenece al grupo administracion/);

  const home = await request(app.base, '/admin/', { cookie: page.cookie });
  assert.equal(home.status, 303);
  assert.equal(home.location, '/admin/login');
});

test('cookie manipulada o sin firma se rechaza', async (t) => {
  const client = identityClient();
  const app = await startApp({ client });
  t.after(() => app.close());

  const { posted } = await login(app.base);

  const tampered = await request(app.base, '/admin/', { cookie: `${posted.cookie}x` });
  assert.equal(tampered.status, 303);
  assert.equal(tampered.location, '/admin/login');

  const unsigned = await request(app.base, '/admin/', { cookie: 'admin_sid=sinpunto' });
  assert.equal(unsigned.status, 303);
  assert.equal(unsigned.location, '/admin/login');
});

test('CSRF obligatorio en login y logout', async (t) => {
  const client = fakeClient((method, path) => {
    throw new Error(`No debería llamarse: ${method} ${path}`);
  });
  const app = await startApp({ client });
  t.after(() => app.close());

  const page = await request(app.base, '/admin/login');
  const csrf = csrfFrom(page.text);

  const withoutToken = await request(app.base, '/admin/login', {
    method: 'POST',
    cookie: page.cookie,
    form: { usuario: 'jefeAdmin', clave: 'test' },
  });
  assert.equal(withoutToken.status, 403);
  assert.match(withoutToken.text, /token de seguridad/);

  const wrongToken = await request(app.base, '/admin/login', {
    method: 'POST',
    cookie: page.cookie,
    form: { usuario: 'jefeAdmin', clave: 'test', _csrf: `${csrf}x` },
  });
  assert.equal(wrongToken.status, 403);

  const withoutSession = await request(app.base, '/admin/login', {
    method: 'POST',
    form: { usuario: 'jefeAdmin', clave: 'test', _csrf: csrf },
  });
  assert.equal(withoutSession.status, 403);
  assert.match(withoutSession.text, /sesión no es válida/);
});

test('logout destruye la sesión y exige CSRF', async (t) => {
  const client = identityClient();
  const app = await startApp({ client });
  t.after(() => app.close());

  const { posted } = await login(app.base);
  const home = await request(app.base, '/admin/', { cookie: posted.cookie });
  const csrf = csrfFrom(home.text);

  const withoutCsrf = await request(app.base, '/admin/logout', {
    method: 'POST',
    cookie: posted.cookie,
    form: {},
  });
  assert.equal(withoutCsrf.status, 403);

  const logout = await request(app.base, '/admin/logout', {
    method: 'POST',
    cookie: posted.cookie,
    form: { _csrf: csrf },
  });
  assert.equal(logout.status, 303);
  assert.equal(logout.location, '/admin/login');
  assert.match(setCookies(logout.response).join('; '), /Max-Age=0/);

  const after = await request(app.base, '/admin/', { cookie: posted.cookie });
  assert.equal(after.status, 303);
  assert.equal(after.location, '/admin/login');
});

test('error de Flowable al listar tareas devuelve 502', async (t) => {
  const client = identityClient({ failTasks: true });
  const app = await startApp({ client });
  t.after(() => app.close());

  const { posted } = await login(app.base);
  const home = await request(app.base, '/admin/', { cookie: posted.cookie });
  assert.equal(home.status, 502);
  assert.match(home.text, /No se pudo consultar Flowable/);
});

test('401 de Flowable al listar tareas invalida la sesión', async (t) => {
  const client = fakeClient((method, path) => {
    if (method === 'GET' && path === '/identity/users/jefeAdmin') return { id: 'jefeAdmin' };
    if (method === 'GET' && path === '/identity/groups') return { data: [{ id: 'administracion' }] };
    if (method === 'GET' && path === '/runtime/tasks') throw new FlowableError('Unauthorized', { status: 401 });
    throw new Error(`Llamada no mockeada: ${method} ${path}`);
  });
  const app = await startApp({ client });
  t.after(() => app.close());

  const { posted } = await login(app.base);
  const home = await request(app.base, '/admin/', { cookie: posted.cookie });
  assert.equal(home.status, 303);
  assert.equal(home.location, '/admin/login?expirada=1');
  assert.match(setCookies(home.response).join('; '), /Max-Age=0/);
});

test('ruta desconocida y cabeceras de seguridad', async (t) => {
  const client = identityClient();
  const app = await startApp({ client });
  t.after(() => app.close());

  const page = await request(app.base, '/admin/login');
  assert.equal(page.response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(page.response.headers.get('x-frame-options'), 'DENY');

  const { posted } = await login(app.base);
  const missing = await request(app.base, '/admin/no-existe', { cookie: posted.cookie });
  assert.equal(missing.status, 404);
  assert.match(missing.text, /no existe en este módulo/);
});
