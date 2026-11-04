const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { flowableRest } = require('../lib/flowable');
const { validarLogin } = require('../lib/validators');
const { verifyCsrf } = require('../lib/middleware');
const { nombreActividad } = require('../lib/actividades');
const config = require('../lib/config');

// Limitador de intentos de login en memoria.
const attempts = new Map();
function loginAllowed(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec) return true;
  if (now - rec.first > config.loginWindowMs) { attempts.delete(ip); return true; }
  return rec.count < config.loginMaxAttempts;
}
function registerAttempt(ip, ok) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (ok) { attempts.delete(ip); return; }
  if (!rec || now - rec.first > config.loginWindowMs) {
    attempts.set(ip, { count: 1, first: now });
  } else {
    rec.count += 1;
  }
}

function requireEmpresa(req, res, next) {
  if (!req.session || !req.session.empresaId) {
    return res.redirect('/empresa/login');
  }
  next();
}

router.get('/login', (req, res) => {
  res.render('empresa-login', {
    title: 'Acceso empresas',
    error: null,
    csrfToken: req.session && req.session.csrfToken,
  });
});

router.post('/login', verifyCsrf, async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!loginAllowed(ip)) {
    return res.status(429).render('empresa-login', {
      title: 'Acceso empresas',
      error: 'Demasiados intentos. Intente mas tarde.',
      csrfToken: req.session && req.session.csrfToken,
    });
  }

  const { errors, data } = validarLogin(req.body);
  if (Object.keys(errors).length) {
    registerAttempt(ip, false);
    return res.status(400).render('empresa-login', {
      title: 'Acceso empresas',
      error: 'Credenciales invalidas.',
      csrfToken: req.session && req.session.csrfToken,
    });
  }

  try {
    const r = await db.query(
      'SELECT ce.empresa_id, ce.clave_hash, e.nombre FROM cuenta_empresa ce JOIN empresa e ON e.id = ce.empresa_id WHERE ce.usuario = $1',
      [data.usuario]
    );
    const row = r.rows[0];
    const ok = !!row && row.clave_hash === data.clave;
    if (!ok) {
      registerAttempt(ip, false);
      // error generico
      return res.status(401).render('empresa-login', {
        title: 'Acceso empresas',
        error: 'Usuario o clave incorrectos.',
        csrfToken: req.session && req.session.csrfToken,
      });
    }
    registerAttempt(ip, true);
    req.session.empresaId = row.empresa_id;
    req.session.empresaNombre = row.nombre;
    res.redirect('/empresa');
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).render('empresa-login', {
      title: 'Acceso empresas',
      error: 'Error interno.',
      csrfToken: req.session && req.session.csrfToken,
    });
  }
});

router.post('/logout', verifyCsrf, (req, res) => {
  if (req.session) {
    delete req.session.empresaId;
    delete req.session.empresaNombre;
  }
  res.redirect('/empresa/login');
});

// Helper: estado del curso segun instancia Flowable
async function estadoDeCurso(curso) {
  if (!curso.process_instance_id) return curso.estado || 'EN_PROCESO';
  // intentar instancia en ejecucion
  try {
    const r = await flowableRest('GET', `/runtime/process-instances/${curso.process_instance_id}/variables`, {
      auth: null, // use service? flowableRest defaults to config auth if null? we pass service
    });
    // flowableRest auth default uses config if undefined; passing null overrides? check: credentials = auth || config. null is falsy, so defaults. Good.
    const vars = Array.isArray(r.data) ? r.data : [];
    const v = vars.find((x) => x.name === 'estadoCurso');
    if (v && v.value !== null && v.value !== undefined) return String(v.value);
  } catch (e) {
    // instancia puede haber terminado; probar historic
  }
  // historico
  try {
    const r = await flowableRest('GET', '/history/historic-variable-instances', {
      query: { processInstanceId: curso.process_instance_id },
    });
    const data = r.data && r.data.data ? r.data.data : [];
    const v = data.find((x) => x.variableName === 'estadoCurso' || x.name === 'estadoCurso');
    if (v && v.value !== null && v.value !== undefined) return String(v.value);
  } catch (e) {
    // ignore
  }
  // fallback a curso.estado (puede ser resultado final)
  return curso.estado || 'EN_PROCESO';
}

async function actividadesDeCurso(processInstanceId) {
  const acts = new Set();
  try {
    const r = await flowableRest('GET', '/runtime/tasks', { query: { processInstanceId } });
    const tasks = (r.data && r.data.data) || [];
    for (const t of tasks) acts.add(nombreActividad(t.taskDefinitionKey || t.name));
  } catch (e) { /* ignore */ }
  try {
    const r = await flowableRest('GET', '/runtime/executions', { query: { processInstanceId } });
    const execs = (r.data && r.data.data) || [];
    for (const e of execs) {
      if (e.activityId) acts.add(nombreActividad(e.activityId));
    }
  } catch (e) { /* ignore */ }
  // quitar nulos/vacios
  return Array.from(acts).filter(Boolean);
}

router.get('/', requireEmpresa, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM curso WHERE empresa_id = $1 ORDER BY id DESC', [req.session.empresaId]);
    const cursos = [];
    for (const c of r.rows) {
      const estado = await estadoDeCurso(c);
      const actividades = c.process_instance_id ? await actividadesDeCurso(c.process_instance_id) : [];
      cursos.push({ ...c, estado, actividades });
    }
    res.render('empresa-dashboard', {
      title: 'Mis cursos',
      empresaNombre: req.session.empresaNombre,
      cursos,
      csrfToken: req.session.csrfToken,
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).send('Error interno.');
  }
});

router.get('/cursos/:id', requireEmpresa, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).send('No encontrado.');
  try {
    const r = await db.query('SELECT * FROM curso WHERE id = $1 AND empresa_id = $2', [id, req.session.empresaId]);
    if (!r.rows.length) return res.status(404).send('No encontrado.');
    const curso = r.rows[0];
    const estado = await estadoDeCurso(curso);
    const actividades = curso.process_instance_id ? await actividadesDeCurso(curso.process_instance_id) : [];
    res.render('empresa-detalle', {
      title: `Curso ${curso.id}`,
      curso,
      estado,
      actividades,
      csrfToken: req.session.csrfToken,
    });
  } catch (err) {
    console.error('Detalle error:', err.message);
    res.status(500).send('Error interno.');
  }
});

module.exports = router;
