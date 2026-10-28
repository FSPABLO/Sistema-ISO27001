import { api } from '../api.js';
import { html, icono, chip, peso, medidor, numero, fecha } from '../ui.js';

const CAMBIO = {
  mejoró: { clase: 'mejoro', icono: 'sube', texto: 'Mejoró' },
  empeoró: { clase: 'empeoro', icono: 'baja', texto: 'Empeoró' },
  igual: { clase: 'igual', icono: 'igual', texto: 'Igual' },
  distinto: { clase: 'distinto', icono: 'info', texto: 'Cambió' },
};

export async function mostrar(raiz, [a, b]) {
  const c = await api.get(`/ejecuciones/comparar?a=${a}&b=${b}`);
  const delta = c.delta;
  const signo = delta > 0 ? '+' : '';
  const orden = { mejoró: 0, empeoró: 1, distinto: 2, igual: 3 };
  const filas = [...c.filas].sort((x, y) => orden[x.cambio] - orden[y.cambio]);
  raiz.innerHTML = String(html`
  <div class="encabezado"><div><p class="eyebrow">Comparación · ${c.anterior.conexion}</p><h1>Antes y después</h1>
    <p class="sutil">Ejecución #${c.anterior.id} (${fecha(c.anterior.inicio)}, ${c.anterior.usuario}) frente a #${c.posterior.id} (${fecha(c.posterior.inicio)}, ${c.posterior.usuario}).</p></div>
    <a class="boton" href="#/historial">${icono('historial')} Volver al historial</a></div>
  <section class="comparacion-cabeza">
    <div class="tarjeta centro"><p class="eyebrow">Antes · #${c.anterior.id}</p>${medidor(c.anterior.puntaje, { tam: 'medio' })}</div>
    <div class="tarjeta centro delta delta-${delta > 0 ? 'mejoro' : delta < 0 ? 'empeoro' : 'igual'}">
      ${icono(delta > 0 ? 'sube' : delta < 0 ? 'baja' : 'igual', 'ico-grande')}
      <strong>${delta === null ? '—' : `${signo}${numero(delta)}`}</strong><span>puntos de cambio</span>
      <p><b>${c.mejoraron}</b> control(es) mejoraron · <b>${c.empeoraron}</b> empeoraron</p>
    </div>
    <div class="tarjeta centro"><p class="eyebrow">Después · #${c.posterior.id}</p>${medidor(c.posterior.puntaje, { tam: 'medio' })}</div>
  </section>
  <section class="tarjeta">
    <div class="tarjeta-cabecera"><h2>${icono('comparar')} Control por control</h2></div>
    <div class="tabla-desplazable"><table class="tabla">
      <thead><tr><th scope="col">Control</th><th scope="col">Importancia</th><th scope="col">Antes</th><th scope="col"></th><th scope="col">Después</th><th scope="col">Cambio</th></tr></thead>
      <tbody>${filas.map((f) => { const k = CAMBIO[f.cambio]; return html`<tr class="fila-${k.clase}">
        <td><b>${f.controlId}</b> ${f.nombre}</td><td>${peso(f.peso)}</td><td>${chip(f.antes)}</td><td aria-hidden="true">${icono('flecha')}</td><td>${chip(f.despues)}</td>
        <td><span class="cambio cambio-${k.clase}">${icono(k.icono)} ${k.texto}</span></td></tr>`; })}</tbody>
    </table></div>
  </section>`);
}
