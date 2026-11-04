const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { flowableRest } = require('../lib/flowable');
const { validarSolicitud } = require('../lib/validators');
const config = require('../lib/config');
const { verifyCsrf } = require('../lib/middleware');

function devAllowed(req) {
  return config.devMode || req.query.dev === '1' || req.query.modo === 'dev';
}

router.get('/', (req, res) => {
  res.render('home', { title: 'Inicio', csrfToken: req.session && req.session.csrfToken });
});

router.get('/solicitar', (req, res) => {
  res.render('solicitar', {
    title: 'Solicitar curso',
    errors: {},
    form: {},
    csrfToken: req.session && req.session.csrfToken,
    devMode: devAllowed(req),
  });
});

router.post('/solicitar', verifyCsrf, async (req, res) => {
  const { errors, data } = validarSolicitud(req.body);
  const form = req.body || {};
  if (Object.keys(errors).length) {
    return res.status(400).render('solicitar', {
      title: 'Solicitar curso',
      errors,
      form,
      csrfToken: req.session && req.session.csrfToken,
      devMode: devAllowed(req),
    });
  }

  const allowed = devAllowed(req);
  let plazoRespuesta = null;
  if (allowed) {
    plazoRespuesta = (req.body.plazoRespuesta && String(req.body.plazoRespuesta).trim()) || config.devPlazoRespuesta || null;
  }
  let simularFaltaAulas = false;
  if (allowed) {
    if (req.body.simularFaltaAulas === 'true') simularFaltaAulas = true;
    else if (config.devSimularFaltaAulas) simularFaltaAulas = true;
  }

  try {
    const cursoId = await db.withTransaction(async (client) => {
      // buscar o crear empresa
      let empresaId;
      const r = await client.query('SELECT id FROM empresa WHERE cuit = $1', [data.cuit]);
      if (r.rows.length) {
        empresaId = r.rows[0].id;
      } else {
        const ins = await client.query(
          'INSERT INTO empresa (nombre, cuit, contacto_nombre, contacto_email, contacto_telefono) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [data.nombreEmpresa, data.cuit, data.contacto, data.email, data.telefono]
        );
        empresaId = ins.rows[0].id;
      }

      const cursoRes = await client.query(
        `INSERT INTO curso (empresa_id, tematica, descripcion, cantidad_participantes, fechas_preferidas, estado)
         VALUES ($1,$2,$3,$4,$5,'EN_PROCESO') RETURNING id`,
        [empresaId, data.tematica, data.descripcion, data.cantidadParticipantes, data.fechasPreferidas]
      );
      const newCursoId = cursoRes.rows[0].id;

      // iniciar instancia en Flowable
      const variables = [
        { name: 'cursoId', value: newCursoId },
        { name: 'empresaId', value: empresaId },
      ];
      if (plazoRespuesta) variables.push({ name: 'plazoRespuesta', value: plazoRespuesta });
      if (simularFaltaAulas) variables.push({ name: 'simularFaltaAulas', value: true });

      let resp;
      try {
        resp = await flowableRest('POST', '/runtime/process-instances', {
          body: {
            message: 'Solicitud de curso',
            businessKey: String(newCursoId),
            variables,
          },
        });
      } catch (e) {
        console.error('Flowable error:', e.status, e.body || e.message);
        throw new Error('No se pudo iniciar el proceso en Flowable. Intente nuevamente.');
      }

      const processInstanceId = resp.data && resp.data.id;
      if (!processInstanceId) {
        throw new Error('Flowable no devolvio id de instancia.');
      }

      await client.query('UPDATE curso SET process_instance_id = $1 WHERE id = $2', [processInstanceId, newCursoId]);
      return newCursoId;
    });

    res.redirect(`/solicitar/confirmacion?cursoId=${cursoId}`);
  } catch (err) {
    console.error('Error al crear solicitud:', err.message);
    res.status(500).render('solicitar', {
      title: 'Solicitar curso',
      errors: { _general: err.message || 'Error al procesar la solicitud.' },
      form,
      csrfToken: req.session && req.session.csrfToken,
      devMode: devAllowed(req),
    });
  }
});

router.get('/solicitar/confirmacion', (req, res) => {
  const cursoId = req.query.cursoId;
  if (!cursoId) return res.redirect('/solicitar');
  res.render('confirmacion', { title: 'Confirmacion', cursoId, csrfToken: req.session && req.session.csrfToken });
});

module.exports = router;
