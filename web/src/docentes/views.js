'use strict';

const { escapeHtml, formatDate, page } = require('../admin/layout');

const APP_NAME = 'Docentes';

function courseSummary(course = {}) {
  return `<ul class="muted">
        <li>Curso #${escapeHtml(course.id)} · ${escapeHtml(course.nombre || course.tematica || '—')}</li>
        <li>Fechas: ${escapeHtml(formatDate(course.fecha_inicio))} — ${escapeHtml(formatDate(course.fecha_fin))}</li>
      </ul>`;
}

function shell(args, body) {
  return page({
    title: args.title,
    appName: APP_NAME,
    baseUrl: args.baseUrl,
    user: args.user,
    groups: args.groups,
    csrf: args.csrf,
    body: `<section class="card">${body}</section>`,
  });
}

function completeAction(baseUrl, task, csrf, label, extra = '') {
  return `<form method="post" action="${escapeHtml(baseUrl)}/tasks/${encodeURIComponent(task.id)}/complete" class="stack">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
        ${extra}
        <div class="form-actions">
          <button type="submit">${escapeHtml(label)}</button>
          <a class="button secondary" href="${escapeHtml(baseUrl)}/">Cancelar</a>
        </div>
      </form>`;
}

/** `Activity_1018bdz` (jefeDocente): elegir UN docente. */
function selectTeacherForm({
  baseUrl = '', user, groups = [], csrf, task, course = {}, teachers = [],
  selected = '', error = '', hasDate = true,
}) {
  const options = teachers.map((teacher) => `<label>
          <input type="radio" name="docenteSeleccionado" value="${escapeHtml(teacher.id)}"${teacher.id === selected ? ' checked' : ''} required>
          ${escapeHtml(teacher.label)} <span class="muted">(${escapeHtml(teacher.id)})</span>
        </label>`).join('');
  const dateWarning = hasDate
    ? ''
    : '<p class="error">La empresa aceptó sin indicar la fecha de inicio (<code>fechaCurso</code>). Sin esa fecha el proceso no puede avanzar: pedí a la empresa que reenvíe la aceptación con fecha. No se puede completar la tarea desde el sitio.</p>';
  const form = hasDate && teachers.length
    ? completeAction(baseUrl, task, csrf, 'Asignar docente', `<fieldset><legend>Docente que desarrolla el curso</legend>${options}</fieldset>`)
    : `<p><a class="button secondary" href="${escapeHtml(baseUrl)}/">Volver a mis tareas</a></p>`;
  return shell({
    title: 'Definir docente', baseUrl, user, groups, csrf,
  }, `<h1>${escapeHtml(task.name || 'Definir docente')}</h1>
      ${courseSummary(course)}
      ${dateWarning}
      ${teachers.length ? '' : '<p class="error">No hay docentes disponibles en el grupo docentes.</p>'}
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
      ${form}`);
}

/** `Dictar` (docente asignado): ve la lista definitiva y confirma el dictado. */
function dictarForm({
  baseUrl = '', user, groups = [], csrf, task, course = {}, participants = [],
}) {
  const list = participants.length
    ? `<ol>${participants.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ol>`
    : '<p class="muted">No hay lista definitiva registrada.</p>';
  return shell({
    title: 'Desarrollar curso', baseUrl, user, groups, csrf,
  }, `<h1>${escapeHtml(task.name || 'Desarrollar curso')}</h1>
      ${courseSummary(course)}
      <h2>Lista definitiva (${participants.length})</h2>
      ${list}
      <p class="muted">Al completar, el curso queda dictado y se pasa a elaborar el informe de resultados.</p>
      ${completeAction(baseUrl, task, csrf, 'Marcar curso como dictado')}`);
}

/** `Informe` (jefeDocente): carga los resultados; el sitio genera el PDF. */
function reportForm({
  baseUrl = '', user, groups = [], csrf, task, course = {}, teacher = '',
  participants = [], values = {}, errors = {},
}) {
  const fieldError = (name) => (errors[name] ? `<p class="field-error">${escapeHtml(errors[name])}</p>` : '');
  const fields = `<div>
          <label for="resumen">Resumen de resultados</label>
          <textarea id="resumen" name="resumen" rows="8" maxlength="5000" required>${escapeHtml(values.resumen)}</textarea>
          ${fieldError('resumen')}
        </div>
        <div>
          <label for="asistentes">Asistentes efectivos</label>
          <input id="asistentes" name="asistentes" type="number" min="0" max="10000" step="1" required value="${escapeHtml(values.asistentes === undefined ? participants.length : values.asistentes)}">
          ${fieldError('asistentes')}
        </div>
        <div>
          <label for="observaciones">Observaciones (opcional)</label>
          <textarea id="observaciones" name="observaciones" rows="4" maxlength="3000">${escapeHtml(values.observaciones)}</textarea>
          ${fieldError('observaciones')}
        </div>`;
  return shell({
    title: 'Informe de resultados', baseUrl, user, groups, csrf,
  }, `<h1>${escapeHtml(task.name || 'Elaborar informe de resultados')}</h1>
      ${courseSummary(course)}
      <p class="muted">Docente a cargo: ${escapeHtml(teacher || '—')} · Participantes inscriptos: ${participants.length}</p>
      ${Number.isInteger(Number(course.informe_pdf)) && Number(course.informe_pdf) > 0
    ? `<p class="muted">Ya hay un informe generado: <a href="${escapeHtml(baseUrl)}/informes/${Number(course.informe_pdf)}.pdf">descargar PDF</a>. Al guardar de nuevo se reemplaza.</p>`
    : ''}
      ${Object.keys(errors).length ? '<p class="error">Revisá el informe antes de guardar.</p>' : ''}
      ${completeAction(baseUrl, task, csrf, 'Generar PDF y completar', fields)}`);
}

module.exports = {
  APP_NAME, dictarForm, reportForm, selectTeacherForm,
};
