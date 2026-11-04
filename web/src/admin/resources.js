'use strict';

const RESOURCE_VARIABLES = [
  'requiereAula',
  'requierePlataforma',
  'requiereEquipamiento',
];

function readBoolean(value) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

function resourceValuesFromVariables(variables) {
  const get = variables && typeof variables.get === 'function'
    ? (name) => variables.get(name)
    : (name) => (variables ? variables[name] : undefined);
  return Object.fromEntries(RESOURCE_VARIABLES.map((name) => [name, readBoolean(get(name))]));
}

function parseResources(body = {}) {
  const values = Object.fromEntries(
    RESOURCE_VARIABLES.map((name) => [name, readBoolean(body[name])]),
  );
  const errors = {};
  if (!RESOURCE_VARIABLES.some((name) => values[name])) {
    errors.resources = 'Seleccioná al menos un recurso.';
  }
  return {
    values,
    errors,
    valid: Object.keys(errors).length === 0,
    resources: values,
  };
}

module.exports = {
  RESOURCE_VARIABLES,
  parseResources,
  readBoolean,
  resourceValuesFromVariables,
};
