// SMTP falso mínimo (equivale a DevNullSmtp): escucha en el puerto 25 y guarda los correos que envía el proceso.
// Uso: const { iniciar, correos } = require('./m-smtp-sumidero'); await iniciar() -> true si pudo abrir el puerto.
const net = require('net');
const correos = [];

function atender(sock) {
  let enDatos = false; let buf = ''; let actual = { para: [], texto: '' };
  const responder = (t) => sock.write(t + '\r\n');
  responder('220 sumidero');
  sock.on('data', (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const linea = buf.slice(0, i); buf = buf.slice(i + 2);
      if (enDatos) {
        if (linea === '.') {
          enDatos = false;
          const correo = { para: actual.para.join(','), asunto: (/^Subject: (.*)$/m.exec(actual.texto) || [])[1] || '', texto: actual.texto };
          correos.push(correo);
          if (require.main === module) console.log(`[${new Date().toLocaleTimeString()}] Correo para ${correo.para} | ${correo.asunto}`);
          actual = { para: [], texto: '' };
          responder('250 ok');
        } else actual.texto += linea + '\n';
      } else if (/^RCPT TO:/i.test(linea)) { actual.para.push(linea.replace(/^RCPT TO:\s*<?/i, '').replace(/>?$/, '')); responder('250 ok'); }
      else if (/^DATA/i.test(linea)) { enDatos = true; responder('354 siga'); }
      else if (/^QUIT/i.test(linea)) { sock.end('221 chau\r\n'); }
      else responder('250 ok');
    }
  });
  sock.on('error', () => {});
}

function iniciar(puerto = 25) {
  return new Promise((resolve) => {
    const srv = net.createServer(atender);
    srv.on('error', (e) => { console.log(`  (SMTP de prueba no disponible en el puerto ${puerto}: ${e.code})`); resolve(false); });
    srv.listen(puerto, '0.0.0.0', () => resolve(true));
  });
}
module.exports = { iniciar, correos };

// Uso independiente (alternativa a DevNullSmtp, igual en Windows y Ubuntu):
//   node scripts/escenarios/m-smtp-sumidero.js [puerto]      (puerto por defecto: SMTP_PORT o 25)
// Imprime cada correo que llega. Dejar abierta la terminal; Ctrl+C para cerrar.
if (require.main === module) {
  const puerto = Number(process.argv[2]) || Number(process.env.SMTP_PORT) || 25;
  iniciar(puerto).then((ok) => { if (ok) console.log(`SMTP de prueba escuchando en el puerto ${puerto}. Esperando correos...`); else process.exit(1); });
}
