const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.SESSION_SECRET = 'test-secret';

const db = require('../src/lib/db');
const { flowableRest } = require('../src/lib/flowable');
const app = require('../src/app');

test('integracion: solicitud crea curso y instancia viva', async (t) => {
  const cuit = '20-12345678-6';
  let cursoId = null;
  let processInstanceId = null;
  try {
    const agent = request.agent(app);
    const getRes = await agent.get('/solicitar');
    const csrf = (getRes.text.match(/name="_csrf" value="([^"]+)"/) || [])[1];
    const res = await agent.post('/solicitar').type('form').send({
      _csrf: csrf,
      nombreEmpresa: 'Empresa Test Integracion',
      cuit,
      contacto: 'Test',
      email: 'test@test.com',
      cantidadParticipantes: 3,
      tematica: 'Tema test',
      descripcion: 'Desc test',
      fechasPreferidas: 'Diciembre',
    });
    assert.equal(res.status, 302);
    const m = res.headers.location.match(/cursoId=(\d+)/);
    assert.ok(m, 'redirect con cursoId');
    cursoId = Number(m[1]);

    const r = await db.query('SELECT process_instance_id FROM curso WHERE id = $1', [cursoId]);
    assert.equal(r.rows.length, 1);
    processInstanceId = r.rows[0].process_instance_id;
    assert.ok(processInstanceId, 'process_instance_id guardado');

    const inst = await flowableRest('GET', `/runtime/process-instances/${processInstanceId}`);
    assert.equal(inst.status, 200);
    assert.equal(inst.data.ended, false);
  } finally {
    // cleanup
    if (processInstanceId) {
      try { await flowableRest('DELETE', `/runtime/process-instances/${processInstanceId}`); } catch (e) {}
    }
    if (cursoId) {
      try { await db.query('DELETE FROM curso WHERE id = $1', [cursoId]); } catch (e) {}
    }
    try { await db.query('DELETE FROM empresa WHERE cuit = $1', [cuit]); } catch (e) {}
  }
});
