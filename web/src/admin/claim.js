'use strict';

const { FlowableError } = require('./flowable-rest');
const {
  fetchTask, fetchIdentityLinks, canClaimTask, claimTask,
} = require('./tasks');

const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

function viewContext(req) {
  return {
    baseUrl: req.baseUrl || '',
    user: req.session ? req.session.user : null,
    groups: req.session ? req.session.groups : [],
    csrf: req.session ? req.session.csrfToken : null,
  };
}

/**
 * `POST /tasks/:id/claim`. Flowable no obliga a reclamar ni valida que la tarea
 * sea candidata del usuario, así que el sitio lo comprueba contra los
 * `identitylinks` antes de llamar al motor.
 */
function createClaimHandler({ client, store, views }) {
  return async (req, res) => {
    const taskId = req.params.id;
    const context = viewContext(req);

    if (!TASK_ID_PATTERN.test(taskId)) {
      return views.badRequest(res, 'El identificador de la tarea no es válido.', context);
    }

    const credentials = { user: req.session.user, password: req.session.password };
    const task = await fetchTask(client, credentials, taskId);

    if (task.assignee && task.assignee !== req.session.user) {
      return views.forbidden(res, 'La tarea ya está asignada a otra persona.', context);
    }

    if (task.assignee === req.session.user) {
      store.setFlash(req.session, 'ok', 'La tarea ya estaba asignada a vos.');
      return res.redirect(303, `${req.baseUrl || ''}/`);
    }

    const links = await fetchIdentityLinks(client, credentials, taskId);
    if (!canClaimTask(task, links, req.session.user, req.session.groups)) {
      return views.forbidden(
        res,
        'No podés reclamar esta tarea: no es candidata para tu usuario ni para tu grupo.',
        context,
      );
    }

    try {
      await claimTask(client, credentials, taskId);
    } catch (error) {
      if (error instanceof FlowableError && error.status === 409) {
        store.setFlash(req.session, 'error', 'Otra persona reclamó la tarea antes que vos.');
        return res.redirect(303, `${req.baseUrl || ''}/`);
      }
      throw error;
    }

    store.setFlash(req.session, 'ok', 'Tarea reclamada. Ahora está asignada a vos.');
    return res.redirect(303, `${req.baseUrl || ''}/`);
  };
}

module.exports = { TASK_ID_PATTERN, createClaimHandler, viewContext };
