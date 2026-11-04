'use strict';

const { escapeHtml, formatDate, page } = require('./layout');

function courseSummary(course = {}) {
  return `<ul class="muted">
        <li>Curso #${escapeHtml(course.id)} · ${escapeHtml(course.nombre || course.tematica || '—')}</li>
        <li>Fechas: ${escapeHtml(formatDate(course.fecha_inicio))} — ${escapeHtml(formatDate(course.fecha_fin))}</li>
      </ul>`;
}

/** Tarea `EnviarInforme` (jefeAdmin): ver/descargar el PDF y cerrar el expediente. */
function sendReportForm({
  baseUrl = '', user, groups = [], csrf, task, course = {}, reportId = null,
}) {
  const body = reportId
    ? `<p><a class="button secondary" href="${escapeHtml(baseUrl)}/informes/${reportId}.pdf">Descargar informe (PDF)</a></p>
      <form method="post" action="${escapeHtml(baseUrl)}/tasks/${encodeURIComponent(task.id)}/complete">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
        <p class="muted">Al completar, se avisa a la empresa y el expediente se archiva.</p>
        <div class="form-actions">
          <button type="submit">Enviar informe a la empresa y archivar</button>
          <a class="button secondary" href="${escapeHtml(baseUrl)}/">Cancelar</a>
        </div>
      </form>`
    : `<p class="error">No hay un informe guardado para este curso (variable <code>informePdf</code> ausente o inválida). No se puede completar la tarea desde el sitio.</p>
      <p><a class="button secondary" href="${escapeHtml(baseUrl)}/">Volver a mis tareas</a></p>`;

  return page({
    title: 'Enviar informe',
    baseUrl,
    user,
    groups,
    csrf,
    body: `<section class="card">
      <h1>${escapeHtml(task.name || 'Enviar informe')}</h1>
      ${courseSummary(course)}
      ${body}
    </section>`,
  });
}

module.exports = { courseSummary, sendReportForm };
