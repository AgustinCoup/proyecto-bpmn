'use strict';

/**
 * Pool de `pg` creado en el primer uso, compartido por los almacenes de
 * `curso` e `informe`. Así las pantallas que no tocan la base (y las pruebas)
 * no necesitan `pg`.
 */

const DEFAULT_DATABASE_URL = process.env.INSTITUCION_DATABASE_URL
  || process.env.DATABASE_URL
  || 'postgresql://institucion:institucion@localhost:5432/institucion';

function createPoolProvider({ pool = null, connectionString = DEFAULT_DATABASE_URL } = {}) {
  let activePool = pool;
  let ownsPool = false;

  function getPool() {
    if (activePool) return activePool;

    let pg;
    try {
      pg = require('pg');
    } catch {
      throw new Error('Falta la dependencia "pg" para acceder a la base institucion.');
    }

    activePool = new pg.Pool({ connectionString, max: 4 });
    ownsPool = true;
    return activePool;
  }

  async function close() {
    if (!ownsPool || !activePool || typeof activePool.end !== 'function') return;
    const poolToClose = activePool;
    activePool = null;
    ownsPool = false;
    await poolToClose.end();
  }

  return { getPool, close };
}

module.exports = { DEFAULT_DATABASE_URL, createPoolProvider };
