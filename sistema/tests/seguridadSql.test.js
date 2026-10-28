'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { asegurarSoloLectura, validarIdentificador, citar, ErrorSeguridadSql } = require('../src/motor/seguridadSql');
const { PRUEBAS } = require('../src/catalogo');
const { normalizarConfiguracion } = require('../src/catalogo/funcionales');

test('todas las consultas del catálogo son de solo lectura', () => {
  for (const p of PRUEBAS) assert.doesNotThrow(() => asegurarSoloLectura(p.sql), p.id);
});

test('acepta SELECT y WITH, con comentarios iniciales', () => {
  assert.doesNotThrow(() => asegurarSoloLectura('SELECT 1 FROM dual'));
  assert.doesNotThrow(() => asegurarSoloLectura('  with x as (select 1 a from dual) select a from x'));
  assert.doesNotThrow(() => asegurarSoloLectura('-- comentario\nSELECT 1 FROM dual'));
  assert.doesNotThrow(() => asegurarSoloLectura("SELECT 'DROP TABLE x; DELETE' texto FROM dual"));
  assert.doesNotThrow(() => asegurarSoloLectura('SELECT "UPDATE" FROM dual'));
});

test('rechaza sentencias que no son de lectura', () => {
  const malas = [
    'DELETE FROM segconf.clientes',
    'UPDATE segconf.clientes SET salario = 0',
    'INSERT INTO t VALUES (1)',
    'DROP TABLE t',
    'GRANT DBA TO scott',
    'BEGIN NULL; END;',
    'DECLARE x NUMBER; BEGIN NULL; END;',
    'ALTER SYSTEM SET x = 1',
    'SELECT 1 FROM dual; DROP TABLE t',
    'SELECT * FROM t FOR UPDATE',
    '/* x */ TRUNCATE TABLE t',
    'WITH a AS (SELECT 1 FROM dual) DELETE FROM t',
    'SELECT * FROM t WHERE 1 = 1 UNION SELECT * FROM t2; COMMIT',
    'MERGE INTO t USING s ON (1 = 1) WHEN MATCHED THEN UPDATE SET a = 1',
    '',
    null,
  ];
  for (const sql of malas) assert.throws(() => asegurarSoloLectura(sql), ErrorSeguridadSql, String(sql));
});

test('valida identificadores con ^[A-Z][A-Z0-9_$#]{0,29}$', () => {
  assert.equal(validarIdentificador('segconf'), 'SEGCONF');
  assert.equal(validarIdentificador('ID_CLIENTE'), 'ID_CLIENTE');
  assert.equal(validarIdentificador('A$B#1'), 'A$B#1');
  assert.equal(citar('clientes'), '"CLIENTES"');
  const malos = ['', '1TABLA', 'CLIENTES"; DROP TABLE x --', 'A B', 'A-B', 'X'.repeat(31), 'CLIENTES WHERE 1=1', '"X"', 'A.B', 'Ñandú'];
  for (const m of malos) assert.throws(() => validarIdentificador(m), ErrorSeguridadSql, m);
});

test('la configuración funcional rechaza identificadores maliciosos', () => {
  assert.throws(() => normalizarConfiguracion({ tabla: { esquema: 'SEGCONF', tabla: 'CLIENTES x', clave: 'ID' } }), ErrorSeguridadSql);
  assert.throws(() => normalizarConfiguracion({ clon: { esquema: 'A', tabla: 'B', clave: 'C', columnas: ["X' OR '1'='1"] } }), ErrorSeguridadSql);
  assert.throws(() => normalizarConfiguracion({ cuentas: { referencia: { usuario: 'sys as sysdba', clave: 'x' } } }), ErrorSeguridadSql);
  const ok = normalizarConfiguracion({ tabla: { esquema: 'segconf', tabla: 'clientes', clave: 'id_cliente', columnasSensibles: ['email'] } });
  assert.equal(ok.tabla.esquema, 'SEGCONF');
  assert.deepEqual(ok.tabla.columnasSensibles, ['EMAIL']);
});
