// Metodología: controles, pesos fijos, riesgos y pruebas de cada control.
import { html, icono, peso } from '../ui.js';
import { cargarCatalogo } from '../app.js';

export async function mostrar(raiz) {
  const c = await cargarCatalogo();
  const riesgos = Object.entries(c.riesgos);
  raiz.innerHTML = String(html`
  <div class="encabezado"><div><p class="eyebrow">Metodología</p><h1>Controles, pesos y pruebas</h1>
    <p class="sutil">El catálogo está fijo en el código: los pesos no se pueden editar desde la interfaz.</p></div></div>
  <div class="rejilla-2">
    <section class="tarjeta">
      <h2>${icono('noevaluable')} Riesgos de confidencialidad</h2>
      <table class="tabla"><thead><tr><th>Riesgo</th><th>P × I</th><th>Nivel</th><th>Peso que da</th></tr></thead>
        <tbody>${riesgos.map(([id, r]) => html`<tr><td><b>${id}</b> ${r.nombre}</td><td>${r.probabilidad} × ${r.impacto}</td><td>${r.nivel}</td><td>${Math.ceil(r.nivel / 2)}</td></tr>`)}</tbody></table>
    </section>
    <section class="tarjeta formula">
      <h2>${icono('info')} Fórmulas</h2>
      <p><b>Peso del control</b> = ⌈ mayor nivel de los riesgos que mitiga ÷ 2 ⌉ (20 → 10, 16 y 15 → 8, 12 → 6).</p>
      <p><b>Estado del control</b>: Cumple si todas sus pruebas evaluadas cumplen, No cumple si ninguna cumple, Parcial en otro caso. No evaluable y Omitida no cuentan.</p>
      <p><b>Puntaje</b> = Σ(peso × valor) ÷ Σ(pesos evaluados) × 100; valor 1, 0,5 o 0.</p>
      <p><b>Prioridad</b> = peso × brecha (1 o 0,5); desempate por peso y por identificador.</p>
      <p><b>Madurez (0–4)</b>: No cumple 0 o 1 (1 si hay algo implementado), Parcial 2, Cumple 3. El nivel 4 exige monitoreo continuo, que este sistema no mide.</p>
      <p class="nota">${icono('info')} Corrección documentada: A5.16 pertenece a la tarea T02 (riesgo R-CONF-01, nivel 20), por lo que su peso es 10 y no 8.</p>
    </section>
  </div>
  <section class="tarjeta">
    <h2>${icono('catalogo')} Los 18 controles</h2>
    <div class="tabla-desplazable"><table class="tabla">
      <thead><tr><th>Control</th><th>Tema</th><th>Tarea del DBA</th><th>Riesgos</th><th>Importancia</th><th>Pruebas</th></tr></thead>
      <tbody>${c.controles.map((k) => html`<tr>
        <td><b>${k.id}</b> ${k.nombre}${k.adicional ? html` <span class="etiqueta">adicional</span>` : ''}</td><td>${k.tema}</td><td>${k.tarea} · ${k.tareaNombre}</td>
        <td>${k.riesgos.join(', ')}</td><td>${peso(k.peso)}</td>
        <td><ul class="lista-pruebas">${c.pruebas.filter((p) => p.controlId === k.id).map((p) => html`<li><code>${p.id}</code> ${p.nombre}${p.tipo === 'funcional' ? html` <span class="etiqueta">funcional</span>` : ''}${p.heuristica ? html` <span class="etiqueta etiqueta-aviso">heurística</span>` : ''}</li>`)}</ul></td>
      </tr>`)}</tbody></table></div>
  </section>`);
}
