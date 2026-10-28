'use strict';
// Registro de auditoría del propio sistema: solo inserción y hash encadenado.
// No existe ninguna función ni endpoint para modificar o borrar registros; además,
// los disparadores de SQLite rechazan UPDATE y DELETE sobre audit_log.
const crypto = require('node:crypto');

const HASH_INICIAL = '0'.repeat(64);
const CAMPOS = ['fecha', 'usuario', 'rol', 'accion', 'objeto', 'ip', 'resultado', 'detalle'];

function calcularHash(anterior, fila) {
  const contenido = JSON.stringify(CAMPOS.map((c) => (fila[c] === undefined ? null : fila[c])));
  return crypto.createHash('sha256').update(anterior + '|' + contenido).digest('hex');
}

function crearAuditoria(db) {
  const sqlUltimo = db.prepare('SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1');
  const sqlInsertar = db.prepare(`INSERT INTO audit_log (fecha, usuario, rol, accion, objeto, ip, resultado, detalle, hash_anterior, hash)
                                  VALUES (@fecha, @usuario, @rol, @accion, @objeto, @ip, @resultado, @detalle, @hash_anterior, @hash)`);
  // La lectura del último hash y la inserción van en una sola transacción
  const insertar = db.transaction((fila) => {
    const ultimo = sqlUltimo.get();
    const anterior = ultimo ? ultimo.hash : HASH_INICIAL;
    const completa = { ...fila, hash_anterior: anterior, hash: calcularHash(anterior, fila) };
    return sqlInsertar.run(completa).lastInsertRowid;
  });

  function registrar({ usuario = null, rol = null, accion, objeto = null, ip = null, resultado = 'OK', detalle = null }) {
    if (!accion) throw new Error('accion requerida');
    const fila = {
      fecha: new Date().toISOString(),
      usuario, rol, accion,
      objeto: objeto === null ? null : String(objeto),
      ip, resultado,
      detalle: detalle === null ? null : (typeof detalle === 'string' ? detalle : JSON.stringify(detalle)),
    };
    return insertar(fila);
  }

  // Desde una petición HTTP: toma usuario, rol e IP de la sesión (datos puede indicar otro usuario, p. ej. en un ingreso fallido)
  function desdePeticion(req, datos) {
    const u = req.session && req.session.usuario;
    const ip = String(req.ip || '').replace(/^::ffff:/, '');
    return registrar({ usuario: u ? u.usuario : null, rol: u ? u.rol : null, ip, ...datos });
  }

  function verificar() {
    let anterior = HASH_INICIAL;
    let idEsperado = null;
    let total = 0;
    for (const fila of db.prepare('SELECT * FROM audit_log ORDER BY id').iterate()) {
      total++;
      if (idEsperado !== null && fila.id !== idEsperado) {
        return { integro: false, total, filaId: fila.id, motivo: `Falta el registro ${idEsperado} (secuencia interrumpida)` };
      }
      if (fila.hash_anterior !== anterior) {
        return { integro: false, total, filaId: fila.id, motivo: `El registro ${fila.id} no enlaza con el hash del registro anterior` };
      }
      const esperado = calcularHash(anterior, fila);
      if (fila.hash !== esperado) {
        return { integro: false, total, filaId: fila.id, motivo: `El contenido del registro ${fila.id} fue alterado (hash distinto)` };
      }
      anterior = fila.hash;
      idEsperado = fila.id + 1;
    }
    return { integro: true, total, ultimoHash: anterior, motivo: total ? 'Cadena de hashes íntegra' : 'Registro vacío' };
  }

  return { registrar, desdePeticion, verificar };
}

module.exports = { crearAuditoria, calcularHash, HASH_INICIAL };
