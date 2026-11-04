// Borra todas las instancias ACTIVAS de Process_Curso (cuentan para el límite de 5 de la regla de viabilidad).
// No toca los despliegues. Uso: node scripts/escenarios/m-limpiar-instancias.js
const J = require('./proceso');
J.limpiarActivas('limpieza').catch((e) => { console.error(e); process.exit(1); });
