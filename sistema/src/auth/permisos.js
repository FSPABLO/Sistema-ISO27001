'use strict';
// Matriz de permisos por rol (sección 6.1 del enunciado).
const ROLES = ['administrador', 'analista', 'auditor'];

const PERMISOS = {
  'usuarios:gestionar': ['administrador'],
  'conexiones:gestionar': ['administrador', 'analista'],
  'conexiones:ver': ['administrador', 'analista', 'auditor'],
  'ejecuciones:ejecutar': ['administrador', 'analista'],
  'ejecuciones:ver': ['administrador', 'analista', 'auditor'],
  'auditoria:ver': ['administrador', 'auditor'],
  'informes:ver': ['administrador', 'analista', 'auditor'],
};

// Roles que ven todas las ejecuciones; el analista solo ve las propias.
const VEN_TODAS = ['administrador', 'auditor'];

function tiene(usuario, permiso) {
  return Boolean(usuario && PERMISOS[permiso] && PERMISOS[permiso].includes(usuario.rol));
}

function veTodas(usuario) {
  return Boolean(usuario && VEN_TODAS.includes(usuario.rol));
}

function puedeVerEjecucion(usuario, ejecucion) {
  if (!usuario || !ejecucion) return false;
  return veTodas(usuario) || ejecucion.usuario_id === usuario.id;
}

module.exports = { ROLES, PERMISOS, tiene, veTodas, puedeVerEjecucion };
