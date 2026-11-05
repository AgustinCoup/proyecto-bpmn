const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.SESSION_SECRET = 'test-secret';
process.env.FLOWABLE_REST_URL = 'http://localhost:9999/flowable-rest/service';
process.env.DEV_MODE = 'true';

const db = require('../src/lib/db');
// mock transaction
db.withTransaction = async (fn) => {
  const client = {
    query: async (sql, params) => {
      if (sql.includes('SELECT id FROM empresa')) return { rows: [] };
      if (sql.startsWith('INSERT INTO empresa')) return { rows: [{ id: 7 }] };
      if (sql.startsWith('INSERT INTO curso')) return { rows: [{ id: 42 }] };
      if (sql.startsWith('UPDATE curso')) return { rows: [] };
      return { rows: [] };
    },
  };
  return fn(client);
};

// mock flowable via global fetch
global.fetch = async () => ({ ok: true, status: 201, text: async () => JSON.stringify({ id: 'proc-1' }), headers: new Map() });

const app = require('../src/app');

test('GET /solicitar muestra formulario', async () => {
  const res = await request(app).get('/solicitar');
  assert.equal(res.status, 200);
  assert.match(res.text, /Solicitud de curso/);
});

test('POST /solicitar valido redirige a confirmacion', async () => {
  const agent = request.agent(app);
  const getRes = await agent.get('/solicitar');
  const csrf = (getRes.text.match(/name="_csrf" value="([^"]+)"/) || [])[1];
  const res = await agent.post('/solicitar').type('form').send({
    _csrf: csrf,
    nombreEmpresa: 'Empresa SA',
    cuit: '20-12345678-6',
    contacto: 'Juan',
    email: 'j@e.com',
    cantidadParticipantes: 10,
    tematica: 'Tema',
    descripcion: 'Desc',
    fechasPreferidas: 'Diciembre',
  });
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /confirmacion/);
});

test('POST /solicitar acepta CUIT cuyo DV es 9', async () => {
  const agent = request.agent(app);
  const getRes = await agent.get('/solicitar');
  const csrf = (getRes.text.match(/name="_csrf" value="([^"]+)"/) || [])[1];
  const res = await agent.post('/solicitar').type('form').send({
    _csrf: csrf,
    nombreEmpresa: 'Empresa DV 9',
    cuit: '20-10000005-9',
    contacto: 'Juan',
    email: 'j@e.com',
    cantidadParticipantes: 10,
    tematica: 'Tema',
    descripcion: 'Desc',
    fechasPreferidas: 'Diciembre',
  });
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /confirmacion/);
});

test('POST /solicitar invalido devuelve 400', async () => {
  const agent = request.agent(app);
  const getRes = await agent.get('/solicitar');
  const csrf = (getRes.text.match(/name="_csrf" value="([^"]+)"/) || [])[1];
  const res = await agent.post('/solicitar').type('form').send({ _csrf: csrf });
  assert.equal(res.status, 400);
});
