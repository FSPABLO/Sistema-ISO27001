import { api } from '../api.js';
import { html, icono, fecha, notificar, abrirDialogo } from '../ui.js';
import { estado } from '../app.js';

const ROLES = { administrador: 'Administrador', analista: 'Analista', auditor: 'Auditor' };
const DESCRIPCION_ROL = {
  administrador: 'Gestiona usuarios, ejecuta pruebas, ve todo y el registro de auditoría.',
  analista: 'Registra conexiones y ejecuta pruebas; ve solo sus ejecuciones.',
  auditor: 'Solo lectura: ve todas las ejecuciones, informes y el registro de auditoría.',
};

export async function mostrar(raiz) {
  const { usuarios } = await api.get('/usuarios');
  raiz.innerHTML = String(html`
  <div class="encabezado"><div><p class="eyebrow">Administración</p><h1>Usuarios del sistema</h1>
    <p class="sutil">Las contraseñas se guardan con bcrypt. Mínimo 12 caracteres; bloqueo temporal tras 5 intentos fallidos.</p></div></div>
  <div class="rejilla-usuarios">
    <section class="tarjeta">
      <div class="tarjeta-cabecera"><h2>${icono('usuarios')} Cuentas</h2></div>
      <div class="tabla-desplazable"><table class="tabla">
        <thead><tr><th scope="col">Usuario</th><th scope="col">Rol</th><th scope="col">Estado</th><th scope="col">Último ingreso</th><th scope="col">Acciones</th></tr></thead>
        <tbody>${usuarios.map((u) => {
    const bloqueado = u.bloqueadoHasta && Date.parse(u.bloqueadoHasta) > Date.now();
    const yo = u.id === estado.usuario.id;
    return html`<tr class="${u.activo ? '' : 'inactiva'}">
          <td><strong>${u.usuario}</strong>${yo ? html` <span class="etiqueta">usted</span>` : ''}<small class="bloque">${u.nombre}</small></td>
          <td><select data-rol="${u.id}" aria-label="Rol de ${u.usuario}" ${yo ? 'disabled' : ''}>${Object.entries(ROLES).map(([v, t]) => html`<option value="${v}" ${v === u.rol ? 'selected' : ''}>${t}</option>`)}</select></td>
          <td>${!u.activo ? html`<span class="chip chip-omitida">${icono('omitida')}<span>Desactivada</span></span>`
      : bloqueado ? html`<span class="chip chip-nocumple">${icono('candado')}<span>Bloqueada</span></span>`
          : html`<span class="chip chip-cumple">${icono('cumple')}<span>Activa</span></span>`}</td>
          <td class="nowrap">${fecha(u.ultimoIngreso)}</td>
          <td class="acciones-tabla">
            <button class="boton boton-pequeno" data-restablecer="${u.id}" data-usuario="${u.usuario}">${icono('llave')} Restablecer clave</button>
            ${yo ? '' : html`<button class="boton boton-pequeno boton-sutil" data-activo="${u.id}" data-valor="${u.activo ? '0' : '1'}">${u.activo ? 'Desactivar' : 'Reactivar'}</button>`}
          </td></tr>`;
  })}</tbody></table></div>
    </section>
    <section class="tarjeta">
      <div class="tarjeta-cabecera"><h2>${icono('mas')} Nuevo usuario</h2></div>
      <form class="formulario" id="form-usuario" novalidate>
        <div class="alerta alerta-error oculto" role="alert"></div>
        <label class="campo"><span>Usuario</span><input name="usuario" required maxlength="40" spellcheck="false" autocapitalize="none"></label>
        <label class="campo"><span>Nombre completo</span><input name="nombre" required maxlength="100"></label>
        <fieldset class="grupo roles"><legend>Rol</legend>
          ${Object.entries(ROLES).map(([v, t], i) => html`<label class="opcion-rol"><input type="radio" name="rol" value="${v}" ${i === 1 ? 'checked' : ''}><span><strong>${t}</strong><small>${DESCRIPCION_ROL[v]}</small></span></label>`)}
        </fieldset>
        <label class="campo"><span>Contraseña inicial</span><input name="clave" type="password" required minlength="12" autocomplete="new-password"><small>Es la contraseña definitiva; el usuario puede cambiarla cuando quiera.</small></label>
        <div class="acciones"><button class="boton boton-primario" type="submit">${icono('mas')} Crear usuario</button></div>
      </form>
    </section>
  </div>`);

  const recargar = () => mostrar(raiz);
  raiz.querySelectorAll('[data-rol]').forEach((s) => s.addEventListener('change', async () => {
    try { await api.patch(`/usuarios/${s.dataset.rol}/rol`, { rol: s.value }); notificar('Rol actualizado'); } catch (e) { notificar(e.message, 'error'); }
    recargar();
  }));
  raiz.querySelectorAll('[data-activo]').forEach((b) => b.addEventListener('click', async () => {
    try { await api.patch(`/usuarios/${b.dataset.activo}/activo`, { activo: b.dataset.valor === '1' }); notificar(b.dataset.valor === '1' ? 'Usuario reactivado' : 'Usuario desactivado'); } catch (e) { notificar(e.message, 'error'); }
    recargar();
  }));
  raiz.querySelectorAll('[data-restablecer]').forEach((b) => b.addEventListener('click', () => {
    const { dialogo, cerrar } = abrirDialogo({
      titulo: `Restablecer contraseña · ${b.dataset.usuario}`,
      contenido: html`<form class="formulario"><div class="alerta alerta-error oculto" role="alert"></div>
        <label class="campo"><span>Nueva contraseña</span><input name="clave" type="password" minlength="12" required autocomplete="new-password" autofocus></label>
        <p class="nota">${icono('info')} Entréguela al usuario por un medio seguro. La acción queda en el registro de auditoría.</p>
        <div class="acciones"><button class="boton boton-primario" type="submit">Restablecer</button></div></form>`,
    });
    dialogo.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.post(`/usuarios/${b.dataset.restablecer}/restablecer-clave`, { clave: e.target.clave.value });
        cerrar(); notificar('Contraseña restablecida'); recargar();
      } catch (err) {
        const a = dialogo.querySelector('.alerta-error'); a.textContent = err.message; a.classList.remove('oculto');
      }
    });
  }));
  const form = raiz.querySelector('#form-usuario');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = form.querySelector('.alerta-error');
    error.classList.add('oculto');
    try {
      await api.post('/usuarios', Object.fromEntries(new FormData(form)));
      notificar('Usuario creado');
      recargar();
    } catch (err) {
      error.textContent = err.cuerpo && err.cuerpo.errores ? err.cuerpo.errores.join(' ') : err.message;
      error.classList.remove('oculto');
    }
  });
}
