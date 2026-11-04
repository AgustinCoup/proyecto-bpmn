'use strict';

const express = require('express');

const { FlowableError, createFlowableRest } = require('./flowable-rest');
const { createSessionStore } = require('./session');
const { createAuth } = require('./auth');
const { createViews } = require('./views');
const { createCourseStore } = require('./courses');
const { formValuesFromCourse, parseProposal } = require('./proposal');
const { reviewContext } = require('./review');
const { ARCHIVE_TASK_KEY, archiveContext } = require('./archive');
const {
  fetchTasks,
  fetchTask,
  fetchIdentityLinks,
  fetchProcessVariables,
  canClaimTask,
  claimTask,
  completeTask,
} = require('./tasks');

const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const COURSE_ID_PATTERN = /^[1-9]\d{0,8}$/;
const PROPOSAL_TASK_KEY = 'Propuesta';
const REVIEW_TASK_KEY = 'Revisar';
const PROPOSAL_FORM_TASKS = new Set([PROPOSAL_TASK_KEY, REVIEW_TASK_KEY]);

const DEFAULT_CONFIG = {
  baseUrl: process.env.FLOWABLE_URL || 'http://localhost:8080/flowable-rest/service',
  timeoutMs: 10000,
  sessionSecret: process.env.SESSION_SECRET || null,
  sessionTtlMs: Number(process.env.SESSION_TTL_MS) || 8 * 60 * 60 * 1000,
  cookieName: 'admin_sid',
  cookieSecure: process.env.NODE_ENV === 'production',
  maxTasks: 100,
  databaseUrl: process.env.INSTITUCION_DATABASE_URL || null,
};

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function viewContext(req) {
  return {
    baseUrl: req.baseUrl || '',
    user: req.session ? req.session.user : null,
    groups: req.session ? req.session.groups : [],
    csrf: req.session ? req.session.csrfToken : null,
  };
}

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

function createAdminRouter(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...(options.config || {}) };
  const client = options.client || createFlowableRest({
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
  });
  const store = options.sessions || createSessionStore({
    secret: config.sessionSecret,
    ttlMs: config.sessionTtlMs,
    cookieName: config.cookieName,
    secure: config.cookieSecure,
  });
  const courses = options.courses || createCourseStore({
    connectionString: config.databaseUrl || undefined,
  });
  const views = createViews(config);
  const auth = createAuth({ client, store, views });

  const router = express.Router();

  router.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(express.urlencoded({ extended: false, limit: '100kb' }));
  router.use(auth.loadSession);

  router.get('/login', auth.loginPage);
  router.post('/login', auth.csrf, asyncHandler(auth.login));
  router.post('/logout', auth.csrf, auth.logout);

  router.get('/', auth.requireAdmin, asyncHandler(async (req, res) => {
    const tasks = await fetchTasks(
      client,
      { user: req.session.user, password: req.session.password },
      ['administracion'],
      { max: config.maxTasks },
    );
    res.status(200).send(views.home({
      ...viewContext(req),
      tasks,
      flash: store.consumeFlash(req.session),
    }));
  }));

  router.post('/tasks/:id/claim', auth.requireAdmin, auth.csrf, asyncHandler(async (req, res) => {
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
  }));

  router.get('/tasks/:id', auth.requireAdmin, asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    const context = viewContext(req);

    if (!TASK_ID_PATTERN.test(taskId)) {
      return views.badRequest(res, 'El identificador de la tarea no es válido.', context);
    }

    const credentials = { user: req.session.user, password: req.session.password };
    const task = await fetchTask(client, credentials, taskId);

    if (task.assignee !== req.session.user) {
      return views.forbidden(
        res,
        'Esta tarea no está asignada a vos. Si está disponible para reclamar, hacelo desde la lista.',
        context,
      );
    }

    if (task.taskDefinitionKey === ARCHIVE_TASK_KEY) {
      const resolvedArchive = await resolveCourseForTask(client, credentials, task, courses);
      if (resolvedArchive.error === 'course-not-found') {
        return views.courseNotFound(res, context);
      }
      if (resolvedArchive.error) {
        return views.badRequest(res, 'El curso asociado a la tarea no es válido.', context);
      }

      const variables = await fetchProcessVariables(
        client,
        credentials,
        task.processInstanceId,
      );
      return res.status(200).send(views.archiveForm({
        ...context,
        task,
        course: resolvedArchive.course,
        ...archiveContext(variables),
      }));
    }

    if (!PROPOSAL_FORM_TASKS.has(task.taskDefinitionKey)) {
      return res.status(200).send(views.taskUnsupported({ ...context, task }));
    }

    const resolved = await resolveCourseForTask(client, credentials, task, courses);
    if (resolved.error === 'course-not-found') {
      return views.courseNotFound(res, context);
    }
    if (resolved.error) {
      return views.badRequest(res, 'El curso asociado a la tarea no es válido.', context);
    }

    const form = {
      ...context,
      task,
      course: resolved.course,
      values: formValuesFromCourse(resolved.course),
      errors: {},
    };

    if (task.taskDefinitionKey === REVIEW_TASK_KEY) {
      const variables = await fetchProcessVariables(
        client,
        credentials,
        task.processInstanceId,
      );
      return res.status(200).send(views.reviewForm({ ...form, ...reviewContext(variables) }));
    }

    return res.status(200).send(views.proposalForm(form));
  }));

  router.post('/tasks/:id/complete', auth.requireAdmin, auth.csrf, asyncHandler(async (req, res) => {
    const taskId = req.params.id;
    const context = viewContext(req);

    if (!TASK_ID_PATTERN.test(taskId)) {
      return views.badRequest(res, 'El identificador de la tarea no es válido.', context);
    }

    const credentials = { user: req.session.user, password: req.session.password };
    const task = await fetchTask(client, credentials, taskId);

    if (task.assignee !== req.session.user) {
      return views.forbidden(
        res,
        'Esta tarea no está asignada a vos. Si está disponible para reclamar, hacelo desde la lista.',
        context,
      );
    }

    const isArchive = task.taskDefinitionKey === ARCHIVE_TASK_KEY;
    if (!isArchive && !PROPOSAL_FORM_TASKS.has(task.taskDefinitionKey)) {
      return views.badRequest(
        res,
        'Esta tarea todavía no tiene formulario en el sitio.',
        context,
      );
    }

    const resolved = await resolveCourseForTask(client, credentials, task, courses);
    if (resolved.error === 'course-not-found') {
      return views.courseNotFound(res, context);
    }
    if (resolved.error) {
      return views.badRequest(res, 'El curso asociado a la tarea no es válido.', context);
    }

    if (isArchive) {
      const variables = await fetchProcessVariables(
        client,
        credentials,
        task.processInstanceId,
      );
      const archive = archiveContext(variables);
      if (!archive.archivable) {
        return res.status(409).send(views.archiveForm({
          ...context,
          task,
          course: resolved.course,
          ...archive,
        }));
      }

      try {
        await completeTask(client, credentials, taskId);
      } catch (error) {
        if (error instanceof FlowableError && error.status === 409) {
          store.setFlash(req.session, 'error', 'La tarea ya había sido completada.');
          return res.redirect(303, `${req.baseUrl || ''}/`);
        }
        throw error;
      }

      store.setFlash(req.session, 'ok', 'Solicitud archivada. El expediente quedó cerrado.');
      return res.redirect(303, `${req.baseUrl || ''}/`);
    }

    const isReview = task.taskDefinitionKey === REVIEW_TASK_KEY;

    const parsed = parseProposal(req.body);
    if (!parsed.valid) {
      const form = {
        ...context,
        task,
        course: resolved.course,
        values: parsed.values,
        errors: parsed.errors,
      };
      if (isReview) {
        const variables = await fetchProcessVariables(
          client,
          credentials,
          task.processInstanceId,
        );
        return res.status(400).send(views.reviewForm({ ...form, ...reviewContext(variables) }));
      }
      return res.status(400).send(views.proposalForm(form));
    }

    const saved = await courses.saveProposal(resolved.courseId, parsed.proposal);
    if (!saved) {
      return views.courseNotFound(res, context);
    }

    try {
      await completeTask(client, credentials, taskId);
    } catch (error) {
      if (error instanceof FlowableError && error.status === 409) {
        store.setFlash(
          req.session,
          'error',
          isReview
            ? 'La tarea ya había sido completada. Los cambios quedaron guardados en la base.'
            : 'La tarea ya había sido completada. La propuesta quedó guardada en la base.',
        );
        return res.redirect(303, `${req.baseUrl || ''}/`);
      }
      throw error;
    }

    store.setFlash(
      req.session,
      'ok',
      isReview
        ? 'Revisión guardada. La tarea se completó y se envió una nueva versión a la empresa.'
        : 'Propuesta guardada. La tarea se completó y el proceso continuó.',
    );
    return res.redirect(303, `${req.baseUrl || ''}/`);
  }));

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
      console.error(`[admin] Flowable respondió ${error.status}: ${error.message}`);
      return views.badGateway(
        res,
        'No se pudo consultar Flowable. Verificá que el servidor esté disponible e intentá de nuevo.',
        viewContext(req),
      );
    }

    console.error('[admin] Error inesperado:', error && error.stack ? error.stack : error);
    return views.error(res, 'Ocurrió un error inesperado.', viewContext(req));
  });

  return router;
}

const router = createAdminRouter();

module.exports = router;
module.exports.createAdminRouter = createAdminRouter;
