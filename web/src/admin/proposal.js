'use strict';

/**
 * Validación del formulario de la tarea `Propuesta`.
 *
 * Los datos de la propuesta viven en la tabla `curso`, no como variables de
 * Flowable. El modelo solo guarda `propuestaVersion`, que lo setea el task
 * listener al completar la tarea.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONEY_PATTERN = /^\d{1,10}(?:[.,]\d{1,2})?$/;
const MAX_MONEY = 9999999999.99;

function readText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidDateOnly(value) {
  const match = DATE_PATTERN.exec(readText(value));
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2200) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function toDateInput(value) {
  if (!value) return '';
  if (typeof value === 'string' && DATE_PATTERN.test(value)) return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function emptyProposal() {
  return {
    nombre: '',
    programa: '',
    presupuesto: '',
    fecha_inicio: '',
    fecha_fin: '',
  };
}

function formValuesFromCourse(course = {}) {
  return {
    nombre: course.nombre || '',
    programa: course.programa || '',
    presupuesto: course.presupuesto === undefined || course.presupuesto === null
      ? ''
      : String(course.presupuesto),
    fecha_inicio: toDateInput(course.fecha_inicio),
    fecha_fin: toDateInput(course.fecha_fin),
  };
}

function parseProposal(body = {}) {
  const values = {
    nombre: readText(body.nombre),
    programa: readText(body.programa),
    presupuesto: readText(body.presupuesto),
    fecha_inicio: readText(body.fecha_inicio),
    fecha_fin: readText(body.fecha_fin),
  };
  const errors = {};

  if (!values.nombre) {
    errors.nombre = 'Ingresá el nombre del curso.';
  } else if (values.nombre.length > 200) {
    errors.nombre = 'El nombre no puede superar los 200 caracteres.';
  }

  if (!values.programa) {
    errors.programa = 'Ingresá el programa del curso.';
  } else if (values.programa.length > 5000) {
    errors.programa = 'El programa no puede superar los 5000 caracteres.';
  }

  if (!MONEY_PATTERN.test(values.presupuesto)) {
    errors.presupuesto = 'Ingresá un presupuesto mayor que cero, con hasta dos decimales.';
  } else {
    const amount = Number(values.presupuesto.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_MONEY) {
      errors.presupuesto = 'El presupuesto debe ser mayor que cero y entrar en el campo de la base.';
    }
  }

  if (!isValidDateOnly(values.fecha_inicio)) {
    errors.fecha_inicio = 'Ingresá una fecha de inicio válida.';
  }
  if (!isValidDateOnly(values.fecha_fin)) {
    errors.fecha_fin = 'Ingresá una fecha de fin válida.';
  }
  if (!errors.fecha_inicio && !errors.fecha_fin && values.fecha_fin <= values.fecha_inicio) {
    errors.fecha_fin = 'La fecha de fin tiene que ser posterior a la de inicio.';
  }

  const valid = Object.keys(errors).length === 0;
  return {
    values,
    errors,
    valid,
    proposal: valid
      ? {
        nombre: values.nombre,
        programa: values.programa,
        presupuesto: values.presupuesto.replace(',', '.'),
        fechaInicio: `${values.fecha_inicio}T00:00:00.000Z`,
        fechaFin: `${values.fecha_fin}T00:00:00.000Z`,
      }
      : null,
  };
}

module.exports = {
  emptyProposal,
  formValuesFromCourse,
  isValidDateOnly,
  parseProposal,
  toDateInput,
};
