const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./lib/config');
const { ensureCsrf } = require('./lib/middleware');
const db = require('./lib/db');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  name: 'sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  },
}));
app.use(ensureCsrf);

// archivos estaticos
app.use(express.static(path.join(__dirname, 'public')));

// limitador basico global
app.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

// rutas propias
app.use('/', require('./publico'));
app.use('/empresa', require('./empresa'));

// rutas de otros (si existen)
try {
  app.use('/admin', require('./admin'));
} catch (e) {
  // modulo no presente aun
}
try {
  app.use('/docentes', require('./docentes'));
} catch (e) {
  // modulo no presente aun
}

// 404
app.use((req, res) => {
  res.status(404).send('No encontrado.');
});

// error handler
app.use((err, req, res, next) => {
  console.error('Error:', err && err.message ? err.message : err);
  res.status(500).send('Error interno del servidor.');
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Web institucion escuchando en http://localhost:${config.port}`);
  });
}

module.exports = app;
