'use strict';

/**
 * Nómina y lista definitiva de la tarea `Lista`.
 *
 * La empresa envía `participantes` como un array JSON de nombres (texto). El
 * administrativo revisa esa nómina y la guarda como lista definitiva en la
 * variable de proceso `listaDefinitiva`, también como JSON.
 *
 * Ojo: NO se llama `Lista definitiva` (el nombre del dataObject del modelo).
 * Esa variable es local al subproceso `Preparar` y desaparece cuando éste
 * termina, antes de que `Dictar` pueda leerla (verificado contra Flowable 6.8).
 * `listaDefinitiva` se crea en la instancia raíz y sobrevive.
 */

const FINAL_LIST_VARIABLE = 'listaDefinitiva';
const MAX_PARTICIPANTS = 500;
const MAX_PARTICIPANT_LENGTH = 200;

function normalizeList(items) {
  if (!Array.isArray(items)) return null;
  const list = items
    .filter((item) => typeof item === 'string' || typeof item === 'number')
    .map((item) => String(item).trim())
    .filter(Boolean);
  return list;
}

function parseParticipantes(value) {
  if (Array.isArray(value)) {
    const list = normalizeList(value);
    if (!list) return { list: [], error: 'La nómina recibida no es un array de nombres.' };
    if (list.length > MAX_PARTICIPANTS) {
      return {
        list: list.slice(0, MAX_PARTICIPANTS),
        error: `La nómina recibida supera los ${MAX_PARTICIPANTS} participantes; se muestran los primeros.`,
      };
    }
    return { list, error: list.length ? '' : 'La nómina recibida está vacía.' };
  }

  if (typeof value !== 'string' || !value.trim()) {
    return { list: [], error: 'La empresa no envió una nómina de participantes.' };
  }

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { list: [], error: 'La nómina recibida no es un JSON válido.' };
  }

  if (!Array.isArray(parsed)) {
    return { list: [], error: 'La nómina recibida no es un array de nombres.' };
  }
  return parseParticipantes(parsed);
}

function countParticipants(text) {
  if (typeof text !== 'string') return 0;
  return text.split(/\r?\n/).filter((line) => line.trim()).length;
}

function formValuesFromList(list) {
  return {
    participantes: (Array.isArray(list) ? list : []).join('\n'),
  };
}

function parseLista(body = {}) {
  const raw = typeof body.participantes === 'string' ? body.participantes : '';
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const errors = {};

  if (!lines.length) {
    errors.participantes = 'Ingresá al menos un participante, uno por línea.';
  } else if (lines.length > MAX_PARTICIPANTS) {
    errors.participantes = `La lista puede tener hasta ${MAX_PARTICIPANTS} participantes.`;
  } else if (lines.some((line) => line.length > MAX_PARTICIPANT_LENGTH)) {
    errors.participantes = `Cada participante puede tener hasta ${MAX_PARTICIPANT_LENGTH} caracteres.`;
  }

  const valid = Object.keys(errors).length === 0;
  return {
    values: { participantes: raw },
    errors,
    valid,
    list: valid ? lines : null,
  };
}

function serializeList(list) {
  return JSON.stringify(Array.isArray(list) ? list : []);
}

module.exports = {
  FINAL_LIST_VARIABLE,
  MAX_PARTICIPANT_LENGTH,
  MAX_PARTICIPANTS,
  countParticipants,
  formValuesFromList,
  normalizeList,
  parseLista,
  parseParticipantes,
  serializeList,
};
