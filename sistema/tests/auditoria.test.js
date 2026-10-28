'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrir } = require('../src/db');
const { crearAuditoria, HASH_INICIAL } = require('../src/audit');

function conRegistros(n = 5) {
  const db = abrir(':memory:');
  const a = crearAuditoria(db);
  for (let i = 0; i < n; i++) a.registrar({ usuario: 'ana', rol: 'analista', accion: 'PRUEBA', objeto: `obj:${i}`, ip: '127.0.0.1', detalle: { i } });
  return { db, a };
}

test('cada registro encadena el hash del anterior', () => {
  const { db, a } = conRegistros(3);
  const filas = db.prepare('SELECT * FROM audit_log ORDER BY id').all();
  assert.equal(filas[0].hash_anterior, HASH_INICIAL);
  assert.equal(filas[1].hash_anterior, filas[0].hash);
  assert.equal(filas[2].hash_anterior, filas[1].hash);
  assert.deepEqual(a.verificar().integro, true);
  assert.equal(a.verificar().total, 3);
});

test('el registro es de solo inserción: UPDATE y DELETE se rechazan', () => {
  const { db } = conRegistros(2);
  assert.throws(() => db.prepare("UPDATE audit_log SET usuario = 'otro' WHERE id = 1").run(), /solo insercion/);
  assert.throws(() => db.prepare('DELETE FROM audit_log WHERE id = 1').run(), /solo insercion/);
});

test('el módulo no expone funciones para modificar ni borrar', () => {
  const { a } = conRegistros(1);
  assert.deepEqual(Object.keys(a).sort(), ['desdePeticion', 'registrar', 'verificar']);
});

test('la verificación detecta un registro alterado aunque se quiten los disparadores', () => {
  const { db, a } = conRegistros(5);
  db.exec('DROP TRIGGER audit_log_sin_update');
  db.prepare("UPDATE audit_log SET detalle = '{\"i\":99}' WHERE id = 3").run();
  const v = a.verificar();
  assert.equal(v.integro, false);
  assert.equal(v.filaId, 3);
  assert.match(v.motivo, /alterado/);
});

test('la verificación detecta un registro borrado en medio de la cadena', () => {
  const { db, a } = conRegistros(5);
  db.exec('DROP TRIGGER audit_log_sin_delete');
  db.prepare('DELETE FROM audit_log WHERE id = 2').run();
  const v = a.verificar();
  assert.equal(v.integro, false);
  assert.match(v.motivo, /Falta el registro 2|no enlaza/);
});

test('la verificación detecta un hash recalculado sin reenlazar la cadena', () => {
  const { db, a } = conRegistros(4);
  db.exec('DROP TRIGGER audit_log_sin_update');
  // El atacante cambia el contenido y recalcula solo el hash de esa fila
  const { calcularHash } = require('../src/audit');
  const f = db.prepare('SELECT * FROM audit_log WHERE id = 2').get();
  f.usuario = 'mallory';
  db.prepare('UPDATE audit_log SET usuario = ?, hash = ? WHERE id = 2').run('mallory', calcularHash(f.hash_anterior, f));
  const v = a.verificar();
  assert.equal(v.integro, false);
  assert.equal(v.filaId, 3);
});
