'use strict';

/**
 * Arnés de prueba para el botón "Reclamar". NO SE ENTREGA.
 *
 * Crea un proceso temporal con una tarea candidata al grupo `administracion`,
 * para poder probar el reclamo desde el sitio sin tocar el modelo real ni las
 * instancias del escenario 8.
 *
 * Uso:
 *   node dev/tarea-grupo-prueba.js           # crea (y limpia lo anterior)
 *   node dev/tarea-grupo-prueba.js borrar    # borra instancia y deployment
 */

const { createFlowableRest } = require('../flowable-rest');

const BASE = (process.env.FLOWABLE_URL || 'http://localhost:8080/flowable-rest/service').replace(/\/+$/, '');
const ADMIN = {
  user: process.env.FLOWABLE_ADMIN_USER || 'rest-admin',
  password: process.env.FLOWABLE_ADMIN_PASSWORD || 'test',
};
const APP = {
  user: process.env.FLOWABLE_APP_USER || 'jefeAdmin',
  password: process.env.FLOWABLE_APP_PASSWORD || 'test',
};
const SITE_URL = process.env.ADMIN_URL || 'http://localhost:3000/admin/';
const PROCESS_KEY = 'TareaGrupoPrueba';
const DEPLOYMENT_NAME = 'tarea-grupo-prueba';

const BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://example.com/tarea-grupo-prueba">
  <process id="${PROCESS_KEY}" name="Tarea de prueba para reclamar" isExecutable="true">
    <startEvent id="start"/>
    <sequenceFlow id="f1" sourceRef="start" targetRef="claimTask"/>
    <userTask id="claimTask" name="Tarea de prueba" flowable:candidateGroups="administracion"/>
    <sequenceFlow id="f2" sourceRef="claimTask" targetRef="end"/>
    <endEvent id="end"/>
  </process>
</definitions>
`;

const client = createFlowableRest({ baseUrl: BASE });

function authHeader(auth) {
  return `Basic ${Buffer.from(`${auth.user}:${auth.password}`).toString('base64')}`;
}

async function cleanup() {
  const instances = await client('GET', '/runtime/process-instances', {
    query: { processDefinitionKey: PROCESS_KEY, size: 100 },
    auth: ADMIN,
  });
  for (const instance of instances.data || []) {
    await client('DELETE', `/runtime/process-instances/${instance.id}`, {
      query: { deleteReason: 'limpieza prueba de reclamo' },
      auth: ADMIN,
    });
    console.log(`  Borré la instancia ${instance.id}.`);
  }

  const deployments = await client('GET', '/repository/deployments', {
    query: { size: 100 },
    auth: ADMIN,
  });
  for (const deployment of deployments.data || []) {
    if (deployment.name !== DEPLOYMENT_NAME) continue;
    await client('DELETE', `/repository/deployments/${deployment.id}`, {
      query: { cascade: 'true' },
      auth: ADMIN,
    });
    console.log(`  Borré el deployment ${deployment.id}.`);
  }
}

async function deploy() {
  const form = new FormData();
  form.append('file', new Blob([BPMN], { type: 'application/xml' }), 'tarea-grupo-prueba.bpmn20.xml');
  form.append('deploymentName', DEPLOYMENT_NAME);

  const response = await fetch(`${BASE}/repository/deployments`, {
    method: 'POST',
    headers: { Authorization: authHeader(ADMIN), Accept: 'application/json' },
    body: form,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`No se pudo desplegar el proceso de prueba (HTTP ${response.status}): ${text}`);
  }
  return JSON.parse(text);
}

async function create() {
  console.log('Limpiando pruebas anteriores...');
  await cleanup();

  console.log('Desplegando el proceso temporal...');
  const deployment = await deploy();
  console.log(`  Deployment ${deployment.id}.`);

  const instance = await client('POST', '/runtime/process-instances', {
    body: { processDefinitionKey: PROCESS_KEY, businessKey: 'prueba-reclamo' },
    auth: APP,
  });

  const tasks = await client('GET', '/runtime/tasks', {
    query: { processInstanceId: instance.id, size: 100 },
    auth: APP,
  });
  const task = (tasks.data || []).find((item) => item.taskDefinitionKey === 'claimTask');
  if (!task) throw new Error('No se creó la tarea de prueba.');

  console.log('');
  console.log('Listo. Andá al sitio y probá el botón "Reclamar":');
  console.log(`  Sitio:      ${SITE_URL}`);
  console.log(`  Usuario:    ${APP.user} / ${APP.password}`);
  console.log(`  Instancia:  ${instance.id} (businessKey prueba-reclamo)`);
  console.log(`  Tarea:      ${task.name} (${task.id})`);
  console.log('');
  console.log('Antes de reclamar: "Disponible para reclamar" con botón "Reclamar".');
  console.log('Después de reclamar: "Asignada a vos" y mensaje de confirmación.');
  console.log('');
  console.log('Para borrar la prueba:');
  console.log('  node dev/tarea-grupo-prueba.js borrar');
}

async function remove() {
  console.log('Borrando la prueba...');
  await cleanup();
  console.log('Listo. No quedaron instancias ni deployments de prueba.');
}

const command = process.argv[2] || 'crear';

(async () => {
  if (command === 'crear') {
    await create();
  } else if (command === 'borrar') {
    await remove();
  } else {
    console.error('Uso: node dev/tarea-grupo-prueba.js [crear|borrar]');
    process.exitCode = 2;
  }
})().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
