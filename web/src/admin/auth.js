'use strict';

const { FlowableError } = require('./flowable-rest');

const ADMIN_GROUP = 'administracion';

function hasGroup(groups, group) {
  return Array.isArray(groups) && groups.includes(group);
}

function urlFor(req, suffix) {
  return `${req.baseUrl || ''}${suffix}`;
}

function contextFor(req) {
  return {
    baseUrl: req.baseUrl || '',
    user: req.session ? req.session.user : null,
    groups: req.session ? req.session.groups : [],
    csrf: req.session ? req.session.csrfToken : null,
  };
}

function createAuth({ client, store, views }) {
  function loadSession(req, res, next) {
    const sid = store.readSid(req);
    const session = sid ? store.get(sid) : null;
    req.sessionId = session ? sid : null;
    req.session = session;
    next();
  }

  function csrf(req, res, next) {
    if (!req.session) {
      return views.forbidden(res, 'La sesión no es válida o expiró. Volvé a iniciar sesión.', contextFor(req));
    }
    const token = (req.body && req.body._csrf) || req.get('x-csrf-token');
    if (!store.verifyCsrf(req.session, token)) {
      return views.forbidden(res, 'El token de seguridad no es válido. Recargá la página e intentá de nuevo.', contextFor(req));
    }
    return next();
  }

  function loginPage(req, res) {
    if (req.session && req.session.user && hasGroup(req.session.groups, ADMIN_GROUP)) {
      return res.redirect(303, urlFor(req, '/'));
    }

    const { session } = store.ensureAnonymous(req, res);
    return res.status(200).send(views.login({
      baseUrl: req.baseUrl || '',
      csrf: store.csrfToken(session),
      expired: req.query.expirada === '1',
      error: null,
    }));
  }

  async function login(req, res, next) {
    const usuario = String((req.body && req.body.usuario) || '').trim();
    const clave = String((req.body && req.body.clave) || '');
    const csrfToken = store.csrfToken(req.session);

    const showError = (status, message) => res.status(status).send(views.login({
      baseUrl: req.baseUrl || '',
      csrf: csrfToken,
      expired: false,
      error: message,
    }));

    if (!usuario || !clave) {
      return showError(400, 'Completá usuario y clave.');
    }
    if (usuario.length > 100 || clave.length > 200) {
      return showError(400, 'Usuario o clave demasiado largos.');
    }

    try {
      // Valida la clave contra Flowable con Basic Auth del propio usuario.
      await client('GET', `/identity/users/${encodeURIComponent(usuario)}`, {
        auth: { user: usuario, password: clave },
      });

      const groupsResponse = await client('GET', '/identity/groups', {
        query: { member: usuario, size: 100 },
        auth: { user: usuario, password: clave },
      });
      const groups = groupsResponse && Array.isArray(groupsResponse.data)
        ? groupsResponse.data.map((group) => group && group.id).filter(Boolean)
        : [];

      if (!hasGroup(groups, ADMIN_GROUP)) {
        return views.forbidden(
          res,
          'El usuario no pertenece al grupo administracion. Este módulo es solo para administración.',
          { baseUrl: req.baseUrl || '' },
        );
      }

      // Rotamos el id de sesión para evitar fijación de sesión.
      store.rotate(req, res, { user: usuario, password: clave, groups });
      return res.redirect(303, urlFor(req, '/'));
    } catch (error) {
      if (error instanceof FlowableError && [401, 403, 404].includes(error.status)) {
        return showError(401, 'Usuario o clave inválidos.');
      }
      return next(error);
    }
  }

  function logout(req, res) {
    const sid = store.readSid(req);
    if (sid) store.destroy(sid);
    store.clearCookie(res);
    return res.redirect(303, urlFor(req, '/login'));
  }

  function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user) {
      return res.redirect(303, urlFor(req, '/login'));
    }
    if (!hasGroup(req.session.groups, ADMIN_GROUP)) {
      return views.forbidden(res, 'No tenés permiso para acceder al módulo de administración.', contextFor(req));
    }
    return next();
  }

  return {
    loadSession,
    csrf,
    loginPage,
    login,
    logout,
    requireAdmin,
    hasGroup,
  };
}

module.exports = {
  ADMIN_GROUP,
  createAuth,
  hasGroup,
};
