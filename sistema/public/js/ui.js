// Utilidades de interfaz: plantillas con escape automático, íconos, estados y formato.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

class Crudo { constructor(s) { this.s = s; } toString() { return this.s; } }
export const crudo = (s) => new Crudo(s);

// Plantilla: todo valor interpolado se escapa salvo que sea crudo() o un arreglo de crudos
export function html(partes, ...valores) {
  let out = '';
  partes.forEach((p, i) => {
    out += p;
    if (i < valores.length) {
      const v = valores[i];
      if (v instanceof Crudo) out += v.s;
      else if (Array.isArray(v)) out += v.map((x) => (x instanceof Crudo ? x.s : esc(x))).join('');
      else if (v !== false && v !== null && v !== undefined) out += esc(v);
    }
  });
  return crudo(out);
}

export function icono(nombre, clase = '') {
  return crudo(`<svg class="ico ${clase}" aria-hidden="true" focusable="false"><use href="#i-${nombre}"></use></svg>`);
}

export const ESTADOS = {
  CUMPLE: { clase: 'cumple', icono: 'cumple', texto: 'Cumple' },
  PARCIAL: { clase: 'parcial', icono: 'parcial', texto: 'Parcial' },
  'NO CUMPLE': { clase: 'nocumple', icono: 'nocumple', texto: 'No cumple' },
  'NO EVALUABLE': { clase: 'noevaluable', icono: 'noevaluable', texto: 'No evaluable' },
  OMITIDA: { clase: 'omitida', icono: 'omitida', texto: 'Omitida' },
};
export const ORDEN_ESTADOS = ['CUMPLE', 'PARCIAL', 'NO CUMPLE', 'NO EVALUABLE', 'OMITIDA'];

export function chip(estado, extra = '') {
  const e = ESTADOS[estado] || { clase: 'omitida', icono: 'omitida', texto: estado || '—' };
  return html`<span class="chip chip-${e.clase} ${extra}">${icono(e.icono)}<span>${e.texto}</span></span>`;
}

// Importancia según el peso: 10 = crítica, 8 = alta, 6 = media
export function peso(p) {
  const nivel = p >= 10 ? 3 : p >= 8 ? 2 : 1;
  const texto = nivel === 3 ? 'Crítica' : nivel === 2 ? 'Alta' : 'Media';
  return html`<span class="peso peso-${nivel}" title="Importancia ${texto.toLowerCase()} (peso ${p})">
    <span class="barras" aria-hidden="true"><i></i><i></i><i></i></span><span>Peso ${p}</span></span>`;
}

export function madurez(m) {
  if (m === null || m === undefined) return html`<span class="madurez vacia" title="Sin nivel de madurez">—</span>`;
  const puntos = [0, 1, 2, 3].map((i) => crudo(`<i class="${i < m ? 'on' : ''}"></i>`));
  return html`<span class="madurez" title="Madurez ${m} de 4" aria-label="Madurez ${m} de 4">${puntos}<b>${m}/4</b></span>`;
}

export function colorPuntaje(p) {
  if (p === null || p === undefined) return 'gris';
  if (p >= 80) return 'verde';
  if (p >= 50) return 'amarillo';
  return 'rojo';
}

export function textoPuntaje(p) {
  const c = colorPuntaje(p);
  return { verde: 'Nivel de cumplimiento alto', amarillo: 'Cumplimiento intermedio', rojo: 'Cumplimiento bajo: riesgo alto', gris: 'Sin datos' }[c];
}

export function numero(n, dec = 1) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: dec });
}

export function fecha(iso, conHora = true) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-CR', { dateStyle: 'medium', ...(conHora ? { timeStyle: 'short' } : {}) });
}

// Medidor semicircular del puntaje (SVG, sin estilos en línea)
export function medidor(p, { tam = 'grande' } = {}) {
  const valor = p === null || p === undefined ? 0 : Math.max(0, Math.min(100, p));
  const r = 80; const largo = Math.PI * r;
  const lleno = (valor / 100) * largo;
  const color = colorPuntaje(p);
  return html`<div class="medidor medidor-${tam} medidor-${color}" role="img" aria-label="Puntaje ${numero(p)} por ciento: ${textoPuntaje(p)}">
    <svg viewBox="0 0 200 116" aria-hidden="true">
      <path class="pista" d="M 20 100 A 80 80 0 0 1 180 100" />
      <path class="arco" d="M 20 100 A 80 80 0 0 1 180 100" stroke-dasharray="${lleno} ${largo}" />
      <line class="marca" x1="20" y1="104" x2="20" y2="112" /><line class="marca" x1="180" y1="104" x2="180" y2="112" />
    </svg>
    <div class="medidor-valor"><strong>${p === null || p === undefined ? '—' : numero(p)}</strong><span>%</span></div>
    <div class="medidor-texto">${icono(color === 'verde' ? 'cumple' : color === 'amarillo' ? 'parcial' : color === 'rojo' ? 'nocumple' : 'omitida')}${textoPuntaje(p)}</div>
  </div>`;
}

// Aplica anchos de barras desde data-ancho (CSP no permite estilos en línea)
export function aplicarAnchos(raiz) {
  raiz.querySelectorAll('[data-ancho]').forEach((el) => { el.style.width = `${Math.max(0, Math.min(100, Number(el.dataset.ancho)))}%`; });
}

export function notificar(mensaje, tipo = 'ok') {
  const zona = document.getElementById('notificaciones');
  const n = document.createElement('div');
  n.className = `aviso aviso-${tipo}`;
  n.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  n.textContent = mensaje;
  zona.appendChild(n);
  setTimeout(() => n.classList.add('saliendo'), 4200);
  setTimeout(() => n.remove(), 4700);
}

export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    notificar('Copiado al portapapeles');
  } catch {
    const t = document.createElement('textarea');
    t.value = texto; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); notificar('Copiado al portapapeles'); } catch { notificar('No se pudo copiar', 'error'); }
    t.remove();
  }
}

// Diálogo modal accesible basado en <dialog>
export function abrirDialogo({ titulo, contenido, ancho = 'normal', alCerrar }) {
  const d = document.createElement('dialog');
  d.className = `dialogo dialogo-${ancho}`;
  d.setAttribute('aria-labelledby', 'dialogo-titulo');
  d.innerHTML = String(html`<div class="dialogo-cabecera"><h2 id="dialogo-titulo">${titulo}</h2>
    <button type="button" class="boton-icono" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button></div>
    <div class="dialogo-cuerpo">${contenido}</div>`);
  document.body.appendChild(d);
  const cerrar = () => { d.close(); };
  d.addEventListener('close', () => { d.remove(); if (alCerrar) alCerrar(); });
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-cerrar]')) cerrar(); });
  d.showModal();
  return { dialogo: d, cerrar };
}

// Panel tipo terminal con la evidencia de una prueba
export function terminal(bloques, { titulo = 'Evidencia' } = {}) {
  if (!bloques || !bloques.length) {
    return html`<div class="terminal vacia"><div class="terminal-barra"><span></span><span></span><span></span><b>${titulo}</b></div>
      <pre>-- Esta prueba no ejecutó consultas (ver motivo).</pre></div>`;
  }
  const cuerpo = bloques.map((b) => {
    const salidaClase = b.error ? 'salida error' : 'salida';
    return html`<span class="prompt">$ </span><span class="cmd">${b.comando}</span>
<span class="ok">Connected.</span>
${b.binds ? html`<span class="sql">${b.binds}</span>\n` : ''}<span class="sql">${b.consulta}</span>

<span class="${salidaClase}">${b.salida}</span>
`;
  });
  const textoCopia = bloques.map((b) => `${b.comando}\n${b.binds ? b.binds.replace(/^SQL> /gm, '') + '\n' : ''}${b.consulta.replace(/^SQL> /, '').replace(/^ {2}\d+ {2}/gm, '')}`).join('\n\n');
  return html`<div class="terminal">
    <div class="terminal-barra"><span></span><span></span><span></span><b>${titulo}</b>
      <button type="button" class="boton-terminal" data-copiar="${textoCopia}">${icono('copiar')} Copiar comando y consulta</button></div>
    <pre tabindex="0">${cuerpo}</pre></div>`;
}

let contadorOjos = 0;

// Agrega a cada campo de contraseña un botón con un ojo para mostrar u ocultar lo que se escribe
export function activarOjos(raiz = document) {
  raiz.querySelectorAll('input[type="password"]:not([data-ojo])').forEach((input) => {
    input.dataset.ojo = '1';
    // El botón queda dentro de la etiqueta: el nombre del campo se fija al texto de la etiqueta
    const texto = input.closest('label') && input.closest('label').querySelector('span');
    if (texto && !input.hasAttribute('aria-label')) {
      if (!texto.id) texto.id = `etiqueta-clave-${++contadorOjos}`;
      input.setAttribute('aria-labelledby', texto.id);
    }
    const caja = document.createElement('span');
    caja.className = 'campo-clave';
    input.parentNode.insertBefore(caja, input);
    caja.appendChild(input);
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'boton-ojo';
    boton.setAttribute('aria-label', 'Mostrar contraseña');
    boton.setAttribute('aria-pressed', 'false');
    boton.innerHTML = String(icono('ojo'));
    boton.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      boton.setAttribute('aria-pressed', String(visible));
      boton.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
      boton.querySelector('use').setAttribute('href', visible ? '#i-ojo-cerrado' : '#i-ojo');
      input.focus();
    });
    // Al enviar el formulario se vuelve a ocultar, para que el navegador no la guarde como texto
    if (input.form) input.form.addEventListener('submit', () => { if (input.type === 'text') boton.click(); });
    caja.appendChild(boton);
  });
}

export function vacio(texto, ico = 'info') {
  return html`<div class="vacio">${icono(ico)}<p>${texto}</p></div>`;
}
