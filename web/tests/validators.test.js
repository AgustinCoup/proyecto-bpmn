const test = require('node:test');
const assert = require('node:assert/strict');
const { validarCuit, validarEmail, validarCantidad, validarSolicitud, validarLogin } = require('../src/lib/validators');

test('validarCuit acepta CUIT valido con guiones', () => {
  assert.equal(validarCuit('20-12345678-6'), '20-12345678-6');
});

test('validarCuit rechaza CUIT invalido', () => {
  assert.equal(validarCuit('20-12345678-0'), null);
  assert.equal(validarCuit('abc'), null);
});

test('validarEmail valida formato', () => {
  assert.equal(validarEmail('a@b.com'), 'a@b.com');
  assert.equal(validarEmail('bad'), null);
});

test('validarCantidad exige entero > 0', () => {
  assert.equal(validarCantidad(5), 5);
  assert.equal(validarCantidad(0), null);
  assert.equal(validarCantidad(1.5), null);
});

test('validarSolicitud OK', () => {
  const { errors, data } = validarSolicitud({
    nombreEmpresa: 'Empresa SA',
    cuit: '20-12345678-6',
    contacto: 'Juan',
    email: 'j@e.com',
    cantidadParticipantes: 10,
    tematica: 'Tema',
    descripcion: 'Desc',
    fechasPreferidas: 'Diciembre',
  });
  assert.deepEqual(errors, {});
  assert.ok(data);
  assert.equal(data.cantidadParticipantes, 10);
});

test('validarSolicitud errores', () => {
  const { errors } = validarSolicitud({});
  assert.ok(errors.nombreEmpresa);
  assert.ok(errors.cuit);
  assert.ok(errors.email);
});

test('validarLogin', () => {
  assert.deepEqual(validarLogin({ usuario: 'u', clave: 'c' }).errors, {});
  assert.ok(validarLogin({ usuario: '', clave: '' }).errors.usuario);
});
