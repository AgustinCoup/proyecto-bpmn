'use strict';

/**
 * Vistas mínimas del arnés. Cuando aparezca el esqueleto del sitio, estas
 * páginas se reemplazan por las plantillas EJS y el layout compartido.
 * Todo dato dinámico pasa por `escapeHtml`.
 */

const {
  escapeHtml, formatDate, page,
} = require('./layout');

const FLOWABLE_UI_TASKS = new Set(['Material', 'Virtual', 'Equipo', 'Activity_1m08pcl']);

function login({
  baseUrl = '', csrf, error, expired, appName, moduleName = 'administración',
}) {
  const alerts = [
    expired ? '<p class="error">La sesión expiró. Volvé a iniciar sesión.</p>' : '',
    error ? `<p class="error">${escapeHtml(error)}</p>` : '',
  ].join('');

  return page({
    title: 'Ingresar',
    appName,
    baseUrl,
    showLogout: false,
    body: `<section class="card narrow">
      <h1>Ingresar</h1>
      <p class="muted">Acceso al módulo de ${escapeHtml(moduleName)} con un usuario de Flowable.</p>
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
  if (taskDefinitionKey === 'EnviarInforme') return 'Enviar informe';
  if (taskDefinitionKey === 'Activity_1018bdz') return 'Definir docente';
  if (taskDefinitionKey === 'Dictar') return 'Desarrollar';
  if (taskDefinitionKey === 'Informe') return 'Elaborar informe';
  if (FLOWABLE_UI_TASKS.has(taskDefinitionKey)) return 'Ver';
  return 'Abrir';
}

function home({
  baseUrl = '', user, groups = [], csrf, tasks = [], flash = null, appName,
}) {
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
    appName,
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

function messagePage({
  baseUrl = '', user, groups = [], csrf, status, title, message, appName,
}) {
  return page({
    title,
    appName,
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

function taskUnsupported({
  baseUrl = '', user, groups = [], csrf, task, flowableUiUrl = '',
}) {
  const inUi = FLOWABLE_UI_TASKS.has(task.taskDefinitionKey) && flowableUiUrl;
  const note = inUi
    ? `<p>Esta tarea se completa desde la interfaz de Flowable (la consigna lo permite).</p>
      <p><a class="button" href="${escapeHtml(flowableUiUrl)}" target="_blank" rel="noopener noreferrer">Abrir Flowable UI</a></p>`
    : `<p>La tarea <code>${escapeHtml(task.taskDefinitionKey || '')}</code> todavía no tiene formulario en el sitio.</p>
      <p class="muted">Por ahora se puede completar desde la interfaz de Flowable.</p>`;
  return page({
    title: 'Tarea sin formulario',
    baseUrl,
    user,
    groups,
    csrf,
    body: `<section class="card narrow">
      <h1>${escapeHtml(task.name || 'Tarea')}</h1>
      ${note}
      <p><a href="${escapeHtml(baseUrl)}/">Volver a mis tareas</a></p>
    </section>`,
  });
}

function createViews(config = {}) {
  const { appName, moduleName } = config;
  return {
    login: (args) => login({ appName, moduleName, ...args }),
    home: (args) => home({ appName, ...args }),
    archiveForm,
    listForm,
    resourcesForm,
    proposalForm,
    reviewForm,
    taskUnsupported,
    forbidden(res, message, context = {}) {
      res.status(403).send(messagePage({
        appName,
        ...context,
        status: 403,
        title: 'Acceso denegado',
        message,
      }));
    },
    badGateway(res, message, context = {}) {
      res.status(502).send(messagePage({
        appName,
        ...context,
        status: 502,
        title: 'Flowable no está disponible',
        message,
      }));
    },
    notFound(res, context = {}) {
      res.status(404).send(messagePage({
        appName,
        ...context,
        status: 404,
        title: 'Página no encontrada',
        message: 'La dirección que pediste no existe en este módulo.',
      }));
    },
    taskNotFound(res, context = {}) {
      res.status(404).send(messagePage({
        appName,
        ...context,
        status: 404,
        title: 'Tarea no encontrada',
        message: 'La tarea no existe o ya fue completada.',
      }));
    },
    courseNotFound(res, context = {}) {
      res.status(404).send(messagePage({
        appName,
        ...context,
        status: 404,
        title: 'Curso no encontrado',
        message: 'El curso asociado a la tarea no existe en la base de la institución.',
      }));
    },
    badRequest(res, message, context = {}) {
      res.status(400).send(messagePage({
        appName,
        ...context,
        status: 400,
        title: 'Solicitud inválida',
        message,
      }));
    },
    error(res, message, context = {}) {
      res.status(500).send(messagePage({
        appName,
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
