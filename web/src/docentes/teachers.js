'use strict';

/**
 * Docentes disponibles para la tarea "Definir Docente que desarrolla el curso".
 * La lista sale de Flowable (miembros del grupo `docentes`) y la elección se
 * valida contra esa misma lista: no se acepta un id arbitrario del cliente.
 */

const TEACHER_GROUP = 'docentes';
const USER_ID_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

async function fetchTeachers(client, auth) {
  const response = await client('GET', '/identity/users', {
    query: { memberOfGroup: TEACHER_GROUP, size: 100 },
    auth,
  });
  const list = response && Array.isArray(response.data) ? response.data : [];
  return list
    .filter((user) => user && typeof user.id === 'string' && USER_ID_PATTERN.test(user.id))
    .map((user) => ({
      id: user.id,
      label: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.id,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function parseTeacherSelection(body = {}, teachers = []) {
  const chosen = typeof body.docenteSeleccionado === 'string' ? body.docenteSeleccionado.trim() : '';
  if (!chosen) return { valid: false, error: 'Elegí un docente.', value: '' };
  if (!teachers.some((teacher) => teacher.id === chosen)) {
    return { valid: false, error: 'El docente elegido no pertenece al grupo docentes.', value: chosen };
  }
  return { valid: true, error: '', value: chosen };
}

/** La tarea siguiente usa `${fechaCurso}`: sin ella Flowable responde 500 (Contrato §11.30). */
function hasCourseDate(variables) {
  const value = variables && typeof variables.get === 'function' ? variables.get('fechaCurso') : undefined;
  return typeof value === 'string' && value.trim().length > 0;
}

module.exports = {
  TEACHER_GROUP, fetchTeachers, hasCourseDate, parseTeacherSelection,
};
