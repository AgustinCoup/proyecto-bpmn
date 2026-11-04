const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// CUIT: XX-XXXXXXXX-X (con guiones) o 11 digitos.
const CUIT_RE = /^(\d{2})-?(\d{8})-?(\d{1})$/;

function normalizeCuit(v) {
  return String(v || '').trim();
}

function validarCuit(v) {
  const m = normalizeCuit(v).match(CUIT_RE);
  if (!m) return null;
  // validacion de digito verificador
  const digits = m[1] + m[2] + m[3];
  if (digits.length !== 11) return null;
  const mults = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * mults[i];
  const dv = (11 - (sum % 11)) % 11;
  if (dv === 10) return null;
  if (dv !== Number(digits[10])) return null;
  // formato canonico con guiones
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function validarEmail(v) {
  const s = String(v || '').trim();
  if (!s || s.length > 150) return null;
  if (!EMAIL_RE.test(s)) return null;
  return s;
}

function validarCantidad(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function validarTexto(v, max = 2000) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (s.length > max) return null;
  return s;
}

function validarSolicitud(body) {
  const errors = {};
  const nombre = validarTexto(body.nombreEmpresa || body.nombre, 200);
  if (!nombre) errors.nombreEmpresa = 'Nombre de empresa obligatorio (max 200).';
  const cuit = validarCuit(body.cuit);
  if (!cuit) errors.cuit = 'CUIT invalido.';
  const contacto = validarTexto(body.contacto, 150);
  if (!contacto) errors.contacto = 'Nombre de contacto obligatorio.';
  const email = validarEmail(body.email);
  if (!email) errors.email = 'Email invalido.';
  const telefono = body.telefono ? String(body.telefono).trim().slice(0, 50) : null;
  const tematica = validarTexto(body.tematica, 200);
  if (!tematica) errors.tematica = 'Tematica obligatoria.';
  const descripcion = validarTexto(body.descripcion, 5000);
  if (!descripcion) errors.descripcion = 'Descripcion obligatoria.';
  const cantidad = validarCantidad(body.cantidadParticipantes);
  if (cantidad === null) errors.cantidadParticipantes = 'Cantidad debe ser entero mayor a 0.';
  const fechas = validarTexto(body.fechasPreferidas, 255);
  if (!fechas) errors.fechasPreferidas = 'Fechas preferidas obligatorias.';

  const data = (Object.keys(errors).length === 0) ? {
    nombreEmpresa: nombre,
    cuit,
    contacto,
    email,
    telefono,
    tematica,
    descripcion,
    cantidadParticipantes: cantidad,
    fechasPreferidas: fechas,
  } : null;

  return { errors, data };
}

function validarLogin(body) {
  const errors = {};
  const usuario = validarTexto(body.usuario, 100);
  if (!usuario) errors.usuario = 'Usuario obligatorio.';
  const clave = body.clave ? String(body.clave) : '';
  if (!clave) errors.clave = 'Clave obligatoria.';
  return { errors, data: Object.keys(errors).length ? null : { usuario, clave } };
}

module.exports = {
  validarCuit,
  validarEmail,
  validarCantidad,
  validarTexto,
  validarSolicitud,
  validarLogin,
};
