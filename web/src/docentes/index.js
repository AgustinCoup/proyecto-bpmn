'use strict';

/**
 * Módulo de equipo docente (`/docentes`).
 *
 * Reutiliza la infraestructura de `admin/` (cliente REST, sesión firmada, CSRF,
 * reclamo, vistas) con el grupo `docentes`. Tareas que cubre:
 *   - Activity_1018bdz  Definir Docente que desarrolla el curso   (jefeDocente)
 *   - Dictar            Desarrollar curso                         (docente asignado)
 *   - Informe           Elaborar informe de resultados + PDF      (jefeDocente)
 */

const express = require('express');

const { FlowableError, createFlowableRest } = require('../admin/flowable-rest');
const { createSessionStore } = require('../admin/session');
const { createAuth } = require('../admin/auth');
const { TASK_ID_PATTERN, createClaimHandler, viewContext } = require('../admin/claim');
const {
  asyncHandler, mountFallbacks, resolveCourseForTask, securityHeaders,
} = require('../admin/router-common');
const { createViews } = require('../admin/views');
const { createCourseStore } = require('../admin/courses');
const {
  createReportStore, parseReportId, reportFileName, sendReportPdf,
} = require('../admin/reports');
const { FINAL_LIST_VARIABLE, parseParticipantes } = require('../admin/participants');
const { parseReportForm } = require('../admin/report');
const { buildReportPdf } = require('../admin/pdf');
const {
  fetchTasks, fetchTask, fetchProcessVariables, completeTask,
} = require('../admin/tasks');
const {
  TEACHER_GROUP, fetchTeachers, hasCourseDate, parseTeacherSelection,
} = require('./teachers');
const {
  APP_NAME, dictarForm, reportForm, selectTeacherForm,
} = require('./views');

const SELECT_TEACHER_KEY = 'Activity_1018bdz';
const DICTAR_KEY = 'Dictar';
const REPORT_KEY = 'Informe';
const SUPPORTED_TASKS = new Set([SELECT_TEACHER_KEY, DICTAR_KEY, REPORT_KEY]);
const REPORT_FILE_PATTERN = /^(\d{1,9})\.pdf$/;

const DEFAULT_CONFIG = {
  baseUrl: process.env.FLOWABLE_REST_URL || process.env.FLOWABLE_URL || 'http://localhost:8080/flowable-rest/service',
  timeoutMs: 10000,
  sessionSecret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-session-secret-change-me'),
  sessionTtlMs: Number(process.env.SESSION_TTL_MS) || 8 * 60 * 60 * 1000,
  cookieName: 'docente_sid',
  cookieSecure: process.env.NODE_ENV === 'production',
  maxTasks: 100,
  databaseUrl: process.env.INSTITUCION_DB_URL || process.env.INSTITUCION_DATABASE_URL || null,
  appName: APP_NAME,
  moduleName: 'equipo docente',
};

/** Lista definitiva si está; si no, la nómina original de la empresa. */
function readParticipants(variables) {
  const final = parseParticipantes(variables.get(FINAL_LIST_VARIABLE));
  if (!final.error && final.list.length) return final.list;
  return parseParticipantes(variables.get('participantes')).list;
}

function readTeacher(variables) {
  const value = variables.get('docenteSeleccionado');
  return typeof value === 'string' ? value.slice(0, 100) : '';
}

function createDocentesRouter(options = {}) {
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
  const views = createViews(config);
  const auth = createAuth({
    client, store, views, group: TEACHER_GROUP, moduleName: config.moduleName,
  });
  const requireTeacher = auth.requireGroup;
  const makeCredentials = (req) => ({ user: req.session.user, password: req.session.password });

  /** Carga la tarea y exige que sea del usuario y que el sitio la soporte. */
  async function loadOwnTask(req, res, { requireSupported }) {
    const context = viewContext(req);
    const taskId = req.params.id;
    if (!TASK_ID_PATTERN.test(taskId)) {
      views.badRequest(res, 'El identificador de la tarea no es válido.', context);
      return null;
    }
    const credentials = makeCredentials(req);
    const task = await fetchTask(client, credentials, taskId);
    if (task.assignee !== req.session.user) {
      views.forbidden(
        res,
        'Esta tarea no está asignada a vos. Si está disponible para reclamar, hacelo desde la lista.',
        context,
      );
      return null;
    }
    if (requireSupported && !SUPPORTED_TASKS.has(task.taskDefinitionKey)) {
      views.badRequest(res, 'Esta tarea todavía no tiene formulario en el sitio.', context);
      return null;
    }
    return { task, credentials, context, taskId };
  }

  async function resolveCourse(res, ctx, task) {
    const resolved = await resolveCourseForTask(client, ctx.credentials, task, courses);
    if (resolved.error === 'course-not-found') {
      views.courseNotFound(res, ctx.context);
      return null;
    }
    if (resolved.error) {
      views.badRequest(res, 'El curso asociado a la tarea no es válido.', ctx.context);
      return null;
    }
    return resolved;
  }

  async function finish(req, res, work, okMessage) {
    try {
      await work();
    } catch (error) {
      if (error instanceof FlowableError && error.status === 409) {
        store.setFlash(req.session, 'error', 'La tarea ya había sido completada.');
        return res.redirect(303, `${req.baseUrl || ''}/`);
      }
      throw error;
    }
    store.setFlash(req.session, 'ok', okMessage);
    return res.redirect(303, `${req.baseUrl || ''}/`);
  }

  const router = express.Router();
  router.use(securityHeaders);
  router.use(express.urlencoded({ extended: false, limit: '100kb' }));
  router.use(auth.loadSession);

  router.get('/login', auth.loginPage);
  router.post('/login', auth.csrf, asyncHandler(auth.login));
  router.post('/logout', auth.csrf, auth.logout);

  router.get('/', requireTeacher, asyncHandler(async (req, res) => {
    const tasks = await fetchTasks(client, makeCredentials(req), [TEACHER_GROUP], { max: config.maxTasks });
    res.status(200).send(views.home({
      ...viewContext(req),
      tasks,
      flash: store.consumeFlash(req.session),
    }));
  }));

  router.post('/tasks/:id/claim', requireTeacher, auth.csrf, asyncHandler(createClaimHandler({ client, store, views })));

  router.get('/informes/:file', requireTeacher, asyncHandler(async (req, res) => {
    const match = REPORT_FILE_PATTERN.exec(req.params.file);
    const reportId = match ? parseReportId(match[1]) : null;
    if (!reportId) return views.badRequest(res, 'El identificador del informe no es válido.', viewContext(req));
    const report = await reports.findById(reportId);
    if (!report || !sendReportPdf(res, report)) return views.notFound(res, viewContext(req));
    return undefined;
  }));

  router.get('/tasks/:id', requireTeacher, asyncHandler(async (req, res) => {
    const ctx = await loadOwnTask(req, res, { requireSupported: false });
    if (!ctx) return undefined;
    const { task, credentials, context } = ctx;

    if (!SUPPORTED_TASKS.has(task.taskDefinitionKey)) {
      return res.status(200).send(views.taskUnsupported({ ...context, task }));
    }
    const resolved = await resolveCourse(res, ctx, task);
    if (!resolved) return undefined;
    const variables = await fetchProcessVariables(client, credentials, task.processInstanceId);

    if (task.taskDefinitionKey === SELECT_TEACHER_KEY) {
      const teachers = await fetchTeachers(client, credentials);
      return res.status(200).send(selectTeacherForm({
        ...context, task, course: resolved.course, teachers, hasDate: hasCourseDate(variables),
      }));
    }
    if (task.taskDefinitionKey === DICTAR_KEY) {
      return res.status(200).send(dictarForm({
        ...context, task, course: resolved.course, participants: readParticipants(variables),
      }));
    }
    return res.status(200).send(reportForm({
      ...context,
      task,
      course: resolved.course,
      teacher: readTeacher(variables),
      participants: readParticipants(variables),
    }));
  }));

  router.post('/tasks/:id/complete', requireTeacher, auth.csrf, asyncHandler(async (req, res) => {
    const ctx = await loadOwnTask(req, res, { requireSupported: true });
    if (!ctx) return undefined;
    const { task, credentials, context, taskId } = ctx;
    const resolved = await resolveCourse(res, ctx, task);
    if (!resolved) return undefined;
    const variables = await fetchProcessVariables(client, credentials, task.processInstanceId);

    if (task.taskDefinitionKey === SELECT_TEACHER_KEY) {
      const teachers = await fetchTeachers(client, credentials);
      const selection = parseTeacherSelection(req.body, teachers);
      const hasDate = hasCourseDate(variables);
      if (!hasDate || !selection.valid) {
        return res.status(hasDate ? 400 : 409).send(selectTeacherForm({
          ...context,
          task,
          course: resolved.course,
          teachers,
          hasDate,
          selected: selection.value,
          error: selection.error,
        }));
      }
      return finish(
        req,
        res,
        () => completeTask(client, credentials, taskId, { docenteSeleccionado: selection.value }),
        `Docente asignado: ${selection.value}. El curso quedó en manos de esa persona.`,
      );
    }

    if (task.taskDefinitionKey === DICTAR_KEY) {
      return finish(
        req,
        res,
        () => completeTask(client, credentials, taskId),
        'Curso dictado. Falta elaborar el informe de resultados.',
      );
    }

    const parsed = parseReportForm(req.body);
    const participants = readParticipants(variables);
    const teacher = readTeacher(variables);
    if (!parsed.valid) {
      return res.status(400).send(reportForm({
        ...context,
        task,
        course: resolved.course,
        teacher,
        participants,
        values: parsed.values,
        errors: parsed.errors,
      }));
    }

    const pdf = await buildReportPdf({
      course: resolved.course, teacher, participants, report: parsed.report,
    });
    const reportId = await reports.save({
      courseId: resolved.courseId,
      fileName: reportFileName(resolved.courseId),
      content: pdf,
      createdBy: req.session.user,
    });
    if (!reportId) return views.courseNotFound(res, context);

    return finish(
      req,
      res,
      () => completeTask(client, credentials, taskId, { informePdf: reportId }),
      `Informe guardado (PDF n.º ${reportId}). Pasó a administración para enviarlo a la empresa.`,
    );
  }));

  mountFallbacks(router, { store, views, label: 'docentes' });
  return router;
}

const router = createDocentesRouter();

module.exports = router;
module.exports.createDocentesRouter = createDocentesRouter;
