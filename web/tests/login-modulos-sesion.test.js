const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.SESSION_SECRET = 'test-secret';
process.env.FLOWABLE_REST_URL = 'http://flowable.test/service';
process.env.DEV_MODE = 'true';

// Flowable falso: alcanza para validar el login y la lista vacía de tareas.
global.fetch = async (url, options = {}) => {
  const parsed = new URL(String(url));
  const authorization = options.headers && options.headers.Authorization;
  let authUser = null;
  if (authorization && authorization.startsWith('Basic ')) {
    authUser = Buffer.from(authorization.slice(6), 'base64').toString('utf8').split(':')[0];
  }

  let body = {};
  if (parsed.pathname.endsWith('/identity/groups')) {
    const member = parsed.searchParams.get('member') || authUser;
    const group = ['jefeDocente', 'docente1', 'docente2'].includes(member)
      ? 'docentes'
      : 'administracion';
    body = { data: [{ id: group, name: group, type: 'assignment' }], total: 1 };
  } else if (parsed.pathname.includes('/identity/users/')) {
    const id = decodeURIComponent(parsed.pathname.split('/').pop());
    body = { id, firstName: id, email: `${id}@institucion.test` };
  } else if (parsed.pathname.endsWith('/runtime/tasks')) {
    body = { data: [], total: 0, start: 0, size: 0 };
  }

  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  };
};

const app = require('../src/app');

async function postLogin(agent, base, usuario, clave) {
  const getRes = await agent.get(`${base}/login`);
  assert.equal(getRes.status, 200);
  const csrf = (getRes.text.match(/name="_csrf" value="([^"]+)"/) || [])[1];
  assert.ok(csrf, 'el formulario de login trae token CSRF');
  return agent.post(`${base}/login`).type('form').send({ _csrf: csrf, usuario, clave });
}

test('POST /docentes/login en la app completa redirige y no queda colgado', async () => {
  const agent = request.agent(app);
  const res = await postLogin(agent, '/docentes', 'jefeDocente', 'test');
  assert.equal(res.status, 303);
  assert.equal(res.headers.location, '/docentes/');

  const home = await agent.get('/docentes/');
  assert.equal(home.status, 200);
  assert.match(home.text, /Mis tareas/);
});

test('POST /admin/login en la app completa redirige y no queda colgado', async () => {
  const agent = request.agent(app);
  const res = await postLogin(agent, '/admin', 'jefeAdmin', 'test');
  assert.equal(res.status, 303);
  assert.equal(res.headers.location, '/admin/');

  const home = await agent.get('/admin/');
  assert.equal(home.status, 200);
  assert.match(home.text, /Mis tareas/);
});
