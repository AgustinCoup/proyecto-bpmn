'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_OBSERVATIONS,
  readObservations,
  readVersion,
  reviewContext,
} = require('../review');

test('readObservations normaliza texto y recorta observaciones largas', () => {
  assert.equal(readObservations('  Ajustar el presupuesto.\n  '), 'Ajustar el presupuesto.');
  assert.equal(readObservations(''), '');
  assert.equal(readObservations('   '), '');
  assert.equal(readObservations(null), '');
  assert.equal(readObservations(42), '');

  const long = 'a'.repeat(MAX_OBSERVATIONS + 10);
  const result = readObservations(long);
  assert.equal(result.length, MAX_OBSERVATIONS + 1);
  assert.ok(result.endsWith('…'));
});

test('readVersion solo acepta enteros positivos razonables', () => {
  assert.equal(readVersion(3), 3);
  assert.equal(readVersion('2'), 2);
  assert.equal(readVersion(0), null);
  assert.equal(readVersion(-1), null);
  assert.equal(readVersion(1.5), null);
  assert.equal(readVersion('abc'), null);
  assert.equal(readVersion(null), null);
  assert.equal(readVersion(1000000), null);
});

test('reviewContext lee un Map de variables del proceso', () => {
  const variables = new Map([
    ['observaciones', '  Cambiar fechas  '],
    ['propuestaVersion', 2],
  ]);
  assert.deepEqual(reviewContext(variables), {
    observations: 'Cambiar fechas',
    version: 2,
    nextVersion: 3,
  });
});

test('reviewContext tolera variables ausentes o sin versión válida', () => {
  assert.deepEqual(reviewContext(new Map()), {
    observations: '',
    version: null,
    nextVersion: null,
  });
  assert.deepEqual(reviewContext({ observaciones: 'Texto', propuestaVersion: 'x' }), {
    observations: 'Texto',
    version: null,
    nextVersion: null,
  });
  assert.deepEqual(reviewContext(null), {
    observations: '',
    version: null,
    nextVersion: null,
  });
});
