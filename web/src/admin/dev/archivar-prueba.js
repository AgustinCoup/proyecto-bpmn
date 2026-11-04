'use strict';

/**
 * Arnés de prueba para el formulario de `Archivar`. NO SE ENTREGA.
 *
 * Crea un curso temporal en la base `institucion` y un proceso mínimo que deja
 * `resultado = RECHAZADO` o `SIN_RESPUESTA` y una tarea `Archivar` asignada a
 * `jefeAdmin`. Así se prueba el formulario sin cerrar las instancias reales del
 * escenario 8.
 *
 * Uso:
 *   node dev/archivar-prueba.js                       # crea con RECHAZADO
 *   node dev/archivar-prueba.js crear SIN_RESPUESTA   # crea con SIN_RESPUESTA
 *   node dev/archivar-prueba.js borrar                # borra todo lo temporal
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
const PROCESS_KEY = 'ArchivarPrueba';
const DEPLOYMENT_NAME = 'archivar-prueba';
const MARKER = 'Prueba de archivo (dev)';
const RESULTS = new Set(['RECHAZADO', 'SIN_RESPUESTA']);

function bpmn(result) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://example.com/archivar-prueba">
  <process id="${PROCESS_KEY}" name="Prueba de archivo" isExecutable="true">
    <startEvent id="start"/>
    <sequenceFlow id="f1" sourceRef="start" targetRef="preparar"/>
    <scriptTask id="preparar" name="Preparar cierre" scriptFormat="groovy">
      <script><![CDATA[
execution.setVariable('resultado', '${result}')
execution.setVariable('recordatorios', ${result === 'SIN_RESPUESTA' ? 2 : 0})
]]></script>
    </scriptTask>
    <sequenceFlow id="f2" sourceRef="preparar" targetRef="Archivar"/>
    <userTask id="Archivar" name="Archivar solicitud" flowable:assignee="jefeAdmin"/>
    <sequenceFlow id="f3" sourceRef="Archivar" targetRef="end"/>
    <endEvent id="end"/>
  </process>
</definitions>
`;
}

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
      query: { deleteReason: 'limpieza prueba de archivo' },
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

async function deploy(result) {
  const form = new FormData();
  form.append('file', new Blob([bpmn(result)], { type: 'application/xml' }), 'archivar-prueba.bpmn20.xml');
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

async function create(result = 'RECHAZADO') {
  if (!RESULTS.has(result)) {
    throw new Error(`Resultado inválido: ${result}. Usá RECHAZADO o SIN_RESPUESTA.`);
  }

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
      'Curso temporal para probar el formulario de archivo.',
      'Diciembre 2026',
      'Curso de prueba para archivar',
      'Programa de prueba para archivar.',
      '150000.00',
      '2026-12-01T00:00:00.000Z',
      '2026-12-15T00:00:00.000Z',
    ],
  );
  const courseId = inserted.rows[0].id;
  console.log(`  Curso temporal ${courseId}.`);

  console.log('Desplegando el proceso temporal...');
  const deployment = await deploy(result);
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
  const task = (tasks.data || []).find((item) => item.taskDefinitionKey === 'Archivar');
  if (!task) throw new Error('No se creó la tarea Archivar de prueba.');

  console.log('');
  console.log('Listo. Andá al sitio y probá el formulario:');
  console.log(`  Sitio:      ${SITE_URL}`);
  console.log(`  Usuario:    ${APP.user} / ${APP.password}`);
  console.log(`  Curso:      ${courseId} (businessKey ${courseId})`);
  console.log(`  Instancia:  ${instance.id}`);
  console.log(`  Tarea:      ${task.name} (${task.id})`);
  console.log(`  Resultado:  ${result}`);
  console.log('');
  console.log('En la lista debe aparecer "Archivar solicitud" con el botón "Archivar".');
  console.log('');
  console.log('Para borrar la prueba:');
  console.log('  node dev/archivar-prueba.js borrar');
}

async function remove() {
  console.log('Borrando la prueba...');
  await cleanup();
  console.log('Listo. No quedaron cursos, instancias ni deployments de prueba.');
}

const command = process.argv[2] || 'crear';
const result = (process.argv[3] || 'RECHAZADO').toUpperCase();

(async () => {
  try {
    if (command === 'crear') {
      await create(result);
    } else if (command === 'borrar') {
      await remove();
    } else {
      console.error('Uso: node dev/archivar-prueba.js [crear|borrar] [RECHAZADO|SIN_RESPUESTA]');
      process.exitCode = 2;
    }
  } finally {
    await pool.end();
  }
})().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
