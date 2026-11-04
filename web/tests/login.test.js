const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.SESSION_SECRET = 'test-secret';
process.env.FLOWABLE_REST_URL = 'http://localhost:9999/flowable-rest/service';

const db = require('../src/lib/db');
// mock db.query
db.query = async (text, params) => {
  if (text.includes('cuenta_empresa')) {
    if (params && params[0] === 'emp_ok') {
      return { rows: [{ empresa_id: 1, clave_hash: 'test', nombre: 'Empresa 1' }] };
    }
    return { rows: [] };
  }
  return { rows: [] };
};

const app = require('../src/app');

test('login con credenciales incorrectas es generico', async () => {
  const agent = request.agent(app);
  // GET login to get csrf token from session? supertest agent maintains cookies
  const getRes = await agent.get('/empresa/login');
  assert.equal(getRes.status, 200);
  const csrfMatch = getRes.text.match(/name="_csrf" value="([^"]+)"/);
  const csrf = csrfMatch ? csrfMatch[1] : '';
  const res = await agent.post('/empresa/login').type('form').send({ _csrf: csrf, usuario: 'noexiste', clave: 'x' });
  assert.equal(res.status, 401);
  assert.match(res.text, /Usuario o clave incorrectos/);
});

test('login correcto redirige', async () => {
  const agent = request.agent(app);
  const getRes = await agent.get('/empresa/login');
  const csrfMatch = getRes.text.match(/name="_csrf" value="([^"]+)"/);
  const csrf = csrfMatch ? csrfMatch[1] : '';
  const res = await agent.post('/empresa/login').type('form').send({ _csrf: csrf, usuario: 'emp_ok', clave: 'test' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/empresa');
});
