// Configuracion por variables de entorno con defaults de desarrollo.
const env = process.env;

function bool(v, def = false) {
  if (v === undefined) return def;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

const config = {
  port: Number(env.PORT || 3000),
  nodeEnv: env.NODE_ENV || 'development',
  devMode: bool(env.DEV_MODE, true),
  flowableRestUrl: (env.FLOWABLE_REST_URL || 'http://localhost:8080/flowable-rest/service').replace(/\/$/, ''),
  institucionDbUrl: env.INSTITUCION_DB_URL || 'postgresql://institucion:institucion@localhost:5432/institucion',
  sessionSecret: env.SESSION_SECRET || 'dev-session-secret-change-me',
  flowableAuth: {
    usuario: env.FLOWABLE_SERVICE_USER || 'rest-admin',
    clave: env.FLOWABLE_SERVICE_PASS || 'test',
  },
  devPlazoRespuesta: env.PLAZO_RESPUESTA || '',
  devSimularFaltaAulas: bool(env.SIMULAR_FALTA_AULAS, false),
  loginMaxAttempts: Number(env.LOGIN_MAX_ATTEMPTS || 5),
  loginWindowMs: Number(env.LOGIN_WINDOW_MS || 15 * 60 * 1000),
};

if (config.nodeEnv === 'production' && !env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET es obligatorio en produccion.');
}

module.exports = config;
