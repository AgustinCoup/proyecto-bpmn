'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  emptyProposal,
  formValuesFromCourse,
  isValidDateOnly,
  parseProposal,
  toDateInput,
} = require('../proposal');

const VALID = {
  nombre: 'Curso de seguridad',
  programa: 'Módulo 1\nMódulo 2',
  presupuesto: '150000,50',
  fecha_inicio: '2026-12-01',
  fecha_fin: '2026-12-15',
};

test('parseProposal acepta datos válidos y normaliza presupuesto y fechas', () => {
  const parsed = parseProposal(VALID);

  assert.equal(parsed.valid, true);
  assert.deepEqual(parsed.errors, {});
  assert.deepEqual(parsed.proposal, {
    nombre: 'Curso de seguridad',
    programa: 'Módulo 1\nMódulo 2',
    presupuesto: '150000.50',
    fechaInicio: '2026-12-01T00:00:00.000Z',
    fechaFin: '2026-12-15T00:00:00.000Z',
  });
});

test('parseProposal exige los campos y valida el presupuesto', () => {
  const parsed = parseProposal({});

  assert.equal(parsed.valid, false);
  assert.equal(parsed.proposal, null);
  assert.match(parsed.errors.nombre, /nombre/);
  assert.match(parsed.errors.programa, /programa/);
  assert.match(parsed.errors.presupuesto, /presupuesto/);
  assert.match(parsed.errors.fecha_inicio, /inicio/);
  assert.match(parsed.errors.fecha_fin, /fin/);
});

test('parseProposal rechaza presupuestos y textos fuera de rango', () => {
  assert.match(parseProposal({ ...VALID, presupuesto: '0' }).errors.presupuesto, /mayor que cero/);
  assert.match(parseProposal({ ...VALID, presupuesto: '-10' }).errors.presupuesto, /presupuesto/);
  assert.match(parseProposal({ ...VALID, presupuesto: '12345678901' }).errors.presupuesto, /presupuesto/);
  assert.match(parseProposal({ ...VALID, presupuesto: '10.123' }).errors.presupuesto, /presupuesto/);
  assert.match(parseProposal({ ...VALID, nombre: 'x'.repeat(201) }).errors.nombre, /200/);
  assert.match(parseProposal({ ...VALID, programa: 'x'.repeat(5001) }).errors.programa, /5000/);
});

test('parseProposal valida fechas reales y el orden', () => {
  assert.match(
    parseProposal({ ...VALID, fecha_inicio: '2026-02-30' }).errors.fecha_inicio,
    /válida/,
  );
  assert.match(
    parseProposal({ ...VALID, fecha_inicio: '2026-12-15', fecha_fin: '2026-12-01' }).errors.fecha_fin,
    /posterior/,
  );
  assert.match(
    parseProposal({ ...VALID, fecha_inicio: '2026-12-15', fecha_fin: '2026-12-15' }).errors.fecha_fin,
    /posterior/,
  );
});

test('isValidDateOnly y toDateInput cubren formatos borde', () => {
  assert.equal(isValidDateOnly('2026-12-01'), true);
  assert.equal(isValidDateOnly('2026-2-1'), false);
  assert.equal(isValidDateOnly('1899-12-31'), false);
  assert.equal(isValidDateOnly(''), false);

  assert.equal(toDateInput('2026-12-01'), '2026-12-01');
  assert.equal(toDateInput('2026-12-01T00:00:00.000Z'), '2026-12-01');
  assert.equal(toDateInput(new Date('2026-12-01T12:00:00.000Z')), '2026-12-01');
  assert.equal(toDateInput('no-es-fecha'), '');
  assert.equal(toDateInput(null), '');
});

test('formValuesFromCourse prepara el formulario y emptyProposal queda vacío', () => {
  const values = formValuesFromCourse({
    nombre: 'Curso',
    programa: 'Programa',
    presupuesto: '1200.00',
    fecha_inicio: new Date('2026-12-01T00:00:00.000Z'),
    fecha_fin: '2026-12-20T00:00:00.000Z',
  });

  assert.deepEqual(values, {
    nombre: 'Curso',
    programa: 'Programa',
    presupuesto: '1200.00',
    fecha_inicio: '2026-12-01',
    fecha_fin: '2026-12-20',
  });
  assert.deepEqual(emptyProposal(), {
    nombre: '',
    programa: '',
    presupuesto: '',
    fecha_inicio: '',
    fecha_fin: '',
  });
  assert.equal(formValuesFromCourse({}).presupuesto, '');
});
