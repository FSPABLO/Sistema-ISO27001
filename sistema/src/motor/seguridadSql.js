'use strict';
// Reglas de seguridad de las consultas: solo lectura, una sentencia, identificadores validados.

const PATRON_IDENTIFICADOR = /^[A-Z][A-Z0-9_$#]{0,29}$/;

class ErrorSeguridadSql extends Error {}

const PALABRAS_PROHIBIDAS = /\b(INSERT|UPDATE|DELETE|MERGE|UPSERT|DROP|ALTER|CREATE|GRANT|REVOKE|TRUNCATE|RENAME|EXECUTE|EXEC|BEGIN|DECLARE|CALL|LOCK|COMMIT|ROLLBACK)\b/i;

// Quita comentarios para revisar el inicio real de la sentencia.
function sinComentarios(sql) {
  return String(sql).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

// Solo se aceptan consultas que empiecen con SELECT o WITH, sin ';' ni bloques PL/SQL.
function asegurarSoloLectura(sql) {
  if (typeof sql !== 'string' || !sql.trim()) throw new ErrorSeguridadSql('Consulta vacía');
  const limpia = sinComentarios(sql).trim();
  if (!/^(SELECT|WITH)\b/i.test(limpia)) {
    throw new ErrorSeguridadSql('Solo se permiten consultas que empiecen con SELECT o WITH');
  }
  // Se quitan literales e identificadores entrecomillados antes de buscar caracteres o palabras prohibidas
  const texto = limpia.replace(/'(?:[^']|'')*'/g, "''").replace(/"[^"]*"/g, '""');
  if (texto.includes(';')) throw new ErrorSeguridadSql('No se permite más de una sentencia');
  if (/\bFOR\s+UPDATE\b/i.test(texto)) throw new ErrorSeguridadSql('No se permite SELECT ... FOR UPDATE');
  const prohibida = texto.match(PALABRAS_PROHIBIDAS);
  if (prohibida) throw new ErrorSeguridadSql(`La consulta contiene la palabra no permitida ${prohibida[0].toUpperCase()}`);
  return sql;
}

// Valida un identificador de Oracle ingresado por el usuario (esquema, tabla o columna).
function validarIdentificador(valor, etiqueta = 'identificador') {
  const v = String(valor || '').trim().toUpperCase();
  if (!PATRON_IDENTIFICADOR.test(v)) {
    throw new ErrorSeguridadSql(`${etiqueta} no válido: "${String(valor).slice(0, 40)}". ` +
      'Use letras, números, _, $ o #, empiece con letra y máximo 30 caracteres.');
  }
  return v;
}

// Identificador validado y entrecomillado
function citar(valor, etiqueta) {
  return '"' + validarIdentificador(valor, etiqueta) + '"';
}

module.exports = { asegurarSoloLectura, validarIdentificador, citar, ErrorSeguridadSql, PATRON_IDENTIFICADOR };
