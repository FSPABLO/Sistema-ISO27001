'use strict';
const express = require('express');

function rutasUsuarios({ servicios, auditoria, mw }) {
  const r = express.Router();
  const usuarios = servicios.usuarios;
  r.use(mw.requiere('usuarios:gestionar'));

  const idParam = (req) => Number.parseInt(req.params.id, 10);

  r.get('/', (req, res) => res.json({ usuarios: usuarios.listar() }));

  r.post('/', async (req, res) => {
    const { usuario, nombre, rol, clave } = req.body || {};
    try {
      const u = await usuarios.crear({ usuario, nombre, rol, clave });
      auditoria.desdePeticion(req, { accion: 'USUARIO_ALTA', objeto: 'usuario:' + u.usuario, resultado: 'OK', detalle: { rol: u.rol } });
      res.status(201).json({ usuario: u });
    } catch (e) {
      auditoria.desdePeticion(req, { accion: 'USUARIO_ALTA', objeto: 'usuario:' + String(usuario || '').slice(0, 40),
        resultado: 'FALLIDO', detalle: e.mensajes ? e.mensajes.join(' ') : 'error' });
      throw e;
    }
  });

  r.patch('/:id/rol', (req, res) => {
    const { antes, usuario } = servicios.usuarios.cambiarRol(idParam(req), (req.body || {}).rol);
    auditoria.desdePeticion(req, { accion: 'USUARIO_CAMBIO_ROL', objeto: 'usuario:' + usuario.usuario, resultado: 'OK',
      detalle: { antes, despues: usuario.rol } });
    res.json({ usuario });
  });

  r.patch('/:id/activo', (req, res) => {
    const activo = Boolean((req.body || {}).activo);
    if (idParam(req) === req.usuario.id && !activo) {
      return res.status(409).json({ error: 'No puede desactivar su propia cuenta.' });
    }
    const u = usuarios.cambiarActivo(idParam(req), activo);
    auditoria.desdePeticion(req, { accion: activo ? 'USUARIO_REACTIVACION' : 'USUARIO_BAJA', objeto: 'usuario:' + u.usuario, resultado: 'OK' });
    res.json({ usuario: u });
  });

  r.post('/:id/restablecer-clave', async (req, res) => {
    const u = await usuarios.restablecerClave(idParam(req), (req.body || {}).clave);
    auditoria.desdePeticion(req, { accion: 'USUARIO_RESTABLECER_CLAVE', objeto: 'usuario:' + u.usuario, resultado: 'OK',
      detalle: 'Contraseña definida por el administrador' });
    res.json({ usuario: u });
  });

  return r;
}

module.exports = rutasUsuarios;
