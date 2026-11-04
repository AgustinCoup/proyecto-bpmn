'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ARCHIVE_TASK_KEY,
  archiveContext,
  isArchivable,
  readResult,
  resultLabel,
} = require('../archive');

test('readResult acepta códigos en mayúsculas y descarta el resto', () => {
  assert.equal(readResult('RECHAZADO'), 'RECHAZADO');
  assert.equal(readResult('  SIN_RESPUESTA  '), 'SIN_RESPUESTA');
  assert.equal(readResult('rechazado'), '');
  assert.equal(readResult('<script>'), '');
  assert.equal(readResult(''), '');
  assert.equal(readResult(null), '');
  assert.equal(readResult({ resultado: 'RECHAZADO' }), '');
  assert.equal(readResult(`X${'A'.repeat(40)}`), '');
});

test('isArchivable solo acepta los dos caminos de cierre', () => {
  assert.equal(isArchivable('RECHAZADO'), true);
  assert.equal(isArchivable('SIN_RESPUESTA'), true);
  assert.equal(isArchivable('FINALIZADO'), false);
  assert.equal(isArchivable(''), false);
  assert.equal(ARCHIVE_TASK_KEY, 'Archivar');
});

test('resultLabel traduce los resultados conocidos', () => {
  assert.match(resultLabel('RECHAZADO'), /rechazó/);
  assert.match(resultLabel('SIN_RESPUESTA'), /no respondió/);
  assert.match(resultLabel('OTRO'), /sin un resultado conocido/);
});

test('archiveContext lee un Map y tolera variables ausentes', () => {
  assert.deepEqual(archiveContext(new Map([['resultado', 'SIN_RESPUESTA']])), {
    result: 'SIN_RESPUESTA',
    resultLabel: 'La empresa no respondió después de dos recordatorios.',
    archivable: true,
  });

  assert.deepEqual(archiveContext({ resultado: 'RECHAZADO' }), {
    result: 'RECHAZADO',
    resultLabel: 'La empresa rechazó la propuesta.',
    archivable: true,
  });

  assert.deepEqual(archiveContext(null), {
    result: '',
    resultLabel: 'El proceso llegó a archivar sin un resultado conocido.',
    archivable: false,
  });
});
