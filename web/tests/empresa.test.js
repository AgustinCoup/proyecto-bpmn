const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.SESSION_SECRET = 'test-secret';
process.env.FLOWABLE_REST_URL = 'http://localhost:9999/flowable-rest/service';

const db = require('../src/lib/db');
db.query = async (sql, params) => {
  if (sql.includes('cuenta_empresa')) {
    if (params && params[0] === 'emp_ok') {
      return { rows: [{ empresa_id: 1, clave_hash: 'test', nombre: 'Empresa 1' }] };
    }
    return { rows: [] };
  }
  if (sql.includes('FROM curso WHERE empresa_id')) {
    return { rows: [{ id: 1, empresa_id: 1, tematica: 'T', descripcion: 'D', cantidad_participantes: 5, fechas_preferidas: 'Dic', estado: 'EN_PROCESO', process_instance_id: 'proc-1' }] };
  }
  if (sql.includes('FROM curso WHERE id')) {
    if (params && params[0] !== 1) return { rows: [] };
    return { rows: [{ id: 1, empresa_id: 1, tematica: 'T', descripcion: 'D', cantidad_participantes: 5, fechas_preferidas: 'Dic', estado: 'EN_PROCESO', process_instance_id: 'proc-1' }] };
  }
  return { rows: [] };
};

global.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/runtime/process-instances/proc-1/variables')) {
    return { ok: true, status: 200, text: async () => JSON.stringify([{ name: 'estadoCurso', value: 'EN_PREPARACION' }]), headers: new Map() };
  }
  if (u.includes('/runtime/tasks')) {
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ taskDefinitionKey: 'Lista' }] }), headers: new Map() };
  }
  if (u.includes('/runtime/executions')) {
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ activityId: 'Material' }] }), headers: new Map() };
  }
  return { ok: true, status: 200, text: async () => '[]', headers: new Map() };
};

const app = require('../src/app');

test('empresa dashboard lista cursos propios', async () => {
  const agent = request.agent(app);
  const getRes = await agent.get('/empresa/login');
  const csrf = (getRes.text.match(/name="_csrf" value="([^"]+)"/) || [])[1];
  const loginRes = await agent.post('/empresa/login').type('form').send({ _csrf: csrf, usuario: 'emp_ok', clave: 'test' });
  assert.equal(loginRes.status, 302);
  const res = await agent.get('/empresa');
  assert.equal(res.status, 200);
  assert.match(res.text, /Mis cursos/);
  assert.match(res.text, /Confeccionar lista definitiva|Preparar materiales/);
});

test('detalle de curso propio muestra estado', async () => {
  const agent = request.agent(app);
  const getRes = await agent.get('/empresa/login');
  const csrf = (getRes.text.match(/name="_csrf" value="([^"]+)"/) || [])[1];
  await agent.post('/empresa/login').type('form').send({ _csrf: csrf, usuario: 'emp_ok', clave: 'test' });
  const res = await agent.get('/empresa/cursos/1');
  assert.equal(res.status, 200);
  assert.match(res.text, /EN_PREPARACION/);
});

test('detalle de curso ajeno responde 404', async () => {
  const agent = request.agent(app);
  const getRes = await agent.get('/empresa/login');
  const csrf = (getRes.text.match(/name="_csrf" value="([^"]+)"/) || [])[1];
  await agent.post('/empresa/login').type('form').send({ _csrf: csrf, usuario: 'emp_ok', clave: 'test' });
  const res = await agent.get('/empresa/cursos/999');
  assert.equal(res.status, 404);
});
