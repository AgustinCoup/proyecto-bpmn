'use strict';

const express = require('express');

const { FlowableError, createFlowableRest } = require('./flowable-rest');
const { createSessionStore } = require('./session');
const { createAuth } = require('./auth');
const { createViews } = require('./views');
const { fetchTasks } = require('./tasks');

const DEFAULT_CONFIG = {
  baseUrl: process.env.FLOWABLE_URL || 'http://localhost:8080/flowable-rest/service',
  timeoutMs: 10000,
  sessionSecret: process.env.SESSION_SECRET || null,
  sessionTtlMs: Number(process.env.SESSION_TTL_MS) || 8 * 60 * 60 * 1000,
  cookieName: 'admin_sid',
  cookieSecure: process.env.NODE_ENV === 'production',
  maxTasks: 100,
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
    res.status(200).send(views.home({ ...viewContext(req), tasks }));
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
