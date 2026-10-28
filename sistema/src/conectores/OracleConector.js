'use strict';
// Conector Oracle con node-oracledb en modo Thick (Instant Client). El modo Thin no soporta el
// cifrado de red nativo de Oracle (SQLNET.ENCRYPTION_SERVER=REQUIRED), por eso se usa Thick.
const { Conector } = require('./Conector');
const { asegurarSoloLectura } = require('../motor/seguridadSql');

let oracledb = null;
let inicializado = false;

function inicializarCliente(libDir) {
  if (inicializado) return oracledb;
  oracledb = require('oracledb');
  oracledb.initOracleClient(libDir ? { libDir } : undefined);
  oracledb.fetchAsString = [oracledb.CLOB];
  inicializado = true;
  return oracledb;
}

function dosDigitos(n) { return String(n).padStart(2, '0'); }

// Fechas en formato fijo (UTC del contenedor = hora del servidor sin zona); RAW en hexadecimal
function normalizar(v) {
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${dosDigitos(v.getUTCMonth() + 1)}-${dosDigitos(v.getUTCDate())} ` +
      `${dosDigitos(v.getUTCHours())}:${dosDigitos(v.getUTCMinutes())}:${dosDigitos(v.getUTCSeconds())}`;
  }
  if (Buffer.isBuffer(v)) return v.toString('hex').toUpperCase();
  return v;
}

class OracleConector extends Conector {
  static get motor() { return 'oracle'; }

  constructor({ libDir, timeoutConexionS = 10 } = {}) {
    super();
    this.libDir = libDir;
    this.timeoutConexionS = timeoutConexionS;
    this.conexion = null;
    this.datos = null;
  }

  cadena({ host, puerto, servicio }) {
    return `${host}:${puerto}/${servicio}`;
  }

  async abrir(datos) {
    const db = inicializarCliente(this.libDir);
    this.datos = { host: datos.host, puerto: datos.puerto, servicio: datos.servicio, usuario: datos.usuario };
    // La clave solo se pasa al controlador; no se guarda en el objeto
    this.conexion = await db.getConnection({
      user: datos.usuario,
      password: datos.clave,
      connectString: `${this.cadena(datos)}?connect_timeout=${this.timeoutConexionS}`,
    });
    return this;
  }

  async consultar(sql, binds = {}, { timeoutMs = 20000, maxFilas = 200 } = {}) {
    asegurarSoloLectura(sql);
    if (!this.conexion) throw new Error('Conexión no abierta');
    this.conexion.callTimeout = timeoutMs;
    const r = await this.conexion.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_ARRAY, maxRows: maxFilas + 1 });
    const columnas = r.metaData.map((m) => m.name);
    const filas = r.rows.map((f) => f.map(normalizar));
    const truncado = filas.length > maxFilas;
    return { columnas, filas: truncado ? filas.slice(0, maxFilas) : filas, truncado };
  }

  async informacion() {
    const ctx = await this.consultar(`SELECT SYS_CONTEXT('USERENV', 'SESSION_USER') usuario,
       SYS_CONTEXT('USERENV', 'CON_NAME') contenedor,
       SYS_CONTEXT('USERENV', 'CDB_NAME') cdb,
       SYS_CONTEXT('USERENV', 'SERVER_HOST') servidor,
       SYS_CONTEXT('USERENV', 'INSTANCE_NAME') instancia
  FROM dual`);
    const [usuario, contenedor, cdb, servidor, instancia] = ctx.filas[0];
    let version = this.conexion.oracleServerVersionString;
    let banner = null;
    try {
      const v = await this.consultar('SELECT banner_full FROM v$version');
      banner = v.filas.length ? String(v.filas[0][0]).split('\n')[0] : null;
    } catch { /* sin permiso sobre V$VERSION: se usa la versión del protocolo */ }
    let red = { cifrado: null, integridad: null, banners: [] };
    try {
      const b = await this.consultar(`SELECT network_service_banner FROM v$session_connect_info
 WHERE sid = SYS_CONTEXT('USERENV', 'SID')`);
      const lineas = b.filas.map((f) => f[0]);
      const alg = lineas.map((l) => /^(\S+) Encryption service adapter/.exec(l)).find(Boolean);
      const chk = lineas.map((l) => /^(\S+) Crypto-checksumming service adapter/.exec(l)).find(Boolean);
      red = { cifrado: alg ? alg[1] : null, integridad: chk ? chk[1] : null, banners: lineas };
    } catch (e) { red.error = e.message; }
    return { motor: 'Oracle', usuario, contenedor, cdb, servidor, instancia, version, banner, red,
      cliente: oracledb.oracleClientVersionString, modo: oracledb.thin ? 'Thin' : 'Thick' };
  }

  comandoEquivalente() {
    const d = this.datos || {};
    return `sqlplus ${String(d.usuario || '').toLowerCase()}/********@//${d.host}:${d.puerto}/${d.servicio}`;
  }

  async cerrar() {
    if (this.conexion) {
      try { await this.conexion.close(); } catch { /* ya cerrada */ }
      this.conexion = null;
    }
  }
}

module.exports = OracleConector;
