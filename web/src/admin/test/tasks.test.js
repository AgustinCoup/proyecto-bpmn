'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { fakeClient } = require('./helpers');
const {
  MAX_TASKS,
  fetchTasks,
  normalizeTask,
  resolveBusinessKeys,
  taskQuery,
} = require('../tasks');

const AUTH = { user: 'jefeAdmin', password: 'test' };

function tasksFixture() {
  return {
    assigned: {
      id: 't1',
      name: 'Archivar solicitud',
      taskDefinitionKey: 'Archivar',
      assignee: 'jefeAdmin',
      createTime: '2026-11-04T12:00:00.000Z',
      processInstanceId: 'pi1',
    },
    candidate: {
      id: 't2',
      name: 'Revisar propuesta',
      taskDefinitionKey: 'Revisar',
      assignee: null,
      createTime: '2026-11-04T13:00:00.000Z',
      processInstanceId: 'pi2',
    },
    duplicate: {
      id: 't3',
      name: 'Confeccionar lista definitiva',
      taskDefinitionKey: 'Lista',
      assignee: null,
      createTime: '2026-11-04T14:00:00.000Z',
      processInstanceId: 'pi3',
    },
    foreign: {
      id: 't4',
      name: 'Desarrollar curso',
      taskDefinitionKey: 'Dictar',
      assignee: 'docente1',
      createTime: '2026-11-04T15:00:00.000Z',
      processInstanceId: 'pi4',
    },
  };
}

test('fetchTasks combina, deduplica y descarta tareas de otros', async () => {
  const fixture = tasksFixture();
  const client = fakeClient((method, path, options) => {
    if (method === 'GET' && path === '/runtime/tasks') {
      if (options.query.assignee) return { data: [fixture.assigned, fixture.foreign] };
      if (options.query.candidateUser) return { data: [fixture.candidate, fixture.duplicate, fixture.foreign] };
      if (options.query.candidateGroup === 'administracion') return { data: [fixture.duplicate] };
    }
    if (method === 'GET' && path === '/runtime/process-instances/pi1') return { businessKey: '1' };
    if (method === 'GET' && path === '/runtime/process-instances/pi2') return { businessKey: '2' };
    if (method === 'GET' && path === '/runtime/process-instances/pi3') throw new Error('instancia terminada');
    throw new Error(`Llamada no mockeada: ${method} ${path}`);
  });

  const tasks = await fetchTasks(client, AUTH, ['administracion']);

  assert.deepEqual(tasks.map((task) => task.id), ['t3', 't2', 't1']);

  const byId = new Map(tasks.map((task) => [task.id, task]));
  assert.deepEqual(byId.get('t3').origins.sort(), ['candidate-group', 'candidate-user']);
  assert.equal(byId.get('t3').claimable, true);
  assert.equal(byId.get('t3').businessKey, null);
  assert.equal(byId.get('t2').businessKey, '2');
  assert.equal(byId.get('t2').claimable, true);
  assert.equal(byId.get('t1').businessKey, '1');
  assert.equal(byId.get('t1').claimable, false);
  assert.equal(byId.has('t4'), false);

  const taskCalls = client.calls.filter((call) => call.path === '/runtime/tasks');
  assert.equal(taskCalls.length, 3);
  for (const call of taskCalls) {
    assert.equal(call.options.query.size, MAX_TASKS);
    assert.equal(call.options.query.sort, 'createTime');
    assert.equal(call.options.query.order, 'desc');
    assert.deepEqual(call.options.auth, AUTH);
  }

  const instanceCalls = client.calls
    .filter((call) => call.path.startsWith('/runtime/process-instances/'))
    .map((call) => call.path);
  assert.deepEqual(instanceCalls.sort(), [
    '/runtime/process-instances/pi1',
    '/runtime/process-instances/pi2',
    '/runtime/process-instances/pi3',
  ]);
});

test('fetchTasks agrega una consulta por cada grupo candidato', async () => {
  const client = fakeClient((method, path) => {
    if (method === 'GET' && path === '/runtime/tasks') return { data: [] };
    throw new Error(`Llamada no mockeada: ${method} ${path}`);
  });

  const tasks = await fetchTasks(client, AUTH, ['administracion', 'docentes'], { max: 25 });
  assert.deepEqual(tasks, []);

  const groupQueries = client.calls
    .filter((call) => call.path === '/runtime/tasks' && call.options.query.candidateGroup)
    .map((call) => call.options.query.candidateGroup);
  assert.deepEqual(groupQueries.sort(), ['administracion', 'docentes']);
  assert.ok(client.calls.every((call) => call.options.query.size === 25));
});

test('normalizeTask descarta tareas asignadas a otra persona', () => {
  const fixture = tasksFixture();
  assert.equal(normalizeTask(fixture.foreign, 'candidate-group', 'jefeAdmin'), null);

  const normalized = normalizeTask({ id: 'x', assignee: null }, 'assigned', 'jefeAdmin');
  assert.equal(normalized.name, 'Tarea');
  assert.equal(normalized.taskDefinitionKey, '');
  assert.equal(normalized.claimable, true);
});

test('resolveBusinessKeys tolera instancias inexistentes y listas vacías', async () => {
  const client = fakeClient((method, path) => {
    if (path === '/runtime/process-instances/pi1') return { businessKey: '1' };
    throw new Error('no encontrada');
  });

  const keys = await resolveBusinessKeys(client, AUTH, [{ processInstanceId: 'pi1' }, { processInstanceId: 'pi2' }]);
  assert.equal(keys.get('pi1'), '1');
  assert.equal(keys.get('pi2'), null);

  const emptyCalls = client.calls.length;
  const empty = await resolveBusinessKeys(client, AUTH, []);
  assert.equal(empty.size, 0);
  assert.equal(client.calls.length, emptyCalls);
});

test('fetchTasks exige usuario autenticado y taskQuery completa paginación', async () => {
  await assert.rejects(() => fetchTasks(fakeClient(() => ({ data: [] })), null, []), /usuario autenticado/);

  assert.deepEqual(taskQuery({ assignee: 'jefeAdmin' }, 10), {
    assignee: 'jefeAdmin',
    size: 10,
    sort: 'createTime',
    order: 'desc',
  });
});
