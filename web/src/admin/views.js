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

function taskActionLabel(taskDefinitionKey) {
  if (taskDefinitionKey === 'Propuesta') return 'Completar';
  if (taskDefinitionKey === 'Revisar') return 'Revisar';
  if (taskDefinitionKey === 'Archivar') return 'Archivar';
  return 'Abrir';
}

function home({ baseUrl = '', user, groups = [], csrf, tasks = [], flash = null }) {
  const assigned = tasks.filter((task) => !task.claimable).length;
  const available = tasks.length - assigned;
  const alert = flash
    ? `<p class="${flash.type === 'error' ? 'error' : 'ok'}">${escapeHtml(flash.message)}</p>`
    : '';

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
        <td class="actions">${task.claimable
          ? `<form method="post" action="${escapeHtml(baseUrl)}/tasks/${encodeURIComponent(task.id)}/claim">
               <input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
               <button type="submit">Reclamar</button>
             </form>`
          : `<a class="button" href="${escapeHtml(baseUrl)}/tasks/${encodeURIComponent(task.id)}">${taskActionLabel(task.taskDefinitionKey)}</a>`}</td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="muted">No tenés tareas asignadas ni disponibles en este momento.</td></tr>`;

  return page({
    title: 'Tareas',
    baseUrl,
    user,
    groups,
    csrf,
    body: `<h1>Mis tareas</h1>
      ${alert}
      <p class="muted">${tasks.length} en total: ${assigned} asignada(s) y ${available} disponible(s) para reclamar.</p>
      <table>
        <thead>
          <tr><th>Tarea</th><th>Curso</th><th>Creada</th><th>Estado</th><th>Acción</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="muted">Podés reclamar las tareas disponibles y abrir las tareas que ya tenés asignadas.</p>`,
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

function fieldError(errors, field) {
  return errors && errors[field]
    ? `<p class="field-error">${escapeHtml(errors[field])}</p>`
    : '';
}

function courseLabel(course = {}) {
  return course.id
    ? `Curso #${escapeHtml(course.id)}${course.tematica ? ` · ${escapeHtml(course.tematica)}` : ''}`
    : 'Curso sin identificar';
}

function proposalFields(values = {}, errors = {}) {
  const presupuestoValue = String(values.presupuesto === undefined || values.presupuesto === null
    ? ''
    : values.presupuesto).replace(',', '.');

  return `<div>
          <label for="nombre">Nombre del curso</label>
          <input id="nombre" name="nombre" type="text" maxlength="200" required value="${escapeHtml(values.nombre)}">
          ${fieldError(errors, 'nombre')}
        </div>
        <div>
          <label for="programa">Programa</label>
          <textarea id="programa" name="programa" rows="8" maxlength="5000" required>${escapeHtml(values.programa)}</textarea>
          ${fieldError(errors, 'programa')}
        </div>
        <div>
          <label for="presupuesto">Presupuesto (ARS)</label>
          <input id="presupuesto" name="presupuesto" type="number" min="0.01" max="9999999999.99" step="0.01" required value="${escapeHtml(presupuestoValue)}">
          ${fieldError(errors, 'presupuesto')}
        </div>
        <div>
          <label for="fecha_inicio">Fecha de inicio</label>
          <input id="fecha_inicio" name="fecha_inicio" type="date" required value="${escapeHtml(values.fecha_inicio)}">
          ${fieldError(errors, 'fecha_inicio')}
        </div>
        <div>
          <label for="fecha_fin">Fecha de fin</label>
          <input id="fecha_fin" name="fecha_fin" type="date" required value="${escapeHtml(values.fecha_fin)}">
          ${fieldError(errors, 'fecha_fin')}
        </div>`;
}

function proposalForm({
  baseUrl = '', user, groups = [], csrf, task, course = {}, values = {}, errors = {},
}) {
  const hasErrors = Object.keys(errors).length > 0;

  return page({
    title: 'Registrar propuesta',
    baseUrl,
    user,
    groups,
    csrf,
    body: `<section class="card">
      <h1>${escapeHtml(task.name || 'Registrar y Elaborar propuesta')}</h1>
      <p class="muted">${courseLabel(course)}</p>
      ${hasErrors ? '<p class="error">Revisá los campos marcados antes de guardar.</p>' : ''}
      <form method="post" action="${escapeHtml(baseUrl)}/tasks/${encodeURIComponent(task.id)}/complete" class="stack" novalidate>
        <input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
        ${proposalFields(values, errors)}
        <div class="form-actions">
          <button type="submit">Guardar propuesta y completar tarea</button>
          <a class="button secondary" href="${escapeHtml(baseUrl)}/">Cancelar</a>
        </div>
      </form>
    </section>`,
  });
}

function reviewForm({
  baseUrl = '', user, groups = [], csrf, task, course = {}, values = {}, errors = {},
  observations = '', version = null, nextVersion = null,
}) {
  const hasErrors = Object.keys(errors).length > 0;
  const versionLabel = version === null
    ? 'No se pudo leer la versión actual de la propuesta.'
    : `Versión actual: ${version}${nextVersion === null ? '' : ` · al guardar se enviará la versión ${nextVersion}`}.`;
  const note = observations
    ? `<div class="review-note">${escapeHtml(observations)}</div>`
    : '<p class="muted">La empresa no dejó observaciones en este pedido.</p>';

  return page({
    title: 'Revisar propuesta',
    baseUrl,
    user,
    groups,
    csrf,
    body: `<section class="card">
      <h1>${escapeHtml(task.name || 'Revisar propuesta')}</h1>
      <p class="muted">${courseLabel(course)} · ${escapeHtml(versionLabel)}</p>
      <h2>Pedido de la empresa</h2>
      ${note}
      <p class="muted">Ajustá la propuesta según el pedido. Al completar la tarea se envía una nueva versión a la empresa.</p>
      ${hasErrors ? '<p class="error">Revisá los campos marcados antes de guardar.</p>' : ''}
      <form method="post" action="${escapeHtml(baseUrl)}/tasks/${encodeURIComponent(task.id)}/complete" class="stack" novalidate>
        <input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
        ${proposalFields(values, errors)}
        <div class="form-actions">
          <button type="submit">Guardar cambios y enviar nueva versión</button>
          <a class="button secondary" href="${escapeHtml(baseUrl)}/">Cancelar</a>
        </div>
      </form>
    </section>`,
  });
}

function archiveForm({
  baseUrl = '', user, groups = [], csrf, task, course = {}, result = '',
  resultLabel: label = '', archivable = false,
}) {
  const budget = course.presupuesto === undefined || course.presupuesto === null || course.presupuesto === ''
    ? '—'
    : `$ ${course.presupuesto}`;
  const summary = `<ul class="muted">
        <li>Nombre: ${escapeHtml(course.nombre || '—')}</li>
        <li>Presupuesto: ${escapeHtml(budget)}</li>
        <li>Fechas: ${escapeHtml(formatDate(course.fecha_inicio))} — ${escapeHtml(formatDate(course.fecha_fin))}</li>
      </ul>`;
  const warning = archivable
    ? ''
    : `<p class="error">La solicitud no está en un estado archivable (resultado: <code>${escapeHtml(result || 'sin resultado')}</code>). No se puede completar desde el sitio.</p>`;
  const action = archivable
    ? `<form method="post" action="${escapeHtml(baseUrl)}/tasks/${encodeURIComponent(task.id)}/complete">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
        <div class="form-actions">
          <button type="submit">Archivar solicitud y cerrar</button>
          <a class="button secondary" href="${escapeHtml(baseUrl)}/">Cancelar</a>
        </div>
      </form>`
    : `<p><a class="button secondary" href="${escapeHtml(baseUrl)}/">Volver a mis tareas</a></p>`;

  return page({
    title: 'Archivar solicitud',
    baseUrl,
    user,
    groups,
    csrf,
    body: `<section class="card">
      <h1>${escapeHtml(task.name || 'Archivar solicitud')}</h1>
      <p class="muted">${courseLabel(course)} · Estado del curso: ${escapeHtml(course.estado || '—')}</p>
      <h2>Resultado</h2>
      <p><span class="badge danger">${escapeHtml(result || 'SIN RESULTADO')}</span></p>
      <p>${escapeHtml(label)}</p>
      <h2>Propuesta</h2>
      ${summary}
      <p class="muted">Al archivar, la solicitud se cierra y el curso no se dicta.</p>
      ${warning}
      ${action}
    </section>`,
  });
}

function listForm({
  baseUrl = '', user, groups = [], csrf, task, values = {}, errors = {},
  participants = [], participantsError = '',
}) {
  const hasErrors = Object.keys(errors).length > 0;
  const sourceNotice = participantsError
    ? `<p class="error">${escapeHtml(participantsError)}</p>`
    : `<p class="muted">La nómina recibida tiene ${participants.length} participante(s).</p>`;
  return page({
    title: 'Lista definitiva',
    baseUrl,
    user,
    groups,
    csrf,
    body: `<section class="card">
      <h1>${escapeHtml(task.name || 'Confeccionar lista definitiva')}</h1>
      <p class="muted">Revisá la nómina recibida y corregila si hace falta. Un participante por línea.</p>
      ${sourceNotice}
      ${hasErrors ? '<p class="error">Revisá la lista antes de guardar.</p>' : ''}
      <form method="post" action="${escapeHtml(baseUrl)}/tasks/${encodeURIComponent(task.id)}/complete" class="stack" novalidate>
        <input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
        <div>
          <label for="participantes">Lista definitiva</label>
          <textarea id="participantes" name="participantes" rows="12" maxlength="100000" required>${escapeHtml(values.participantes || '')}</textarea>
          ${errors.participantes ? `<p class="field-error">${escapeHtml(errors.participantes)}</p>` : ''}
        </div>
        <div class="form-actions">
          <button type="submit">Guardar lista definitiva</button>
          <a class="button secondary" href="${escapeHtml(baseUrl)}/">Cancelar</a>
        </div>
      </form>
    </section>`,
  });
}

function resourcesForm({
  baseUrl = '', user, groups = [], csrf, task, values = {}, errors = {},
}) {
  const checked = (name) => values[name] ? ' checked' : '';
  return page({
    title: 'Evaluar recursos',
    baseUrl,
    user,
    groups,
    csrf,
    body: `<section class="card">
      <h1>${escapeHtml(task.name || 'Evaluar Recursos')}</h1>
      <p class="muted">Seleccioná todos los recursos que necesita el curso.</p>
      ${errors.resources ? `<p class="error">${escapeHtml(errors.resources)}</p>` : ''}
      <form method="post" action="${escapeHtml(baseUrl)}/tasks/${encodeURIComponent(task.id)}/complete" class="stack">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
        <label><input type="checkbox" name="requiereAula"${checked('requiereAula')}> Aula presencial</label>
        <label><input type="checkbox" name="requierePlataforma"${checked('requierePlataforma')}> Plataforma virtual</label>
        <label><input type="checkbox" name="requiereEquipamiento"${checked('requiereEquipamiento')}> Equipamiento especial</label>
        <div class="form-actions">
          <button type="submit">Guardar recursos</button>
          <a class="button secondary" href="${escapeHtml(baseUrl)}/">Cancelar</a>
        </div>
      </form>
    </section>`,
  });
}

function taskUnsupported({ baseUrl = '', user, groups = [], csrf, task }) {
  return page({
    title: 'Tarea sin formulario',
    baseUrl,
    user,
    groups,
    csrf,
    body: `<section class="card narrow">
      <h1>${escapeHtml(task.name || 'Tarea')}</h1>
      <p>La tarea <code>${escapeHtml(task.taskDefinitionKey || '')}</code> todavía no tiene formulario en el sitio.</p>
      <p class="muted">Por ahora se puede completar desde la interfaz de Flowable. Las demás pantallas se agregan en los próximos cortes.</p>
      <p><a href="${escapeHtml(baseUrl)}/">Volver a mis tareas</a></p>
    </section>`,
  });
}

function createViews() {
  return {
    login,
    home,
    archiveForm,
    listForm,
    resourcesForm,
    proposalForm,
    reviewForm,
    taskUnsupported,
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
    taskNotFound(res, context = {}) {
      res.status(404).send(messagePage({
        ...context,
        status: 404,
        title: 'Tarea no encontrada',
        message: 'La tarea no existe o ya fue completada.',
      }));
    },
    courseNotFound(res, context = {}) {
      res.status(404).send(messagePage({
        ...context,
        status: 404,
        title: 'Curso no encontrado',
        message: 'El curso asociado a la tarea no existe en la base de la institución.',
      }));
    },
    badRequest(res, message, context = {}) {
      res.status(400).send(messagePage({
        ...context,
        status: 400,
        title: 'Solicitud inválida',
        message,
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
  archiveForm,
  listForm,
  resourcesForm,
  createViews,
  proposalForm,
  reviewForm,
  taskUnsupported,
};
