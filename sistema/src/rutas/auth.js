'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const { tokenCsrf } = require('../auth/middleware');

function regenerar(req) {
  return new Promise((ok, mal) => req.session.regenerate((e) => (e ? mal(e) : ok())));
}

function rutasAuth({ servicios, auditoria, mw, config }) {
  const r = express.Router();
  const usuarios = servicios.usuarios;

  const limiteLogin = rateLimit({
    windowMs: config.limiteLoginVentanaMin * 60 * 1000,
    limit: config.limiteLoginMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      auditoria.desdePeticion(req, { accion: 'LOGIN_LIMITE', usuario: String((req.body && req.body.usuario) || '').slice(0, 40),
        resultado: 'DENEGADO', detalle: 'Demasiados intentos desde esta dirección' });
      res.status(429).json({ error: 'Demasiados intentos de ingreso desde esta dirección. Espere unos minutos.' });
    },
  });

  r.get('/csrf', (req, res) => res.json({ csrf: tokenCsrf(req), registro: config.permitirRegistro }));

  // Registro público: crea una cuenta de analista (nunca administrador ni auditor) e inicia la sesión
  r.post('/registro', limiteLogin, async (req, res) => {
    if (!config.permitirRegistro) return res.status(403).json({ error: 'El registro de cuentas está desactivado. Pida una cuenta al administrador.' });
    const { usuario, nombre, clave } = req.body || {};
    let u;
    try {
      u = await usuarios.crear({ usuario, nombre, rol: 'analista', clave });
    } catch (e) {
      auditoria.desdePeticion(req, { accion: 'USUARIO_REGISTRO', usuario: String(usuario || '').slice(0, 40),
        objeto: 'usuario:' + String(usuario || '').slice(0, 40), resultado: 'FALLIDO', detalle: e.mensajes ? e.mensajes.join(' ') : 'error' });
      throw e;
    }
    await regenerar(req);
    req.session.usuario = { id: u.id, usuario: u.usuario, rol: u.rol };
    const csrf = tokenCsrf(req);
    auditoria.desdePeticion(req, { accion: 'USUARIO_REGISTRO', objeto: 'usuario:' + u.usuario, resultado: 'OK', detalle: { rol: u.rol } });
    res.status(201).json({ usuario: u, csrf });
  });

  r.post('/login', limiteLogin, async (req, res) => {
    const { usuario, clave } = req.body || {};
    const nombre = String(usuario || '').slice(0, 40);
    const resultado = await usuarios.ingresar(nombre, clave);
    if (!resultado.ok) {
      const fila = resultado.fila;
      auditoria.desdePeticion(req, { accion: 'LOGIN_FALLIDO', usuario: nombre, rol: fila ? fila.rol : null,
        objeto: 'usuario:' + nombre, resultado: 'FALLIDO', detalle: resultado.motivo });
      if (resultado.bloqueadoAhora) {
        auditoria.desdePeticion(req, { accion: 'BLOQUEO_CUENTA', usuario: nombre, rol: fila.rol, objeto: 'usuario:' + nombre,
          resultado: 'OK', detalle: `Bloqueada hasta ${resultado.hasta} tras ${config.intentosMaximos} intentos fallidos` });
      }
      if (resultado.bloqueada || resultado.bloqueadoAhora) {
        const min = Math.max(1, Math.ceil((Date.parse(resultado.hasta) - Date.now()) / 60000));
        return res.status(423).json({ error: `Cuenta bloqueada temporalmente por intentos fallidos. Intente de nuevo en ${min} minuto(s).` });
      }
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }
    const u = resultado.usuario;
    await regenerar(req); // evita fijación de sesión
    req.session.usuario = { id: u.id, usuario: u.usuario, rol: u.rol };
    const csrf = tokenCsrf(req);
    auditoria.desdePeticion(req, { accion: 'LOGIN_OK', objeto: 'usuario:' + u.usuario, resultado: 'OK' });
    res.json({ usuario: u, csrf });
  });

  r.post('/logout', mw.autenticado, (req, res) => {
    auditoria.desdePeticion(req, { accion: 'LOGOUT', objeto: 'usuario:' + req.usuario.usuario, resultado: 'OK' });
    req.session.destroy(() => {
      res.clearCookie('sid');
      res.json({ ok: true });
    });
  });

  r.get('/yo', mw.autenticado, (req, res) => {
    res.json({ usuario: usuarios.obtener(req.usuario.id), csrf: tokenCsrf(req), inactividadMin: config.inactividadMin });
  });

  r.post('/cambiar-clave', mw.autenticado, async (req, res) => {
    const { actual, nueva } = req.body || {};
    try {
      await usuarios.cambiarClave(req.usuario.id, actual, nueva);
    } catch (e) {
      auditoria.desdePeticion(req, { accion: 'CAMBIO_CLAVE', objeto: 'usuario:' + req.usuario.usuario, resultado: 'FALLIDO',
        detalle: e.mensajes ? e.mensajes.join(' ') : 'error' });
      throw e;
    }
    auditoria.desdePeticion(req, { accion: 'CAMBIO_CLAVE', objeto: 'usuario:' + req.usuario.usuario, resultado: 'OK' });
    res.json({ ok: true, usuario: usuarios.obtener(req.usuario.id) });
  });

  return r;
}

module.exports = rutasAuth;
