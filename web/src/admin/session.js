'use strict';

const crypto = require('node:crypto');

const DEFAULT_COOKIE_NAME = 'admin_sid';

function resolveSecret(secret) {
  if (secret && String(secret).length > 0) return String(secret);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET es obligatorio en producción.');
  }
  console.warn('[admin] SESSION_SECRET no definido: usando uno aleatorio (las sesiones se pierden al reiniciar).');
  return crypto.randomBytes(32).toString('hex');
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const rawValue = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }
  return cookies;
}

function appendSetCookie(res, value) {
  if (typeof res.append === 'function') {
    res.append('Set-Cookie', value);
    return;
  }
  const previous = typeof res.getHeader === 'function' ? res.getHeader('Set-Cookie') : null;
  const list = previous ? [].concat(previous, value) : value;
  if (typeof res.setHeader === 'function') res.setHeader('Set-Cookie', list);
}

function createSessionStore(options = {}) {
  const ttlMs = Number(options.ttlMs) > 0 ? Number(options.ttlMs) : 8 * 60 * 60 * 1000;
  const cookieName = options.cookieName || DEFAULT_COOKIE_NAME;
  const secure = Boolean(options.secure);
  const secret = resolveSecret(options.secret);
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const sessions = new Map();

  function purgeExpired() {
    const current = now();
    for (const [sid, session] of sessions) {
      if (session.expiresAt <= current) sessions.delete(sid);
    }
  }

  function create(data = {}) {
    purgeExpired();
    const sid = crypto.randomBytes(32).toString('base64url');
    const createdAt = now();
    const session = {
      ...data,
      csrfToken: data.csrfToken || crypto.randomBytes(24).toString('base64url'),
      createdAt,
      expiresAt: createdAt + ttlMs,
    };
    sessions.set(sid, session);
    return { sid, session };
  }

  function get(sid) {
    if (!sid) return null;
    const session = sessions.get(sid);
    if (!session) return null;
    if (session.expiresAt <= now()) {
      sessions.delete(sid);
      return null;
    }
    return session;
  }

  function destroy(sid) {
    if (sid) sessions.delete(sid);
  }

  function sign(sid) {
    const mac = crypto.createHmac('sha256', secret).update(sid).digest('base64url');
    return `${sid}.${mac}`;
  }

  function unsign(value) {
    if (typeof value !== 'string') return null;
    const index = value.lastIndexOf('.');
    if (index <= 0 || index === value.length - 1) return null;
    const sid = value.slice(0, index);
    const provided = Buffer.from(value.slice(index + 1), 'utf8');
    const expected = Buffer.from(
      crypto.createHmac('sha256', secret).update(sid).digest('base64url'),
      'utf8',
    );
    if (provided.length !== expected.length) return null;
    return crypto.timingSafeEqual(provided, expected) ? sid : null;
  }

  function readSid(req) {
    const cookies = parseCookies(req && req.headers ? req.headers.cookie : null);
    return unsign(cookies[cookieName]);
  }

  function setCookie(res, sid, { maxAgeMs = ttlMs } = {}) {
    const parts = [
      `${cookieName}=${encodeURIComponent(sign(sid))}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`,
    ];
    if (secure) parts.push('Secure');
    appendSetCookie(res, parts.join('; '));
  }

  function clearCookie(res) {
    const parts = [
      `${cookieName}=`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=0',
    ];
    if (secure) parts.push('Secure');
    appendSetCookie(res, parts.join('; '));
  }

  function ensureAnonymous(req, res) {
    const existingSid = readSid(req);
    const existing = get(existingSid);
    if (existing) return { sid: existingSid, session: existing };
    const created = create({});
    setCookie(res, created.sid);
    return created;
  }

  function rotate(req, res, data) {
    const previousSid = readSid(req);
    if (previousSid) destroy(previousSid);
    const created = create(data);
    setCookie(res, created.sid);
    return created;
  }

  function csrfToken(session) {
    return session ? session.csrfToken : null;
  }

  function verifyCsrf(session, token) {
    if (!session || typeof token !== 'string' || !token) return false;
    const provided = Buffer.from(token, 'utf8');
    const expected = Buffer.from(session.csrfToken, 'utf8');
    if (provided.length !== expected.length) return false;
    return crypto.timingSafeEqual(provided, expected);
  }

  return {
    cookieName,
    ttlMs,
    create,
    get,
    destroy,
    sign,
    unsign,
    readSid,
    setCookie,
    clearCookie,
    ensureAnonymous,
    rotate,
    csrfToken,
    verifyCsrf,
    parseCookies,
    purgeExpired,
  };
}

module.exports = {
  createSessionStore,
  parseCookies,
  resolveSecret,
};
