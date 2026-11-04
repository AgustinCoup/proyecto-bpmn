'use strict';

/**
 * Contexto de la tarea `Archivar`.
 *
 * A esta tarea se llega por dos caminos de cierre: la empresa rechazó la
 * propuesta (`RECHAZADO`) o no respondió después de dos recordatorios
 * (`SIN_RESPUESTA`). El resultado ya está en una variable de la instancia; el
 * sitio solo lo muestra y confirma el cierre. El estado del curso lo actualiza
 * el Execution Listener de fin de proceso.
 */

const ARCHIVE_TASK_KEY = 'Archivar';
const ARCHIVABLE_RESULTS = new Set(['RECHAZADO', 'SIN_RESPUESTA']);

const RESULT_LABELS = {
  RECHAZADO: 'La empresa rechazó la propuesta.',
  SIN_RESPUESTA: 'La empresa no respondió después de dos recordatorios.',
};

function readResult(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return /^[A-Z][A-Z0-9_]{0,39}$/.test(text) ? text : '';
}

function isArchivable(result) {
  return ARCHIVABLE_RESULTS.has(result);
}

function resultLabel(result) {
  return RESULT_LABELS[result] || 'El proceso llegó a archivar sin un resultado conocido.';
}

function readVariable(variables, name) {
  if (!variables) return undefined;
  if (typeof variables.get === 'function') return variables.get(name);
  return variables[name];
}

function archiveContext(variables) {
  const result = readResult(readVariable(variables, 'resultado'));
  return {
    result,
    resultLabel: resultLabel(result),
    archivable: isArchivable(result),
  };
}

module.exports = {
  ARCHIVABLE_RESULTS,
  ARCHIVE_TASK_KEY,
  archiveContext,
  isArchivable,
  readResult,
  resultLabel,
};
