const config = require('./config');

async function flowableRest(method, path, options = {}) {
  const { body, query, auth } = options;
  const base = config.flowableRestUrl;
  const url = new URL(base + (path.startsWith('/') ? path : '/' + path));
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const headers = { 'Accept': 'application/json' };
  const credentials = auth || config.flowableAuth;
  if (credentials && credentials.usuario) {
    const token = Buffer.from(`${credentials.usuario}:${credentials.clave}`).toString('base64');
    headers['Authorization'] = `Basic ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url.toString(), {
    method: method.toUpperCase(),
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (e) { data = text; }
  }
  if (!res.ok) {
    const err = new Error(`Flowable REST ${method} ${path} -> ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return { status: res.status, data, headers: Object.fromEntries(res.headers.entries()) };
}

module.exports = { flowableRest };
