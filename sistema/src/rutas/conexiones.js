'use strict';
const express = require('express');
const { MOTORES } = require('../conectores');
const { validarIdentificador } = require('../motor/seguridadSql');
const { ErrorValidacion } = require('../auth/usuarios');

const PATRON_HOST = /^(?=.{1,253}$)[A-Za-z0-9]([A-Za-z0-9-]{0,62})(\.[A-Za-z0-9]([A-Za-z0-9-]{0,62}))*$|^\d{1,3}(\.\d{1,3}){3}$/;
const PATRON_SERVICIO = /^[A-Za-z][A-Za-z0-9_.$#-]{0,63}$/;

function validar(body) {
  const errores = [];
  const alias = String(body.alias || '').trim();
  const motor = String(body.motor || 'oracle');
  const host = String(body.host || '').trim();
  const puerto = Number.parseInt(body.puerto, 10);
  const servicio = String(body.servicio || '').trim();
  let usuario = '';
  if (alias.length < 2 || alias.length > 60) errores.push('El alias debe tener entre 2 y 60 caracteres.');
  if (!MOTORES[motor]) errores.push('Motor no soportado.');
  if (!PATRON_HOST.test(host)) errores.push('Host no válido (nombre DNS o dirección IPv4).');
  if (!(puerto >= 1 && puerto <= 65535)) errores.push('Puerto no válido.');
  if (!PATRON_SERVICIO.test(servicio)) errores.push('Nombre de servicio no válido.');
  try { usuario = validarIdentificador(body.usuario, 'Usuario de la base'); } catch (e) { errores.push(e.message); }
  if (errores.length) throw new ErrorValidacion(errores);
  return { alias, motor, host, puerto, servicio, usuario };
}

function publica(c) {
  return { id: c.id, alias: c.alias, motor: c.motor, host: c.host, puerto: c.puerto, servicio: c.servicio,
    usuario: c.usuario_bd, activa: Boolean(c.activa), creado: c.creado, creadoPor: c.creado_por_usuario || null,
    ejecuciones: c.ejecuciones || 0 };
}

function rutasConexiones({ db, auditoria, mw, ejecutor }) {
  const r = express.Router();
  const q = {
    listar: db.prepare(`SELECT c.*, u.usuario creado_por_usuario,
                               (SELECT COUNT(*) FROM ejecuciones e WHERE e.conexion_id = c.id) ejecuciones
                          FROM conexiones c LEFT JOIN usuarios u ON u.id = c.creado_por ORDER BY c.activa DESC, c.alias`),
    porId: db.prepare('SELECT * FROM conexiones WHERE id = ?'),
    porAlias: db.prepare('SELECT id FROM conexiones WHERE alias = ?'),
    insertar: db.prepare(`INSERT INTO conexiones (alias, motor, host, puerto, servicio, usuario_bd, creado_por, creado)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    activa: db.prepare('UPDATE conexiones SET activa = ? WHERE id = ?'),
  };

  r.get('/', mw.requiere('conexiones:ver'), (req, res) => {
    res.json({ conexiones: q.listar.all().map(publica), motores: Object.entries(MOTORES).map(([id, m]) => ({ id, nombre: m.nombre, puerto: m.puertoPorDefecto })) });
  });

  r.post('/', mw.requiere('conexiones:gestionar'), (req, res) => {
    const d = validar(req.body || {});
    if (q.porAlias.get(d.alias)) throw new ErrorValidacion('Ya existe una conexión con ese alias.', 409);
    // La contraseña de la base nunca se guarda: no se lee del cuerpo de la petición
    const id = q.insertar.run(d.alias, d.motor, d.host, d.puerto, d.servicio, d.usuario, req.usuario.id, new Date().toISOString()).lastInsertRowid;
    auditoria.desdePeticion(req, { accion: 'CONEXION_ALTA', objeto: `conexion:${d.alias}`, resultado: 'OK',
      detalle: { host: d.host, puerto: d.puerto, servicio: d.servicio, usuario: d.usuario } });
    res.status(201).json({ conexion: publica(q.porId.get(id)) });
  });

  r.patch('/:id/activa', mw.requiere('conexiones:gestionar'), (req, res) => {
    const c = q.porId.get(Number.parseInt(req.params.id, 10));
    if (!c) return res.status(404).json({ error: 'Conexión no encontrada.' });
    const activa = Boolean((req.body || {}).activa);
    q.activa.run(activa ? 1 : 0, c.id);
    auditoria.desdePeticion(req, { accion: activa ? 'CONEXION_REACTIVACION' : 'CONEXION_BAJA', objeto: `conexion:${c.alias}`, resultado: 'OK' });
    res.json({ conexion: publica(q.porId.get(c.id)) });
  });

  r.post('/:id/probar', mw.requiere('ejecuciones:ejecutar'), async (req, res) => {
    const c = q.porId.get(Number.parseInt(req.params.id, 10));
    if (!c) return res.status(404).json({ error: 'Conexión no encontrada.' });
    const clave = (req.body || {}).clave;
    if (!clave) return res.status(400).json({ error: 'Ingrese la contraseña de la base para probar la conexión.' });
    try {
      const info = await ejecutor.probar(c, clave);
      auditoria.desdePeticion(req, { accion: 'CONEXION_PRUEBA', objeto: `conexion:${c.alias}`, resultado: 'OK',
        detalle: { version: info.version, contenedor: info.contenedor, cifrado: info.red.cifrado } });
      res.json({ ok: true, info });
    } catch (e) {
      const msg = String(e.message || e).split('\n')[0];
      auditoria.desdePeticion(req, { accion: 'CONEXION_PRUEBA', objeto: `conexion:${c.alias}`, resultado: 'ERROR', detalle: msg });
      res.status(502).json({ error: `No se pudo conectar: ${msg}` });
    }
  });

  return r;
}

module.exports = rutasConexiones;
