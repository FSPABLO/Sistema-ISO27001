'use strict';
const bcrypt = require('bcryptjs');

const COSTO = 12;
const LONGITUD_MINIMA = 12;

// Política de contraseñas del sistema: mínimo 12 caracteres y que no contenga el nombre de usuario.
function validarPolitica(clave, usuario = '') {
  const errores = [];
  if (typeof clave !== 'string' || clave.length < LONGITUD_MINIMA) {
    errores.push(`La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`);
  }
  if (typeof clave === 'string' && clave.length > 128) errores.push('La contraseña no puede superar 128 caracteres.');
  if (usuario && typeof clave === 'string' && clave.toLowerCase().includes(String(usuario).toLowerCase())) {
    errores.push('La contraseña no puede contener el nombre de usuario.');
  }
  return errores;
}

const hashear = (clave) => bcrypt.hash(clave, COSTO);
const comparar = (clave, hash) => bcrypt.compare(String(clave || ''), hash);
// Hash fijo para gastar el mismo tiempo cuando el usuario no existe (evita enumerar usuarios por tiempo)
const HASH_FICTICIO = bcrypt.hashSync('usuario-inexistente-' + Date.now(), COSTO);

module.exports = { validarPolitica, hashear, comparar, HASH_FICTICIO, LONGITUD_MINIMA };
