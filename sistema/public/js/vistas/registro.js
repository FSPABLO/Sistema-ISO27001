// Crear cuenta propia desde la pantalla de inicio de sesión (rol analista).
import { api, ErrorApi } from '../api.js';
import { html, icono } from '../ui.js';
import { estado } from '../app.js';

export async function mostrar(raiz, _p, { ir }) {
  if (!estado.registro) return ir('/login');
  raiz.innerHTML = String(html`
  <div class="login">
    <section class="login-marca" aria-hidden="true">
      <div class="login-marca-interior">
        <span class="login-logo">${icono('escudo')}</span>
        <h2>Cree su cuenta</h2>
        <p>Con una cuenta de analista puede registrar conexiones, ejecutar las pruebas de los 18 controles y ver sus propios resultados.</p>
        <ul class="login-puntos">
          <li>${icono('candado')} Contraseña de al menos 12 caracteres, guardada con bcrypt</li>
          <li>${icono('auditoria')} La creación de la cuenta queda en el registro de auditoría</li>
        </ul>
      </div>
    </section>
    <section class="login-panel">
      <form class="login-form" id="form-registro" novalidate>
        <h1>Crear cuenta</h1>
        <p class="sutil">Su cuenta tendrá el rol <b>Analista</b>. Si necesita otro rol, pídaselo al administrador.</p>
        <div class="alerta alerta-error oculto" id="registro-error" role="alert"></div>
        <label class="campo"><span>Nombre completo</span><input name="nombre" autocomplete="name" required maxlength="100" autofocus></label>
        <label class="campo"><span>Usuario</span>
          <input name="usuario" autocomplete="username" required maxlength="40" spellcheck="false" autocapitalize="none">
          <small>De 3 a 40 caracteres: letras, números, punto, guion o guion bajo.</small></label>
        <label class="campo"><span>Contraseña</span><input name="clave" type="password" autocomplete="new-password" required minlength="12" maxlength="128"></label>
        <label class="campo"><span>Repita la contraseña</span><input name="repetir" type="password" autocomplete="new-password" required maxlength="128"></label>
        <ul class="politica">
          <li data-regla="largo">${icono('omitida')} Al menos 12 caracteres</li>
          <li data-regla="usuario">${icono('omitida')} No contiene el nombre de usuario</li>
          <li data-regla="igual">${icono('omitida')} Ambas contraseñas coinciden</li>
        </ul>
        <button class="boton boton-primario boton-ancho" type="submit">${icono('mas')} Crear cuenta</button>
        <p class="crear-cuenta">¿Ya tiene cuenta? <a href="#/login">Iniciar sesión</a></p>
      </form>
    </section>
  </div>`);
  const form = raiz.querySelector('#form-registro');
  const error = raiz.querySelector('#registro-error');
  const reglas = () => {
    const c = form.clave.value;
    const u = form.usuario.value.trim().toLowerCase();
    const ok = { largo: c.length >= 12, usuario: c.length > 0 && (!u || !c.toLowerCase().includes(u)), igual: c.length > 0 && c === form.repetir.value };
    for (const [k, v] of Object.entries(ok)) {
      const li = form.querySelector(`[data-regla="${k}"]`);
      li.classList.toggle('ok', v);
      li.querySelector('use').setAttribute('href', v ? '#i-cumple' : '#i-omitida');
    }
    return Object.values(ok).every(Boolean);
  };
  form.addEventListener('input', reglas);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.classList.add('oculto');
    if (!reglas()) { error.textContent = 'Revise la contraseña: debe cumplir las tres condiciones.'; error.classList.remove('oculto'); return; }
    const boton = form.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      const r = await api.post('/auth/registro', { nombre: form.nombre.value, usuario: form.usuario.value.trim(), clave: form.clave.value });
      estado.usuario = r.usuario;
      ir('/');
    } catch (err) {
      error.textContent = err instanceof ErrorApi ? (err.cuerpo && err.cuerpo.errores ? err.cuerpo.errores.join(' ') : err.message) : 'No se pudo contactar al servidor.';
      error.classList.remove('oculto');
    } finally {
      boton.disabled = false;
    }
  });
}
