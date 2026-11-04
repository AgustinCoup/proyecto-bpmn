'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { COURSE_COLUMNS, createCourseStore } = require('../courses');

function fakePool({ rows = [] } = {}) {
  const queries = [];
  return {
    queries,
    async query(text, params) {
      queries.push({ text, params });
      return { rows };
    },
    async end() {
      this.ended = true;
    },
  };
}

test('findById usa SQL parametrizado y devuelve el curso', async () => {
  const pool = fakePool({ rows: [{ id: 7, tematica: 'Curso' }] });
  const store = createCourseStore({ pool });

  const course = await store.findById(7);

  assert.equal(course.id, 7);
  assert.equal(pool.queries.length, 1);
  assert.match(pool.queries[0].text, new RegExp(`SELECT ${COURSE_COLUMNS.replace(/, /g, ', ')} FROM curso`));
  assert.match(pool.queries[0].text, /WHERE id = \$1/);
  assert.deepEqual(pool.queries[0].params, [7]);
});

test('findById devuelve null si no existe el curso', async () => {
  const store = createCourseStore({ pool: fakePool({ rows: [] }) });
  assert.equal(await store.findById(99), null);
});

test('saveProposal actualiza solo los campos de la propuesta con parámetros', async () => {
  const pool = fakePool({ rows: [{ id: 7, nombre: 'Curso' }] });
  const store = createCourseStore({ pool });

  const saved = await store.saveProposal(7, {
    nombre: 'Curso',
    programa: 'Programa',
    presupuesto: '1500.00',
    fechaInicio: '2026-12-01T00:00:00.000Z',
    fechaFin: '2026-12-15T00:00:00.000Z',
  });

  assert.equal(saved.id, 7);
  assert.match(pool.queries[0].text, /UPDATE curso/);
  assert.match(pool.queries[0].text, /WHERE id = \$1/);
  assert.deepEqual(pool.queries[0].params, [
    7,
    'Curso',
    'Programa',
    '1500.00',
    '2026-12-01T00:00:00.000Z',
    '2026-12-15T00:00:00.000Z',
  ]);
});

test('saveProposal devuelve null si el curso desapareció', async () => {
  const store = createCourseStore({ pool: fakePool({ rows: [] }) });
  assert.equal(await store.saveProposal(7, {
    nombre: 'Curso',
    programa: 'Programa',
    presupuesto: '1.00',
    fechaInicio: '2026-12-01T00:00:00.000Z',
    fechaFin: '2026-12-02T00:00:00.000Z',
  }), null);
});

test('close no cierra un pool inyectado', async () => {
  const pool = fakePool();
  const store = createCourseStore({ pool });
  await store.close();
  assert.equal(pool.ended, undefined);
});
