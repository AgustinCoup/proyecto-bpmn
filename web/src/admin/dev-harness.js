'use strict';

/**
 * Arnés local, SOLO para desarrollo y pruebas mientras no exista el esqueleto
 * del sitio (`web/app.js`, `web/src/lib/flowable.js`, layout EJS).
 *
 * No se entrega: cuando aparezca el esqueleto, este archivo y la carpeta
 * `dev/` se eliminan y el router se monta desde `web/app.js` en `/admin`.
 *
 * Uso:
 *   node web/src/admin/dev-harness.js
 *   PORT=3100 node web/src/admin/dev-harness.js
 */

require('./dev/register-deps');

const express = require('express');
const adminRouter = require('./index');
const docentesRouter = require('../docentes');

const app = express();
app.disable('x-powered-by');
app.use('/admin', adminRouter);
app.use('/docentes', docentesRouter);
app.get('/', (req, res) => res.redirect('/admin/'));

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => {
  console.log(`[admin] Arnés en http://localhost:${port}/admin/login y /docentes/login`);
  console.log(`[admin] Flowable: ${process.env.FLOWABLE_URL || 'http://localhost:8080/flowable-rest/service'}`);
});

server.on('error', (error) => {
  console.error(`[admin] No se pudo iniciar el arnés: ${error.message}`);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
