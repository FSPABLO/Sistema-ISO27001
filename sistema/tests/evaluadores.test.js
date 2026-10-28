'use strict';
// Evaluadores con filas como las que devuelven las bases débil y endurecida del laboratorio.
const test = require('node:test');
const assert = require('node:assert/strict');
const { PRUEBAS } = require('../src/catalogo');
const { formatearSqlplus, sqlComoPrompt, declararBinds } = require('../src/motor/formato');

const p = (id) => PRUEBAS.find((x) => x.id === id);
const ev = (id, filas, ctx = {}) => p(id).evaluador(filas, ctx);

test('catálogo: 18 controles cubiertos, ids únicos y campos obligatorios', () => {
  const ids = PRUEBAS.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const x of PRUEBAS) {
    for (const campo of ['id', 'controlId', 'nombre', 'descripcion', 'sql', 'evaluador', 'esperado', 'explicacionCumple', 'explicacionNoCumple', 'recomendacion', 'comandoEquivalente']) {
      assert.ok(x[campo], `${x.id} sin ${campo}`);
    }
  }
});

test('A5.18-1 cuentas de demostración', () => {
  assert.equal(ev('A5.18-1', [{ USERNAME: 'SCOTT', ACCOUNT_STATUS: 'OPEN' }]).estado, 'NO CUMPLE');
  assert.equal(ev('A5.18-1', [{ USERNAME: 'SCOTT', ACCOUNT_STATUS: 'EXPIRED & LOCKED' }]).estado, 'CUMPLE');
  assert.equal(ev('A5.18-1', []).estado, 'CUMPLE');
});

test('A5.17 perfiles: DEFAULT débil frente a PRF_SEGCONF', () => {
  const debil = ['SEGCONF', 'APP_CONSULTA'].map((u) => ({ USERNAME: u, PROFILE: 'DEFAULT', FAILED_LOGIN_ATTEMPTS: '10', PASSWORD_LIFE_TIME: '180', PASSWORD_VERIFY_FUNCTION: 'NULL' }));
  assert.equal(ev('A5.17-1', debil).estado, 'NO CUMPLE');
  assert.equal(ev('A5.17-2', debil).estado, 'NO CUMPLE');
  assert.equal(ev('A5.17-3', debil).estado, 'NO CUMPLE');
  const mixto = [{ USERNAME: 'SEGCONF', PROFILE: 'PRF_SEGCONF', FAILED_LOGIN_ATTEMPTS: '5', PASSWORD_LIFE_TIME: '90', PASSWORD_VERIFY_FUNCTION: 'ORA12C_STRONG_VERIFY_FUNCTION' }, debil[0]];
  assert.equal(ev('A5.17-1', mixto).estado, 'PARCIAL');
  assert.match(ev('A5.17-1', mixto).detalle, /1 de 2/);
  assert.equal(ev('A5.17-2', [{ USERNAME: 'X', PASSWORD_LIFE_TIME: 'UNLIMITED' }]).estado, 'NO CUMPLE');
});

test('A8.5-1 versiones de hash', () => {
  assert.equal(ev('A8.5-1', [{ USERNAME: 'A', PASSWORD_VERSIONS: '10G 11G 12C' }]).estado, 'NO CUMPLE');
  assert.equal(ev('A8.5-1', [{ USERNAME: 'A', PASSWORD_VERSIONS: '11G 12C' }]).estado, 'PARCIAL');
  assert.equal(ev('A8.5-1', [{ USERNAME: 'A', PASSWORD_VERSIONS: '12C' }]).estado, 'CUMPLE');
});

test('A8.20-1 cifrado de red', () => {
  const banners = (...l) => l.map((x) => ({ NETWORK_SERVICE_BANNER: x }));
  assert.equal(ev('A8.20-1', banners('TCP/IP NT Protocol Adapter', 'AES256 Encryption service adapter for Linux', 'SHA512 Crypto-checksumming service adapter for Linux')).estado, 'CUMPLE');
  assert.equal(ev('A8.20-1', banners('TCP/IP NT Protocol Adapter', 'Encryption service for Linux', 'Crypto-checksumming service for Linux')).estado, 'NO CUMPLE');
});

test('A8.15-1 políticas de auditoría: solo generales da NO CUMPLE con madurez 1', () => {
  const r = ev('A8.15-1', [{ POLICY_NAME: 'ORA_LOGON_FAILURES', OBJETOS_APLICACION: 0 }]);
  assert.equal(r.estado, 'NO CUMPLE');
  assert.equal(r.madurez, 1);
  assert.equal(ev('A8.15-1', [{ POLICY_NAME: 'POL_AUD_CLIENTES', OBJETOS_APLICACION: 5 }]).estado, 'CUMPLE');
});

test('A5.33-1 separación de funciones', () => {
  assert.equal(ev('A5.33-1', [{ GRANTEE: 'ISO_AUDIT', GRANTED_ROLE: 'AUDIT_VIEWER', TABLAS_PROPIAS: 0, CUENTA_AUDITORIA: 'SI' }]).estado, 'NO CUMPLE');
  assert.equal(ev('A5.33-1', [{ GRANTEE: 'APP_AUDITOR', GRANTED_ROLE: 'AUDIT_VIEWER', TABLAS_PROPIAS: 0, CUENTA_AUDITORIA: 'NO' }]).estado, 'CUMPLE');
  assert.equal(ev('A5.33-1', [{ GRANTEE: 'SEGCONF', GRANTED_ROLE: 'AUDIT_ADMIN', TABLAS_PROPIAS: 3, CUENTA_AUDITORIA: 'NO' }]).estado, 'NO CUMPLE');
});

test('A8.13-2 respaldos', () => {
  assert.equal(ev('A8.13-2', []).estado, 'NO CUMPLE');
  assert.equal(ev('A8.13-2', [{ ENCRYPTED: 'YES', DIAS: 3 }]).estado, 'CUMPLE');
  assert.equal(ev('A8.13-2', [{ ENCRYPTED: 'NO', DIAS: 3, TAG: 'X' }]).estado, 'PARCIAL');
  assert.equal(ev('A8.13-2', [{ ENCRYPTED: 'YES', DIAS: 45 }]).estado, 'PARCIAL');
});

test('A8.8-2 sin parches registrados evalúa con la versión y lo explica', () => {
  const r = ev('A8.8-2', [], { info: { version: '23.26.3.0.0' } });
  assert.equal(r.estado, 'PARCIAL');
  assert.match(r.detalle, /23\.26\.3\.0\.0/);
});

test('A5.12 heurística de clasificación', () => {
  const filas = [
    { OWNER: 'SEGCONF', TABLE_NAME: 'CLIENTES', COLUMN_NAME: 'TARJETA', REDACTADA: 'SI', CIFRADA: 'SI' },
    { OWNER: 'SEGCONF_DEV', TABLE_NAME: 'CLIENTES', COLUMN_NAME: 'TARJETA', REDACTADA: 'NO', CIFRADA: 'NO' },
  ];
  assert.equal(ev('A5.12-1', filas).estado, 'PARCIAL');
  assert.equal(ev('A5.12-2', [{ COLUMN_NAME: 'X', COMENTARIO: null }]).estado, 'NO CUMPLE');
  assert.equal(ev('A5.12-2', [{ COLUMN_NAME: 'X', COMENTARIO: 'CONFIDENCIAL - dato de pago' }]).estado, 'CUMPLE');
});

test('formato SQL*Plus', () => {
  assert.equal(formatearSqlplus(['A'], []), 'no rows selected');
  const s = formatearSqlplus(['USERNAME', 'N'], [['SCOTT', 1], ['APP_REPORTES', 22]]);
  const lineas = s.split('\n');
  assert.equal(lineas[0], 'USERNAME      N');
  assert.equal(lineas[1], '------------ --');
  assert.equal(lineas[2], 'SCOTT         1');
  assert.equal(lineas.at(-1), '2 rows selected.');
  assert.equal(formatearSqlplus(['X'], [[null]]).split('\n').at(-1), '1 row selected.');
  assert.match(sqlComoPrompt('SELECT 1\nFROM dual'), /^SQL> SELECT 1\n {2}2 {2}FROM dual;$/);
  assert.equal(declararBinds({ dias: 90 }), 'SQL> VARIABLE dias NUMBER\nSQL> EXEC :dias := 90');
});
