'use strict';
// Almacén de sesiones de express-session sobre SQLite (sobrevive a reinicios si SESSION_SECRET es fijo).
const session = require('express-session');

class AlmacenSesiones extends session.Store {
  constructor(db, { limpiezaMs = 10 * 60 * 1000 } = {}) {
    super();
    this.db = db;
    this.sqlGet = db.prepare('SELECT datos, expira FROM sesiones WHERE sid = ?');
    this.sqlSet = db.prepare(`INSERT INTO sesiones (sid, datos, expira) VALUES (?, ?, ?)
                               ON CONFLICT(sid) DO UPDATE SET datos = excluded.datos, expira = excluded.expira`);
    this.sqlDel = db.prepare('DELETE FROM sesiones WHERE sid = ?');
    this.sqlTouch = db.prepare('UPDATE sesiones SET expira = ? WHERE sid = ?');
    this.sqlLimpiar = db.prepare('DELETE FROM sesiones WHERE expira < ?');
    this.temporizador = setInterval(() => this.sqlLimpiar.run(Date.now()), limpiezaMs);
    this.temporizador.unref();
  }

  expiracion(sesion) {
    const exp = sesion && sesion.cookie && sesion.cookie.expires;
    return exp ? new Date(exp).getTime() : Date.now() + 20 * 60 * 1000;
  }

  get(sid, cb) {
    try {
      const fila = this.sqlGet.get(sid);
      if (!fila || fila.expira < Date.now()) return cb(null, null);
      cb(null, JSON.parse(fila.datos));
    } catch (e) { cb(e); }
  }

  set(sid, sesion, cb) {
    try { this.sqlSet.run(sid, JSON.stringify(sesion), this.expiracion(sesion)); cb && cb(null); } catch (e) { cb && cb(e); }
  }

  destroy(sid, cb) {
    try { this.sqlDel.run(sid); cb && cb(null); } catch (e) { cb && cb(e); }
  }

  touch(sid, sesion, cb) {
    try { this.sqlTouch.run(this.expiracion(sesion), sid); cb && cb(null); } catch (e) { cb && cb(e); }
  }

  cerrar() { clearInterval(this.temporizador); }
}

module.exports = AlmacenSesiones;
