import { api } from '../api.js';
import { html, icono, fecha, numero, colorPuntaje, vacio, medidor } from '../ui.js';
import { estado, puede } from '../app.js';

export function resumenEstados(conteo) {
  if (!conteo) return '';
  const orden = [['CUMPLE', 'cumple'], ['PARCIAL', 'parcial'], ['NO CUMPLE', 'nocumple'], ['NO EVALUABLE', 'noevaluable'], ['OMITIDA', 'omitida']];
  return html`<span class="mini-estados">${orden.filter(([k]) => conteo[k]).map(([k, c]) => html`<span class="mini mini-${c}" title="${k}: ${conteo[k]}">${icono(c)}${conteo[k]}</span>`)}</span>`;
}

export function barraPuntaje(p) {
  if (p === null || p === undefined) return html`<span class="sutil">—</span>`;
  return html`<span class="barra-puntaje barra-${colorPuntaje(p)}" title="${numero(p)} %"><span class="barra-relleno" data-ancho="${p}"></span><b>${numero(p)} %</b></span>`;
}

export async function mostrar(raiz) {
  const d = await api.get('/panel');
  const u = estado.usuario;
  const ultima = d.ultimas.find((x) => x.estado === 'TERMINADA');
  raiz.innerHTML = String(html`
  <div class="encabezado">
    <div><p class="eyebrow">Panel principal</p><h1>Hola, ${u.nombre.split(' ')[0]}</h1>
      <p class="sutil">${puede('ejecutar') ? 'Registre una conexión y ejecute las pruebas de los 18 controles.' : 'Consulte los resultados y el registro de auditoría en modo de solo lectura.'}</p></div>
    ${puede('ejecutar') ? html`<a class="boton boton-primario" href="#/nueva">${icono('ejecutar')} Nueva ejecución</a>` : ''}
  </div>
  <section class="kpis" aria-label="Resumen">
    <div class="kpi"><span class="kpi-ico">${icono('conexion')}</span><div><strong>${d.conexiones.length}</strong><span>Conexiones activas</span></div></div>
    <div class="kpi"><span class="kpi-ico">${icono('historial')}</span><div><strong>${d.totales.n || 0}</strong><span>${puede('ejecutar') && u.rol === 'analista' ? 'Mis ejecuciones' : 'Ejecuciones registradas'}</span></div></div>
    <div class="kpi"><span class="kpi-ico">${icono('cumple')}</span><div><strong>${d.totales.terminadas || 0}</strong><span>Terminadas</span></div></div>
    <div class="kpi kpi-${ultima ? colorPuntaje(ultima.puntaje) : 'gris'}"><span class="kpi-ico">${icono('objetivo')}</span><div><strong>${ultima ? numero(ultima.puntaje) + ' %' : '—'}</strong><span>Último puntaje${ultima ? ` · ${ultima.conexion}` : ''}</span></div></div>
  </section>
  <div class="rejilla-2">
    <section class="tarjeta">
      <div class="tarjeta-cabecera"><h2>${icono('conexion')} Conexiones registradas</h2><a href="#/conexiones" class="enlace">Ver todas ${icono('flecha')}</a></div>
      ${d.conexiones.length ? html`<ul class="lista-conexiones">${d.conexiones.map((c) => html`
        <li class="conexion-item">
          <div class="conexion-medidor">${medidor(c.ultimo_puntaje, { tam: 'mini' })}</div>
          <div class="conexion-datos"><strong>${c.alias}</strong><code>${c.usuario}@${c.host}:${c.puerto}/${c.servicio}</code>
            <small>${c.ultima_fecha ? 'Última ejecución: ' + fecha(c.ultima_fecha) : 'Sin ejecuciones'}</small></div>
          ${puede('ejecutar') ? html`<a class="boton boton-pequeno" href="#/nueva?conexion=${c.id}">${icono('ejecutar')} Ejecutar</a>` : ''}
        </li>`)}</ul>` : vacio(puede('ejecutar') ? 'Aún no hay conexiones. Registre la primera en "Conexiones".' : 'Aún no hay conexiones registradas.', 'conexion')}
    </section>
    <section class="tarjeta">
      <div class="tarjeta-cabecera"><h2>${icono('historial')} Últimas ejecuciones</h2><a href="#/historial" class="enlace">Historial ${icono('flecha')}</a></div>
      ${d.ultimas.length ? html`<ul class="lista-ejecuciones">${d.ultimas.map((x) => html`
        <li><a href="#/ejecucion/${x.id}" class="ejecucion-item">
          <span class="ejec-id">#${x.id}</span>
          <span class="ejec-datos"><strong>${x.conexion}</strong><small>${fecha(x.inicio)} · ${x.usuario}</small></span>
          <span class="ejec-estado">${x.estado === 'TERMINADA' ? html`${barraPuntaje(x.puntaje)}${resumenEstados(x.conteo)}` : x.estado === 'ERROR' ? html`<span class="chip chip-nocumple">${icono('noevaluable')}<span>Error</span></span>` : html`<span class="chip chip-curso"><span class="girador"></span>En curso</span>`}</span>
        </a></li>`)}</ul>` : vacio('Todavía no hay ejecuciones.', 'historial')}
    </section>
  </div>`);
  raiz.querySelectorAll('[data-ancho]').forEach((el) => { el.style.width = `${el.dataset.ancho}%`; });
}
