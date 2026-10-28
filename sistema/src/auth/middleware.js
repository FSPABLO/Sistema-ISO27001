'use strict';
const crypto = require('node:crypto');
const permisos = require('./permisos');

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

function tokenCsrf(req) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(32).toString('hex');
  return req.session.csrf;
}

// Protección CSRF con token sincronizado en la sesión, enviado en la cabecera X-CSRF-Token.
function csrf(req, res, next) {
  if (METODOS_SEGUROS.has(req.method)) return next();
  const enviado = String(req.get('x-csrf-token') || '');
  const esperado = req.session && req.session.csrf;
  const ok = esperado && enviado.length === esperado.length &&
    crypto.timingSafeEqual(Buffer.from(enviado), Buffer.from(esperado));
  if (!ok) return res.status(403).json({ error: 'Token CSRF inválido o ausente. Recargue la página.' });
  next();
}

function crearMiddlewares({ db, auditoria }) {
  const sqlUsuario = db.prepare('SELECT id, usuario, nombre, rol, activo, debe_cambiar FROM usuarios WHERE id = ?');

  // Requiere sesión válida; recarga el usuario para reflejar cambios de rol o desactivación.
  function autenticado(req, res, next) {
    const s = req.session && req.session.usuario;
    if (!s) return res.status(401).json({ error: 'Debe iniciar sesión.' });
    const u = sqlUsuario.get(s.id);
    if (!u || !u.activo) {
      return req.session.destroy(() => res.status(401).json({ error: 'La cuenta ya no está activa.' }));
    }
    req.usuario = { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, debeCambiar: Boolean(u.debe_cambiar) };
    req.session.usuario = { id: u.id, usuario: u.usuario, rol: u.rol };
    next();
  }

  // Bloquea todo excepto el cambio de contraseña mientras sea obligatorio cambiarla.
  function sinCambioPendiente(req, res, next) {
    if (req.usuario && req.usuario.debeCambiar) {
      return res.status(403).json({ error: 'Debe cambiar su contraseña antes de continuar.', cambioRequerido: true });
    }
    next();
  }

  function requiere(permiso) {
    return (req, res, next) => {
      if (permisos.tiene(req.usuario, permiso)) return next();
      auditoria.desdePeticion(req, { accion: 'ACCESO_DENEGADO', objeto: req.method + ' ' + req.originalUrl,
        resultado: 'DENEGADO', detalle: { permiso } });
      res.status(403).json({ error: 'Su rol no tiene permiso para esta acción.' });
    };
  }

  return { autenticado, sinCambioPendiente, requiere };
}

module.exports = { csrf, tokenCsrf, crearMiddlewares };
