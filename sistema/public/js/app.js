// Aplicación de una sola página: sesión, navegación por rol y enrutador por hash.
import { api, configurar, iniciarCsrf } from './api.js';
import { html, icono, esc, notificar, copiar, activarOjos } from './ui.js';
import * as vistaLogin from './vistas/login.js';
import * as vistaRegistro from './vistas/registro.js';
import * as vistaClave from './vistas/cambiarClave.js';
import * as vistaPanel from './vistas/panel.js';
import * as vistaConexiones from './vistas/conexiones.js';
import * as vistaNueva from './vistas/nuevaEjecucion.js';
import * as vistaResultados from './vistas/resultados.js';
import * as vistaHistorial from './vistas/historial.js';
import * as vistaComparar from './vistas/comparar.js';
import * as vistaAuditoria from './vistas/auditoria.js';
import * as vistaUsuarios from './vistas/usuarios.js';
import * as vistaInforme from './vistas/informe.js';
import * as vistaCatalogo from './vistas/catalogo.js';

export const estado = { usuario: null, catalogo: null, limpiar: [], registro: false };

const PUEDE = {
  ejecutar: ['administrador', 'analista'],
  usuarios: ['administrador'],
  auditoria: ['administrador', 'auditor'],
};
export const puede = (accion) => Boolean(estado.usuario && PUEDE[accion].includes(estado.usuario.rol));

const RUTAS = [
  { patron: /^\/login$/, vista: vistaLogin, publica: true },
  { patron: /^\/registro$/, vista: vistaRegistro, publica: true },
  { patron: /^\/cambiar-clave$/, vista: vistaClave, sinCambio: true },
  { patron: /^\/$/, vista: vistaPanel, menu: 'panel' },
  { patron: /^\/conexiones$/, vista: vistaConexiones, menu: 'conexiones' },
  { patron: /^\/nueva$/, vista: vistaNueva, menu: 'nueva', permiso: 'ejecutar' },
  { patron: /^\/ejecucion\/(\d+)$/, vista: vistaResultados, menu: 'historial' },
  { patron: /^\/historial$/, vista: vistaHistorial, menu: 'historial' },
  { patron: /^\/comparar\/(\d+)\/(\d+)$/, vista: vistaComparar, menu: 'historial' },
  { patron: /^\/auditoria$/, vista: vistaAuditoria, menu: 'auditoria', permiso: 'auditoria' },
  { patron: /^\/usuarios$/, vista: vistaUsuarios, menu: 'usuarios', permiso: 'usuarios' },
  { patron: /^\/informe\/(\d+)$/, vista: vistaInforme, menu: 'historial', sinMarco: true },
  { patron: /^\/metodologia$/, vista: vistaCatalogo, menu: 'metodologia' },
];

const ROLES = { administrador: 'Administrador', analista: 'Analista', auditor: 'Auditor' };

export function ir(ruta) {
  if (location.hash === '#' + ruta) enrutar(); else location.hash = ruta;
}

export async function cargarCatalogo() {
  if (!estado.catalogo) estado.catalogo = await api.get('/catalogo');
  return estado.catalogo;
}

function menu(activo) {
  const items = [
    { id: 'panel', ruta: '/', texto: 'Panel', ico: 'panel' },
    { id: 'nueva', ruta: '/nueva', texto: 'Nueva ejecución', ico: 'ejecutar', permiso: 'ejecutar' },
    { id: 'conexiones', ruta: '/conexiones', texto: 'Conexiones', ico: 'conexion' },
    { id: 'historial', ruta: '/historial', texto: 'Historial', ico: 'historial' },
    { id: 'auditoria', ruta: '/auditoria', texto: 'Registro de auditoría', ico: 'auditoria', permiso: 'auditoria' },
    { id: 'usuarios', ruta: '/usuarios', texto: 'Usuarios', ico: 'usuarios', permiso: 'usuarios' },
    { id: 'metodologia', ruta: '/metodologia', texto: 'Controles y pesos', ico: 'catalogo' },
  ].filter((i) => !i.permiso || puede(i.permiso));
  return items.map((i) => html`<a href="#${i.ruta}" class="nav-item ${i.id === activo ? 'activo' : ''}" ${i.id === activo ? 'aria-current="page"' : ''}>${icono(i.ico)}<span>${i.texto}</span></a>`);
}

function marco(activo) {
  const u = estado.usuario;
  const inicial = esc((u.nombre || u.usuario).trim().charAt(0).toUpperCase());
  return html`
  <aside class="lateral" id="lateral">
    <div class="marca">
      <span class="marca-logo">${icono('escudo')}</span>
      <div><strong>Auditoría ISO 27001</strong><small>Confidencialidad · Oracle</small></div>
    </div>
    <nav class="nav" aria-label="Principal">${menu(activo)}</nav>
    <div class="lateral-pie">
      <div class="perfil"><span class="avatar" aria-hidden="true">${inicial}</span>
        <div><strong>${u.nombre}</strong><small>${u.usuario} · ${ROLES[u.rol]}</small></div></div>
      <a class="nav-item" href="#/cambiar-clave">${icono('llave')}<span>Cambiar contraseña</span></a>
      <button type="button" class="nav-item" id="salir">${icono('salir')}<span>Cerrar sesión</span></button>
    </div>
  </aside>
  <header class="barra-movil">
    <button type="button" class="boton-icono" id="abrir-menu" aria-label="Abrir menú" aria-controls="lateral" aria-expanded="false">${icono('menu')}</button>
    <span class="marca-movil">${icono('escudo')} Auditoría ISO 27001</span>
    <span class="rol-movil">${ROLES[u.rol]}</span>
  </header>
  <main id="contenido" class="contenido" tabindex="-1"></main>`;
}

async function salir() {
  try { await api.post('/auth/logout', {}); } catch { /* ya cerrada */ }
  try { await iniciarCsrf(); } catch { /* se reintenta al enviar */ }
  estado.usuario = null;
  estado.catalogo = null;
  ir('/login');
}

function limpiarVista() {
  for (const f of estado.limpiar) { try { f(); } catch { /* nada */ } }
  estado.limpiar = [];
}

export async function enrutar() {
  limpiarVista();
  const [ruta, consulta = ''] = ((location.hash || '#/').slice(1) || '/').split('?');
  const query = Object.fromEntries(new URLSearchParams(consulta));
  const def = RUTAS.find((r) => r.patron.test(ruta));
  const app = document.getElementById('app');
  if (!def) return ir('/');
  if (!def.publica && !estado.usuario) {
    try {
      const r = await api.get('/auth/yo', { silencioso: true });
      estado.usuario = r.usuario;
    } catch {
      return ir('/login');
    }
  }
  if (def.publica) {
    app.className = 'app app-publica';
    app.innerHTML = '';
    return def.vista.mostrar(app, [], { ir });
  }
  if (estado.usuario.debeCambiar && !def.sinCambio) return ir('/cambiar-clave');
  if (def.permiso && !puede(def.permiso)) {
    notificar('Su rol no tiene acceso a esa sección.', 'error');
    return ir('/');
  }
  const params = ruta.match(def.patron).slice(1);
  if (def.sinMarco) {
    app.className = 'app app-informe';
    app.innerHTML = '<main id="contenido" class="informe-raiz" tabindex="-1"></main>';
  } else {
    app.className = 'app';
    app.innerHTML = String(marco(def.menu));
    document.getElementById('salir').addEventListener('click', salir);
    const lateral = document.getElementById('lateral');
    const boton = document.getElementById('abrir-menu');
    boton.addEventListener('click', () => {
      const abierto = lateral.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', String(abierto));
    });
  }
  const main = document.getElementById('contenido');
  main.innerHTML = '<div class="cargando" role="status"><span class="girador"></span>Cargando…</div>';
  try {
    await def.vista.mostrar(main, params, { ir, estado, puede, query });
  } catch (e) {
    if (e.estado === 401) return;
    main.innerHTML = String(html`<div class="tarjeta error-vista">${icono('noevaluable')}<div><h2>No se pudo cargar la vista</h2><p>${e.message}</p></div></div>`);
  }
  document.title = `${main.querySelector('h1') ? main.querySelector('h1').textContent + ' · ' : ''}Auditoría ISO/IEC 27001`;
}

configurar({
  expirada: () => {
    if (!estado.usuario) return;
    estado.usuario = null;
    notificar('Su sesión expiró por inactividad. Ingrese de nuevo.', 'error');
    ir('/login');
  },
  cambioRequerido: () => ir('/cambiar-clave'),
});

// Botones de copiar en cualquier panel de terminal
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-copiar]');
  if (b) copiar(b.dataset.copiar);
  const s = e.target.closest('.saltar');
  if (s) { e.preventDefault(); const m = document.getElementById('contenido'); if (m) m.focus(); }
  if (e.target.closest('.nav-item') && document.getElementById('lateral')) document.getElementById('lateral').classList.remove('abierto');
});

window.addEventListener('hashchange', enrutar);
window.addEventListener('DOMContentLoaded', async () => {
  try { estado.registro = Boolean((await iniciarCsrf()).registro); } catch { /* el servidor responde luego */ }
  // Cualquier campo de contraseña que aparezca (vistas o diálogos) recibe el botón para mostrarla
  activarOjos(document);
  new MutationObserver(() => activarOjos(document)).observe(document.body, { childList: true, subtree: true });
  enrutar();
});
