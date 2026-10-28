import { api, ErrorApi } from '../api.js';
import { html, icono } from '../ui.js';
import { estado } from '../app.js';

export async function mostrar(raiz, _p, { ir }) {
  raiz.innerHTML = String(html`
  <div class="login">
    <section class="login-marca" aria-hidden="true">
      <div class="login-marca-interior">
        <span class="login-logo">${icono('escudo')}</span>
        <h2>Controles ISO/IEC 27001:2022</h2>
        <p>Auditoría de la confidencialidad en bases de datos Oracle: qué cumple, qué no, por qué y qué resolver primero.</p>
        <ul class="login-puntos">
          <li>${icono('terminal')} Evidencia con la consulta y la salida real</li>
          <li>${icono('objetivo')} 18 controles ponderados por riesgo</li>
          <li>${icono('auditoria')} Registro de auditoría con hash encadenado</li>
        </ul>
      </div>
    </section>
    <section class="login-panel">
      <form class="login-form" id="form-login" novalidate>
        <h1>Iniciar sesión</h1>
        <p class="sutil">Ingrese con su usuario y contraseña${estado.registro ? ', o cree una cuenta nueva' : ''}.</p>
        <div class="alerta alerta-error oculto" id="login-error" role="alert"></div>
        <label class="campo"><span>Usuario</span>
          <input name="usuario" autocomplete="username" required autofocus maxlength="40" spellcheck="false" autocapitalize="none"></label>
        <label class="campo"><span>Contraseña</span>
          <input name="clave" type="password" autocomplete="current-password" required maxlength="128"></label>
        <button class="boton boton-primario boton-ancho" type="submit">${icono('candado')} Ingresar</button>
        ${estado.registro ? html`<p class="crear-cuenta">¿No tiene cuenta? <a href="#/registro">Crear cuenta</a></p>` : ''}
        <p class="nota">Tras 5 intentos fallidos la cuenta se bloquea temporalmente. Cada ingreso queda en el registro de auditoría.</p>
      </form>
      <footer class="login-pie">UNA · EIF402 Administración de Bases de Datos</footer>
    </section>
  </div>`);
  const form = raiz.querySelector('#form-login');
  const error = raiz.querySelector('#login-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(form));
    error.classList.add('oculto');
    if (!datos.usuario || !datos.clave) {
      error.textContent = 'Escriba su usuario y su contraseña.';
      error.classList.remove('oculto');
      return;
    }
    const boton = form.querySelector('button');
    boton.disabled = true;
    try {
      const r = await api.post('/auth/login', datos);
      estado.usuario = r.usuario;
      ir('/');
    } catch (err) {
      error.textContent = err instanceof ErrorApi ? err.message : 'No se pudo contactar al servidor.';
      error.classList.remove('oculto');
      form.clave.value = '';
      form.clave.focus();
    } finally {
      boton.disabled = false;
    }
  });
}
