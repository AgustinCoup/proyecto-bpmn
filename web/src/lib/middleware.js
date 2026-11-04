function ensureCsrf(req, res, next) {
  if (!req.session) return next();
  if (!req.session.csrfToken) {
    req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function verifyCsrf(req, res, next) {
  const token = (req.body && req.body._csrf) || req.headers['x-csrf-token'] || req.headers['csrf-token'];
  if (!token || token !== (req.session && req.session.csrfToken)) {
    return res.status(403).send('CSRF token invalido.');
  }
  next();
}

module.exports = { ensureCsrf, verifyCsrf };
