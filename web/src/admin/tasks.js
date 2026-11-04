'use strict';

/**
 * Consulta y normaliza las tareas de un usuario.
 *
 * Flowable no obliga a reclamar ni a completar solo lo propio: esas reglas las
 * aplica el sitio. Acá ya se descartan las tareas candidatas que otra persona
 * reclamó, para no mostrarlas ni exponerlas por URL.
 */

const MAX_TASKS = 100;

function taskQuery(query, max) {
  return {
    ...query,
    size: max,
    sort: 'createTime',
    order: 'desc',
  };
}

function normalizeTask(task, origin, user) {
  const assignedToMe = task.assignee === user;
  const unassigned = task.assignee === undefined || task.assignee === null;
  if (!assignedToMe && !unassigned) return null;

  return {
    id: task.id,
    name: task.name || task.taskDefinitionKey || 'Tarea',
    taskDefinitionKey: task.taskDefinitionKey || '',
    createTime: task.createTime || null,
    processInstanceId: task.processInstanceId || null,
    assignee: task.assignee || null,
    claimable: unassigned,
    origins: [origin],
  };
}

async function resolveBusinessKeys(client, auth, tasks) {
  const ids = [...new Set(tasks.map((task) => task.processInstanceId).filter(Boolean))];
  const entries = await Promise.all(ids.map(async (processInstanceId) => {
    try {
      const instance = await client('GET', `/runtime/process-instances/${encodeURIComponent(processInstanceId)}`, { auth });
      return [processInstanceId, instance && instance.businessKey !== undefined ? instance.businessKey : null];
    } catch {
      // Un curso que ya no está disponible no debe romper toda la lista.
      return [processInstanceId, null];
    }
  }));
  return new Map(entries);
}

async function fetchTasks(client, auth, groups, { max = MAX_TASKS } = {}) {
  if (!auth || !auth.user) throw new Error('fetchTasks requiere un usuario autenticado.');

  const queries = [
    { query: { assignee: auth.user }, origin: 'assigned' },
    { query: { candidateUser: auth.user }, origin: 'candidate-user' },
  ];
  for (const group of groups || []) {
    if (group) queries.push({ query: { candidateGroup: group }, origin: 'candidate-group' });
  }

  const responses = await Promise.all(queries.map(async ({ query, origin }) => {
    const response = await client('GET', '/runtime/tasks', {
      query: taskQuery(query, max),
      auth,
    });
    return { origin, data: response && Array.isArray(response.data) ? response.data : [] };
  }));

  const byId = new Map();
  for (const { origin, data } of responses) {
    for (const task of data) {
      if (!task || !task.id) continue;
      const normalized = normalizeTask(task, origin, auth.user);
      if (!normalized) continue;
      const previous = byId.get(normalized.id);
      if (previous) {
        if (!previous.origins.includes(origin)) previous.origins.push(origin);
        previous.claimable = previous.claimable && normalized.claimable;
        continue;
      }
      byId.set(normalized.id, normalized);
    }
  }

  const tasks = [...byId.values()].sort((a, b) => {
    const left = a.createTime || '';
    const right = b.createTime || '';
    if (left === right) return a.name.localeCompare(b.name);
    return right.localeCompare(left);
  });

  const businessKeys = await resolveBusinessKeys(client, auth, tasks);
  return tasks.map((task) => ({
    ...task,
    businessKey: businessKeys.get(task.processInstanceId) || null,
  }));
}

async function fetchTask(client, auth, taskId) {
  return client('GET', `/runtime/tasks/${encodeURIComponent(taskId)}`, { auth });
}

async function fetchIdentityLinks(client, auth, taskId) {
  const links = await client(
    'GET',
    `/runtime/tasks/${encodeURIComponent(taskId)}/identitylinks`,
    { auth },
  );
  return Array.isArray(links) ? links : [];
}

function canClaimTask(task, links, user, groups) {
  if (!task || task.assignee) return false;
  const groupList = Array.isArray(groups) ? groups : [];
  return links.some((link) => link
    && link.type === 'candidate'
    && ((link.user && link.user === user)
      || (link.group && groupList.includes(link.group))));
}

async function claimTask(client, auth, taskId) {
  return client('POST', `/runtime/tasks/${encodeURIComponent(taskId)}`, {
    body: { action: 'claim', assignee: auth.user },
    auth,
  });
}

async function completeTask(client, auth, taskId) {
  return client('POST', `/runtime/tasks/${encodeURIComponent(taskId)}`, {
    body: { action: 'complete' },
    auth,
  });
}

module.exports = {
  MAX_TASKS,
  fetchTasks,
  fetchTask,
  fetchIdentityLinks,
  canClaimTask,
  claimTask,
  completeTask,
  normalizeTask,
  resolveBusinessKeys,
  taskQuery,
};
