'use strict';

/**
 * Contexto extra de la tarea `Revisar`.
 *
 * La empresa pide cambios con el mensaje "Solicitud de modificaciones", que
 * deja `observaciones` como variable de la instancia. El administrativo ajusta
 * la propuesta en la tabla `curso` y, al completar la tarea, el task listener
 * del modelo incrementa `propuestaVersion`. El sitio solo muestra esos datos;
 * no los envía de vuelta a Flowable.
 */

const MAX_OBSERVATIONS = 2000;
const MAX_VERSION = 1000000;

function readObservations(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text) return '';
  return text.length <= MAX_OBSERVATIONS ? text : `${text.slice(0, MAX_OBSERVATIONS)}…`;
}

function readVersion(value) {
  const version = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(version) || version < 1 || version >= MAX_VERSION) return null;
  return version;
}

function valueGetter(variables) {
  if (variables && typeof variables.get === 'function') {
    return (name) => variables.get(name);
  }
  return (name) => (variables ? variables[name] : undefined);
}

function reviewContext(variables) {
  const get = valueGetter(variables);
  const version = readVersion(get('propuestaVersion'));
  return {
    observations: readObservations(get('observaciones')),
    version,
    nextVersion: version === null ? null : version + 1,
  };
}

module.exports = {
  MAX_OBSERVATIONS,
  readObservations,
  readVersion,
  reviewContext,
};
