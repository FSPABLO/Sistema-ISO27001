'use strict';
// Base SQLite propia del sistema (usuarios, sesiones, conexiones, ejecuciones y auditoría).
// Nunca se usa la base auditada para guardar datos del sistema.
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id                INTEGER PRIMARY KEY,
  usuario           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre            TEXT NOT NULL,
  rol               TEXT NOT NULL CHECK (rol IN ('administrador','analista','auditor')),
  hash              TEXT NOT NULL,
  activo            INTEGER NOT NULL DEFAULT 1,
  debe_cambiar      INTEGER NOT NULL DEFAULT 0,
  intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta   TEXT,
  ultimo_ingreso    TEXT,
  creado            TEXT NOT NULL,
  actualizado       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sesiones (
  sid    TEXT PRIMARY KEY,
  datos  TEXT NOT NULL,
  expira INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS conexiones (
  id          INTEGER PRIMARY KEY,
  alias       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  motor       TEXT NOT NULL DEFAULT 'oracle',
  host        TEXT NOT NULL,
  puerto      INTEGER NOT NULL,
  servicio    TEXT NOT NULL,
  usuario_bd  TEXT NOT NULL,
  activa      INTEGER NOT NULL DEFAULT 1,
  creado_por  INTEGER REFERENCES usuarios(id),
  creado      TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ejecuciones (
  id                INTEGER PRIMARY KEY,
  conexion_id       INTEGER NOT NULL REFERENCES conexiones(id),
  usuario_id        INTEGER NOT NULL REFERENCES usuarios(id),
  inicio            TEXT NOT NULL,
  fin               TEXT,
  estado            TEXT NOT NULL CHECK (estado IN ('EN CURSO','TERMINADA','ERROR')),
  progreso          INTEGER NOT NULL DEFAULT 0,
  total             INTEGER NOT NULL DEFAULT 0,
  paso_actual       TEXT,
  puntaje           REAL,
  resumen           TEXT,
  info_bd           TEXT,
  funcional         INTEGER NOT NULL DEFAULT 0,
  perfil            TEXT,
  conexion_snapshot TEXT NOT NULL,
  error             TEXT
);
CREATE INDEX IF NOT EXISTS ix_ejecuciones_conexion ON ejecuciones(conexion_id);
CREATE INDEX IF NOT EXISTS ix_ejecuciones_usuario ON ejecuciones(usuario_id);
CREATE TABLE IF NOT EXISTS resultados_prueba (
  id           INTEGER PRIMARY KEY,
  ejecucion_id INTEGER NOT NULL REFERENCES ejecuciones(id),
  orden        INTEGER NOT NULL,
  prueba_id    TEXT NOT NULL,
  control_id   TEXT NOT NULL,
  estado       TEXT NOT NULL,
  detalle      TEXT,
  evidencia    TEXT NOT NULL,
  duracion_ms  INTEGER
);
CREATE INDEX IF NOT EXISTS ix_resultados_ejecucion ON resultados_prueba(ejecucion_id);
CREATE TABLE IF NOT EXISTS resultados_control (
  ejecucion_id INTEGER NOT NULL REFERENCES ejecuciones(id),
  control_id   TEXT NOT NULL,
  estado       TEXT NOT NULL,
  peso         INTEGER NOT NULL,
  valor        REAL,
  madurez      INTEGER,
  motivo       TEXT,
  PRIMARY KEY (ejecucion_id, control_id)
);
-- Registro de auditoría de solo inserción con hash encadenado
CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha         TEXT NOT NULL,
  usuario       TEXT,
  rol           TEXT,
  accion        TEXT NOT NULL,
  objeto        TEXT,
  ip            TEXT,
  resultado     TEXT NOT NULL,
  detalle       TEXT,
  hash_anterior TEXT NOT NULL,
  hash          TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS audit_log_sin_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log es de solo insercion'); END;
CREATE TRIGGER IF NOT EXISTS audit_log_sin_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log es de solo insercion'); END;
`;

function abrir(archivo) {
  if (archivo !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(archivo)), { recursive: true });
  const db = new Database(archivo);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(ESQUEMA);
  // El cambio obligatorio de contraseña se retiró: ninguna cuenta queda pendiente de cambiarla
  db.prepare('UPDATE usuarios SET debe_cambiar = 0 WHERE debe_cambiar = 1').run();
  // Una ejecución que quedó "EN CURSO" tras un reinicio no puede continuar: la clave ya no existe.
  db.prepare(`UPDATE ejecuciones SET estado = 'ERROR', fin = ?, error = 'El servidor se reinició durante la ejecución'
               WHERE estado = 'EN CURSO'`).run(new Date().toISOString());
  return db;
}

module.exports = { abrir };
