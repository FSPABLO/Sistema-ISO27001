// Informe imprimible (guardar como PDF desde el navegador).
import { api } from '../api.js';
import { html, icono, chip, peso, madurez, medidor, numero, fecha, ORDEN_ESTADOS } from '../ui.js';
import { estado, cargarCatalogo } from '../app.js';

export async function mostrar(raiz, [id]) {
  const catalogo = await cargarCatalogo();
  const ej = (await api.get(`/ejecuciones/${id}?vista=informe`)).ejecucion;
  if (ej.estado !== 'TERMINADA') {
    raiz.innerHTML = String(html`<div class="informe-barra"><a class="boton" href="#/ejecucion/${id}">${icono('flecha')} Volver</a></div><p class="informe-hoja">La ejecución no está terminada.</p>`);
    return;
  }
  const r = ej.resumen;
  const info = ej.info || {};
  raiz.innerHTML = String(html`
  <div class="informe-barra no-imprimir">
    <a class="boton" href="#/ejecucion/${ej.id}">← Volver a los resultados</a>
    <span class="sutil">Use “Guardar como PDF” en el diálogo de impresión.</span>
    <button class="boton boton-primario" id="imprimir">${icono('imprimir')} Imprimir / Guardar PDF</button>
  </div>
  <article class="informe-hoja">
    <header class="informe-portada">
      <div class="informe-marca">${icono('escudo')}<span>Auditoría ISO/IEC 27001:2022 · Confidencialidad en Oracle</span></div>
      <h1>Informe de auditoría de controles</h1>
      <p class="informe-sub">${ej.conexion} · <code>${ej.conexionDatos.usuario_bd}@${ej.conexionDatos.host}:${ej.conexionDatos.puerto}/${ej.conexionDatos.servicio}</code></p>
      <dl class="informe-datos">
        <div><dt>Ejecución</dt><dd>#${ej.id}</dd></div>
        <div><dt>Fecha</dt><dd>${fecha(ej.inicio)}</dd></div>
        <div><dt>Realizada por</dt><dd>${ej.usuarioNombre} (${ej.usuario})</dd></div>
        <div><dt>Versión</dt><dd>Oracle ${info.version || '—'} · ${info.contenedor || ''}</dd></div>
        <div><dt>Canal</dt><dd>${info.red && info.red.cifrado ? `Cifrado ${info.red.cifrado} / ${info.red.integridad || 'sin integridad'}` : 'Sin cifrar'}</dd></div>
        <div><dt>Pruebas funcionales</dt><dd>${ej.funcional ? 'Sí' : 'No'}</dd></div>
        <div><dt>Emitido</dt><dd>${fecha(new Date().toISOString())} por ${estado.usuario.usuario}</dd></div>
      </dl>
    </header>

    <section class="informe-seccion informe-resumen">
      <div>${medidor(ej.puntaje, { tam: 'medio' })}</div>
      <div><h2>1. Resumen ejecutivo</h2>
        <p>Se evaluaron ${ej.controles.length} controles del Anexo A con ${r.pruebas.total} pruebas. El cumplimiento ponderado por riesgo es <b>${numero(ej.puntaje)} %</b>
          (${numero(r.obtenido)} de ${r.sumaPesos} puntos de peso evaluados).</p>
        <ul class="informe-conteo">${ORDEN_ESTADOS.map((k) => html`<li>${chip(k)} <b>${r.conteo[k] || 0}</b></li>`)}</ul>
        ${r.prioridades.length ? html`<p>Las tres prioridades son: ${r.prioridades.slice(0, 3).map((p) => `${p.controlId} ${p.nombre}`).join('; ')}.</p>` : html`<p>No hay brechas pendientes en los controles evaluados.</p>`}
      </div>
    </section>

    <section class="informe-seccion">
      <h2>2. Matriz de controles</h2>
      <table class="tabla tabla-informe"><thead><tr><th>Control</th><th>Tema</th><th>Tarea</th><th>Peso</th><th>Estado</th><th>Madurez</th></tr></thead>
        <tbody>${ej.controles.map((c) => html`<tr><td><b>${c.controlId}</b> ${c.nombre}</td><td>${c.tema}</td><td>${c.tarea}</td><td>${peso(c.peso)}</td><td>${chip(c.estado)}</td><td>${madurez(c.madurez)}</td></tr>`)}</tbody></table>
    </section>

    <section class="informe-seccion">
      <h2>3. Lista de prioridades</h2>
      <p class="sutil">Prioridad = peso × brecha (1 si no cumple, 0,5 si es parcial); empates por peso y luego identificador. Impacto = puntos que subiría el puntaje si el control pasara a cumplir.</p>
      ${r.prioridades.length ? html`<table class="tabla tabla-informe"><thead><tr><th>#</th><th>Control</th><th>Estado</th><th>Prioridad</th><th>Impacto</th><th>Riesgo</th></tr></thead>
        <tbody>${r.prioridades.map((p) => html`<tr><td>${p.posicion}</td><td><b>${p.controlId}</b> ${p.nombre}</td><td>${chip(p.estado)}</td><td>${numero(p.prioridad)}</td><td>+${numero(p.impacto)}</td><td>${p.riesgo} (nivel ${p.riesgoNivel})</td></tr>`)}</tbody></table>`
    : html`<p>Sin brechas.</p>`}
    </section>

    <section class="informe-seccion">
      <h2>4. Detalle por control y evidencia</h2>
      ${ej.controles.map((c) => html`<div class="informe-control">
        <h3>${c.controlId} · ${c.nombre} ${chip(c.estado)}</h3>
        <p class="sutil">${c.tema} · ${c.tarea} ${catalogo.tareas[c.tarea]} · peso ${c.peso} · riesgos ${c.riesgos.join(', ')}</p>
        ${ej.pruebas.filter((p) => p.controlId === c.controlId).map((p) => html`<div class="informe-prueba">
          <h4>${chip(p.estado)} ${p.pruebaId} · ${p.nombre}${p.heuristica ? ' (heurística)' : ''}</h4>
          <p><b>Observado:</b> ${p.detalle}</p>
          <p><b>Esperado:</b> ${p.esperado}</p>
          ${p.explicacion ? html`<p><b>${p.estado === 'CUMPLE' ? 'Por qué cumple' : 'Por qué no cumple'}:</b> ${p.explicacion}</p>` : ''}
          ${p.bloques.map((b) => html`<pre class="informe-terminal">$ ${b.comando}
${b.binds ? b.binds + '\n' : ''}${b.consulta}

${b.salida}</pre>`)}
          ${p.estado === 'NO CUMPLE' || p.estado === 'PARCIAL' ? html`<p><b>Recomendación:</b></p><pre class="informe-recomendacion">${p.recomendacion}</pre>` : ''}
        </div>`)}
      </div>`)}
    </section>
    <footer class="informe-pie">Sistema de auditoría ISO/IEC 27001:2022 · Generado ${fecha(new Date().toISOString())} · Las consultas son de solo lectura; las contraseñas de la base no se almacenan.</footer>
  </article>`);
  raiz.querySelector('#imprimir').addEventListener('click', async () => {
    try { await api.post(`/ejecuciones/${ej.id}/informe`, { accion: 'impresion' }); } catch { /* el registro no debe impedir imprimir */ }
    window.print();
  });
  document.title = `Informe ejecución ${ej.id} · ${ej.conexion}`;
}

