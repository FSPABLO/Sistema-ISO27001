import { api } from '../api.js';
import { html, icono, fecha, vacio } from '../ui.js';

const CLASE_RESULTADO = { OK: 'cumple', FALLIDO: 'nocumple', DENEGADO: 'nocumple', ERROR: 'nocumple', ALERTA: 'parcial' };

function detalleLegible(d) {
  if (!d) return '';
  try {
    const o = JSON.parse(d);
    if (typeof o !== 'object' || o === null) return String(o);
    return Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');
  } catch { return d; }
}

export async function mostrar(raiz, _p, { ir, query }) {
  const f = { usuario: query.usuario || '', accion: query.accion || '', resultado: query.resultado || '', desde: query.desde || '', hasta: query.hasta || '', texto: query.texto || '' };
  const [datos, integridad] = await Promise.all([
    api.get('/auditoria?' + new URLSearchParams(Object.entries(f).filter(([, v]) => v))),
    api.get('/auditoria/verificar'),
  ]);
  raiz.innerHTML = String(html`
  <div class="encabezado"><div><p class="eyebrow">Registro del propio sistema</p><h1>Registro de auditoría</h1>
    <p class="sutil">Solo inserción: no existe ninguna función para modificar o borrar registros. Cada fila incluye el hash SHA-256 de la anterior.</p></div></div>
  <section class="integridad integridad-${integridad.integro ? 'ok' : 'mal'}" role="status">
    ${icono(integridad.integro ? 'escudo' : 'escudo-alerta', 'ico-grande')}
    <div><h2>${integridad.integro ? 'Cadena de hashes íntegra' : 'Se detectó una alteración'}</h2>
      <p>${integridad.integro ? '' : integridad.motivo + '. '}${integridad.total} registros verificados desde el primero${integridad.ultimoHash ? html`; último hash <code>${integridad.ultimoHash.slice(0, 16)}…</code>` : ''}.</p></div>
    <button class="boton" id="reverificar">${icono('escudo')} Verificar de nuevo</button>
  </section>
  <form class="tarjeta filtros" id="filtros">
    <label class="campo"><span>Usuario</span><select name="usuario"><option value="">Todos</option>${datos.usuarios.map((u) => html`<option ${u === f.usuario ? 'selected' : ''}>${u}</option>`)}</select></label>
    <label class="campo"><span>Acción</span><select name="accion"><option value="">Todas</option>${datos.acciones.map((a) => html`<option ${a === f.accion ? 'selected' : ''}>${a}</option>`)}</select></label>
    <label class="campo"><span>Resultado</span><select name="resultado"><option value="">Todos</option>${['OK', 'FALLIDO', 'DENEGADO', 'ERROR', 'ALERTA'].map((r) => html`<option ${r === f.resultado ? 'selected' : ''}>${r}</option>`)}</select></label>
    <label class="campo"><span>Desde</span><input type="date" name="desde" value="${f.desde}"></label>
    <label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${f.hasta}"></label>
    <label class="campo"><span>Texto</span><input name="texto" value="${f.texto}" placeholder="objeto, IP o detalle"></label>
    <div class="acciones"><button class="boton" type="submit">Filtrar</button><button class="boton boton-sutil" type="button" id="limpiar">Limpiar</button></div>
  </form>
  <section class="tarjeta">
    <div class="tarjeta-cabecera"><h2>${icono('auditoria')} Eventos</h2><span class="sutil">${datos.registros.length} de ${datos.total}</span></div>
    ${datos.registros.length ? html`<div class="tabla-desplazable"><table class="tabla tabla-auditoria">
      <thead><tr><th scope="col">#</th><th scope="col">Fecha</th><th scope="col">Usuario</th><th scope="col">Acción</th><th scope="col">Objeto</th><th scope="col">IP</th><th scope="col">Resultado</th><th scope="col">Detalle</th><th scope="col">Hash</th></tr></thead>
      <tbody>${datos.registros.map((r) => html`<tr>
        <td>${r.id}</td><td class="nowrap">${fecha(r.fecha)}</td><td><strong>${r.usuario || '—'}</strong><small class="bloque">${r.rol || ''}</small></td>
        <td><code class="accion">${r.accion}</code></td><td>${r.objeto || ''}</td><td class="nowrap">${r.ip || ''}</td>
        <td><span class="chip chip-${CLASE_RESULTADO[r.resultado] || 'omitida'}">${icono(CLASE_RESULTADO[r.resultado] || 'omitida')}<span>${r.resultado}</span></span></td>
        <td class="detalle-audit">${detalleLegible(r.detalle)}</td><td><code title="${r.hash}">${r.hash.slice(0, 10)}…</code></td></tr>`)}</tbody>
    </table></div>` : vacio('No hay eventos con esos filtros.', 'auditoria')}
  </section>`);
  const form = raiz.querySelector('#filtros');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = new URLSearchParams([...new FormData(form)].filter(([, v]) => v));
    ir('/auditoria' + (q.toString() ? '?' + q : ''));
  });
  raiz.querySelector('#limpiar').addEventListener('click', () => ir('/auditoria'));
  raiz.querySelector('#reverificar').addEventListener('click', () => mostrar(raiz, _p, { ir, query }));
}
