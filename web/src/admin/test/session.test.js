'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createSessionStore,
  parseCookies,
  resolveSecret,
} = require('../session');

const SECRET = 'test-only-session-secret-0123456789';

function fakeReq(cookie) {
  return { headers: cookie ? { cookie } : {} };
}

function fakeRes() {
  const headers = {};
  return {
    append(name, value) {
      headers[name] = headers[name] || [];
      headers[name].push(value);
    },
    getHeader(name) {
      return headers[name];
    },
    setHeader(name, value) {
      headers[name] = value;
    },
    headers,
  };
}

function setCookieValue(res, cookieName = 'admin_sid') {
  const raw = res.headers['Set-Cookie'][0];
  assert.ok(raw.startsWith(`${cookieName}=`));
  return raw.split(';')[0];
}

test('crear, obtener, expirar y destruir sesiones', () => {
  let now = 1000;
  const store = createSessionStore({ secret: SECRET, ttlMs: 100, now: () => now });

  const { sid, session } = store.create({ user: 'jefeAdmin' });
  assert.equal(store.get(sid), session);
  assert.equal(session.user, 'jefeAdmin');
  assert.ok(session.csrfToken);

  now = 1050;
  assert.equal(store.get(sid), session);

  now = 1101;
  assert.equal(store.get(sid), null);

  const other = store.create({ user: 'admin2' });
  store.destroy(other.sid);
  assert.equal(store.get(other.sid), null);
  assert.equal(store.get(null), null);
  assert.equal(store.get('no-existe'), null);
});

test('firma HMAC: acepta la cookie propia y rechaza manipuladas', () => {
  const store = createSessionStore({ secret: SECRET });
  const { sid } = store.create({ user: 'jefeAdmin' });
  const signed = store.sign(sid);

  assert.equal(store.unsign(signed), sid);
  assert.equal(store.unsign(`${signed}x`), null);
  assert.equal(store.unsign('sinpunto'), null);
  assert.equal(store.unsign('.'), null);
  assert.equal(store.unsign(null), null);

  const otherStore = createSessionStore({ secret: 'otro-secreto-distinto-0123456789' });
  assert.equal(otherStore.unsign(signed), null);
});

test('cookie anónima, rotación de sesión y CSRF', () => {
  const store = createSessionStore({ secret: SECRET, cookieName: 'admin_sid' });
  const res = fakeRes();

  const anonymous = store.ensureAnonymous(fakeReq(null), res);
  assert.ok(anonymous.session.csrfToken);
  assert.equal(anonymous.session.user, undefined);

  const cookie = setCookieValue(res);
  assert.match(cookie, /^admin_sid=/);
  assert.match(res.headers['Set-Cookie'][0], /HttpOnly/);
  assert.match(res.headers['Set-Cookie'][0], /SameSite=Lax/);
  assert.match(res.headers['Set-Cookie'][0], /Max-Age=28800/);

  const reused = store.ensureAnonymous(fakeReq(cookie), fakeRes());
  assert.equal(reused.sid, anonymous.sid);

  const rotateRes = fakeRes();
  const rotated = store.rotate(fakeReq(cookie), rotateRes, { user: 'jefeAdmin', password: 'test', groups: ['administracion'] });
  assert.notEqual(rotated.sid, anonymous.sid);
  assert.equal(store.get(anonymous.sid), null);
  assert.equal(rotated.session.user, 'jefeAdmin');

  assert.equal(store.verifyCsrf(rotated.session, rotated.session.csrfToken), true);
  assert.equal(store.verifyCsrf(rotated.session, 'malo'), false);
  assert.equal(store.verifyCsrf(rotated.session, null), false);
  assert.equal(store.verifyCsrf(null, 'x'), false);

  store.setFlash(rotated.session, 'ok', 'todo bien');
  assert.deepEqual(store.consumeFlash(rotated.session), { type: 'ok', message: 'todo bien' });
  assert.equal(store.consumeFlash(rotated.session), null);
  store.setFlash(null, 'ok', 'no hace nada');
  assert.equal(store.consumeFlash(null), null);

  const cleared = fakeRes();
  store.clearCookie(cleared);
  assert.match(cleared.headers['Set-Cookie'][0], /Max-Age=0/);
  assert.match(cleared.headers['Set-Cookie'][0], /HttpOnly/);
});

test('parseCookies decodifica valores y tolera cookies raras', () => {
  assert.deepEqual(parseCookies('a=1; b=hola%20mundo'), { a: '1', b: 'hola mundo' });
  assert.deepEqual(parseCookies('sinigual; c=3'), { c: '3' });
  assert.deepEqual(parseCookies(null), {});
  assert.deepEqual(parseCookies('rota=%E0%A4%A'), { rota: '%E0%A4%A' });
});

test('resolveSecret exige secreto en producción y avisa en desarrollo', () => {
  const previousEnv = process.env.NODE_ENV;
  const previousWarn = console.warn;
  try {
    process.env.NODE_ENV = 'production';
    assert.throws(() => resolveSecret(null), /SESSION_SECRET/);
    assert.equal(resolveSecret('secreto-suficiente'), 'secreto-suficiente');

    process.env.NODE_ENV = 'development';
    console.warn = () => {};
    const generated = resolveSecret(null);
    assert.match(generated, /^[a-f0-9]{64}$/);
  } finally {
    process.env.NODE_ENV = previousEnv;
    console.warn = previousWarn;
  }
});
