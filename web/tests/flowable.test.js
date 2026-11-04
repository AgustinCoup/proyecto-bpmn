const test = require('node:test');
const assert = require('node:assert/strict');

// env defaults
process.env.FLOWABLE_REST_URL = 'http://localhost:9999/flowable-rest/service';

const { flowableRest } = require('../src/lib/flowable');

test('flowableRest construye URL y envia body', async () => {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, text: async () => '{"id":"123"}', headers: new Map() };
  };
  const res = await flowableRest('POST', '/runtime/process-instances', {
    body: { message: 'Solicitud de curso' },
    query: { foo: 'bar' },
    auth: { usuario: 'u', clave: 'p' },
  });
  assert.equal(res.data.id, '123');
  assert.match(calls[0].url, /foo=bar/);
  assert.equal(calls[0].opts.method, 'POST');
  const auth = calls[0].opts.headers.Authorization;
  assert.equal(auth, 'Basic ' + Buffer.from('u:p').toString('base64'));
});

test('flowableRest lanza en HTTP error', async () => {
  global.fetch = async () => ({ ok: false, status: 400, text: async () => '{"message":"bad"}', headers: new Map() });
  await assert.rejects(() => flowableRest('GET', '/x'), (err) => err.status === 400);
});
