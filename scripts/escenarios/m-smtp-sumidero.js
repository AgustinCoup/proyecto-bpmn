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
          correos.push({ para: actual.para.join(','), asunto: (/^Subject: (.*)$/m.exec(actual.texto) || [])[1] || '', texto: actual.texto });
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
