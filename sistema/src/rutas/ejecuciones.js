'use strict';
const express = require('express');
const permisos = require('../auth/permisos');
const pt = require('../motor/puntaje');
const { ErrorSeguridadSql } = require('../motor/seguridadSql');
const { CONTROLES } = require('../catalogo');

const COLUMNAS_LISTA = `e.id, e.conexion_id, e.usuario_id, e.inicio, e.fin, e.estado, e.puntaje, e.funcional, e.perfil,
  e.conexion_snapshot, e.resumen, e.error, u.usuario, u.nombre usuario_nombre, c.alias`;

function filaLista(f) {
  const resumen = f.resumen ? JSON.parse(f.resumen) : null;
  return {
    id: f.id, conexionId: f.conexion_id, conexion: JSON.parse(f.conexion_snapshot).alias || f.alias,
    usuarioId: f.usuario_id, usuario: f.usuario, usuarioNombre: f.usuario_nombre,
    inicio: f.inicio, fin: f.fin, estado: f.estado, puntaje: f.puntaje, funcional: Boolean(f.funcional), perfil: f.perfil,
    conteo: resumen ? resumen.conteo : null, error: f.error,
  };
}

function rutasEjecuciones({ db, auditoria, mw, ejecutor }) {
  const r = express.Router();
  const q = {
    porId: db.prepare(`SELECT e.*, u.usuario, u.nombre usuario_nombre, c.alias FROM ejecuciones e
                         JOIN usuarios u ON u.id = e.usuario_id JOIN conexiones c ON c.id = e.conexion_id WHERE e.id = ?`),
    pruebas: db.prepare('SELECT * FROM resultados_prueba WHERE ejecucion_id = ? ORDER BY orden'),
    controles: db.prepare('SELECT * FROM resultados_control WHERE ejecucion_id = ?'),
    conexion: db.prepare('SELECT * FROM conexiones WHERE id = ?'),
  };

  function cargar(req, res, id) {
    const e = q.porId.get(id);
    if (!e) { res.status(404).json({ error: 'Ejecución no encontrada.' }); return null; }
    if (!permisos.puedeVerEjecucion(req.usuario, e)) {
      auditoria.desdePeticion(req, { accion: 'ACCESO_DENEGADO', objeto: `ejecucion:${id}`, resultado: 'DENEGADO', detalle: 'Ejecución de otro usuario' });
      res.status(403).json({ error: 'Solo puede ver sus propias ejecuciones.' });
      return null;
    }
    return e;
  }

  function detalle(e) {
    const filasControl = Object.fromEntries(q.controles.all(e.id).map((c) => [c.control_id, c]));
    const pruebas = q.pruebas.all(e.id).map((p) => ({
      pruebaId: p.prueba_id, controlId: p.control_id, estado: p.estado, detalle: p.detalle,
      duracionMs: p.duracion_ms, ...JSON.parse(p.evidencia),
    }));
    const controles = CONTROLES.map((c) => {
      const fc = filasControl[c.id];
      return { controlId: c.id, nombre: c.nombre, tema: c.tema, tarea: c.tarea, tareaNombre: c.tareaNombre, peso: c.peso,
        riesgos: c.riesgos, adicional: Boolean(c.adicional),
        estado: fc ? fc.estado : null, valor: fc ? fc.valor : null, madurez: fc ? fc.madurez : null, motivo: fc ? fc.motivo : null };
    });
    return {
      ...filaLista(e), conexionDatos: JSON.parse(e.conexion_snapshot), info: e.info_bd ? JSON.parse(e.info_bd) : null,
      resumen: e.resumen ? JSON.parse(e.resumen) : null, controles, pruebas,
      progreso: e.estado === 'EN CURSO' ? (ejecutor.progreso(e.id) || { progreso: e.progreso, total: e.total, paso: e.paso_actual }) : null,
    };
  }

  // Historial con filtros (el analista solo ve las propias)
  r.get('/', mw.requiere('ejecuciones:ver'), (req, res) => {
    const where = [];
    const params = [];
    if (!permisos.veTodas(req.usuario)) { where.push('e.usuario_id = ?'); params.push(req.usuario.id); } else if (req.query.usuario) { where.push('u.usuario = ?'); params.push(String(req.query.usuario)); }
    if (req.query.conexion) { where.push('e.conexion_id = ?'); params.push(Number.parseInt(req.query.conexion, 10)); }
    if (req.query.desde) { where.push('e.inicio >= ?'); params.push(String(req.query.desde)); }
    if (req.query.hasta) { where.push('e.inicio <= ?'); params.push(String(req.query.hasta) + 'T23:59:59.999Z'); }
    const limite = Math.min(500, Number.parseInt(req.query.limite, 10) || 200);
    const filas = db.prepare(`SELECT ${COLUMNAS_LISTA} FROM ejecuciones e JOIN usuarios u ON u.id = e.usuario_id
      JOIN conexiones c ON c.id = e.conexion_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY e.id DESC LIMIT ${limite}`).all(...params);
    if (req.query.registrar !== 'no') {
      auditoria.desdePeticion(req, { accion: 'HISTORIAL_CONSULTA', objeto: 'historial', resultado: 'OK',
        detalle: { filtros: { usuario: req.query.usuario, conexion: req.query.conexion, desde: req.query.desde, hasta: req.query.hasta }, filas: filas.length } });
    }
    res.json({ ejecuciones: filas.map(filaLista) });
  });

  r.post('/', mw.requiere('ejecuciones:ejecutar'), (req, res) => {
    const { conexionId, clave, funcional } = req.body || {};
    const cx = q.conexion.get(Number.parseInt(conexionId, 10));
    if (!cx || !cx.activa) return res.status(404).json({ error: 'Conexión no encontrada o inactiva.' });
    if (!clave) return res.status(400).json({ error: 'Ingrese la contraseña de la base de datos.' });
    try {
      const { id } = ejecutor.iniciar({ conexion: cx, usuario: req.usuario, clave, funcional, ip: String(req.ip || '').replace(/^::ffff:/, '') });
      res.status(202).json({ id });
    } catch (e) {
      if (e instanceof ErrorSeguridadSql) return res.status(400).json({ error: e.message });
      throw e;
    }
  });

  r.get('/comparar', mw.requiere('ejecuciones:ver'), (req, res) => {
    const a = cargar(req, res, Number.parseInt(req.query.a, 10)); if (!a) return;
    const b = cargar(req, res, Number.parseInt(req.query.b, 10)); if (!b) return;
    if (a.conexion_id !== b.conexion_id) return res.status(400).json({ error: 'Solo se pueden comparar ejecuciones de la misma conexión.' });
    if (a.estado !== 'TERMINADA' || b.estado !== 'TERMINADA') return res.status(400).json({ error: 'Ambas ejecuciones deben estar terminadas.' });
    const [anterior, posterior] = a.id < b.id ? [a, b] : [b, a];
    const da = detalle(anterior); const dbb = detalle(posterior);
    const comparacion = pt.comparar(da.controles, dbb.controles, da.puntaje, dbb.puntaje);
    auditoria.desdePeticion(req, { accion: 'COMPARACION_CONSULTA', objeto: `ejecucion:${anterior.id}↔${posterior.id}`, resultado: 'OK' });
    res.json({ anterior: filaLista(anterior), posterior: filaLista(posterior), ...comparacion });
  });

  r.get('/:id/progreso', mw.requiere('ejecuciones:ver'), (req, res) => {
    const e = cargar(req, res, Number.parseInt(req.params.id, 10)); if (!e) return;
    const p = ejecutor.progreso(e.id);
    res.json({ estado: e.estado, progreso: p ? p.progreso : e.progreso, total: p ? p.total : e.total, paso: p ? p.paso : e.paso_actual, error: e.error });
  });

  r.get('/:id', mw.requiere('ejecuciones:ver'), (req, res) => {
    const e = cargar(req, res, Number.parseInt(req.params.id, 10)); if (!e) return;
    if (req.query.registrar !== 'no') {
      auditoria.desdePeticion(req, { accion: req.query.vista === 'informe' ? 'INFORME_CONSULTA' : 'RESULTADO_CONSULTA', objeto: `ejecucion:${e.id}`, resultado: 'OK' });
    }
    res.json({ ejecucion: detalle(e) });
  });

  // La interfaz avisa cuando el usuario imprime o guarda el informe como PDF
  r.post('/:id/informe', mw.requiere('informes:ver'), (req, res) => {
    const e = cargar(req, res, Number.parseInt(req.params.id, 10)); if (!e) return;
    const accion = (req.body || {}).accion === 'descarga' ? 'INFORME_DESCARGA' : 'INFORME_IMPRESION';
    auditoria.desdePeticion(req, { accion, objeto: `ejecucion:${e.id}`, resultado: 'OK' });
    res.json({ ok: true });
  });

  r.get('/:id/descarga', mw.requiere('informes:ver'), (req, res) => {
    const e = cargar(req, res, Number.parseInt(req.params.id, 10)); if (!e) return;
    auditoria.desdePeticion(req, { accion: 'INFORME_DESCARGA', objeto: `ejecucion:${e.id}`, resultado: 'OK', detalle: 'JSON de evidencia' });
    res.setHeader('Content-Disposition', `attachment; filename="ejecucion-${e.id}-evidencia.json"`);
    res.json({ generado: new Date().toISOString(), ejecucion: detalle(e) });
  });

  return r;
}

module.exports = rutasEjecuciones;
