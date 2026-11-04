'use strict';

/**
 * Acceso a la base de la institución (tabla `curso`).
 *
 * Las consultas son parametrizadas y el pool se crea recién en el primer uso,
 * para que las pruebas y las pantallas que no tocan la base no necesiten `pg`.
 */

const { DEFAULT_DATABASE_URL, createPoolProvider } = require('./db');

const COURSE_COLUMNS = [
  'id',
  'empresa_id',
  'tematica',
  'descripcion',
  'cantidad_participantes',
  'fechas_preferidas',
  'nombre',
  'programa',
  'presupuesto',
  'fecha_inicio',
  'fecha_fin',
  'informe_pdf',
  'estado',
  'process_instance_id',
].join(', ');

function createCourseStore({ pool = null, connectionString = DEFAULT_DATABASE_URL } = {}) {
  const { getPool, close } = createPoolProvider({ pool, connectionString });

  async function findById(courseId) {
    const result = await getPool().query(
      `SELECT ${COURSE_COLUMNS} FROM curso WHERE id = $1`,
      [courseId],
    );
    return result && Array.isArray(result.rows) ? result.rows[0] || null : null;
  }

  async function saveProposal(courseId, proposal) {
    const result = await getPool().query(
      `UPDATE curso
          SET nombre = $2,
              programa = $3,
              presupuesto = $4,
              fecha_inicio = $5,
              fecha_fin = $6
        WHERE id = $1
        RETURNING ${COURSE_COLUMNS}`,
      [
        courseId,
        proposal.nombre,
        proposal.programa,
        proposal.presupuesto,
        proposal.fechaInicio,
        proposal.fechaFin,
      ],
    );
    return result && Array.isArray(result.rows) ? result.rows[0] || null : null;
  }

  return {
    findById,
    saveProposal,
    close,
  };
}

module.exports = {
  COURSE_COLUMNS,
  DEFAULT_DATABASE_URL,
  createCourseStore,
};
