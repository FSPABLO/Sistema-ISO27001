'use strict';
// Configuración leída de variables de entorno. No hay secretos escritos en el código.
const crypto = require('node:crypto');

function entero(valor, porDefecto) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : porDefecto;
}

const config = {
  puerto: entero(process.env.PORT, 3000),
  dbArchivo: process.env.DB_ARCHIVO || './datos/sistema.db',
  sessionSecret: process.env.SESSION_SECRET || '',
  inactividadMin: entero(process.env.SESION_INACTIVIDAD_MIN, 20),
  cookieSegura: process.env.COOKIE_SECURE === 'true',
  confiarProxy: process.env.TRUST_PROXY === 'true',
  adminUsuario: process.env.ADMIN_USER || '',
  adminClave: process.env.ADMIN_PASSWORD || '',
  oracleLibDir: process.env.ORACLE_LIB_DIR || '/opt/oracle/instantclient',
  // Permite crear una cuenta propia desde la pantalla de inicio de sesión (rol analista)
  permitirRegistro: process.env.PERMITIR_REGISTRO !== 'false',
  timeoutPruebaMs: entero(process.env.TIMEOUT_PRUEBA_MS, 20000),
  timeoutConexionS: entero(process.env.TIMEOUT_CONEXION_S, 10),
  intentosMaximos: 5,
  bloqueoMin: entero(process.env.BLOQUEO_MIN, 15),
  limiteLoginVentanaMin: 15,
  limiteLoginMax: entero(process.env.LIMITE_LOGIN_MAX, 30),
};

if (!config.sessionSecret) {
  // Sin SESSION_SECRET se genera uno aleatorio: las sesiones no sobreviven a un reinicio.
  config.sessionSecret = crypto.randomBytes(32).toString('hex');
  config.secretoGenerado = true;
}

module.exports = config;
