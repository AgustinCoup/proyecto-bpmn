'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createViews, escapeHtml, formatDate } = require('../views');

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

  const internal = fakeRes();
  views.error(internal, 'boom', { baseUrl: '/admin' });
  assert.equal(internal.statusCode, 500);
});
