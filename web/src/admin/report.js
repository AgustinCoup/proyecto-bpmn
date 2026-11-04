'use strict';

/**
 * Validación del formulario del informe de resultados (tarea `Informe`).
 */

const MAX_SUMMARY = 5000;
const MAX_NOTES = 3000;
const MAX_ATTENDEES = 10000;

// Quita caracteres de control (salvo salto de línea y tabulación).
function clean(value) {
  return String(value === undefined || value === null ? '' : value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function parseReportForm(body = {}) {
  const values = {
    resumen: clean(body.resumen),
    asistentes: String(body.asistentes === undefined ? '' : body.asistentes).trim(),
    observaciones: clean(body.observaciones),
  };
  const errors = {};

  if (!values.resumen) errors.resumen = 'Escribí el resumen de resultados.';
  else if (values.resumen.length > MAX_SUMMARY) errors.resumen = `Máximo ${MAX_SUMMARY} caracteres.`;

  if (!/^\d{1,5}$/.test(values.asistentes) || Number(values.asistentes) > MAX_ATTENDEES) {
    errors.asistentes = `Ingresá un número entero entre 0 y ${MAX_ATTENDEES}.`;
  }

  if (values.observaciones.length > MAX_NOTES) errors.observaciones = `Máximo ${MAX_NOTES} caracteres.`;

  const valid = Object.keys(errors).length === 0;
  return {
    values,
    errors,
    valid,
    report: valid
      ? {
        resumen: values.resumen,
        asistentes: Number(values.asistentes),
        observaciones: values.observaciones,
      }
      : null,
  };
}

module.exports = { MAX_ATTENDEES, MAX_NOTES, MAX_SUMMARY, parseReportForm };
