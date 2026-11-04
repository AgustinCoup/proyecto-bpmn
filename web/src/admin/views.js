'use strict';

/**
 * Vistas mínimas del arnés. Cuando aparezca el esqueleto del sitio, estas
 * páginas se reemplazan por las plantillas EJS y el layout compartido.
 * Todo dato dinámico pasa por `escapeHtml`.
 */

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.toLocaleString('es-AR', {
    timeZone: 'UTC',
    dateStyle: 'short',
    timeStyle: 'short',
  })} UTC`;
}

const STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #f4f6f8; color: #1f2933; }
  header { background: #12344d; color: #fff; padding: .9rem 1.2rem; display: flex; gap: 1rem; align-items: center; justify-content: space-between; flex-wrap: wrap; }
  header a, header button { color: #fff; }
  header .who { font-size: .9rem; opacity: .9; }
  header form { margin: 0; }
  main { max-width: 1050px; margin: 1.5rem auto; padding: 0 1rem 2rem; }
  h1 { font-size: 1.45rem; margin: 0 0 .35rem; }
  h2 { font-size: 1.1rem; margin: 1.4rem 0 .5rem; }
  p { line-height: 1.45; }
  .muted { color: #5b6b7a; font-size: .9rem; }
  .card { background: #fff; border: 1px solid #d9e1e8; border-radius: 10px; padding: 1.2rem; box-shadow: 0 1px 2px rgba(16, 24, 40, .04); }
  .card.narrow { max-width: 430px; margin: 8vh auto 0; }
  label { display: block; font-weight: 600; margin: .8rem 0 .3rem; }
  input[type=text], input[type=password] { width: 100%; padding: .55rem .65rem; border: 1px solid #b8c4cf; border-radius: 7px; font: inherit; }
  button { font: inherit; border: 0; border-radius: 7px; padding: .5rem .85rem; background: #1d6fa5; color: #fff; cursor: pointer; }
  button.secondary { background: #dbe4ec; color: #12344d; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .error { background: #fdecec; border: 1px solid #f3b7b7; color: #8a1f1f; padding: .6rem .75rem; border-radius: 7px; margin: .8rem 0; }
  .ok { background: #e8f5ec; border: 1px solid #a9d9b8; color: #1d5b31; padding: .6rem .75rem; border-radius: 7px; margin: .8rem 0; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1e8; border-radius: 10px; overflow: hidden; }
  th, td { text-align: left; padding: .65rem .75rem; border-bottom: 1px solid #e5ebf0; vertical-align: top; }
  th { background: #eef3f7; font-size: .82rem; text-transform: uppercase; letter-spacing: .02em; color: #435566; }
  tr:last-child td { border-bottom: 0; }
  code { background: #eef3f7; padding: .1rem .3rem; border-radius: 4px; font-size: .85em; }
  .badge { display: inline-block; padding: .15rem .45rem; border-radius: 999px; font-size: .78rem; background: #e6eef5; color: #24455f; }
  .badge.warn { background: #fff1d6; color: #7a4a00; }
  .actions { white-space: nowrap; }
  .stack > * + * { margin-top: .65rem; }
`;

function page({ title, baseUrl = '', user, groups = [], csrf, body, showLogout = true }) {
  const navigation = user && showLogout
    ? `<div class="who">${escapeHtml(user)}${groups.length ? ` · ${escapeHtml(groups.join(', '))}` : ''}</div>
       <form method="post" action="${escapeHtml(baseUrl)}/logout">
         <input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
         <button type="submit" class="secondary">Cerrar sesión</button>
       </form>`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Administración</title>
  <style>${STYLES}</style>
</head>
<body>
  <header>
    <strong>Administración de cursos</strong>
    ${navigation}
  </header>
  <main>${body}</main>
</body>
</html>`;
}

function login({ baseUrl = '', csrf, error, expired }) {
  const alerts = [
    expired ? '<p class="error">La sesión expiró. Volvé a iniciar sesión.</p>' : '',
    error ? `<p class="error">${escapeHtml(error)}</p>` : '',
  ].join('');

  return page({
    title: 'Ingresar',
    baseUrl,
    showLogout: false,
    body: `<section class="card narrow">
      <h1>Ingresar</h1>
      <p class="muted">Acceso al módulo de administración con un usuario de Flowable.</p>
      ${alerts}
      <form method="post" action="${escapeHtml(baseUrl)}/login" class="stack">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
        <div>
          <label for="usuario">Usuario</label>
          <input id="usuario" name="usuario" type="text" autocomplete="username" required maxlength="100" autofocus>
        </div>
        <div>
          <label for="clave">Clave</label>
          <input id="clave" name="clave" type="password" autocomplete="current-password" required maxlength="200">
        </div>
        <button type="submit">Ingresar</button>
      </form>
    </section>`,
  });
}

function home({ baseUrl = '', user, groups = [], csrf, tasks = [] }) {
  const assigned = tasks.filter((task) => !task.claimable).length;
  const available = tasks.length - assigned;

  const rows = tasks.length
    ? tasks.map((task) => `<tr>
        <td>
          <strong>${escapeHtml(task.name)}</strong><br>
          <span class="muted"><code>${escapeHtml(task.taskDefinitionKey)}</code></span>
        </td>
        <td>${task.businessKey ? escapeHtml(task.businessKey) : '—'}</td>
        <td>${escapeHtml(formatDate(task.createTime))}</td>
        <td>${task.claimable
          ? '<span class="badge warn">Disponible para reclamar</span>'
          : '<span class="badge">Asignada a vos</span>'}</td>
        <td class="actions"><button type="button" disabled>${task.claimable ? 'Reclamar' : 'Completar'} (próximo corte)</button></td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="muted">No tenés tareas asignadas ni disponibles en este momento.</td></tr>`;

  return page({
    title: 'Tareas',
    baseUrl,
    user,
    groups,
    csrf,
    body: `<h1>Mis tareas</h1>
      <p class="muted">${tasks.length} en total: ${assigned} asignada(s) y ${available} disponible(s) para reclamar.</p>
      <table>
        <thead>
          <tr><th>Tarea</th><th>Curso</th><th>Creada</th><th>Estado</th><th>Acción</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="muted">En este corte solo se listan las tareas. Reclamar y completar se habilitan en el próximo.</p>`,
  });
}

function messagePage({ baseUrl = '', user, groups = [], csrf, status, title, message }) {
  return page({
    title,
    baseUrl,
    user,
    groups,
    csrf,
    body: `<section class="card narrow">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <p><a href="${escapeHtml(baseUrl)}/">Volver a mis tareas</a></p>
    </section>`,
  });
}

function createViews() {
  return {
    login,
    home,
    forbidden(res, message, context = {}) {
      res.status(403).send(messagePage({
        ...context,
        status: 403,
        title: 'Acceso denegado',
        message,
      }));
    },
    badGateway(res, message, context = {}) {
      res.status(502).send(messagePage({
        ...context,
        status: 502,
        title: 'Flowable no está disponible',
        message,
      }));
    },
    notFound(res, context = {}) {
      res.status(404).send(messagePage({
        ...context,
        status: 404,
        title: 'Página no encontrada',
        message: 'La dirección que pediste no existe en este módulo.',
      }));
    },
    error(res, message, context = {}) {
      res.status(500).send(messagePage({
        ...context,
        status: 500,
        title: 'Error interno',
        message,
      }));
    },
  };
}

module.exports = {
  escapeHtml,
  formatDate,
  createViews,
};
