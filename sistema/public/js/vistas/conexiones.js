import { api } from '../api.js';
import { html, icono, fecha, notificar, abrirDialogo, vacio } from '../ui.js';
import { puede } from '../app.js';

function infoConexion(info) {
  const cifrado = info.red && info.red.cifrado;
  return html`<dl class="datos-servidor">
    <div><dt>Versión</dt><dd>${info.version}</dd></div>
    <div><dt>Contenedor / PDB</dt><dd>${info.contenedor}${info.cdb ? ` (CDB ${info.cdb})` : ''}</dd></div>
    <div><dt>Servidor</dt><dd>${info.servidor || '—'} · instancia ${info.instancia || '—'}</dd></div>
    <div><dt>Usuario de sesión</dt><dd>${info.usuario}</dd></div>
    <div><dt>Canal de red</dt><dd>${cifrado
    ? html`<span class="chip chip-cumple">${icono('candado')}<span>Cifrado ${cifrado}${info.red.integridad ? ` · integridad ${info.red.integridad}` : ''}</span></span>`
    : html`<span class="chip chip-nocumple">${icono('candado-abierto')}<span>Sin cifrar (texto claro)</span></span>`}</dd></div>
    <div><dt>Cliente</dt><dd>Oracle Instant Client ${info.cliente || ''} · modo ${info.modo}</dd></div>
  </dl>`;
}

export function pedirClave({ titulo, usuario, alEnviar, textoBoton = 'Probar conexión' }) {
  const { dialogo, cerrar } = abrirDialogo({
    titulo,
    contenido: html`<form class="formulario" id="form-probar">
      <p class="sutil">La contraseña de <code>${usuario}</code> no se guarda: solo se usa en memoria para esta acción.</p>
      <label class="campo"><span>Contraseña de la base</span><input type="password" name="clave" required autocomplete="off" autofocus></label>
      <div class="resultado-prueba" aria-live="polite"></div>
      <div class="acciones"><button class="boton boton-primario" type="submit">${icono('rayo')} ${textoBoton}</button></div>
    </form>`,
  });
  const form = dialogo.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = form.querySelector('button');
    const salida = form.querySelector('.resultado-prueba');
    boton.disabled = true;
    salida.innerHTML = '<div class="cargando"><span class="girador"></span>Conectando…</div>';
    try {
      const contenido = await alEnviar(form.clave.value);
      salida.innerHTML = String(contenido);
    } catch (err) {
      salida.innerHTML = String(html`<div class="alerta alerta-error">${icono('nocumple')}<span>${err.message}</span></div>`);
    } finally {
      form.clave.value = '';
      boton.disabled = false;
    }
  });
  return { cerrar };
}

export async function mostrar(raiz) {
  const { conexiones, motores } = await api.get('/conexiones');
  const gestiona = puede('ejecutar');
  raiz.innerHTML = String(html`
  <div class="encabezado"><div><p class="eyebrow">Bases de datos auditadas</p><h1>Conexiones</h1>
    <p class="sutil">Se guardan alias, host, puerto, servicio y usuario. La contraseña se pide en cada prueba y nunca se guarda.</p></div></div>
  <div class="rejilla-2 rejilla-conexiones">
    <section class="tarjeta">
      <div class="tarjeta-cabecera"><h2>Registradas</h2></div>
      ${conexiones.length ? html`<ul class="lista-tarjetas">${conexiones.map((c) => html`
        <li class="conexion-tarjeta ${c.activa ? '' : 'inactiva'}">
          <div class="conexion-tarjeta-cabeza"><span class="motor">${icono('conexion')} Oracle</span>
            ${c.activa ? '' : html`<span class="chip chip-omitida">${icono('omitida')}<span>Inactiva</span></span>`}</div>
          <strong>${c.alias}</strong>
          <code>sqlplus ${c.usuario.toLowerCase()}/********@//${c.host}:${c.puerto}/${c.servicio}</code>
          <small>Registrada ${fecha(c.creado, false)}${c.creadoPor ? ` por ${c.creadoPor}` : ''} · ${c.ejecuciones} ejecución(es)</small>
          ${gestiona ? html`<div class="acciones">
            ${c.activa ? html`<button class="boton boton-pequeno" data-probar="${c.id}">${icono('rayo')} Probar conexión</button>
            <a class="boton boton-pequeno boton-primario" href="#/nueva?conexion=${c.id}">${icono('ejecutar')} Ejecutar</a>` : ''}
            <button class="boton boton-pequeno boton-sutil" data-activa="${c.id}" data-valor="${c.activa ? '0' : '1'}">${c.activa ? 'Desactivar' : 'Reactivar'}</button>
          </div>` : ''}
        </li>`)}</ul>` : vacio('No hay conexiones registradas.', 'conexion')}
    </section>
    ${gestiona ? html`<section class="tarjeta">
      <div class="tarjeta-cabecera"><h2>${icono('mas')} Registrar conexión</h2></div>
      <form class="formulario" id="form-conexion" novalidate>
        <div class="alerta alerta-error oculto" role="alert"></div>
        <label class="campo"><span>Alias</span><input name="alias" required maxlength="60" placeholder="Laboratorio endurecido"></label>
        <label class="campo"><span>Motor</span><select name="motor">${motores.map((m) => html`<option value="${m.id}">${m.nombre}</option>`)}</select></label>
        <div class="fila-campos">
          <label class="campo crece"><span>Host</span><input name="host" required placeholder="host.docker.internal" spellcheck="false"></label>
          <label class="campo corto"><span>Puerto</span><input name="puerto" type="number" min="1" max="65535" value="1521" required></label>
        </div>
        <label class="campo"><span>Servicio</span><input name="servicio" required placeholder="FREEPDB1" spellcheck="false"></label>
        <label class="campo"><span>Usuario de la base</span><input name="usuario" required placeholder="ISO_AUDIT" spellcheck="false" autocapitalize="characters"></label>
        <p class="nota">${icono('info')} Use la cuenta de mínimo privilegio creada con <code>sql/crear_usuario_auditoria.sql</code>. Desde Docker, el Mac se alcanza como <code>host.docker.internal</code>.</p>
        <div class="acciones"><button class="boton boton-primario" type="submit">${icono('mas')} Registrar</button></div>
      </form>
    </section>` : ''}
  </div>`);

  raiz.querySelectorAll('[data-probar]').forEach((b) => b.addEventListener('click', () => {
    const c = conexiones.find((x) => String(x.id) === b.dataset.probar);
    pedirClave({
      titulo: `Probar conexión · ${c.alias}`, usuario: c.usuario,
      alEnviar: async (clave) => {
        const r = await api.post(`/conexiones/${c.id}/probar`, { clave });
        return html`<div class="alerta alerta-ok">${icono('cumple')}<span>Conexión exitosa</span></div>${infoConexion(r.info)}`;
      },
    });
  }));
  raiz.querySelectorAll('[data-activa]').forEach((b) => b.addEventListener('click', async () => {
    await api.patch(`/conexiones/${b.dataset.activa}/activa`, { activa: b.dataset.valor === '1' });
    notificar(b.dataset.valor === '1' ? 'Conexión reactivada' : 'Conexión desactivada');
    mostrar(raiz);
  }));
  const form = raiz.querySelector('#form-conexion');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const error = form.querySelector('.alerta-error');
      error.classList.add('oculto');
      try {
        await api.post('/conexiones', Object.fromEntries(new FormData(form)));
        notificar('Conexión registrada');
        mostrar(raiz);
      } catch (err) {
        error.textContent = err.cuerpo && err.cuerpo.errores ? err.cuerpo.errores.join(' ') : err.message;
        error.classList.remove('oculto');
      }
    });
  }
}
