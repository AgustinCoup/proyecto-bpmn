'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FlowableError,
  csrfFrom,
  fakeClient,
  login,
  request,
  startApp,
} = require('./helpers');

const COURSE = {
  id: 1,
  tematica: 'Seguridad e Higiene',
  nombre: 'Curso de seguridad',
  programa: 'Módulo 1',
  presupuesto: '150000.00',
  fecha_inicio: '2026-12-01T00:00:00.000Z',
  fecha_fin: '2026-12-15T00:00:00.000Z',
};

const PROPOSAL_TASK = {
  id: 't1',
  name: 'Registrar y Elaborar propuesta',
  taskDefinitionKey: 'Propuesta',
  assignee: 'jefeAdmin',
  processInstanceId: 'pi1',
};

const REVIEW_TASK = {
  ...PROPOSAL_TASK,
  id: 't2',
  name: 'Revisar propuesta',
  taskDefinitionKey: 'Revisar',
};

const REVIEW_VARIABLES = [
  { name: 'observaciones', type: 'string', value: 'La empresa pide ajustar el presupuesto.' },
  { name: 'propuestaVersion', type: 'integer', value: 1 },
];

const ARCHIVE_TASK = {
  ...PROPOSAL_TASK,
  id: 't3',
  name: 'Archivar solicitud',
  taskDefinitionKey: 'Archivar',
};

const ARCHIVE_VARIABLES = [
  { name: 'resultado', type: 'string', value: 'SIN_RESPUESTA' },
];

function proposalClient({
  task = PROPOSAL_TASK,
  businessKey = '1',
  completeError = null,
  variables = [],
  variablesError = null,
} = {}) {
  const taskId = task.id;
  return fakeClient((method, path) => {
    if (method === 'GET' && path.startsWith('/identity/users/')) return { id: 'jefeAdmin' };
    if (method === 'GET' && path === '/identity/groups') return { data: [{ id: 'administracion' }] };
    if (method === 'GET' && path === '/runtime/tasks') return { data: [] };
    if (method === 'GET' && path === `/runtime/tasks/${taskId}`) return task;
    if (method === 'GET' && path === `/runtime/process-instances/${task.processInstanceId}`) {
      return { businessKey };
    }
    if (method === 'GET' && path === `/runtime/process-instances/${task.processInstanceId}/variables`) {
      if (variablesError) throw variablesError;
      return variables;
    }
    if (method === 'POST' && path === `/runtime/tasks/${taskId}`) {
      if (completeError) throw completeError;
      return null;
    }
    throw new Error(`Llamada no mockeada: ${method} ${path}`);
  });
}

function fakeCourses({ course = COURSE, saved = COURSE } = {}) {
  const calls = { find: [], save: [] };
  return {
    calls,
    async findById(courseId) {
      calls.find.push(courseId);
      return course;
    },
    async saveProposal(courseId, proposal) {
      calls.save.push({ courseId, proposal });
      return saved;
    },
  };
}

const VALID_FORM = {
  nombre: 'Curso de seguridad',
  programa: 'Módulo 1',
  presupuesto: '150000.00',
  fecha_inicio: '2026-12-01',
  fecha_fin: '2026-12-15',
};

async function loginAndToken(app) {
  const { posted } = await login(app.base);
  const home = await request(app.base, '/admin/', { cookie: posted.cookie });
  assert.equal(home.status, 200);
  return { cookie: posted.cookie, csrf: csrfFrom(home.text) };
}

test('GET de una tarea Propuesta asignada muestra el formulario con los datos del curso', async (t) => {
  const client = proposalClient();
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie } = await loginAndToken(app);
  const detail = await request(app.base, '/admin/tasks/t1', { cookie });

  assert.equal(detail.status, 200);
  assert.match(detail.text, /Registrar y Elaborar propuesta/);
  assert.match(detail.text, /Curso #1 · Seguridad e Higiene/);
  assert.match(detail.text, /value="Curso de seguridad"/);
  assert.match(detail.text, /value="150000.00"/);
  assert.match(detail.text, /value="2026-12-01"/);
  assert.match(detail.text, /value="2026-12-15"/);
  assert.match(detail.text, /action="\/admin\/tasks\/t1\/complete"/);
  assert.deepEqual(courses.calls.find, [1]);
});

test('GET rechaza una tarea que no está asignada al usuario', async (t) => {
  const client = proposalClient({ task: { ...PROPOSAL_TASK, assignee: 'admin2' } });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie } = await loginAndToken(app);
  const detail = await request(app.base, '/admin/tasks/t1', { cookie });

  assert.equal(detail.status, 403);
  assert.match(detail.text, /no está asignada a vos/);
  assert.deepEqual(courses.calls.find, []);
});

test('GET de una tarea asignada sin formulario muestra un aviso', async (t) => {
  const client = proposalClient({
    task: { ...PROPOSAL_TASK, name: 'Enviar informe', taskDefinitionKey: 'TareaDesconocida' },
  });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie } = await loginAndToken(app);
  const detail = await request(app.base, '/admin/tasks/t1', { cookie });

  assert.equal(detail.status, 200);
  assert.match(detail.text, /Enviar informe/);
  assert.match(detail.text, /todavía no tiene formulario/);
  assert.deepEqual(courses.calls.find, []);
});

test('GET de una tarea de la UI de Flowable enlaza a esa interfaz', async (t) => {
  const client = proposalClient({
    task: { ...PROPOSAL_TASK, name: 'Preparar materiales', taskDefinitionKey: 'Material' },
  });
  const app = await startApp({ client, courses: fakeCourses() });
  t.after(() => app.close());

  const { cookie } = await loginAndToken(app);
  const detail = await request(app.base, '/admin/tasks/t1', { cookie });

  assert.equal(detail.status, 200);
  assert.match(detail.text, /interfaz de Flowable/);
  assert.match(detail.text, /href="http:\/\/localhost:8081\/flowable-ui"/);
  assert.match(detail.text, /rel="noopener noreferrer"/);
});

test('GET valida el id de tarea y el businessKey del curso', async (t) => {
  const client = proposalClient({ businessKey: 'abc' });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie } = await loginAndToken(app);

  const badId = await request(app.base, '/admin/tasks/abc%24', { cookie });
  assert.equal(badId.status, 400);

  const badCourse = await request(app.base, '/admin/tasks/t1', { cookie });
  assert.equal(badCourse.status, 400);
  assert.match(badCourse.text, /curso asociado a la tarea no es válido/);
});

test('GET avisa si el curso no existe en la base', async (t) => {
  const client = proposalClient();
  const courses = fakeCourses({ course: null });
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie } = await loginAndToken(app);
  const detail = await request(app.base, '/admin/tasks/t1', { cookie });

  assert.equal(detail.status, 404);
  assert.match(detail.text, /Curso no encontrado/);
});

test('POST válido guarda la propuesta y completa la tarea', async (t) => {
  const client = proposalClient();
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const completed = await request(app.base, '/admin/tasks/t1/complete', {
    method: 'POST',
    cookie,
    form: { ...VALID_FORM, _csrf: csrf },
  });

  assert.equal(completed.status, 303);
  assert.equal(completed.location, '/admin/');

  assert.deepEqual(courses.calls.save, [{
    courseId: 1,
    proposal: {
      nombre: 'Curso de seguridad',
      programa: 'Módulo 1',
      presupuesto: '150000.00',
      fechaInicio: '2026-12-01T00:00:00.000Z',
      fechaFin: '2026-12-15T00:00:00.000Z',
    },
  }]);

  const post = client.calls.find((call) => call.method === 'POST' && call.path === '/runtime/tasks/t1');
  assert.deepEqual(post.options.body, { action: 'complete' });
  assert.deepEqual(post.options.auth, { user: 'jefeAdmin', password: 'test' });

  const home = await request(app.base, '/admin/', { cookie });
  assert.match(home.text, /Propuesta guardada/);
});

test('POST inválido vuelve a mostrar el formulario sin guardar ni completar', async (t) => {
  const client = proposalClient();
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const invalid = await request(app.base, '/admin/tasks/t1/complete', {
    method: 'POST',
    cookie,
    form: {
      _csrf: csrf,
      nombre: '',
      programa: '',
      presupuesto: '0',
      fecha_inicio: '2026-12-15',
      fecha_fin: '2026-12-01',
    },
  });

  assert.equal(invalid.status, 400);
  assert.match(invalid.text, /Revisá los campos marcados/);
  assert.match(invalid.text, /Ingresá el nombre del curso/);
  assert.match(invalid.text, /posterior a la de inicio/);
  assert.deepEqual(courses.calls.save, []);
  assert.ok(!client.calls.some((call) => call.method === 'POST' && call.path === '/runtime/tasks/t1'));
});

test('POST rechaza tareas ajenas, sin formulario o sin CSRF', async (t) => {
  const otherClient = proposalClient({ task: { ...PROPOSAL_TASK, assignee: 'admin2' } });
  const otherCourses = fakeCourses();
  const otherApp = await startApp({ client: otherClient, courses: otherCourses });
  t.after(() => otherApp.close());
  const otherSession = await loginAndToken(otherApp);
  const foreign = await request(otherApp.base, '/admin/tasks/t1/complete', {
    method: 'POST',
    cookie: otherSession.cookie,
    form: { ...VALID_FORM, _csrf: otherSession.csrf },
  });
  assert.equal(foreign.status, 403);
  assert.deepEqual(otherCourses.calls.save, []);

  const unsupportedClient = proposalClient({
    task: { ...PROPOSAL_TASK, taskDefinitionKey: 'Material' },
  });
  const unsupportedCourses = fakeCourses();
  const unsupportedApp = await startApp({ client: unsupportedClient, courses: unsupportedCourses });
  t.after(() => unsupportedApp.close());
  const unsupportedSession = await loginAndToken(unsupportedApp);
  const unsupported = await request(unsupportedApp.base, '/admin/tasks/t1/complete', {
    method: 'POST',
    cookie: unsupportedSession.cookie,
    form: { ...VALID_FORM, _csrf: unsupportedSession.csrf },
  });
  assert.equal(unsupported.status, 400);
  assert.deepEqual(unsupportedCourses.calls.save, []);

  const noCsrfClient = proposalClient();
  const noCsrfCourses = fakeCourses();
  const noCsrfApp = await startApp({ client: noCsrfClient, courses: noCsrfCourses });
  t.after(() => noCsrfApp.close());
  const noCsrfSession = await loginAndToken(noCsrfApp);
  const noCsrf = await request(noCsrfApp.base, '/admin/tasks/t1/complete', {
    method: 'POST',
    cookie: noCsrfSession.cookie,
    form: VALID_FORM,
  });
  assert.equal(noCsrf.status, 403);
  assert.deepEqual(noCsrfCourses.calls.save, []);
});

test('POST valida el id de tarea y el businessKey del curso', async (t) => {
  const client = proposalClient({ businessKey: 'no-numero' });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);

  const badId = await request(app.base, '/admin/tasks/abc%24/complete', {
    method: 'POST',
    cookie,
    form: { ...VALID_FORM, _csrf: csrf },
  });
  assert.equal(badId.status, 400);
  assert.ok(!client.calls.some((call) => call.path === '/runtime/tasks/abc%24'));

  const badCourse = await request(app.base, '/admin/tasks/t1/complete', {
    method: 'POST',
    cookie,
    form: { ...VALID_FORM, _csrf: csrf },
  });
  assert.equal(badCourse.status, 400);
  assert.match(badCourse.text, /curso asociado a la tarea no es válido/);
  assert.deepEqual(courses.calls.save, []);
});

test('POST avisa si el curso no existe al abrir el formulario', async (t) => {
  const client = proposalClient();
  const courses = fakeCourses({ course: null });
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const completed = await request(app.base, '/admin/tasks/t1/complete', {
    method: 'POST',
    cookie,
    form: { ...VALID_FORM, _csrf: csrf },
  });

  assert.equal(completed.status, 404);
  assert.match(completed.text, /Curso no encontrado/);
  assert.deepEqual(courses.calls.save, []);
});

test('un error inesperado de la base responde 500 sin filtrar detalles', async (t) => {
  const client = proposalClient();
  const courses = {
    async findById() {
      throw new Error('falla interna con credenciales secretas');
    },
    async saveProposal() {
      throw new Error('no debería llegar');
    },
  };
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie } = await loginAndToken(app);
  const detail = await request(app.base, '/admin/tasks/t1', { cookie });

  assert.equal(detail.status, 500);
  assert.match(detail.text, /Ocurrió un error inesperado/);
  assert.ok(!detail.text.includes('credenciales secretas'));
});

test('POST avisa si el curso desapareció antes de guardar', async (t) => {
  const client = proposalClient();
  const courses = fakeCourses({ saved: null });
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const completed = await request(app.base, '/admin/tasks/t1/complete', {
    method: 'POST',
    cookie,
    form: { ...VALID_FORM, _csrf: csrf },
  });

  assert.equal(completed.status, 404);
  assert.match(completed.text, /Curso no encontrado/);
  assert.ok(!client.calls.some((call) => call.method === 'POST' && call.path === '/runtime/tasks/t1'));
});

test('POST si Flowable responde 409 avisa que la tarea ya estaba completada', async (t) => {
  const client = proposalClient({
    completeError: new FlowableError('Conflict', { status: 409 }),
  });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const completed = await request(app.base, '/admin/tasks/t1/complete', {
    method: 'POST',
    cookie,
    form: { ...VALID_FORM, _csrf: csrf },
  });

  assert.equal(completed.status, 303);
  const home = await request(app.base, '/admin/', { cookie });
  assert.match(home.text, /ya había sido completada/);
  assert.match(home.text, /propuesta quedó guardada/);
});

test('POST si Flowable falla muestra 502', async (t) => {
  const client = proposalClient({
    completeError: new FlowableError('sin conexión', { status: 502 }),
  });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const completed = await request(app.base, '/admin/tasks/t1/complete', {
    method: 'POST',
    cookie,
    form: { ...VALID_FORM, _csrf: csrf },
  });

  assert.equal(completed.status, 502);
  assert.match(completed.text, /Flowable no está disponible/);
  assert.equal(courses.calls.save.length, 1);
});

test('GET de una tarea Revisar muestra observaciones, versión y datos del curso', async (t) => {
  const client = proposalClient({ task: REVIEW_TASK, variables: REVIEW_VARIABLES });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie } = await loginAndToken(app);
  const detail = await request(app.base, '/admin/tasks/t2', { cookie });

  assert.equal(detail.status, 200);
  assert.match(detail.text, /Revisar propuesta/);
  assert.match(detail.text, /Curso #1 · Seguridad e Higiene/);
  assert.match(detail.text, /La empresa pide ajustar el presupuesto\./);
  assert.match(detail.text, /Versión actual: 1/);
  assert.match(detail.text, /se enviará la versión 2/);
  assert.match(detail.text, /value="Curso de seguridad"/);
  assert.match(detail.text, /action="\/admin\/tasks\/t2\/complete"/);
  assert.ok(client.calls.some((call) => call.path === '/runtime/process-instances/pi1/variables'));
});

test('POST válido de Revisar guarda los cambios y completa la tarea', async (t) => {
  const client = proposalClient({ task: REVIEW_TASK, variables: REVIEW_VARIABLES });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const updated = { ...VALID_FORM, presupuesto: '175000.00' };
  const completed = await request(app.base, '/admin/tasks/t2/complete', {
    method: 'POST',
    cookie,
    form: { ...updated, _csrf: csrf },
  });

  assert.equal(completed.status, 303);
  assert.equal(completed.location, '/admin/');
  assert.equal(courses.calls.save.length, 1);
  assert.equal(courses.calls.save[0].courseId, 1);
  assert.equal(courses.calls.save[0].proposal.presupuesto, '175000.00');

  const post = client.calls.find((call) => call.method === 'POST' && call.path === '/runtime/tasks/t2');
  assert.deepEqual(post.options.body, { action: 'complete' });

  const home = await request(app.base, '/admin/', { cookie });
  assert.match(home.text, /Revisión guardada/);
  assert.match(home.text, /nueva versión a la empresa/);
});

test('POST inválido de Revisar vuelve al formulario sin guardar ni completar', async (t) => {
  const client = proposalClient({ task: REVIEW_TASK, variables: REVIEW_VARIABLES });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const invalid = await request(app.base, '/admin/tasks/t2/complete', {
    method: 'POST',
    cookie,
    form: { ...VALID_FORM, nombre: '', _csrf: csrf },
  });

  assert.equal(invalid.status, 400);
  assert.match(invalid.text, /Revisá los campos marcados/);
  assert.match(invalid.text, /Ingresá el nombre del curso/);
  assert.match(invalid.text, /La empresa pide ajustar el presupuesto\./);
  assert.match(invalid.text, /Versión actual: 1/);
  assert.deepEqual(courses.calls.save, []);
  assert.ok(!client.calls.some((call) => call.method === 'POST' && call.path === '/runtime/tasks/t2'));
});

test('GET de Revisar responde 502 si no puede leer las variables del proceso', async (t) => {
  const client = proposalClient({
    task: REVIEW_TASK,
    variablesError: new FlowableError('sin conexión', { status: 502 }),
  });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie } = await loginAndToken(app);
  const detail = await request(app.base, '/admin/tasks/t2', { cookie });

  assert.equal(detail.status, 502);
  assert.match(detail.text, /Flowable no está disponible/);
});

test('GET de una tarea Archivar muestra el resultado y la propuesta', async (t) => {
  const client = proposalClient({ task: ARCHIVE_TASK, variables: ARCHIVE_VARIABLES });
  const courses = fakeCourses({ course: { ...COURSE, estado: 'EN_PROCESO' } });
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie } = await loginAndToken(app);
  const detail = await request(app.base, '/admin/tasks/t3', { cookie });

  assert.equal(detail.status, 200);
  assert.match(detail.text, /Archivar solicitud/);
  assert.match(detail.text, /Curso #1 · Seguridad e Higiene/);
  assert.match(detail.text, /SIN_RESPUESTA/);
  assert.match(detail.text, /no respondió después de dos recordatorios/);
  assert.match(detail.text, /Curso de seguridad/);
  assert.match(detail.text, /\$ 150000\.00/);
  assert.match(detail.text, /action="\/admin\/tasks\/t3\/complete"/);
  assert.match(detail.text, /Archivar solicitud y cerrar/);
  assert.ok(client.calls.some((call) => call.path === '/runtime/process-instances/pi1/variables'));
});

test('GET de Archivar con un resultado inesperado no ofrece completar', async (t) => {
  const client = proposalClient({
    task: ARCHIVE_TASK,
    variables: [{ name: 'resultado', value: 'FINALIZADO' }],
  });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie } = await loginAndToken(app);
  const detail = await request(app.base, '/admin/tasks/t3', { cookie });

  assert.equal(detail.status, 200);
  assert.match(detail.text, /no está en un estado archivable/);
  assert.match(detail.text, /FINALIZADO/);
  assert.ok(!detail.text.includes('/admin/tasks/t3/complete'));
});

test('GET de Archivar valida el businessKey y la existencia del curso', async (t) => {
  const badClient = proposalClient({ task: ARCHIVE_TASK, businessKey: 'no-numero' });
  const badCourses = fakeCourses();
  const badApp = await startApp({ client: badClient, courses: badCourses });
  t.after(() => badApp.close());

  const badSession = await loginAndToken(badApp);
  const badCourse = await request(badApp.base, '/admin/tasks/t3', { cookie: badSession.cookie });
  assert.equal(badCourse.status, 400);
  assert.match(badCourse.text, /curso asociado a la tarea no es válido/);

  const missingClient = proposalClient({ task: ARCHIVE_TASK });
  const missingCourses = fakeCourses({ course: null });
  const missingApp = await startApp({ client: missingClient, courses: missingCourses });
  t.after(() => missingApp.close());

  const missingSession = await loginAndToken(missingApp);
  const missing = await request(missingApp.base, '/admin/tasks/t3', { cookie: missingSession.cookie });
  assert.equal(missing.status, 404);
  assert.match(missing.text, /Curso no encontrado/);
});

test('POST válido de Archivar completa la tarea sin tocar la base', async (t) => {
  const client = proposalClient({ task: ARCHIVE_TASK, variables: ARCHIVE_VARIABLES });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const completed = await request(app.base, '/admin/tasks/t3/complete', {
    method: 'POST',
    cookie,
    form: { _csrf: csrf },
  });

  assert.equal(completed.status, 303);
  assert.equal(completed.location, '/admin/');
  assert.deepEqual(courses.calls.save, []);

  const post = client.calls.find((call) => call.method === 'POST' && call.path === '/runtime/tasks/t3');
  assert.deepEqual(post.options.body, { action: 'complete' });

  const home = await request(app.base, '/admin/', { cookie });
  assert.match(home.text, /Solicitud archivada/);
  assert.match(home.text, /expediente quedó cerrado/);
});

test('POST de Archivar con resultado inesperado responde 409 y no completa', async (t) => {
  const client = proposalClient({
    task: ARCHIVE_TASK,
    variables: [{ name: 'resultado', value: 'FINALIZADO' }],
  });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const completed = await request(app.base, '/admin/tasks/t3/complete', {
    method: 'POST',
    cookie,
    form: { _csrf: csrf },
  });

  assert.equal(completed.status, 409);
  assert.match(completed.text, /no está en un estado archivable/);
  assert.ok(!client.calls.some((call) => call.method === 'POST' && call.path === '/runtime/tasks/t3'));
});

test('POST de Archivar si Flowable responde 409 avisa que ya se completó', async (t) => {
  const client = proposalClient({
    task: ARCHIVE_TASK,
    variables: ARCHIVE_VARIABLES,
    completeError: new FlowableError('Conflict', { status: 409 }),
  });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const completed = await request(app.base, '/admin/tasks/t3/complete', {
    method: 'POST',
    cookie,
    form: { _csrf: csrf },
  });

  assert.equal(completed.status, 303);
  const home = await request(app.base, '/admin/', { cookie });
  assert.match(home.text, /La tarea ya había sido completada/);
});

test('POST de Archivar si Flowable falla muestra 502', async (t) => {
  const client = proposalClient({
    task: ARCHIVE_TASK,
    variables: ARCHIVE_VARIABLES,
    completeError: new FlowableError('sin conexión', { status: 502 }),
  });
  const courses = fakeCourses();
  const app = await startApp({ client, courses });
  t.after(() => app.close());

  const { cookie, csrf } = await loginAndToken(app);
  const completed = await request(app.base, '/admin/tasks/t3/complete', {
    method: 'POST',
    cookie,
    form: { _csrf: csrf },
  });

  assert.equal(completed.status, 502);
  assert.match(completed.text, /Flowable no está disponible/);
});
