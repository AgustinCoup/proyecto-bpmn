'use strict';

const { FlowableError } = require('./flowable-rest');
const { viewContext } = require('./claim');

const COURSE_ID_PATTERN = /^[1-9]\d{0,8}$/;

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/** Curso de la institución al que pertenece la tarea (businessKey de la instancia). */
async function resolveCourseForTask(client, auth, task, courses) {
  if (!task.processInstanceId) return { error: 'invalid-course-id' };

  const instance = await client(
    'GET',
    `/runtime/process-instances/${encodeURIComponent(task.processInstanceId)}`,
    { auth },
  );
  const rawKey = instance && instance.businessKey !== undefined && instance.businessKey !== null
    ? String(instance.businessKey).trim()
    : '';
  if (!COURSE_ID_PATTERN.test(rawKey)) return { error: 'invalid-course-id' };

  const courseId = Number(rawKey);
  const course = await courses.findById(courseId);
  if (!course) return { error: 'course-not-found' };

  return { courseId, course };
}

/** Responde con la página de error que corresponde al resultado de `resolveCourseForTask`. */
function courseProblem(res, views, resolved, context) {
  if (resolved.error === 'course-not-found') return views.courseNotFound(res, context);
  return views.badRequest(res, 'El curso asociado a la tarea no es válido.', context);
}

/** 404 y manejador de errores común; se monta al final del router. */
function mountFallbacks(router, { store, views, label }) {
  router.use((req, res) => views.notFound(res, viewContext(req)));

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    if (error instanceof FlowableError) {
      if (error.status === 401) {
        const sid = store.readSid(req);
        if (sid) store.destroy(sid);
        store.clearCookie(res);
        return res.redirect(303, `${req.baseUrl || ''}/login?expirada=1`);
      }
      if (error.status === 404) {
        return views.taskNotFound(res, viewContext(req));
      }
      console.error(`[${label}] Flowable respondió ${error.status}: ${error.message}`);
      return views.badGateway(
        res,
        'No se pudo consultar Flowable. Verificá que el servidor esté disponible e intentá de nuevo.',
        viewContext(req),
      );
    }

    console.error(`[${label}] Error inesperado:`, error && error.stack ? error.stack : error);
    return views.error(res, 'Ocurrió un error inesperado.', viewContext(req));
  });
}

module.exports = {
  COURSE_ID_PATTERN,
  asyncHandler,
  courseProblem,
  mountFallbacks,
  resolveCourseForTask,
  securityHeaders,
};
