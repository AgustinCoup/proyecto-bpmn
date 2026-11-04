'use strict';

require('./setup');

const http = require('node:http');
const express = require('express');
const { createAdminRouter } = require('../index');
const { FlowableError } = require('../flowable-rest');
const { createSessionStore } = require('../session');

const TEST_SECRET = 'test-only-session-secret-0123456789';

function createTestStore(options = {}) {
  return createSessionStore({
    secret: TEST_SECRET,
    ttlMs: 60 * 1000,
    cookieName: 'admin_sid',
    secure: false,
    ...options,
  });
}

function setCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const raw = response.headers.get('set-cookie');
  return raw ? [raw] : [];
}

function cookieHeader(response) {
  return setCookies(response).map((cookie) => cookie.split(';')[0]).join('; ');
}

async function startApp({ client, sessions = createTestStore(), courses, config = {} } = {}) {
  const router = createAdminRouter({
    client,
    sessions,
    courses,
    config: {
      sessionSecret: TEST_SECRET,
      cookieSecure: false,
      sessionTtlMs: 60 * 1000,
      maxTasks: 100,
      ...config,
    },
  });

  const app = express();
  app.disable('x-powered-by');
  app.use('/admin', router);

  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  return {
    server,
    store: sessions,
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

async function request(base, path, { method = 'GET', cookie, form, headers = {} } = {}) {
  const init = { method, redirect: 'manual', headers: { ...headers } };
  if (cookie) init.headers.cookie = cookie;
  if (form) {
    init.headers['content-type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(form).toString();
  }
  const response = await fetch(`${base}${path}`, init);
  const text = await response.text();
  return {
    response,
    status: response.status,
    text,
    location: response.headers.get('location'),
    cookie: cookieHeader(response),
  };
}

function csrfFrom(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  if (!match) throw new Error('No se encontró el token CSRF en el HTML.');
  return match[1];
}

async function login(base, { usuario = 'jefeAdmin', clave = 'test' } = {}) {
  const page = await request(base, '/admin/login');
  const csrf = csrfFrom(page.text);
  const posted = await request(base, '/admin/login', {
    method: 'POST',
    cookie: page.cookie,
    form: { usuario, clave, _csrf: csrf },
  });
  return { page, posted, csrf };
}

function fakeClient(handler) {
  const calls = [];
  const client = async (method, path, options = {}) => {
    const call = { method, path, options };
    calls.push(call);
    return handler(method, path, options, calls);
  };
  client.calls = calls;
  return client;
}

function identityClient({ groups = ['administracion'], tasks = [], businessKeys = {}, failTasks = false } = {}) {
  return fakeClient((method, path, options) => {
    if (method === 'GET' && path.startsWith('/identity/users/')) return { id: decodeURIComponent(path.split('/').pop()) };
    if (method === 'GET' && path === '/identity/groups') return { data: groups.map((id) => ({ id })) };
    if (method === 'GET' && path === '/runtime/tasks') {
      if (failTasks) throw new FlowableError('sin conexión', { status: 502 });
      if (options.query && options.query.assignee) return { data: tasks.filter((task) => task.assignee === options.query.assignee) };
      return { data: [] };
    }
    const match = path.match(/^\/runtime\/process-instances\/(.+)$/);
    if (method === 'GET' && match) {
      const id = decodeURIComponent(match[1]);
      if (businessKeys[id] === undefined) throw new FlowableError('no encontrada', { status: 404 });
      return { businessKey: businessKeys[id] };
    }
    throw new Error(`Llamada no mockeada: ${method} ${path}`);
  });
}

module.exports = {
  FlowableError,
  TEST_SECRET,
  cookieHeader,
  createTestStore,
  csrfFrom,
  fakeClient,
  identityClient,
  login,
  request,
  setCookies,
  startApp,
};
