'use strict';

// El arnés y sus pruebas viven dentro de web/src/admin/, fuera de web/node_modules
// (el esqueleto todavía no existe). Este archivo agrega la carpeta de
// dependencias locales al NODE_PATH para que `require('express')` funcione.
const path = require('node:path');
const Module = require('node:module');

const deps = path.join(__dirname, 'node_modules');
const current = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
if (!current.includes(deps)) {
  process.env.NODE_PATH = [deps, ...current].join(path.delimiter);
  Module._initPaths();
}
