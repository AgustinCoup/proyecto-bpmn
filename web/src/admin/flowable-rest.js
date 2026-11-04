'use strict';

/**
 * Cliente REST mínimo contra Flowable.
 *
 * La firma imita la que va a exponer `web/src/lib/flowable.js` del esqueleto:
 *   flowableRest(method, path, { body, query, auth })
 *
 * `auth` es `{ user, password }` y se manda como Basic Auth. Nunca se usa un
 * usuario administrador fijo: cada llamada viaja como el usuario logueado.
 */

const DEFAULT_BASE_URL = 'http://localhost:8080/flowable-rest/service';

class FlowableError extends Error {
  constructor(message, { status = 502, body = null } = {}) {
    super(message);
    this.name = 'FlowableError';
    this.status = status;
    this.body = body;
  }
}

function buildQuery(query) {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.append(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function basicAuth(auth) {
  if (!auth) return null;
  const user = typeof auth === 'string' ? auth.slice(0, Math.max(0, auth.indexOf(':'))) : auth.user;
  const password = typeof auth === 'string'
    ? auth.slice(Math.max(0, auth.indexOf(':')) + 1)
    : auth.password;
  if (!user || password === undefined || password === null) return null;
  const token = Buffer.from(`${user}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

function extractFlowableMessage(data, status) {
  if (data && typeof data === 'object') {
    const candidate = data.message || data.error || data.exception;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().slice(0, 300);
    }
  }
  if (typeof data === 'string' && data.trim()) {
    return data.trim().slice(0, 300);
  }
  return `Flowable respondió ${status}.`;
}

function createFlowableRest({ baseUrl = DEFAULT_BASE_URL, timeoutMs = 10000 } = {}) {
  const base = String(baseUrl).replace(/\/+$/, '');

  return async function flowableRest(method, path, options = {}) {
    const { body, query, auth } = options;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${base}${normalizedPath}${buildQuery(query)}`;

    const headers = { Accept: 'application/json' };
    const authorization = basicAuth(auth);
    if (authorization) headers.Authorization = authorization;

    let payload;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: payload,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new FlowableError('No se pudo conectar con Flowable.', {
        status: 502,
        body: { cause: error.name },
      });
    }

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      throw new FlowableError(extractFlowableMessage(data, response.status), {
        status: response.status,
        body: data,
      });
    }

    return data;
  };
}

module.exports = {
  FlowableError,
  createFlowableRest,
  buildQuery,
  basicAuth,
};
