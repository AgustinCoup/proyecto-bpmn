const test = require('node:test');
const assert = require('node:assert/strict');
const { validarCuit, validarEmail, validarCantidad, validarSolicitud, validarLogin } = require('../src/lib/validators');

test('validarCuit acepta CUIT valido con guiones', () => {
  assert.equal(validarCuit('20-12345678-6'), '20-12345678-6');
});

test('validarCuit acepta CUIT sin guiones, con puntos o espacios', () => {
  assert.equal(validarCuit('20123456786'), '20-12345678-6');
  assert.equal(validarCuit('20.12345678.6'), '20-12345678-6');
  assert.equal(validarCuit('20 12345678 6'), '20-12345678-6');
});

test('validarCuit aplica DV 9 cuando el modulo 11 da 10', () => {
  // 11 - (suma % 11) = 10 -> el digito verificador valido es 9.
  assert.equal(validarCuit('20-10000005-9'), '20-10000005-9');
});

test('validarCuit acepta los CUIT de los datos de prueba', () => {
  assert.equal(validarCuit('30-71122334-3'), '30-71122334-3');
  assert.equal(validarCuit('30-72233445-7'), '30-72233445-7');
});

test('validarCuit rechaza CUIT invalido', () => {
  assert.equal(validarCuit('20-12345678-0'), null);
  assert.equal(validarCuit('20-10000005-0'), null);
  assert.equal(validarCuit('30-71122334-5'), null);
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
