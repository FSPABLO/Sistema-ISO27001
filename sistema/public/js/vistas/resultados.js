import { api } from '../api.js';
import { html, icono, chip, peso, madurez, medidor, numero, fecha, terminal, abrirDialogo, aplicarAnchos, vacio, ESTADOS, ORDEN_ESTADOS } from '../ui.js';
import { estado, cargarCatalogo } from '../app.js';

const COLORES = { CUMPLE: '#15803d', PARCIAL: '#d97706', 'NO CUMPLE': '#dc2626', 'NO EVALUABLE': '#64748b', OMITIDA: '#cbd5e1' };

function cabecera(ej) {
  const info = ej.info || {};
  const cifrado = info.red && info.red.cifrado;
  return html`<div class="encabezado">
    <div><p class="eyebrow">Ejecución #${ej.id} · ${fecha(ej.inicio)}</p>
      <h1>${ej.conexion}</h1>
      <p class="metadatos">
        <span>${icono('usuarios')} ${ej.usuarioNombre} (${ej.usuario})</span>
        <span>${icono('conexion')} <code>${ej.conexionDatos.usuario_bd}@${ej.conexionDatos.host}:${ej.conexionDatos.puerto}/${ej.conexionDatos.servicio}</code></span>
        ${info.version ? html`<span>${icono('info')} Oracle ${info.version} · ${info.contenedor}</span>` : ''}
        ${info.red ? html`<span class="${cifrado ? 'ok' : 'mal'}">${icono(cifrado ? 'candado' : 'candado-abierto')} ${cifrado ? `Canal cifrado ${cifrado}` : 'Canal sin cifrar'}</span>` : ''}
        <span>${icono('rayo')} Pruebas funcionales: ${ej.funcional ? `sí${ej.perfil ? ' (' + ej.perfil + ')' : ''}` : 'no'}</span>
      </p></div>
    ${ej.estado === 'TERMINADA' ? html`<div class="acciones">
      <a class="boton" href="#/informe/${ej.id}">${icono('imprimir')} Informe imprimible</a>
      <a class="boton" href="/api/ejecuciones/${ej.id}/descarga" download>${icono('descargar')} Evidencia (JSON)</a>
      <a class="boton" href="#/historial?conexion=${ej.conexionId}">${icono('comparar')} Comparar</a>
    </div>` : ''}
  </div>`;
}

async function progreso(raiz, ej, alTerminar) {
  raiz.innerHTML = String(html`${cabecera(ej)}
  <section class="tarjeta progreso-tarjeta" aria-live="polite">
    <div class="progreso-cabeza"><span class="girador grande"></span><div><h2>Ejecutando pruebas…</h2><p class="sutil" id="paso">Conectando con la base de datos…</p></div><strong id="porcentaje">0 %</strong></div>
    <div class="progreso" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Avance de la ejecución"><span id="barra"></span></div>
    <p class="nota">${icono('candado')} Las consultas son de solo lectura y la contraseña solo está en memoria mientras dura la ejecución.</p>
  </section>`);
  let activo = true;
  estado.limpiar.push(() => { activo = false; });
  while (activo) {
    const p = await api.get(`/ejecuciones/${ej.id}/progreso`);
    const pct = p.total ? Math.round((p.progreso / p.total) * 100) : 0;
    const barra = raiz.querySelector('#barra');
    if (!barra) return;
    barra.style.width = `${pct}%`;
    raiz.querySelector('.progreso').setAttribute('aria-valuenow', String(pct));
    raiz.querySelector('#porcentaje').textContent = `${pct} %`;
    raiz.querySelector('#paso').textContent = p.paso ? `Prueba ${p.progreso + 1} de ${p.total}: ${p.paso}` : 'Calculando puntaje…';
    if (p.estado !== 'EN CURSO') { activo = false; alTerminar(); return; }
    await new Promise((ok) => setTimeout(ok, 700));
  }
}

function kpis(ej) {
  const c = ej.resumen.conteo;
  return html`<div class="estado-tiles">${ORDEN_ESTADOS.map((k) => html`
    <div class="tile tile-${ESTADOS[k].clase}">${icono(ESTADOS[k].icono)}<strong>${c[k] || 0}</strong><span>${ESTADOS[k].texto}</span></div>`)}</div>`;
}

function matriz(ej, agrupar) {
  const tarjeta = (c) => html`<button type="button" class="control control-${(ESTADOS[c.estado] || {}).clase}" data-control="${c.controlId}" aria-label="${c.controlId} ${c.nombre}: ${(ESTADOS[c.estado] || {}).texto}, peso ${c.peso}. Ver pruebas">
    <span class="control-cabeza"><b>${c.controlId}</b>${chip(c.estado)}</span>
    <span class="control-nombre">${c.nombre}</span>
    <span class="control-pie">${peso(c.peso)}${madurez(c.madurez)}</span>
  </button>`;
  if (agrupar === 'lista') return html`<div class="matriz">${ej.controles.map(tarjeta)}</div>`;
  const clave = agrupar === 'tarea' ? 'tarea' : 'tema';
  const grupos = [...new Set(ej.controles.map((c) => c[clave]))].sort();
  const tareas = estado.catalogo ? estado.catalogo.tareas : {};
  return html`${grupos.map((g) => html`<div class="grupo-matriz">
    <h3>${clave === 'tarea' ? `${g} · ${tareas[g] || ''}` : `Controles ${g.toLowerCase()}es`}</h3>
    <div class="matriz">${ej.controles.filter((c) => c[clave] === g).map(tarjeta)}</div></div>`)}`;
}

function prioridades(ej) {
  const p = ej.resumen.prioridades;
  if (!p.length) return vacio('Todos los controles evaluados cumplen. No hay brechas que priorizar.', 'cumple');
  const max = p[0].prioridad;
  return html`<ol class="prioridades">${p.map((x) => html`<li class="prioridad prioridad-${(ESTADOS[x.estado] || {}).clase}">
    <span class="prioridad-pos" aria-hidden="true">${x.posicion}</span>
    <div class="prioridad-cuerpo">
      <div class="prioridad-cabeza"><button type="button" class="enlace-control" data-control="${x.controlId}"><b>${x.controlId}</b> ${x.nombre}</button>${chip(x.estado)}${peso(x.peso)}</div>
      <div class="prioridad-barra" title="Prioridad ${numero(x.prioridad)}"><span data-ancho="${(x.prioridad / max) * 100}"></span></div>
      <p class="prioridad-datos"><span>Prioridad <b>${numero(x.prioridad)}</b> = peso ${x.peso} × brecha ${numero(x.brecha)}</span>
        <span class="impacto">${icono('sube')} +${numero(x.impacto)} puntos si se corrige</span>
        <span>${icono('noevaluable')} ${x.riesgo}: ${x.riesgoNombre} (nivel ${x.riesgoNivel})</span></p>
      <details><summary>Qué corregir (${x.pruebas.length} prueba${x.pruebas.length === 1 ? '' : 's'})</summary>
        ${x.pruebas.map((t) => html`<div class="prioridad-prueba"><p>${chip(t.estado)} <b>${t.pruebaId}</b> ${t.nombre}: ${t.detalle}</p>
          <pre class="recomendacion">${t.recomendacion}</pre></div>`)}
      </details>
    </div></li>`)}</ol>`;
}

function formula(ej) {
  return html`<div class="formula">
    <h3>${icono('info')} Cómo se calcula</h3>
    <p><b>Puntaje</b> = Σ(peso × valor) ÷ Σ(pesos evaluados) × 100, con valor 1 si cumple, 0,5 si es parcial y 0 si no cumple.
      En esta ejecución: ${numero(ej.resumen.obtenido)} ÷ ${ej.resumen.sumaPesos} × 100 = <b>${numero(ej.puntaje)} %</b>.</p>
    <p><b>Prioridad</b> = peso × brecha (brecha 1 si no cumple, 0,5 si es parcial). Empates: primero el mayor peso y luego el identificador.
      El <b>impacto</b> es lo que subiría el puntaje si ese control pasara a cumplir.</p>
    <p><b>Pesos</b>: la mitad, redondeada hacia arriba, del mayor nivel de riesgo que mitiga el control (20 → 10, 16 y 15 → 8, 12 → 6). Los controles No evaluable y Omitida no entran en el cálculo.</p>
  </div>`;
}

function excluidos(ej) {
  const lista = ej.controles.filter((c) => c.estado === 'NO EVALUABLE' || c.estado === 'OMITIDA');
  const pruebas = ej.pruebas.filter((p) => p.estado === 'NO EVALUABLE' || p.estado === 'OMITIDA');
  if (!pruebas.length) return vacio('Todas las pruebas se pudieron evaluar.', 'cumple');
  return html`${lista.length ? html`<p class="sutil">Controles fuera del puntaje: ${lista.map((c) => c.controlId).join(', ')}.</p>` : html`<p class="sutil">Ningún control quedó completamente fuera del puntaje; estas pruebas individuales no se contaron.</p>`}
    <table class="tabla"><thead><tr><th>Prueba</th><th>Control</th><th>Estado</th><th>Motivo</th></tr></thead><tbody>
    ${pruebas.map((p) => html`<tr><td><b>${p.pruebaId}</b> ${p.nombre}</td><td>${p.controlId}</td><td>${chip(p.estado)}</td><td>${p.detalle}</td></tr>`)}
    </tbody></table>`;
}

export function detallePrueba(p) {
  const tipo = p.tipo === 'funcional' ? 'Prueba funcional' : 'Diccionario de datos';
  const fallo = p.estado === 'NO CUMPLE' || p.estado === 'PARCIAL';
  return html`<article class="prueba prueba-${(ESTADOS[p.estado] || {}).clase}">
    <header class="prueba-cabeza">${chip(p.estado)}<h3><span>${p.pruebaId}</span> ${p.nombre}</h3>
      <span class="etiqueta">${tipo}</span>${p.heuristica ? html`<span class="etiqueta etiqueta-aviso">Heurística: requiere revisión humana</span>` : ''}</header>
    <p class="sutil">${p.descripcion}</p>
    <div class="veredicto veredicto-${(ESTADOS[p.estado] || {}).clase}">
      <div><h4>${icono(fallo ? 'nocumple' : p.estado === 'CUMPLE' ? 'cumple' : 'info')} ${p.estado === 'CUMPLE' ? 'Por qué cumple' : fallo ? 'Por qué no cumple' : 'Motivo'}</h4>
        <p class="observado">${p.detalle}</p>${p.explicacion ? html`<p>${p.explicacion}</p>` : ''}</div>
      <div><h4>${icono('objetivo')} Resultado esperado</h4><p>${p.esperado}</p></div>
    </div>
    ${terminal(p.bloques, { titulo: `${p.pruebaId} · ${p.tipo === 'funcional' ? 'sesiones de prueba' : 'SQL*Plus'}` })}
    ${fallo ? html`<div class="recomendacion-caja"><h4>${icono('llave')} Cómo corregirlo</h4><pre class="recomendacion">${p.recomendacion}</pre>
      <button type="button" class="boton boton-pequeno" data-copiar="${p.recomendacion}">${icono('copiar')} Copiar recomendación</button></div>` : ''}
    <p class="fuente">Fuente: ${p.fuente || '—'} · ${p.duracionMs ?? 0} ms</p>
  </article>`;
}

function abrirControl(ej, id) {
  const c = ej.controles.find((x) => x.controlId === id);
  const pruebas = ej.pruebas.filter((p) => p.controlId === id);
  const riesgos = estado.catalogo ? c.riesgos.map((r) => `${r} ${estado.catalogo.riesgos[r].nombre} (nivel ${estado.catalogo.riesgos[r].nivel})`) : c.riesgos;
  abrirDialogo({
    titulo: `${c.controlId} · ${c.nombre}`, ancho: 'amplio',
    contenido: html`<div class="control-resumen">
      ${chip(c.estado, 'chip-grande')}${peso(c.peso)}${madurez(c.madurez)}
      <span class="etiqueta">${c.tema}</span><span class="etiqueta">${c.tarea} · ${c.tareaNombre}</span>${c.adicional ? html`<span class="etiqueta">Control adicional</span>` : ''}
    </div>
    <p class="sutil">Riesgos que mitiga: ${riesgos.join(' · ')}</p>
    ${c.motivo ? html`<div class="alerta alerta-info">${icono('info')}<span>${c.motivo}</span></div>` : ''}
    ${pruebas.map(detallePrueba)}`,
  });
}

let graficos = [];

// Acorta en un límite de palabra para que las etiquetas del eje no se corten a la mitad
function recortarPalabras(texto, max) {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max).replace(/\s+\S*$/, '');
  return corte + '…';
}

function dibujarGraficos(raiz, ej) {
  if (!window.Chart) return;
  graficos.forEach((g) => g.destroy());
  graficos = [];
  const Chart = window.Chart;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = '#475569';
  const c = ej.resumen.conteo;
  const etiquetas = ORDEN_ESTADOS.filter((k) => c[k]);
  graficos.push(new Chart(raiz.querySelector('#g-estados'), {
    type: 'doughnut',
    data: { labels: etiquetas.map((k) => ESTADOS[k].texto), datasets: [{ data: etiquetas.map((k) => c[k]), backgroundColor: etiquetas.map((k) => COLORES[k]), borderWidth: 2, borderColor: '#fff' }] },
    options: { cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
      tooltip: { callbacks: { label: (t) => ` ${t.label}: ${t.raw} control(es)` } } }, maintainAspectRatio: false },
  }));
  const barras = (canvas, grupos, rotulo) => new Chart(canvas, {
    type: 'bar',
    data: {
      labels: grupos.map(rotulo),
      datasets: ['CUMPLE', 'PARCIAL', 'NO CUMPLE', 'NO EVALUABLE', 'OMITIDA'].filter((k) => grupos.some((g) => g[k])).map((k) => ({
        label: ESTADOS[k].texto, data: grupos.map((g) => g[k]), backgroundColor: COLORES[k], borderRadius: 3, maxBarThickness: 34,
      })),
    },
    options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { stacked: true, ticks: { precision: 0 }, grid: { color: '#eef2f7' }, title: { display: true, text: 'Controles' } }, y: { stacked: true, grid: { display: false } } },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: { callbacks: { afterTitle: (t) => { const g = grupos[t[0].dataIndex]; return g.puntaje === null ? '' : `Puntaje del grupo: ${numero(g.puntaje)} %`; } } } } },
  });
  graficos.push(barras(raiz.querySelector('#g-tema'), ej.resumen.porTema, (g) => `${g.grupo} · ${g.puntaje === null ? '—' : numero(g.puntaje) + ' %'}`));
  const tareas = estado.catalogo ? estado.catalogo.tareas : {};
  graficos.push(barras(raiz.querySelector('#g-tarea'), ej.resumen.porTarea, (g) => `${g.grupo} ${recortarPalabras(tareas[g.grupo] || '', 30)}`));
  estado.limpiar.push(() => { graficos.forEach((g) => g.destroy()); graficos = []; });
}

function resultados(raiz, ej) {
  const prefer = (() => { try { return localStorage.getItem('agrupar') || 'tema'; } catch { return 'tema'; } })();
  raiz.innerHTML = String(html`${cabecera(ej)}
  <section class="resumen-ejecucion">
    <div class="tarjeta tarjeta-medidor">
      <h2 class="lectores">Puntaje global</h2>
      ${medidor(ej.puntaje)}
      <p class="medidor-pie">Cumplimiento ponderado por riesgo sobre ${ej.resumen.sumaPesos} puntos de peso evaluados</p>
    </div>
    <div class="tarjeta tarjeta-estados">
      <h2>Controles por estado</h2>${kpis(ej)}
      <p class="sutil">${ej.resumen.pruebas.total} pruebas ejecutadas: ${ORDEN_ESTADOS.filter((k) => ej.resumen.pruebas[k]).map((k) => `${ej.resumen.pruebas[k]} ${ESTADOS[k].texto.toLowerCase()}`).join(', ')}.</p>
    </div>
  </section>
  <section class="rejilla-graficos">
    <div class="tarjeta"><h2>Estado de los 18 controles</h2><div class="grafico grafico-dona"><canvas id="g-estados" role="img" aria-label="Gráfico de controles por estado"></canvas></div></div>
    <div class="tarjeta"><h2>Por tema de la norma</h2><div class="grafico grafico-tema"><canvas id="g-tema" role="img" aria-label="Gráfico por tema"></canvas></div></div>
    <div class="tarjeta"><h2>Por tarea del DBA</h2><div class="grafico grafico-tarea"><canvas id="g-tarea" role="img" aria-label="Gráfico por tarea del DBA"></canvas></div></div>
  </section>
  <div class="rejilla-resultados">
    <section class="tarjeta">
      <div class="tarjeta-cabecera"><h2>${icono('panel')} Matriz de controles</h2>
        <div class="segmentado" role="group" aria-label="Agrupar por">
          ${[['tema', 'Tema'], ['tarea', 'Tarea del DBA'], ['lista', 'Lista']].map(([v, t]) => html`<button type="button" data-agrupar="${v}" aria-pressed="${v === prefer}">${t}</button>`)}
        </div></div>
      <p class="sutil">Pulse un control para ver sus pruebas con la consulta y la salida real de la base.</p>
      <div id="matriz">${matriz(ej, prefer)}</div>
    </section>
    <section class="tarjeta">
      <div class="tarjeta-cabecera"><h2>${icono('objetivo')} Qué resolver primero</h2></div>
      ${prioridades(ej)}
      ${formula(ej)}
    </section>
  </div>
  <section class="tarjeta">
    <div class="tarjeta-cabecera"><h2>${icono('noevaluable')} No evaluables y omitidas</h2></div>
    ${excluidos(ej)}
  </section>`);
  aplicarAnchos(raiz);
  dibujarGraficos(raiz, ej);
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-control]');
    if (b) abrirControl(ej, b.dataset.control);
    const g = e.target.closest('[data-agrupar]');
    if (g) {
      try { localStorage.setItem('agrupar', g.dataset.agrupar); } catch { /* sin almacenamiento */ }
      raiz.querySelectorAll('[data-agrupar]').forEach((x) => x.setAttribute('aria-pressed', String(x === g)));
      raiz.querySelector('#matriz').innerHTML = String(matriz(ej, g.dataset.agrupar));
    }
  });
}

export async function mostrar(raiz, [id]) {
  await cargarCatalogo();
  const cargar = async (registrar) => (await api.get(`/ejecuciones/${id}${registrar ? '' : '?registrar=no'}`)).ejecucion;
  let ej = await cargar(true);
  if (ej.estado === 'EN CURSO') {
    await progreso(raiz, ej, async () => { ej = await cargar(false); pintar(); });
    return;
  }
  pintar();
  function pintar() {
    if (ej.estado === 'ERROR') {
      raiz.innerHTML = String(html`${cabecera(ej)}<section class="tarjeta error-vista">${icono('nocumple')}<div><h2>La ejecución no se completó</h2>
        <p>${ej.error}</p><p class="sutil">Verifique la contraseña, que la cuenta exista (sql/crear_usuario_auditoria.sql) y que el host sea alcanzable desde el contenedor.</p>
        <a class="boton boton-primario" href="#/nueva?conexion=${ej.conexionId}">Intentar de nuevo</a></div></section>`);
      return;
    }
    resultados(raiz, ej);
  }
}

