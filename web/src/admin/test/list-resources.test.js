'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FlowableError, csrfFrom, fakeClient, login, request, startApp,
} = require('./helpers');
const {
  parseLista, parseParticipantes, formValuesFromList, serializeList,
} = require('../participants');
const { parseResources, resourceValuesFromVariables } = require('../resources');

const BASE_TASK = {
  assignee: 'jefeAdmin',
  processInstanceId: 'pi1',
};
const LIST_TASK = { ...BASE_TASK, id: 'tl', name: 'Confeccionar lista definitiva', taskDefinitionKey: 'Lista' };
const RES_TASK = { ...BASE_TASK, id: 'tr', name: 'Evaluar Recursos', taskDefinitionKey: 'Activity_12i2hpf' };

function client(task, { variables = [], completeError = null } = {}) {
  return fakeClient((method, path) => {
    if (method === 'GET' && path.startsWith('/identity/users/')) return { id: 'jefeAdmin' };
    if (method === 'GET' && path === '/identity/groups') return { data: [{ id: 'administracion' }] };
    if (method === 'GET' && path === '/runtime/tasks') return { data: [] };
    if (method === 'GET' && path === `/runtime/tasks/${task.id}`) return task;
    if (method === 'GET' && path === '/runtime/process-instances/pi1') return { businessKey: '1' };
    if (method === 'GET' && path === '/runtime/process-instances/pi1/variables') return variables;
    if (method === 'POST' && path === `/runtime/tasks/${task.id}`) {
      if (completeError) throw completeError;
      return null;
    }
    throw new Error(`Llamada no mockeada: ${method} ${path}`);
  });
}

async function session(app) {
  const { posted } = await login(app.base);
  const home = await request(app.base, '/admin/', { cookie: posted.cookie });
  return { cookie: posted.cookie, csrf: csrfFrom(home.text) };
}

async function open(t, task, opts) {
  const c = client(task, opts);
  const app = await startApp({ client: c, courses: { async findById() { return { id: 1 }; } } });
  t.after(() => app.close());
  return { c, app, ...(await session(app)) };
}

const completeCall = (c, id) => c.calls.find((x) => x.method === 'POST' && x.path === `/runtime/tasks/${id}`);

test('GET de Lista muestra la nómina de la empresa para editar', async (t) => {
  const { app, cookie } = await open(t, LIST_TASK, {
    variables: [{ name: 'participantes', value: '["Ana","Beto"]' }],
  });
  const res = await request(app.base, '/admin/tasks/tl', { cookie });
  assert.equal(res.status, 200);
  assert.match(res.text, /tiene 2 participante/);
  assert.match(res.text, />Ana\nBeto</);
});

test('GET de Lista sin nómina avisa pero deja cargar la lista a mano', async (t) => {
  const { app, cookie } = await open(t, LIST_TASK);
  const res = await request(app.base, '/admin/tasks/tl', { cookie });
  assert.equal(res.status, 200);
  assert.match(res.text, /no envió una nómina/);
  assert.match(res.text, /Guardar lista definitiva/);
});

test('POST de Lista completa la tarea con la lista en la MISMA llamada (sin POST de variables)', async (t) => {
  const { c, app, cookie, csrf } = await open(t, LIST_TASK);
  const res = await request(app.base, '/admin/tasks/tl/complete', {
    method: 'POST', cookie, form: { _csrf: csrf, participantes: ' Ana \r\n\r\nBeto\n' },
  });
  assert.equal(res.status, 303);
  const post = completeCall(c, 'tl');
  assert.deepEqual(post.options.body, {
    action: 'complete',
    variables: [{ name: 'listaDefinitiva', type: 'string', value: '["Ana","Beto"]' }],
  });
  assert.equal(c.calls.some((x) => x.path.endsWith('/variables') && x.method === 'POST'), false);
  const home = await request(app.base, '/admin/', { cookie });
  assert.match(home.text, /Lista definitiva guardada/);
});

test('POST de Lista vacía responde 400 y no completa', async (t) => {
  const { c, app, cookie, csrf } = await open(t, LIST_TASK, {
    variables: [{ name: 'participantes', value: '["Ana"]' }],
  });
  const res = await request(app.base, '/admin/tasks/tl/complete', {
    method: 'POST', cookie, form: { _csrf: csrf, participantes: '  \n ' },
  });
  assert.equal(res.status, 400);
  assert.match(res.text, /al menos un participante/);
  assert.equal(completeCall(c, 'tl'), undefined);
});

test('POST de Lista cuando Flowable dice 409 avisa que ya estaba completada', async (t) => {
  const { app, cookie, csrf } = await open(t, LIST_TASK, {
    completeError: new FlowableError('conflicto', { status: 409 }),
  });
  const res = await request(app.base, '/admin/tasks/tl/complete', {
    method: 'POST', cookie, form: { _csrf: csrf, participantes: 'Ana' },
  });
  assert.equal(res.status, 303);
  const home = await request(app.base, '/admin/', { cookie });
  assert.match(home.text, /ya había sido completada/);
});

test('POST de Evaluar Recursos envía SIEMPRE las tres banderas booleanas', async (t) => {
  const { c, app, cookie, csrf } = await open(t, RES_TASK);
  const res = await request(app.base, '/admin/tasks/tr/complete', {
    method: 'POST', cookie, form: { _csrf: csrf, requiereAula: 'on' },
  });
  assert.equal(res.status, 303);
  assert.deepEqual(completeCall(c, 'tr').options.body, {
    action: 'complete',
    variables: [
      { name: 'requiereAula', type: 'boolean', value: true },
      { name: 'requierePlataforma', type: 'boolean', value: false },
      { name: 'requiereEquipamiento', type: 'boolean', value: false },
    ],
  });
});

test('POST de Evaluar Recursos sin ninguna casilla responde 400 y no llama a Flowable', async (t) => {
  const { c, app, cookie, csrf } = await open(t, RES_TASK);
  const res = await request(app.base, '/admin/tasks/tr/complete', {
    method: 'POST', cookie, form: { _csrf: csrf },
  });
  assert.equal(res.status, 400);
  assert.match(res.text, /al menos un recurso/);
  assert.equal(completeCall(c, 'tr'), undefined);
});

test('GET de Evaluar Recursos precarga las banderas existentes', async (t) => {
  const { app, cookie } = await open(t, RES_TASK, {
    variables: [{ name: 'requierePlataforma', value: true }],
  });
  const res = await request(app.base, '/admin/tasks/tr', { cookie });
  assert.equal(res.status, 200);
  assert.match(res.text, /name="requierePlataforma" checked/);
  assert.doesNotMatch(res.text, /name="requiereAula" checked/);
});

test('parseParticipantes acepta array, JSON y rechaza basura', () => {
  assert.deepEqual(parseParticipantes('["a"," b ",""]').list, ['a', 'b']);
  assert.deepEqual(parseParticipantes(['x', 3]).list, ['x', '3']);
  assert.match(parseParticipantes('{no').error, /JSON/);
  assert.match(parseParticipantes(undefined).error, /no envió/);
  assert.match(parseParticipantes('[]').error, /vacía/);
  assert.match(parseParticipantes('{"a":1}').error, /array/);
  const big = JSON.stringify(Array.from({ length: 501 }, (_, i) => `p${i}`));
  assert.equal(parseParticipantes(big).list.length, 500);
  assert.match(parseParticipantes(big).error, /supera/);
});

test('parseLista valida cantidad y largo; serializeList y formValuesFromList son inversas', () => {
  assert.equal(parseLista({}).valid, false);
  assert.equal(parseLista({ participantes: 'a'.repeat(201) }).valid, false);
  assert.equal(parseLista({ participantes: Array(501).fill('x').join('\n') }).valid, false);
  const ok = parseLista({ participantes: 'Ana\nBeto' });
  assert.deepEqual(ok.list, ['Ana', 'Beto']);
  assert.equal(serializeList(ok.list), '["Ana","Beto"]');
  assert.equal(serializeList(null), '[]');
  assert.deepEqual(formValuesFromList(ok.list), { participantes: 'Ana\nBeto' });
  assert.deepEqual(formValuesFromList(null), { participantes: '' });
});

test('resources: parseo de casillas y lectura de variables', () => {
  assert.equal(parseResources({}).valid, false);
  assert.equal(parseResources({ requiereEquipamiento: 'true' }).valid, true);
  assert.deepEqual(
    resourceValuesFromVariables(new Map([['requiereAula', true]])),
    { requiereAula: true, requierePlataforma: false, requiereEquipamiento: false },
  );
  assert.equal(resourceValuesFromVariables(null).requiereAula, false);
});
