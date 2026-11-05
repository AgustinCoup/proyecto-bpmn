'use strict';

/** Layout HTML mínimo del arnés (se reemplaza por el layout EJS del esqueleto). */

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
  header .header-left { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
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
  input[type=text], input[type=password], input[type=number], input[type=date], textarea { width: 100%; padding: .55rem .65rem; border: 1px solid #b8c4cf; border-radius: 7px; font: inherit; }
  textarea { resize: vertical; }
  button, a.button { display: inline-block; font: inherit; border: 0; border-radius: 7px; padding: .5rem .85rem; background: #1d6fa5; color: #fff; cursor: pointer; text-decoration: none; }
  button.secondary, a.button.secondary { background: #dbe4ec; color: #12344d; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .field-error { color: #8a1f1f; font-size: .85rem; margin: .25rem 0 0; }
  .form-actions { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; margin-top: 1.2rem; }
  .error { background: #fdecec; border: 1px solid #f3b7b7; color: #8a1f1f; padding: .6rem .75rem; border-radius: 7px; margin: .8rem 0; }
  .ok { background: #e8f5ec; border: 1px solid #a9d9b8; color: #1d5b31; padding: .6rem .75rem; border-radius: 7px; margin: .8rem 0; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1e8; border-radius: 10px; overflow: hidden; }
  th, td { text-align: left; padding: .65rem .75rem; border-bottom: 1px solid #e5ebf0; vertical-align: top; }
  th { background: #eef3f7; font-size: .82rem; text-transform: uppercase; letter-spacing: .02em; color: #435566; }
  tr:last-child td { border-bottom: 0; }
  code { background: #eef3f7; padding: .1rem .3rem; border-radius: 4px; font-size: .85em; }
  .badge { display: inline-block; padding: .15rem .45rem; border-radius: 999px; font-size: .78rem; background: #e6eef5; color: #24455f; }
  .badge.warn { background: #fff1d6; color: #7a4a00; }
  .badge.danger { background: #fdecec; color: #8a1f1f; }
  .actions { white-space: nowrap; }
  .stack > * + * { margin-top: .65rem; }
  .review-note { background: #f7fafc; border-left: 4px solid #1d6fa5; padding: .7rem .85rem; margin: .5rem 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
`;

function page({
  title, baseUrl = '', user, groups = [], csrf, body, showLogout = true, showBack = showLogout,
  appName = 'Administración',
}) {
  const navigation = user && showLogout
    ? `<div class="who">${escapeHtml(user)}${groups.length ? ` · ${escapeHtml(groups.join(', '))}` : ''}</div>
       <form method="post" action="${escapeHtml(baseUrl)}/logout">
         <input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
         <button type="submit" class="secondary">Cerrar sesión</button>
       </form>`
    : '';
  const backHref = `${baseUrl}/`;
  const back = showBack
    ? `<a class="button secondary" href="${escapeHtml(backHref)}" data-back>&larr; Volver</a>`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · ${escapeHtml(appName)}</title>
  <script src="/back.js" defer></script>
  <style>${STYLES}</style>
</head>
<body>
  <header>
    <div class="header-left">
      ${back}
      <strong>${escapeHtml(appName)} de cursos</strong>
    </div>
    ${navigation}
  </header>
  <main>${body}</main>
</body>
</html>`;
}

module.exports = {
  STYLES, escapeHtml, formatDate, page,
};
