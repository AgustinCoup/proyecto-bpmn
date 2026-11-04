'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
  FlowableError,
  basicAuth,
  buildQuery,
  createFlowableRest,
} = require('../flowable-rest');

async function startServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    server,
    base: `http://127.0.0.1:${server.address().port}/service`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

test('manda Basic Auth, query, body JSON y devuelve el JSON parseado', async (t) => {
  let captured;
  const app = await startServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      captured = { method: req.method, url: req.url, headers: req.headers, body };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  t.after(() => app.close());

  const client = createFlowableRest({ baseUrl: app.base, timeoutMs: 2000 });
  const result = await client('POST', '/runtime/tasks', {
    body: { action: 'claim', assignee: 'jefeAdmin' },
    query: { x: 'a b', skip: null, arr: [1, 2] },
    auth: { user: 'jefeAdmin', password: 'test' },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(captured.method, 'POST');
  assert.equal(captured.url, '/service/runtime/tasks?x=a+b&arr=1&arr=2');
  assert.equal(captured.headers.authorization, `Basic ${Buffer.from('jefeAdmin:test').toString('base64')}`);
  assert.equal(captured.headers['content-type'], 'application/json');
  assert.equal(captured.body, JSON.stringify({ action: 'claim', assignee: 'jefeAdmin' }));
});

test('204 sin cuerpo devuelve null y texto no JSON se devuelve tal cual', async (t) => {
  let mode = '204';
  const app = await startServer((req, res) => {
    if (mode === '204') {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('respuesta plana');
  });
  t.after(() => app.close());

  const client = createFlowableRest({ baseUrl: app.base, timeoutMs: 2000 });
  assert.equal(await client('DELETE', '/runtime/tasks/1'), null);

  mode = 'text';
  assert.equal(await client('GET', '/runtime/tasks/1'), 'respuesta plana');
});

test('los errores HTTP se convierten en FlowableError con estado y mensaje', async (t) => {
  const app = await startServer((req, res) => {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Unauthorized' }));
  });
  t.after(() => app.close());

  const client = createFlowableRest({ baseUrl: app.base, timeoutMs: 2000 });
  await assert.rejects(
    () => client('GET', '/identity/users/jefeAdmin'),
    (error) => {
      assert.ok(error instanceof FlowableError);
      assert.equal(error.status, 401);
      assert.equal(error.message, 'Unauthorized');
      return true;
    },
  );
});

test('sin conexión devuelve FlowableError 502', async () => {
  const app = await startServer((req, res) => res.end('ok'));
  const closedBase = app.base;
  await app.close();

  const client = createFlowableRest({ baseUrl: closedBase, timeoutMs: 500 });
  await assert.rejects(
    () => client('GET', '/runtime/tasks'),
    (error) => {
      assert.ok(error instanceof FlowableError);
      assert.equal(error.status, 502);
      assert.match(error.message, /No se pudo conectar con Flowable/);
      return true;
    },
  );
});

test('buildQuery y basicAuth cubren casos borde', () => {
  assert.equal(buildQuery(null), '');
  assert.equal(buildQuery({}), '');
  assert.equal(
    buildQuery({ a: undefined, b: null, c: 0, d: false, e: ['x', 'y'] }),
    '?c=0&d=false&e=x&e=y',
  );

  const expected = `Basic ${Buffer.from('u:p').toString('base64')}`;
  assert.equal(basicAuth({ user: 'u', password: 'p' }), expected);
  assert.equal(basicAuth('u:p'), expected);
  assert.equal(basicAuth('u:p:q'), `Basic ${Buffer.from('u:p:q').toString('base64')}`);
  assert.equal(basicAuth(null), null);
  assert.equal(basicAuth({ user: 'u' }), null);
  assert.equal(basicAuth('sinclave'), null);
});
