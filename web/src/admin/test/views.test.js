'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createViews,
  escapeHtml,
  formatDate,
  proposalForm,
  reviewForm,
  taskUnsupported,
} = require('../views');

function fakeRes() {
  return {
    statusCode: 200,
    body: '',
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

test('escapeHtml neutraliza etiquetas y comillas', () => {
  assert.equal(
    escapeHtml(`<a href="x">'&'</a>`),
    '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
  );
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('formatDate muestra UTC y devuelve valores raros sin romper', () => {
  assert.match(formatDate('2026-11-04T13:03:00.000Z'), /UTC/);
  assert.equal(formatDate(''), '—');
  assert.equal(formatDate('no-es-fecha'), 'no-es-fecha');
});

test('login escapa el error y arma el formulario con CSRF', () => {
  const html = createViews().login({
    baseUrl: '/admin',
    csrf: 'token-123',
    expired: true,
    error: '<b>mal</b>',
  });

  assert.match(html, /action="\/admin\/login"/);
  assert.match(html, /name="_csrf" value="token-123"/);
  assert.match(html, /La sesión expiró/);
  assert.match(html, /&lt;b&gt;mal&lt;\/b&gt;/);
  assert.ok(!html.includes('<b>mal</b>'));
});

test('home escapa datos de la tarea y muestra estado vacío', () => {
  const views = createViews();
  const malicious = {
    id: '<script>alert(1)</script>',
    name: '<script>alert(1)</script>',
    taskDefinitionKey: 'X&Y',
    businessKey: '<1>',
    createTime: '2026-11-04T13:03:00.000Z',
    claimable: true,
  };
  const html = views.home({
    baseUrl: '/admin',
    user: 'jefeAdmin',
    groups: ['administracion'],
    csrf: 'token-123',
    tasks: [malicious],
  });

  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<code>X&amp;Y<\/code>/);
  assert.match(html, /&lt;1&gt;/);
  assert.match(html, /Disponible para reclamar/);
  assert.match(html, /action="\/admin\/logout"/);

  const empty = views.home({ baseUrl: '/admin', user: 'jefeAdmin', csrf: 't', tasks: [] });
  assert.match(empty, /No tenés tareas asignadas ni disponibles/);

  const withFlash = views.home({
    baseUrl: '/admin',
    user: 'jefeAdmin',
    csrf: 't',
    tasks: [],
    flash: { type: 'error', message: '<b>falló</b>' },
  });
  assert.match(withFlash, /class="error"/);
  assert.match(withFlash, /&lt;b&gt;falló&lt;\/b&gt;/);

  const claimForm = views.home({
    baseUrl: '/admin',
    user: 'jefeAdmin',
    csrf: 't',
    tasks: [{ ...malicious, claimable: true }],
  });
  assert.match(claimForm, /action="\/admin\/tasks\/%3Cscript%3Ealert\(1\)%3C%2Fscript%3E\/claim"/);
});

test('proposalForm escapa valores y errores', () => {
  const html = proposalForm({
    baseUrl: '/admin',
    user: 'jefeAdmin',
    groups: ['administracion'],
    csrf: 't',
    task: { id: 't1', name: '<b>Registrar</b>' },
    course: { id: 1, tematica: '<i>Curso</i>' },
    values: {
      nombre: '"><script>alert(1)</script>',
      programa: '<b>programa</b>',
      presupuesto: '100.00',
      fecha_inicio: '2026-12-01',
      fecha_fin: '2026-12-15',
    },
    errors: { nombre: '<b>error</b>' },
  });

  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<b>programa</b>'));
  assert.ok(!html.includes('<b>error</b>'));
  assert.match(html, /&lt;b&gt;Registrar&lt;\/b&gt;/);
  assert.match(html, /&lt;i&gt;Curso&lt;\/i&gt;/);
  assert.match(html, /&lt;b&gt;programa&lt;\/b&gt;/);
  assert.match(html, /&lt;b&gt;error&lt;\/b&gt;/);
  assert.match(html, /action="\/admin\/tasks\/t1\/complete"/);
});

test('reviewForm muestra observaciones y versión, y escapa todo', () => {
  const html = reviewForm({
    baseUrl: '/admin',
    user: 'jefeAdmin',
    groups: ['administracion'],
    csrf: 't',
    task: { id: 't2', name: 'Revisar propuesta' },
    course: { id: 7, tematica: '<i>Curso</i>' },
    values: {
      nombre: 'Curso',
      programa: 'Programa',
      presupuesto: '100.00',
      fecha_inicio: '2026-12-01',
      fecha_fin: '2026-12-15',
    },
    observations: '<script>alert(1)</script>\nSegunda línea',
    version: 1,
    nextVersion: 2,
  });

  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Segunda línea/);
  assert.match(html, /&lt;i&gt;Curso&lt;\/i&gt;/);
  assert.match(html, /Versión actual: 1/);
  assert.match(html, /se enviará la versión 2/);
  assert.match(html, /class="review-note"/);
  assert.match(html, /action="\/admin\/tasks\/t2\/complete"/);
  assert.match(html, /Guardar cambios y enviar nueva versión/);

  const without = reviewForm({
    baseUrl: '/admin',
    user: 'jefeAdmin',
    csrf: 't',
    task: { id: 't2', name: 'Revisar propuesta' },
    course: { id: 7 },
    observations: '',
    version: null,
    nextVersion: null,
  });
  assert.match(without, /La empresa no dejó observaciones/);
  assert.match(without, /No se pudo leer la versión actual/);
});

test('home etiqueta la acción de Revisar', () => {
  const html = createViews().home({
    baseUrl: '/admin',
    user: 'jefeAdmin',
    csrf: 't',
    tasks: [{ id: 't2', name: 'Revisar propuesta', taskDefinitionKey: 'Revisar', claimable: false }],
  });
  assert.match(html, /href="\/admin\/tasks\/t2">Revisar<\/a>/);
});

test('taskUnsupported muestra la tarea y el aviso', () => {
  const html = taskUnsupported({
    baseUrl: '/admin',
    user: 'jefeAdmin',
    csrf: 't',
    task: { id: 't1', name: 'Archivar solicitud', taskDefinitionKey: '<Archivar>' },
  });

  assert.match(html, /Archivar solicitud/);
  assert.match(html, /&lt;Archivar&gt;/);
  assert.match(html, /todavía no tiene formulario/);
});

test('páginas de error usan el status correcto', () => {
  const views = createViews();

  const forbidden = fakeRes();
  views.forbidden(forbidden, 'sin permiso', { baseUrl: '/admin' });
  assert.equal(forbidden.statusCode, 403);
  assert.match(forbidden.body, /Acceso denegado/);
  assert.match(forbidden.body, /sin permiso/);

  const gateway = fakeRes();
  views.badGateway(gateway, 'flowable caído', { baseUrl: '/admin' });
  assert.equal(gateway.statusCode, 502);
  assert.match(gateway.body, /Flowable no está disponible/);

  const notFound = fakeRes();
  views.notFound(notFound, { baseUrl: '/admin' });
  assert.equal(notFound.statusCode, 404);

  const taskNotFound = fakeRes();
  views.taskNotFound(taskNotFound, { baseUrl: '/admin' });
  assert.equal(taskNotFound.statusCode, 404);
  assert.match(taskNotFound.body, /ya fue completada/);

  const courseNotFound = fakeRes();
  views.courseNotFound(courseNotFound, { baseUrl: '/admin' });
  assert.equal(courseNotFound.statusCode, 404);
  assert.match(courseNotFound.body, /Curso no encontrado/);

  const badRequest = fakeRes();
  views.badRequest(badRequest, 'id inválido', { baseUrl: '/admin' });
  assert.equal(badRequest.statusCode, 400);
  assert.match(badRequest.body, /id inválido/);

  const internal = fakeRes();
  views.error(internal, 'boom', { baseUrl: '/admin' });
  assert.equal(internal.statusCode, 500);
});
