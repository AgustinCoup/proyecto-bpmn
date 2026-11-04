'use strict';

const express = require('express');

const { FlowableError, createFlowableRest } = require('./flowable-rest');
const { createSessionStore } = require('./session');
const { createAuth } = require('./auth');
const { TASK_ID_PATTERN, createClaimHandler, viewContext } = require('./claim');
const {
  asyncHandler, mountFallbacks, resolveCourseForTask, securityHeaders,
} = require('./router-common');
const { createViews } = require('./views');
const { createCourseStore } = require('./courses');
const { createReportStore, parseReportId, sendReportPdf } = require('./reports');
const { sendReportForm } = require('./views-report');
const { formValuesFromCourse, parseProposal } = require('./proposal');
const { reviewContext } = require('./review');
const { ARCHIVE_TASK_KEY, archiveContext } = require('./archive');
const {
  FINAL_LIST_VARIABLE, parseLista, parseParticipantes, serializeList, formValuesFromList,
} = require('./participants');
const { parseResources, resourceValuesFromVariables } = require('./resources');
const {
  fetchTasks,
  fetchTask,
  fetchProcessVariables,
  completeTask,
} = require('./tasks');

const PROPOSAL_TASK_KEY = 'Propuesta';
const REVIEW_TASK_KEY = 'Revisar';
const LIST_TASK_KEY = 'Lista';
const RESOURCE_TASK_KEY = 'Activity_12i2hpf';
const SEND_REPORT_TASK_KEY = 'EnviarInforme';
const REPORT_FILE_PATTERN = /^(\d{1,9})\.pdf$/;
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
  flowableUiUrl: process.env.FLOWABLE_UI_URL || 'http://localhost:8081/flowable-ui',
};

/** Id del informe guardado (variable `informePdf`) solo si existe en la base. */
async function findSavedReportId(client, auth, task, reports) {
  const variables = await fetchProcessVariables(client, auth, task.processInstanceId);
  const reportId = parseReportId(variables.get('informePdf'));
  if (!reportId) return null;
  const report = await reports.findById(reportId);
  return report ? reportId : null;
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
  const reports = options.reports || createReportStore({
    connectionString: config.databaseUrl || undefined,
  });
  const views = { ...createViews(config), sendReportForm };
  const auth = createAuth({ client, store, views });

  const router = express.Router();

  router.use(securityHeaders);
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

  router.get('/informes/:file', auth.requireAdmin, asyncHandler(async (req, res) => {
    const match = REPORT_FILE_PATTERN.exec(req.params.file);
    const reportId = match ? parseReportId(match[1]) : null;
    if (!reportId) return views.badRequest(res, 'El identificador del informe no es válido.', viewContext(req));
    const report = await reports.findById(reportId);
    if (!report || !sendReportPdf(res, report)) return views.notFound(res, viewContext(req));
    return undefined;
  }));

  router.post(
    '/tasks/:id/claim',
    auth.requireAdmin,
    auth.csrf,
    asyncHandler(createClaimHandler({ client, store, views })),
  );

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

    if (task.taskDefinitionKey === SEND_REPORT_TASK_KEY) {
      const resolvedReport = await resolveCourseForTask(client, credentials, task, courses);
      if (resolvedReport.error === 'course-not-found') return views.courseNotFound(res, context);
      if (resolvedReport.error) {
        return views.badRequest(res, 'El curso asociado a la tarea no es válido.', context);
      }
      const reportId = await findSavedReportId(client, credentials, task, reports);
      return res.status(200).send(views.sendReportForm({
        ...context,
        task,
        course: resolvedReport.course,
        reportId,
      }));
    }

    if (task.taskDefinitionKey === LIST_TASK_KEY || task.taskDefinitionKey === RESOURCE_TASK_KEY) {
      const variables = await fetchProcessVariables(
        client,
        credentials,
        task.processInstanceId,
      );
      if (task.taskDefinitionKey === LIST_TASK_KEY) {
        const parsed = parseParticipantes(variables.get('participantes'));
        return res.status(200).send(views.listForm({
          ...context,
          task,
          participants: parsed.list,
          participantsError: parsed.error,
          values: formValuesFromList(parsed.list),
        }));
      }
      return res.status(200).send(views.resourcesForm({
        ...context,
        task,
        values: resourceValuesFromVariables(variables),
      }));
    }

    if (!PROPOSAL_FORM_TASKS.has(task.taskDefinitionKey)) {
      return res.status(200).send(views.taskUnsupported({ ...context, task, flowableUiUrl: config.flowableUiUrl }));
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
    const isSendReport = task.taskDefinitionKey === SEND_REPORT_TASK_KEY;
    const isList = task.taskDefinitionKey === LIST_TASK_KEY;
    const isResources = task.taskDefinitionKey === RESOURCE_TASK_KEY;
    if (!isArchive && !isSendReport && !isList && !isResources && !PROPOSAL_FORM_TASKS.has(task.taskDefinitionKey)) {
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

    if (isSendReport) {
      const reportId = await findSavedReportId(client, credentials, task, reports);
      if (!reportId) {
        return res.status(409).send(views.sendReportForm({
          ...context, task, course: resolved.course, reportId: null,
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
      store.setFlash(req.session, 'ok', 'Informe enviado a la empresa. El expediente quedó archivado.');
      return res.redirect(303, `${req.baseUrl || ''}/`);
    }

    if (isList || isResources) {
      const parsed = isList ? parseLista(req.body) : parseResources(req.body);
      if (!parsed.valid) {
        if (isList) {
          const variables = await fetchProcessVariables(
            client,
            credentials,
            task.processInstanceId,
          );
          const source = parseParticipantes(variables.get('participantes'));
          return res.status(400).send(views.listForm({
            ...context,
            task,
            participants: source.list,
            participantsError: source.error,
            values: parsed.values,
            errors: parsed.errors,
          }));
        }
        return res.status(400).send(views.resourcesForm({
          ...context,
          task,
          values: parsed.values,
          errors: parsed.errors,
        }));
      }

      const processVariables = isList
        ? { [FINAL_LIST_VARIABLE]: serializeList(parsed.list) }
        : parsed.resources;
      try {
        await completeTask(client, credentials, taskId, processVariables);
      } catch (error) {
        if (error instanceof FlowableError && error.status === 409) {
          store.setFlash(req.session, 'error', 'La tarea ya había sido completada.');
          return res.redirect(303, `${req.baseUrl || ''}/`);
        }
        throw error;
      }

      store.setFlash(
        req.session,
        'ok',
        isList ? 'Lista definitiva guardada. La tarea se completó.' : 'Recursos guardados. La tarea se completó.',
      );
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

  mountFallbacks(router, { store, views, label: 'admin' });

  return router;
}

const router = createAdminRouter();

module.exports = router;
module.exports.createAdminRouter = createAdminRouter;
