'use strict';
// Utilidades de prueba: base SQLite en memoria, conector simulado y cliente HTTP con sesión y CSRF.
const request = require('supertest');
const { abrir } = require('../src/db');
const { crearApp } = require('../src/app');
const { Conector } = require('../src/conectores/Conector');
const { asegurarSoloLectura } = require('../src/motor/seguridadSql');

const CLAVE_ADMIN = 'Inicial_Prueba_2026!';

class ConectorSimulado extends Conector {
  static get motor() { return 'oracle'; }
  constructor(respuestas, registro) {
    super();
    this.respuestas = respuestas;
    this.registro = registro;
  }
  async abrir(datos) {
    this.registro.aperturas.push({ ...datos });
    if (datos.clave === 'clave-mala') throw new Error('ORA-01017: invalid credential or not authorized; logon denied');
    this.datos = datos;
  }
  async consultar(sql, binds = {}) {
    asegurarSoloLectura(sql);
    this.registro.consultas.push({ usuario: this.datos.usuario, sql, binds });
    const r = this.respuestas(sql, this.datos.usuario, binds);
    if (r instanceof Error) throw r;
    return r || { columnas: ['X'], filas: [] };
  }
  async informacion() {
    return { motor: 'Oracle', usuario: this.datos.usuario, contenedor: 'FREEPDB1', version: '23.26.3.0.0',
      red: { cifrado: 'AES256', integridad: 'SHA512', banners: [] }, modo: 'Thick' };
  }
  comandoEquivalente() { return `sqlplus ${this.datos.usuario.toLowerCase()}/********@//${this.datos.host}:${this.datos.puerto}/${this.datos.servicio}`; }
}

function crearEntorno({ respuestas = () => null, config: extra = {} } = {}) {
  const db = abrir(':memory:');
  const registro = { aperturas: [], consultas: [] };
  const config = {
    sessionSecret: 'secreto-de-prueba', inactividadMin: 20, cookieSegura: false, confiarProxy: false,
    adminUsuario: 'admin', adminClave: CLAVE_ADMIN, timeoutPruebaMs: 2000, intentosMaximos: 5, bloqueoMin: 15,
    limiteLoginVentanaMin: 15, limiteLoginMax: 1000, permitirRegistro: true, ...extra,
  };
  const fabricaConectores = () => new ConectorSimulado(respuestas, registro);
  const entorno = crearApp({ db, config, fabricaConectores });
  return { ...entorno, db, registro, config };
}

// Agente con cookie de sesión y token CSRF
async function agente(app) {
  const a = request.agent(app);
  const { body } = await a.get('/api/auth/csrf');
  a.csrf = body.csrf;
  a.enviar = (metodo, url, datos) => a[metodo](url).set('X-CSRF-Token', a.csrf).send(datos);
  a.ingresar = async (usuario, clave) => {
    const r = await a.enviar('post', '/api/auth/login', { usuario, clave });
    if (r.body.csrf) a.csrf = r.body.csrf;
    return r;
  };
  return a;
}

// Crea el admin inicial, cambia su clave y devuelve un agente autenticado
async function adminListo(entorno, nuevaClave = 'Definitiva_Prueba_2026!') {
  await entorno.servicios.usuarios.asegurarAdministrador();
  const a = await agente(entorno.app);
  await a.ingresar('admin', CLAVE_ADMIN);
  await a.enviar('post', '/api/auth/cambiar-clave', { actual: CLAVE_ADMIN, nueva: nuevaClave });
  return a;
}

async function usuarioListo(entorno, admin, usuario, rol, clave = 'Clave_Larga_Prueba_2026') {
  await admin.enviar('post', '/api/usuarios', { usuario, nombre: `Persona ${usuario}`, rol, clave });
  const a = await agente(entorno.app);
  await a.ingresar(usuario, clave);
  const nueva = clave + 'X';
  await a.enviar('post', '/api/auth/cambiar-clave', { actual: clave, nueva });
  return a;
}

async function esperarFin(a, id, intentos = 100) {
  for (let i = 0; i < intentos; i++) {
    const r = await a.get(`/api/ejecuciones/${id}/progreso`);
    if (r.body.estado !== 'EN CURSO') return r.body;
    await new Promise((ok) => setTimeout(ok, 20));
  }
  throw new Error('La ejecución no terminó');
}

module.exports = { crearEntorno, agente, adminListo, usuarioListo, esperarFin, CLAVE_ADMIN, ConectorSimulado };
