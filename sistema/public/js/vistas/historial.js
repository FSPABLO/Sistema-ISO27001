import { api } from '../api.js';
import { html, icono, fecha, notificar, aplicarAnchos, vacio } from '../ui.js';
import { estado } from '../app.js';
import { resumenEstados, barraPuntaje } from './panel.js';

export async function mostrar(raiz, _p, { ir, query }) {
  const veTodas = estado.usuario.rol !== 'analista';
  const [{ conexiones }, usuarios] = await Promise.all([
    api.get('/conexiones'),
    veTodas && estado.usuario.rol === 'administrador' ? api.get('/usuarios').then((r) => r.usuarios).catch(() => []) : Promise.resolve([]),
  ]);
  const filtros = { usuario: query.usuario || '', conexion: query.conexion || '', desde: query.desde || '', hasta: query.hasta || '' };
  raiz.innerHTML = String(html`
  <div class="encabezado"><div><p class="eyebrow">Trazabilidad</p><h1>Historial de pruebas</h1>
    <p class="sutil">${veTodas ? 'Todas las ejecuciones y quién las hizo.' : 'Sus ejecuciones. Los analistas solo ven las propias.'} Marque dos ejecuciones de la misma conexión para compararlas.</p></div></div>
  <form class="tarjeta filtros" id="filtros">
    ${veTodas ? html`<label class="campo"><span>Usuario</span>${usuarios.length
    ? html`<select name="usuario"><option value="">Todos</option>${usuarios.map((u) => html`<option value="${u.usuario}" ${u.usuario === filtros.usuario ? 'selected' : ''}>${u.usuario}</option>`)}</select>`
    : html`<input name="usuario" value="${filtros.usuario}" placeholder="Todos">`}</label>` : ''}
    <label class="campo"><span>Conexión</span><select name="conexion"><option value="">Todas</option>
      ${conexiones.map((c) => html`<option value="${c.id}" ${String(c.id) === filtros.conexion ? 'selected' : ''}>${c.alias}</option>`)}</select></label>
    <label class="campo"><span>Desde</span><input type="date" name="desde" value="${filtros.desde}"></label>
    <label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${filtros.hasta}"></label>
    <div class="acciones"><button class="boton" type="submit">Filtrar</button><button class="boton boton-sutil" type="button" id="limpiar">Limpiar</button></div>
  </form>
  <section class="tarjeta">
    <div class="tarjeta-cabecera"><h2>${icono('historial')} Ejecuciones</h2>
      <button class="boton boton-primario" id="comparar" disabled>${icono('comparar')} Comparar seleccionadas</button></div>
    <div id="tabla-historial"><div class="cargando"><span class="girador"></span>Cargando…</div></div>
  </section>`);

  const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v));
  const { ejecuciones } = await api.get('/ejecuciones?' + params.toString());
  const zona = raiz.querySelector('#tabla-historial');
  zona.innerHTML = ejecuciones.length ? String(html`<div class="tabla-desplazable"><table class="tabla tabla-historial">
    <thead><tr><th scope="col"><span class="lectores">Comparar</span></th><th scope="col">#</th><th scope="col">Fecha</th><th scope="col">Quién</th><th scope="col">Conexión</th><th scope="col">Puntaje</th><th scope="col">Controles</th><th scope="col"></th></tr></thead>
    <tbody>${ejecuciones.map((x) => html`<tr>
      <td>${x.estado === 'TERMINADA' ? html`<input type="checkbox" class="sel" value="${x.id}" data-conexion="${x.conexionId}" aria-label="Seleccionar ejecución ${x.id} para comparar">` : ''}</td>
      <td>#${x.id}</td><td>${fecha(x.inicio)}</td><td><strong>${x.usuario}</strong><small class="bloque">${x.usuarioNombre}</small></td><td>${x.conexion}</td>
      <td>${x.estado === 'TERMINADA' ? barraPuntaje(x.puntaje) : x.estado === 'ERROR' ? html`<span class="chip chip-nocumple">${icono('noevaluable')}<span>Error</span></span>` : html`<span class="chip chip-curso"><span class="girador"></span>En curso</span>`}</td>
      <td>${resumenEstados(x.conteo)}</td>
      <td><a class="boton boton-pequeno" href="#/ejecucion/${x.id}">Ver ${icono('flecha')}</a></td></tr>`)}</tbody></table></div>`)
    : String(vacio('No hay ejecuciones con esos filtros.', 'historial'));
  aplicarAnchos(zona);

  const botonComparar = raiz.querySelector('#comparar');
  const seleccion = () => [...raiz.querySelectorAll('.sel:checked')];
  raiz.addEventListener('change', (e) => {
    if (!e.target.classList.contains('sel')) return;
    const s = seleccion();
    if (s.length > 2) { e.target.checked = false; notificar('Seleccione solo dos ejecuciones.', 'error'); }
    botonComparar.disabled = seleccion().length !== 2;
  });
  botonComparar.addEventListener('click', () => {
    const [a, b] = seleccion();
    if (a.dataset.conexion !== b.dataset.conexion) { notificar('Solo se pueden comparar ejecuciones de la misma conexión.', 'error'); return; }
    ir(`/comparar/${a.value}/${b.value}`);
  });
  const form = raiz.querySelector('#filtros');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = new URLSearchParams([...new FormData(form)].filter(([, v]) => v));
    ir('/historial' + (q.toString() ? '?' + q : ''));
  });
  raiz.querySelector('#limpiar').addEventListener('click', () => ir('/historial'));
}
