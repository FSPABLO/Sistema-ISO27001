'use strict';
// Construye la aplicación Express. Recibe sus dependencias para poder probarla con un conector simulado.
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const AlmacenSesiones = require('./db/almacenSesiones');
const { crearAuditoria } = require('./audit');
const { crearServicioUsuarios, ErrorValidacion } = require('./auth/usuarios');
const { csrf, crearMiddlewares } = require('./auth/middleware');
const permisos = require('./auth/permisos');
const { crearEjecutor } = require('./motor/ejecutor');
const { ErrorSeguridadSql } = require('./motor/seguridadSql');
const { catalogoPublico } = require('./catalogo');

function crearApp({ db, config, fabricaConectores }) {
  const app = express();
  const auditoria = crearAuditoria(db);
  const servicios = { usuarios: crearServicioUsuarios(db, config) };
  const ejecutor = crearEjecutor({ db, fabricaConectores, auditoria, config });
  const mw = crearMiddlewares({ db, auditoria });
  const almacen = new AlmacenSesiones(db);

  app.disable('x-powered-by');
  if (config.confiarProxy) app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': config.cookieSegura ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    // COOP y HSTS solo tienen efecto sobre HTTPS; en HTTP fuera de localhost el navegador los ignora con un error en consola
    crossOriginOpenerPolicy: config.cookieSegura ? { policy: 'same-origin' } : false,
    hsts: config.cookieSegura,
  }));
  app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  app.use(express.json({ limit: '100kb' }));
  app.use(session({
    name: 'sid',
    secret: config.sessionSecret,
    store: almacen,
    resave: false,
    saveUninitialized: false,
    rolling: true, // la expiración se reinicia con cada petición: expira por inactividad
    cookie: { httpOnly: true, sameSite: 'strict', secure: config.cookieSegura, maxAge: config.inactividadMin * 60 * 1000 },
  }));

  // ---------- API ----------
  const api = express.Router();
  api.use(csrf);
  api.use('/auth', require('./rutas/auth')({ servicios, auditoria, mw, config }));
  api.use(mw.autenticado, mw.sinCambioPendiente);
  api.get('/catalogo', (req, res) => res.json(catalogoPublico()));
  api.get('/panel', (req, res) => {
    const propias = !permisos.veTodas(req.usuario);
    const filtro = propias ? 'WHERE e.usuario_id = ?' : '';
    const params = propias ? [req.usuario.id] : [];
    const ultimas = db.prepare(`SELECT e.id, e.inicio, e.estado, e.puntaje, e.resumen, e.conexion_snapshot, u.usuario
      FROM ejecuciones e JOIN usuarios u ON u.id = e.usuario_id ${filtro} ORDER BY e.id DESC LIMIT 8`).all(...params)
      .map((f) => ({ id: f.id, inicio: f.inicio, estado: f.estado, puntaje: f.puntaje, usuario: f.usuario,
        conexion: JSON.parse(f.conexion_snapshot).alias, conteo: f.resumen ? JSON.parse(f.resumen).conteo : null }));
    const conexiones = db.prepare(`SELECT c.id, c.alias, c.host, c.puerto, c.servicio, c.usuario_bd usuario, c.activa,
        (SELECT e.puntaje FROM ejecuciones e WHERE e.conexion_id = c.id AND e.estado = 'TERMINADA' ${propias ? 'AND e.usuario_id = ?' : ''} ORDER BY e.id DESC LIMIT 1) ultimo_puntaje,
        (SELECT e.inicio FROM ejecuciones e WHERE e.conexion_id = c.id ${propias ? 'AND e.usuario_id = ?' : ''} ORDER BY e.id DESC LIMIT 1) ultima_fecha
      FROM conexiones c WHERE c.activa = 1 ORDER BY c.alias`).all(...(propias ? [req.usuario.id, req.usuario.id] : []));
    const totales = db.prepare(`SELECT COUNT(*) n, SUM(estado = 'TERMINADA') terminadas FROM ejecuciones e ${filtro}`).get(...params);
    res.json({ ultimas, conexiones, totales });
  });
  api.use('/usuarios', require('./rutas/usuarios')({ servicios, auditoria, mw }));
  api.use('/conexiones', require('./rutas/conexiones')({ db, auditoria, mw, ejecutor }));
  api.use('/ejecuciones', require('./rutas/ejecuciones')({ db, auditoria, mw, ejecutor }));
  api.use('/auditoria', require('./rutas/auditoria')({ db, auditoria, mw }));
  api.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use('/api', api);

  // ---------- interfaz ----------
  const publico = path.join(__dirname, '..', 'public');
  // Chart.js se sirve desde node_modules (sin CDN); su "exports" no expone dist/, se ubica junto a su entrada CommonJS (dist/chart.cjs)
  const chartUmd = path.join(path.dirname(require.resolve('chart.js')), 'chart.umd.min.js');
  app.get('/vendor/chart.umd.min.js', (req, res) => res.type('application/javascript').sendFile(chartUmd));
  app.use(express.static(publico, { index: 'index.html', maxAge: 0 }));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(publico, 'index.html')));

  // Errores: nunca se devuelve el cuerpo de la petición ni la pila
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err instanceof ErrorValidacion) return res.status(err.estado).json({ error: err.message, errores: err.mensajes });
    if (err instanceof ErrorSeguridadSql) return res.status(400).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON no válido.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Petición demasiado grande.' });
    console.error('[error]', req.method, req.path, String(err && err.message).split('\n')[0]);
    res.status(500).json({ error: 'Error interno del servidor.' });
  });

  return { app, auditoria, servicios, ejecutor, almacen };
}

module.exports = { crearApp };
