'use strict';
// Formatea filas como la salida de SQL*Plus (encabezados, guiones y "no rows selected").

const ANCHO_MAXIMO = 60;

function texto(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\s+/g, ' ');
}

function recortar(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function formatearSqlplus(columnas, filas, { anchoMaximo = ANCHO_MAXIMO } = {}) {
  if (!filas || filas.length === 0) return 'no rows selected';
  const numericas = columnas.map((_, i) => filas.every((f) => f[i] === null || typeof f[i] === 'number'));
  const anchos = columnas.map((c, i) => Math.min(anchoMaximo,
    Math.max(c.length, ...filas.map((f) => texto(f[i]).length))));
  const celda = (v, i) => {
    const s = recortar(texto(v), anchos[i]);
    return numericas[i] ? s.padStart(anchos[i]) : s.padEnd(anchos[i]);
  };
  const lineas = [
    columnas.map((c, i) => (numericas[i] ? recortar(c, anchos[i]).padStart(anchos[i]) : recortar(c, anchos[i]).padEnd(anchos[i]))).join(' ').trimEnd(),
    anchos.map((a) => '-'.repeat(a)).join(' '),
    ...filas.map((f) => f.map(celda).join(' ').trimEnd()),
    '',
    filas.length === 1 ? '1 row selected.' : `${filas.length} rows selected.`,
  ];
  return lineas.join('\n');
}

// Representa las variables de enlace como en SQL*Plus; las que empiezan con "sal" (sal criptográfica) se ocultan
function declararBinds(binds) {
  const ent = Object.entries(binds || {}).map(([k, v]) => [k, k.startsWith('sal') ? '********' : v]);
  if (!ent.length) return '';
  return ent.map(([k, v]) => (typeof v === 'number'
    ? `SQL> VARIABLE ${k} NUMBER\nSQL> EXEC :${k} := ${v}`
    : `SQL> VARIABLE ${k} VARCHAR2(400)\nSQL> EXEC :${k} := '${String(v).replace(/'/g, "''")}'`)).join('\n');
}

// Sangra la consulta como la escribiría un DBA en SQL*Plus
function sqlComoPrompt(sql) {
  const lineas = String(sql).trim().split('\n').map((l) => l.replace(/\s+$/, ''));
  return lineas.map((l, i) => (i === 0 ? 'SQL> ' : `${String(i + 1).padStart(3)}  `) + l.trim()).join('\n') + ';';
}

module.exports = { formatearSqlplus, declararBinds, sqlComoPrompt };
