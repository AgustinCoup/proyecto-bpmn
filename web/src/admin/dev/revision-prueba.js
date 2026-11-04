'use strict';

/**
 * Arnés de prueba para el formulario de `Revisar`. NO SE ENTREGA.
 *
 * Crea un curso temporal en la base `institucion` y un proceso mínimo que deja
 * las variables `observaciones` y `propuestaVersion` y una tarea `Revisar`
 * asignada a `jefeAdmin`. Así se prueba el formulario completo sin tocar las
 * instancias reales del escenario 8.
 *
 * Uso:
 *   node dev/revision-prueba.js           # crea (y limpia lo anterior)
 *   node dev/revision-prueba.js borrar    # borra curso, instancia y deployment
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
const DATABASE_URL = process.env.INSTITUCION_DATABASE_URL
  || 'postgresql://institucion:institucion@localhost:5432/institucion';
const PROCESS_KEY = 'RevisionPrueba';
const DEPLOYMENT_NAME = 'revision-prueba';
const MARKER = 'Prueba de revisión (dev)';
const OBSERVATIONS = 'La empresa pide ajustar el presupuesto y confirmar las fechas propuestas.';

const BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://example.com/revision-prueba">
  <process id="${PROCESS_KEY}" name="Prueba de revisión" isExecutable="true">
    <startEvent id="start"/>
    <sequenceFlow id="f1" sourceRef="start" targetRef="preparar"/>
    <scriptTask id="preparar" name="Preparar pedido" scriptFormat="groovy">
      <script><![CDATA[
execution.setVariable('propuestaVersion', 1)
execution.setVariable('observaciones', '${OBSERVATIONS}')
]]></script>
    </scriptTask>
    <sequenceFlow id="f2" sourceRef="preparar" targetRef="Revisar"/>
    <userTask id="Revisar" name="Revisar propuesta" flowable:assignee="jefeAdmin"/>
    <sequenceFlow id="f3" sourceRef="Revisar" targetRef="end"/>
    <endEvent id="end"/>
  </process>
</definitions>
`;

const client = createFlowableRest({ baseUrl: BASE });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

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
      query: { deleteReason: 'limpieza prueba de revisión' },
      auth: ADMIN,
    });
    console.log(`  Borré la instancia ${instance.id}.`);
  }

  const removed = await pool.query('DELETE FROM curso WHERE tematica = $1 RETURNING id', [MARKER]);
  for (const row of removed.rows) {
    console.log(`  Borré el curso temporal ${row.id}.`);
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
  form.append('file', new Blob([BPMN], { type: 'application/xml' }), 'revision-prueba.bpmn20.xml');
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

  const company = await pool.query('SELECT id FROM empresa ORDER BY id LIMIT 1');
  if (!company.rows.length) {
    throw new Error('No hay empresas en la base institucion. Corré scripts/crear-bd.sh primero.');
  }

  console.log('Creando el curso temporal...');
  const inserted = await pool.query(
    `INSERT INTO curso
       (empresa_id, tematica, descripcion, cantidad_participantes, fechas_preferidas,
        nombre, programa, presupuesto, fecha_inicio, fecha_fin, estado)
     VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, 'EN_PROCESO')
     RETURNING id`,
    [
      company.rows[0].id,
      MARKER,
      'Curso temporal para probar el formulario de revisión.',
      'Diciembre 2026',
      'Curso de prueba para revisión',
      'Programa de prueba para revisar cambios.',
      '123456.78',
      '2026-12-01T00:00:00.000Z',
      '2026-12-15T00:00:00.000Z',
    ],
  );
  const courseId = inserted.rows[0].id;
  console.log(`  Curso temporal ${courseId}.`);

  console.log('Desplegando el proceso temporal...');
  const deployment = await deploy();
  console.log(`  Deployment ${deployment.id}.`);

  const instance = await client('POST', '/runtime/process-instances', {
    body: { processDefinitionKey: PROCESS_KEY, businessKey: String(courseId) },
    auth: APP,
  });
  await pool.query('UPDATE curso SET process_instance_id = $2 WHERE id = $1', [courseId, instance.id]);

  const tasks = await client('GET', '/runtime/tasks', {
    query: { processInstanceId: instance.id, size: 100 },
    auth: APP,
  });
  const task = (tasks.data || []).find((item) => item.taskDefinitionKey === 'Revisar');
  if (!task) throw new Error('No se creó la tarea Revisar de prueba.');

  console.log('');
  console.log('Listo. Andá al sitio y probá el formulario:');
  console.log(`  Sitio:      ${SITE_URL}`);
  console.log(`  Usuario:    ${APP.user} / ${APP.password}`);
  console.log(`  Curso:      ${courseId} (businessKey ${courseId})`);
  console.log(`  Instancia:  ${instance.id}`);
  console.log(`  Tarea:      ${task.name} (${task.id})`);
  console.log('');
  console.log('En la lista debe aparecer "Revisar propuesta" con el botón "Revisar".');
  console.log(`El pedido de la empresa ya está cargado: "${OBSERVATIONS}"`);
  console.log('');
  console.log('Para borrar la prueba:');
  console.log('  node dev/revision-prueba.js borrar');
}

async function remove() {
  console.log('Borrando la prueba...');
  await cleanup();
  console.log('Listo. No quedaron cursos, instancias ni deployments de prueba.');
}

const command = process.argv[2] || 'crear';

(async () => {
  try {
    if (command === 'crear') {
      await create();
    } else if (command === 'borrar') {
      await remove();
    } else {
      console.error('Uso: node dev/revision-prueba.js [crear|borrar]');
      process.exitCode = 2;
    }
  } finally {
    await pool.end();
  }
})().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
