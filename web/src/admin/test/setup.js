'use strict';

// Se carga antes que cualquier módulo que necesite express.
require('../dev/register-deps');

// Evita el warning del secreto aleatorio al construir el router por defecto
// durante las pruebas. Las pruebas que necesitan otro secreto lo inyectan.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-only-session-secret-0123456789';
