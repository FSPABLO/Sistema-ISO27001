'use strict';
// Consulta del registro de auditoría. Solo lectura: no hay rutas para modificar ni borrar registros.
const express = require('express');

function rutasAuditoria({ db, auditoria, mw }) {
  const r = express.Router();
  r.use(mw.requiere('auditoria:ver'));

  r.get('/', (req, res) => {
    const where = [];
    const params = [];
    const filtro = (campo, valor, op = '=') => { if (valor) { where.push(`${campo} ${op} ?`); params.push(String(valor)); } };
    filtro('usuario', req.query.usuario);
    filtro('accion', req.query.accion);
    filtro('resultado', req.query.resultado);
    filtro('fecha', req.query.desde, '>=');
    if (req.query.hasta) { where.push('fecha <= ?'); params.push(String(req.query.hasta) + 'T23:59:59.999Z'); }
    if (req.query.texto) { where.push('(objeto LIKE ? OR detalle LIKE ? OR ip LIKE ?)'); const t = `%${String(req.query.texto)}%`; params.push(t, t, t); }
    const limite = Math.min(1000, Number.parseInt(req.query.limite, 10) || 300);
    const condicion = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const filas = db.prepare(`SELECT * FROM audit_log ${condicion} ORDER BY id DESC LIMIT ${limite}`).all(...params);
    const total = db.prepare(`SELECT COUNT(*) n FROM audit_log ${condicion}`).get(...params).n;
    const acciones = db.prepare('SELECT DISTINCT accion FROM audit_log ORDER BY accion').all().map((f) => f.accion);
    const usuarios = db.prepare('SELECT DISTINCT usuario FROM audit_log WHERE usuario IS NOT NULL ORDER BY usuario').all().map((f) => f.usuario);
    auditoria.desdePeticion(req, { accion: 'AUDITORIA_CONSULTA', objeto: 'audit_log', resultado: 'OK', detalle: { filas: filas.length } });
    res.json({ registros: filas, total, acciones, usuarios });
  });

  r.get('/verificar', (req, res) => {
    const v = auditoria.verificar();
    auditoria.desdePeticion(req, { accion: 'AUDITORIA_VERIFICACION', objeto: 'audit_log', resultado: v.integro ? 'OK' : 'ALERTA', detalle: v.motivo });
    res.json(v);
  });

  return r;
}

module.exports = rutasAuditoria;
