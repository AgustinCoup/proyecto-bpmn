'use strict';

/**
 * Informes de resultados (PDF) guardados en la tabla `informe` de la base de
 * la institución. Consultas parametrizadas; el alta es una sola sentencia
 * (inserta el informe y deja su id en `curso.informe_pdf`), así no puede
 * quedar un informe a medias.
 */

const { createPoolProvider } = require('./db');

const REPORT_ID_PATTERN = /^[1-9]\d{0,8}$/;

function createReportStore({ pool = null, connectionString } = {}) {
  const { getPool, close } = createPoolProvider({ pool, connectionString });

  async function save({ courseId, fileName, content, createdBy }) {
    const result = await getPool().query(
      `WITH nuevo AS (
         INSERT INTO informe (curso_id, nombre_archivo, contenido, creado_por)
         VALUES ($1, $2, $3, $4)
         RETURNING id
       ), curso_actualizado AS (
         UPDATE curso SET informe_pdf = (SELECT id FROM nuevo) WHERE id = $1
         RETURNING id
       )
       SELECT (SELECT id FROM nuevo) AS id
         FROM curso_actualizado`,
      [courseId, fileName, content, createdBy],
    );
    const row = result && Array.isArray(result.rows) ? result.rows[0] : null;
    return row ? Number(row.id) : null;
  }

  async function findById(reportId) {
    const result = await getPool().query(
      `SELECT id, curso_id, nombre_archivo, contenido
         FROM informe WHERE id = $1`,
      [reportId],
    );
    return result && Array.isArray(result.rows) ? result.rows[0] || null : null;
  }

  return { save, findById, close };
}

/** Valida el id que viene de la URL o de una variable de proceso. */
function parseReportId(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  return REPORT_ID_PATTERN.test(text) ? Number(text) : null;
}

/** Nombre de archivo derivado solo de números: nunca de texto del usuario. */
function reportFileName(courseId) {
  return `informe-curso-${Number(courseId)}.pdf`;
}

function isPdf(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length > 8
    && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

/** Responde con el PDF como descarga, con cabeceras que impiden ejecutarlo en línea. */
function sendReportPdf(res, report) {
  if (!report || !isPdf(report.contenido)) return false;
  res.status(200);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${reportFileName(report.curso_id)}"`,
  );
  res.setHeader('Content-Length', String(report.contenido.length));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.end(report.contenido);
  return true;
}

module.exports = {
  createReportStore,
  isPdf,
  parseReportId,
  reportFileName,
  sendReportPdf,
};
