'use strict';

/**
 * Genera el PDF del informe de resultados con pdfkit (carga diferida: solo se
 * necesita al armar un informe). Todo el contenido es texto plano; pdfkit no
 * interpreta marcado, así que no hay inyección.
 */

const MAX_LISTED_PARTICIPANTS = 100;

function formatDay(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().slice(0, 10);
}

function buildReportPdf({
  course, teacher, participants = [], report, generatedAt = new Date(),
}) {
  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch {
    return Promise.reject(new Error('Falta la dependencia "pdfkit" para generar el informe.'));
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: 'Informe de resultados' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const section = (title, text) => {
      doc.moveDown(0.8).font('Helvetica-Bold').fontSize(12).text(title);
      doc.font('Helvetica').fontSize(11).text(text || '—');
    };

    doc.font('Helvetica-Bold').fontSize(18).text('Informe de resultados');
    doc.font('Helvetica').fontSize(10).fillColor('#555555')
      .text(`Generado el ${formatDay(generatedAt)}`).fillColor('#000000');

    section('Curso', `${course.nombre || course.tematica || `Curso #${course.id}`} (curso #${course.id})`);
    section('Docente a cargo', teacher || '—');
    section('Período', `${formatDay(course.fecha_inicio)} al ${formatDay(course.fecha_fin)}`);
    section('Asistentes efectivos', String(report.asistentes));
    section(
      'Participantes inscriptos',
      participants.length
        ? participants.slice(0, MAX_LISTED_PARTICIPANTS).map((name) => `• ${name}`).join('\n')
          + (participants.length > MAX_LISTED_PARTICIPANTS
            ? `\n… y ${participants.length - MAX_LISTED_PARTICIPANTS} más`
            : '')
        : 'Sin lista registrada.',
    );
    section('Resumen de resultados', report.resumen);
    if (report.observaciones) section('Observaciones', report.observaciones);

    doc.end();
  });
}

module.exports = { buildReportPdf };
